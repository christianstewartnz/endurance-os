export const revalidate = 300

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createIntervalsClient } from '@/lib/intervals/client'
import AppShell from '@/components/app-shell'
import CalendarView from '@/components/views/calendar-view'
import type { WellnessCacheRow, SessionNoteRow, IntervalEvent } from '@/lib/intervals/types'

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getCurrentWindow() {
  const today = new Date()
  const dow = today.getDay()
  const topMonday = new Date(today)
  topMonday.setDate(today.getDate() - ((dow + 6) % 7))
  topMonday.setHours(0, 0, 0, 0)

  const windowEnd   = new Date(topMonday); windowEnd.setDate(topMonday.getDate() + 6)
  const windowStart = new Date(topMonday); windowStart.setDate(topMonday.getDate() - 21)

  return {
    windowStart: toDateStr(windowStart),
    windowEnd:   toDateStr(windowEnd),
    topMonday:   toDateStr(topMonday),
    todayStr:    toDateStr(today),
  }
}

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { windowStart, windowEnd, topMonday, todayStr } = getCurrentWindow()
  const admin = createAdminClient()

  const [sessionsResult, wellnessResult, userResult] = await Promise.all([
    admin
      .from('session_notes')
      .select('*')
      .eq('user_id', user.id)
      .gte('session_date', windowStart)
      .lte('session_date', windowEnd)
      .eq('is_archived', false)
      .order('session_date', { ascending: true }),
    admin
      .from('wellness_cache')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', windowStart)
      .lte('date', windowEnd)
      .order('date', { ascending: true }),
    admin
      .from('users')
      .select('intervals_api_key, intervals_athlete_id')
      .eq('id', user.id)
      .single(),
  ])

  let plannedEvents: IntervalEvent[] = []
  if (userResult.data?.intervals_api_key && userResult.data?.intervals_athlete_id) {
    try {
      const client = createIntervalsClient(
        userResult.data.intervals_api_key as string,
        userResult.data.intervals_athlete_id as string
      )
      const eventsStart = todayStr > windowStart ? todayStr : windowStart
      if (eventsStart <= windowEnd) {
        plannedEvents = await client.getCalendarEvents(eventsStart, windowEnd)
      }
    } catch {
      // not fatal
    }
  }

  return (
    <AppShell fullWidth>
      <CalendarView
        initialSessions={(sessionsResult.data ?? []) as SessionNoteRow[]}
        initialWellness={(wellnessResult.data ?? []) as WellnessCacheRow[]}
        initialPlannedEvents={plannedEvents}
        initialTopMonday={topMonday}
        todayStr={todayStr}
      />
    </AppShell>
  )
}
