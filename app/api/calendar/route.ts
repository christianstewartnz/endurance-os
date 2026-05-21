import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createIntervalsClient } from '@/lib/intervals/client'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const start = searchParams.get('start')
  const end   = searchParams.get('end')
  if (!start || !end) {
    return NextResponse.json({ error: 'Missing start or end param' }, { status: 400 })
  }

  const admin = createAdminClient()

  const [sessionsResult, wellnessResult, userResult] = await Promise.all([
    admin
      .from('session_notes')
      .select('*')
      .eq('user_id', user.id)
      .gte('session_date', start)
      .lte('session_date', end)
      .eq('is_archived', false)
      .order('session_date', { ascending: true }),
    admin
      .from('wellness_cache')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true }),
    admin
      .from('users')
      .select('intervals_api_key, intervals_athlete_id')
      .eq('id', user.id)
      .single(),
  ])

  // Fetch planned events for future dates only
  let plannedEvents: unknown[] = []
  const todayStr = new Date().toISOString().split('T')[0]
  if (userResult.data?.intervals_api_key && userResult.data?.intervals_athlete_id) {
    try {
      const client = createIntervalsClient(
        userResult.data.intervals_api_key as string,
        userResult.data.intervals_athlete_id as string
      )
      const eventsStart = todayStr > start ? todayStr : start
      if (eventsStart <= end) {
        plannedEvents = await client.getCalendarEvents(eventsStart, end)
      }
    } catch {
      // not fatal
    }
  }

  return NextResponse.json({
    sessions:      sessionsResult.data  ?? [],
    wellness:      wellnessResult.data  ?? [],
    plannedEvents,
  })
}
