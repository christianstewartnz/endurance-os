export const revalidate = 300

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/app-shell'
import SettingsView from '@/components/views/settings-view'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: userData }, { data: athleteData }] = await Promise.all([
    admin
      .from('users')
      .select('intervals_athlete_id, intervals_api_key, last_intervals_sync, intervals_connection_invalid, anthropic_api_key')
      .eq('id', user.id)
      .single(),
    admin
      .from('athlete_profile')
      .select('name, location')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const intervalsConnection = {
    isConnected: !!(userData?.intervals_api_key && userData?.intervals_athlete_id),
    athleteId: (userData?.intervals_athlete_id as string | null) ?? null,
    lastSyncedAt: (userData?.last_intervals_sync as string | null) ?? null,
    isInvalid: !!(userData?.intervals_connection_invalid),
  }

  const anthropicKey = (userData?.anthropic_api_key as string | null) ?? null
  const anthropicKeyState = {
    connected: !!anthropicKey,
    last4: anthropicKey ? anthropicKey.slice(-4) : null,
  }

  const userEmail = user.email ?? null
  const displayName = user.user_metadata?.full_name as string | undefined

  return (
    <AppShell userName={displayName ?? userEmail ?? undefined} userEmail={userEmail ?? undefined}>
      <SettingsView
        intervalsConnection={intervalsConnection}
        anthropicKeyState={anthropicKeyState}
        userEmail={userEmail}
        athleteProfile={athleteData ? { name: athleteData.name as string | null, location: athleteData.location as string | null } : null}
      />
    </AppShell>
  )
}
