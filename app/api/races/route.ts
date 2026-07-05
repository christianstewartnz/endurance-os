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

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const {
    race_name, race_date, location, sport, distance_format,
    priority, overall_goal_time_str, overall_goal_position,
    general_notes, per_leg_targets,
    race_carb_per_hour_g, race_fluid_per_hour_ml,
    race_sodium_per_hour_mg, race_sodium_hot_mg,
  } = body as Record<string, unknown>

  if (!race_name || !race_date) {
    return NextResponse.json({ error: 'race_name and race_date are required' }, { status: 400 })
  }

  const overall_goal_time_seconds = overall_goal_time_str
    ? timeToSeconds(String(overall_goal_time_str))
    : null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('race_goals')
    .insert({
      user_id: user.id,
      race_name,
      race_date,
      location: location ?? null,
      sport: sport ?? null,
      distance_format: distance_format ?? null,
      priority: priority ?? 'B',
      overall_goal_time_seconds: overall_goal_time_seconds ?? null,
      overall_goal_position: overall_goal_position ?? null,
      general_notes: general_notes ?? null,
      per_leg_targets: per_leg_targets ?? null,
      race_carb_per_hour_g: race_carb_per_hour_g ?? null,
      race_fluid_per_hour_ml: race_fluid_per_hour_ml ?? null,
      race_sodium_per_hour_mg: race_sodium_per_hour_mg ?? null,
      race_sodium_hot_mg: race_sodium_hot_mg ?? null,
      status: 'upcoming',
      pacing_notes: [],
      fueling_notes: [],
      equipment_notes: [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
