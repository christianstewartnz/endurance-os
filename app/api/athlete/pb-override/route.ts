import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const VALID_SPORTS = ['cycling', 'running', 'swimming'] as const
type Sport = typeof VALID_SPORTS[number]

const VALID_METRICS: Record<Sport, string[]> = {
  cycling:  ['power_5s', 'power_1min', 'power_5min', 'power_20min', 'power_60min'],
  running:  ['pace_1km', 'pace_5km', 'pace_10km', 'pace_half_marathon', 'pace_marathon'],
  swimming: ['pace_100m', 'pace_400m'],
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { sport, metric, value, clear } = body as {
    sport: string; metric: string; value?: number | null; clear?: boolean
  }

  if (!VALID_SPORTS.includes(sport as Sport)) {
    return NextResponse.json({ error: 'Invalid sport' }, { status: 400 })
  }
  if (!VALID_METRICS[sport as Sport].includes(metric)) {
    return NextResponse.json({ error: 'Invalid metric' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('athlete_profile')
    .select('pbs')
    .eq('user_id', user.id)
    .maybeSingle()

  const pbs = (existing?.pbs ?? {}) as Record<string, Record<string, Record<string, unknown>>>

  if (!pbs[sport]) pbs[sport] = {}
  if (!pbs[sport][metric]) pbs[sport][metric] = { value: null, unit: '', date: null, source: null, override: null }

  pbs[sport][metric].override = clear ? null : (typeof value === 'number' ? value : null)

  const { error } = await admin
    .from('athlete_profile')
    .update({ pbs })
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, pbs })
}
