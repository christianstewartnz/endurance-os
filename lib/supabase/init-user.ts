import type { SupabaseClient } from '@supabase/supabase-js'

export async function initUser(
  supabase: SupabaseClient,
  userId: string,
  email: string
) {
  const inserts = await Promise.allSettled([
    supabase
      .from('users')
      .upsert({ id: userId, email }, { onConflict: 'id' }),

    supabase
      .from('athlete_profile')
      .upsert({ user_id: userId }, { onConflict: 'user_id' }),

    supabase.from('coach_style').upsert(
      {
        user_id: userId,
        tone: 'direct',
        reply_length: 'short',
        praise_level: 'minimal',
        challenge_mode: 'when_data_conflicts',
      },
      { onConflict: 'user_id' }
    ),

    supabase
      .from('plan_dna')
      .upsert({ user_id: userId }, { onConflict: 'user_id' }),

    supabase
      .from('fueling_strategy')
      .upsert({ user_id: userId }, { onConflict: 'user_id' }),

    supabase.from('health_injury').upsert(
      { user_id: userId },
      { onConflict: 'user_id' }
    ),

    supabase.from('recovery_preferences').upsert(
      {
        user_id: userId,
        sleep_target_hours: 7.5,
        deload_frequency_weeks: 4,
        deload_load_percent: 60,
      },
      { onConflict: 'user_id' }
    ),
  ])

  const tables = [
    'users',
    'athlete_profile',
    'coach_style',
    'plan_dna',
    'fueling_strategy',
    'health_injury',
    'recovery_preferences',
  ]

  inserts.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`initUser: ${tables[i]} upsert rejected`, result.reason)
    } else if (result.value.error) {
      console.error(`initUser: ${tables[i]} upsert error`, result.value.error)
    }
  })
}
