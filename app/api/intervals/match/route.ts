import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runActivityMatching } from '@/lib/intervals/matching'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await runActivityMatching(user.id)
  return NextResponse.json({ ok: true })
}
