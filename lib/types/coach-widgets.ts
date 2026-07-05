export interface WeeklySummaryDay {
  date: string
  day_label: string
  session_name?: string | null
  sport?: string | null
  duration_minutes?: number | null
  tss?: number | null
  intensity_factor?: number | null
}

export interface WeeklySummaryData {
  week_start: string
  week_end: string
  days: WeeklySummaryDay[]
  weekly_tss: number
  session_count: number
  went_well?: string[]
  flags?: string[]
  bottom_line: string
  closing_question?: string
}

export interface SessionReviewData {
  headline: string
  analysis: string
  flags: string[]
}
