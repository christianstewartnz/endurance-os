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

  // Check if today's wellness is already cached
  const { data: todayCheck } = await admin
    .from('wellness_cache')
    .select('date')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle()

  // Auto-sync wellness if we don't have today's record
  if (!todayCheck) {
    try {
      await syncWellness(user.id)
    } catch {
      // Non-fatal — dashboard renders empty state if no data
    }
  }

  // Fetch last 14 days of wellness for sparklines + today's record
  const oldest14d = daysAgoStr(13)
  const { data: wellness14d } = await admin
    .from('wellness_cache')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', oldest14d)
    .lte('date', today)
    .order('date', { ascending: true })

  const wellnessToday = (wellness14d ?? []).find((w) => w.date === today) ?? null

  // Fetch this week's completed sessions
  const { monday, sunday } = getCurrentWeekBounds()
  const { data: weekSessions } = await admin
    .from('session_notes')
    .select('*')
    .eq('user_id', user.id)
    .gte('session_date', monday)
    .lte('session_date', sunday)
    .eq('is_archived', false)
    .order('session_date', { ascending: true })

  // Fetch planned calendar events from Intervals.icu (live, server-side only)
  let weekEvents: IntervalEvent[] = []
  const { data: userData } = await admin
    .from('users')
    .select('intervals_api_key, intervals_athlete_id')
    .eq('id', user.id)
    .single()

  if (userData?.intervals_api_key && userData?.intervals_athlete_id) {
    try {
      const client = createIntervalsClient(
        userData.intervals_api_key as string,
        userData.intervals_athlete_id as string
      )
      weekEvents = await client.getCalendarEvents(monday, sunday)
    } catch {
      // Not fatal — WeekStrip renders with completed sessions only
    }
  }

  const hasIntervalsConnected = !!(userData?.intervals_api_key && userData?.intervals_athlete_id)

  const todayEvent = weekEvents.find((e) => e.start_date_local.startsWith(today)) ?? null
  const todaySession = ((weekSessions ?? []) as SessionNoteRow[]).find((s) => s.session_date === today) ?? null

  return (
    <AppShell>
      <DashboardView
        wellnessToday={wellnessToday as WellnessCacheRow | null}
        wellness14d={(wellness14d ?? []) as WellnessCacheRow[]}
        weekSessions={(weekSessions ?? []) as SessionNoteRow[]}
        weekEvents={weekEvents}
        hasIntervalsConnected={hasIntervalsConnected}
        todayEvent={todayEvent}
        todaySession={todaySession}
      />
    </AppShell>
  )
}
