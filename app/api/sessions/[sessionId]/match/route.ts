import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ sessionId: string }> }

// POST { plannedSessionId } — manually link a completed session to a planned one
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId } = await params
  const { plannedSessionId } = await req.json() as { plannedSessionId?: string }
  if (!plannedSessionId) return NextResponse.json({ error: 'plannedSessionId required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify both sessions belong to this user
  const { data: sessions } = await admin
    .from('session_notes')
    .select('session_id, actual_duration_seconds')
    .eq('user_id', user.id)
    .in('session_id', [sessionId, plannedSessionId])

  if (!sessions || sessions.length < 2) {
    return NextResponse.json({ error: 'Sessions not found' }, { status: 404 })
  }

  const completed = sessions.find(s => s.session_id === sessionId)
  const planned   = sessions.find(s => s.session_id === plannedSessionId)

  if (!completed || completed.actual_duration_seconds == null) {
    return NextResponse.json({ error: 'sessionId must be a completed session' }, { status: 400 })
  }
  if (!planned || planned.actual_duration_seconds != null) {
    return NextResponse.json({ error: 'plannedSessionId must be a planned session' }, { status: 400 })
  }

  const { error } = await admin
    .from('session_notes')
    .update({ matched_session_id: plannedSessionId, match_status: 'confirmed' })
    .eq('user_id', user.id)
    .eq('session_id', sessionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH { status: 'confirmed' | 'rejected' } — update match review status
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId } = await params
  const { status } = await req.json() as { status?: string }
  if (status !== 'confirmed' && status !== 'rejected') {
    return NextResponse.json({ error: 'status must be confirmed or rejected' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('session_notes')
    .update({ match_status: status })
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .not('matched_session_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — unlink (unmerge) a matched session
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId } = await params
  const admin = createAdminClient()
  const { error } = await admin
    .from('session_notes')
    .update({ matched_session_id: null, match_status: null })
    .eq('user_id', user.id)
    .eq('session_id', sessionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
