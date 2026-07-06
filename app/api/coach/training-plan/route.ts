import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createIntervalsClient } from '@/lib/intervals/client'
import type { ProposedTrainingPlan, TrainingPlanSession } from '@/lib/types/coach-widgets'

// ── GET: check conflicts in a date range ──────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!start || !end) return NextResponse.json({ error: 'start and end required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: conflicting } = await admin
    .from('session_notes')
    .select('id, session_date, session_type, sport, name, planned_duration_seconds, actual_duration_seconds')
    .eq('user_id', user.id)
    .gte('session_date', start)
    .lte('session_date', end)
    .eq('is_archived', false)

  return NextResponse.json({ conflicts: conflicting ?? [] })
}

// ── POST: confirm and write the plan ─────────────────────────────────────────

interface WritePlanBody {
  plan: ProposedTrainingPlan
  conflictResolution: 'replace' | 'keep_both'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as WritePlanBody | null
  if (!body?.plan) return NextResponse.json({ error: 'plan required' }, { status: 400 })

  const { plan, conflictResolution = 'replace' } = body
  const admin = createAdminClient()

  // Load user credentials for Intervals.icu
  const { data: userData } = await admin
    .from('users')
    .select('intervals_api_key, intervals_athlete_id')
    .eq('id', user.id)
    .single()

  // 1. If replacing, delete conflicting session_notes rows and Intervals events
  if (conflictResolution === 'replace') {
    const { data: existing } = await admin
      .from('session_notes')
      .select('id, session_id')
      .eq('user_id', user.id)
      .gte('session_date', plan.start_date)
      .lte('session_date', plan.end_date)
      .eq('is_archived', false)

    if (existing && existing.length > 0) {
      // Delete from Intervals.icu
      if (userData?.intervals_api_key && userData?.intervals_athlete_id) {
        try {
          const client = createIntervalsClient(
            userData.intervals_api_key as string,
            userData.intervals_athlete_id as string,
          )
          const events = await client.getCalendarEvents(plan.start_date, plan.end_date)
          const externalIds = new Set((existing as Array<{ session_id: string }>).map((r) => r.session_id))
          const toDelete = events.filter((e) => e.external_id && externalIds.has(e.external_id) && e.id != null)
          await Promise.allSettled(toDelete.map((e) => client.deleteEventById(e.id!)))
        } catch (err) {
          console.error('[training-plan] Intervals delete failed:', err)
        }
      }
      // Delete from session_notes
      await admin
        .from('session_notes')
        .delete()
        .eq('user_id', user.id)
        .in('id', (existing as Array<{ id: string }>).map((r) => r.id))
    }
  }

  // 2. Insert training_plans row
  const { data: planRow, error: planErr } = await admin
    .from('training_plans')
    .insert({
      user_id: user.id,
      start_date: plan.start_date,
      end_date: plan.end_date,
      linked_race_id: plan.linked_race_id ?? null,
      goal: plan.goal,
      phases: plan.phases,
      status: 'active',
    })
    .select('id')
    .single()

  if (planErr || !planRow) {
    console.error('[training-plan] plan insert error:', planErr)
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 })
  }

  const planId = (planRow as { id: string }).id

  // 3. Batch-write sessions
  const sessionsToInsert = plan.sessions.map((s: TrainingPlanSession) => {
    const externalId = `endurance-os-plan-${planId.slice(0, 8)}-${s.date}-${s.sport.slice(0, 3)}`
    return {
      user_id: user.id,
      session_id: externalId,
      session_date: s.date,
      session_type: s.sport,
      sport: s.sport,
      name: s.name ?? null,
      planned_tss: s.target_tss ?? null,
      planned_duration_seconds: s.duration_minutes * 60,
      intervals_format: s.intervals_format ?? null,
      detail_level: s.detail_level,
      plan_phase: s.plan_phase,
      training_plan_id: planId,
      is_archived: false,
    }
  })

  const { data: insertedSessions, error: sessErr } = await admin
    .from('session_notes')
    .insert(sessionsToInsert)
    .select('id, session_id, session_date, sport, name')

  if (sessErr) {
    console.error('[training-plan] sessions insert error:', sessErr)
    // Plan row is already written — attempt to clean up
    await admin.from('training_plans').delete().eq('id', planId)
    return NextResponse.json({ error: 'Failed to write sessions' }, { status: 500 })
  }

  // 4. Write to Intervals.icu
  if (userData?.intervals_api_key && userData?.intervals_athlete_id) {
    try {
      const client = createIntervalsClient(
        userData.intervals_api_key as string,
        userData.intervals_athlete_id as string,
      )

      const sportToType = (sport: string) => {
        const map: Record<string, string> = {
          cycling: 'Ride', running: 'Run', swimming: 'Swim',
          strength: 'WeightTraining', general: 'Workout',
        }
        return map[sport] ?? 'Workout'
      }

      const events = plan.sessions.map((s: TrainingPlanSession, i: number) => {
        const inserted = (insertedSessions as Array<{ session_id: string }>)[i]
        return {
          category: 'WORKOUT' as const,
          start_date_local: `${s.date}T00:00:00`,
          type: sportToType(s.sport),
          name: s.name ?? `${s.sport.charAt(0).toUpperCase() + s.sport.slice(1)} session`,
          description: s.detail_level === 'full' ? (s.intervals_format ?? '') : `[Outline] ${s.duration_minutes}min ${s.sport}`,
          icu_training_load: s.target_tss ?? 0,
          external_id: inserted?.session_id ?? '',
        }
      })

      // Batch in chunks of 50 to avoid payload limits
      for (let i = 0; i < events.length; i += 50) {
        await client.createOrUpdateEvents(events.slice(i, i + 50))
      }
    } catch (err) {
      console.error('[training-plan] Intervals write failed (non-fatal):', err)
    }
  }

  return NextResponse.json({ success: true, planId, sessionsWritten: sessionsToInsert.length })
}
