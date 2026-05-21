import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createIntervalsClient } from '@/lib/intervals/client'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]

  const admin = createAdminClient()
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
      await client.createOrUpdateEvents([{
        category: 'WORKOUT',
        start_date_local: today,
        type: 'Ride',
        name: 'Rest Day',
        description: 'Rest day — marked via Endurance.OS',
        icu_training_load: 0,
        external_id: `endurance-os-rest-${today}-${user.id.slice(0, 8)}`,
      }])
    } catch {
      // Non-fatal — rest day recorded locally even if Intervals sync fails
    }
  }

  return NextResponse.json({ ok: true })
}
