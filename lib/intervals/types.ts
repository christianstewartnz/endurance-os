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
  average_watts: number
  weighted_average_watts: number
  average_heartrate: number
  max_heartrate: number
  icu_training_load: number
  icu_atl: number
  icu_ctl: number
  icu_tsb: number
  cardiac_drift_percent: number
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
  actual_tss: number | null
  actual_duration_seconds: number | null
  avg_power_watts: number | null
  normalized_power_watts: number | null
  avg_hr: number | null
  max_hr: number | null
  cardiac_drift_percent: number | null
  is_archived: boolean
  // Extended fields — present once DB columns are added
  athlete_notes?: string | null
  ai_summary?: string | null
  review_conversation_id?: string | null
}
