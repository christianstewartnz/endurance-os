'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Icon, Button, Kbd } from '@/components/atoms'
import { useRouter } from 'next/navigation'
import { useCoach } from '@/lib/context/coach-context'
import { useCoachChat } from '@/lib/hooks/use-coach-chat'
import { SessionProposalCard } from '@/components/session-proposal-card'
import type { Message, ResumedConversation, ContextTag } from '@/lib/context/coach-context'

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

interface Conversation {
  id: string
  title: string | null
  summary: string | null
  key_decisions: string[] | null
  context_type: string
  message_count: number
  created_at: string
  updated_at: string
}

function uid(): string {
  return Math.random().toString(36).slice(2)
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 2) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function groupConversations(conversations: Conversation[]): {
  today: Conversation[]
  thisWeek: Conversation[]
  last14Days: Conversation[]
  archive: Conversation[]
} {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 86400000)
  const fourteenDaysAgo = new Date(startOfToday.getTime() - 13 * 86400000)

  const today: Conversation[] = []
  const thisWeek: Conversation[] = []
  const last14Days: Conversation[] = []
  const archive: Conversation[] = []

  for (const c of conversations) {
    const updated = new Date(c.updated_at)
    if (updated >= startOfToday) {
      today.push(c)
    } else if (updated >= sevenDaysAgo) {
      thisWeek.push(c)
    } else if (updated >= fourteenDaysAgo) {
      last14Days.push(c)
    } else {
      archive.push(c)
    }
  }

  return { today, thisWeek, last14Days, archive }
}

// Detect current @word being typed
function getAtMention(text: string, cursorPos: number): { word: string; start: number } | null {
  const before = text.slice(0, cursorPos)
  const match = before.match(/@([\w-]*)$/)
  if (!match) return null
  return { word: match[1], start: before.length - match[0].length }
}

export default function CoachPanel() {
  const router = useRouter()
  const {
    messages, setMessages,
    conversationId, setConversationId,
    conversationTitle, setConversationTitle,
    setIsOpen,
    startNewConversation: contextStartNew,
    activeThread, setActiveThread,
    resumedConversation, setResumedConversation,
    pendingRequest, setPendingRequest,
    hasApiKey,
    availableTags,
  } = useCoach()

  const { streamChat, isStreaming, abort } = useCoachChat()
  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat')
  const [input, setInput] = useState('')
  const [inlineCards, setInlineCards] = useState<InlineCard[]>([])
  const [addedSessionMsgIds, setAddedSessionMsgIds] = useState<Set<string>>(new Set())
  const [addingSessionMsgId, setAddingSessionMsgId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [tagQuery, setTagQuery] = useState('')
  const [tagDropdownIndex, setTagDropdownIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const tagAnchorRef = useRef<number>(0)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isStreaming, inlineCards])

  useEffect(() => {
    if (activeTab === 'history') loadHistory()
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-send pending session review request when panel mounts or request arrives
  useEffect(() => {
    if (!pendingRequest || isStreaming) return
    const req = pendingRequest
    setPendingRequest(null)
    sendMessage(req.message, { contextType: req.contextType, sessionId: req.sessionId })
  }, [pendingRequest]) // eslint-disable-line react-hooks/exhaustive-deps

  // ⌘⇧N — new conversation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        handleNewConversation()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      const res = await fetch('/api/coach/conversations')
      if (res.ok) {
        const { conversations: data } = await res.json() as { conversations: Conversation[] }
        setConversations(data ?? [])
      }
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  function handleNewConversation() {
    abort()
    contextStartNew()
    setInlineCards([])
    setAddedSessionMsgIds(new Set())
    setInput('')
    setActiveTab('chat')
  }

  const loadConversation = useCallback(async (conv: Conversation) => {
    setActiveTab('chat')
    setConversationId(conv.id)
    setConversationTitle(conv.title)
    setActiveThread(conv.id)
    setResumedConversation({ id: conv.id, title: conv.title, updated_at: conv.updated_at })
    setMessages([])
    setInlineCards([])
    setInput('')

    try {
      const res = await fetch(`/api/coach/conversations/${conv.id}/messages`)
      if (res.ok) {
        const { messages: data } = await res.json() as {
          messages: Array<{ id: string; role: string; content: string }>
        }
        setMessages(
          (data ?? []).map((m) => ({
            id: m.id ?? uid(),
            role: m.role === 'assistant' ? 'ai' : (m.role as 'user' | 'system'),
            content: m.content,
          }))
        )
      }
    } catch {
      // ignore
    }
  }, [setConversationId, setConversationTitle, setActiveThread, setResumedConversation, setMessages])

  const filteredTags = availableTags.filter((t) =>
    tagQuery === '' || t.tag.toLowerCase().includes(tagQuery.toLowerCase()) || t.label.toLowerCase().includes(tagQuery.toLowerCase())
  ).slice(0, 8)

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    const cursor = e.target.selectionStart ?? val.length
    setInput(val)

    const mention = getAtMention(val, cursor)
    if (mention) {
      setTagQuery(mention.word)
      setTagAnchor(mention.start)
      setShowTagDropdown(true)
      setTagDropdownIndex(0)
    } else {
      setShowTagDropdown(false)
    }
  }

  function setTagAnchor(pos: number) {
    tagAnchorRef.current = pos
  }

  function insertTag(tag: ContextTag) {
    const cursor = textareaRef.current?.selectionStart ?? input.length
    const before = input.slice(0, tagAnchorRef.current)
    const after = input.slice(cursor)
    const newVal = before + tag.tag + ' ' + after
    setInput(newVal)
    setShowTagDropdown(false)
    setTagQuery('')
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = before.length + tag.tag.length + 1
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showTagDropdown && filteredTags.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setTagDropdownIndex((i) => Math.min(i + 1, filteredTags.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setTagDropdownIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertTag(filteredTags[tagDropdownIndex])
        return
      }
      if (e.key === 'Escape') {
        setShowTagDropdown(false)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const sendMessage = useCallback(async (text: string, opts?: { contextType?: string; sessionId?: string }) => {
    if (!text.trim() || isStreaming) return

    const userMsgId = uid()
    const aiMsgId = uid()

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: text },
      { id: aiMsgId, role: 'ai', content: '' },
    ])
    setInput('')

    if (!conversationTitle) {
      const words = text.trim().split(/\s+/)
      setConversationTitle(words.length > 6 ? words.slice(0, 6).join(' ') + '…' : text.trim())
    }

    const historyForApi: Array<{ role: 'user' | 'assistant'; content: string }> = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: (m.role === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant', content: m.content }))
    historyForApi.push({ role: 'user', content: text })

    await streamChat(
      historyForApi,
      { conversationId, contextType: opts?.contextType ?? 'general', sessionId: opts?.sessionId },
      {
        onTextDelta: (delta) => {
          setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, content: m.content + delta } : m))
        },
        onComplete: async ({ fullText, modulesLoaded, newSuggestionIds, proposedSession }) => {
          setMessages((prev) => prev.map((m) => m.id === aiMsgId
            ? { ...m, content: fullText, modulesRead: modulesLoaded, ...(proposedSession ? { proposal: proposedSession } : {}) }
            : m
          ))

          if (newSuggestionIds.length > 0) {
            try {
              const pendingRes = await fetch('/api/context/suggestions/pending')
              const { suggestions } = await pendingRes.json() as {
                suggestions: Array<ContextSuggestion & { id: string }>
              }
              const forThisMessage = (suggestions ?? []).filter(
                (s) => newSuggestionIds.includes(s.id)
              )
              if (forThisMessage.length > 0) {
                setInlineCards((prev) => {
                  const existingIds = new Set(prev.map((c) => c.suggestion.id))
                  const trulyNew = forThisMessage.filter((s) => !existingIds.has(s.id))
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
            } catch { /* skip */ }
          }
        },
        onError: (msg) => {
          setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, content: msg } : m))
        },
      },
    )
  }, [messages, isStreaming, conversationId, conversationTitle, setMessages, setConversationTitle, streamChat])

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
          <Button kind="ghost" size="sm" icon="x" onClick={() => setIsOpen(false)} />
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
      <div style={{ padding: '12px 16px 0', borderBottom: '1px solid var(--border-subtle)' }}>
        {/* Top row: icon + title + action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="sparkles" size={13} color="var(--ai)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {activeTab === 'chat' ? (
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conversationTitle ?? 'New conversation'}
              </div>
            ) : (
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', letterSpacing: '-0.005em' }}>History</div>
            )}
          </div>
          {/* + New and × Close */}
          <button
            title="New conversation (⌘⇧N)"
            onClick={handleNewConversation}
            style={{
              width: 26, height: 26, borderRadius: 6,
              background: 'transparent', border: '1px solid var(--border-default)',
              color: 'var(--fg-3)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color var(--dur-micro), background var(--dur-micro)',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-1)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-2)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-3)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <Icon name="plus" size={13} />
          </button>
          <Button kind="ghost" size="sm" icon="x" onClick={() => setIsOpen(false)} />
        </div>

        {/* Tab toggle */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 0 }}>
          <TabButton
            active={activeTab === 'chat'}
            onClick={() => setActiveTab('chat')}
            label="✦ Coach"
          />
          <TabButton
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            label="History"
          />
        </div>
      </div>

      {activeTab === 'chat' ? (
        <>
          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Resumed conversation banner */}
            {resumedConversation && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', borderRadius: 7,
                background: 'rgba(139,124,246,0.08)', border: '1px solid rgba(139,124,246,0.2)',
                fontSize: 12, color: 'var(--fg-3)',
              }}>
                <Icon name="clock-counter-clockwise" size={12} color="var(--ai)" />
                <span style={{ flex: 1 }}>
                  Resumed · {timeAgo(resumedConversation.updated_at)}
                </span>
                <button
                  onClick={handleNewConversation}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 11, color: 'var(--ai)', padding: 0,
                    fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3,
                  }}
                >
                  Start new <Icon name="arrow-square-out" size={10} color="var(--ai)" />
                </button>
              </div>
            )}

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
                  .map((card) => (
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
                {m.proposal && !addedSessionMsgIds.has(m.id) && (
                  <SessionProposalCard
                    proposal={m.proposal}
                    adding={addingSessionMsgId === m.id}
                    onAdd={async (date) => {
                      setAddingSessionMsgId(m.id)
                      try {
                        await fetch('/api/coach/sessions', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ proposal: m.proposal, date }),
                        })
                        setAddedSessionMsgIds((prev) => new Set([...prev, m.id]))
                      } catch { /* non-fatal */ } finally {
                        setAddingSessionMsgId(null)
                      }
                    }}
                    onDecline={() => setAddedSessionMsgIds((prev) => new Set([...prev, m.id]))}
                  />
                )}
              </div>
            ))}
            {isStreaming && messages[messages.length - 1]?.content === '' && <TypingDots />}
          </div>

          {/* Composer */}
          <div style={{ padding: '12px 14px 14px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{
              position: 'relative',
              display: 'flex', flexDirection: 'column',
              background: 'var(--bg-2)',
              border: '1px solid var(--border-default)',
              borderRadius: 10,
              padding: '10px 12px',
            }}>
              {/* @ Tag dropdown */}
              {showTagDropdown && filteredTags.length > 0 && (
                <TagDropdown
                  tags={filteredTags}
                  selectedIndex={tagDropdownIndex}
                  onSelect={insertTag}
                  onClose={() => setShowTagDropdown(false)}
                />
              )}

              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                onBlur={() => { setTimeout(() => setShowTagDropdown(false), 150) }}
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
                <span style={{ fontSize: 10, color: 'var(--fg-4)', marginLeft: 4, fontFamily: 'var(--font-mono)' }}>@ for context</span>
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
        </>
      ) : (
        <HistoryTab
          conversations={conversations}
          isLoading={isLoadingHistory}
          searchQuery={searchQuery}
          activeConversationId={conversationId}
          onSearchChange={setSearchQuery}
          onNewConversation={handleNewConversation}
          onLoadConversation={loadConversation}
        />
      )}
    </aside>
  )
}

function TagDropdown({ tags, selectedIndex, onSelect, onClose }: {
  tags: ContextTag[]
  selectedIndex: number
  onSelect: (tag: ContextTag) => void
  onClose: () => void
}) {
  const groups = [
    { key: 'context', label: 'Context' },
    { key: 'today', label: 'Today' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'races', label: 'Races' },
  ] as const

  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6,
      background: 'var(--bg-2)', border: '1px solid var(--border-default)',
      borderRadius: 8, maxHeight: 260, overflowY: 'auto', zIndex: 100,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    }}>
      {groups.map((g) => {
        const groupTags = tags.filter((t) => t.group === g.key)
        if (!groupTags.length) return null
        return (
          <div key={g.key}>
            <div style={{ padding: '6px 12px 2px', fontSize: 10, fontWeight: 600, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {g.label}
            </div>
            {groupTags.map((tag, i) => {
              const globalIdx = tags.indexOf(tag)
              return (
                <div
                  key={tag.tag}
                  onMouseDown={(e) => { e.preventDefault(); onSelect(tag) }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '6px 12px', cursor: 'pointer',
                    background: globalIdx === selectedIndex ? 'var(--bg-3)' : 'transparent',
                    transition: 'background var(--dur-micro)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-3)' }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = globalIdx === selectedIndex ? 'var(--bg-3)' : 'transparent'
                  }}
                >
                  <div style={{ paddingTop: 1 }}>
                    <Icon name={tag.icon} size={13} color="var(--fg-3)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ai)', fontWeight: 500 }}>{tag.tag}</span>
                      <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{tag.label}</span>
                    </div>
                    {tag.description && (
                      <div style={{ fontSize: 11, color: 'var(--fg-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag.description}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--fg-1)' : 'var(--fg-3)',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--ai)' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'color var(--dur-micro) var(--ease-out)',
        fontFamily: 'inherit',
        marginBottom: -1,
      }}
    >
      {label}
    </button>
  )
}

function HistoryTab({
  conversations,
  isLoading,
  searchQuery,
  activeConversationId,
  onSearchChange,
  onNewConversation,
  onLoadConversation,
}: {
  conversations: Conversation[]
  isLoading: boolean
  searchQuery: string
  activeConversationId: string
  onSearchChange: (q: string) => void
  onNewConversation: () => void
  onLoadConversation: (c: Conversation) => void
}) {
  const filtered = searchQuery.trim()
    ? conversations.filter((c) => {
        const q = searchQuery.toLowerCase()
        return (
          (c.title ?? '').toLowerCase().includes(q) ||
          (c.summary ?? '').toLowerCase().includes(q)
        )
      })
    : conversations

  const groups = groupConversations(filtered)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Search */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 7, padding: '5px 10px' }}>
          <Icon name="magnifying-glass" size={12} color="var(--fg-4)" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 12, color: 'var(--fg-1)', fontFamily: 'inherit',
            }}
          />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <Icon name="x" size={11} color="var(--fg-4)" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {isLoading ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--fg-4)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--fg-4)' }}>
            {searchQuery ? 'No conversations match your search.' : 'No conversation history yet.'}
          </div>
        ) : (
          <>
            <ConversationGroup label="Today" items={groups.today} activeId={activeConversationId} onLoad={onLoadConversation} showArchiveButton={false} />
            <ConversationGroup label="This week" items={groups.thisWeek} activeId={activeConversationId} onLoad={onLoadConversation} showArchiveButton={false} />
            <ConversationGroup label="Last 14 days" items={groups.last14Days} activeId={activeConversationId} onLoad={onLoadConversation} showArchiveButton={false} />
            <ConversationGroup label="Archive" items={groups.archive} activeId={activeConversationId} onLoad={onLoadConversation} showArchiveButton={true} />
          </>
        )}
      </div>
    </div>
  )
}

function ConversationGroup({
  label,
  items,
  activeId,
  onLoad,
  showArchiveButton,
}: {
  label: string
  items: Conversation[]
  activeId: string
  onLoad: (c: Conversation) => void
  showArchiveButton: boolean
}) {
  if (!items.length) return null

  return (
    <div>
      <div style={{ padding: '4px 16px 2px', fontSize: 10, fontWeight: 600, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      {items.map((c) => (
        <ConversationRow key={c.id} conversation={c} activeId={activeId} onLoad={onLoad} showArchiveButton={showArchiveButton} />
      ))}
    </div>
  )
}

function ConversationRow({
  conversation: c,
  activeId,
  onLoad,
  showArchiveButton,
}: {
  conversation: Conversation
  activeId: string
  onLoad: (c: Conversation) => void
  showArchiveButton: boolean
}) {
  const isActive = c.id === activeId
  const now = new Date()
  const updatedAt = new Date(c.updated_at)
  const isInProgress = !isActive && (now.getTime() - updatedAt.getTime()) < 3600000

  return (
    <div
      style={{
        padding: '8px 16px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--border-subtle)',
        borderLeft: isActive ? '2px solid var(--ai)' : '2px solid transparent',
        transition: 'background var(--dur-micro) var(--ease-out)',
        paddingLeft: isActive ? 14 : 16,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-2)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
      onClick={() => { if (!showArchiveButton) onLoad(c) }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {c.title ?? 'Untitled conversation'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--fg-4)', flexShrink: 0 }}>{timeAgo(c.updated_at)}</span>
      </div>
      {c.summary ? (
        <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {c.summary}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--fg-4)', fontStyle: 'italic' }}>
          {c.message_count ?? 0} message{(c.message_count ?? 0) !== 1 ? 's' : ''}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        {isInProgress && (
          <span style={{
            fontSize: 10, color: 'var(--ai)', background: 'rgba(139,124,246,0.12)',
            border: '1px solid rgba(139,124,246,0.25)', borderRadius: 4,
            padding: '1px 6px', fontWeight: 500,
          }}>
            In progress
          </span>
        )}
        {showArchiveButton && (
          <button
            onClick={(e) => { e.stopPropagation(); onLoad(c) }}
            style={{
              fontSize: 11, color: 'var(--ai)', background: 'var(--ai-soft)',
              border: '1px solid var(--ai-edge)', borderRadius: 5,
              padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Load full conversation
          </button>
        )}
      </div>
    </div>
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
          <>
            <div style={{
              background: 'rgba(139,124,246,0.06)', border: '1px solid rgba(139,124,246,0.16)',
              borderRadius: 10, padding: '10px 12px',
              fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.55, whiteSpace: 'pre-wrap',
            }}>
              {m.content}
              {isStreaming && <span style={{ opacity: 0.5, animation: 'blink 1s infinite' }}>▊</span>}
            </div>
            {m.modulesRead && m.modulesRead.length > 0 && !isStreaming && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                {m.modulesRead.map((mod) => (
                  <span key={mod} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: 'var(--ai)', background: 'rgba(139,124,246,0.1)',
                    borderRadius: 4, padding: '1px 6px',
                  }}>
                    @{mod}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes blink { 0%, 50% { opacity: 1 } 51%, 100% { opacity: 0 } }`}</style>
    </div>
  )
}

function SuggestionValueDisplay({ suggestion }: { suggestion: ContextSuggestion }) {
  const { target_module, target_field, suggested_value } = suggestion

  let parsed: Record<string, unknown> | null = null
  try {
    const v = JSON.parse(suggested_value)
    if (v && typeof v === 'object' && !Array.isArray(v)) parsed = v as Record<string, unknown>
  } catch { /* plain text */ }

  if (!parsed) {
    return <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.5 }}>{suggested_value}</div>
  }

  if (target_module === 'illnesses') {
    const name = String(parsed.name ?? 'Illness')
    const desc = parsed.description ? String(parsed.description) : null
    const start = parsed.date_start ? String(parsed.date_start) : null
    const restrictions = Array.isArray(parsed.restrictions) ? parsed.restrictions as string[] : []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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

  if (target_module === 'injuries') {
    const part = String(parsed.body_part ?? 'Injury')
    const desc = parsed.description ? String(parsed.description) : null
    const start = parsed.date_start ? String(parsed.date_start) : null
    const restrictions = Array.isArray(parsed.restrictions) ? parsed.restrictions as string[] : []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
