'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { initUser } from '@/lib/supabase/init-user'

export async function loginAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  if (data.user) {
    await initUser(supabase, data.user.id, data.user.email ?? email)
  }

  redirect('/dashboard')
}

export async function signupAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return { error: error.message }
  }

  if (data.user) {
    await initUser(supabase, data.user.id, email)
  }

  redirect('/dashboard')
}

export async function signoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
