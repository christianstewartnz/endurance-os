import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function parseValue(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
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

  // Fetch and verify ownership
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

  // accept or edit
  const resolvedValue = editedValue ?? (s.suggested_value as string)

  // Apply the change to the target table
  const targetModule = s.target_module as string
  const actionType = s.action_type as string
  const targetField = s.target_field as string | null
  const now = new Date().toISOString()

  try {
    if (actionType === 'append' && targetModule === 'training_patterns') {
      await admin.from('training_patterns').insert({
        user_id: user.id,
        pattern_text: resolvedValue,
        category: targetField || 'general',
        confidence: 'low',
        observation_count: 1,
        evidence: s.evidence ?? null,
        source_conversation_id: s.source_conversation_id ?? null,
        status: 'active',
        first_observed_date: now,
        last_observed_date: now,
      })
    } else if (actionType === 'append' && targetModule === 'health_injury') {
      const itemObject = parseValue(resolvedValue) as Record<string, unknown>
      if (itemObject && typeof itemObject === 'object') {
        itemObject.id = crypto.randomUUID()
        const today = new Date().toISOString().split('T')[0]
        if (targetField === 'illnesses') {
          itemObject.date_added = today
          const { data: healthRow } = await admin
            .from('health_injury')
            .select('illnesses')
            .eq('user_id', user.id)
            .single()
          const current = (healthRow as Record<string, unknown> | null)?.illnesses
          const existing = Array.isArray(current) ? current : []
          await admin
            .from('health_injury')
            .update({ illnesses: [...existing, itemObject], updated_at: now })
            .eq('user_id', user.id)
        } else {
          // active_injuries (physical injuries)
          const { data: healthRow } = await admin
            .from('health_injury')
            .select('active_injuries')
            .eq('user_id', user.id)
            .single()
          const current = (healthRow as Record<string, unknown> | null)?.active_injuries
          const existing = Array.isArray(current) ? current : []
          await admin
            .from('health_injury')
            .update({ active_injuries: [...existing, itemObject], updated_at: now })
            .eq('user_id', user.id)
        }
      }
    } else if (actionType === 'update_field' && targetField) {
      const value = parseValue(resolvedValue)
      await admin
        .from(targetModule)
        .update({ [targetField]: value, updated_at: now })
        .eq('user_id', user.id)
    } else if (actionType === 'archive' && targetModule === 'training_patterns') {
      const targetRecordId = s.target_record_id as string | null
      if (targetRecordId) {
        await admin
          .from('training_patterns')
          .update({ status: 'archived', updated_at: now })
          .eq('id', targetRecordId)
          .eq('user_id', user.id)
      }
    } else if (actionType === 'archive' && targetModule === 'health_injury') {
      const illnessMatch = targetField?.match(/^illness_(\d+)$/)
      const injuryMatch = targetField?.match(/^active_injury_(\d+)$/)
      const today = now.split('T')[0]

      if (illnessMatch) {
        const idx = parseInt(illnessMatch[1], 10)
        const { data: healthRow } = await admin.from('health_injury').select('illnesses').eq('user_id', user.id).single()
        const arr = Array.isArray((healthRow as Record<string, unknown> | null)?.illnesses)
          ? (healthRow as Record<string, unknown>).illnesses as Record<string, unknown>[]
          : []
        const target = arr[idx]
        if (target && !target.date_cleared) {
          const updated = arr.map((il, i) => i === idx ? { ...il, date_cleared: today, cleared_note: resolvedValue } : il)
          await admin.from('health_injury').update({ illnesses: updated, updated_at: now }).eq('user_id', user.id)
          await admin.from('injury_history').insert({
            user_id: user.id,
            body_part: 'general',
            description: `${target.name ?? 'Illness'} — ${target.description ?? ''}`,
            date_start: target.date_start ?? today,
            date_resolved: today,
            resolution: resolvedValue,
            source: 'ai_conversation',
            source_conversation_id: s.source_conversation_id ?? null,
          })
        }
      } else if (injuryMatch) {
        const idx = parseInt(injuryMatch[1], 10)
        const { data: healthRow } = await admin.from('health_injury').select('active_injuries').eq('user_id', user.id).single()
        const arr = Array.isArray((healthRow as Record<string, unknown> | null)?.active_injuries)
          ? (healthRow as Record<string, unknown>).active_injuries as Record<string, unknown>[]
          : []
        const target = arr[idx]
        if (target && !target.date_cleared) {
          const updated = arr.map((inj, i) => i === idx ? { ...inj, date_cleared: today, cleared_note: resolvedValue } : inj)
          await admin.from('health_injury').update({ active_injuries: updated, updated_at: now }).eq('user_id', user.id)
          await admin.from('injury_history').insert({
            user_id: user.id,
            body_part: (target.body_part as string) ?? 'general',
            description: (target.description as string) ?? '',
            date_start: (target.date_start as string) ?? today,
            date_resolved: today,
            resolution: resolvedValue,
            source: 'ai_conversation',
            source_conversation_id: s.source_conversation_id ?? null,
          })
        }
      }
    } else if (actionType === 'supersede' && targetModule === 'training_patterns') {
      await admin.from('training_patterns').insert({
        user_id: user.id,
        pattern_text: resolvedValue,
        category: 'general',
        confidence: 'low',
        observation_count: 1,
        evidence: s.evidence ?? null,
        source_conversation_id: s.source_conversation_id ?? null,
        status: 'active',
        first_observed_date: now,
        last_observed_date: now,
      })
      if (targetField) {
        await admin
          .from('training_patterns')
          .update({ status: 'superseded', updated_at: now })
          .eq('id', targetField)
          .eq('user_id', user.id)
      }
    } else if (actionType === 'remove') {
      if (targetModule === 'training_patterns' && targetField) {
        await admin.from('training_patterns').delete().eq('id', targetField).eq('user_id', user.id)
      } else if (targetModule === 'health_injury') {
        const illnessMatch = targetField?.match(/^illness_(\d+)$/)
        const injuryMatch = targetField?.match(/^active_injury_(\d+)$/)

        if (illnessMatch) {
          const idx = parseInt(illnessMatch[1], 10)
          const { data: healthRow } = await admin.from('health_injury').select('illnesses').eq('user_id', user.id).single()
          const arr = Array.isArray((healthRow as Record<string, unknown> | null)?.illnesses)
            ? (healthRow as Record<string, unknown>).illnesses as unknown[]
            : []
          await admin.from('health_injury').update({ illnesses: arr.filter((_, i) => i !== idx), updated_at: now }).eq('user_id', user.id)
        } else if (injuryMatch) {
          const idx = parseInt(injuryMatch[1], 10)
          const { data: healthRow } = await admin.from('health_injury').select('active_injuries').eq('user_id', user.id).single()
          const arr = Array.isArray((healthRow as Record<string, unknown> | null)?.active_injuries)
            ? (healthRow as Record<string, unknown>).active_injuries as unknown[]
            : []
          await admin.from('health_injury').update({ active_injuries: arr.filter((_, i) => i !== idx), updated_at: now }).eq('user_id', user.id)
        }
      }
    }
  } catch (err) {
    console.error('[context/suggestions] apply error:', err)
    return NextResponse.json({ error: 'Failed to apply suggestion' }, { status: 500 })
  }

  // Mark suggestion as resolved
  await admin
    .from('context_suggestions')
    .update({
      status: action === 'edit' ? 'edited' : 'accepted',
      resolved_at: new Date().toISOString(),
      resolved_value: resolvedValue,
    })
    .eq('id', id)

  return NextResponse.json({ success: true })
}
