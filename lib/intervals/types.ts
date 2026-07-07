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
  // Zone distribution (also present on list endpoint, not just detail)
  icu_zone_times?: { id: string; secs: number }[] | null
  icu_hr_zone_times?: number[] | null
  // Zone boundary definitions — icu_power_zones is in % of FTP (e.g. [55,75,90,105,120,150])
  icu_hr_zones?: number[] | null
  icu_power_zones?: number[] | null
  // FTP used for this activity's power analysis
  icu_ftp?: number | null
  // Swimming
  pool_length?: number
  total_strokes?: number
  average_stroke_rate?: number
  // Achievements / PBs flagged by Intervals.icu
  icu_achievements?: IntervalAchievement[]
}

export interface IntervalActivityDetail {
  id: string
  // Zone distribution — present on both list and detail endpoint, null when no data
  icu_zone_times?: { id: string; secs: number }[] | null
  icu_hr_zone_times?: number[] | null
  // Interval/lap groups
  icu_groups?: unknown[] | null
  icu_intervals?: unknown[] | null
  // Power — field names confirmed from API responses
  icu_average_watts?: number | null
  icu_weighted_avg_watts?: number | null
  p_max?: number | null
  icu_joules?: number | null
  // Swimming
  avg_strokes_per_length?: number | null
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
  // Fueling suggestion (set when session is proposed by AI)
  fueling_carb_g_per_hour?: number | null
  fueling_fluid_ml_per_hour?: number | null
  fueling_sodium_mg_per_hour?: number | null
  fueling_note?: string | null
  // Planned session fields (set when session is created by coach/training plan)
  name?: string | null
  planned_tss?: number | null
  planned_duration_seconds?: number | null
  training_plan_id?: string | null
  plan_phase?: string | null
  detail_level?: string | null
  intervals_format?: string | null
  description?: string | null
  // Activity match fields (completed sessions only)
  matched_session_id?: string | null
  match_status?: string | null  // 'auto' | 'confirmed' | 'rejected'
}
