'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Icon, Button, Pill } from '@/components/atoms'
import { useCoachPanel } from '@/components/app-shell'
import type { WellnessCacheRow, SessionNoteRow, IntervalEvent } from '@/lib/intervals/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const SPORT_COLORS: Record<string, string> = {
  cycling:  '#3FB37F',
  running:  '#E89B3C',
  swimming: '#5B9BD5',
  strength: '#E8C547',
  general:  '#5C6470',
}

const SPORT_LABELS: Record<string, string> = {
  cycling:  'Ride',
  running:  'Run',
  swimming: 'Swim',
  strength: 'Strength',
  general:  'Workout',
}

const EVENT_TYPE_MAP: Record<string, string> = {
  Ride: 'cycling', VirtualRide: 'cycling',
  Run: 'running',  Walk: 'running',
  Swim: 'swimming',
  WeightTraining: 'strength',
}

const ZONE_BAR_COLOR: Record<string, string> = {
  cycling:  '#3FB37F',
  running:  '#E89B3C',
  swimming: '#5B9BD5',
  strength: '#E8C547',
  general:  '#5C6470',
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface CalendarViewProps {
  initialSessions:      SessionNoteRow[]
  initialWellness:      WellnessCacheRow[]
  initialPlannedEvents: IntervalEvent[]
  initialTopMonday:     string
  todayStr:             string
}

// ── Grid animation state machine ──────────────────────────────────────────────

type GridPhase =
  | 'idle'
  | 'exit-left'    // sliding out to left (going forward)
  | 'exit-right'   // sliding out to right (going back)
  | 'enter-left'   // positioned off-screen left, no transition
  | 'enter-right'  // positioned off-screen right, no transition
  | 'enter-settle' // transitioning to normal position

function gridAnimStyle(phase: GridPhase): React.CSSProperties {
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

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, days: number): string {
  const d = parseLocal(dateStr)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

function currentMondayStr(): string {
  const today = new Date()
  const d = new Date(today)
  d.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  d.setHours(0, 0, 0, 0)
  return toDateStr(d)
}

function getISOWeek(dateStr: string): number {
  const src = parseLocal(dateStr)
  const d = new Date(Date.UTC(src.getFullYear(), src.getMonth(), src.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - jan1.getTime()) / 86400000) + 1) / 7)
}

function formatDuration(secs: number | null): string {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}

function formatWeekRange(mondayStr: string): string {
  const mon = parseLocal(mondayStr)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`
  return mon.getMonth() === sun.getMonth()
    ? `${mon.getDate()} – ${fmt(sun)}`
    : `${fmt(mon)} – ${fmt(sun)}`
}

function formatDayDate(dateStr: string): string {
  const d = parseLocal(dateStr)
  return `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`
}

function formatModalDate(dateStr: string): string {
  const d = parseLocal(dateStr)
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ── Domain helpers ────────────────────────────────────────────────────────────

const getSportColor = (s: string | null) => SPORT_COLORS[s ?? ''] ?? '#5C6470'
const getSportLabel = (s: string | null) => SPORT_LABELS[s ?? ''] ?? 'Workout'
const getZoneColor  = (s: string | null) => ZONE_BAR_COLOR[s ?? ''] ?? '#5C6470'

function getHrvStatus(w: WellnessCacheRow | undefined) {
  if (!w?.hrv_rmssd || w.hrv_delta_14d_percent == null) return null
  const d = w.hrv_delta_14d_percent
  if (d > -10)  return '#3FB37F'
  if (d > -20)  return '#E89B3C'
  return '#E5484D'
}

// ── Root component ────────────────────────────────────────────────────────────

export default function CalendarView({
  initialSessions,
  initialWellness,
  initialPlannedEvents,
  initialTopMonday,
  todayStr,
}: CalendarViewProps) {
  const { openCoach } = useCoachPanel()

  // Calendar data state
  const [topMonday, setTopMonday]       = useState(initialTopMonday)
  const [sessions, setSessions]         = useState(initialSessions)
  const [wellness, setWellness]         = useState(initialWellness)
  const [plannedEvents, setPlannedEvents] = useState(initialPlannedEvents)

  // Grid animation state
  const [gridPhase, setGridPhase] = useState<GridPhase>('idle')
  const [navigating, setNavigating] = useState(false)

  // Modal state
  const [modalSession, setModalSession]   = useState<SessionNoteRow | null>(null)
  const [modalVisible, setModalVisible]   = useState(false)
  const [reflectionText, setReflectionText] = useState('')
  const [reflectionSaving, setReflectionSaving] = useState(false)
  const reflectionRef = useRef<HTMLTextAreaElement>(null)

  // ── Build lookup maps ───────────────────────────────────────────────────────

  const sessionsByDate = new Map<string, SessionNoteRow[]>()
  sessions.forEach(s => {
    const arr = sessionsByDate.get(s.session_date) ?? []
    sessionsByDate.set(s.session_date, [...arr, s])
  })

  const wellnessByDate = new Map<string, WellnessCacheRow>()
  wellness.forEach(w => wellnessByDate.set(w.date, w))

  const eventsByDate = new Map<string, IntervalEvent[]>()
  plannedEvents.forEach(e => {
    const date = e.start_date_local.split('T')[0]
    const arr = eventsByDate.get(date) ?? []
    eventsByDate.set(date, [...arr, e])
  })

  // ── Build 4 week rows (index 0 = most recent, shown at top) ─────────────────

  const weeks = [0, 1, 2, 3].map(i => {
    const mondayStr = addDays(topMonday, -i * 7)
    const sundayStr = addDays(mondayStr, 6)
    const days      = Array.from({ length: 7 }, (_, d) => addDays(mondayStr, d))

    const wkSessions = sessions.filter(
      s => s.session_date >= mondayStr && s.session_date <= sundayStr
    )

    let wkWellness: WellnessCacheRow | undefined
    for (let d = 6; d >= 0; d--) {
      const w = wellnessByDate.get(addDays(mondayStr, d))
      if (w) { wkWellness = w; break }
    }

    const totalTimeSecs = wkSessions.reduce((acc, s) => acc + (s.actual_duration_seconds ?? 0), 0)
    const totalTss      = Math.round(wkSessions.reduce((acc, s) => acc + (s.actual_tss ?? 0), 0))
    const sportBreakdown: Record<string, number> = {}
    wkSessions.forEach(s => {
      const sp = s.sport ?? 'general'
      sportBreakdown[sp] = (sportBreakdown[sp] ?? 0) + (s.actual_duration_seconds ?? 0)
    })

    return {
      mondayStr, sundayStr, days,
      weekNum: getISOWeek(mondayStr),
      range:   formatWeekRange(mondayStr),
      totalTimeSecs, totalTss,
      ctl: wkWellness?.ctl ?? null,
      atl: wkWellness?.atl ?? null,
      tsb: wkWellness?.tsb ?? null,
      sportBreakdown,
    }
  })

  // ── Navigation ──────────────────────────────────────────────────────────────

  const navigate = useCallback(async (dir: -1 | 1 | 0) => {
    if (navigating) return
    setNavigating(true)

    const newTopMonday = dir === 0 ? currentMondayStr() : addDays(topMonday, dir * 7)

    // Determine slide direction based on whether we're moving forward or back in time
    const goingForward = dir === 1 || (dir === 0 && newTopMonday >= topMonday)
    const exitPhase: GridPhase  = goingForward ? 'exit-left'  : 'exit-right'
    const enterPhase: GridPhase = goingForward ? 'enter-right' : 'enter-left'

    setGridPhase(exitPhase)
    await new Promise(r => setTimeout(r, 150))

    setTopMonday(newTopMonday)

    const windowStart = addDays(newTopMonday, -21)
    const windowEnd   = addDays(newTopMonday, 6)

    try {
      const res = await fetch(`/api/calendar?start=${windowStart}&end=${windowEnd}`)
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions ?? [])
        setWellness(data.wellness ?? [])
        setPlannedEvents(data.plannedEvents ?? [])
      }
    } catch {
      // keep existing data on network error
    }

    // Jump to off-screen position (no transition), then settle
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
  }, [navigating, topMonday])

  // ── Modal ───────────────────────────────────────────────────────────────────

  const openModal = useCallback((session: SessionNoteRow) => {
    setModalSession(session)
    setReflectionText(session.athlete_notes ?? '')
    requestAnimationFrame(() => requestAnimationFrame(() => setModalVisible(true)))
  }, [])

  const closeModal = useCallback(() => {
    setModalVisible(false)
    setTimeout(() => setModalSession(null), 120)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeModal])

  // ── Reflection save ─────────────────────────────────────────────────────────

  const saveReflection = useCallback(async () => {
    if (!modalSession) return
    setReflectionSaving(true)
    try {
      await fetch(`/api/sessions/${modalSession.session_id}/notes`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ athlete_notes: reflectionText }),
      })
      const updated = { ...modalSession, athlete_notes: reflectionText }
      setModalSession(updated)
      setSessions(prev => prev.map(s =>
        s.session_id === modalSession.session_id ? updated : s
      ))
    } catch {
      // silently fail if column not yet in DB
    } finally {
      setReflectionSaving(false)
    }
  }, [modalSession, reflectionText])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
              Calendar
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
              Training Calendar
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button kind="secondary" size="md" icon="chevron-left"
              onClick={() => navigate(-1)} />
            <Button kind="secondary" size="md"
              onClick={() => navigate(0)}>Today</Button>
            <Button kind="secondary" size="md" icon="chevron-right"
              onClick={() => navigate(1)} />
          </div>
        </div>

        {/* Animated grid wrapper */}
        <div style={gridAnimStyle(gridPhase)}>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>

            {/* Column header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px repeat(7, 1fr)', background: 'var(--bg-1)', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ padding: '8px 14px', fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
                Week
              </div>
              {DAYS.map(d => (
                <div key={d} style={{ padding: '8px 8px', fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', borderLeft: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Week rows */}
            {weeks.map((wk, wi) => (
              <div key={wi} style={{
                display: 'grid',
                gridTemplateColumns: '200px repeat(7, 1fr)',
                borderBottom: wi < weeks.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}>
                <WeekInfoCell wk={wk} />
                {wk.days.map((dateStr, di) => (
                  <DayCell
                    key={di}
                    dateStr={dateStr}
                    sessions={sessionsByDate.get(dateStr) ?? []}
                    events={eventsByDate.get(dateStr) ?? []}
                    wellness={wellnessByDate.get(dateStr)}
                    isToday={dateStr === todayStr}
                    selectedId={modalSession?.session_id ?? null}
                    onSelect={openModal}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Session modal — rendered outside the animated grid */}
      {modalSession && (
        <SessionModal
          session={modalSession}
          visible={modalVisible}
          reflectionText={reflectionText}
          reflectionSaving={reflectionSaving}
          reflectionRef={reflectionRef}
          onClose={closeModal}
          onReflectionChange={setReflectionText}
          onReflectionSave={saveReflection}
          onCoachOpen={() => { closeModal(); openCoach() }}
        />
      )}
    </>
  )
}

// ── WeekInfoCell ──────────────────────────────────────────────────────────────

interface WeekInfoCellProps {
  wk: {
    weekNum: number; range: string
    totalTimeSecs: number; totalTss: number
    ctl: number | null; atl: number | null; tsb: number | null
    sportBreakdown: Record<string, number>
  }
}

function WeekInfoCell({ wk }: WeekInfoCellProps) {
  const mono = { fontFamily: 'var(--font-mono)' } as const
  const lbl  = { ...mono, fontSize: 9,  color: 'var(--fg-4)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }
  const val  = { ...mono, fontSize: 11, fontWeight: 600 as const, color: 'var(--fg-1)' }
  const row  = { display: 'flex', alignItems: 'baseline', gap: 4 } as const
  const pair = { display: 'flex', alignItems: 'baseline', gap: 3 } as const

  const tsbColor = wk.tsb == null ? 'var(--fg-2)' : wk.tsb > 5 ? '#3FB37F' : wk.tsb < -20 ? '#E5484D' : 'var(--fg-2)'

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 3, minHeight: 90 }}>
      <div style={{ ...mono, fontSize: 12, fontWeight: 600, color: 'var(--fg-1)' }}>Week {wk.weekNum}</div>
      <div style={{ ...mono, fontSize: 10, color: 'var(--fg-3)', marginBottom: 4 }}>{wk.range}</div>

      {wk.totalTimeSecs > 0 && (
        <div style={row}><span style={lbl}>Time</span><span style={val}>{formatDuration(wk.totalTimeSecs)}</span></div>
      )}
      {wk.totalTss > 0 && (
        <div style={row}><span style={lbl}>Load</span><span style={val}>{wk.totalTss}</span></div>
      )}
      {(wk.ctl != null || wk.atl != null) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          {wk.ctl != null && <div style={pair}><span style={lbl}>CTL</span><span style={{ ...mono, fontSize: 10, color: 'var(--fg-2)' }}>{Math.round(wk.ctl)}</span></div>}
          {wk.atl != null && <div style={pair}><span style={lbl}>ATL</span><span style={{ ...mono, fontSize: 10, color: 'var(--fg-2)' }}>{Math.round(wk.atl)}</span></div>}
          {wk.tsb != null && <div style={pair}><span style={lbl}>Form</span><span style={{ ...mono, fontSize: 10, color: tsbColor }}>{Math.round(wk.tsb) > 0 ? '+' : ''}{Math.round(wk.tsb)}</span></div>}
        </div>
      )}
      {Object.entries(wk.sportBreakdown).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', marginTop: 3 }}>
          {Object.entries(wk.sportBreakdown).map(([sp, secs]) => (
            <div key={sp} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: getSportColor(sp) }} />
              <span style={{ ...mono, fontSize: 9, color: 'var(--fg-3)' }}>{formatDuration(secs)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── DayCell ───────────────────────────────────────────────────────────────────

interface DayCellProps {
  dateStr: string; sessions: SessionNoteRow[]
  events: IntervalEvent[]; wellness: WellnessCacheRow | undefined
  isToday: boolean; selectedId: string | null
  onSelect: (s: SessionNoteRow) => void
}

function DayCell({ dateStr, sessions, events, wellness, isToday, selectedId, onSelect }: DayCellProps) {
  const hrvColor = getHrvStatus(wellness)

  return (
    <div style={{
      borderLeft: '1px solid var(--border-subtle)',
      padding: '8px 6px',
      minHeight: 90,
      background: isToday ? 'rgba(139,124,246,0.04)' : 'transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
        {hrvColor && (
          <>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: hrvColor, flexShrink: 0 }} />
            {wellness?.resting_hr && (
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>
                {wellness.resting_hr}
              </span>
            )}
          </>
        )}
        <span style={{
          fontSize: 11, fontFamily: 'var(--font-mono)',
          color: isToday ? 'var(--accent)' : 'var(--fg-3)',
          fontWeight: isToday ? 600 : 400,
        }}>
          {formatDayDate(dateStr)}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sessions.map(s => (
          <SessionCard
            key={s.session_id}
            session={s}
            isSelected={selectedId === s.session_id}
            onClick={() => onSelect(s)}
          />
        ))}
        {events.map((e, i) => <PlannedEventCard key={i} event={e} />)}
      </div>
    </div>
  )
}

// ── SessionCard ───────────────────────────────────────────────────────────────

function SessionCard({ session, isSelected, onClick }: {
  session: SessionNoteRow; isSelected: boolean; onClick: () => void
}) {
  const sportColor = getSportColor(session.sport)
  const zoneColor  = getZoneColor(session.sport)
  const sportLabel = getSportLabel(session.sport)
  const power      = session.normalized_power_watts ?? session.avg_power_watts

  return (
    <div
      onClick={onClick}
      style={{
        padding: '6px 8px',
        background: 'var(--bg-1)',
        borderTop:    `1px solid ${isSelected ? 'var(--border-strong)' : 'var(--border-default)'}`,
        borderRight:  `1px solid ${isSelected ? 'var(--border-strong)' : 'var(--border-default)'}`,
        borderBottom: `1px solid ${isSelected ? 'var(--border-strong)' : 'var(--border-default)'}`,
        borderLeft:   `2px solid ${sportColor}`,
        borderRadius: 5,
        cursor: 'pointer',
        width: '100%',
        boxSizing: 'border-box',
        boxShadow: isSelected ? 'inset 0 0 0 1px var(--border-strong)' : 'none',
        transition: 'border-color 80ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: sportColor, fontWeight: 700, lineHeight: 1 }}>
          {sportLabel.slice(0, 1)}
        </span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', fontWeight: 500 }}>
          {formatDuration(session.actual_duration_seconds)}
        </span>
      </div>

      {(session.avg_hr != null || power != null) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {session.avg_hr != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Icon name="heart" size={9} color="var(--fg-4)" />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                {Math.round(session.avg_hr)}
              </span>
            </div>
          )}
          {power != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Icon name="zap" size={9} color="var(--fg-4)" />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                {Math.round(power)}W
              </span>
            </div>
          )}
        </div>
      )}

      {session.actual_tss != null && (
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginBottom: 3 }}>
          Load {Math.round(session.actual_tss)}
        </div>
      )}

      <div style={{ height: 3, borderRadius: 2, background: zoneColor, opacity: 0.8, marginBottom: 3 }} />
      <div style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>{sportLabel}</div>
    </div>
  )
}

// ── PlannedEventCard ──────────────────────────────────────────────────────────

function PlannedEventCard({ event }: { event: IntervalEvent }) {
  const sport      = EVENT_TYPE_MAP[event.type] ?? 'general'
  const sportColor = getSportColor(sport)
  const label      = event.name || getSportLabel(sport)

  return (
    <div style={{
      padding: '6px 8px', background: 'transparent',
      border: '1px dashed var(--border-subtle)',
      borderRadius: 5, borderLeft: `2px dashed ${sportColor}`,
      opacity: 0.65, width: '100%', boxSizing: 'border-box',
    }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)', fontWeight: 500, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </div>
      {event.icu_training_load > 0 && (
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>
          Load {Math.round(event.icu_training_load)}
        </div>
      )}
    </div>
  )
}

// ── SessionModal ──────────────────────────────────────────────────────────────

interface SessionModalProps {
  session:          SessionNoteRow
  visible:          boolean
  reflectionText:   string
  reflectionSaving: boolean
  reflectionRef:    React.RefObject<HTMLTextAreaElement | null>
  onClose:          () => void
  onReflectionChange: (v: string) => void
  onReflectionSave:   () => void
  onCoachOpen:      () => void
}

function SessionModal({
  session, visible, reflectionText, reflectionSaving, reflectionRef,
  onClose, onReflectionChange, onReflectionSave, onCoachOpen,
}: SessionModalProps) {
  const sportColor = getSportColor(session.sport)
  const sportLabel = getSportLabel(session.sport)
  const zoneColor  = getZoneColor(session.sport)
  const isCycling  = session.sport === 'cycling'
  const isRunning  = session.sport === 'running'
  const power      = session.normalized_power_watts ?? session.avg_power_watts

  type Stat = [string, string]
  const stats: Stat[] = [
    ['Time', formatDuration(session.actual_duration_seconds)],
    ...(session.avg_hr != null
      ? [['Avg HR', `${Math.round(session.avg_hr)} bpm`] as Stat] : []),
    ...(session.actual_tss != null
      ? [['Load', String(Math.round(session.actual_tss))] as Stat] : []),
    ...(isCycling && session.avg_power_watts != null
      ? [['Avg P', `${Math.round(session.avg_power_watts)} W`] as Stat] : []),
    ...(isCycling && session.normalized_power_watts != null
      ? [['NP', `${Math.round(session.normalized_power_watts)} W`] as Stat] : []),
    ...(session.cardiac_drift_percent != null
      ? [['Drift', `+${Math.round(session.cardiac_drift_percent)}%`] as Stat] : []),
  ]

  const overlayStyle: React.CSSProperties = {
    position:  'fixed',
    inset:     0,
    zIndex:    200,
    background: 'rgba(0,0,0,0.6)',
    display:   'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity:    visible ? 1 : 0,
    transition: 'opacity 150ms cubic-bezier(0.16,1,0.3,1)',
    pointerEvents: visible ? 'auto' : 'none',
  }

  const panelStyle: React.CSSProperties = {
    width:     680,
    maxHeight: '85vh',
    overflowY: 'auto',
    background: 'var(--bg-2)',
    border:     '1px solid var(--border-default)',
    borderRadius: 12,
    opacity:   visible ? 1 : 0,
    transform: visible ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(8px)',
    transition: 'opacity 150ms cubic-bezier(0.16,1,0.3,1), transform 150ms cubic-bezier(0.16,1,0.3,1)',
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${sportColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: sportColor }}>
                  {sportLabel.slice(0, 1)}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--fg-1)' }}>{sportLabel}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                  {formatModalDate(session.session_date)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Pill color="success">Completed</Pill>
              <button
                onClick={onClose}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 4 }}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Actuals */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)', marginBottom: 12 }}>
            Actuals
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 14 }}>
            {stats.map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--fg-1)', marginTop: 3 }}>{v}</div>
              </div>
            ))}
          </div>
          {/* Zone bar */}
          <div>
            <div style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
              Zone distribution
            </div>
            <div style={{ height: 8, borderRadius: 4, background: zoneColor, opacity: 0.85 }} />
            <div style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', marginTop: 5 }}>
              Zone breakdown unavailable
            </div>
          </div>
        </div>

        {/* AI Summary */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(139,124,246,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Icon name="sparkles" size={11} color="var(--ai)" />
            <span style={{ fontSize: 10, color: 'var(--ai)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              AI Summary
            </span>
          </div>
          {session.ai_summary ? (
            <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.6 }}>
              {session.ai_summary}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--fg-3)', fontStyle: 'italic' }}>
                No summary yet.
              </div>
              <Button kind="ai" size="sm" icon="sparkles" onClick={onCoachOpen}>
                Analyse this session
              </Button>
            </div>
          )}
        </div>

        {/* Reflection */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Your Reflection
          </div>
          <textarea
            ref={reflectionRef}
            value={reflectionText}
            onChange={e => onReflectionChange(e.target.value)}
            onBlur={onReflectionSave}
            placeholder="Add a reflection…"
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--bg-1)', border: '1px solid var(--border-subtle)',
              borderRadius: 6, padding: '8px 10px',
              fontSize: 13, color: 'var(--fg-1)',
              fontFamily: 'var(--font-sans)', lineHeight: 1.5,
              resize: 'vertical', outline: 'none',
            }}
          />
          {reflectionSaving && (
            <div style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              Saving…
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button kind="ai" size="sm" icon="sparkles" onClick={onCoachOpen}>
            Review with Coach
          </Button>
          <Button kind="secondary" size="sm" icon="pencil-line">
            Edit
          </Button>
          <div style={{ flex: 1 }} />
          {session.review_conversation_id ? (
            <Button kind="ghost" size="sm" icon="message-square">
              View session review
            </Button>
          ) : (
            <Button kind="ghost" size="sm" icon="message-square" onClick={onCoachOpen}>
              Review with Coach
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
