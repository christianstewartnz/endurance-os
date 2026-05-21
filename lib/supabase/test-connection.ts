import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  const { data, error } = await supabase.from('users').select('id').limit(1)

  if (error) {
    console.error('Connection failed:', error.message)
    process.exit(1)
  }

  console.log('Connection OK — users table accessible, row count sample:', data?.length ?? 0)
}

main()
