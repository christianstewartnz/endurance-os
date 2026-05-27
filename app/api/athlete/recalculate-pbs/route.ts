import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePBs, mergePBs } from '@/lib/intervals/calculate-pbs'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const freshPBs = await calculatePBs(user.id)

  const { data: existing } = await admin
    .from('athlete_profile')
    .select('pbs')
    .eq('user_id', user.id)
    .maybeSingle()

  const mergedPBs = mergePBs(existing?.pbs ?? null, freshPBs)

  const { error } = await admin
    .from('athlete_profile')
    .update({ pbs: mergedPBs })
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, pbs: mergedPBs })
}
