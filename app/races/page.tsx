import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/app-shell'
import RacesView from '@/components/views/races-view'
import type { RaceGoal, ContextSuggestion } from '@/components/views/races-view'

export default async function RacesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const admin = createAdminClient()

  const [racesRes, suggestionsRes] = await Promise.all([
    admin
      .from('race_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('race_date', { ascending: true }),
    admin
      .from('context_suggestions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .eq('target_module', 'race_goals'),
  ])

  const allRaces = (racesRes.data ?? []) as RaceGoal[]
  const pendingSuggestions = (suggestionsRes.data ?? []) as ContextSuggestion[]

  const upcoming = allRaces.filter(
    (r) => r.race_date >= today && r.status !== 'completed',
  )
  const past = allRaces.filter(
    (r) => r.race_date < today || r.status === 'completed',
  )
  const aRace = upcoming.find((r) => r.priority === 'A') ?? null

  return (
    <AppShell>
      <RacesView
        upcoming={upcoming}
        past={past}
        aRace={aRace}
        pendingSuggestions={pendingSuggestions}
      />
    </AppShell>
  )
}
