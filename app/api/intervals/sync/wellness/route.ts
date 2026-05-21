import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncWellness } from '@/lib/intervals/sync'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await syncWellness(user.id)

  return NextResponse.json({ success: true, synced_at: new Date().toISOString() })
}
