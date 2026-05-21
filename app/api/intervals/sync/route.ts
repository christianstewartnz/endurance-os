import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncAll } from '@/lib/intervals/sync'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: userData } = await admin
    .from('users')
    .select('intervals_api_key')
    .eq('id', user.id)
    .single()

  if (!userData?.intervals_api_key) {
    return NextResponse.json({ error: 'Intervals.icu not connected' }, { status: 400 })
  }

  const result = await syncAll(user.id)

  return NextResponse.json({
    success: result.success,
    errors: result.errors,
    synced_at: new Date().toISOString(),
  })
}
