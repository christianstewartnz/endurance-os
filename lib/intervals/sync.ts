import { createAdminClient } from '@/lib/supabase/admin'
import { createIntervalsClient, IntervalsApiError } from './client'
import type { IntervalWellness, IntervalActivity } from './types'

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

function extractBestPower(gaps: unknown, targetSecs: number): number | null {
  if (!Array.isArray(gaps)) return null
  const entry = (gaps as { secs?: number; watts?: number }[]).find(
    (g) => g.secs === targetSecs
  )
  return typeof entry?.watts === 'number' ? entry.watts : null
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

  let activities: IntervalActivity[]
  try {
    activities = await client.getActivities(daysAgo(28), today())
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

  // Fetch detail for each activity in parallel to get interval/lap data
  const detailResults = await Promise.allSettled(
    activities.map((a) => client.getActivityDetail(String(a.id)))
  )

  const rows = activities.map((a, idx) => {
    const detailResult = detailResults[idx]
    const detail = detailResult.status === 'fulfilled' ? detailResult.value : null

    const sport = mapActivityType(a.type)
    const isRun = sport === 'running'

    const avgSpeedKph = a.average_speed != null ? a.average_speed * 3.6 : null
    const maxSpeedKph = a.max_speed != null ? a.max_speed * 3.6 : null
    const totalWorkKj = a.total_work != null ? Math.round(a.total_work / 1000) : null

    const pacePerKm =
      isRun && a.distance && a.elapsed_time
        ? (a.elapsed_time / 60) / (a.distance / 1000)
        : null

    const gaps = a.icu_gaps ?? null
    const best20minPower = extractBestPower(gaps, 1200)
    const best60minPower = extractBestPower(gaps, 3600)

    return {
      user_id: userId,
      session_id: String(a.id),
      session_date: a.start_date_local.split('T')[0],
      session_type: sport,
      sport,
      // Core
      actual_tss: a.icu_training_load ?? null,
      actual_duration_seconds: a.elapsed_time ?? null,
      avg_hr: a.average_heartrate ?? null,
      max_hr: a.max_heartrate ?? null,
      cardiac_drift_percent: a.cardiac_drift_percent ?? null,
      is_archived: false,
      // Power
      avg_power_watts: a.average_watts ?? null,
      normalized_power_watts: a.weighted_average_watts ?? null,
      max_power_watts: a.max_watts ?? null,
      total_work_kj: totalWorkKj,
      best_20min_power: best20minPower,
      best_60min_power: best60minPower,
      // Training metrics
      intensity_factor: a.icu_intensity ?? null,
      variability_index: a.icu_variability ?? null,
      efficiency_factor: a.icu_efficiency_factor ?? null,
      aerobic_decoupling: a.icu_aerobic_decoupling ?? null,
      hrss: a.icu_hrss ?? null,
      // Movement
      distance_meters: a.distance ?? null,
      elevation_gain_meters: a.total_elevation_gain ?? null,
      avg_speed_kph: avgSpeedKph,
      max_speed_kph: maxSpeedKph,
      avg_cadence: a.average_cadence ?? null,
      pace_per_km: pacePerKm,
      // Other
      calories: a.calories ?? null,
      avg_temperature: a.average_temp ?? null,
      activity_name: a.name ?? null,
      // JSONB
      zones: a.icu_zones ?? null,
      gaps: gaps,
      intervals_data: detail ?? null,
    }
  })

  const { error } = await supabase
    .from('session_notes')
    .upsert(rows, { onConflict: 'user_id,session_id' })

  if (error) {
    console.error('[intervals] syncActivities upsert error', error)
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

export async function syncAll(userId: string): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = []

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

  // Update last sync timestamp
  const supabase = createAdminClient()
  await supabase
    .from('users')
    .update({ last_intervals_sync: new Date().toISOString() })
    .eq('id', userId)

  return { success: errors.length === 0, errors }
}
