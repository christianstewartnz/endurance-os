'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Icon, Button, Kbd } from '@/components/atoms'
import { useRouter } from 'next/navigation'

interface Message {
  id: string
  role: 'system' | 'ai' | 'user'
  content: string
}

interface ContextSuggestion {
  id: string
  target_module: string
  target_field: string | null
  suggested_value: string
  reasoning: string
  evidence: string | null
}

interface InlineCard {
  messageId: string
  suggestion: ContextSuggestion
  state: 'pending' | 'accepted' | 'rejected' | 'editing'
  editValue: string
}

function uid(): string {
  return Math.random().toString(36).slice(2)
}

interface CoachPanelProps {
  onClose: () => void
  contextType?: 'general' | 'session_review' | 'session_creation' | 'injury'
  sessionId?: string
  initialMessage?: string
}

export default function CoachPanel({ onClose, contextType = 'general', sessionId, initialMessage }: CoachPanelProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId] = useState(() => crypto.randomUUID())
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [loadedModules, setLoadedModules] = useState<string[]>([])
  const [inlineCards, setInlineCards] = useState<InlineCard[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    fetch('/api/keys/anthropic')
      .then((r) => r.json())
      .then((d) => {
        setHasApiKey((d as { connected: boolean }).connected)
        if ((d as { connected: boolean }).connected) {
          // Pre-load context module labels
          setLoadedModules(['@todayshrv', '@plandna', '@patterns'])
        }
      })
      .catch(() => setHasApiKey(false))
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isStreaming, inlineCards])

  // Auto-send initial message if provided (e.g. from session review trigger)
  useEffect(() => {
    if (initialMessage && hasApiKey) {
      sendMessage(initialMessage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasApiKey])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return

    const userMsgId = uid()
    const aiMsgId = uid()

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: text },
      { id: aiMsgId, role: 'ai', content: '' },
    ])
    setInput('')
    setIsStreaming(true)

    const historyForApi = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }))
    historyForApi.push({ role: 'user', content: text })

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyForApi,
          conversationId,
          contextType,
          sessionId,
        }),
        signal: abort.signal,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string }
        const errMsg = (() => {
          switch (errData?.error) {
            case 'no_api_key': return 'No API key connected. Please add your Anthropic key in Settings.'
            case 'invalid_api_key': return 'API key is invalid. Please update it in Settings → API Keys.'
            case 'rate_limited': return 'Too many requests — please wait a moment and try again.'
            case 'network_error': return 'Could not reach Anthropic. Check your connection.'
            default: return 'Something went wrong. Please try again.'
          }
        })()
        setMessages((prev) =>
          prev.map((m) => m.id === aiMsgId ? { ...m, content: errMsg } : m)
        )
        setIsStreaming(false)
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

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
              setMessages((prev) =>
                prev.map((m) => m.id === aiMsgId ? { ...m, content: fullText } : m)
              )
            }
          } catch {
            // skip
          }
        }
      }

      // Strip all context_update JSON blocks from the displayed message
      const contextUpdateRegex = /\{"context_update":\{[\s\S]*?\}\}/g
      const allMatches = fullText.match(contextUpdateRegex)
      if (allMatches && allMatches.length > 0) {
        const displayText = fullText.replace(contextUpdateRegex, '').trim()
        setMessages((prev) =>
          prev.map((m) => m.id === aiMsgId ? { ...m, content: displayText } : m)
        )
        // Fetch pending suggestions saved by the server for this conversation
        try {
          const pendingRes = await fetch('/api/context/suggestions/pending')
          const { suggestions } = await pendingRes.json() as {
            suggestions: Array<ContextSuggestion & { id: string; source_conversation_id: string | null }>
          }
          const forThisConv = (suggestions ?? []).filter(
            (s) => s.source_conversation_id === conversationId
          )
          if (forThisConv.length > 0) {
            setInlineCards((prev) => {
              const existingIds = new Set(prev.map((c) => c.suggestion.id))
              const trulyNew = forThisConv.filter((s) => !existingIds.has(s.id))
              if (!trulyNew.length) return prev
              return [
                ...prev,
                ...trulyNew.map((s) => ({
                  messageId: aiMsgId,
                  suggestion: s,
                  state: 'pending' as const,
                  editValue: s.suggested_value,
                })),
              ]
            })
          }
        } catch {
          // skip
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setMessages((prev) =>
        prev.map((m) => m.id === aiMsgId ? { ...m, content: 'Connection error. Please retry.' } : m)
      )
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [messages, isStreaming, conversationId, contextType, sessionId])

  async function handleSuggestionAction(cardIdx: number, action: 'accept' | 'reject' | 'edit', editedValue?: string) {
    const card = inlineCards[cardIdx]
    if (!card) return

    if (action === 'edit' && editedValue === undefined) {
      setInlineCards((prev) => prev.map((c, i) => i === cardIdx ? { ...c, state: 'editing' } : c))
      return
    }

    const res = await fetch(`/api/context/suggestions/${card.suggestion.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: editedValue ? 'edit' : action, editedValue }),
    })

    if (res.ok) {
      setInlineCards((prev) =>
        prev.map((c, i) => i === cardIdx ? { ...c, state: action === 'reject' ? 'rejected' : 'accepted' } : c)
      )
    }
  }

  const moduleLabel = loadedModules.join(' · ')

  if (hasApiKey === false) {
    return (
      <aside style={{
        width: 'var(--rightpanel-w)',
        background: 'var(--bg-1)',
        borderLeft: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        height: '100%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkles" size={13} color="var(--ai)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', letterSpacing: '-0.005em' }}>Coach</div>
          </div>
          <Button kind="ghost" size="sm" icon="x" onClick={onClose} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="key" size={18} color="var(--ai)" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 6 }}>Connect your Anthropic API key</div>
            <div style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.55, maxWidth: 240 }}>
              Add your key in Settings to activate the AI Coach.
            </div>
          </div>
          <Button kind="primary" size="sm" icon="key" onClick={() => router.push('/settings?section=keys')}>
            Go to Settings → API Keys
          </Button>
        </div>
      </aside>
    )
  }

  return (
    <aside style={{
      width: 'var(--rightpanel-w)',
      background: 'var(--bg-1)',
      borderLeft: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      height: '100%',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkles" size={13} color="var(--ai)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', letterSpacing: '-0.005em' }}>Coach</div>
          {moduleLabel && (
            <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>
              <span style={{ color: 'var(--ai)' }}>●</span> Reading:{' '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>{moduleLabel}</span>
            </div>
          )}
        </div>
        <Button kind="ghost" size="sm" icon="x" onClick={onClose} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.length === 0 && !isStreaming && hasApiKey && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
            <Icon name="sparkles" size={20} color="var(--ai)" />
            <span>Ask about today&apos;s session, this week, or anything in your training.</span>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={m.id}>
            <ChatMessage m={m} isStreaming={isStreaming && i === messages.length - 1 && m.role === 'ai'} />
            {inlineCards
              .filter((c) => c.messageId === m.id)
              .map((card, ci) => (
                <SuggestionCard
                  key={card.suggestion.id}
                  card={card}
                  onAction={(action, edited) => handleSuggestionAction(
                    inlineCards.findIndex((c) => c.suggestion.id === card.suggestion.id),
                    action,
                    edited,
                  )}
                />
              ))
            }
          </div>
        ))}
        {isStreaming && messages[messages.length - 1]?.content === '' && <TypingDots />}
      </div>

      {/* Composer */}
      <div style={{ padding: '12px 14px 14px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-2)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          padding: '10px 12px',
        }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
            placeholder="Ask about today's session, this week, or anything in your training…"
            rows={2}
            disabled={isStreaming}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              resize: 'none', color: 'var(--fg-1)', fontFamily: 'inherit',
              fontSize: 13, lineHeight: 1.5, padding: 0,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--fg-4)', marginLeft: 4 }}>@plan, @session, @week</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
              <Kbd>↵</Kbd> send
            </span>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isStreaming}
              style={{
                width: 24, height: 24, borderRadius: 6,
                background: input.trim() && !isStreaming ? 'var(--accent)' : 'var(--bg-3)',
                color: input.trim() && !isStreaming ? 'var(--accent-fg)' : 'var(--fg-4)',
                border: 'none',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
                transition: 'background var(--dur-micro) var(--ease-out)',
              }}
            >
              <Icon name="arrow-up" size={13} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

function ChatMessage({ m, isStreaming }: { m: Message; isStreaming: boolean }) {
  if (m.role === 'system') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>{m.content}</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
      </div>
    )
  }
  if (m.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          background: 'var(--bg-3)', border: '1px solid var(--border-default)',
          borderRadius: 10, padding: '10px 12px',
          fontSize: 13, color: 'var(--fg-1)', maxWidth: '85%', lineHeight: 1.5, whiteSpace: 'pre-wrap',
        }}>{m.content}</div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{
        width: 22, height: 22, borderRadius: 5,
        background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 2,
      }}>
        <Icon name="sparkles" size={11} color="var(--ai)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {m.content === '' && isStreaming ? (
          <TypingDots />
        ) : (
          <div style={{
            background: 'rgba(139,124,246,0.06)', border: '1px solid rgba(139,124,246,0.16)',
            borderRadius: 10, padding: '10px 12px',
            fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.55, whiteSpace: 'pre-wrap',
          }}>
            {m.content}
            {isStreaming && <span style={{ opacity: 0.5, animation: 'blink 1s infinite' }}>▊</span>}
          </div>
        )}
      </div>
      <style>{`@keyframes blink { 0%, 50% { opacity: 1 } 51%, 100% { opacity: 0 } }`}</style>
    </div>
  )
}

function SuggestionValueDisplay({ suggestion }: { suggestion: ContextSuggestion }) {
  const { target_module, target_field, suggested_value } = suggestion

  // Try to parse as JSON — falls back to plain string
  let parsed: Record<string, unknown> | null = null
  try {
    const v = JSON.parse(suggested_value)
    if (v && typeof v === 'object' && !Array.isArray(v)) parsed = v as Record<string, unknown>
  } catch { /* plain text */ }

  if (!parsed) {
    // Plain text (e.g. training_patterns)
    return <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.5 }}>{suggested_value}</div>
  }

  if (target_module === 'health_injury' && target_field === 'illnesses') {
    const name = String(parsed.name ?? 'Illness')
    const desc = parsed.description ? String(parsed.description) : null
    const start = parsed.date_start ? String(parsed.date_start) : null
    const restrictions = Array.isArray(parsed.restrictions) ? parsed.restrictions as string[] : []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🤒</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{name}</span>
          {start && <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>from {start}</span>}
        </div>
        {desc && <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>{desc}</div>}
        {restrictions.map((r, i) => (
          <div key={i} style={{ fontSize: 12, color: 'var(--fg-2)', display: 'flex', gap: 5 }}>
            <span style={{ color: 'var(--fg-4)' }}>•</span>{r}
          </div>
        ))}
      </div>
    )
  }

  if (target_module === 'health_injury' && target_field === 'active_injuries') {
    const part = String(parsed.body_part ?? 'Injury')
    const desc = parsed.description ? String(parsed.description) : null
    const start = parsed.date_start ? String(parsed.date_start) : null
    const restrictions = Array.isArray(parsed.restrictions) ? parsed.restrictions as string[] : []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🩹</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{part}</span>
          {start && <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>from {start}</span>}
        </div>
        {desc && <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>{desc}</div>}
        {restrictions.map((r, i) => (
          <div key={i} style={{ fontSize: 12, color: 'var(--fg-2)', display: 'flex', gap: 5 }}>
            <span style={{ color: 'var(--fg-4)' }}>•</span>{r}
          </div>
        ))}
      </div>
    )
  }

  // Generic JSON object — render as key: value pairs, skip nulls and ids
  const skip = new Set(['id', 'date_added', 'date_cleared', 'can_cycle', 'can_swim', 'can_strength'])
  const entries = Object.entries(parsed).filter(([k, v]) => !skip.has(k) && v != null && v !== '')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ fontSize: 12, color: 'var(--fg-1)', display: 'flex', gap: 6 }}>
          <span style={{ color: 'var(--fg-4)', minWidth: 80 }}>{k.replace(/_/g, ' ')}</span>
          <span>{Array.isArray(v) ? (v as unknown[]).join(', ') : String(v)}</span>
        </div>
      ))}
    </div>
  )
}

function SuggestionCard({ card, onAction }: {
  card: InlineCard
  onAction: (action: 'accept' | 'reject' | 'edit', editedValue?: string) => void
}) {
  const [editVal, setEditVal] = useState(card.editValue)

  if (card.state === 'accepted') {
    return (
      <div style={{ marginTop: 8, padding: '8px 12px', fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="check" size={12} />
        Context update accepted.
      </div>
    )
  }
  if (card.state === 'rejected') {
    return (
      <div style={{ marginTop: 8, padding: '8px 12px', fontSize: 12, color: 'var(--fg-4)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="x" size={12} />
        Suggestion rejected.
      </div>
    )
  }

  return (
    <div style={{
      marginTop: 8,
      border: '1px solid var(--ai-edge)',
      background: 'rgba(139,124,246,0.04)',
      borderRadius: 8,
      padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Icon name="sparkles" size={11} color="var(--ai)" />
        <span style={{ fontSize: 11, color: 'var(--ai)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Suggested update → <span style={{ fontFamily: 'var(--font-mono)' }}>@{card.suggestion.target_module.replace('_', '')}</span>
        </span>
      </div>
      {card.state === 'editing' ? (
        <textarea
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          rows={3}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--bg-1)', border: '1px solid var(--border-default)',
            borderRadius: 5, padding: '6px 8px', color: 'var(--fg-1)',
            fontFamily: 'inherit', fontSize: 12, lineHeight: 1.5,
            resize: 'vertical', outline: 'none', marginBottom: 8,
          }}
        />
      ) : (
        <div style={{ marginBottom: 4 }}>
          <SuggestionValueDisplay suggestion={card.suggestion} />
        </div>
      )}
      {card.suggestion.evidence && (
        <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
          Evidence: {card.suggestion.evidence}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        {card.state === 'editing' ? (
          <>
            <Button kind="ai" size="sm" icon="check" onClick={() => onAction('edit', editVal)}>Save</Button>
            <Button kind="ghost" size="sm" onClick={() => onAction('accept')}>Cancel</Button>
          </>
        ) : (
          <>
            <Button kind="ai" size="sm" icon="check" onClick={() => onAction('accept')}>Accept</Button>
            <Button kind="ghost" size="sm" icon="pencil-line" onClick={() => onAction('edit')}>Edit</Button>
            <Button kind="ghost" size="sm" icon="x" onClick={() => onAction('reject')}>Reject</Button>
          </>
        )}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <div style={{
        width: 22, height: 22, borderRadius: 5,
        background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="sparkles" size={11} color="var(--ai)" />
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '8px 12px', background: 'rgba(139,124,246,0.06)', border: '1px solid rgba(139,124,246,0.16)', borderRadius: 10 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 5, height: 5, borderRadius: 999,
            background: 'var(--ai)',
            animation: `dotPulse 1s ${i * 0.16}s infinite ease-in-out`,
          }} />
        ))}
      </div>
      <style>{`@keyframes dotPulse { 0%, 60%, 100% { opacity: 0.3 } 30% { opacity: 1 } }`}</style>
    </div>
  )
}
