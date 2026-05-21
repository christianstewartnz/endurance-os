import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/app-shell'
import ContextView from '@/components/views/context-view'

export default async function ContextPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [
    profileRes,
    styleRes,
    planRes,
    patternsRes,
    rulesRes,
    racesRes,
    fuelingRes,
    healthRes,
    recoveryRes,
    suggestionsRes,
  ] = await Promise.all([
    admin.from('athlete_profile').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('coach_style').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('plan_dna').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('training_patterns').select('*').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false }),
    admin.from('adaptation_rules').select('*').eq('user_id', user.id).eq('enabled', true),
    admin.from('race_goals').select('*').eq('user_id', user.id).eq('status', 'upcoming').order('race_date', { ascending: true }),
    admin.from('fueling_strategy').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('health_injury').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('recovery_preferences').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('context_suggestions').select('*').eq('user_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }),
  ])

  return (
    <AppShell>
      <ContextView
        athleteProfile={profileRes.data}
        coachStyle={styleRes.data}
        planDna={planRes.data}
        trainingPatterns={patternsRes.data ?? []}
        adaptationRules={rulesRes.data ?? []}
        raceGoals={racesRes.data ?? []}
        fuelingStrategy={fuelingRes.data}
        healthInjury={healthRes.data}
        recoveryPreferences={recoveryRes.data}
        pendingSuggestions={suggestionsRes.data ?? []}
      />
    </AppShell>
  )
}
