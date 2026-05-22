import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSystemPrompt } from '@/lib/ai/build-system-prompt'

const MODEL = 'claude-sonnet-4-20250514'

function isValidUUID(str: string | undefined): str is string {
  if (!str) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

const SESSION_CREATION_OVERLAY = `
════════════════════════════════════════
SESSION CREATION MODE
════════════════════════════════════════

The athlete wants to create a training session. Help them build a session that fits their training context. Consider today's readiness, their current phase, and any adaptation rules before recommending intensity.

When you have enough information, present the session in this exact JSON format at the end of your message:
{
  "session_proposal": {
    "name": "string — session name",
    "type": "Ride | Run | Swim | WeightTraining",
    "sport": "cycling | running | swimming | strength",
    "description": "string — Intervals.icu workout format",
    "duration_seconds": 0,
    "estimated_tss": 0,
    "intervals_format": "string — same as description"
  }
}

Always explain your reasoning before presenting the proposal. Wait for acceptance before writing to the calendar.
`

const INJURY_OVERLAY = `
════════════════════════════════════════
INJURY PROTOCOL ACTIVE
════════════════════════════════════════

The athlete has reported an injury or health issue. Follow this process:

1. Acknowledge and gather full information conversationally:
   - What body part / what happened
   - Medical guidance received (physio, doctor, etc.)
   - Specific restrictions (no running / no impact / etc.)
   - What they CAN do: cycling, swimming, strength, upper body
   - Timeline for return

2. Once you have full context, propose TWO context updates:
   a. Update to health_injury.active_injuries (the injury record)
   b. Proposed plan adaptations (which sessions to modify/remove)

3. Propose plan adaptations via Intervals.icu calendar update (presented as a separate suggestion for user to accept)

4. Do not catastrophise. Be matter-of-fact. Give the athlete a clear picture of what training looks like during this period.
`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: userData } = await admin
    .from('users')
    .select('anthropic_api_key')
    .eq('id', user.id)
    .single()

  const anthropicKey = userData?.anthropic_api_key as string | null
  if (!anthropicKey) {
    return NextResponse.json({ error: 'no_api_key' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const {
    messages,
    conversationId,
    contextType = 'general',
    sessionId,
  }: {
    messages: ChatMessage[]
    conversationId?: string
    contextType?: 'general' | 'session_review' | 'session_creation' | 'injury'
    sessionId?: string
  } = body

  let systemPrompt = await buildSystemPrompt(user.id)
  const maxTokens = contextType === 'session_creation' ? 2048 : 1024

  if (contextType === 'session_review' && sessionId) {
    const { data: session } = await admin
      .from('session_notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .maybeSingle()

    if (session) {
      const s = session as Record<string, unknown>
      const sessionOverlay = `
════════════════════════════════════════
SESSION UNDER REVIEW
════════════════════════════════════════

Session: ${s.session_type ?? 'Workout'} · ${s.session_date}
Type: ${s.session_type ?? '—'} · Sport: ${s.sport ?? '—'}

Actuals (from Intervals.icu):
  Duration: ${s.actual_duration_seconds ? `${Math.floor((s.actual_duration_seconds as number) / 60)}min` : '—'} · TSS: ${s.actual_tss ?? '—'}
  Avg power: ${s.avg_power_watts ? `${s.avg_power_watts}W` : '—'} · Normalized power: ${s.normalized_power_watts ? `${s.normalized_power_watts}W` : '—'}
  Avg HR: ${s.avg_hr ? `${s.avg_hr}bpm` : '—'} · Max HR: ${s.max_hr ? `${s.max_hr}bpm` : '—'}
  Cardiac drift: ${s.cardiac_drift_percent ? `+${s.cardiac_drift_percent}%` : '—'}
  RPE: ${s.rpe ?? '—'}

Your task for this review:
  1. Open with an unprompted analysis — pacing, HR response, drift, execution
  2. Ask how it felt (capture RPE and athlete notes)
  3. Note any patterns worth saving to Training Patterns
  4. At end of review, propose session_notes write with ai_summary and ai_flags
  5. If a training pattern is confirmed, propose context update via JSON block
════════════════════════════════════════`
      systemPrompt += sessionOverlay
    }
  }

  if (contextType === 'session_creation') {
    systemPrompt += SESSION_CREATION_OVERLAY
  }

  if (contextType === 'injury') {
    systemPrompt += INJURY_OVERLAY
  }

  const anthropicBody = {
    model: MODEL,
    max_tokens: maxTokens,
    stream: true,
    system: systemPrompt,
    messages,
  }

  let anthropicRes: Response
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(anthropicBody),
    })
  } catch {
    return NextResponse.json({ error: 'network_error' }, { status: 502 })
  }

  if (!anthropicRes.ok) {
    const errData = await anthropicRes.json().catch(() => ({})) as { error?: { type?: string } }
    if (anthropicRes.status === 401) {
      return NextResponse.json({ error: 'invalid_api_key' }, { status: 401 })
    }
    if (anthropicRes.status === 429) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }
    if (errData?.error?.type === 'overloaded_error') {
      return NextResponse.json({ error: 'overloaded' }, { status: 503 })
    }
    return NextResponse.json({ error: 'anthropic_error' }, { status: anthropicRes.status })
  }

  // Stream the response back, collecting the full text in parallel
  const upstream = anthropicRes.body!
  let fullText = ''

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          controller.enqueue(new TextEncoder().encode(chunk))

          // Collect text deltas for post-stream processing
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data) as {
                type?: string
                delta?: { type?: string; text?: string }
              }
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                fullText += parsed.delta.text ?? ''
              }
            } catch {
              // Skip malformed lines
            }
          }
        }
      } catch (err) {
        controller.error(err)
        return
      }

      controller.close()

      console.log('=== FULL AI RESPONSE ===')
      console.log(fullText)

      // Ensure the conversation row exists before any FK-referencing inserts
      const validConvId = isValidUUID(conversationId) ? conversationId : null
      if (validConvId) {
        const { data: existingConv } = await admin
          .from('conversations')
          .select('id')
          .eq('id', validConvId)
          .single()

        if (!existingConv) {
          const { error: convErr } = await admin
            .from('conversations')
            .insert({
              id: validConvId,
              user_id: user.id,
              context_type: contextType,
              message_count: messages.length,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          if (convErr) {
            console.error('=== CONVERSATION INSERT ERROR ===', convErr)
          }
        } else {
          await admin
            .from('conversations')
            .update({
              message_count: messages.length,
              updated_at: new Date().toISOString(),
            })
            .eq('id', validConvId)
        }
      }

      // Post-stream: parse all context_update blocks and save to DB
      const contextUpdateRegex = /\{"context_update":\{[\s\S]*?\}\}/g
      const matches = fullText.match(contextUpdateRegex)
      console.log('=== CONTEXT UPDATE BLOCKS FOUND ===', matches?.length ?? 0)

      if (matches && matches.length > 0) {
        const allowedModules = [
          'plan_dna', 'training_patterns', 'adaptation_rules',
          'race_goals', 'fueling_strategy', 'health_injury',
          'recovery_preferences', 'session_notes',
        ]

        for (const match of matches) {
          try {
            const parsed = JSON.parse(match) as {
              context_update: {
                target_module: string
                target_field?: string | null
                action_type: string
                suggested_value: unknown
                reasoning?: string
                evidence?: string
              }
            }
            const update = parsed.context_update

            console.log('=== SAVING CONTEXT UPDATE ===', update.target_module)

            if (!allowedModules.includes(update.target_module)) {
              console.log('BLOCKED — invalid module:', update.target_module)
              continue
            }

            const suggestionData = {
              user_id: user.id,
              target_module: update.target_module,
              target_field: update.target_field ?? null,
              action_type: update.action_type,
              suggested_value: typeof update.suggested_value === 'object'
                ? JSON.stringify(update.suggested_value)
                : String(update.suggested_value),
              reasoning: update.reasoning ?? '',
              evidence: update.evidence ?? null,
              triggered_by: 'ai_conversation',
              status: 'pending',
            }

            const { data, error } = await admin
              .from('context_suggestions')
              .insert({ ...suggestionData, source_conversation_id: validConvId })
              .select()
              .single()

            if (error?.code === '23503') {
              // FK violation — conversation row missing despite upsert; retry without the link
              console.warn('=== FK FALLBACK — retrying without source_conversation_id ===')
              const { data: d2, error: e2 } = await admin
                .from('context_suggestions')
                .insert({ ...suggestionData, source_conversation_id: null })
                .select()
                .single()
              if (e2) {
                console.error('=== SUPABASE INSERT ERROR (fallback) ===', e2)
              } else {
                console.log('=== CONTEXT SUGGESTION SAVED (fallback) ===', (d2 as Record<string, unknown>)?.id)
              }
            } else if (error) {
              console.error('=== SUPABASE INSERT ERROR ===', error)
            } else {
              console.log('=== CONTEXT SUGGESTION SAVED ===', (data as Record<string, unknown>)?.id)
            }
          } catch (e) {
            console.error('=== JSON PARSE ERROR ===', (e as Error).message)
            console.error('=== RAW BLOCK ===', match)
          }
        }
      }

      // Save messages to conversation_messages (conversation row guaranteed above)
      if (validConvId) {
        const lastUserMsg = messages[messages.length - 1]
        if (lastUserMsg?.role === 'user') {
          await admin.from('conversation_messages').insert([
            {
              conversation_id: validConvId,
              role: 'user',
              content: lastUserMsg.content,
            },
            {
              conversation_id: validConvId,
              role: 'assistant',
              content: fullText,
            },
          ])
        }
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
