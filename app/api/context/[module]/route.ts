import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_MODULES = [
  'athlete_profile',
  'coach_style',
  'plan_dna',
  'fueling_strategy',
  'health_injury',
  'recovery_preferences',
]

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ module: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { module } = await params
  if (!ALLOWED_MODULES.includes(module)) {
    return NextResponse.json({ error: 'Invalid module' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Strip any attempt to change user_id
  const { user_id: _stripped, id: _id, ...fields } = body as Record<string, unknown>
  void _stripped; void _id

  const admin = createAdminClient()
  const { error } = await admin
    .from(module)
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (error) {
    console.error(`[context/${module}] update error:`, error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
