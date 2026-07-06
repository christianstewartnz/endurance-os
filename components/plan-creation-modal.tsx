'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useRouter } from 'next/navigation'
import { Icon, Button } from '@/components/atoms'
import { useCoachChat } from '@/lib/hooks/use-coach-chat'
import type { ProposedTrainingPlan, TrainingPlanPhase, TrainingPlanSession } from '@/lib/types/coach-widgets'

interface Message {
  id: string
  role: 'user' | 'ai'
  content: string
}

interface ConflictRow {
  id: string
  session_date: string
  session_type: string | null
  sport: string | null
  name: string | null
  planned_duration_seconds: number | null
  actual_duration_seconds: number | null
}

function uid() {
  return Math.random().toString(36).slice(2)
}

function fmtDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

function fmtDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

interface PlanCreationModalProps {
  onClose: () => void
  onPlanAdded: () => void
}

export default function PlanCreationModal({ onClose, onPlanAdded }: PlanCreationModalProps) {
  const router = useRouter()
  const { streamChat, isStreaming, abort } = useCoachChat()
  const [conversationId] = useState(() => uid())
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [proposedPlan, setProposedPlan] = useState<ProposedTrainingPlan | null>(null)
  const [reviewStep, setReviewStep] = useState<'chat' | 'review'>('chat')
  const [conflicts, setConflicts] = useState<ConflictRow[]>([])
  const [conflictResolution, setConflictResolution] = useState<'replace' | 'keep_both'>('replace')
  const [isLoadingConflicts, setIsLoadingConflicts] = useState(false)
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isStreaming])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isStreaming && !isWriting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isStreaming, isWriting, onClose])

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

    const historyForApi = messages
      .filter((m) => m.role !== undefined)
      .map((m) => ({ role: (m.role === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant', content: m.content }))
    historyForApi.push({ role: 'user', content: text })

    await streamChat(
      historyForApi,
      { conversationId, contextType: 'plan_creation' },
      {
        onTextDelta: (delta) => {
          setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, content: m.content + delta } : m))
        },
        onToolCallStart: (toolName) => {
          setActiveToolCall(toolName)
        },
        onComplete: async ({ fullText, proposedPlan: plan }) => {
          setActiveToolCall(null)
          setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, content: fullText } : m))
          if (plan) {
            setProposedPlan(plan)
            // Load conflicts before showing review
            setIsLoadingConflicts(true)
            try {
              const res = await fetch(`/api/coach/training-plan?start=${plan.start_date}&end=${plan.end_date}`)
              if (res.ok) {
                const { conflicts: c } = await res.json() as { conflicts: ConflictRow[] }
                setConflicts(c ?? [])
              }
            } catch { /* non-fatal */ } finally {
              setIsLoadingConflicts(false)
            }
            setReviewStep('review')
          }
        },
        onError: (msg) => {
          setActiveToolCall(null)
          setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, content: msg } : m))
        },
      },
    )
  }, [messages, isStreaming, conversationId, streamChat])

  async function handleConfirmPlan() {
    if (!proposedPlan) return
    setIsWriting(true)
    setWriteError(null)
    try {
      const res = await fetch('/api/coach/training-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: proposedPlan, conflictResolution }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setWriteError(data.error ?? 'Failed to write plan. Please try again.')
        return
      }
      onPlanAdded()
      router.refresh()
    } catch {
      setWriteError('Network error. Please try again.')
    } finally {
      setIsWriting(false)
    }
  }

  function handleBackToChat() {
    setReviewStep('chat')
    setProposedPlan(null)
    setConflicts([])
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        }}
        onClick={() => { if (!isStreaming && !isWriting) onClose() }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1001,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          width: reviewStep === 'review' ? 880 : 700,
          maxWidth: 'calc(100vw - 48px)',
          height: 'min(88vh, 820px)',
          background: 'var(--bg-1)',
          border: '1px solid var(--border-default)',
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pointerEvents: 'all',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7,
              background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="sparkles" size={13} color="var(--ai)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)', letterSpacing: '-0.005em' }}>
                {reviewStep === 'review' ? 'Review training plan' : 'Create training plan'}
              </div>
              {reviewStep === 'chat' && (
                <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 1 }}>
                  Work with your coach to design a structured block
                </div>
              )}
            </div>
            {reviewStep === 'review' && (
              <Button kind="ghost" size="sm" icon="arrow-left" onClick={handleBackToChat}>Back to chat</Button>
            )}
            <Button kind="ghost" size="sm" icon="x" onClick={onClose} />
          </div>

          {reviewStep === 'chat' ? (
            activeToolCall === 'propose_training_plan' ? (
              <PlanGeneratingView
                coachSummary={messages.findLast((m) => m.role === 'ai')?.content ?? null}
              />
            ) : (
            <ChatPane
              messages={messages}
              isStreaming={isStreaming}
              activeToolCall={activeToolCall}
              input={input}
              isLoadingConflicts={isLoadingConflicts}
              scrollRef={scrollRef}
              textareaRef={textareaRef}
              onInputChange={(v) => setInput(v)}
              onSend={sendMessage}
              onAbort={abort}
            />
            )
          ) : proposedPlan ? (
            <ReviewPane
              plan={proposedPlan}
              conflicts={conflicts}
              conflictResolution={conflictResolution}
              isWriting={isWriting}
              writeError={writeError}
              onConflictResolutionChange={setConflictResolution}
              onConfirm={handleConfirmPlan}
              onCancel={handleBackToChat}
            />
          ) : null}
        </div>
      </div>
    </>
  )
}

// ── Chat pane ─────────────────────────────────────────────────────────────────

// ── Plan generating view ──────────────────────────────────────────────────────

const GENERATION_STEPS = [
  'Analysing your fitness and training load…',
  'Structuring phases and periodisation…',
  'Scheduling quality sessions and long days…',
  'Writing near-term sessions in full detail…',
  'Sketching outline sessions for later weeks…',
  'Calibrating weekly TSS and hour targets…',
  'Finalising deload weeks and taper…',
]

const SKELETON_ROWS: Array<{ width: number; sportColor: string; delay: number }> = [
  { width: 68, sportColor: 'var(--z4)', delay: 0 },
  { width: 52, sportColor: 'var(--z3)', delay: 0.18 },
  { width: 75, sportColor: 'var(--z2)', delay: 0.36 },
  { width: 60, sportColor: 'var(--z5)', delay: 0.54 },
  { width: 58, sportColor: 'var(--z4)', delay: 0.72 },
  { width: 70, sportColor: 'var(--z3)', delay: 0.9 },
  { width: 45, sportColor: 'var(--z2)', delay: 1.08 },
  { width: 65, sportColor: 'var(--z4)', delay: 1.26 },
]

function PlanGeneratingView({ coachSummary }: { coachSummary: string | null }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setStepIndex((i) => (i + 1) % GENERATION_STEPS.length)
        setVisible(true)
      }, 220)
    }, 2600)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @keyframes planPulseRing {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.18); opacity: 0; }
        }
        @keyframes planShimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        @keyframes planFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes planRowIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Top: coach summary (if any text was streamed before the tool call) */}
      {coachSummary && coachSummary.trim().length > 0 && (
        <div style={{
          margin: '16px 20px 0',
          padding: '10px 14px',
          background: 'rgba(139,124,246,0.06)',
          border: '1px solid rgba(139,124,246,0.16)',
          borderRadius: 10,
          fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.55,
          flexShrink: 0,
        }}>
          {coachSummary}
        </div>
      )}

      {/* Central loading area */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 32px', gap: 28,
      }}>
        {/* Pulsing icon */}
        <div style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Outer ring */}
          <div style={{
            position: 'absolute', inset: -10, borderRadius: 999,
            border: '1.5px solid var(--ai)',
            animation: 'planPulseRing 2s ease-out infinite',
          }} />
          {/* Second ring with offset */}
          <div style={{
            position: 'absolute', inset: -4, borderRadius: 999,
            border: '1px solid rgba(139,124,246,0.3)',
            animation: 'planPulseRing 2s 0.5s ease-out infinite',
          }} />
          {/* Icon bg */}
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'var(--ai-soft)', border: '1.5px solid var(--ai-edge)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="sparkles" size={26} color="var(--ai)" />
          </div>
        </div>

        {/* Heading + cycling step */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-1)', letterSpacing: '-0.01em' }}>
            Building your training plan
          </div>
          <div style={{
            fontSize: 13, color: 'var(--ai)',
            minHeight: 20,
            transition: 'opacity 0.22s ease, transform 0.22s ease',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(3px)',
          }}>
            {GENERATION_STEPS[stepIndex]}
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 2 }}>
            This can take up to a minute for a full multi-week plan
          </div>
        </div>

        {/* Skeleton session rows */}
        <div style={{
          width: '100%', maxWidth: 440,
          display: 'flex', flexDirection: 'column', gap: 7,
        }}>
          {SKELETON_ROWS.map((row, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px',
                background: 'var(--bg-2)', border: '1px solid var(--border-subtle)',
                borderRadius: 7,
                animation: `planRowIn 0.35s ${row.delay}s both`,
              }}
            >
              {/* Sport dot */}
              <div style={{ width: 8, height: 8, borderRadius: 999, background: row.sportColor, flexShrink: 0 }} />
              {/* Date skeleton */}
              <div style={{ width: 72, height: 10, borderRadius: 4, ...shimmerStyle(row.delay) }} />
              {/* Name skeleton */}
              <div style={{ width: `${row.width}%`, maxWidth: 220, height: 10, borderRadius: 4, flex: 1, ...shimmerStyle(row.delay + 0.1) }} />
              {/* Duration skeleton */}
              <div style={{ width: 44, height: 10, borderRadius: 4, flexShrink: 0, ...shimmerStyle(row.delay + 0.2) }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function shimmerStyle(delay: number): React.CSSProperties {
  return {
    background: 'linear-gradient(90deg, var(--bg-3) 0%, rgba(139,124,246,0.12) 40%, var(--bg-3) 80%)',
    backgroundSize: '800px 100%',
    animation: `planShimmer 1.6s ${delay}s infinite linear`,
  }
}

const TOOL_LABELS: Record<string, string> = {
  propose_training_plan: 'Building your training plan…',
  propose_session: 'Building session…',
  propose_context_update: 'Saving context…',
  present_weekly_summary: 'Building summary…',
  present_session_review: 'Building review…',
}

function ChatPane({
  messages,
  isStreaming,
  activeToolCall,
  input,
  isLoadingConflicts,
  scrollRef,
  textareaRef,
  onInputChange,
  onSend,
  onAbort,
}: {
  messages: Message[]
  isStreaming: boolean
  activeToolCall: string | null
  input: string
  isLoadingConflicts: boolean
  scrollRef: React.RefObject<HTMLDivElement | null>
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onInputChange: (v: string) => void
  onSend: (text: string) => void
  onAbort: () => void
}) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend(input)
    }
  }

  return (
    <>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.length === 0 && !isStreaming && (
          <EmptyState />
        )}
        {messages.map((m, i) => (
          <PlanChatMessage key={m.id} m={m} isStreaming={isStreaming && i === messages.length - 1 && m.role === 'ai'} />
        ))}
        {activeToolCall && (
          <ToolCallIndicator label={TOOL_LABELS[activeToolCall] ?? 'Working…'} />
        )}
        {isLoadingConflicts && (
          <ToolCallIndicator label="Checking calendar for conflicts…" />
        )}
        {isStreaming && !activeToolCall && messages[messages.length - 1]?.content === '' && <TypingDots />}
      </div>
      <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-2)', border: '1px solid var(--border-default)',
          borderRadius: 10, padding: '10px 12px',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell your coach your goals, availability, target race — or ask a question…"
            rows={3}
            disabled={isStreaming}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              resize: 'none', color: 'var(--fg-1)', fontFamily: 'inherit',
              fontSize: 13, lineHeight: 1.5, padding: 0,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
            <div style={{ flex: 1 }} />
            {isStreaming ? (
              <Button kind="ghost" size="sm" icon="stop" onClick={onAbort}>Stop</Button>
            ) : (
              <button
                onClick={() => onSend(input)}
                disabled={!input.trim() || isStreaming}
                style={{
                  width: 26, height: 26, borderRadius: 6,
                  background: input.trim() ? 'var(--accent)' : 'var(--bg-3)',
                  color: input.trim() ? 'var(--accent-fg)' : 'var(--fg-4)',
                  border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background var(--dur-micro)',
                }}
              >
                <Icon name="arrow-up" size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Review pane ───────────────────────────────────────────────────────────────

function ReviewPane({
  plan,
  conflicts,
  conflictResolution,
  isWriting,
  writeError,
  onConflictResolutionChange,
  onConfirm,
  onCancel,
}: {
  plan: ProposedTrainingPlan
  conflicts: ConflictRow[]
  conflictResolution: 'replace' | 'keep_both'
  isWriting: boolean
  writeError: string | null
  onConflictResolutionChange: (v: 'replace' | 'keep_both') => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set([plan.phases[0]?.name ?? '']))

  // Group sessions by week
  const sessionsByWeek = groupSessionsByWeek(plan.sessions)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Plan header */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          {fmtDate(plan.start_date)} → {fmtDate(plan.end_date)}
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-1)', letterSpacing: '-0.01em' }}>{plan.goal}</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <StatChip label="Phases" value={String(plan.phases.length)} />
          <StatChip label="Sessions" value={String(plan.sessions.length)} />
          <StatChip label="Full detail" value={String(plan.sessions.filter((s) => s.detail_level === 'full').length)} />
          <StatChip label="Outline" value={String(plan.sessions.filter((s) => s.detail_level === 'outline').length)} />
        </div>
      </div>

      {/* Conflict warning */}
      {conflicts.length > 0 && (
        <div style={{
          padding: '12px 14px', borderRadius: 8,
          background: 'rgba(232,155,60,0.08)', border: '1px solid rgba(232,155,60,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <Icon name="warning" size={14} color="#E89B3C" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#E89B3C' }}>
              {conflicts.length} existing session{conflicts.length !== 1 ? 's' : ''} in this date range
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 10 }}>
            {conflicts.map((c) => (
              <div key={c.id} style={{ padding: '2px 0' }}>
                {fmtDate(c.session_date)} · {c.name ?? (c.sport ?? c.session_type ?? 'Session')} · {fmtDuration(c.actual_duration_seconds ?? c.planned_duration_seconds)}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ConflictOption
              label="Replace existing"
              description="Remove the sessions above and write the plan"
              selected={conflictResolution === 'replace'}
              onClick={() => onConflictResolutionChange('replace')}
            />
            <ConflictOption
              label="Keep both"
              description="Write the plan alongside existing sessions"
              selected={conflictResolution === 'keep_both'}
              onClick={() => onConflictResolutionChange('keep_both')}
            />
          </div>
        </div>
      )}

      {/* Phases */}
      <div>
        <SectionLabel>Phases</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {plan.phases.map((phase) => (
            <PhaseCard
              key={phase.name}
              phase={phase}
              expanded={expandedPhases.has(phase.name)}
              sessions={plan.sessions.filter((s) => s.plan_phase === phase.name)}
              onToggle={() => setExpandedPhases((prev) => {
                const next = new Set(prev)
                if (next.has(phase.name)) next.delete(phase.name)
                else next.add(phase.name)
                return next
              })}
            />
          ))}
        </div>
      </div>

      {/* Sessions by week */}
      <div>
        <SectionLabel>Sessions by week</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sessionsByWeek.map(({ weekLabel, sessions: wSessions }) => (
            <WeekBlock key={weekLabel} weekLabel={weekLabel} sessions={wSessions} />
          ))}
        </div>
      </div>

      {/* Error */}
      {writeError && (
        <div style={{ padding: '10px 12px', borderRadius: 7, background: 'rgba(229,72,77,0.08)', border: '1px solid rgba(229,72,77,0.3)', fontSize: 13, color: '#E5484D' }}>
          {writeError}
        </div>
      )}

      {/* Confirm/Cancel */}
      <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <Button
          kind="primary"
          size="md"
          icon={isWriting ? 'spinner' : 'check'}
          onClick={onConfirm}
        >
          {isWriting ? 'Writing plan…' : `Confirm — write ${plan.sessions.length} sessions`}
        </Button>
        <Button kind="ghost" size="md" onClick={onCancel}>Go back</Button>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16, textAlign: 'center', padding: '40px 32px',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="sparkles" size={22} color="var(--ai)" />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 6 }}>
          Build a structured training plan
        </div>
        <div style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.6, maxWidth: 380 }}>
          Tell your coach your target race, training window, and weekly availability.
          The coach will design a phased block with concrete sessions written to your calendar.
        </div>
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 360, textAlign: 'left',
        padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Try saying</div>
        {[
          '"I have a 70.3 in 10 weeks. Build me a block."',
          '"8-week base period, 10–12h/week, no race target."',
          '"Build toward my marathon in May, more strength in the base phase."',
        ].map((s) => (
          <div key={s} style={{ fontSize: 12, color: 'var(--fg-2)', fontStyle: 'italic' }}>{s}</div>
        ))}
      </div>
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 1 }}>{label}</div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
      {children}
    </div>
  )
}

function ConflictOption({ label, description, selected, onClick }: {
  label: string; description: string; selected: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
        border: `1px solid ${selected ? 'rgba(232,155,60,0.5)' : 'var(--border-subtle)'}`,
        background: selected ? 'rgba(232,155,60,0.1)' : 'var(--bg-2)',
        textAlign: 'left', fontFamily: 'inherit',
        transition: 'all var(--dur-micro)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <div style={{
          width: 12, height: 12, borderRadius: 999,
          border: `2px solid ${selected ? '#E89B3C' : 'var(--fg-4)'}`,
          background: selected ? '#E89B3C' : 'transparent',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-1)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--fg-3)', paddingLeft: 18 }}>{description}</div>
    </button>
  )
}

function PhaseCard({ phase, expanded, sessions, onToggle }: {
  phase: TrainingPlanPhase
  expanded: boolean
  sessions: TrainingPlanSession[]
  onToggle: () => void
}) {
  return (
    <div style={{
      border: '1px solid var(--border-subtle)',
      borderRadius: 8, overflow: 'hidden',
      background: 'var(--bg-2)',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <Icon name={expanded ? 'caret-down' : 'caret-right'} size={12} color="var(--fg-3)" />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{phase.name}</span>
            <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>{fmtDate(phase.start_date)} → {fmtDate(phase.end_date)}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{phase.focus}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
          {phase.weekly_hours_target && (
            <PhaseTarget label="Target/wk" value={`${phase.weekly_hours_target}h`} />
          )}
          {phase.weekly_tss_target && (
            <PhaseTarget label="TSS/wk" value={String(phase.weekly_tss_target)} />
          )}
          <PhaseTarget label="Sessions" value={String(sessions.length)} />
        </div>
      </button>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 14px 12px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {sessions.map((s) => (
              <SessionChip key={s.date + s.sport} session={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PhaseTarget({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  )
}

function SessionChip({ session }: { session: TrainingPlanSession }) {
  const sportColors: Record<string, string> = {
    cycling: 'var(--z4)', running: 'var(--z3)',
    swimming: 'var(--z2)', strength: 'var(--z5)', general: 'var(--z1)',
  }
  const color = sportColors[session.sport] ?? 'var(--z2)'
  const isOutline = session.detail_level === 'outline'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 5,
      background: 'var(--bg-3)', border: '1px solid var(--border-subtle)',
      fontSize: 11, color: 'var(--fg-2)',
    }}>
      <div style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtDate(session.date)}</span>
      <span>{session.name ?? session.sport}</span>
      <span style={{ color: 'var(--fg-4)' }}>{session.duration_minutes}min</span>
      {isOutline && <span style={{ color: 'var(--fg-4)', fontSize: 10 }}>outline</span>}
    </div>
  )
}

function groupSessionsByWeek(sessions: TrainingPlanSession[]): Array<{ weekLabel: string; sessions: TrainingPlanSession[] }> {
  const weeks: Map<string, TrainingPlanSession[]> = new Map()

  for (const s of sessions) {
    const [y, mo, d] = s.date.split('-').map(Number)
    const date = new Date(y, mo - 1, d)
    const day = date.getDay()
    const monday = new Date(date)
    monday.setDate(date.getDate() - ((day + 6) % 7))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const label = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    if (!weeks.has(label)) weeks.set(label, [])
    weeks.get(label)!.push(s)
  }

  return Array.from(weeks.entries()).map(([weekLabel, sessions]) => ({ weekLabel, sessions }))
}

function WeekBlock({ weekLabel, sessions }: { weekLabel: string; sessions: TrainingPlanSession[] }) {
  const totalMin = sessions.reduce((sum, s) => sum + s.duration_minutes, 0)
  const totalTss = sessions.reduce((sum, s) => sum + (s.target_tss ?? 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)' }}>{weekLabel}</span>
        <span style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
          {Math.floor(totalMin / 60)}h{totalMin % 60 > 0 ? ` ${totalMin % 60}min` : ''}
          {totalTss > 0 ? ` · ${Math.round(totalTss)} TSS` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sessions.map((s) => (
          <SessionRow key={s.date + s.sport} session={s} />
        ))}
      </div>
    </div>
  )
}

function SessionRow({ session }: { session: TrainingPlanSession }) {
  const [expanded, setExpanded] = useState(false)
  const sportColors: Record<string, string> = {
    cycling: 'var(--z4)', running: 'var(--z3)',
    swimming: 'var(--z2)', strength: 'var(--z5)', general: 'var(--z1)',
  }
  const color = sportColors[session.sport] ?? 'var(--z2)'
  const hasDetail = session.detail_level === 'full' && !!session.intervals_format

  return (
    <div style={{
      borderRadius: 6, border: '1px solid var(--border-subtle)',
      background: 'var(--bg-2)', overflow: 'hidden',
    }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '7px 10px', cursor: hasDetail ? 'pointer' : 'default',
        }}
        onClick={() => { if (hasDetail) setExpanded((v) => !v) }}
      >
        <div style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', flexShrink: 0, width: 80 }}>
          {fmtDate(session.date)}
        </span>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-1)', flex: 1 }}>
          {session.name ?? session.sport}
        </span>
        <span style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
          {session.duration_minutes}min
          {session.target_tss ? ` · ${session.target_tss} TSS` : ''}
        </span>
        {session.detail_level === 'outline' && (
          <span style={{
            fontSize: 10, color: 'var(--fg-4)',
            background: 'var(--bg-3)', borderRadius: 3, padding: '1px 5px',
            border: '1px solid var(--border-subtle)',
          }}>outline</span>
        )}
        {hasDetail && (
          <Icon name={expanded ? 'caret-up' : 'caret-down'} size={11} color="var(--fg-4)" />
        )}
      </div>
      {expanded && session.intervals_format && (
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '8px 10px 10px 28px',
          fontSize: 11, fontFamily: 'var(--font-mono)',
          color: 'var(--fg-3)', whiteSpace: 'pre-wrap', lineHeight: 1.55,
        }}>
          {session.intervals_format}
        </div>
      )}
    </div>
  )
}

const markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  p: ({ children }) => <p style={{ margin: '0 0 6px', lineHeight: 1.55 }}>{children}</p>,
  strong: ({ children }) => <strong style={{ fontWeight: 600, color: 'var(--fg-1)' }}>{children}</strong>,
  em: ({ children }) => <em style={{ fontStyle: 'italic', color: 'var(--fg-2)' }}>{children}</em>,
  ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</ol>,
  li: ({ children }) => <li style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.5 }}>{children}</li>,
  h1: ({ children }) => <h1 style={{ fontSize: 14, fontWeight: 700, margin: '8px 0 4px' }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ fontSize: 13, fontWeight: 700, margin: '6px 0 3px' }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 600, margin: '5px 0 3px' }}>{children}</h3>,
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-')
    return isBlock
      ? <code style={{ display: 'block', background: 'var(--bg-3)', border: '1px solid var(--border-subtle)', borderRadius: 5, padding: '8px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', margin: '4px 0' }}>{children}</code>
      : <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-3)', borderRadius: 3, padding: '1px 4px' }}>{children}</code>
  },
}

function PlanChatMessage({ m, isStreaming }: { m: Message; isStreaming: boolean }) {
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
      <div style={{
        flex: 1, background: 'rgba(139,124,246,0.06)', border: '1px solid rgba(139,124,246,0.16)',
        borderRadius: 10, padding: '10px 12px', fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.55,
      }}>
        {m.content === '' && isStreaming ? (
          <TypingDots inline />
        ) : (
          <>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {m.content}
            </ReactMarkdown>
            {isStreaming && <span style={{ opacity: 0.5 }}>▊</span>}
          </>
        )}
      </div>
    </div>
  )
}

function ToolCallIndicator({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <div style={{
        width: 22, height: 22, borderRadius: 5,
        background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name="sparkles" size={11} color="var(--ai)" />
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px',
        background: 'rgba(139,124,246,0.06)', border: '1px solid rgba(139,124,246,0.16)',
        borderRadius: 10,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{
              width: 5, height: 5, borderRadius: 999,
              background: 'var(--ai)',
              animation: `dotPulse 1s ${i * 0.16}s infinite ease-in-out`,
              display: 'inline-block',
            }} />
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--ai)', fontWeight: 500 }}>{label}</span>
      </div>
      <style>{`@keyframes dotPulse { 0%, 60%, 100% { opacity: 0.3 } 30% { opacity: 1 } }`}</style>
    </div>
  )
}

function TypingDots({ inline }: { inline?: boolean }) {
  const dots = (
    <div style={{ display: 'flex', gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: 999,
          background: 'var(--ai)',
          animation: `dotPulse 1s ${i * 0.16}s infinite ease-in-out`,
          display: 'inline-block',
        }} />
      ))}
      <style>{`@keyframes dotPulse { 0%, 60%, 100% { opacity: 0.3 } 30% { opacity: 1 } }`}</style>
    </div>
  )
  if (inline) return dots
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <div style={{
        width: 22, height: 22, borderRadius: 5,
        background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="sparkles" size={11} color="var(--ai)" />
      </div>
      <div style={{ padding: '8px 12px', background: 'rgba(139,124,246,0.06)', border: '1px solid rgba(139,124,246,0.16)', borderRadius: 10 }}>
        {dots}
      </div>
    </div>
  )
}
