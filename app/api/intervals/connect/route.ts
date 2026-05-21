import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncAll } from '@/lib/intervals/sync'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const apiKey = body?.api_key?.trim()
  const athleteId = body?.athlete_id?.trim()

  if (!apiKey || !athleteId) {
    return NextResponse.json({ error: 'api_key and athlete_id are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Upsert credentials — handles the case where public.users row doesn't exist yet
  const { error: updateError } = await admin
    .from('users')
    .upsert({
      id: user.id,
      email: user.email ?? '',
      intervals_api_key: apiKey,
      intervals_athlete_id: athleteId,
      intervals_connection_invalid: false,
    }, { onConflict: 'id' })

  if (updateError) {
    console.error('[intervals] connect update error', updateError)
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 })
  }

  // Trigger initial sync
  const result = await syncAll(user.id)

  const { data: userData } = await admin
    .from('users')
    .select('last_intervals_sync')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    success: result.success,
    errors: result.errors,
    synced_at: userData?.last_intervals_sync ?? new Date().toISOString(),
  })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  await admin
    .from('users')
    .update({
      intervals_api_key: null,
      intervals_athlete_id: null,
      intervals_connection_invalid: false,
      last_intervals_sync: null,
    })
    .eq('id', user.id)

  return NextResponse.json({ success: true })
}
