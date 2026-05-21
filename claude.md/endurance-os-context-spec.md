# Endurance.OS — Context System Specification
**Version 1.0 — Complete Design & Implementation Reference**

---

## Overview

The context system is the core intelligence layer of Endurance.OS. It is a structured, persistent, user-owned knowledge base that the AI Coach reads from on every conversation and writes to via a controlled suggestion pipeline.

### Core principles

- **Nothing is hidden.** Every piece of context the AI reads is visible and editable by the user.
- **Nothing auto-applies.** All AI-suggested context changes require explicit user acceptance, except where noted.
- **The athlete profile and coach style are user-only.** All other modules accept AI suggestions.
- **The AI discusses before it suggests.** Context change suggestions are the formalisation of an agreed conversation outcome, not cold recommendations.
- **Fitness metrics are owned by Intervals.icu.** FTP, thresholds, and zones are read from the Intervals.icu API, cached locally, and treated as read-only.

---

## Architecture Overview

```
Intervals.icu API
  └── Activities, wellness, FTP, zones, calendar
        └── Synced to Supabase (cached, read-only fields)

User input (onboarding + direct edits)
  └── Written directly to Supabase context tables

AI conversation
  └── Reads assembled system prompt (built from Supabase at runtime)
  └── Suggestions written to context_suggestions table (pending)
  └── User accepts/edits/rejects in UI
  └── Accepted suggestions written to target context table
```

---

## Supabase Schema

### Table: `users`
Standard auth table. One row per athlete.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  intervals_athlete_id TEXT,
  intervals_api_key TEXT, -- encrypted at rest
  last_intervals_sync TIMESTAMPTZ
);
```

---

### Table: `athlete_profile`
User-defined only. AI never suggests changes. One row per user.

```sql
CREATE TABLE athlete_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  age INT,
  sex TEXT, -- male / female / prefer_not_to_say
  location TEXT,
  sports TEXT[], -- ['cycling', 'running', 'swimming', 'triathlon']
  experience_years INT,
  coaching_history TEXT, -- self-coached / previously_coached / currently_coached
  strengths TEXT,
  weaknesses TEXT,
  -- Fitness metrics (cached from Intervals.icu, read-only)
  ftp_watts INT,
  threshold_pace_per_km NUMERIC, -- seconds per km
  threshold_css NUMERIC, -- critical swim speed, seconds per 100m
  threshold_hr_cycling INT,
  threshold_hr_running INT,
  zones_cycling JSONB, -- raw zone data from Intervals API
  zones_running JSONB,
  zones_swimming JSONB,
  -- Manual overrides (user can override Intervals estimates)
  ftp_override INT,
  threshold_pace_override NUMERIC,
  threshold_css_override NUMERIC,
  -- Sync metadata
  fitness_metrics_last_synced TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Notes:**
- `ftp_override`, `threshold_pace_override`, `threshold_css_override` take precedence over cached values when the AI builds context.
- Fitness metrics are refreshed on every Intervals.icu sync cycle.
- AI reads effective FTP as: `COALESCE(ftp_override, ftp_watts)`.

---

### Table: `coach_style`
User-defined only. AI never suggests changes. One row per user.

```sql
CREATE TABLE coach_style (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tone TEXT DEFAULT 'direct', -- direct / friendly / mentor / pro
  reply_length TEXT DEFAULT 'short', -- short / standard / verbose
  praise_level TEXT DEFAULT 'minimal', -- none / minimal / encouraging
  challenge_mode TEXT DEFAULT 'when_data_conflicts', -- never / when_data_conflicts / always
  system_prompt_override TEXT, -- advanced: user can write raw system prompt additions
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Table: `plan_dna`
User-defined initial values. AI can suggest updates via `context_suggestions`. One row per user.

```sql
CREATE TABLE plan_dna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  philosophy TEXT, -- 80_20 / polarized / pyramidal / threshold_focused / custom
  philosophy_notes TEXT, -- freetext for custom or nuance
  weekly_structure JSONB,
  -- Example weekly_structure:
  -- {
  --   "monday": "easy",
  --   "tuesday": "quality",
  --   "wednesday": "easy",
  --   "thursday": "quality",
  --   "friday": "rest",
  --   "saturday": "long",
  --   "sunday": "easy_or_rest"
  -- }
  quality_sessions_per_week INT DEFAULT 2,
  long_session_day TEXT, -- monday...sunday
  ramp_rate_tss_per_week INT,
  peak_weekly_hours NUMERIC,
  peak_weekly_tss INT,
  current_phase TEXT, -- base / build / peak / taper / recovery
  current_week_in_phase INT,
  phase_length_weeks INT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Table: `training_patterns`
AI-detected and user-approved. Append-only. Multiple rows per user.

```sql
CREATE TABLE training_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pattern_text TEXT NOT NULL,
  category TEXT,
  -- interval_preference / fatigue_response / pacing_tendency /
  -- weather_response / recovery_rate / sport_specific / fueling / other
  sport TEXT DEFAULT 'general', -- cycling / running / swimming / general
  confidence TEXT DEFAULT 'low', -- low / medium / high
  observation_count INT DEFAULT 1,
  evidence TEXT, -- human-readable evidence summary e.g. "Observed Wks 4, 7, 10"
  first_observed_date DATE,
  last_observed_date DATE,
  status TEXT DEFAULT 'active', -- active / superseded / archived
  supersedes_id UUID REFERENCES training_patterns(id),
  source_conversation_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Notes:**
- AI never overwrites existing patterns. It appends new rows or marks old rows as `superseded`.
- `confidence` upgrades from `low` → `medium` → `high` as `observation_count` increases (thresholds: 2 = medium, 4 = high).
- Only `status = 'active'` patterns are included in the system prompt.

---

### Table: `adaptation_rules`
User-defined with AI assistance. AI can suggest new rules or modifications. Multiple rows per user.

```sql
CREATE TABLE adaptation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT,
  -- hrv_drop / sleep_low / travel / race_week / illness /
  -- injury / consecutive_hard_days / user_defined
  trigger_condition TEXT, -- freetext: "HRV < -7% for 2 consecutive days"
  action TEXT, -- freetext: "Propose Z2 swap for today's session"
  apply_mode TEXT DEFAULT 'auto_propose', -- auto_propose / auto_apply / manual
  sport TEXT DEFAULT 'all', -- cycling / running / swimming / all
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Table: `race_goals`
User-defined per race. AI can suggest target updates after discussions. Multiple rows per user.

```sql
CREATE TABLE race_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  race_name TEXT NOT NULL,
  race_date DATE,
  location TEXT,
  distance_format TEXT, -- sprint / olympic / 70.3 / ironman / marathon / etc.
  sport TEXT, -- triathlon / cycling / running / swimming
  priority TEXT DEFAULT 'A', -- A / B / C
  overall_goal_time_seconds INT,
  overall_goal_position TEXT,
  per_leg_targets JSONB,
  -- Example per_leg_targets:
  -- {
  --   "swim": {"time_seconds": 1920, "notes": "settle by 200m"},
  --   "bike": {"time_seconds": 9480, "power_watts": 215, "if": 0.79},
  --   "run": {"time_seconds": 5700, "pace_per_km_seconds": 270}
  -- }
  stretch_goal TEXT,
  notes TEXT,
  status TEXT DEFAULT 'upcoming', -- upcoming / completed / cancelled
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Table: `fueling_strategy`
User-defined base values. AI can suggest updates. One row per user.

```sql
CREATE TABLE fueling_strategy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  -- Race fueling
  race_carb_per_hour_g INT,
  race_fluid_per_hour_ml INT,
  race_sodium_per_hour_mg INT,
  race_sodium_hot_per_hour_mg INT, -- adjusted for heat
  -- Training fueling
  training_carb_per_hour_g INT,
  bars_allowed_until_mins INT, -- after this switch to gels
  -- Caffeine
  caffeine_strategy TEXT,
  -- Pre-race
  pre_race_meal TEXT,
  pre_race_timing_hours NUMERIC, -- hours before start
  -- GI and intolerances
  gi_notes TEXT,
  -- Heat adjustments
  heat_threshold_celsius INT, -- temp above which heat protocol applies
  heat_fluid_increase_ml INT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Table: `health_injury`
Mix of user-defined and AI-suggested. Two entry paths: direct UI log or conversational coach entry.

```sql
CREATE TABLE health_injury (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  -- Active state
  active_injuries JSONB DEFAULT '[]',
  -- Example active_injuries:
  -- [
  --   {
  --     "id": "uuid",
  --     "body_part": "left ankle",
  --     "description": "Grade 1 sprain",
  --     "date_start": "2025-06-03",
  --     "restrictions": ["no running for 4 weeks"],
  --     "can_cycle": true,
  --     "can_swim": true,
  --     "can_strength": false,
  --     "physio_notes": "loaded rest, no impact",
  --     "date_cleared": null
  --   }
  -- ]
  -- Monitoring flags
  monitoring_flags TEXT[],
  -- e.g. ["watch consecutive run days", "monitor left achilles on downhill"]
  -- General health
  allergies TEXT,
  medications TEXT,
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Separate append-only injury history log
CREATE TABLE injury_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  body_part TEXT,
  description TEXT,
  date_start DATE,
  date_resolved DATE,
  triggers TEXT,
  resolution TEXT,
  source TEXT DEFAULT 'user', -- user / ai_conversation
  source_conversation_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Conversational injury entry flow:**
1. User says "I've sprained my ankle, physio says no running for 4 weeks"
2. AI asks clarifying questions: can you ride? swim? strength? pain level? physio contact?
3. AI assembles full injury record from conversation
4. AI proposes context update via `context_suggestions` → updates `active_injuries` array
5. AI simultaneously proposes plan adaptations (removes running from calendar weeks)
6. User accepts both suggestions independently

---

### Table: `recovery_preferences`
User-defined. AI can suggest updates. One row per user.

```sql
CREATE TABLE recovery_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  sleep_target_hours NUMERIC DEFAULT 7.5,
  preferred_rest_days TEXT[], -- ['sunday', 'friday']
  recovery_modalities TEXT, -- freetext: "sauna 2x/wk, light spin ok on rest days"
  hrv_device TEXT, -- garmin / oura / whoop / other
  hrv_measurement_time TEXT DEFAULT 'upon_wake', -- upon_wake / morning / night
  deload_frequency_weeks INT DEFAULT 4,
  deload_load_percent INT DEFAULT 60,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Table: `session_notes`
Attached to specific completed sessions. Auto-populated during session reviews. Rolling 28-day active window.

```sql
CREATE TABLE session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  -- Session reference
  session_id TEXT NOT NULL, -- Intervals.icu activity ID
  session_date DATE NOT NULL,
  session_type TEXT, -- threshold / vo2 / z2 / long / brick / recovery / etc.
  sport TEXT,
  -- Planned vs actual
  planned_tss INT,
  actual_tss INT,
  planned_duration_seconds INT,
  actual_duration_seconds INT,
  -- Athlete input
  rpe INT CHECK (rpe BETWEEN 1 AND 10),
  athlete_notes TEXT, -- captured during session review conversation
  -- AI generated
  ai_summary TEXT, -- auto-generated post-session summary
  ai_flags TEXT[], -- notable observations: ['cardiac_drift_high', 'missed_intervals', 'hr_decoupling']
  -- Key metrics (cached from Intervals.icu for AI access)
  avg_power_watts INT,
  normalized_power_watts INT,
  avg_hr INT,
  max_hr INT,
  hrv_morning_before NUMERIC, -- wellness data from that morning
  sleep_hours_prior NUMERIC,
  cardiac_drift_percent NUMERIC,
  -- Conversation reference
  review_conversation_id UUID,
  -- Lifecycle
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Session notes lifecycle:**
- Created during session review conversation
- Active and included in AI context for 28 days from `session_date`
- After 28 days: `is_archived = true`, excluded from default context
- Archived notes accessible if user explicitly references that session in chat
- `ai_summary` and `ai_flags` generated automatically at end of review conversation

---

### Table: `context_suggestions`
The unified pipeline for all AI-proposed context changes. Every AI suggestion routes through here.

```sql
CREATE TABLE context_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  -- Target
  target_module TEXT NOT NULL,
  -- plan_dna / training_patterns / adaptation_rules / race_goals /
  -- fueling_strategy / health_injury / recovery_preferences / session_notes
  target_field TEXT, -- specific field being updated, null for append operations
  action_type TEXT NOT NULL, -- append / update_field / archive / replace_array_item
  -- Content
  current_value TEXT, -- what it is now (for display in UI)
  suggested_value TEXT NOT NULL, -- what the AI wants it to become
  reasoning TEXT NOT NULL, -- why the AI is suggesting this (shown to user)
  evidence TEXT, -- data that triggered it: "Sessions May 3, 10, 17 · 3 missed VO2 sets"
  -- Source
  source_conversation_id UUID,
  source_session_id TEXT, -- Intervals.icu activity ID if triggered by session review
  triggered_by TEXT, -- pattern_detection / session_review / user_conversation / adaptation_rule
  -- Resolution
  status TEXT DEFAULT 'pending', -- pending / accepted / edited / rejected
  resolved_at TIMESTAMPTZ,
  resolved_value TEXT, -- what the user actually saved (may differ if they edited)
  resolved_by TEXT DEFAULT 'user', -- user / auto (for auto_apply rules)
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Suggestion pipeline rules:**
- `athlete_profile` and `coach_style` are excluded — AI cannot target these modules
- `training_patterns` only ever uses `action_type = 'append'` or `'archive'` — never `update_field`
- `plan_dna` uses `update_field` for specific field changes (e.g. `long_session_day`)
- `health_injury.active_injuries` uses `replace_array_item` or `append`
- All `pending` suggestions surface in the Memory Suggestions UI on the Context page and Dashboard
- `auto_apply` adaptation rules bypass this table and write directly (logged separately)

---

### Table: `wellness_cache`
Daily wellness data cached from Intervals.icu. Read-only. Used by AI for readiness context.

```sql
CREATE TABLE wellness_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hrv_rmssd NUMERIC,
  hrv_delta_14d_percent NUMERIC, -- % deviation from 14-day baseline
  resting_hr INT,
  sleep_hours NUMERIC,
  sleep_quality INT, -- if available from device
  body_battery INT, -- Garmin specific
  ctl NUMERIC, -- chronic training load
  atl NUMERIC, -- acute training load
  tsb NUMERIC, -- training stress balance (form)
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);
```

---

### Table: `conversations`
Stores conversation history and metadata. Used for linking suggestions to their source.

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  context_type TEXT DEFAULT 'general',
  -- general / session_review / race_planning / injury / week_planning
  linked_session_id TEXT, -- Intervals.icu activity ID for session reviews
  linked_race_id UUID REFERENCES race_goals(id),
  message_count INT DEFAULT 0,
  adaptations_accepted INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- user / assistant / system
  content TEXT NOT NULL,
  context_snapshot JSONB, -- which context modules were injected for this message
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## System Prompt Assembly

At the start of every conversation, Endurance.OS assembles a structured system prompt from the Supabase context tables. This happens server-side before the first message is sent to the AI.

### Assembly function (pseudocode)

```javascript
async function buildSystemPrompt(userId, conversationContext) {

  // Fetch all context modules in parallel
  const [
    profile,
    coachStyle,
    planDna,
    patterns,
    rules,
    races,
    fueling,
    health,
    recovery,
    recentSessions,
    todayWellness,
    recentWellness
  ] = await Promise.all([
    supabase.from('athlete_profile').select('*').eq('user_id', userId).single(),
    supabase.from('coach_style').select('*').eq('user_id', userId).single(),
    supabase.from('plan_dna').select('*').eq('user_id', userId).single(),
    supabase.from('training_patterns').select('*')
      .eq('user_id', userId).eq('status', 'active'),
    supabase.from('adaptation_rules').select('*')
      .eq('user_id', userId).eq('enabled', true),
    supabase.from('race_goals').select('*')
      .eq('user_id', userId).eq('status', 'upcoming')
      .order('race_date', { ascending: true }),
    supabase.from('fueling_strategy').select('*').eq('user_id', userId).single(),
    supabase.from('health_injury').select('*').eq('user_id', userId).single(),
    supabase.from('injury_history').select('*').eq('user_id', userId)
      .order('date_start', { ascending: false }).limit(5),
    supabase.from('recovery_preferences').select('*').eq('user_id', userId).single(),
    supabase.from('session_notes').select('*')
      .eq('user_id', userId).eq('is_archived', false)
      .gte('session_date', daysAgo(28))
      .order('session_date', { ascending: false }),
    supabase.from('wellness_cache').select('*')
      .eq('user_id', userId).eq('date', today()),
    supabase.from('wellness_cache').select('*')
      .eq('user_id', userId).gte('date', daysAgo(14))
      .order('date', { ascending: false })
  ])

  // Build effective FTP (override takes precedence)
  const effectiveFtp = profile.ftp_override ?? profile.ftp_watts
  const effectivePace = profile.threshold_pace_override ?? profile.threshold_pace_per_km
  const effectiveCss = profile.threshold_css_override ?? profile.threshold_css

  // Assemble prompt layers
  return `
${buildCoachInstructions(coachStyle)}

${buildAthleteLayer(profile, effectiveFtp, effectivePace, effectiveCss)}

${buildPlanLayer(planDna)}

${buildPatternsLayer(patterns)}

${buildRulesLayer(rules)}

${buildRacesLayer(races)}

${buildFuelingLayer(fueling)}

${buildHealthLayer(health, recentInjuries)}

${buildRecoveryLayer(recovery)}

${buildReadinessLayer(todayWellness, recentWellness)}

${buildSessionHistoryLayer(recentSessions)}

${buildConversationInstructions()}
`
}
```

### Prompt layer structure

Each layer is formatted as a clearly labelled markdown section:

```
## COACH INSTRUCTIONS
You are an endurance coach. Tone: direct. Replies: short — state the 
recommendation then briefly why. Praise: minimal. Challenge the athlete 
when their data conflicts with their plan.

Never suggest changes to athlete profile or coach style.
Always discuss before proposing a context update. A context suggestion 
card is the formalisation of an agreed conversation outcome, not a 
cold recommendation.

## ATHLETE PROFILE
Name: Mira Lindqvist · Age: 34 · Female · Helsinki
Sports: Triathlon (long course) · 6 years racing · 4 years self-coached
Strengths: Bike threshold, mental durability
Weaknesses: Open-water sighting, running off the bike past 18km
FTP: 285W · Threshold pace: 4:28/km · CSS: 1:28/100m

## CURRENT PLAN
Philosophy: 80/20 polarized
Structure: Tue quality · Thu quality · Sat long · 48h between hard sessions
Ramp rate: 4-6 TSS/wk · Peak: 14h/wk · 580 TSS/wk
Phase: Build 2 of 3 · Week 2 of 4

## TRAINING PATTERNS (4 active)
- [HIGH confidence] Threshold response: Strong on Tue; struggles when Mon TSS > 80
- [HIGH confidence] Recovery rebound: 2 easy days restore HRV to baseline within 36h
- [MEDIUM confidence] Hot weather: Cardiac drift +9% when bike temp > 24°C
- [LOW confidence] VO2 stacking: Struggles with stacked VO2 after long endurance weekends

## ADAPTATION RULES (6 active)
- IF HRV < -7% for 2 days → propose Z2 swap [auto_propose]
- IF sleep < 6h → propose intensity downshift [auto_propose]
- IF flight > 2h → cap intensity 24h post-flight [auto_propose]
- IF T-7 days to A-race → no Z4+ work, openers Thu [auto_apply]
- IF pain reported → pause 48h, resume Z1 [manual]
- IF VO2 logged today → skip sauna recommendation [auto_propose]

## RACE GOALS
A-race: Ironman 70.3 Lahti · Aug 16 · 74 days
Goal: Sub 4:55 · top 5 AG
Swim: 32:00 · Bike: 2:38 @ NP 215W (0.79 IF) · Run: 1:35 (4:30/km)

## FUELING STRATEGY
Race: 90g carb/h · 750ml/h · 600mg sodium/h (hot: +200ml, +100mg)
Training long: 70g carb/h · bars first 90min only then gels
Pre-race: Oats + banana + coffee T-3h
Caffeine: 200mg split T-0 and T+90 race day

## HEALTH & INJURY
Active injuries: None
Monitoring: Left Achilles — watch consecutive run days, downhill running
History: Left Achilles tendinopathy 2023 winter — resolved with 6wk eccentrics

## RECOVERY PREFERENCES
Sleep target: 7h 30m · Rest day: Sunday preferred
Modalities: Sauna 2x/wk · light Z1 spin OK on rest
HRV: Garmin wrist, upon wake · Deload: every 4th week at 60%

## TODAY'S READINESS
HRV: 64ms (-8% vs 14d baseline) · Resting HR: 48bpm (+2 vs 7d avg)
Sleep: 6h 12m (vs 7h 30m target) · Form (TSB): -12

## RECENT WELLNESS TREND (14 days)
[HRV trending down from 72ms to 64ms over 14 days]
[Sleep averaging 6.8h vs 7.5h target — chronic mild deficit]

## SESSION HISTORY (last 28 days — most recent first)
Mon Jun 2: Z2 base · 1:30 · TSS 62 · RPE 5 · "Felt easy, legs good"
Sat May 31: Long ride · 3:45 · TSS 208 · RPE 7 · cardiac drift +7%
  AI flags: volume 12% over plan
Thu May 29: VO2 5x4 · TSS 110 · RPE 8 · "Last interval was hard"
...

## CONTEXT UPDATE INSTRUCTIONS
When you identify something worth saving to the athlete's context:
1. Do not suggest it immediately — discuss it naturally first
2. Only propose a formal context update when you and the athlete have 
   reached agreement, or when pattern evidence is strong (3+ observations)
3. Format your suggestion as JSON at the end of your message:
   {"context_update": {
     "target_module": "training_patterns",
     "action_type": "append",
     "suggested_value": "Athlete struggles with...",
     "reasoning": "Observed in sessions...",
     "evidence": "May 3, 10, 17 · 3 missed VO2 sets"
   }}
4. Never target athlete_profile or coach_style
5. For training_patterns: always append, never overwrite
6. For plan_dna: specify the exact field being changed
`
}
```

---

## Context Update Pipeline

### How the AI proposes a context change

1. AI includes a structured JSON block at the end of its message
2. Your backend parses the response for `{"context_update": {...}}`
3. Backend validates: target module is not `athlete_profile` or `coach_style`
4. Backend writes a row to `context_suggestions` with `status = 'pending'`
5. UI surfaces the suggestion card in the conversation and in the Memory Suggestions inbox

### How the user resolves a suggestion

**Accept:**
- `context_suggestions.status` → `accepted`
- `context_suggestions.resolved_at` → now()
- `context_suggestions.resolved_value` = `suggested_value`
- Target table updated according to `action_type`:
  - `append` → INSERT new row (training_patterns, injury_history)
  - `update_field` → UPDATE specific field in target table
  - `archive` → UPDATE `status = 'archived'` on target row
  - `replace_array_item` → UPDATE JSONB array in target table

**Edit then accept:**
- User modifies the suggested value in UI
- Same flow as Accept but `resolved_value` = user's edited version
- `context_suggestions.resolved_value` preserves what was actually saved

**Reject:**
- `context_suggestions.status` → `rejected`
- No changes to target tables
- Rejection logged for pattern analysis (if user rejects same type repeatedly, AI should recalibrate)

### Auto-apply rules

Adaptation rules with `apply_mode = 'auto_apply'` bypass the suggestion pipeline:
- Trigger condition detected on sync
- Action applied directly to calendar (via Intervals.icu API)
- Logged to a separate `auto_adaptations` table for transparency
- Always surfaced in UI as "Coach applied this automatically" with undo option

---

## Session Review Flow

### Trigger
User clicks "Review session" on a completed workout tile. Session is synced from Intervals.icu.

### What gets injected
```javascript
const sessionReviewContext = {
  // The specific session
  session: {
    id: activity.id,
    date: activity.date,
    type: activity.type,
    planned_tss: event.tss,
    actual_tss: activity.tss,
    avg_power: activity.avg_power,
    normalized_power: activity.np,
    avg_hr: activity.avg_hr,
    cardiac_drift: activity.cardiac_drift,
    intervals: activity.intervals, // individual effort data
    duration_seconds: activity.elapsed_time
  },
  // Morning wellness data for that day
  wellness: wellness_cache[session.date],
  // Previous same-type session for comparison
  previous_same_type: session_notes.find(
    s => s.session_type === session.type && s.id !== session.id
  ),
  // Full system prompt (standard context)
  ...standardSystemPrompt
}
```

### What the AI does
1. Opens with an unprompted review — pacing, execution, HR response, comparison to previous
2. Invites athlete response ("how did it feel?")
3. Captures RPE and athlete notes conversationally
4. At end of review, generates `ai_summary` and `ai_flags`
5. Proposes `session_notes` write (always — this is semi-automatic for session reviews)
6. If patterns detected, proposes `training_patterns` update via standard suggestion pipeline

### Session notes write (semi-automatic)
Session notes from a review are treated as confirmed rather than suggested — the review *is* the note. After the review conversation:
- `session_notes` row is created/updated automatically
- `rpe`, `athlete_notes`, `ai_summary`, `ai_flags` all populated
- No suggestion card needed — user can edit directly in the session detail view

---

## Accessing Archived Context

When a user references an old session or time period in chat:

```
User: "Remember that bad long ride in April where my gut blew up?"

AI recognises: temporal reference to specific session type
AI response: "I don't have that in my active window — want me to look it up?"
User: "Yes"
```

Backend queries:
```javascript
// Search archived session notes
const archived = await supabase
  .from('session_notes')
  .select('*')
  .eq('user_id', userId)
  .eq('is_archived', true)
  .ilike('session_type', '%long%')
  .gte('session_date', '2025-04-01')
  .lte('session_date', '2025-04-30')

// Inject into next message context
```

Archived notes are fetched on demand and injected as additional context for that specific exchange. They do not re-enter the permanent active window.

---

## Intervals.icu Sync

### What gets synced

| Data | Intervals.icu endpoint | Supabase target | Frequency |
|------|----------------------|-----------------|-----------|
| Completed activities | `GET /api/v1/athlete/{id}/activities` | `session_notes` (metrics) | On webhook / every 15min |
| Wellness data | `GET /api/v1/athlete/{id}/wellness` | `wellness_cache` | Daily on wake |
| FTP / zones | `GET /api/v1/athlete/{id}/settings` | `athlete_profile` | Weekly / on manual refresh |
| Calendar events | `GET /api/v1/athlete/{id}/events` | Local calendar state | On webhook |

### Writing back to Intervals.icu

When AI proposes a plan adaptation (session swap, load reduction) and user accepts:

```javascript
// Update existing event
await intervalsApi.put(
  `/api/v1/athlete/${athleteId}/events/${eventId}`,
  {
    type: 'Ride',
    name: '90 min Z2 (adapted from threshold)',
    description: workout.description,
    workout_doc: buildWorkoutDoc(workout), // structured intervals format
    tss: workout.tss
  }
)
```

Intervals.icu then handles pushing the structured workout to Garmin/Wahoo/Zwift via the athlete's existing device sync settings. Endurance.OS never communicates directly with devices.

---

## Context Module Summary

| Module | Owner | AI can suggest | Storage pattern | In prompt |
|--------|-------|---------------|-----------------|-----------|
| Athlete Profile | User only | ✗ | Single row | Always |
| Coach Style | User only | ✗ | Single row | Always |
| Plan DNA | User + AI suggest | ✓ | Single row (field updates) | Always |
| Training Patterns | AI detect + user approve | ✓ | Append-only rows | Always (active only) |
| Adaptation Rules | User + AI suggest | ✓ | Multiple rows | Always (enabled only) |
| Race Goals | User + AI suggest | ✓ | Multiple rows (upcoming) | Always (upcoming only) |
| Fueling Strategy | User + AI suggest | ✓ | Single row | Always |
| Health & Injury | User + AI suggest | ✓ | Single row + history log | Always |
| Recovery Preferences | User + AI suggest | ✓ | Single row | Always |
| Session Notes | Auto (review conversation) | Triggers suggestions | Append rows, 28d active | Rolling 28d |
| Wellness Cache | Intervals.icu sync | ✗ | Daily rows, read-only | Today + 14d trend |
| Fitness Metrics | Intervals.icu sync | ✗ | Fields on athlete_profile | Always (via profile) |

---

## Supabase Row Level Security

All tables must have RLS enabled. Users can only read/write their own data.

```sql
-- Enable RLS on all context tables
ALTER TABLE athlete_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_style ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE adaptation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE fueling_strategy ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_injury ENABLE ROW LEVEL SECURITY;
ALTER TABLE injury_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellness_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- Standard user policy (repeat for each table)
CREATE POLICY "Users can only access own data"
ON athlete_profile
FOR ALL
USING (auth.uid() = user_id);
```

---

## Implementation Order

Build in this sequence to have a working system at each stage:

**Stage 1 — Foundation**
1. `users` table + Supabase auth
2. `athlete_profile` + `coach_style` tables
3. Basic system prompt assembly (just profile + coach style)
4. Coach sidebar wired to real AI API — basic chat works

**Stage 2 — Core context**
5. `plan_dna` table + UI
6. `race_goals` table + UI
7. `adaptation_rules` table + UI
8. All three added to system prompt — AI now has coaching context

**Stage 3 — Intelligence layer**
9. Intervals.icu sync — `wellness_cache` + fitness metrics on `athlete_profile`
10. `session_notes` table + session review flow
11. `training_patterns` table + suggestion pipeline
12. `context_suggestions` table + Memory Suggestions UI

**Stage 4 — Full system**
13. `fueling_strategy` + `health_injury` + `recovery_preferences` tables
14. Conversational injury entry flow
15. Write-back to Intervals.icu API (plan adaptations)
16. Archived session note retrieval
17. Auto-apply adaptation rules

---

*This document is the single source of truth for the Endurance.OS context system. All Supabase migrations, system prompt assembly code, and AI instruction layers should be derived from this spec.*
