import { createAdminClient } from '@/lib/supabase/admin'
import { createIntervalsClient, IntervalsApiError } from './client'
import type { IntervalsClient } from './client'
import type { IntervalWellness, IntervalActivity, IntervalActivityDetail } from './types'

function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86400000)
  return d.toISOString().split('T')[0]
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

async function getUserCredentials(userId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('users')
    .select('intervals_api_key, intervals_athlete_id')
    .eq('id', userId)
    .single()

  if (error || !data?.intervals_api_key || !data?.intervals_athlete_id) {
    return null
  }
  return {
    apiKey: data.intervals_api_key as string,
    athleteId: data.intervals_athlete_id as string,
  }
}

async function markConnectionInvalid(userId: string) {
  const supabase = createAdminClient()
  await supabase
    .from('users')
    .update({ intervals_connection_invalid: true })
    .eq('id', userId)
}

function calcHrvDeltaPercent(records: IntervalWellness[], index: number): number | null {
  const current = records[index]
  if (current.hrv == null || current.hrv === 0) return null
  const preceding = records.slice(Math.max(0, index - 14), index)
  const validHrv = preceding.filter((r) => r.hrv != null && r.hrv > 0).map((r) => r.hrv)
  if (validHrv.length === 0) return null
  const baseline = validHrv.reduce((s, v) => s + v, 0) / validHrv.length
  return ((current.hrv - baseline) / baseline) * 100
}

function mapActivityType(intervalsType: string): string {
  const map: Record<string, string> = {
    Ride: 'cycling',
    Run: 'running',
    Swim: 'swimming',
    WeightTraining: 'strength',
  }
  return map[intervalsType] ?? 'general'
}

// Strip leading 'i' from intervals.icu activity IDs for URL path and map keys.
// List endpoint returns ids like "i150683451"; detail endpoint expects and returns "150683451".
function normalizeActivityId(id: string): string {
  return id.replace(/^i/, '')
}

async function fetchDetailsBatched(
  client: IntervalsClient,
  activityIds: string[],
  batchSize = 5,
  delayMs = 500,
): Promise<(IntervalActivityDetail | null)[]> {
  const results: (IntervalActivityDetail | null)[] = []
  for (let i = 0; i < activityIds.length; i += batchSize) {
    const batch = activityIds.slice(i, i + batchSize)
    const details = await Promise.all(
      batch.map((id) =>
        client.getActivityDetail(id)
          .catch((e) => { console.error('[intervals] Failed to fetch detail for:', id, e); return null })
      )
    )
    results.push(...details)
    if (i + batchSize < activityIds.length) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  return results
}

export async function syncWellness(userId: string): Promise<void> {
  const creds = await getUserCredentials(userId)
  if (!creds) return

  const client = createIntervalsClient(creds.apiKey, creds.athleteId)
  const supabase = createAdminClient()

  let wellness: IntervalWellness[]
  try {
    wellness = await client.getWellness(daysAgo(30), today())
  } catch (err) {
    if (err instanceof IntervalsApiError) {
      if (err.status === 401) await markConnectionInvalid(userId)
      if (err.status === 429) console.warn('[intervals] syncWellness rate limited, skipping')
      else console.error('[intervals] syncWellness fetch error', err.message)
    } else {
      console.error('[intervals] syncWellness unexpected error', err)
    }
    return
  }

  const sorted = [...wellness].sort((a, b) => a.id.localeCompare(b.id))

  const rows = sorted.map((w, i) => ({
    user_id: userId,
    date: w.id,
    hrv_rmssd: w.hrv ?? null,
    hrv_delta_14d_percent: calcHrvDeltaPercent(sorted, i),
    resting_hr: w.restingHR ?? null,
    sleep_hours: w.sleepSecs != null ? w.sleepSecs / 3600 : null,
    sleep_quality: w.sleepScore ?? null,
    body_battery: w.bodyBattery ?? null,
    ctl: w.ctl ?? null,
    atl: w.atl ?? null,
    tsb: w.form ?? null,
    synced_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('wellness_cache')
    .upsert(rows, { onConflict: 'user_id,date' })

  if (error) {
    console.error('[intervals] syncWellness upsert error', error)
  }
}

export async function syncActivities(userId: string): Promise<void> {
  const creds = await getUserCredentials(userId)
  if (!creds) return

  const client = createIntervalsClient(creds.apiKey, creds.athleteId)
  const supabase = createAdminClient()

  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const monthAgo = new Date(now)
  monthAgo.setDate(monthAgo.getDate() - 30)
  const newest = tomorrow.toISOString().split('T')[0]
  const oldest = monthAgo.toISOString().split('T')[0]

  console.log('[intervals] Fetching activities from', oldest, 'to', newest)

  let activities: IntervalActivity[]
  try {
    activities = await client.getActivities(oldest, newest)
  } catch (err) {
    if (err instanceof IntervalsApiError) {
      if (err.status === 401) await markConnectionInvalid(userId)
      if (err.status === 429) console.warn('[intervals] syncActivities rate limited, skipping')
      else console.error('[intervals] syncActivities fetch error', err.message)
    } else {
      console.error('[intervals] syncActivities unexpected error', err)
    }
    return
  }

  console.log('[intervals] Activities returned from API:', activities.length)
  console.log('[intervals] Activity dates:', activities.map(a => a.start_date_local.split('T')[0]))

  const activityIds = activities.map((a) => String(a.id))
  console.log(`[intervals] Fetching details for ${activityIds.length} activities...`)
  const detailsList = await fetchDetailsBatched(client, activityIds)

  // Key by normalized (no 'i' prefix) ID so lookup matches both list and detail id formats
  const detailMap = new Map(
    detailsList
      .filter((d): d is IntervalActivityDetail => d !== null)
      .map((d) => [normalizeActivityId(String(d.id)), d])
  )

  const roundOrNull = (v: number | null | undefined) => v != null ? Math.round(v) : null

  const rows = activities.map((a) => {
    const detail = detailMap.get(normalizeActivityId(String(a.id))) ?? null

    const sport = mapActivityType(a.type)
    const isRun  = sport === 'running'
    const isSwim = sport === 'swimming'

    const avgSpeedKph = a.average_speed != null ? a.average_speed * 3.6 : null
    const maxSpeedKph = a.max_speed != null ? a.max_speed * 3.6 : null

    // Store pace as seconds/km for running
    const pacePerKm =
      isRun && a.distance && a.elapsed_time
        ? a.elapsed_time / (a.distance / 1000)
        : null

    return {
      user_id: userId,
      session_id: String(a.id),
      session_date: a.start_date_local.split('T')[0],
      session_type: sport,
      sport,
      // Core
      actual_tss: roundOrNull(a.icu_training_load),
      actual_duration_seconds: roundOrNull(a.elapsed_time),
      avg_hr: roundOrNull(a.average_heartrate),
      max_hr: roundOrNull(a.max_heartrate),
      cardiac_drift_percent: null,  // not in Intervals.icu API
      is_archived: false,
      // Power
      avg_power_watts: roundOrNull(detail?.icu_average_watts ?? a.icu_average_watts),
      normalized_power_watts: roundOrNull(detail?.icu_weighted_avg_watts ?? a.icu_weighted_avg_watts),
      max_power_watts: roundOrNull(detail?.p_max ?? a.p_max),
      total_work_kj: (() => {
        const j = detail?.icu_joules ?? a.icu_joules
        return j != null ? Math.round(j / 1000) : null
      })(),
      // Best-effort power — not available from Intervals.icu activity API
      best_5sec_power:  null,
      best_1min_power:  null,
      best_5min_power:  null,
      best_20min_power: null,
      best_60min_power: null,
      // Training metrics
      intensity_factor: a.icu_intensity ?? null,
      variability_index: a.icu_variability_index ?? null,
      efficiency_factor: a.icu_efficiency_factor ?? null,
      aerobic_decoupling: a.decoupling ?? null,
      hrss: null,  // not in Intervals.icu API
      // Movement
      distance_meters: a.distance ?? null,
      elevation_gain_meters: a.total_elevation_gain ?? null,
      avg_speed_kph: avgSpeedKph,
      max_speed_kph: maxSpeedKph,
      avg_cadence: !isSwim ? roundOrNull(a.average_cadence) : null,
      pace_per_km: pacePerKm,
      // Best-effort paces — not available from Intervals.icu activity API
      best_1km_pace:           null,
      best_5km_pace:           null,
      best_10km_pace:          null,
      best_half_marathon_pace: null,
      best_100m_pace:          null,
      best_400m_pace:          null,
      // Swimming
      pool_length:            a.pool_length           ?? null,
      total_strokes:          a.total_strokes          ?? null,
      avg_stroke_rate:        a.average_stroke_rate    ?? null,
      avg_strokes_per_length: detail?.avg_strokes_per_length ?? null,
      // Other
      calories: roundOrNull(a.calories),
      avg_temperature: a.average_temp ?? null,
      activity_name: a.name ?? null,
      // JSONB — zones and intervals from detail
      zones: (() => {
        const power = detail?.icu_zone_times ?? null
        const hrRaw = detail?.icu_hr_zone_times ?? null
        const hr = Array.isArray(hrRaw)
          ? (hrRaw as number[]).map((secs, i) => ({ id: `Z${i + 1}`, secs })).filter(z => z.secs > 0)
          : null
        if (!power && !hr) return null
        return { power, hr }
      })(),
      gaps: null,
      intervals_data: detail?.icu_groups ?? detail?.icu_intervals ?? null,
    }
  })

  console.log(`[intervals] Sync complete — ${rows.length} activities updated`)

  const { error } = await supabase
    .from('session_notes')
    .upsert(rows, { onConflict: 'user_id,session_id' })

  if (error) {
    console.error('[intervals] syncActivities upsert error', error)
  }

  // Log any PB achievements Intervals.icu flagged on these activities
  for (const activity of activities) {
    const achievements = activity.icu_achievements ?? []
    if (achievements.length === 0) continue
    const powerPBs = achievements.filter((a) => a.type === 'BEST_POWER')
    const pacePBs  = achievements.filter((a) =>
      a.type?.includes('BEST_PACE') || a.type?.includes('BEST_DISTANCE')
    )
    if (powerPBs.length > 0 || pacePBs.length > 0) {
      console.log('[sync] Achievements in activity:', activity.id, {
        date: activity.start_date_local.split('T')[0],
        powerPBs,
        pacePBs,
        allTypes: achievements.map((a) => a.type),
      })
    }
  }
}

export async function syncFitnessMetrics(userId: string): Promise<void> {
  const creds = await getUserCredentials(userId)
  if (!creds) return

  const client = createIntervalsClient(creds.apiKey, creds.athleteId)
  const supabase = createAdminClient()

  let athlete
  try {
    athlete = await client.getAthleteSettings()
  } catch (err) {
    if (err instanceof IntervalsApiError) {
      if (err.status === 401) await markConnectionInvalid(userId)
      if (err.status === 429) console.warn('[intervals] syncFitnessMetrics rate limited, skipping')
      else console.error('[intervals] syncFitnessMetrics fetch error', err.message)
    } else {
      console.error('[intervals] syncFitnessMetrics unexpected error', err)
    }
    return
  }

  // Check for manual FTP override — don't overwrite if set
  const { data: profile } = await supabase
    .from('athlete_profile')
    .select('ftp_override')
    .eq('user_id', userId)
    .single()

  const sportSettings = athlete.sport_settings ?? []
  const zonesBySport = (type: string) =>
    sportSettings.find((s) => s.type === type) ?? null

  const update: Record<string, unknown> = {
    threshold_pace_per_km: athlete.threshold_pace != null ? athlete.threshold_pace / 100 : null,
    threshold_css: athlete.threshold_css ?? null,
    threshold_hr_cycling: athlete.lthr ?? null,
    zones_cycling: zonesBySport('Ride'),
    zones_running: zonesBySport('Run'),
    zones_swimming: zonesBySport('Swim'),
    fitness_metrics_last_synced: new Date().toISOString(),
  }

  // Only set FTP if no manual override exists
  if (!profile?.ftp_override && athlete.ftp != null) {
    update.ftp_watts = athlete.ftp
  }

  const { error } = await supabase
    .from('athlete_profile')
    .update(update)
    .eq('user_id', userId)

  if (error) {
    console.error('[intervals] syncFitnessMetrics update error', error)
  }
}

type PBMetric = { value: number | null; unit: string; source: string; date: string | null }
type PBSportMap = Record<string, PBMetric>
type PBMap = { cycling?: PBSportMap; running?: PBSportMap; swimming?: PBSportMap }

type CurveShape = { secs?: number[]; distance?: number[]; values?: number[]; activity_id?: string[] }
type ActivityMap = Record<string, { start_date_local?: string }>

function extractPowerWithDate(
  list: unknown[],
  secs: number,
  activities: ActivityMap,
): { value: number | null; date: string | null } {
  const curve = (list?.[0] ?? null) as CurveShape | null
  if (!curve?.secs || !curve?.values) return { value: null, date: null }
  const idx = curve.secs.indexOf(secs)
  if (idx < 0) return { value: null, date: null }
  const value = curve.values[idx] ?? null
  const activityId = curve.activity_id?.[idx]
  const date = activityId ? (activities[activityId]?.start_date_local?.split('T')[0] ?? null) : null
  return { value, date }
}

function extractPaceWithDate(
  list: unknown[],
  distanceMeters: number,
  activities: ActivityMap,
): { value: number | null; date: string | null } {
  const curve = (list?.[0] ?? null) as CurveShape | null
  if (!curve?.distance || !curve?.values) return { value: null, date: null }
  const idx = curve.distance.indexOf(distanceMeters)
  if (idx < 0) return { value: null, date: null }
  const value = curve.values[idx] ?? null
  const activityId = curve.activity_id?.[idx]
  const date = activityId ? (activities[activityId]?.start_date_local?.split('T')[0] ?? null) : null
  return { value, date }
}

function mergePBs(current: PBMap, newAuto: PBMap): PBMap {
  const result: PBMap = { ...current }
  for (const [sport, metrics] of Object.entries(newAuto) as [keyof PBMap, PBSportMap][]) {
    result[sport] = result[sport] ?? {}
    for (const [metric, val] of Object.entries(metrics)) {
      const existing = result[sport]![metric]
      // Never overwrite a manual entry
      if (existing?.source === 'manual') continue
      // Only update if new value exists and is better (higher for power, lower for pace)
      const existingVal = existing?.value ?? null
      const newVal = val.value
      if (newVal !== null) {
        const isWatts = val.unit === 'W'
        const isBetter = existingVal === null ||
          (isWatts ? newVal > existingVal : newVal < existingVal)
        if (isBetter) result[sport]![metric] = val
      }
    }
  }
  return result
}

async function savePBs(userId: string, newPbs: PBMap): Promise<void> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('athlete_profile')
    .select('pbs')
    .eq('user_id', userId)
    .maybeSingle()

  const current = (data?.pbs ?? {}) as PBMap
  const merged = mergePBs(current, newPbs)

  const { error } = await supabase
    .from('athlete_profile')
    .update({ pbs: merged })
    .eq('user_id', userId)

  if (error) {
    console.error('[sync] savePBs error:', error)
  } else {
    console.log('[sync] PBs saved:', JSON.stringify(merged))
  }
}

export async function syncPBs(userId: string): Promise<void> {
  const creds = await getUserCredentials(userId)
  if (!creds) return

  const client = createIntervalsClient(creds.apiKey, creds.athleteId)

  console.log('[sync] Starting PB sync')

  // ── Cycling power curves ──────────────────────────────────────────────────
  let powerCurves: unknown = null
  try {
    powerCurves = await client.getPowerCurves('all')
    console.log('[sync] Power curves response:', JSON.stringify(powerCurves)?.slice(0, 500))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[sync] Power curves fetch error:', msg)
    console.log('[sync] Power curves not available — will rely on icu_achievements from activity sync')
  }

  const powerRes  = powerCurves as { list?: unknown[]; activities?: ActivityMap } | null
  const powerList = powerRes?.list ?? null
  const powerActivities: ActivityMap = powerRes?.activities ?? {}

  let cycling: PBSportMap | undefined

  if (powerList?.[0]) {
    const curve = powerList[0] as CurveShape
    console.log('[sync] Power curve secs:', curve.secs?.slice(0, 15))
    console.log('[sync] Power curve values:', curve.values?.slice(0, 15))
    console.log('[sync] Power curve activity_ids (first 5):', curve.activity_id?.slice(0, 5))

    const ex = (secs: number) => extractPowerWithDate(powerList, secs, powerActivities)

    cycling = {
      power_5s:    { ...ex(5),    unit: 'W', source: 'auto' },
      power_1min:  { ...ex(60),   unit: 'W', source: 'auto' },
      power_5min:  { ...ex(300),  unit: 'W', source: 'auto' },
      power_20min: { ...ex(1200), unit: 'W', source: 'auto' },
      power_60min: { ...ex(3600), unit: 'W', source: 'auto' },
    }
    console.log('[sync] Cycling PBs extracted:', cycling)
  } else {
    console.log('[sync] No power curve list in response — endpoint may require different params or subscription tier')
  }

  // ── Running pace curves ───────────────────────────────────────────────────
  let paceCurves: unknown = null
  try {
    paceCurves = await client.getPaceCurves('all')
    console.log('[sync] Pace curves response:', JSON.stringify(paceCurves)?.slice(0, 500))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[sync] Pace curves fetch error:', msg)
  }

  const paceRes  = paceCurves as { list?: unknown[]; activities?: ActivityMap } | null
  const paceList = paceRes?.list ?? null
  const paceActivities: ActivityMap = paceRes?.activities ?? {}

  let running: PBSportMap | undefined

  if (paceList?.[0]) {
    const curve = paceList[0] as CurveShape
    console.log('[sync] Pace curve distance:', curve.distance?.slice(0, 15))
    console.log('[sync] Pace curve values:', curve.values?.slice(0, 15))
    console.log('[sync] Pace curve activity_ids (first 5):', curve.activity_id?.slice(0, 5))

    const ex = (meters: number) => extractPaceWithDate(paceList, meters, paceActivities)

    running = {
      pace_1km:           { ...ex(1000),  unit: 'sec/km', source: 'auto' },
      pace_5km:           { ...ex(5000),  unit: 'sec/km', source: 'auto' },
      pace_10km:          { ...ex(10000), unit: 'sec/km', source: 'auto' },
      pace_half_marathon: { ...ex(21097), unit: 'sec/km', source: 'auto' },
      pace_marathon:      { ...ex(42195), unit: 'sec/km', source: 'auto' },
    }
    console.log('[sync] Running PBs extracted:', running)
  } else {
    console.log('[sync] No pace curve list in response')
  }

  // ── Save — only sports with at least one real value ───────────────────────
  const hasCycling = cycling != null && Object.values(cycling).some((v) => v.value !== null)
  const hasRunning = running != null && Object.values(running).some((v) => v.value !== null)

  const pbsToSave: PBMap = {}
  if (hasCycling) pbsToSave.cycling = cycling
  if (hasRunning) pbsToSave.running = running

  if (Object.keys(pbsToSave).length > 0) {
    await savePBs(userId, pbsToSave)
  } else {
    console.log('[sync] No PB values found — nothing saved')
  }
}

export async function syncAll(userId: string): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = []

  // Wellness and fitness metrics run in parallel with activities
  const results = await Promise.allSettled([
    syncWellness(userId),
    syncActivities(userId),
    syncFitnessMetrics(userId),
  ])

  results.forEach((r, i) => {
    const label = ['wellness', 'activities', 'fitnessMetrics'][i]
    if (r.status === 'rejected') {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason)
      console.error(`[intervals] syncAll ${label} rejected:`, msg)
      errors.push(`${label}: ${msg}`)
    }
  })

  // PB sync runs after activities so icu_achievements are already logged
  try {
    await syncPBs(userId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[intervals] syncAll pbs rejected:', msg)
    errors.push(`pbs: ${msg}`)
  }

  // Update last sync timestamp
  const supabase = createAdminClient()
  await supabase
    .from('users')
    .update({ last_intervals_sync: new Date().toISOString() })
    .eq('id', userId)

  return { success: errors.length === 0, errors }
}
