export interface IntervalWellness {
  id: string // date e.g. "2025-06-03"
  ctl: number
  atl: number
  form: number // TSB
  restingHR: number
  hrv: number
  sleepSecs: number
  sleepScore: number
  weight: number
  bodyBattery: number
}

export interface IntervalActivity {
  id: string
  start_date_local: string
  type: string
  name: string
  moving_time: number
  elapsed_time: number
  // Power
  average_watts: number
  weighted_average_watts: number
  max_watts: number
  // HR
  average_heartrate: number
  max_heartrate: number
  cardiac_drift_percent: number
  // ICU metrics
  icu_training_load: number
  icu_atl: number
  icu_ctl: number
  icu_tsb: number
  icu_intensity: number
  icu_variability: number
  icu_efficiency_factor: number
  icu_aerobic_decoupling: number
  icu_hrss: number
  icu_zones: unknown[]
  icu_gaps: unknown[]
  // Movement
  distance: number
  total_elevation_gain: number
  average_speed: number // m/s
  max_speed: number // m/s
  average_cadence: number
  // Other
  calories: number
  average_temp: number
  total_work: number // joules
}

export interface IntervalActivityDetail {
  id: string
  icu_groups?: unknown[]
  [key: string]: unknown
}

export interface SportSettings {
  type: string
  [key: string]: unknown
}

export interface IntervalAthlete {
  id: string
  ftp: number
  lthr: number
  threshold_pace: number
  threshold_css: number
  weight: number
  sport_settings: SportSettings[]
}

export interface IntervalEvent {
  id?: number
  category: string
  start_date_local: string
  type: string
  name: string
  description: string
  icu_training_load: number
  external_id: string
}

// Supabase DB row shapes used in dashboard components
export interface WellnessCacheRow {
  user_id: string
  date: string
  hrv_rmssd: number | null
  hrv_delta_14d_percent: number | null
  resting_hr: number | null
  sleep_hours: number | null
  sleep_quality: number | null
  body_battery: number | null
  ctl: number | null
  atl: number | null
  tsb: number | null
  synced_at: string
}

export interface SessionNoteRow {
  user_id: string
  session_id: string
  session_date: string
  session_type: string | null
  sport: string | null
  // Core metrics
  actual_tss: number | null
  actual_duration_seconds: number | null
  avg_hr: number | null
  max_hr: number | null
  cardiac_drift_percent: number | null
  is_archived: boolean
  // Power
  avg_power_watts: number | null
  normalized_power_watts: number | null
  max_power_watts: number | null
  total_work_kj: number | null
  best_20min_power: number | null
  best_60min_power: number | null
  // Training metrics
  intensity_factor: number | null
  variability_index: number | null
  efficiency_factor: number | null
  aerobic_decoupling: number | null
  hrss: number | null
  // Movement
  distance_meters: number | null
  elevation_gain_meters: number | null
  min_elevation: number | null
  max_elevation: number | null
  avg_speed_kph: number | null
  max_speed_kph: number | null
  avg_cadence: number | null
  pace_per_km: number | null
  // Other
  calories: number | null
  avg_temperature: number | null
  activity_name: string | null
  // JSONB
  zones: unknown | null
  gaps: unknown | null
  intervals_data: unknown | null
  // Coach fields
  athlete_notes?: string | null
  ai_summary?: string | null
  review_conversation_id?: string | null
}
