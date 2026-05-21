import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncActivities, syncFitnessMetrics } from '@/lib/intervals/sync'

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secret = req.headers.get('x-intervals-webhook-secret')
  if (secret !== process.env.INTERVALS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Acknowledge immediately — process async so Intervals doesn't time out
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  const { event_type, athlete_id } = body as {
    event_type?: string
    athlete_id?: string
  }

  if (!athlete_id) return NextResponse.json({ ok: true })

  // Look up the internal userId from the intervals_athlete_id
  const admin = createAdminClient()
  const { data: userData } = await admin
    .from('users')
    .select('id')
    .eq('intervals_athlete_id', String(athlete_id))
    .single()

  if (!userData?.id) return NextResponse.json({ ok: true })

  const userId = userData.id as string

  // Handle event types without blocking the response
  void (async () => {
    try {
      if (event_type === 'ACTIVITY_ANALYZED') {
        await syncActivities(userId)
      } else if (event_type === 'SPORT_SETTINGS_UPDATED') {
        await syncFitnessMetrics(userId)
      } else if (event_type === 'CALENDAR_UPDATED') {
        // Calendar events are fetched live on dashboard load; nothing to cache here yet.
        console.log('[intervals] webhook CALENDAR_UPDATED for', userId)
      }
    } catch (err) {
      console.error('[intervals] webhook processing error', err)
    }
  })()

  return NextResponse.json({ ok: true })
}
