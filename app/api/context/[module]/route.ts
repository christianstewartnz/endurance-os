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

// Fields that must be integers in the DB
const INTEGER_FIELDS: Record<string, string[]> = {
  athlete_profile:      ['age', 'experience_years', 'ftp_watts', 'ftp_override', 'threshold_hr_cycling', 'threshold_hr_running'],
  plan_dna:             ['quality_sessions_per_week', 'ramp_rate_tss_per_week', 'peak_weekly_tss', 'current_week_in_phase', 'phase_length_weeks'],
  fueling_strategy:     ['race_carb_per_hour_g', 'race_fluid_per_hour_ml', 'race_sodium_per_hour_mg', 'training_carb_per_hour_g', 'bars_allowed_until_mins', 'heat_threshold_celsius'],
  recovery_preferences: ['deload_frequency_weeks', 'deload_load_percent'],
  health_injury:        [],
  coach_style:          [],
}

// Fields that must be numeric (float) in the DB
const NUMERIC_FIELDS: Record<string, string[]> = {
  athlete_profile:      ['threshold_pace_per_km', 'threshold_css', 'threshold_pace_override', 'threshold_css_override'],
  plan_dna:             ['peak_weekly_hours'],
  fueling_strategy:     ['pre_race_timing_hours'],
  recovery_preferences: ['sleep_target_hours'],
  health_injury:        [],
  coach_style:          [],
}

// Fields that are text[] arrays in the DB (comma-separated string → array)
const ARRAY_FIELDS: Record<string, string[]> = {
  athlete_profile:      ['sports'],
  health_injury:        ['monitoring_flags'],
  recovery_preferences: ['preferred_rest_days'],
  plan_dna:             [],
  fueling_strategy:     [],
  coach_style:          [],
}

// Fields that are jsonb in the DB (parse JSON string)
const JSONB_FIELDS: Record<string, string[]> = {
  health_injury:        ['active_injuries', 'illnesses'],
  plan_dna:             ['weekly_structure'],
  athlete_profile:      ['zones_cycling', 'zones_running', 'zones_swimming'],
  fueling_strategy:     [],
  recovery_preferences: [],
  coach_style:          [],
}

function coerceFields(module: string, raw: Record<string, unknown>): Record<string, unknown> {
  const integers = INTEGER_FIELDS[module] ?? []
  const numerics  = NUMERIC_FIELDS[module] ?? []
  const arrays    = ARRAY_FIELDS[module] ?? []
  const jsonbs    = JSONB_FIELDS[module] ?? []

  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    // Empty string → null for all fields
    if (v === '' || v === null || v === undefined) {
      out[k] = null
      continue
    }
    if (integers.includes(k)) {
      const n = parseInt(String(v), 10)
      out[k] = isNaN(n) ? null : n
    } else if (numerics.includes(k)) {
      const n = parseFloat(String(v))
      out[k] = isNaN(n) ? null : n
    } else if (arrays.includes(k)) {
      if (Array.isArray(v)) {
        out[k] = v
      } else {
        out[k] = String(v).split(',').map((s) => s.trim()).filter(Boolean)
      }
    } else if (jsonbs.includes(k)) {
      if (typeof v === 'object') {
        out[k] = v
      } else {
        try { out[k] = JSON.parse(String(v)) } catch { out[k] = String(v) }
      }
    } else {
      out[k] = v
    }
  }
  return out
}

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

  // Strip any attempt to change user_id or id
  const { user_id: _u, id: _i, ...rawFields } = body as Record<string, unknown>
  void _u; void _i

  const fields = coerceFields(module, rawFields)

  const admin = createAdminClient()
  const payload = { user_id: user.id, ...fields, updated_at: new Date().toISOString() }
  console.log(`[context/${module}] upsert payload:`, JSON.stringify(payload))
  const { error } = await admin
    .from(module)
    .upsert(
      payload,
      { onConflict: 'user_id' },
    )

  if (error) {
    console.error(`[context/${module}] upsert error:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
