'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useRouter } from 'next/navigation'
import { Icon, Button, Pill, Sparkline } from '@/components/atoms'
import { useCoachPanel } from '@/components/app-shell'
import { useCoach } from '@/lib/context/coach-context'
import { useCoachChat } from '@/lib/hooks/use-coach-chat'
import { SessionProposalCard } from '@/components/session-proposal-card'
import { SessionOverviewModal } from '@/components/views/calendar-view'
import PlanCreationModal from '@/components/plan-creation-modal'
import type { WellnessCacheRow, SessionNoteRow, IntervalEvent } from '@/lib/intervals/types'
import type { ProposeSessionInput } from '@/lib/hooks/use-coach-chat'

// ── Props ────────────────────────────────────────────────────────────────────

interface DashboardProps {
  wellnessToday: WellnessCacheRow | null
  wellness14d: WellnessCacheRow[]
  weekSessions: SessionNoteRow[]
  weekEvents: IntervalEvent[]
  hasIntervalsConnected: boolean
  recentSessions: SessionNoteRow[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatHeaderDate(): string {
  const d = new Date()
  const day = d.toLocaleDateString('en-US', { weekday: 'long' })
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  return `${day} · ${month} ${d.getDate()}`
}

function formatDuration(secs: number | null): string {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `0:${String(m).padStart(2, '0')}`
}

function getZoneFromName(name: string): string {
  const lower = name.toLowerCase()
  if (/z5|vo2|max|race\s?pace/.test(lower)) return 'z5'
  if (/z4|threshold|tempo|ftp/.test(lower)) return 'z4'
  if (/z3|sweet\s?spot|moderate/.test(lower)) return 'z3'
  if (/z1|recovery|easy|rest/.test(lower)) return 'z1'
  return 'z2'
}

function getZoneFromType(sessionType: string | null): string {
  switch (sessionType) {
    case 'strength': return 'z3'
    case 'swimming': return 'z2'
    case 'running':  return 'z2'
    case 'cycling':  return 'z2'
    default:         return 'z2'
  }
}

// ── Root component ───────────────────────────────────────────────────────────

export default function DashboardView({
  wellnessToday,
  wellness14d,
  weekSessions,
  weekEvents,
  hasIntervalsConnected,
  recentSessions,
}: DashboardProps) {
  // Use browser local date (en-CA locale = YYYY-MM-DD) so UTC+12/+13 users
  // get their correct local date rather than the server's UTC date.
  const localToday = new Date().toLocaleDateString('en-CA')
  const todaySession = recentSessions.find((s) => s.session_date === localToday) ?? null
  const todayEvent   = weekEvents.find((e) => e.start_date_local.startsWith(localToday)) ?? null
  const router = useRouter()
  const { openCoach } = useCoachPanel()
  const { startSessionReview } = useCoach()
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [sessionCreated, setSessionCreated] = useState(false)
  const [overviewSession, setOverviewSession] = useState<SessionNoteRow | null>(null)
  const [overviewVisible, setOverviewVisible] = useState(false)
  const [reflectionText, setReflectionText] = useState('')
  const [reflectionSaving, setReflectionSaving] = useState(false)
  const reflectionRef = useRef<HTMLTextAreaElement>(null)

  const openSessionOverview = useCallback((session: SessionNoteRow) => {
    setOverviewSession(session)
    setReflectionText(session.athlete_notes ?? '')
    requestAnimationFrame(() => requestAnimationFrame(() => setOverviewVisible(true)))
  }, [])

  const closeSessionOverview = useCallback(() => {
    setOverviewVisible(false)
    setTimeout(() => setOverviewSession(null), 120)
  }, [])

  const saveReflection = useCallback(async () => {
    if (!overviewSession) return
    setReflectionSaving(true)
    try {
      await fetch(`/api/sessions/${overviewSession.session_id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athlete_notes: reflectionText }),
      })
      setOverviewSession({ ...overviewSession, athlete_notes: reflectionText })
    } catch {
      // silently fail
    } finally {
      setReflectionSaving(false)
    }
  }, [overviewSession, reflectionText])

  useEffect(() => {
    if (!overviewVisible) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSessionOverview() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeSessionOverview, overviewVisible])

  // Build header subtitle from real HRV data if available
  const headerSubtitle = (() => {
    if (wellnessToday?.hrv_delta_14d_percent != null) {
      const pct = Math.round(Math.abs(wellnessToday.hrv_delta_14d_percent))
      const dir = wellnessToday.hrv_delta_14d_percent < 0 ? 'below' : 'above'
      return `HRV is ${pct}% ${dir} 14-day baseline.`
    }
    if (!hasIntervalsConnected) return 'Connect Intervals.icu in Settings to enable AI coaching.'
    return 'Wellness data syncing…'
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 4 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
            {formatHeaderDate()}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--fg-1)' }}>
            Today&apos;s training intelligence
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 6 }}>
            {headerSubtitle}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: 'var(--success)', marginRight: 6, verticalAlign: 'middle' }} />
            Synced from Garmin · 2m ago
          </span>
          <Button kind="ghost" size="md" icon="calendar-blank" onClick={() => setShowPlanModal(true)}>Training plan</Button>
          <Button kind="secondary" size="md" icon="plus">New session</Button>
        </div>
      </div>

      <TodaysSessionCard
        onOpenCoach={openCoach}
        onReviewWithCoach={startSessionReview}
        todayEvent={todayEvent}
        todaySession={todaySession}
        onCreateSession={() => setShowSessionModal(true)}
        sessionCreated={sessionCreated}
      />
      {showSessionModal && (
        <SessionCreationModal
          onClose={() => setShowSessionModal(false)}
          onSessionAdded={() => { setSessionCreated(true); setShowSessionModal(false); window.dispatchEvent(new CustomEvent('endurance:calendar-refresh')); router.refresh() }}
        />
      )}
      {showPlanModal && (
        <PlanCreationModal
          onClose={() => setShowPlanModal(false)}
          onPlanAdded={() => { setShowPlanModal(false); window.dispatchEvent(new CustomEvent('endurance:calendar-refresh')); router.refresh() }}
        />
      )}
      <ReadinessRow
        wellnessToday={wellnessToday}
        wellness14d={wellness14d}
        hasIntervalsConnected={hasIntervalsConnected}
        onConnect={() => router.push('/settings?section=connections')}
      />
      <WeekStrip
        weekSessions={weekSessions}
        weekEvents={weekEvents}
        onSessionSelect={openSessionOverview}
        selectedSessionId={overviewSession?.session_id ?? null}
      />
      <MemoryInbox onNavigateToContext={() => router.push('/context')} />
      {overviewSession && (
        <>
          <style>{`
            @keyframes tabFadeUp {
              from { opacity: 0; transform: translateY(6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <SessionOverviewModal
            session={overviewSession}
            visible={overviewVisible}
            reflectionText={reflectionText}
            reflectionSaving={reflectionSaving}
            reflectionRef={reflectionRef}
            onClose={closeSessionOverview}
            onReflectionChange={setReflectionText}
            onReflectionSave={saveReflection}
            onCoachOpen={() => { if (overviewSession) startSessionReview(overviewSession); closeSessionOverview() }}
          />
        </>
      )}
    </div>
  )
}

// ── TodaysSessionCard — 3 states ─────────────────────────────────────────────

interface TodaysSessionCardProps {
  onOpenCoach: () => void
  onReviewWithCoach: (session: SessionNoteRow) => void
  todayEvent?: IntervalEvent | null
  todaySession?: SessionNoteRow | null
  onCreateSession: () => void
  sessionCreated: boolean
}

function TodaysSessionCard({ onOpenCoach, onReviewWithCoach, todayEvent, todaySession, onCreateSession, sessionCreated }: TodaysSessionCardProps) {
  const [markingRest, setMarkingRest] = useState(false)
  const [markedRest, setMarkedRest] = useState(false)

  async function handleMarkRest() {
    setMarkingRest(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      await fetch('/api/intervals/rest-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today }),
      })
      setMarkedRest(true)
    } catch {
      // non-fatal
    } finally {
      setMarkingRest(false)
    }
  }

  // State 3: Session completed today (synced from Garmin)
  if (todaySession) {
    const s = todaySession
    const isCycling = s.session_type === 'cycling'
    const isRunning = s.session_type === 'running'

    function fmtDur(secs: number | null): string {
      if (!secs) return '—'
      const h = Math.floor(secs / 3600)
      const m = Math.floor((secs % 3600) / 60)
      return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m}min`
    }
    function fmtDist(meters: number | null): string {
      if (!meters) return '—'
      return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
    }
    function fmtPace(pacePerKm: number | null): string {
      if (!pacePerKm) return '—'
      const mins = Math.floor(pacePerKm)
      const secs = Math.round((pacePerKm - mins) * 60)
      return `${mins}:${String(secs).padStart(2, '0')} /km`
    }

    const statsRow: [string, string, string][] = [
      ['Time',     fmtDur(s.actual_duration_seconds),  ''],
      ['Distance', fmtDist(s.distance_meters),          ''],
      ...(isCycling && s.avg_power_watts != null
        ? [['Avg Power', String(Math.round(s.avg_power_watts)), 'W'] as [string,string,string]]
        : []),
      ...(isRunning && s.pace_per_km != null
        ? [['Avg Pace', fmtPace(s.pace_per_km), ''] as [string,string,string]]
        : []),
      ['TSS',      s.actual_tss != null ? String(Math.round(s.actual_tss)) : '—', ''],
    ]

    const ZONE_COLORS_DASH = ['#5C6470', '#3FB37F', '#E8C547', '#E89B3C', '#E5484D']
    const zoneSegments = (() => {
      const zones = s.zones
      if (!Array.isArray(zones) || zones.length === 0) return null
      const valid = (zones as Record<string, unknown>[]).filter(z => typeof z?.secs === 'number' && (z.secs as number) > 0)
      if (valid.length === 0) return null
      const total = valid.reduce((acc, z) => acc + (z.secs as number), 0)
      return valid.map((z) => ({
        flex: (z.secs as number) / total,
        color: ZONE_COLORS_DASH[Math.min((typeof z.id === 'number' ? z.id : 1) - 1, 4)],
      }))
    })()
    const sportColor = isCycling ? '#3FB37F' : isRunning ? '#E89B3C' : '#5C6470'

    return (
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>Today&apos;s session</div>
          <Pill color="success">Completed</Pill>
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--fg-1)', marginBottom: 14 }}>
          {s.activity_name || s.session_type || 'Workout'}
        </div>
        <div style={{ display: 'flex', gap: 28, marginBottom: 16 }}>
          {statsRow.map(([k, v, u]) => (
            <div key={k}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>{k}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: 'var(--fg-1)', letterSpacing: '-0.01em', marginTop: 4, lineHeight: 1 }}>
                {v}{u && <span style={{ fontSize: 11, color: 'var(--fg-3)', marginLeft: 4 }}>{u}</span>}
              </div>
            </div>
          ))}
        </div>
        {/* Zone bar */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex', gap: 1 }}>
            {zoneSegments
              ? zoneSegments.map((seg, i) => (
                  <div key={i} style={{ flex: seg.flex, background: seg.color }} />
                ))
              : <div style={{ flex: 1, background: sportColor, opacity: 0.5 }} />
            }
          </div>
        </div>
        <Button kind="ai" size="md" icon="sparkles" onClick={() => onReviewWithCoach(s)}>Review with Coach</Button>
      </div>
    )
  }

  // State 2: Session planned (from Intervals or AI generated)
  if ((todayEvent || sessionCreated) && !markedRest) {
    const event = todayEvent
    const name = event?.name ?? 'Session planned'
    const tss = event?.icu_training_load ?? null
    const zone = event ? getZoneFromName(event.name) : 'z2'
    const zoneLabel = { z1: 'Z1', z2: 'Z2', z3: 'Z3', z4: 'Z4 · Threshold', z5: 'Z5 · VO2' }[zone] ?? 'Z2'

    return (
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>Today&apos;s session</div>
          <Pill color={zone as 'z4'}>{zoneLabel}</Pill>
        </div>
        <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--fg-1)', marginBottom: 8 }}>{name}</div>
        {tss != null && (
          <div style={{ display: 'flex', gap: 28, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>TSS</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: 'var(--fg-1)', marginTop: 4, lineHeight: 1 }}>{tss}</div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button kind="secondary" size="md" icon="pencil-line">Edit</Button>
          <Button kind="ghost" size="md" icon="sparkles" onClick={onOpenCoach}>Discuss</Button>
        </div>
      </div>
    )
  }

  // State 1: No session planned
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
      {markedRest ? (
        <>
          <Icon name="moon" size={24} color="var(--fg-3)" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 4 }}>Rest day logged</div>
            <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>Intentional rest is part of the plan.</div>
          </div>
        </>
      ) : (
        <>
          <Icon name="calendar" size={24} color="var(--fg-3)" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 4 }}>No session planned today</div>
            <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>Rest intentionally or create a session with your coach.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button kind="ai" size="md" icon="sparkles" onClick={onCreateSession}>Create session</Button>
            <Button kind="ghost" size="md" icon="moon" onClick={handleMarkRest}>
              {markingRest ? 'Marking…' : 'Mark as rest day'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

// ── SessionCreationModal ─────────────────────────────────────────────────────

interface SessionCreationModalProps {
  onClose: () => void
  onSessionAdded: () => void
}

const SUGGESTED_PROMPTS = [
  'What do you recommend for today?',
  'I want to do VO2 intervals',
  'I need an easy recovery session',
  'I have 45 minutes — what fits?',
]

function uid(): string {
  return Math.random().toString(36).slice(2)
}

interface ModalMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  proposal?: ProposeSessionInput
}

function SessionCreationModal({ onClose, onSessionAdded }: SessionCreationModalProps) {
  const { streamChat, isStreaming } = useCoachChat()
  const [messages, setMessages] = useState<ModalMessage[]>([])
  const [input, setInput] = useState('')
  const [addingSession, setAddingSession] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isStreaming])

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

    const history: Array<{ role: 'user' | 'assistant'; content: string }> = messages
      .map((m) => ({ role: (m.role === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant', content: m.content }))
    history.push({ role: 'user', content: text })

    await streamChat(history, { contextType: 'session_creation' }, {
      onTextDelta: (delta) => {
        setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, content: m.content + delta } : m))
      },
      onComplete: ({ fullText, proposedSession }) => {
        setMessages((prev) => prev.map((m) => m.id === aiMsgId
          ? { ...m, content: fullText, ...(proposedSession ? { proposal: proposedSession } : {}) }
          : m
        ))
      },
      onError: (msg) => {
        setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, content: msg } : m))
      },
    })
  }, [messages, isStreaming, streamChat])

  async function handleAddSession(proposal: ProposeSessionInput, date: string) {
    setAddingSession(true)
    try {
      await fetch('/api/coach/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal, date }),
      })
      onSessionAdded()
    } catch {
      setAddingSession(false)
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        animation: 'fadeIn 150ms ease-out',
      }}
    >
      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
      <div style={{
        width: 700, maxHeight: '85vh',
        background: 'var(--bg-1)',
        border: '1px solid var(--border-default)',
        borderRadius: 14,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="sparkles" size={11} color="var(--ai)" />
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--fg-1)' }}>Create today&apos;s session</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>Tell me what you want to do, or ask what I recommend.</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--fg-4)', textAlign: 'center', marginBottom: 4 }}>Suggested</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    style={{
                      padding: '8px 14px', borderRadius: 20,
                      background: 'var(--bg-2)', border: '1px solid var(--border-default)',
                      color: 'var(--fg-2)', fontSize: 13, cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={m.id}>
              {m.role === 'user' ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--fg-1)', maxWidth: '80%', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {m.content}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Icon name="sparkles" size={11} color="var(--ai)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {m.content === '' && isStreaming && i === messages.length - 1 ? (
                      <ModalTypingDots />
                    ) : (
                      <>
                        <div style={{ background: 'rgba(139,124,246,0.06)', border: '1px solid rgba(139,124,246,0.16)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.55 }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                            p: ({ children }) => <p style={{ margin: '0 0 6px', lineHeight: 1.55 }}>{children}</p>,
                            strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                            ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</ul>,
                            ol: ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</ol>,
                            li: ({ children }) => <li style={{ fontSize: 13, lineHeight: 1.5 }}>{children}</li>,
                            code: ({ children }) => <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-3)', borderRadius: 3, padding: '1px 4px' }}>{children}</code>,
                          }}>
                            {m.content}
                          </ReactMarkdown>
                          {isStreaming && i === messages.length - 1 && <span style={{ opacity: 0.5 }}>▊</span>}
                        </div>
                        {m.proposal && (
                          <SessionProposalCard
                            proposal={m.proposal}
                            onAdd={(date) => handleAddSession(m.proposal!, date)}
                            onDecline={() => setMessages((prev) => prev.map((msg) => msg.id === m.id ? { ...msg, proposal: undefined } : msg))}
                            adding={addingSession}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Composer */}
        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '10px 12px' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
              placeholder="Ask about today's session, or describe what you want to do…"
              rows={2}
              disabled={isStreaming}
              style={{ background: 'transparent', border: 'none', outline: 'none', resize: 'none', color: 'var(--fg-1)', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, padding: 0 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isStreaming}
                style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: input.trim() && !isStreaming ? 'var(--accent)' : 'var(--bg-3)',
                  color: input.trim() && !isStreaming ? 'var(--accent-fg)' : 'var(--fg-4)',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
                }}
              >
                <Icon name="arrow-up" size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalTypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '8px 14px', background: 'rgba(139,124,246,0.06)', border: '1px solid rgba(139,124,246,0.16)', borderRadius: 10, width: 'fit-content' }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--ai)', animation: `dotPulse 1s ${i * 0.16}s infinite ease-in-out` }} />
      ))}
      <style>{`@keyframes dotPulse { 0%, 60%, 100% { opacity: 0.3 } 30% { opacity: 1 } }`}</style>
    </div>
  )
}

// ── ReadinessRow ─────────────────────────────────────────────────────────────

interface ReadinessRowProps {
  wellnessToday: WellnessCacheRow | null
  wellness14d: WellnessCacheRow[]
  hasIntervalsConnected: boolean
  onConnect: () => void
}

function ReadinessRow({ wellnessToday, wellness14d, hasIntervalsConnected, onConnect }: ReadinessRowProps) {
  if (!hasIntervalsConnected || (wellness14d.length === 0 && !wellnessToday)) {
    return (
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
        <Icon name="activity" size={24} color="var(--fg-3)" />
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg-1)', marginBottom: 4 }}>No wellness data yet</div>
          <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>Connect Intervals.icu to see HRV, sleep, and form metrics.</div>
        </div>
        <Button kind="secondary" size="sm" icon="plug" onClick={onConnect}>Connect Intervals.icu</Button>
      </div>
    )
  }

  const spark14 = (key: keyof WellnessCacheRow) =>
    wellness14d.map((w) => (w[key] as number | null) ?? 0)

  const hrv      = wellnessToday?.hrv_rmssd ?? null
  const hrvDelta = wellnessToday?.hrv_delta_14d_percent ?? null
  const restHR   = wellnessToday?.resting_hr ?? null
  const sleep    = wellnessToday?.sleep_hours ?? null
  const tsb      = wellnessToday?.tsb ?? null

  // Average resting HR over last 7 days for delta
  const hr7d = wellness14d.slice(-7).map((w) => w.resting_hr ?? 0).filter(Boolean)
  const avgHR7d = hr7d.length ? hr7d.reduce((s, v) => s + v, 0) / hr7d.length : null
  const hrDelta = restHR != null && avgHR7d != null ? Math.round(restHR - avgHR7d) : null

  const toneColor = { warning: '#E89B3C', danger: '#E5484D', neutral: 'var(--fg-3)' }

  const hrTone = hrDelta != null && hrDelta > 2 ? 'warning' : 'neutral'
  const hrvTone = hrvDelta != null && hrvDelta < -5 ? 'warning' : hrvDelta != null && hrvDelta < -10 ? 'danger' : 'neutral'
  const sleepTarget = 7.5
  const sleepDiff = sleep != null ? sleep - sleepTarget : null
  const sleepTone = sleepDiff != null && sleepDiff < -1.5 ? 'danger' : sleepDiff != null && sleepDiff < -0.5 ? 'warning' : 'neutral'

  function formatHrv() {
    if (hrv == null) return '—'
    return String(Math.round(hrv))
  }
  function formatHrvDelta() {
    if (hrvDelta == null) return '—'
    const sign = hrvDelta >= 0 ? '+' : ''
    return `${sign}${Math.round(hrvDelta)}% · 14d`
  }
  function formatHrDelta() {
    if (hrDelta == null) return '—'
    const sign = hrDelta >= 0 ? '+' : ''
    return `${sign}${hrDelta} · 7d`
  }
  function formatSleep() {
    if (sleep == null) return '—'
    const h = Math.floor(sleep)
    const m = Math.round((sleep - h) * 60)
    return `${h}:${String(m).padStart(2, '0')}`
  }
  function formatSleepDelta() {
    if (sleepDiff == null) return '—'
    const abs = Math.abs(sleepDiff)
    const h = Math.floor(abs)
    const m = Math.round((abs - h) * 60)
    const sign = sleepDiff >= 0 ? '+' : '−'
    return `${sign}${h}:${String(m).padStart(2, '0')} · target`
  }
  function formatTsb() {
    if (tsb == null) return '—'
    const sign = tsb >= 0 ? '+' : ''
    return `${sign}${Math.round(tsb)}`
  }

  const cards = [
    {
      k: 'HRV',
      v: formatHrv(),
      u: 'ms',
      delta: formatHrvDelta(),
      tone: hrvTone as keyof typeof toneColor,
      spark: spark14('hrv_rmssd'),
      baseline: wellness14d.slice(0, -1).map((w) => w.hrv_rmssd ?? 0).filter(Boolean).reduce((s, v, _, a) => s + v / a.length, 0) || undefined,
    },
    {
      k: 'Resting HR',
      v: restHR != null ? String(Math.round(restHR)) : '—',
      u: 'bpm',
      delta: formatHrDelta(),
      tone: hrTone as keyof typeof toneColor,
      spark: spark14('resting_hr'),
      baseline: avgHR7d ?? undefined,
    },
    {
      k: 'Sleep',
      v: formatSleep(),
      u: 'h',
      delta: formatSleepDelta(),
      tone: sleepTone as keyof typeof toneColor,
      spark: spark14('sleep_hours'),
      baseline: sleepTarget,
    },
    {
      k: 'Form (TSB)',
      v: formatTsb(),
      u: '',
      delta: tsb != null ? (tsb > 5 ? 'Fresh' : tsb < -10 ? 'Fatigued' : 'Building') : '—',
      tone: 'neutral' as keyof typeof toneColor,
      spark: spark14('tsb'),
      baseline: 0,
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {cards.map((c) => (
        <div key={c.k} style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>{c.k}</div>
            <Icon name="trending-down" size={12} color={toneColor[c.tone]} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 500, color: 'var(--fg-1)', letterSpacing: '-0.01em', lineHeight: 1 }}>{c.v}</span>
            {c.u && <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{c.u}</span>}
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: toneColor[c.tone], marginTop: 4 }}>{c.delta}</div>
          <div style={{ marginTop: 10 }}>
            <Sparkline data={c.spark} width={180} height={28} color={toneColor[c.tone]} baseline={c.baseline} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── WeekStrip ────────────────────────────────────────────────────────────────

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() + days)
  return toLocalDateStr(d)
}

function currentMondayStr(): string {
  const today = new Date()
  const d = new Date(today)
  d.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  d.setHours(0, 0, 0, 0)
  return toLocalDateStr(d)
}

type WeekGridPhase =
  | 'idle'
  | 'exit-left'
  | 'exit-right'
  | 'enter-left'
  | 'enter-right'
  | 'enter-settle'

function weekGridAnimStyle(phase: WeekGridPhase): React.CSSProperties {
  const t = 'opacity 150ms cubic-bezier(0.16,1,0.3,1), transform 150ms cubic-bezier(0.16,1,0.3,1)'
  switch (phase) {
    case 'idle':          return { opacity: 1, transform: 'none', transition: t }
    case 'exit-left':     return { opacity: 0, transform: 'translateX(-20px)', transition: t }
    case 'exit-right':    return { opacity: 0, transform: 'translateX(20px)', transition: t }
    case 'enter-left':    return { opacity: 0, transform: 'translateX(-20px)', transition: 'none' }
    case 'enter-right':   return { opacity: 0, transform: 'translateX(20px)', transition: 'none' }
    case 'enter-settle':  return { opacity: 1, transform: 'none', transition: t }
  }
}

interface WeekStripProps {
  weekSessions: SessionNoteRow[]
  weekEvents: IntervalEvent[]
  onSessionSelect?: (session: SessionNoteRow) => void
  selectedSessionId?: string | null
}

function WeekStrip({
  weekSessions: initialWeekSessions,
  weekEvents: initialWeekEvents,
  onSessionSelect,
  selectedSessionId,
}: WeekStripProps) {
  const zColors: Record<string, string> = { z1: '#5C6470', z2: '#3FB37F', z3: '#E8C547', z4: '#E89B3C', z5: '#E5484D' }
  const todayStr = toLocalDateStr(new Date())

  const [weekMonday, setWeekMonday] = useState(currentMondayStr)
  const [sessions, setSessions] = useState(initialWeekSessions)
  const [events, setEvents] = useState(initialWeekEvents)
  const [gridPhase, setGridPhase] = useState<WeekGridPhase>('idle')
  const [navigating, setNavigating] = useState(false)

  const weekSunday = addDaysToDateStr(weekMonday, 6)
  const viewingContainsToday = todayStr >= weekMonday && todayStr <= weekSunday

  const weekDates = Array.from({ length: 7 }, (_, i) => parseLocalDate(addDaysToDateStr(weekMonday, i)))

  const refetchCurrentWeek = useCallback(async () => {
    const sunday = addDaysToDateStr(weekMonday, 6)
    try {
      const res = await fetch(`/api/calendar?start=${weekMonday}&end=${sunday}`)
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions ?? [])
        setEvents(data.plannedEvents ?? [])
      }
    } catch { /* keep existing data */ }
  }, [weekMonday])

  useEffect(() => {
    const handler = () => { refetchCurrentWeek() }
    window.addEventListener('endurance:calendar-refresh', handler)
    return () => window.removeEventListener('endurance:calendar-refresh', handler)
  }, [refetchCurrentWeek])

  const navigateWeek = useCallback(async (dir: -1 | 1) => {
    if (navigating) return
    setNavigating(true)
    const newMonday = addDaysToDateStr(weekMonday, dir * 7)
    const goingForward = dir === 1
    const exitPhase: WeekGridPhase = goingForward ? 'exit-left' : 'exit-right'
    const enterPhase: WeekGridPhase = goingForward ? 'enter-right' : 'enter-left'
    setGridPhase(exitPhase)
    await new Promise((r) => setTimeout(r, 150))
    setWeekMonday(newMonday)
    const sunday = addDaysToDateStr(newMonday, 6)
    try {
      const res = await fetch(`/api/calendar?start=${newMonday}&end=${sunday}`)
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions ?? [])
        setEvents(data.plannedEvents ?? [])
      }
    } catch {
      // Keep existing data on fetch failure
    }
    setGridPhase(enterPhase)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setGridPhase('enter-settle')
        setTimeout(() => {
          setGridPhase('idle')
          setNavigating(false)
        }, 150)
      })
    })
  }, [navigating, weekMonday])

  // Index sessions by date (last one wins for display — typically one planned per day)
  const sessionByDate = new Map<string, SessionNoteRow>()
  for (const s of sessions) {
    sessionByDate.set(s.session_date, s)
  }

  // Index planned events by date, filtering out any that are already in session_notes
  // (matched by external_id === session_id) to avoid double-counting.
  const sessionIds = new Set(sessions.map(s => s.session_id))
  const eventByDate = new Map<string, IntervalEvent>()
  for (const e of events) {
    if (e.external_id && sessionIds.has(e.external_id)) continue
    const date = e.start_date_local.split('T')[0]
    eventByDate.set(date, e)
  }

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Sum TSS from sessions + non-duplicate events only
  const sessionsTss = sessions.reduce((acc, s) => acc + (s.planned_tss ?? s.actual_tss ?? 0), 0)
  const eventsTss = Array.from(eventByDate.values()).reduce((acc, e) => acc + (e.icu_training_load ?? 0), 0)
  const plannedTss = Math.round(sessionsTss + eventsTss)
  const weekLabel = `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '18px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>
            {viewingContainsToday ? 'This week' : 'Week'}
          </div>
          <span style={{ fontSize: 12, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>{weekLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {plannedTss > 0 && (
            <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              Planned TSS <span style={{ color: 'var(--fg-1)' }}>{Math.round(plannedTss)}</span>
            </span>
          )}
          <Button kind="ghost" size="sm" icon="chevron-left" onClick={() => navigateWeek(-1)} disabled={navigating} />
          <Button kind="ghost" size="sm" icon="chevron-right" onClick={() => navigateWeek(1)} disabled={navigating} />
        </div>
      </div>

      <div style={{ ...weekGridAnimStyle(gridPhase), display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderTop: '1px solid var(--border-subtle)' }}>
        {weekDates.map((date, i) => {
          const dateStr = toLocalDateStr(date)
          const session = sessionByDate.get(dateStr)
          const event   = eventByDate.get(dateStr)
          const isPast  = dateStr < todayStr
          const isToday = viewingContainsToday && dateStr === todayStr

          let state: 'done' | 'today' | 'planned' | 'off'
          let displayName: string | null = null
          let duration: string | null = null
          let tss: number | null = null
          let zone: string | null = null

          if (session) {
            const isSessionPlanned = session.actual_duration_seconds == null
            state = isToday ? 'today' : isSessionPlanned ? 'planned' : 'done'
            displayName = session.name || session.session_type ?? 'Workout'
            duration = formatDuration(isSessionPlanned ? session.planned_duration_seconds : session.actual_duration_seconds)
            tss = isSessionPlanned ? (session.planned_tss ?? null) : session.actual_tss
            zone = getZoneFromType(session.session_type)
          } else if (event) {
            state = isToday ? 'today' : 'planned'
            displayName = event.name
            duration = formatDuration(event.icu_training_load ? event.icu_training_load * 60 : null)
            tss = event.icu_training_load
            zone = getZoneFromName(event.name)
          } else if (isPast) {
            state = 'off'
          } else {
            state = 'off'
          }

          const isDone  = state === 'done'
          const isCurrent = state === 'today'
          const isSelected = session != null && selectedSessionId === session.session_id
          const zoneColor = zone ? (zColors[zone] ?? zColors.z2) : zColors.z2
          const cardBorderColor = isSelected ? 'var(--border-strong)' : 'var(--border-default)'
          const activityCardBorder = {
            borderTop: `1px solid ${cardBorderColor}`,
            borderRight: `1px solid ${cardBorderColor}`,
            borderBottom: `1px solid ${cardBorderColor}`,
            borderLeft: `2px solid ${zoneColor}`,
          } as const

          return (
            <div key={dateStr} style={{ padding: '14px 14px 18px', borderRight: i < 6 ? '1px solid var(--border-subtle)' : 'none', background: isCurrent ? 'var(--bg-3)' : 'transparent', position: 'relative' }}>
              {isCurrent && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--accent)' }} />}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: isCurrent ? 'var(--accent)' : 'var(--fg-3)', fontWeight: 500 }}>{dayNames[i]}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: isCurrent ? 'var(--fg-1)' : 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>{date.getDate()}</span>
              </div>

              {zone && displayName ? (
                session ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSessionSelect?.(session)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSessionSelect?.(session)
                      }
                    }}
                    style={{
                      padding: '8px 10px',
                      background: 'var(--bg-1)',
                      ...activityCardBorder,
                      borderRadius: 6,
                      opacity: isDone ? 0.55 : 1,
                      cursor: 'pointer',
                      boxShadow: isSelected ? 'inset 0 0 0 1px var(--border-strong)' : 'none',
                      transition: 'border-color 80ms, box-shadow 80ms',
                    }}
                  >
                    <div style={{ fontSize: 12, color: 'var(--fg-1)', fontWeight: 500, marginBottom: 4, textDecoration: isDone ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayName}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                      <span>{duration ?? '—'}</span>
                      {tss != null && tss > 0 && <span>{Math.round(tss)} TSS</span>}
                    </div>
                    {(session.fueling_carb_g_per_hour || session.fueling_fluid_ml_per_hour) && (
                      <div style={{ fontSize: 9, color: 'var(--ai)', fontFamily: 'var(--font-mono)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[
                          session.fueling_carb_g_per_hour ? `${session.fueling_carb_g_per_hour}g/h` : null,
                          session.fueling_fluid_ml_per_hour ? `${session.fueling_fluid_ml_per_hour}ml/h` : null,
                          session.fueling_sodium_mg_per_hour ? `${session.fueling_sodium_mg_per_hour}mg Na/h` : null,
                        ].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '8px 10px', background: 'var(--bg-1)', ...activityCardBorder, borderRadius: 6, opacity: isDone ? 0.55 : 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--fg-1)', fontWeight: 500, marginBottom: 4, textDecoration: isDone ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayName}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                      <span>{duration ?? '—'}</span>
                      {tss != null && tss > 0 && <span>{Math.round(tss)} TSS</span>}
                    </div>
                  </div>
                )
              ) : (
                <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--fg-3)', fontStyle: 'italic' }}>Off</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── MemoryInbox ───────────────────────────────────────────────────────────────

interface PendingSuggestion {
  id: string
  target_module: string
  target_field: string | null
  action_type: string
  suggested_value: string
  reasoning: string
  evidence: string | null
}

function MemoryInbox({ onNavigateToContext }: { onNavigateToContext: () => void }) {
  const [suggestions, setSuggestions] = useState<PendingSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/context/suggestions/pending')
      .then((r) => r.json())
      .then((d: { suggestions?: PendingSuggestion[] }) => setSuggestions(d.suggestions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleAction(id: string, action: 'accept' | 'reject') {
    setActing(id)
    try {
      const res = await fetch(`/api/context/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        setSuggestions((prev) => prev.filter((s) => s.id !== id))
      }
    } catch {
      // non-fatal
    } finally {
      setActing(null)
    }
  }

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '18px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>Memory updates</div>
          {suggestions.length > 0 && (
            <div style={{ width: 18, height: 18, borderRadius: 999, background: 'var(--ai)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)' }}>{suggestions.length}</span>
            </div>
          )}
        </div>
        <Button kind="ghost" size="sm" iconRight="arrow-right" onClick={onNavigateToContext}>Open Context</Button>
      </div>

      <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
        {loading ? (
          <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg-4)', fontSize: 13 }}>
            <Icon name="sparkles" size={13} color="var(--fg-4)" />
            Loading…
          </div>
        ) : suggestions.length === 0 ? (
          <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg-3)' }}>
            <Icon name="sparkles" size={13} color="var(--fg-4)" />
            <span style={{ fontSize: 13 }}>No pending memory updates.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {suggestions.map((s, i) => (
              <div
                key={s.id}
                style={{
                  padding: '14px 20px',
                  borderBottom: i < suggestions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Icon name="sparkles" size={11} color="var(--ai)" />
                  <span style={{ fontSize: 11, color: 'var(--ai)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {s.target_module.replace('_', ' ')}
                  </span>
                  {s.target_field && (
                    <span style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>→ {s.target_field}</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.5, marginBottom: 4 }}>
                  {s.suggested_value.length > 120 ? s.suggested_value.slice(0, 120) + '…' : s.suggested_value}
                </div>
                {s.evidence && (
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                    {s.evidence}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <Button
                    kind="ai"
                    size="sm"
                    icon="check"
                    onClick={() => handleAction(s.id, 'accept')}
                  >
                    {acting === s.id ? 'Saving…' : 'Accept'}
                  </Button>
                  <Button
                    kind="ghost"
                    size="sm"
                    icon="x"
                    onClick={() => handleAction(s.id, 'reject')}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
