import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function timeToSeconds(time: string): number | null {
  if (!time) return null
  const parts = time.split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60
  return null
}

// Allowed column names in race_goals — guards against writing phantom columns
const ALLOWED_FIELDS = new Set([
  'race_name', 'race_date', 'location', 'sport', 'distance_format',
  'priority', 'status', 'stretch_goal',
  'overall_goal_time_seconds', 'overall_goal_position',
  'general_notes', 'per_leg_targets',
  'pacing_notes', 'fueling_notes', 'equipment_notes',
  'race_carb_per_hour_g', 'race_fluid_per_hour_ml',
  'race_sodium_per_hour_mg', 'race_sodium_hot_mg',
])

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('race_goals').select('id').eq('id', id).eq('user_id', user.id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const raw = body as Record<string, unknown>

  // Convert time string → seconds if the client sends the helper field
  const update: Record<string, unknown> = {}
  if (raw.overall_goal_time_str !== undefined) {
    update.overall_goal_time_seconds = raw.overall_goal_time_str
      ? timeToSeconds(String(raw.overall_goal_time_str))
      : null
  }

  // Copy only real column names, skip phantom fields and helper fields
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'overall_goal_time_str') continue
    if (ALLOWED_FIELDS.has(k)) {
      update[k] = v === '' ? null : v
    }
  }

  // When location changes, invalidate the geocode cache for this race
  if ('location' in raw) {
    update.location_lat = null
    update.location_lon = null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('race_goals')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin
    .from('race_goals')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
