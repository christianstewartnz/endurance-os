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

export interface IntervalAchievement {
  type: string
  watts?: number
  secs?: number
  value?: number
  distance?: number
  pace?: number
  [key: string]: unknown
}

export interface IntervalActivity {
  id: string
  start_date_local: string
  type: string
  name: string
  moving_time: number
  elapsed_time: number
  // Power
  icu_average_watts: number
  icu_weighted_avg_watts: number
  p_max: number           // recorded max power
  icu_joules: number      // total work in joules
  // HR
  average_heartrate: number
  max_heartrate: number
  // ICU metrics
  icu_training_load: number
  icu_atl: number
  icu_ctl: number
  icu_intensity: number
  icu_variability_index: number
  icu_efficiency_factor: number
  decoupling: number      // aerobic decoupling
  // Movement
  distance: number
  total_elevation_gain: number
  average_speed: number   // m/s
  max_speed: number       // m/s
  average_cadence: number
  // Other
  calories: number
  average_temp: number
  // Swimming
  pool_length?: number
  total_strokes?: number
  average_stroke_rate?: number
  // Achievements / PBs flagged by Intervals.icu
  icu_achievements?: IntervalAchievement[]
}

export interface IntervalActivityDetail {
  id: string
  // Zone distribution (time in each zone)
  icu_zone_times?: { id: string; secs: number }[]   // power zones
  icu_hr_zone_times?: number[]                       // HR zones as flat array
  // Interval/lap groups
  icu_groups?: unknown[]
  icu_intervals?: unknown[]
  // Power (confirmed fields from API)
  icu_average_watts?: number
  icu_weighted_avg_watts?: number
  p_max?: number          // recorded max instantaneous power
  icu_joules?: number     // total work in joules
  // Swimming
  avg_strokes_per_length?: number
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
  // Power best efforts
  best_5min_power?: number | null
  best_1min_power?: number | null
  best_5sec_power?: number | null
  // Running best paces (seconds/km)
  best_1km_pace?: number | null
  best_5km_pace?: number | null
  best_10km_pace?: number | null
  best_half_marathon_pace?: number | null
  // Swimming
  best_100m_pace?: number | null
  best_400m_pace?: number | null
  pool_length?: number | null
  total_strokes?: number | null
  avg_stroke_rate?: number | null
  avg_strokes_per_length?: number | null
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
