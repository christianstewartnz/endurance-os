import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_FIELDS = ['pacing_notes', 'fueling_notes', 'equipment_notes']

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

  const { field, notes } = body as { field: string; notes: unknown[] }

  if (!ALLOWED_FIELDS.includes(field)) {
    return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
  }
  if (!Array.isArray(notes)) {
    return NextResponse.json({ error: 'notes must be an array' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('race_goals').select('id').eq('id', id).eq('user_id', user.id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await admin
    .from('race_goals')
    .update({ [field]: notes, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
