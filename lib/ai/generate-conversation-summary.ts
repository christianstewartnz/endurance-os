import { createAdminClient } from '@/lib/supabase/admin'

const MODEL = 'claude-sonnet-4-6'

function extractKeyDecisions(messages: Array<{ role: string; content: string }>): string[] {
  const agreementWords = /\b(agreed|decided|will do|locked in|going with|confirmed)\b/i
  const decisions: string[] = []

  for (const msg of messages) {
    const sentences = msg.content.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean)
    for (const sentence of sentences) {
      if (agreementWords.test(sentence)) {
        const words = sentence.replace(/\s+/g, ' ').trim().split(' ')
        if (words.length <= 10) {
          decisions.push(sentence.trim())
        } else {
          // Find the agreement word position and take surrounding context
          const matchIdx = words.findIndex((w) => agreementWords.test(w))
          const start = Math.max(0, matchIdx - 2)
          decisions.push(words.slice(start, start + 10).join(' '))
        }
      }
    }
  }

  // Deduplicate and cap at 6
  return [...new Set(decisions)].slice(0, 6)
}

export async function generateConversationSummary(
  conversationId: string,
  userId: string,
  anthropicKey: string,
): Promise<void> {
  const admin = createAdminClient()

  // Check summary freshness
  const { data: conv } = await admin
    .from('conversations')
    .select('summary_generated_at')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single()

  if (!conv) return

  if (conv.summary_generated_at) {
    const generated = new Date(conv.summary_generated_at as string)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
    if (generated > hourAgo) return
  }

  // Fetch all messages
  const { data: messages } = await admin
    .from('conversation_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (!messages || messages.length < 4) return

  const typedMessages = messages as Array<{ role: string; content: string }>

  // Call Anthropic for summary
  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system:
          'Summarise this coaching conversation in plain text, maximum 5 lines. Extract:\n1. What was discussed\n2. What was agreed or decided\n3. Any health or training flags raised\nNo markdown, no bullet points, just plain text.',
        messages: typedMessages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      }),
    })
  } catch {
    return
  }

  if (!res.ok) return

  const data = await res.json() as { content?: Array<{ text?: string }> }
  const summary = data.content?.[0]?.text?.trim() ?? ''
  if (!summary) return

  const keyDecisions = extractKeyDecisions(typedMessages)

  await admin
    .from('conversations')
    .update({
      summary,
      key_decisions: keyDecisions.length > 0 ? keyDecisions : null,
      summary_generated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
}
