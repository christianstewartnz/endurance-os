import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('anthropic_api_key')
    .eq('id', user.id)
    .single()

  const key = data?.anthropic_api_key as string | null
  if (!key) return NextResponse.json({ connected: false, last4: null })

  const verify = new URL(req.url).searchParams.get('verify') === 'true'
  if (verify) {
    try {
      const testRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })
      if (!testRes.ok) {
        const err = await testRes.json().catch(() => ({}))
        const msg = (err as { error?: { message?: string } }).error?.message ?? 'Key is invalid or expired'
        return NextResponse.json({ connected: true, last4: key.slice(-4), valid: false, error: msg })
      }
    } catch {
      return NextResponse.json({ connected: true, last4: key.slice(-4), valid: false, error: 'Could not reach Anthropic API' })
    }
    return NextResponse.json({ connected: true, last4: key.slice(-4), valid: true })
  }

  return NextResponse.json({ connected: true, last4: key.slice(-4) })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const key: string = body?.key?.trim() ?? ''

  if (!key.startsWith('sk-ant-')) {
    return NextResponse.json({ success: false, error: 'Key must start with sk-ant-' }, { status: 400 })
  }

  // Test the key with a minimal Anthropic API call
  try {
    const testRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })
    if (!testRes.ok) {
      const err = await testRes.json().catch(() => ({}))
      const msg = (err as { error?: { message?: string } }).error?.message ?? 'Invalid API key'
      return NextResponse.json({ success: false, error: msg }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Could not reach Anthropic API' }, { status: 502 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('users')
    .update({ anthropic_api_key: key })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ success: false, error: 'Failed to save key' }, { status: 500 })
  }

  return NextResponse.json({ success: true, verified: true, last4: key.slice(-4) })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  await admin
    .from('users')
    .update({ anthropic_api_key: null })
    .eq('id', user.id)

  return NextResponse.json({ success: true })
}
