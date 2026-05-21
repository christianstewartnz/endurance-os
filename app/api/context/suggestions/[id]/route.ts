import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  try {
    if (actionType === 'append' && targetModule === 'training_patterns') {
      await admin.from('training_patterns').insert({
        user_id: user.id,
        pattern_text: resolvedValue,
        category: 'other',
        sport: 'general',
        confidence: 'low',
        observation_count: 1,
        evidence: s.evidence ?? null,
        source_conversation_id: s.source_conversation_id ?? null,
        status: 'active',
      })
    } else if (actionType === 'append' && targetModule === 'health_injury') {
      let parsed: unknown
      try { parsed = JSON.parse(resolvedValue) } catch { parsed = null }
      if (parsed) {
        // Get current active_injuries and append
        const { data: healthRow } = await admin
          .from('health_injury')
          .select('active_injuries')
          .eq('user_id', user.id)
          .single()
        const current = (healthRow as Record<string, unknown> | null)?.active_injuries
        const existing = Array.isArray(current) ? current : []
        await admin
          .from('health_injury')
          .update({ active_injuries: [...existing, parsed], updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
      }
    } else if (actionType === 'update_field' && targetField) {
      await admin
        .from(targetModule)
        .update({ [targetField]: resolvedValue, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
    } else if (actionType === 'archive' && targetModule === 'training_patterns') {
      const targetRecordId = (s as Record<string, unknown>).target_record_id as string | null
      if (targetRecordId) {
        await admin
          .from('training_patterns')
          .update({ status: 'archived', updated_at: new Date().toISOString() })
          .eq('id', targetRecordId)
          .eq('user_id', user.id)
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
