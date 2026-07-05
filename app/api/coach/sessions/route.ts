import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createIntervalsClient } from '@/lib/intervals/client'

interface FuelingSuggestion {
  carb_g_per_hour?: number | null
  fluid_ml_per_hour?: number | null
  sodium_mg_per_hour?: number | null
  note?: string | null
}

interface SessionProposal {
  name: string
  type: string
  sport: string
  description: string
  duration_seconds: number
  estimated_tss: number
  intervals_format: string
  fueling_suggestion?: FuelingSuggestion | null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { proposal, date }: { proposal: SessionProposal; date: string } = body
  if (!proposal || !date) {
    return NextResponse.json({ error: 'proposal and date are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: userData } = await admin
    .from('users')
    .select('intervals_api_key, intervals_athlete_id')
    .eq('id', user.id)
    .single()

  const externalId = `endurance-os-ai-${date}-${user.id.slice(0, 8)}`
  let eventId: string | number | null = null

  if (userData?.intervals_api_key && userData?.intervals_athlete_id) {
    try {
      const client = createIntervalsClient(
        userData.intervals_api_key as string,
        userData.intervals_athlete_id as string,
      )
      const events = await client.createOrUpdateEvents([
        {
          category: 'WORKOUT',
          start_date_local: `${date}T00:00:00`,
          type: proposal.type,
          name: proposal.name,
          description: proposal.intervals_format,
          icu_training_load: proposal.estimated_tss,
          external_id: externalId,
        },
      ])
      eventId = events[0]?.id ?? null
    } catch (err) {
      console.error('[coach/sessions] Intervals write failed:', err)
      // Non-fatal — still save to session_notes
    }
  }

  const fueling = proposal.fueling_suggestion
  const fuelingFields = fueling ? {
    fueling_carb_g_per_hour: fueling.carb_g_per_hour ?? null,
    fueling_fluid_ml_per_hour: fueling.fluid_ml_per_hour ?? null,
    fueling_sodium_mg_per_hour: fueling.sodium_mg_per_hour ?? null,
    fueling_note: fueling.note ?? null,
  } : {}

  // Save to session_notes as a planned session
  const { error: insertError } = await admin.from('session_notes').insert({
    user_id: user.id,
    session_id: externalId,
    session_date: date,
    session_type: proposal.sport,
    sport: proposal.sport,
    planned_tss: proposal.estimated_tss,
    planned_duration_seconds: proposal.duration_seconds,
    is_archived: false,
    ...fuelingFields,
  })

  if (insertError) {
    console.error('[coach/sessions] session_notes insert error:', insertError)
  }

  return NextResponse.json({ success: true, eventId, externalId })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { date }: { date: string } = body
  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: userData } = await admin
    .from('users')
    .select('intervals_api_key, intervals_athlete_id')
    .eq('id', user.id)
    .single()

  const externalId = `endurance-os-ai-${date}-${user.id.slice(0, 8)}`

  if (userData?.intervals_api_key && userData?.intervals_athlete_id) {
    try {
      const client = createIntervalsClient(
        userData.intervals_api_key as string,
        userData.intervals_athlete_id as string,
      )
      const events = await client.getCalendarEvents(date, date)
      const target = events.find((e) => e.external_id === externalId)
      if (target?.id) {
        await client.deleteEventById(target.id)
      }
    } catch (err) {
      console.error('[coach/sessions] Intervals delete failed:', err)
    }
  }

  await admin.from('session_notes')
    .delete()
    .eq('user_id', user.id)
    .eq('session_id', externalId)

  return NextResponse.json({ success: true })
}
