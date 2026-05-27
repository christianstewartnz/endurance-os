export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncAll } from '@/lib/intervals/sync'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[cron] Daily sync started:', new Date().toISOString())

  const supabase = createAdminClient()

  const { data: users, error } = await supabase
    .from('users')
    .select('id, intervals_athlete_id, intervals_api_key')
    .not('intervals_api_key', 'is', null)
    .not('intervals_athlete_id', 'is', null)

  if (error) {
    console.error('[cron] Failed to fetch users:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[cron] Syncing', users?.length, 'users')

  const results = []

  for (const user of users ?? []) {
    try {
      console.log('[cron] Syncing user:', user.id)
      await syncAll(user.id)
      results.push({ userId: user.id, status: 'success' })
      console.log('[cron] Sync complete for user:', user.id)
    } catch (e: any) {
      console.error('[cron] Sync failed for user:', user.id, e.message)
      results.push({ userId: user.id, status: 'error', error: e.message })
    }
  }

  console.log('[cron] Daily sync complete:', results)

  return NextResponse.json({
    success: true,
    synced: results.length,
    results,
  })
}
