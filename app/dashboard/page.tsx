export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createIntervalsClient } from '@/lib/intervals/client'
import { syncWellness } from '@/lib/intervals/sync'
import AppShell from '@/components/app-shell'
import DashboardView from '@/components/views/dashboard-view'
import type { WellnessCacheRow, SessionNoteRow, IntervalEvent } from '@/lib/intervals/types'

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function daysAgoStr(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0]
}

function shiftDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

function getCurrentWeekBounds(): { monday: string; sunday: string } {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon…
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    monday: monday.toISOString().split('T')[0],
    sunday: sunday.toISOString().split('T')[0],
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const today = todayStr()
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const oldest14d = daysAgoStr(13)
  // Extend week bounds by 1 day each side so UTC+12/+13 users (e.g. NZ) are
  // covered when their local "today" is a day ahead of UTC.
  const { monday, sunday } = getCurrentWeekBounds()
  const sessionFrom = shiftDateStr(monday, -1)
  const sessionTo   = shiftDateStr(sunday, 1)

  // Check if today's wellness is already cached
  const { data: todayCheck } = await admin
    .from('wellness_cache')
    .select('date')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle()

  if (!todayCheck) {
    try { await syncWellness(user.id) } catch { /* non-fatal */ }
  }

  // Fetch all dashboard data in parallel
  const [wellness14dResult, weekSessionsResult, userDataResult, recentSessionsResult] = await Promise.all([
    admin
      .from('wellness_cache')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', oldest14d)
      .lte('date', today)
      .order('date', { ascending: true }),
    admin
      .from('session_notes')
      .select('*')
      .eq('user_id', user.id)
      .gte('session_date', sessionFrom)
      .lte('session_date', sessionTo)
      .eq('is_archived', false)
      .order('session_date', { ascending: true }),
    admin
      .from('users')
      .select('intervals_api_key, intervals_athlete_id')
      .eq('id', user.id)
      .single(),
    admin
      .from('session_notes')
      .select('*')
      .eq('user_id', user.id)
      .in('session_date', [today, yesterday])
      .order('session_date', { ascending: false })
      .limit(2),
  ])

  const wellness14d = wellness14dResult.data
  const weekSessions = weekSessionsResult.data
  const userData = userDataResult.data
  const recentSessions = recentSessionsResult.data

  const wellnessToday = (wellness14d ?? []).find((w) => w.date === today) ?? null
  const hasIntervalsConnected = !!(userData?.intervals_api_key && userData?.intervals_athlete_id)

  // Fetch planned calendar events from Intervals.icu (depends on userData credentials)
  let weekEvents: IntervalEvent[] = []
  if (userData?.intervals_api_key && userData?.intervals_athlete_id) {
    try {
      const client = createIntervalsClient(
        userData.intervals_api_key as string,
        userData.intervals_athlete_id as string
      )
      weekEvents = await client.getCalendarEvents(sessionFrom, sessionTo)
    } catch { /* not fatal — WeekStrip renders with completed sessions only */ }
  }

  return (
    <AppShell>
      <DashboardView
        wellnessToday={wellnessToday as WellnessCacheRow | null}
        wellness14d={(wellness14d ?? []) as WellnessCacheRow[]}
        weekSessions={(weekSessions ?? []) as SessionNoteRow[]}
        weekEvents={weekEvents}
        hasIntervalsConnected={hasIntervalsConnected}
        recentSessions={(recentSessions ?? []) as SessionNoteRow[]}
      />
    </AppShell>
  )
}
