import { createAdminClient } from '@/lib/supabase/admin'
import type { SessionNoteRow } from './types'

interface MatchResult {
  match: boolean
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

function formatMins(secs: number | null | undefined): string {
  if (secs == null) return 'unknown'
  return `${Math.round(secs / 60)} min`
}

// Sports that can match each other (e.g. Pilates syncs as 'general' but planned as 'strength')
const COMPATIBLE_SPORTS: Record<string, string[]> = {
  general:  ['strength', 'general'],
  strength: ['general',  'strength'],
}

function sportsCompatible(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  if (a === b) return true
  return (COMPATIBLE_SPORTS[a] ?? []).includes(b)
}

async function checkSimilarity(
  planned: SessionNoteRow,
  completed: SessionNoteRow,
  anthropicKey: string,
): Promise<MatchResult> {
  // Hard filter: sport must be compatible
  if (!sportsCompatible(planned.sport, completed.sport)) {
    return { match: false, confidence: 'high', reason: 'Different sport' }
  }

  // Hard filter: completed < 40% of planned duration → clearly not the same session
  if (planned.planned_duration_seconds && completed.actual_duration_seconds) {
    const ratio = completed.actual_duration_seconds / planned.planned_duration_seconds
    if (ratio < 0.4) {
      return { match: false, confidence: 'high', reason: 'Completed duration less than 40% of planned' }
    }
  }

  const prompt = `You are deciding whether an athlete completed their planned workout.

Planned session:
- Sport: ${planned.sport}
- Duration: ${formatMins(planned.planned_duration_seconds)}
- Name: ${planned.name ?? 'not specified'}
- Description: ${planned.description ?? planned.intervals_format?.split('\n')[0] ?? 'not specified'}
- Target TSS: ${planned.planned_tss ?? 'not specified'}

Completed activity:
- Sport: ${completed.sport}
- Duration: ${formatMins(completed.actual_duration_seconds)}
- Activity name: ${completed.activity_name ?? 'not specified'}
- TSS: ${completed.actual_tss ?? 'unknown'}

Determine if the completed activity represents the athlete doing their planned session (even imperfectly — shorter, longer, or slightly different metrics are OK as long as the session type/intent matches). They should be the same kind of workout, not completely unrelated efforts.

Return only valid JSON: { "match": true or false, "confidence": "high" or "medium" or "low", "reason": "one brief sentence" }`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) return { match: false, confidence: 'low', reason: 'AI check failed' }

    const data = await res.json() as { content?: { text?: string }[] }
    const text = data.content?.[0]?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as MatchResult
      return parsed
    }
  } catch (e) {
    console.error('[matching] AI check error', e)
  }

  return { match: false, confidence: 'low', reason: 'Could not parse AI response' }
}

export async function runActivityMatching(
  userId: string,
  // Optional: restrict to specific session IDs (newly synced). When omitted,
  // scans all unmatched completed sessions in the last 60 days so existing
  // sessions are retroactively matched too.
  completedSessionIds?: string[],
): Promise<void> {
  const supabase = createAdminClient()

  const { data: userData } = await supabase
    .from('users')
    .select('anthropic_api_key')
    .eq('id', userId)
    .single()

  const anthropicKey = (userData as { anthropic_api_key?: string } | null)?.anthropic_api_key
  if (!anthropicKey) return

  // Scan all unmatched completed sessions in the last 60 days
  const since = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0]

  let query = supabase
    .from('session_notes')
    .select('*')
    .eq('user_id', userId)
    .not('actual_duration_seconds', 'is', null)
    .is('matched_session_id', null)
    .gte('session_date', since)

  if (completedSessionIds && completedSessionIds.length > 0) {
    query = query.in('session_id', completedSessionIds)
  }

  const { data: completedSessions } = await query

  if (!completedSessions?.length) return

  const dates = [...new Set((completedSessions as SessionNoteRow[]).map(s => s.session_date))]

  // Fetch planned sessions on those dates
  const { data: plannedSessions } = await supabase
    .from('session_notes')
    .select('*')
    .eq('user_id', userId)
    .in('session_date', dates)
    .is('actual_duration_seconds', null)
    .eq('is_archived', false)

  if (!plannedSessions?.length) return

  // Find which planned sessions are already claimed by a previous match
  const { data: existingMatches } = await supabase
    .from('session_notes')
    .select('matched_session_id')
    .eq('user_id', userId)
    .not('matched_session_id', 'is', null)

  const claimedIds = new Set<string>(
    (existingMatches ?? [])
      .map((r: { matched_session_id: string | null }) => r.matched_session_id)
      .filter((id): id is string => id != null),
  )

  // Build lookup: date → planned sessions (sport filtering done via sportsCompatible)
  const plannedByDate = new Map<string, SessionNoteRow[]>()
  for (const p of plannedSessions as SessionNoteRow[]) {
    plannedByDate.set(p.session_date, [...(plannedByDate.get(p.session_date) ?? []), p])
  }

  for (const completed of completedSessions as SessionNoteRow[]) {
    const candidates = (plannedByDate.get(completed.session_date) ?? [])
      .filter(p => !claimedIds.has(p.session_id) && sportsCompatible(completed.sport, p.sport))
    if (candidates.length === 0) continue

    // Pick the candidate closest in duration
    const best = candidates.reduce((b, c) => {
      if (!b.planned_duration_seconds) return c
      if (!c.planned_duration_seconds) return b
      const act = completed.actual_duration_seconds ?? 0
      return Math.abs(c.planned_duration_seconds - act) < Math.abs(b.planned_duration_seconds - act) ? c : b
    })

    const result = await checkSimilarity(best, completed, anthropicKey)
    console.log(`[matching] ${completed.session_id} ↔ ${best.session_id}: match=${result.match} (${result.confidence}) — ${result.reason}`)

    if (result.match) {
      await supabase
        .from('session_notes')
        .update({ matched_session_id: best.session_id, match_status: 'auto' })
        .eq('user_id', userId)
        .eq('session_id', completed.session_id)

      claimedIds.add(best.session_id)
    }
  }
}
