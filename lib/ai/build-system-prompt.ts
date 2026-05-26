import { createAdminClient } from '@/lib/supabase/admin'

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayStr(): string {
  return localDateStr(new Date())
}

function daysAgoStr(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDateStr(d)
}

// Parse a YYYY-MM-DD string as a local date (not UTC midnight)
function parseDateLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatPace(secsPerKm: number | null): string {
  if (!secsPerKm) return '—'
  const m = Math.floor(secsPerKm / 60)
  const s = Math.round(secsPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

function formatCss(secsPerHundred: number | null): string {
  if (!secsPerHundred) return '—'
  const m = Math.floor(secsPerHundred / 60)
  const s = Math.round(secsPerHundred % 60)
  return `${m}:${String(s).padStart(2, '0')}/100m`
}

function buildCoachInstructions(style: Record<string, unknown> | null): string {
  if (!style) return ''

  const toneMap: Record<string, string> = {
    direct: 'State recommendation first, reason second. No filler. No sign-off.',
    friendly: 'Open with warmth, same substance. Acknowledge effort where genuine.',
    mentor: 'Explain the why in depth. Treat athlete as a learner.',
    pro: 'Clinical, data-first. Talk like a DS in a pro peloton. No sentiment.',
  }
  const lengthMap: Record<string, string> = {
    short: 'Maximum 2-4 sentences. Recommendation and reason only.',
    standard: 'Full explanation with context and next steps.',
    verbose: 'Detailed breakdown. Do not truncate analysis.',
  }
  const praiseMap: Record<string, string> = {
    none: 'Never acknowledge good performance. Numbers only.',
    minimal: 'One word max for strong sessions — \'Solid.\' Nothing more.',
    encouraging: 'Open with positive framing before analysis.',
  }
  const challengeMap: Record<string, string> = {
    never: 'Take the athlete\'s plan at face value always.',
    when_data_conflicts: 'Flag conflicts when data contradicts the plan.',
    always: 'Actively question decisions even when data is neutral.',
  }

  const tone = toneMap[style.tone as string] ?? toneMap.direct
  const length = lengthMap[style.reply_length as string] ?? lengthMap.standard
  const praise = praiseMap[style.praise_level as string] ?? praiseMap.minimal
  const challenge = challengeMap[style.challenge_mode as string] ?? challengeMap.when_data_conflicts

  let instructions = `════════════════════════════════════════
COACH BEHAVIOUR INSTRUCTIONS
════════════════════════════════════════

Tone: ${tone}
Reply length: ${length}
Praise: ${praise}
Challenge mode: ${challenge}

NEVER suggest changes to Athlete Profile or Coach Style. These are user-controlled only.

For all other context modules (Plan DNA, Training Patterns, Adaptation Rules, Race Goals, Fueling, Health, Recovery): you MAY suggest updates but MUST follow this process:
  1. Discuss the topic conversationally first
  2. Reach agreement with the athlete
  3. Only then formalise a context update suggestion
  4. Never propose a cold suggestion without prior discussion`

  if (style.system_prompt_override) {
    instructions += `\n\nAdditional coach instructions:\n${style.system_prompt_override}`
  }

  return instructions
}

function buildAthleteLayer(profile: Record<string, unknown> | null, effectiveFtp: number | null, effectivePace: number | null, effectiveCss: number | null): string {
  if (!profile) return ''

  const sports = Array.isArray(profile.sports) ? (profile.sports as string[]).join(', ') : (profile.sports ?? '—')
  const zones = profile.zones_cycling as { zones?: Array<{ name: string; min: number; max: number }> } | null
  const zonesRunning = profile.zones_running as { zones?: Array<{ name: string; min: number; max: number }> } | null

  let section = `════════════════════════════════════════
ATHLETE PROFILE
════════════════════════════════════════

Name: ${profile.name ?? '—'}
Age: ${profile.age ?? '—'} · ${profile.sex ?? '—'} · ${profile.location ?? '—'}
Sports: ${sports}
Experience: ${profile.experience_years ?? '—'} years racing · ${profile.coaching_history ?? '—'}
Strengths: ${profile.strengths ?? '—'}
Weaknesses: ${profile.weaknesses ?? '—'}

Fitness metrics${profile.fitness_metrics_last_synced ? ` (sourced from Intervals.icu · synced recently)` : ''}:
  FTP: ${effectiveFtp ? `${effectiveFtp}W` : '—'}
  Threshold pace: ${formatPace(effectivePace as number | null)}
  Critical swim speed: ${formatCss(effectiveCss as number | null)}
  Threshold HR cycling: ${profile.threshold_hr_cycling ? `${profile.threshold_hr_cycling}bpm` : '—'}
  Threshold HR running: ${profile.threshold_hr_running ? `${profile.threshold_hr_running}bpm` : '—'}`

  if (zones?.zones?.length) {
    section += `\n\nCycling zones:\n  ${zones.zones.map((z) => `${z.name}: ${z.min}–${z.max}W`).join(' · ')}`
  }
  if (zonesRunning?.zones?.length) {
    section += `\n\nRunning zones:\n  ${zonesRunning.zones.map((z) => `${z.name}: ${z.min}–${z.max}`).join(' · ')}`
  }

  return section
}

function buildPlanLayer(plan: Record<string, unknown> | null): string {
  if (!plan) return ''

  const philoMap: Record<string, string> = {
    '80_20': '80/20 polarized',
    polarized: 'Polarized',
    pyramidal: 'Pyramidal',
    threshold_focused: 'Threshold focused',
    custom: 'Custom',
  }

  const structure = plan.weekly_structure as Record<string, string> | null
  const structureStr = structure
    ? Object.entries(structure).map(([d, t]) => `${d.charAt(0).toUpperCase() + d.slice(1)}: ${t}`).join(' · ')
    : '—'

  return `════════════════════════════════════════
CURRENT PLAN
════════════════════════════════════════

Philosophy: ${philoMap[plan.philosophy as string] ?? (plan.philosophy ?? '—')}
${plan.philosophy_notes ? `Notes: ${plan.philosophy_notes}\n` : ''}Weekly structure:
  ${structureStr}
Quality sessions per week: ${plan.quality_sessions_per_week ?? '—'}
Long session day: ${plan.long_session_day ?? '—'}
Ramp rate: ${plan.ramp_rate_tss_per_week ? `${plan.ramp_rate_tss_per_week} TSS/wk` : '—'}
Peak weekly volume: ${plan.peak_weekly_hours ? `${plan.peak_weekly_hours}h` : '—'} · ${plan.peak_weekly_tss ? `${plan.peak_weekly_tss} TSS` : '—'}

Current phase: ${plan.current_phase ?? '—'} · Block ${plan.current_week_in_phase ?? '—'} of ${plan.phase_length_weeks ?? '—'}`
}

function buildPatternsLayer(patterns: Record<string, unknown>[]): string {
  if (!patterns.length) return ''

  const items = patterns.map((p) => {
    const conf = (p.confidence as string ?? 'low').toUpperCase()
    const count = p.observation_count ?? 1
    const times = count === 1 ? '1 time' : `${count} times`
    return `[pattern:${p.id}] Category: ${p.category ?? 'general'}${p.sport && p.sport !== 'general' ? ` · ${p.sport}` : ''}
"${p.pattern_text}"
Confidence: ${conf} · Observed ${times}${p.first_observed_date ? ` · first seen ${p.first_observed_date}` : ''}${p.last_observed_date ? ` · last seen ${p.last_observed_date}` : ''}`
  }).join('\n\n')

  return `════════════════════════════════════════
TRAINING PATTERNS (${patterns.length} active)
════════════════════════════════════════

${items}`
}

function buildRulesLayer(rules: Record<string, unknown>[]): string {
  if (!rules.length) return ''

  const items = rules.map((r) => {
    return `[${r.apply_mode ?? 'auto_propose'}] ${r.name}:
  IF ${r.trigger_condition}
  THEN ${r.action}`
  }).join('\n\n')

  return `════════════════════════════════════════
ADAPTATION RULES (${rules.length} active)
════════════════════════════════════════

${items}`
}

function buildRacesLayer(races: Record<string, unknown>[]): string {
  if (!races.length) return ''

  const today = new Date()
  const items = races.map((r) => {
    const raceDate = r.race_date ? parseDateLocal(r.race_date as string) : null
    const daysAway = raceDate ? Math.ceil((raceDate.getTime() - today.getTime()) / 86400000) : null
    const legTargets = r.per_leg_targets as Record<string, { time_seconds?: number; power_watts?: number; pace_per_km_seconds?: number; notes?: string }> | null

    let section = `[${r.priority ?? 'B'}-RACE] ${r.race_name} · ${r.race_date ?? '—'}${daysAway != null ? ` · ${daysAway} days away` : ''}
Location: ${r.location ?? '—'}
Overall goal: ${r.overall_goal_time_seconds ? formatPace(r.overall_goal_time_seconds as number / 60) : '—'}${r.overall_goal_position ? ` · ${r.overall_goal_position}` : ''}
${r.notes ? `Notes: ${r.notes}` : ''}${r.stretch_goal ? `\nStretch goal: ${r.stretch_goal}` : ''}`

    if (legTargets) {
      const legLines = Object.entries(legTargets).map(([leg, t]) => {
        const parts = [`${leg.charAt(0).toUpperCase() + leg.slice(1)}`]
        if (t.time_seconds) parts.push(formatPace(t.time_seconds / 60))
        if (t.power_watts) parts.push(`${t.power_watts}W`)
        if (t.notes) parts.push(t.notes)
        return parts.join(': ')
      })
      if (legLines.length) section += `\nLeg targets:\n  ${legLines.join('\n  ')}`
    }
    return section
  }).join('\n\n')

  return `════════════════════════════════════════
RACE GOALS (upcoming)
════════════════════════════════════════

${items}`
}

function buildFuelingLayer(fueling: Record<string, unknown> | null): string {
  if (!fueling) return ''

  return `════════════════════════════════════════
FUELING STRATEGY
════════════════════════════════════════

Race day:
  Carbohydrate: ${fueling.race_carb_per_hour_g ? `${fueling.race_carb_per_hour_g}g/h` : '—'}
  Fluid: ${fueling.race_fluid_per_hour_ml ? `${fueling.race_fluid_per_hour_ml}ml/h` : '—'}
  Sodium: ${fueling.race_sodium_per_hour_mg ? `${fueling.race_sodium_per_hour_mg}mg/h standard` : '—'}${fueling.race_sodium_hot_per_hour_mg ? ` · ${fueling.race_sodium_hot_per_hour_mg}mg/h hot` : ''}
  Caffeine: ${fueling.caffeine_strategy ?? '—'}

Training (long sessions):
  Carbohydrate: ${fueling.training_carb_per_hour_g ? `${fueling.training_carb_per_hour_g}g/h` : '—'}
  ${fueling.bars_allowed_until_mins ? `Bars allowed: first ${fueling.bars_allowed_until_mins}min only · gels after ${fueling.bars_allowed_until_mins}min` : ''}
  ${fueling.gi_notes ? `GI note: ${fueling.gi_notes}` : ''}

Pre-race:
  Meal: ${fueling.pre_race_meal ?? '—'}
  Timing: ${fueling.pre_race_timing_hours ? `T-${fueling.pre_race_timing_hours}h before start` : '—'}
  ${fueling.heat_threshold_celsius ? `Heat protocol: above ${fueling.heat_threshold_celsius}°C, add ${fueling.heat_fluid_increase_ml ?? 0}ml fluid` : ''}`
}

function buildHealthLayer(health: Record<string, unknown> | null, recentInjuries: Record<string, unknown>[]): string {
  if (!health) return ''

  const activeIllnesses = health.illnesses as unknown[]
  const illnessesStr = Array.isArray(activeIllnesses) && activeIllnesses.length
    ? (activeIllnesses as Array<{ name?: string; description?: string; date_start?: string; date_cleared?: string | null; restrictions?: string[]; hrv_impact?: string }>)
        .map((il, originalIdx) => ({ ...il, originalIdx }))
        .filter((il) => !il.date_cleared)
        .map((il) => `[illness_${il.originalIdx}] ${il.name ?? 'Illness'} (since ${il.date_start ?? '?'}): ${il.description ?? ''}${il.hrv_impact ? ` — HRV: ${il.hrv_impact}` : ''}${il.restrictions?.length ? ` — restrictions: ${il.restrictions.join(', ')}` : ''}`)
        .join('\n  ') || 'None'
    : 'None'

  const active = health.active_injuries as unknown[]
  const activeStr = Array.isArray(active) && active.length
    ? (active as Array<{ body_part?: string; description?: string; restrictions?: string[]; date_cleared?: string | null }>)
        .map((inj, originalIdx) => ({ ...inj, originalIdx }))
        .filter((inj) => !inj.date_cleared)
        .map((inj) => `[active_injury_${inj.originalIdx}] ${inj.body_part}: ${inj.description}${inj.restrictions?.length ? ` — restrictions: ${inj.restrictions.join(', ')}` : ''}`)
        .join('\n  ') || 'None'
    : 'None'

  const flags = Array.isArray(health.monitoring_flags) ? (health.monitoring_flags as string[]).join('\n  - ') : ''
  const historyStr = recentInjuries.length
    ? recentInjuries.map((h) => `${h.body_part} · ${h.date_start}${h.date_resolved ? ` → ${h.date_resolved}` : ''}\n  ${h.description}${h.resolution ? ` — resolved: ${h.resolution}` : ''}`).join('\n')
    : 'None on record'

  return `════════════════════════════════════════
HEALTH & INJURY
════════════════════════════════════════

Active illnesses: ${illnessesStr}
Active injuries: ${activeStr}
${flags ? `\nMonitoring flags:\n  - ${flags}` : ''}
${recentInjuries.length ? `\nRelevant history:\n${historyStr}` : ''}
Allergies: ${health.allergies ?? 'None'}
Medications: ${health.medications ?? 'None'}`
}

function buildRecoveryLayer(recovery: Record<string, unknown> | null): string {
  if (!recovery) return ''

  const restDays = Array.isArray(recovery.preferred_rest_days) ? (recovery.preferred_rest_days as string[]).join(' · ') : (recovery.preferred_rest_days ?? '—')

  return `════════════════════════════════════════
RECOVERY PREFERENCES
════════════════════════════════════════

Sleep target: ${recovery.sleep_target_hours ? `${recovery.sleep_target_hours}h` : '—'}
Preferred rest days: ${restDays}
Recovery modalities: ${recovery.recovery_modalities ?? '—'}
HRV: ${recovery.hrv_device ?? '—'} · ${recovery.hrv_measurement_time ?? '—'}
Deload: every ${recovery.deload_frequency_weeks ?? '—'}th week at ${recovery.deload_load_percent ?? '—'}% load`
}

function buildReadinessLayer(todayWellness: Record<string, unknown> | null, recent14d: Record<string, unknown>[]): string {
  if (!todayWellness && !recent14d.length) return ''

  const w = todayWellness
  const dateLabel = w?.date ? parseDateLocal(w.date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today'

  let readiness = 'NORMAL'
  if (w) {
    const hrvLow = (w.hrv_delta_14d_percent as number | null) != null && (w.hrv_delta_14d_percent as number) < -7
    const sleepLow = (w.sleep_hours as number | null) != null && (w.sleep_hours as number) < 6
    if (hrvLow || sleepLow) readiness = 'REDUCED'
    if ((w.tsb as number | null) != null && (w.tsb as number) < -20) readiness = 'HIGH FATIGUE'
  }

  let section = `════════════════════════════════════════
TODAY'S READINESS (${dateLabel})
════════════════════════════════════════
`
  if (w) {
    const lines = [
      w.hrv_rmssd != null ? `HRV: ${Math.round(w.hrv_rmssd as number)}ms${w.hrv_delta_14d_percent != null ? ` (${Math.round(w.hrv_delta_14d_percent as number)}% vs 14d baseline)` : ''}` : null,
      w.resting_hr != null ? `Resting HR: ${Math.round(w.resting_hr as number)}bpm` : null,
      w.sleep_hours != null ? `Sleep: ${(w.sleep_hours as number).toFixed(1)}h` : null,
      w.body_battery != null ? `Body battery: ${w.body_battery}/100` : null,
      w.tsb != null ? `Form (TSB): ${Math.round(w.tsb as number)}` : null,
      w.atl != null ? `ATL (fatigue): ${Math.round(w.atl as number)}` : null,
      w.ctl != null ? `CTL (fitness): ${Math.round(w.ctl as number)}` : null,
    ].filter(Boolean)
    section += `\n${lines.join('\n')}\n\nReadiness assessment: ${readiness}`
  }

  if (recent14d.length >= 3) {
    const validHrv = recent14d.filter((w) => (w.hrv_rmssd as number | null) != null)
    const validRhr = recent14d.filter((w) => (w.resting_hr as number | null) != null)
    const validSleep = recent14d.filter((w) => (w.sleep_hours as number | null) != null)
    const trendLines: string[] = []
    if (validHrv.length >= 3) {
      const vals = [...validHrv].reverse().map((w) => Math.round(w.hrv_rmssd as number))
      trendLines.push(`HRV (ms): ${vals.join(', ')}`)
    }
    if (validRhr.length >= 3) {
      const vals = [...validRhr].reverse().map((w) => Math.round(w.resting_hr as number))
      trendLines.push(`Resting HR (bpm): ${vals.join(', ')}`)
    }
    if (validSleep.length >= 3) {
      const vals = [...validSleep].reverse().map((w) => (w.sleep_hours as number).toFixed(1))
      trendLines.push(`Sleep (h): ${vals.join(', ')}`)
    }
    if (trendLines.length) {
      section += `\n\n14-day trend (oldest → newest):\n  ${trendLines.join('\n  ')}`
    }
  }

  return section
}

function buildSessionHistoryLayer(sessions: Record<string, unknown>[]): string {
  if (!sessions.length) return ''

  const lines = sessions.slice(0, 10).map((s) => {
    const date = s.session_date ? parseDateLocal(s.session_date as string).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'
    const duration = s.actual_duration_seconds ? (() => {
      const secs = s.actual_duration_seconds as number
      const h = Math.floor(secs / 3600)
      const m = Math.floor((secs % 3600) / 60)
      return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m}min`
    })() : '—'

    const sport = s.sport as string | null

    let line = `${date} · ${s.session_type ?? 'Workout'} · ${sport ?? ''}`
    line += `\n  Duration: ${duration}`

    if (sport === 'cycling') {
      if (s.avg_power_watts)         line += ` · Avg: ${Math.round(s.avg_power_watts as number)}W`
      if (s.normalized_power_watts)  line += ` · NP: ${Math.round(s.normalized_power_watts as number)}W`
      if (s.actual_tss)              line += ` · TSS: ${Math.round(s.actual_tss as number)}`
      if (s.intensity_factor)        line += ` · IF: ${(s.intensity_factor as number).toFixed(2)}`
      if (s.cardiac_drift_percent != null) line += ` · Drift: ${(s.cardiac_drift_percent as number).toFixed(1)}%`
    } else if (sport === 'running') {
      const paceSecsKm = s.pace_per_km as number | null
      if (paceSecsKm) {
        const m = Math.floor(paceSecsKm / 60)
        const sc = Math.round(paceSecsKm % 60)
        line += ` · Pace: ${m}:${String(sc).padStart(2, '0')}/km`
      }
      if (s.avg_hr)      line += ` · HR: ${Math.round(s.avg_hr as number)}bpm`
      if (s.actual_tss)  line += ` · TSS: ${Math.round(s.actual_tss as number)}`
      if (s.aerobic_decoupling != null) line += ` · AeD: ${(s.aerobic_decoupling as number).toFixed(1)}%`
    } else if (sport === 'swimming') {
      if (s.distance_meters) {
        const dm = s.distance_meters as number
        line += ` · ${dm >= 1000 ? `${(dm / 1000).toFixed(1)}km` : `${Math.round(dm)}m`}`
      }
      if (s.actual_duration_seconds && s.distance_meters) {
        const pace100m = (s.actual_duration_seconds as number) / ((s.distance_meters as number) / 100)
        const m = Math.floor(pace100m / 60)
        const sc = Math.round(pace100m % 60)
        line += ` · Pace: ${m}:${String(sc).padStart(2, '0')}/100m`
      }
      if (s.actual_tss) line += ` · TSS: ${Math.round(s.actual_tss as number)}`
    } else {
      if (s.actual_tss) line += ` · TSS: ${Math.round(s.actual_tss as number)}`
    }

    if (s.rpe)           line += ` · RPE: ${s.rpe}`
    if (s.athlete_notes) line += `\n  Notes: "${s.athlete_notes}"`
    if (s.ai_flags) {
      const flags = Array.isArray(s.ai_flags) ? (s.ai_flags as string[]).join(', ') : s.ai_flags
      line += `\n  AI flags: ${flags}`
    }
    return line
  }).join('\n\n')

  return `════════════════════════════════════════
SESSION HISTORY (last 28 days)
════════════════════════════════════════

${lines}

[Older sessions available — ask athlete to reference specific date or session]`
}

function buildRecentConversationsLayer(conversations: Record<string, unknown>[]): string {
  if (!conversations.length) return ''

  const items = conversations.map((c) => {
    const date = new Date(c.updated_at as string).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    })
    const decisions = c.key_decisions as string[] | null
    let entry = `${date}:\n${c.summary}`
    if (decisions && decisions.length > 0) {
      entry += `\nAgreed: ${decisions.join(' · ')}`
    }
    return entry
  }).join('\n---\n')

  return `════════════════════════════════════════
RECENT COACHING CONVERSATIONS (last 14 days)
════════════════════════════════════════

${items}

Conversations older than 14 days are archived. If the athlete references an older conversation, respond: "I don't have that in my active window — want me to look it up?" and if yes, fetch that specific conversation summary on demand.`
}

function buildContextUpdateInstructions(): string {
  return `════════════════════════════════════════
CONTEXT UPDATE PROTOCOL — MANDATORY
════════════════════════════════════════

You MUST propose context updates when any of these occur:

ALWAYS propose update to health_injury when:
- Athlete mentions illness, injury, pain, feeling unwell
- Athlete confirms medical advice or restrictions
- Recovery metrics consistently abnormal

ALWAYS propose update to plan_dna when:
- New training structure agreed upon
- Weekly hours target confirmed
- Training days or session types locked in

ALWAYS propose update to training_patterns when:
- Consistent behaviour observed across sessions
- Athlete confirms a preference or tendency
- Pattern emerges from conversation

PROCESS:
1. Have the coaching conversation naturally
2. When you reach a conclusion or agreement, end your FINAL message with context update JSON blocks
3. Do not ask permission — just include them
4. You can include multiple blocks if needed

FORMAT — append at the very end of your message:

For illness — adding new (use target_field "illnesses"):
{"context_update":{"target_module":"health_injury","target_field":"illnesses","action_type":"append","suggested_value":"{\"name\":\"Cold\",\"description\":\"Upper respiratory infection\",\"date_start\":\"2026-05-18\",\"restrictions\":[\"no training until HRV normalises to within 5% baseline\"],\"date_cleared\":null}","reasoning":"Athlete confirmed cold this week","evidence":"HRV suppressed all week, symptoms improving"}}

For illness — marking resolved (use the [illness_N] index shown in HEALTH & INJURY):
{"context_update":{"target_module":"health_injury","target_field":"illness_0","action_type":"archive","suggested_value":"Cold cleared — athlete confirmed symptoms resolved and HRV returning to baseline","reasoning":"Athlete confirmed recovery","evidence":"HRV back within 3% of baseline, symptoms gone"}}

ARCHIVE ILLNESS — MANDATORY PATTERN REVIEW:
When archiving an illness, always scan TRAINING PATTERNS for any restriction-style patterns
that were created alongside the illness and propose removing them.

  KEEP patterns that are physiological observations (long-term value):
    ✓ "Upper respiratory illness causes 5-7 day HRV suppression beyond symptom resolution"
    ✓ "HRV drops 25%+ during overreaching phases"

  PROPOSE REMOVE for patterns that are actually restrictions or instructions:
    ✗ "No training until HRV normalises"
    ✗ "Rest until feeling better"
    ✗ Any pattern containing "no training", "rest until", "avoid until"
    ✗ Any pattern that is clearly an instruction rather than an observation
    ✗ Any pattern created at the same time as the illness being archived

Example — when clearing an illness, propose both the archive AND any restriction removals:
{"context_update":{"target_module":"health_injury","target_field":"illness_0","action_type":"archive","suggested_value":"Cold cleared — athlete confirmed symptoms resolved and HRV returning to baseline","reasoning":"Athlete confirmed recovery","evidence":"HRV back within 3% of baseline, symptoms gone"}}
{"context_update":{"target_module":"training_patterns","target_field":"<pattern-uuid>","action_type":"remove","suggested_value":null,"reasoning":"This is a restriction not a pattern — removing now illness is cleared","evidence":"Pattern contains instruction language ('no training until HRV normalises') not observational language"}}

For physical injuries — adding new (use target_field "active_injuries"):
{"context_update":{"target_module":"health_injury","target_field":"active_injuries","action_type":"append","suggested_value":"{\"body_part\":\"left knee\",\"description\":\"IT band strain\",\"date_start\":\"2026-05-18\",\"restrictions\":[\"no running for 4 weeks\"],\"can_cycle\":true,\"can_swim\":true,\"can_strength\":false,\"date_cleared\":null}","reasoning":"Athlete confirmed knee injury","evidence":"Pain on lateral knee during long run, confirmed by physio"}}

For physical injuries — marking resolved (use the [active_injury_N] index shown in HEALTH & INJURY):
{"context_update":{"target_module":"health_injury","target_field":"active_injury_0","action_type":"archive","suggested_value":"IT band resolved — returned to full running load","reasoning":"Athlete confirmed no pain on long run","evidence":"Completed 18km with no symptoms"}}

For training_patterns — superseding an outdated pattern (target_field = the pattern's id to supersede):
{"context_update":{"target_module":"training_patterns","target_field":"<pattern-uuid>","action_type":"supersede","suggested_value":"Updated pattern text that replaces the old one","reasoning":"Old pattern no longer accurate","evidence":"..."}}

For removing incorrectly added data:
{"context_update":{"target_module":"training_patterns","target_field":"<pattern-uuid>","action_type":"remove","suggested_value":"","reasoning":"Pattern was added in error","evidence":"..."}}
{"context_update":{"target_module":"health_injury","target_field":"illness_0","action_type":"remove","suggested_value":"","reasoning":"Illness was logged incorrectly","evidence":"..."}}

For plan_dna:
{"context_update":{"target_module":"plan_dna","target_field":"weekly_structure","action_type":"update_field","suggested_value":"{\"tuesday\":\"quality\",\"friday\":\"quality\",\"sunday\":\"long\",\"monday\":\"easy\",\"wednesday\":\"easy\",\"thursday\":\"easy\",\"saturday\":\"easy\"}","reasoning":"Athlete confirmed weekly structure","evidence":"Agreed in conversation — 9h weekly target"}}

For training_patterns — OBSERVED TENDENCIES only, not instructions:
{"context_update":{"target_module":"training_patterns","target_field":null,"action_type":"append","suggested_value":"Upper respiratory illness suppresses HRV for 5-7 days beyond symptom resolution","reasoning":"Pattern observed from illness conversation","evidence":"HRV remained 7% suppressed all week despite symptoms clearing"}}

DISTINCTION — training_patterns vs restrictions:
  training_patterns → observed tendencies about the athlete (what IS true)
    e.g. "Struggles with VO2 after long weekend rides"
    e.g. "Upper respiratory illness causes 7-day HRV suppression"
  health_injury restrictions[] → what to do about it (instructions)
    e.g. "No training until HRV within 5% baseline"
    e.g. "No running for 4 weeks"
  NEVER put an instruction like "no training until X" into training_patterns.
  NEVER put an observed tendency into restrictions[].

USING READINESS METRICS IN REASONING:
When readiness data is available, reference it specifically rather than generically:
  "Your resting HR of Xbpm is elevated vs your recent range of Y–Zbpm — that's a load signal."
  "Sleep of Xh last night is below your typical Yh — factor that into today's session expectation."
  "HRV at Xms is X% below your 14-day baseline — this warrants a conservative approach today."
Always tie the metric to a concrete coaching decision. Never show raw numbers without context.

RULES:
- NEVER skip this when agreement is reached
- NEVER say "I'll note that" without the JSON block
- JSON must be valid — properly escaped quotes inside string values
- Multiple updates = multiple separate JSON blocks, each on its own line
- Each block must be complete and parseable on its own

Allowed target_module values:
  plan_dna | training_patterns | adaptation_rules | race_goals |
  fueling_strategy | health_injury | recovery_preferences | session_notes

Allowed action_type values:
  append | update_field | archive | supersede | remove | replace_array_item

════════════════════════════════════════
READING DECLARATION — MANDATORY
════════════════════════════════════════

After EVERY response, append on the final line (after any JSON blocks):
[read:module1,module2,module3]

Use these module names exactly:
  athlete, plandna, patterns, rules, races, health, fueling, recovery,
  todayshrv, readiness, form, thisweek, lastsession, lastride, lastrun,
  lastswim, last7days, last28days, coachstyle

Include every module you actually consulted to generate this response.
Do not list modules you did not use.

Examples:
  [read:todayshrv,plandna,patterns]
  [read:health,todayshrv,lastride]
  [read:races,plandna,fueling]

════════════════════════════════════════
END OF CONTEXT
════════════════════════════════════════`
}

export async function buildSystemPrompt(userId: string): Promise<string> {
  const admin = createAdminClient()
  const today = todayStr()
  const ago28 = daysAgoStr(28)
  const ago14 = daysAgoStr(14)

  const [
    profileRes,
    styleRes,
    planRes,
    patternsRes,
    rulesRes,
    racesRes,
    fuelingRes,
    healthRes,
    injuryHistoryRes,
    recoveryRes,
    sessionsRes,
    todayWellnessRes,
    recentWellnessRes,
    recentConversationsRes,
  ] = await Promise.all([
    admin.from('athlete_profile').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('coach_style').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('plan_dna').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('training_patterns').select('*').eq('user_id', userId).eq('status', 'active'),
    admin.from('adaptation_rules').select('*').eq('user_id', userId).eq('enabled', true),
    admin.from('race_goals').select('*').eq('user_id', userId).eq('status', 'upcoming').order('race_date', { ascending: true }),
    admin.from('fueling_strategy').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('health_injury').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('injury_history').select('*').eq('user_id', userId).order('date_start', { ascending: false }).limit(5),
    admin.from('recovery_preferences').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('session_notes').select('*').eq('user_id', userId).eq('is_archived', false).gte('session_date', ago28).order('session_date', { ascending: false }),
    admin.from('wellness_cache').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
    admin.from('wellness_cache').select('*').eq('user_id', userId).gte('date', ago14).order('date', { ascending: false }),
    admin.from('conversations').select('title, summary, key_decisions, created_at, updated_at').eq('user_id', userId).not('summary', 'is', null).gte('updated_at', ago14 + 'T00:00:00Z').order('updated_at', { ascending: false }).limit(10),
  ])

  const profile = profileRes.data as Record<string, unknown> | null
  const style = styleRes.data as Record<string, unknown> | null
  const plan = planRes.data as Record<string, unknown> | null
  const patterns = (patternsRes.data ?? []) as Record<string, unknown>[]
  const rules = (rulesRes.data ?? []) as Record<string, unknown>[]
  const races = (racesRes.data ?? []) as Record<string, unknown>[]
  const fueling = fuelingRes.data as Record<string, unknown> | null
  const health = healthRes.data as Record<string, unknown> | null
  const injuryHistory = (injuryHistoryRes.data ?? []) as Record<string, unknown>[]
  const recovery = recoveryRes.data as Record<string, unknown> | null
  const sessions = (sessionsRes.data ?? []) as Record<string, unknown>[]
  const todayWellness = todayWellnessRes.data as Record<string, unknown> | null
  const recentWellness = (recentWellnessRes.data ?? []) as Record<string, unknown>[]
  const recentConversations = (recentConversationsRes.data ?? []) as Record<string, unknown>[]

  const effectiveFtp = (profile?.ftp_override ?? profile?.ftp_watts) as number | null
  const effectivePace = (profile?.threshold_pace_override ?? profile?.threshold_pace_per_km) as number | null
  const effectiveCss = (profile?.threshold_css_override ?? profile?.threshold_css) as number | null

  const sections = [
    'You are an expert endurance coach embedded in Endurance.OS, an AI-native training intelligence platform. You have full access to this athlete\'s training context, history, and readiness data. Use it to give specific, evidence-based coaching — not generic advice.',
    buildCoachInstructions(style),
    buildAthleteLayer(profile, effectiveFtp, effectivePace, effectiveCss),
    buildPlanLayer(plan),
    buildPatternsLayer(patterns),
    buildRulesLayer(rules),
    buildRacesLayer(races),
    buildFuelingLayer(fueling),
    buildHealthLayer(health, injuryHistory),
    buildRecoveryLayer(recovery),
    buildReadinessLayer(todayWellness, recentWellness),
    buildSessionHistoryLayer(sessions),
    buildRecentConversationsLayer(recentConversations),
    buildContextUpdateInstructions(),
  ].filter(Boolean)

  return sections.join('\n\n')
}

export function getLoadedContextModules(systemPrompt: string): string[] {
  const modules: string[] = []
  if (systemPrompt.includes('TODAY\'S READINESS')) modules.push('@todayshrv')
  if (systemPrompt.includes('CURRENT PLAN')) modules.push('@plandna')
  if (systemPrompt.includes('TRAINING PATTERNS')) modules.push('@patterns')
  if (systemPrompt.includes('RACE GOALS')) modules.push('@goals')
  if (systemPrompt.includes('SESSION HISTORY')) modules.push('@sessions')
  if (systemPrompt.includes('FUELING STRATEGY')) modules.push('@fueling')
  if (systemPrompt.includes('HEALTH & INJURY')) modules.push('@health')
  return modules
}
