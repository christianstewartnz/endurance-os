import { createClient } from '@supabase/supabase-js'

// Service-role client — never use client-side, bypasses RLS.
// Required for webhook handlers and background jobs that have no user session.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
