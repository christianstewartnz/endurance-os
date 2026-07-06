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

export interface TrainingPlanPhase {
  name: string
  start_date: string
  end_date: string
  focus: string
  weekly_hours_target?: number
  weekly_tss_target?: number
}

export interface TrainingPlanSession {
  date: string
  sport: string
  name?: string
  duration_minutes: number
  target_tss?: number
  detail_level: 'full' | 'outline'
  intervals_format?: string
  plan_phase: string
}

export interface ProposedTrainingPlan {
  start_date: string
  end_date: string
  linked_race_id?: string
  goal: string
  phases: TrainingPlanPhase[]
  sessions: TrainingPlanSession[]
}
