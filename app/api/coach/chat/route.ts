import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSystemPrompt } from '@/lib/ai/build-system-prompt'
import { generateConversationSummary } from '@/lib/ai/generate-conversation-summary'

const MODEL = 'claude-sonnet-4-6'

function isValidUUID(str: string | undefined): str is string {
  if (!str) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

// ── Tool schemas ─────────────────────────────────────────────────────────────

import type { WeeklySummaryData, SessionReviewData } from '@/lib/types/coach-widgets'

interface FuelingSuggestion {
  carb_g_per_hour?: number | null
  fluid_ml_per_hour?: number | null
  sodium_mg_per_hour?: number | null
  note?: string | null
}

interface ProposeSessionInput {
  name: string
  type: string
  sport: string
  date: string
  description?: string
  duration_seconds: number
  estimated_tss: number
  intervals_format: string
  fueling_suggestion?: FuelingSuggestion | null
}

const REMOVE_SESSION_TOOL = {
  name: 'remove_session',
  description: 'Propose removing an AI-created planned session from the athlete\'s calendar. Only call this when the athlete explicitly asks to cancel or remove a session you created. The athlete must confirm before anything is deleted.',
  input_schema: {
    type: 'object',
    required: ['date', 'name'],
    properties: {
      date: { type: 'string', description: 'ISO date (YYYY-MM-DD) of the session to remove' },
      name: { type: 'string', description: 'Session name, shown in the confirmation prompt' },
    },
  },
}

const PROPOSE_SESSION_TOOL = {
  name: 'propose_session',
  description: 'Propose a specific training session to add to the athlete\'s calendar. Only call this once you and the athlete have explicitly agreed on the session — not while still discussing options. The athlete confirms before anything is written; calling this tool does not write to the calendar by itself.',
  input_schema: {
    type: 'object',
    required: ['name', 'type', 'sport', 'date', 'duration_seconds', 'estimated_tss', 'intervals_format'],
    properties: {
      name: { type: 'string', description: 'Short session title, e.g. \'6x4min VO2max\'' },
      type: { type: 'string', description: 'Intervals.icu event type string, e.g. \'Ride\', \'Run\'' },
      sport: { type: 'string', enum: ['cycling', 'running', 'swimming', 'strength', 'general'] },
      date: { type: 'string', description: 'ISO date (YYYY-MM-DD) the session is planned for. Use the date actually discussed with the athlete — do not assume today.' },
      description: { type: 'string', description: 'Plain-language session description for the athlete' },
      duration_seconds: { type: 'integer' },
      estimated_tss: { type: 'number' },
      intervals_format: { type: 'string', description: 'Structured workout text in Intervals.icu workout description format' },
      fueling_suggestion: {
        type: 'object',
        description: 'Fueling guidance for this specific session based on sport, duration, effort, and forecast conditions. Omit for very short/easy sessions where only water is needed — in those cases set note to explain water-only rather than leaving blank. Use WEATHER CONDITIONS from context to calibrate: longer and hotter → more fluid and sodium; short/easy/recovery → water only.',
        properties: {
          carb_g_per_hour: { type: 'number', description: 'Carbohydrate target in grams per hour. Omit or set to 0 for water-only sessions.' },
          fluid_ml_per_hour: { type: 'number', description: 'Fluid target in ml per hour.' },
          sodium_mg_per_hour: { type: 'number', description: 'Sodium target in mg per hour.' },
          note: { type: 'string', description: 'Short plain-language rationale, e.g. \'Hot forecast (29°C) and 3h duration — higher sodium and fluid than usual.\' or \'45min easy run — water only, no fueling needed.\'' },
        },
      },
    },
  },
}

const PROPOSE_CONTEXT_UPDATE_TOOL = {
  name: 'propose_context_update',
  description: 'Propose a change to the athlete\'s stored context. This is always reviewed or auto-applied by the app — never tell the athlete you\'ve \'saved\' something without calling this.',
  input_schema: {
    type: 'object',
    required: ['target_module', 'action', 'kind', 'reasoning'],
    properties: {
      target_module: {
        type: 'string',
        enum: ['plan_dna', 'training_patterns', 'adaptation_rules', 'race_goals', 'fueling_strategy', 'illnesses', 'injuries', 'recovery_preferences', 'session_notes', 'session'],
      },
      action: {
        type: 'string',
        enum: ['create', 'update', 'archive', 'delete'],
      },
      target_id: {
        type: 'string',
        description: 'Real DB id of the row being updated/archived/deleted. Omit for \'create\'.',
      },
      kind: {
        type: 'string',
        enum: ['observation', 'instruction'],
        description: 'Only meaningful for training_patterns. \'observation\' = an observed tendency about the athlete. \'instruction\' = a restriction or directive — instructions belong in illnesses/injuries restrictions, never in training_patterns.',
      },
      fields: {
        type: 'object',
        description: 'Field values to set, keyed by column name. Shape depends on target_module.',
      },
      reasoning: { type: 'string' },
      evidence: { type: 'string' },
    },
  },
}

const PRESENT_WEEKLY_SUMMARY_TOOL = {
  name: 'present_weekly_summary',
  description: 'Render a structured weekly training summary widget in the chat. Call this instead of writing the summary as prose/markdown text whenever reviewing a week\'s training. Do not also duplicate the summary as prose text alongside this tool call.',
  input_schema: {
    type: 'object',
    required: ['week_start', 'week_end', 'days', 'weekly_tss', 'session_count', 'bottom_line'],
    properties: {
      week_start: { type: 'string' },
      week_end: { type: 'string' },
      days: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            day_label: { type: 'string', description: "e.g. 'Mon'" },
            session_name: { type: 'string', description: 'null/omit for rest days' },
            sport: { type: 'string' },
            duration_minutes: { type: 'number' },
            tss: { type: 'number' },
            intensity_factor: { type: 'number' },
          },
        },
      },
      weekly_tss: { type: 'number' },
      session_count: { type: 'integer' },
      went_well: { type: 'array', items: { type: 'string' } },
      flags: { type: 'array', items: { type: 'string' } },
      bottom_line: { type: 'string' },
      closing_question: { type: 'string', description: 'Optional follow-up question to the athlete' },
    },
  },
}

const PRESENT_SESSION_REVIEW_TOOL = {
  name: 'present_session_review',
  description: 'Render a structured session review card in the chat. Call this as your opening review of a completed session — do not also write the same analysis as prose text. You may still call propose_context_update afterward to save the ai_summary and ai_flags.',
  input_schema: {
    type: 'object',
    required: ['headline', 'analysis', 'flags'],
    properties: {
      headline: { type: 'string', description: "One-line take, e.g. 'Solid aerobic execution, slight fade in the last 20 minutes'" },
      analysis: { type: 'string', description: '2-4 sentences on pacing, HR response, drift, execution' },
      flags: { type: 'array', items: { type: 'string' }, description: 'Notable concerns. Empty array if none.' },
    },
  },
}

// ── Two-tier routing ─────────────────────────────────────────────────────────

// These modules go directly to auto-apply (no review step)
const AUTO_APPLY_MODULES = new Set(['session_notes', 'session'])

// training_patterns with kind=observation also auto-apply
// fueling_strategy → kept in review for now (low-stakes but product decision pending)
// REVIEW_REQUIRED modules: illnesses, injuries, plan_dna, adaptation_rules, recovery_preferences

interface RemoveSessionInput {
  date: string
  name: string
}

interface ProposeContextUpdateInput {
  target_module: string
  action: string
  target_id?: string
  kind: string
  fields?: Record<string, unknown>
  reasoning?: string
  evidence?: string
}

function shouldAutoApply(input: ProposeContextUpdateInput): boolean {
  if (AUTO_APPLY_MODULES.has(input.target_module)) return true
  if (input.target_module === 'training_patterns' && input.kind === 'observation') return true
  return false
}

// ── Overlays ─────────────────────────────────────────────────────────────────

const SESSION_CREATION_OVERLAY = `
════════════════════════════════════════
SESSION CREATION MODE
════════════════════════════════════════

Help the athlete design a training session that fits their current context. Consider today's readiness, their current training phase, and any applicable adaptation rules before recommending intensity or volume.

When you and the athlete have agreed on a specific session — its type, structure, and date — call the propose_session tool. Use the date explicitly discussed; do not assume today. The athlete must confirm before anything is saved to their calendar.

Always include a fueling_suggestion in the proposal. Calibrate using the WEATHER CONDITIONS section (if present) for the session's date:
- Sessions ≥2h or with forecast max >25°C: include carb/fluid/sodium targets. Hot conditions (>28°C) warrant +15–25% fluid and sodium vs. standard.
- Sessions <90min, easy/recovery effort, cool conditions: set note to explain "water only — no fueling needed" and omit or zero the numeric fields.
- If no forecast is available (date beyond 16-day window or no location set): use sensible defaults and note in fueling_suggestion.note that no forecast was available rather than inventing weather conditions.
- Never leave fueling_suggestion empty or null without explanation — either provide targets or state why water-only is appropriate.

After a session is confirmed and the athlete wants to adjust its fueling, call propose_context_update with target_module "session", action "update", target_id = the session's session_id, and fields containing the updated fueling_carb_g_per_hour / fueling_fluid_ml_per_hour / fueling_sodium_mg_per_hour / fueling_note values.
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

2. Once you have full context, call propose_context_update with target_module "injuries" (physical injury) or "illnesses" (illness/illness). These require athlete review before applying.

3. Propose plan adaptations via Intervals.icu calendar update (presented as a separate suggestion for user to accept)

4. Do not catastrophise. Be matter-of-fact. Give the athlete a clear picture of what training looks like during this period.
`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ── Route handler ─────────────────────────────────────────────────────────────

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
    clientDate,
  }: {
    messages: ChatMessage[]
    conversationId?: string
    contextType?: 'general' | 'session_review' | 'session_creation' | 'injury'
    sessionId?: string
    clientDate?: string
  } = body

  const { prompt: basePrompt, modulesLoaded } = await buildSystemPrompt(user.id, clientDate)
  const maxTokens = contextType === 'session_creation' ? 2048 : 1024
  let systemPrompt = basePrompt

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
  1. Open by calling present_session_review with headline, analysis (pacing/HR/drift/execution), and any flags — do NOT write the same analysis as prose text alongside the tool call.
  2. Ask how it felt (capture RPE and athlete notes)
  3. Note any patterns worth saving to Training Patterns
  4. At end of review, call propose_context_update to save ai_summary and ai_flags to session_notes
  5. If a training pattern is confirmed, call propose_context_update with target_module "training_patterns"
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
    tools: [PROPOSE_CONTEXT_UPDATE_TOOL, PROPOSE_SESSION_TOOL, REMOVE_SESSION_TOOL, PRESENT_WEEKLY_SUMMARY_TOOL, PRESENT_SESSION_REVIEW_TOOL],
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

  const upstream = anthropicRes.body!
  let fullText = ''

  // Accumulate tool_use blocks by content block index
  // { index → { id, name, partialJson } }
  const toolBlocks: Record<number, { id: string; name: string; partialJson: string }> = {}
  const completedToolCalls: ProposeContextUpdateInput[] = []
  let proposedSession: ProposeSessionInput | null = null
  let proposedRemoval: RemoveSessionInput | null = null
  let weeklySummary: WeeklySummaryData | null = null
  let sessionReview: SessionReviewData | null = null

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

          const lines = chunk.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data) as {
                type?: string
                index?: number
                content_block?: { type?: string; id?: string; name?: string }
                delta?: { type?: string; text?: string; partial_json?: string }
              }

              if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
                toolBlocks[parsed.index!] = {
                  id: parsed.content_block.id ?? '',
                  name: parsed.content_block.name ?? '',
                  partialJson: '',
                }
              } else if (parsed.type === 'content_block_delta') {
                if (parsed.delta?.type === 'text_delta') {
                  fullText += parsed.delta.text ?? ''
                } else if (parsed.delta?.type === 'input_json_delta' && parsed.index != null) {
                  const block = toolBlocks[parsed.index]
                  if (block) {
                    block.partialJson += parsed.delta.partial_json ?? ''
                  }
                }
              } else if (parsed.type === 'content_block_stop' && parsed.index != null) {
                const block = toolBlocks[parsed.index]
                if (block && block.partialJson) {
                  if (block.name === 'propose_context_update') {
                    try {
                      const input = JSON.parse(block.partialJson) as ProposeContextUpdateInput
                      completedToolCalls.push(input)
                    } catch {
                      console.error('[chat] failed to parse propose_context_update input:', block.partialJson)
                    }
                  } else if (block.name === 'propose_session') {
                    try {
                      proposedSession = JSON.parse(block.partialJson) as ProposeSessionInput
                    } catch {
                      console.error('[chat] failed to parse propose_session input:', block.partialJson)
                    }
                  } else if (block.name === 'remove_session') {
                    try {
                      proposedRemoval = JSON.parse(block.partialJson) as RemoveSessionInput
                    } catch {
                      console.error('[chat] failed to parse remove_session input:', block.partialJson)
                    }
                  } else if (block.name === 'present_weekly_summary') {
                    try {
                      weeklySummary = JSON.parse(block.partialJson) as WeeklySummaryData
                    } catch {
                      console.error('[chat] failed to parse present_weekly_summary input:', block.partialJson)
                    }
                  } else if (block.name === 'present_session_review') {
                    try {
                      sessionReview = JSON.parse(block.partialJson) as SessionReviewData
                    } catch {
                      console.error('[chat] failed to parse present_session_review input:', block.partialJson)
                    }
                  }
                }
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

      console.log('=== FULL AI RESPONSE ===')
      console.log(fullText)
      console.log('=== TOOL CALLS ===', completedToolCalls.length)

      // Ensure conversation row exists
      const validConvId = isValidUUID(conversationId) ? conversationId : null
      if (validConvId) {
        const { data: existingConv } = await admin
          .from('conversations')
          .select('id')
          .eq('id', validConvId)
          .single()

        if (!existingConv) {
          const firstUserMsg = messages.find((m) => m.role === 'user')
          let title: string | null = null
          if (firstUserMsg) {
            const words = firstUserMsg.content.trim().split(/\s+/)
            title = words.length > 6
              ? words.slice(0, 6).join(' ') + '…'
              : firstUserMsg.content.trim()
          }

          const { error: convErr } = await admin
            .from('conversations')
            .insert({
              id: validConvId,
              user_id: user.id,
              context_type: contextType,
              message_count: messages.length,
              title,
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

      // Process tool calls — route to auto-apply or review queue
      const newSuggestionIds: string[] = []
      const autoApplied: Array<{ target_module: string; action: string; summary: string }> = []
      const now = new Date().toISOString()

      for (const input of completedToolCalls) {
        // Reject training_patterns with kind=instruction at the application layer
        if (input.target_module === 'training_patterns' && input.kind === 'instruction') {
          console.warn('[chat] rejected training_patterns instruction — instructions belong in illnesses/injuries restrictions')
          continue
        }

        if (shouldAutoApply(input)) {
          // Auto-apply path
          if (input.target_module === 'training_patterns' && input.kind === 'observation') {
            const { data: newPattern, error: patternErr } = await admin
              .from('training_patterns')
              .insert({
                user_id: user.id,
                pattern_text: (input.fields?.pattern_text as string) ?? input.reasoning ?? '',
                category: (input.fields?.category as string) ?? 'general',
                sport: (input.fields?.sport as string) ?? 'general',
                confidence: 'low',
                unconfirmed: true,
                observation_count: 1,
                evidence: input.evidence ?? null,
                source_conversation_id: validConvId,
                status: 'active',
                first_observed_date: now.split('T')[0],
                last_observed_date: now.split('T')[0],
              })
              .select()
              .single()

            if (patternErr) {
              console.error('[chat] auto-apply training_pattern error:', patternErr)
            } else {
              autoApplied.push({
                target_module: 'training_patterns',
                action: 'create',
                summary: (input.fields?.pattern_text as string) ?? input.reasoning ?? '',
              })
              console.log('[chat] auto-applied training_pattern:', (newPattern as Record<string, unknown>)?.id)
            }
          } else if (input.target_module === 'session_notes') {
            // Auto-apply session_notes update (always update, never create)
            if (input.action === 'update' && input.target_id) {
              const { error: snErr } = await admin
                .from('session_notes')
                .update({ ...(input.fields ?? {}), updated_at: now })
                .eq('id', input.target_id)
                .eq('user_id', user.id)
              if (snErr) {
                console.error('[chat] auto-apply session_notes error:', snErr)
              } else {
                autoApplied.push({ target_module: 'session_notes', action: 'update', summary: 'Session notes updated' })
              }
            }
          } else if (input.target_module === 'session') {
            // Session fueling amendment — athlete discussed a change, auto-apply to session_notes row
            if (input.action === 'update' && input.target_id) {
              const allowedSessionFields = new Set([
                'fueling_carb_g_per_hour', 'fueling_fluid_ml_per_hour',
                'fueling_sodium_mg_per_hour', 'fueling_note',
                'athlete_notes', 'rpe',
              ])
              const safeFields: Record<string, unknown> = {}
              for (const [k, v] of Object.entries(input.fields ?? {})) {
                if (allowedSessionFields.has(k)) safeFields[k] = v
              }
              if (Object.keys(safeFields).length > 0) {
                const { error: sessErr } = await admin
                  .from('session_notes')
                  .update({ ...safeFields, updated_at: now })
                  .eq('session_id', input.target_id)
                  .eq('user_id', user.id)
                if (sessErr) {
                  console.error('[chat] auto-apply session update error:', sessErr)
                } else {
                  autoApplied.push({ target_module: 'session', action: 'update', summary: 'Session updated' })
                }
              }
            }
          }
        } else {
          // Review-required path — insert into context_suggestions
          const suggestionData = {
            user_id: user.id,
            target_module: input.target_module,
            action_type: input.action,
            target_field: input.target_id ?? null,
            suggested_value: (input.action === 'archive' || input.action === 'delete')
              ? (input.reasoning ?? '')
              : JSON.stringify(input.fields ?? {}),
            reasoning: input.reasoning ?? '',
            evidence: input.evidence ?? null,
            triggered_by: 'ai_conversation',
            status: 'pending',
          }

          // Skip identical pending suggestion for this conversation
          if (validConvId) {
            const { data: existing } = await admin
              .from('context_suggestions')
              .select('id')
              .eq('user_id', user.id)
              .eq('source_conversation_id', validConvId)
              .eq('target_module', suggestionData.target_module)
              .eq('action_type', suggestionData.action_type)
              .eq('target_field', suggestionData.target_field ?? '')
              .eq('status', 'pending')
              .maybeSingle()
            if (existing) {
              console.log('[chat] duplicate suggestion skipped:', input.target_module)
              continue
            }
          }

          const { data: newSugg, error: suggErr } = await admin
            .from('context_suggestions')
            .insert({ ...suggestionData, source_conversation_id: validConvId })
            .select('id')
            .single()

          if (suggErr?.code === '23503') {
            const { data: d2, error: e2 } = await admin
              .from('context_suggestions')
              .insert({ ...suggestionData, source_conversation_id: null })
              .select('id')
              .single()
            if (e2) {
              console.error('[chat] suggestion insert error (fallback):', e2)
            } else {
              const suggId = (d2 as Record<string, unknown>)?.id as string
              if (suggId) newSuggestionIds.push(suggId)
            }
          } else if (suggErr) {
            console.error('[chat] suggestion insert error:', suggErr)
          } else {
            const suggId = (newSugg as Record<string, unknown>)?.id as string
            if (suggId) newSuggestionIds.push(suggId)
          }
        }
      }

      // Save messages to conversation_messages
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
              content: fullText.trim(),
            },
          ])
        }

        if (messages.length >= 4) {
          generateConversationSummary(validConvId, user.id, anthropicKey).catch(console.error)
        }
      }

      // Send a final meta event so the client knows what was loaded and what's new
      const metaEvent = `data: ${JSON.stringify({
        type: 'endurance_meta',
        modulesLoaded,
        newSuggestionIds,
        autoApplied,
        ...(proposedSession ? { proposedSession } : {}),
        ...(proposedRemoval ? { proposedRemoval } : {}),
        ...(weeklySummary ? { weeklySummary } : {}),
        ...(sessionReview ? { sessionReview } : {}),
      })}\n\n`
      controller.enqueue(new TextEncoder().encode(metaEvent))
      controller.close()
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
