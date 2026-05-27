import { createAdminClient } from '@/lib/supabase/admin'

export interface PBEntry {
  value: number | null
  unit: string
  date: string | null
  source: 'auto' | null
  override: number | null
}

export interface PBData {
  cycling?: {
    power_5s?: PBEntry
    power_1min?: PBEntry
    power_5min?: PBEntry
    power_20min?: PBEntry
    power_60min?: PBEntry
  }
  running?: {
    pace_1km?: PBEntry
    pace_5km?: PBEntry
    pace_10km?: PBEntry
    pace_half_marathon?: PBEntry
    pace_marathon?: PBEntry
  }
  swimming?: {
    pace_100m?: PBEntry
    pace_400m?: PBEntry
  }
}

type SessionRow = Record<string, unknown>

function bestMax(sessions: SessionRow[], field: string): { value: number; date: string } | null {
  let best: { value: number; date: string } | null = null
  for (const s of sessions) {
    const v = s[field]
    const d = s['session_date'] as string | null
    if (typeof v === 'number' && v > 0 && d) {
      if (!best || v > best.value) {
        best = { value: Math.round(v), date: d }
      }
    }
  }
  return best
}

function bestMin(sessions: SessionRow[], field: string): { value: number; date: string } | null {
  let best: { value: number; date: string } | null = null
  for (const s of sessions) {
    const v = s[field]
    const d = s['session_date'] as string | null
    if (typeof v === 'number' && v > 0 && d) {
      if (!best || v < best.value) {
        best = { value: v, date: d }
      }
    }
  }
  return best
}

function makeEntry(result: { value: number; date: string } | null, unit: string): PBEntry {
  return {
    value: result?.value ?? null,
    unit,
    date: result?.date ?? null,
    source: result ? 'auto' : null,
    override: null,
  }
}

export async function calculatePBs(userId: string): Promise<PBData> {
  const supabase = createAdminClient()

  const { data: sessions } = await supabase
    .from('session_notes')
    .select('session_date, sport, best_5sec_power, best_1min_power, best_5min_power, best_20min_power, best_60min_power, best_1km_pace, best_5km_pace, best_10km_pace, best_half_marathon_pace, best_100m_pace, best_400m_pace')
    .eq('user_id', userId)
    .eq('is_archived', false)

  if (!sessions || sessions.length === 0) return {}

  const cycling = sessions.filter((s) => s.sport === 'cycling') as SessionRow[]
  const running  = sessions.filter((s) => s.sport === 'running')  as SessionRow[]
  const swimming = sessions.filter((s) => s.sport === 'swimming') as SessionRow[]

  const result: PBData = {}

  if (cycling.length > 0) {
    result.cycling = {
      power_5s:    makeEntry(bestMax(cycling, 'best_5sec_power'),  'W'),
      power_1min:  makeEntry(bestMax(cycling, 'best_1min_power'),  'W'),
      power_5min:  makeEntry(bestMax(cycling, 'best_5min_power'),  'W'),
      power_20min: makeEntry(bestMax(cycling, 'best_20min_power'), 'W'),
      power_60min: makeEntry(bestMax(cycling, 'best_60min_power'), 'W'),
    }
  }

  if (running.length > 0) {
    result.running = {
      pace_1km:          makeEntry(bestMin(running, 'best_1km_pace'),           'sec/km'),
      pace_5km:          makeEntry(bestMin(running, 'best_5km_pace'),           'sec/km'),
      pace_10km:         makeEntry(bestMin(running, 'best_10km_pace'),          'sec/km'),
      pace_half_marathon: makeEntry(bestMin(running, 'best_half_marathon_pace'), 'sec/km'),
      pace_marathon:     makeEntry(null, 'sec/km'),
    }
  }

  if (swimming.length > 0) {
    result.swimming = {
      pace_100m: makeEntry(bestMin(swimming, 'best_100m_pace'), 'sec/100m'),
      pace_400m: makeEntry(bestMin(swimming, 'best_400m_pace'), 'sec/100m'),
    }
  }

  return result
}

export function mergePBs(existing: PBData | null | undefined, fresh: PBData): PBData {
  if (!existing) return fresh

  const merged: PBData = { ...fresh }

  for (const sport of ['cycling', 'running', 'swimming'] as const) {
    const existingSport = existing[sport]
    const freshSport = fresh[sport]
    if (!existingSport) continue

    if (!merged[sport]) merged[sport] = {} as never

    for (const [metric, existingEntry] of Object.entries(existingSport)) {
      const e = existingEntry as PBEntry
      if (e.override != null) {
        // Preserve manual override — merge auto value from fresh but keep override
        const freshEntry = freshSport?.[metric as keyof typeof freshSport] as PBEntry | undefined
        ;(merged[sport] as Record<string, PBEntry>)[metric] = {
          ...(freshEntry ?? e),
          override: e.override,
        }
      }
    }
  }

  return merged
}
