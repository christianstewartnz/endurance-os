import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface ContextTag {
  tag: string
  label: string
  description: string
  icon: string
  group: 'context' | 'today' | 'sessions' | 'races'
  available: boolean
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const uid = user.id
  const today = new Date().toISOString().split('T')[0]
  const ago28 = new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0]

  const [
    athleteRes,
    planRes,
    patternsRes,
    rulesRes,
    racesRes,
    illnessesRes,
    injuriesRes,
    fuelingRes,
    recoveryRes,
    wellnessRes,
    sessionsRes,
  ] = await Promise.all([
    admin.from('athlete_profile').select('name').eq('user_id', uid).maybeSingle(),
    admin.from('plan_dna').select('philosophy').eq('user_id', uid).maybeSingle(),
    admin.from('training_patterns').select('id').eq('user_id', uid).eq('status', 'active'),
    admin.from('adaptation_rules').select('id').eq('user_id', uid).eq('enabled', true),
    admin.from('race_goals').select('race_name, race_date').eq('user_id', uid).eq('status', 'upcoming').order('race_date', { ascending: true }),
    admin.from('illnesses').select('id').eq('user_id', uid).is('date_cleared', null),
    admin.from('injuries').select('id').eq('user_id', uid).is('date_cleared', null),
    admin.from('fueling_strategy').select('user_id').eq('user_id', uid).maybeSingle(),
    admin.from('recovery_preferences').select('user_id').eq('user_id', uid).maybeSingle(),
    admin.from('wellness_cache').select('hrv_rmssd, hrv_delta_14d_percent, tsb').eq('user_id', uid).eq('date', today).maybeSingle(),
    admin.from('session_notes').select('sport, session_date, actual_duration_seconds, avg_power_watts').eq('user_id', uid).gte('session_date', ago28).eq('is_archived', false).order('session_date', { ascending: false }),
  ])

  const tags: ContextTag[] = []

  // ── Context module tags ──────────────────────────────────────────────────
  tags.push({
    tag: '@athlete',
    label: 'Athlete Profile',
    description: athleteRes.data?.name ? `${athleteRes.data.name}` : 'Your athlete profile',
    icon: 'user',
    group: 'context',
    available: true,
  })

  if (planRes.data?.philosophy) {
    tags.push({
      tag: '@plandna',
      label: 'Plan DNA',
      description: String(planRes.data.philosophy).slice(0, 60),
      icon: 'git-branch',
      group: 'context',
      available: true,
    })
  }

  const activePatternCount = patternsRes.data?.length ?? 0
  if (activePatternCount > 0) {
    tags.push({
      tag: '@patterns',
      label: 'Training Patterns',
      description: `${activePatternCount} active pattern${activePatternCount !== 1 ? 's' : ''}`,
      icon: 'chart-line-up',
      group: 'context',
      available: true,
    })
  }

  const enabledRuleCount = rulesRes.data?.length ?? 0
  if (enabledRuleCount > 0) {
    tags.push({
      tag: '@rules',
      label: 'Adaptation Rules',
      description: `${enabledRuleCount} enabled rule${enabledRuleCount !== 1 ? 's' : ''}`,
      icon: 'sliders',
      group: 'context',
      available: true,
    })
  }

  const hasHealth =
    (illnessesRes.data?.length ?? 0) > 0 ||
    (injuriesRes.data?.length ?? 0) > 0
  if (hasHealth) {
    tags.push({
      tag: '@health',
      label: 'Health & Injury',
      description: 'Active injuries or illnesses',
      icon: 'first-aid',
      group: 'context',
      available: true,
    })
  }

  if (fuelingRes.data) {
    tags.push({
      tag: '@fueling',
      label: 'Fueling Strategy',
      description: 'Nutrition & hydration plan',
      icon: 'fork-knife',
      group: 'context',
      available: true,
    })
  }

  if (recoveryRes.data) {
    tags.push({
      tag: '@recovery',
      label: 'Recovery Preferences',
      description: 'Sleep, deload, HRV settings',
      icon: 'moon',
      group: 'context',
      available: true,
    })
  }

  // ── Today tags ────────────────────────────────────────────────────────────
  if (wellnessRes.data) {
    const { hrv_rmssd, hrv_delta_14d_percent, tsb } = wellnessRes.data as {
      hrv_rmssd: number | null
      hrv_delta_14d_percent: number | null
      tsb: number | null
    }
    if (hrv_rmssd != null) {
      const delta = hrv_delta_14d_percent != null
        ? ` · ${hrv_delta_14d_percent > 0 ? '+' : ''}${Math.round(hrv_delta_14d_percent)}% vs baseline`
        : ''
      tags.push({
        tag: '@todayshrv',
        label: "Today's HRV",
        description: `${Math.round(hrv_rmssd)}ms${delta}`,
        icon: 'heart',
        group: 'today',
        available: true,
      })
    }
    tags.push({
      tag: '@readiness',
      label: 'Readiness Snapshot',
      description: tsb != null ? `TSB ${tsb > 0 ? '+' : ''}${Math.round(tsb)}` : 'Full readiness snapshot',
      icon: 'lightning',
      group: 'today',
      available: true,
    })
    if (tsb != null) {
      tags.push({
        tag: '@form',
        label: 'Form (TSB)',
        description: `TSB ${tsb > 0 ? '+' : ''}${Math.round(tsb)}`,
        icon: 'trend-up',
        group: 'today',
        available: true,
      })
    }
  }

  tags.push({
    tag: '@thisweek',
    label: 'This Week',
    description: 'Current week training summary',
    icon: 'calendar',
    group: 'today',
    available: true,
  })

  // ── Session tags ─────────────────────────────────────────────────────────
  const sessions = sessionsRes.data ?? []
  if (sessions.length > 0) {
    const last = sessions[0] as { sport: string; session_date: string; actual_duration_seconds: number | null; avg_power_watts: number | null }
    tags.push({
      tag: '@lastsession',
      label: 'Last Session',
      description: `${last.session_date} · ${last.sport}`,
      icon: 'activity',
      group: 'sessions',
      available: true,
    })

    tags.push({
      tag: '@last7days',
      label: 'Last 7 Days',
      description: `${sessions.filter((s: { session_date: string }) => s.session_date >= new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]).length} sessions`,
      icon: 'calendar-blank',
      group: 'sessions',
      available: true,
    })

    tags.push({
      tag: '@last28days',
      label: 'Last 28 Days',
      description: `${sessions.length} sessions`,
      icon: 'calendar-dots',
      group: 'sessions',
      available: true,
    })

    const sports = new Set(sessions.map((s: { sport: string }) => s.sport))
    const sportTagMap: Record<string, { tag: string; label: string; icon: string }> = {
      cycling: { tag: '@lastride', label: 'Last Ride', icon: 'bicycle' },
      running: { tag: '@lastrun', label: 'Last Run', icon: 'sneaker-move' },
      swimming: { tag: '@lastswim', label: 'Last Swim', icon: 'waves' },
    }
    for (const sport of ['cycling', 'running', 'swimming']) {
      if (!sports.has(sport)) continue
      const last = sessions.find((s: { sport: string; session_date: string; actual_duration_seconds: number | null; avg_power_watts: number | null }) => s.sport === sport) as { sport: string; session_date: string; actual_duration_seconds: number | null; avg_power_watts: number | null } | undefined
      if (!last) continue
      const info = sportTagMap[sport]
      const dur = last.actual_duration_seconds
        ? `${Math.floor(last.actual_duration_seconds / 3600)}h ${Math.round((last.actual_duration_seconds % 3600) / 60)}m`
        : null
      const power = last.avg_power_watts ? `${Math.round(last.avg_power_watts)}W` : null
      const desc = [last.session_date, dur, power].filter(Boolean).join(' · ')
      tags.push({
        tag: info.tag,
        label: info.label,
        description: desc,
        icon: info.icon,
        group: 'sessions',
        available: true,
      })
    }
  }

  // ── Race tags ─────────────────────────────────────────────────────────────
  for (const race of racesRes.data ?? []) {
    const r = race as { race_name: string; race_date: string }
    tags.push({
      tag: `@${toSlug(r.race_name)}`,
      label: r.race_name,
      description: r.race_date,
      icon: 'flag',
      group: 'races',
      available: true,
    })
  }

  return NextResponse.json({ tags })
}
