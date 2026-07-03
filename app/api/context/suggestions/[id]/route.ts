import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Tables that can be targeted by context suggestions
const ALLOWED_TABLES = new Set([
  'plan_dna', 'training_patterns', 'adaptation_rules', 'race_goals',
  'fueling_strategy', 'illnesses', 'injuries', 'recovery_preferences', 'session_notes',
])

// What "archive" means per module (column(s) to set)
const ARCHIVE_FIELDS: Record<string, Record<string, unknown>> = {
  illnesses:         { date_cleared: '' },   // filled with today's date at apply time
  injuries:          { date_cleared: '' },
  training_patterns: { status: 'archived' },
  adaptation_rules:  { enabled: false },
  race_goals:        { status: 'completed' },
}

function parseFields(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch { /* fall through */ }
  return {}
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { action, editedValue }: { action: 'accept' | 'reject' | 'edit'; editedValue?: string } = body

  const admin = createAdminClient()

  const { data: suggestion, error: fetchError } = await admin
    .from('context_suggestions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !suggestion) {
    return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
  }

  const s = suggestion as Record<string, unknown>

  if (action === 'reject') {
    await admin
      .from('context_suggestions')
      .update({ status: 'rejected', resolved_at: new Date().toISOString() })
      .eq('id', id)
    return NextResponse.json({ success: true })
  }

  const resolvedValue = editedValue ?? (s.suggested_value as string)

  const targetModule = s.target_module as string
  const actionType = s.action_type as string
  const targetId = s.target_field as string | null  // real DB uuid for update/archive/delete
  const now = new Date().toISOString()
  const today = now.split('T')[0]

  if (!ALLOWED_TABLES.has(targetModule)) {
    return NextResponse.json({ error: 'Invalid target module' }, { status: 400 })
  }

  try {
    if (actionType === 'create') {
      const fields = parseFields(resolvedValue)
      const { error } = await admin
        .from(targetModule)
        .insert({ ...fields, user_id: user.id, created_at: now, updated_at: now })
      if (error) throw error

    } else if (actionType === 'update' && targetId) {
      const fields = parseFields(resolvedValue)
      const { error } = await admin
        .from(targetModule)
        .update({ ...fields, updated_at: now })
        .eq('id', targetId)
        .eq('user_id', user.id)
      if (error) throw error

    } else if (actionType === 'archive' && targetId) {
      const archiveTemplate = ARCHIVE_FIELDS[targetModule]
      const archivePayload: Record<string, unknown> = archiveTemplate
        ? { ...archiveTemplate, updated_at: now }
        : { status: 'archived', updated_at: now }

      // Fill in the date for illnesses/injuries
      if (archivePayload.date_cleared === '') archivePayload.date_cleared = today

      // Carry the cleared_note from the resolved value (the reasoning text)
      if (targetModule === 'illnesses' || targetModule === 'injuries') {
        archivePayload.cleared_note = resolvedValue || (s.reasoning as string ?? '')
      }

      const { error } = await admin
        .from(targetModule)
        .update(archivePayload)
        .eq('id', targetId)
        .eq('user_id', user.id)
      if (error) throw error

      // Write to injury_history when archiving an illness or injury
      if (targetModule === 'illnesses' || targetModule === 'injuries') {
        const { data: row } = await admin
          .from(targetModule)
          .select('*')
          .eq('id', targetId)
          .single()
        if (row) {
          const r = row as Record<string, unknown>
          await admin.from('injury_history').insert({
            user_id: user.id,
            body_part: targetModule === 'injuries' ? (r.body_part ?? 'general') : 'general',
            description: targetModule === 'illnesses'
              ? `${r.name ?? 'Illness'} — ${r.description ?? ''}`
              : (r.description ?? ''),
            date_start: r.date_start ?? today,
            date_resolved: today,
            resolution: resolvedValue || (s.reasoning as string ?? ''),
            source: 'ai_conversation',
            source_conversation_id: s.source_conversation_id ?? null,
          })
        }
      }

    } else if (actionType === 'delete' && targetId) {
      const { error } = await admin
        .from(targetModule)
        .delete()
        .eq('id', targetId)
        .eq('user_id', user.id)
      if (error) throw error

    } else {
      // Unknown action or missing targetId where required
      console.warn('[suggestions] unhandled actionType:', actionType, 'targetId:', targetId)
    }
  } catch (err) {
    console.error('[context/suggestions] apply error:', err)
    return NextResponse.json({ error: 'Failed to apply suggestion' }, { status: 500 })
  }

  await admin
    .from('context_suggestions')
    .update({
      status: action === 'edit' ? 'edited' : 'accepted',
      resolved_at: now,
      resolved_value: resolvedValue,
    })
    .eq('id', id)

  return NextResponse.json({ success: true })
}
