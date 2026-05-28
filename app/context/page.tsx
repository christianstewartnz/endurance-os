export const revalidate = 300

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
    admin.from('adaptation_rules').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
    admin.from('race_goals').select('*').eq('user_id', user.id).eq('status', 'upcoming').order('race_date', { ascending: true }),
    admin.from('fueling_strategy').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('health_injury').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('recovery_preferences').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('context_suggestions').select('*').eq('user_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }),
  ])

  // Auto-archive duplicate training patterns (keep most recent per pattern_text)
  if (patternsRes.data && patternsRes.data.length > 0) {
    const seen = new Set<string>()
    const toArchive: string[] = []
    for (const p of patternsRes.data) {
      const text = String(p.pattern_text ?? '')
      if (seen.has(text)) {
        toArchive.push(String(p.id))
      } else {
        seen.add(text)
      }
    }
    if (toArchive.length > 0) {
      await admin.from('training_patterns').update({ status: 'archived' }).in('id', toArchive)
    }
  }

  const seenTexts = new Set<string>()
  const activePatterns = (patternsRes.data ?? []).filter((p) => {
    const text = String(p.pattern_text ?? '')
    if (seenTexts.has(text)) return false
    seenTexts.add(text)
    return true
  })

  return (
    <AppShell>
      <ContextView
        athleteProfile={profileRes.data}
        coachStyle={styleRes.data}
        planDna={planRes.data}
        trainingPatterns={activePatterns}
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
