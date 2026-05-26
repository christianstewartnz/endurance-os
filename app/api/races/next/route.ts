import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]
  const admin = createAdminClient()

  const { data } = await admin
    .from('race_goals')
    .select('id, race_name, race_date, priority')
    .eq('user_id', user.id)
    .eq('status', 'upcoming')
    .gte('race_date', today)
    .order('race_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ race: data ?? null })
}
