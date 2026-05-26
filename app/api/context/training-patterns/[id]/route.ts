import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('training_patterns')
    .select('user_id, confidence')
    .eq('id', id)
    .single()

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let update: Record<string, unknown>

  if (body.action === 'archive') {
    update = { status: 'archived' }
  } else if (body.action === 'promote') {
    const currentIdx = CONFIDENCE_LEVELS.indexOf(existing.confidence ?? 'low')
    const nextConfidence = CONFIDENCE_LEVELS[Math.min(currentIdx + 1, 2)]
    update = { confidence: nextConfidence }
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('training_patterns')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
