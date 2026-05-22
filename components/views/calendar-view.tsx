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

const ZONE_COLORS = ['#5C6470', '#3FB37F', '#E8C547', '#E89B3C', '#E5484D']

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
  | 'exit-left'
  | 'exit-right'
  | 'enter-left'
  | 'enter-right'
  | 'enter-settle'

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

function formatDuration(secs: number | null | undefined): string {
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
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDistance(meters: number | null | undefined): string {
  if (!meters) return '—'
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

function formatPace(pacePerKm: number | null | undefined): string {
  if (!pacePerKm) return '—'
  const mins = Math.floor(pacePerKm)
  const secs = Math.round((pacePerKm - mins) * 60)
  return `${mins}:${String(secs).padStart(2, '0')} /km`
}

function speedToPace(speedMps: number | null | undefined): number | null {
  if (!speedMps || speedMps <= 0) return null
  return (1000 / speedMps) / 60
}

// ── Domain helpers ────────────────────────────────────────────────────────────

const getSportColor = (s: string | null) => SPORT_COLORS[s ?? ''] ?? '#5C6470'
const getSportLabel = (s: string | null) => SPORT_LABELS[s ?? ''] ?? 'Workout'

function getHrvStatus(w: WellnessCacheRow | undefined) {
  if (!w?.hrv_rmssd || w.hrv_delta_14d_percent == null) return null
  const d = w.hrv_delta_14d_percent
  if (d > -10)  return '#3FB37F'
  if (d > -20)  return '#E89B3C'
  return '#E5484D'
}

// ── Zone helpers ──────────────────────────────────────────────────────────────

interface ZoneSegment { id: number; secs: number; color: string }

function parseZoneSegments(zones: unknown): ZoneSegment[] | null {
  if (!Array.isArray(zones) || zones.length === 0) return null
  const valid = (zones as Record<string, unknown>[]).filter(
    (z) => typeof z?.secs === 'number' && (z.secs as number) > 0
  )
  if (valid.length === 0) return null
  return valid.map((z) => {
    const id = typeof z.id === 'number' ? (z.id as number) : 1
    return { id, secs: z.secs as number, color: ZONE_COLORS[Math.min(id - 1, 4)] }
  })
}

function ZoneBar({ zones, fallbackColor, height = 6 }: {
  zones: unknown; fallbackColor: string; height?: number
}) {
  const segments = parseZoneSegments(zones)
  if (!segments) {
    return <div style={{ height, borderRadius: height / 2, background: fallbackColor, opacity: 0.75 }} />
  }
  const total = segments.reduce((s, z) => s + z.secs, 0)
  return (
    <div style={{ display: 'flex', height, borderRadius: height / 2, overflow: 'hidden', gap: 1 }}>
      {segments.map(seg => (
        <div key={seg.id} style={{ flex: seg.secs / total, background: seg.color }} />
      ))}
    </div>
  )
}

function ZoneLabels({ zones }: { zones: unknown }) {
  const segments = parseZoneSegments(zones)
  if (!segments) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 8 }}>
      {segments.map(seg => (
        <div key={seg.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
            Z{seg.id} · {formatDuration(seg.secs)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Laps helper ───────────────────────────────────────────────────────────────

interface LapData {
  name: string
  elapsed_time: number | null
  average_watts: number | null
  normalized_watts: number | null
  average_heartrate: number | null
  average_speed: number | null
  distance: number | null
  icu_training_load: number | null
  total_elevation_gain: number | null
}

function parseLaps(data: unknown): LapData[] | null {
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>
  const groups = Array.isArray(obj.icu_groups) ? obj.icu_groups : null
  if (!groups || groups.length === 0) return null
  return (groups as Record<string, unknown>[]).map((g, i) => ({
    name: typeof g.name === 'string' ? g.name : `Lap ${i + 1}`,
    elapsed_time: typeof g.elapsed_time === 'number' ? g.elapsed_time : null,
    average_watts: typeof g.average_watts === 'number' ? g.average_watts : null,
    normalized_watts: typeof g.normalized_watts === 'number' ? g.normalized_watts : null,
    average_heartrate: typeof g.average_heartrate === 'number' ? g.average_heartrate : null,
    average_speed: typeof g.average_speed === 'number' ? g.average_speed : null,
    distance: typeof g.distance === 'number' ? g.distance : null,
    icu_training_load: typeof g.icu_training_load === 'number' ? g.icu_training_load : null,
    total_elevation_gain: typeof g.total_elevation_gain === 'number' ? g.total_elevation_gain : null,
  }))
}

function parseBestEffort(gaps: unknown, targetSecs: number): number | null {
  if (!Array.isArray(gaps)) return null
  const entry = (gaps as { secs?: number; watts?: number }[]).find(g => g.secs === targetSecs)
  return typeof entry?.watts === 'number' ? entry.watts : null
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

  const [topMonday, setTopMonday]         = useState(initialTopMonday)
  const [sessions, setSessions]           = useState(initialSessions)
  const [wellness, setWellness]           = useState(initialWellness)
  const [plannedEvents, setPlannedEvents] = useState(initialPlannedEvents)
  const [gridPhase, setGridPhase]         = useState<GridPhase>('idle')
  const [navigating, setNavigating]       = useState(false)
  const [modalSession, setModalSession]   = useState<SessionNoteRow | null>(null)
  const [modalVisible, setModalVisible]   = useState(false)
  const [reflectionText, setReflectionText]     = useState('')
  const [reflectionSaving, setReflectionSaving] = useState(false)
  const reflectionRef = useRef<HTMLTextAreaElement>(null)

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

  const navigate = useCallback(async (dir: -1 | 1 | 0) => {
    if (navigating) return
    setNavigating(true)
    const newTopMonday = dir === 0 ? currentMondayStr() : addDays(topMonday, dir * 7)
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
    } catch { /* keep existing data */ }
    setGridPhase(enterPhase)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setGridPhase('enter-settle')
        setTimeout(() => { setGridPhase('idle'); setNavigating(false) }, 150)
      })
    })
  }, [navigating, topMonday])

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
    } catch { /* silently fail */ }
    finally { setReflectionSaving(false) }
  }, [modalSession, reflectionText])

  return (
    <>
      <style>{`
        @keyframes tabFadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            <Button kind="secondary" size="md" icon="chevron-left" onClick={() => navigate(-1)} />
            <Button kind="secondary" size="md" onClick={() => navigate(0)}>Today</Button>
            <Button kind="secondary" size="md" icon="chevron-right" onClick={() => navigate(1)} />
          </div>
        </div>

        <div style={gridAnimStyle(gridPhase)}>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '200px repeat(7, 1fr)', background: 'var(--bg-1)', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ padding: '8px 14px', fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>Week</div>
              {DAYS.map(d => (
                <div key={d} style={{ padding: '8px 8px', fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', borderLeft: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)' }}>
                  {d}
                </div>
              ))}
            </div>

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

function WeekInfoCell({ wk }: {
  wk: {
    weekNum: number; range: string
    totalTimeSecs: number; totalTss: number
    ctl: number | null; atl: number | null; tsb: number | null
    sportBreakdown: Record<string, number>
  }
}) {
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

function DayCell({ dateStr, sessions, events, wellness, isToday, selectedId, onSelect }: {
  dateStr: string; sessions: SessionNoteRow[]
  events: IntervalEvent[]; wellness: WellnessCacheRow | undefined
  isToday: boolean; selectedId: string | null
  onSelect: (s: SessionNoteRow) => void
}) {
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
  const sportLabel = getSportLabel(session.sport)
  const isCycling  = session.sport === 'cycling'
  const isRunning  = session.sport === 'running'
  const power      = session.normalized_power_watts ?? session.avg_power_watts
  const showElevation = (session.elevation_gain_meters ?? 0) > 100

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
      {/* Duration + distance */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: sportColor, fontWeight: 700 }}>
          {sportLabel.slice(0, 1)}
        </span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', fontWeight: 500 }}>
          {formatDuration(session.actual_duration_seconds)}
        </span>
        {session.distance_meters != null && (
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
            · {formatDistance(session.distance_meters)}
          </span>
        )}
      </div>

      {/* Power (cycling) or Pace (running) + HR */}
      {(session.avg_hr != null || power != null || session.pace_per_km != null) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {session.avg_hr != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Icon name="heart" size={9} color="var(--fg-4)" />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                {Math.round(session.avg_hr)}
              </span>
            </div>
          )}
          {isCycling && power != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Icon name="zap" size={9} color="var(--fg-4)" />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                {Math.round(power)}W
              </span>
            </div>
          )}
          {isRunning && session.pace_per_km != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Icon name="timer" size={9} color="var(--fg-4)" />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                {formatPace(session.pace_per_km)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* TSS + elevation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
        {session.actual_tss != null && (
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
            Load {Math.round(session.actual_tss)}
          </span>
        )}
        {showElevation && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Icon name="trending-up" size={9} color="var(--fg-4)" />
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
              {Math.round(session.elevation_gain_meters!)}m
            </span>
          </div>
        )}
      </div>

      {/* Zone bar — uses real zone data if available */}
      <ZoneBar zones={session.zones} fallbackColor={sportColor} height={3} />
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

type SessionTab = 'overview' | 'power' | 'heartrate' | 'laps'

interface SessionModalProps {
  session:            SessionNoteRow
  visible:            boolean
  reflectionText:     string
  reflectionSaving:   boolean
  reflectionRef:      React.RefObject<HTMLTextAreaElement | null>
  onClose:            () => void
  onReflectionChange: (v: string) => void
  onReflectionSave:   () => void
  onCoachOpen:        () => void
}

function SessionModal({
  session, visible, reflectionText, reflectionSaving, reflectionRef,
  onClose, onReflectionChange, onReflectionSave, onCoachOpen,
}: SessionModalProps) {
  const [activeTab, setActiveTab] = useState<SessionTab>('overview')

  // Reset tab when session changes
  useEffect(() => { setActiveTab('overview') }, [session.session_id])

  const isCycling  = session.sport === 'cycling'
  const isRunning  = session.sport === 'running'
  const isSwimming = session.sport === 'swimming'
  const sportColor = getSportColor(session.sport)
  const sportLabel = getSportLabel(session.sport)

  const tabs: { id: SessionTab; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    ...(isCycling ? [{ id: 'power' as SessionTab, label: 'Power' }] : []),
    ...(isCycling || isRunning ? [{ id: 'heartrate' as SessionTab, label: 'Heart Rate' }] : []),
    ...(isCycling || isRunning || isSwimming ? [{ id: 'laps' as SessionTab, label: 'Laps & Splits' }] : []),
  ]

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: visible ? 1 : 0,
    transition: 'opacity 150ms cubic-bezier(0.16,1,0.3,1)',
    pointerEvents: visible ? 'auto' : 'none',
  }

  const panelStyle: React.CSSProperties = {
    width: 780,
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-2)',
    border: '1px solid var(--border-default)',
    borderRadius: 12,
    overflow: 'hidden',
    opacity: visible ? 1 : 0,
    transform: visible ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(8px)',
    transition: 'opacity 150ms cubic-bezier(0.16,1,0.3,1), transform 150ms cubic-bezier(0.16,1,0.3,1)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `${sportColor}20`, border: `1px solid ${sportColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: sportColor }}>
                  {sportLabel.slice(0, 1)}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--fg-1)', lineHeight: 1.2 }}>
                  {session.activity_name || sportLabel}
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {formatModalDate(session.session_date)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Pill color="success">Completed</Pill>
              <button
                onClick={onClose}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 4, transition: 'color 80ms' }}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Tab nav ── */}
        <div style={{ display: 'flex', padding: '0 24px', borderBottom: '1px solid var(--border-subtle)', gap: 2, flexShrink: 0 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 500 : 400,
                color: activeTab === tab.id ? 'var(--fg-1)' : 'var(--fg-3)',
                marginBottom: -1,
                transition: 'color 100ms',
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab content (scrollable) ── */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div key={activeTab} style={{ animation: 'tabFadeUp 150ms cubic-bezier(0.16,1,0.3,1)' }}>
            {activeTab === 'overview' && (
              <OverviewTab
                session={session}
                reflectionText={reflectionText}
                reflectionSaving={reflectionSaving}
                reflectionRef={reflectionRef}
                onReflectionChange={onReflectionChange}
                onReflectionSave={onReflectionSave}
                onCoachOpen={onCoachOpen}
              />
            )}
            {activeTab === 'power' && <PowerTab session={session} />}
            {activeTab === 'heartrate' && <HeartrateTab session={session} />}
            {activeTab === 'laps' && <LapsTab session={session} />}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, background: 'var(--bg-2)' }}>
          <Button kind="ai" size="sm" icon="sparkles" onClick={onCoachOpen}>
            Review with Coach
          </Button>
          <Button kind="secondary" size="sm" icon="pencil-line">Edit</Button>
          <div style={{ flex: 1 }} />
          <button
            disabled
            title="Share (coming soon)"
            style={{ background: 'transparent', border: 'none', cursor: 'not-allowed', color: 'var(--fg-4)', padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, borderRadius: 6, opacity: 0.4 }}
          >
            <Icon name="share-2" size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── OverviewTab ───────────────────────────────────────────────────────────────

function OverviewTab({ session, reflectionText, reflectionSaving, reflectionRef, onReflectionChange, onReflectionSave, onCoachOpen }: {
  session: SessionNoteRow
  reflectionText: string; reflectionSaving: boolean
  reflectionRef: React.RefObject<HTMLTextAreaElement | null>
  onReflectionChange: (v: string) => void; onReflectionSave: () => void
  onCoachOpen: () => void
}) {
  const isCycling = session.sport === 'cycling'
  const isRunning = session.sport === 'running'
  const sportColor = getSportColor(session.sport)

  type Stat = { label: string; value: string; unit?: string }

  const row1: Stat[] = [
    { label: 'Time',      value: formatDuration(session.actual_duration_seconds) },
    { label: 'Distance',  value: formatDistance(session.distance_meters) },
    { label: 'Elevation', value: session.elevation_gain_meters != null ? `${Math.round(session.elevation_gain_meters)}` : '—', unit: 'm' },
    { label: 'Calories',  value: session.calories != null ? String(session.calories) : '—', unit: session.calories != null ? 'kcal' : undefined },
  ]

  const row2: Stat[] = isCycling ? [
    { label: 'Avg Power', value: session.avg_power_watts != null ? String(Math.round(session.avg_power_watts)) : '—', unit: session.avg_power_watts != null ? 'W' : undefined },
    { label: 'NP',        value: session.normalized_power_watts != null ? String(Math.round(session.normalized_power_watts)) : '—', unit: session.normalized_power_watts != null ? 'W' : undefined },
    { label: 'TSS',       value: session.actual_tss != null ? String(Math.round(session.actual_tss)) : '—' },
    { label: 'IF',        value: session.intensity_factor != null ? session.intensity_factor.toFixed(2) : '—' },
  ] : isRunning ? [
    { label: 'Avg Pace',  value: formatPace(session.pace_per_km) },
    { label: 'Avg HR',    value: session.avg_hr != null ? `${Math.round(session.avg_hr)}` : '—', unit: session.avg_hr != null ? 'bpm' : undefined },
    { label: 'TSS',       value: session.actual_tss != null ? String(Math.round(session.actual_tss)) : '—' },
    { label: 'Aerobic Dec', value: session.aerobic_decoupling != null ? `${session.aerobic_decoupling.toFixed(1)}%` : '—' },
  ] : [
    { label: 'Avg HR',    value: session.avg_hr != null ? `${Math.round(session.avg_hr)}` : '—', unit: session.avg_hr != null ? 'bpm' : undefined },
    { label: 'TSS',       value: session.actual_tss != null ? String(Math.round(session.actual_tss)) : '—' },
  ]

  type Pill = [string, string]
  const pills: Pill[] = [
    ...(session.variability_index != null ? [['VI', session.variability_index.toFixed(2)] as Pill] : []),
    ...(session.efficiency_factor != null ? [['EF', session.efficiency_factor.toFixed(2)] as Pill] : []),
    ...(session.avg_cadence != null       ? [['Cadence', `${session.avg_cadence} rpm`] as Pill] : []),
    ...(session.avg_temperature != null   ? [['Temp', `${Math.round(session.avg_temperature)}°C`] as Pill] : []),
  ]

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Key stats grid — 2 rows of 4 */}
      <div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)', marginBottom: 12 }}>
          Actuals
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px 12px' }}>
          {[...row1, ...row2].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--fg-1)', lineHeight: 1 }}>{s.value}</span>
                {s.unit && <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{s.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Zone distribution bar */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Zone distribution
        </div>
        <ZoneBar zones={session.zones} fallbackColor={sportColor} height={10} />
        <ZoneLabels zones={session.zones} />
        {!parseZoneSegments(session.zones) && (
          <div style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
            Zone data unavailable — sync to populate
          </div>
        )}
      </div>

      {/* Stat pills */}
      {pills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {pills.map(([label, value]) => (
            <div key={label} style={{ padding: '5px 12px', background: 'var(--bg-3)', border: '1px solid var(--border-default)', borderRadius: 20, display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <span style={{ fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)', fontWeight: 500 }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* AI Summary */}
      <div style={{ padding: '14px 16px', background: 'rgba(139,124,246,0.04)', border: '1px solid rgba(139,124,246,0.12)', borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Icon name="sparkles" size={11} color="var(--ai)" />
          <span style={{ fontSize: 10, color: 'var(--ai)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            AI Summary
          </span>
        </div>
        {session.ai_summary ? (
          <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.6 }}>{session.ai_summary}</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--fg-3)', fontStyle: 'italic' }}>No summary yet.</div>
            <Button kind="ai" size="sm" icon="sparkles" onClick={onCoachOpen}>Analyse this session</Button>
          </div>
        )}
      </div>

      {/* Reflection */}
      <div>
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
            fontSize: 13, color: 'var(--fg-1)', fontFamily: 'var(--font-sans)',
            lineHeight: 1.5, resize: 'vertical', outline: 'none',
          }}
        />
        {reflectionSaving && (
          <div style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>Saving…</div>
        )}
      </div>
    </div>
  )
}

// ── PowerTab ──────────────────────────────────────────────────────────────────

function PowerTab({ session }: { session: SessionNoteRow }) {
  type Stat = { label: string; value: string; unit?: string }

  const stats: Stat[] = [
    { label: 'Avg Power', value: session.avg_power_watts != null ? String(Math.round(session.avg_power_watts)) : '—', unit: 'W' },
    { label: 'NP',        value: session.normalized_power_watts != null ? String(Math.round(session.normalized_power_watts)) : '—', unit: 'W' },
    { label: 'Max Power', value: session.max_power_watts != null ? String(Math.round(session.max_power_watts)) : '—', unit: 'W' },
    { label: 'Total Work', value: session.total_work_kj != null ? String(session.total_work_kj) : '—', unit: 'kJ' },
    { label: 'IF',        value: session.intensity_factor != null ? session.intensity_factor.toFixed(2) : '—' },
    { label: 'VI',        value: session.variability_index != null ? session.variability_index.toFixed(2) : '—' },
    { label: 'EF',        value: session.efficiency_factor != null ? session.efficiency_factor.toFixed(2) : '—' },
  ]

  const best5s   = parseBestEffort(session.gaps, 5)
  const best1min = parseBestEffort(session.gaps, 60)
  const best5min = parseBestEffort(session.gaps, 300)
  const bestEfforts = [
    { label: '5s',   value: best5s },
    { label: '1min', value: best1min },
    { label: '5min', value: best5min },
    { label: '20min', value: session.best_20min_power },
    { label: '60min', value: session.best_60min_power },
  ].filter(e => e.value != null)

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Power stats grid */}
      <div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)', marginBottom: 12 }}>
          Power metrics
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px 12px' }}>
          {stats.map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--fg-1)', lineHeight: 1 }}>{s.value}</span>
                {s.unit && <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{s.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Zone breakdown */}
      <div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)', marginBottom: 8 }}>
          Zone distribution
        </div>
        <ZoneBar zones={session.zones} fallbackColor={getSportColor(session.sport)} height={10} />
        <ZoneLabels zones={session.zones} />
        {!parseZoneSegments(session.zones) && (
          <div style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
            Zone data unavailable
          </div>
        )}
      </div>

      {/* Best efforts */}
      {bestEfforts.length > 0 && (
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)', marginBottom: 12 }}>
            Best efforts
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {bestEfforts.map(e => (
              <div key={e.label} style={{ padding: '8px 14px', background: 'var(--bg-3)', border: '1px solid var(--border-default)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{e.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: 'var(--fg-1)' }}>
                  {e.value}W
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── HeartrateTab ──────────────────────────────────────────────────────────────

function HeartrateTab({ session }: { session: SessionNoteRow }) {
  type Stat = { label: string; value: string; unit?: string }

  const stats: Stat[] = [
    { label: 'Avg HR',    value: session.avg_hr != null ? String(Math.round(session.avg_hr)) : '—', unit: 'bpm' },
    { label: 'Max HR',    value: session.max_hr != null ? String(Math.round(session.max_hr)) : '—', unit: 'bpm' },
    { label: 'HRSS',      value: session.hrss != null ? session.hrss.toFixed(1) : '—' },
    { label: 'Aerobic Dec', value: session.aerobic_decoupling != null ? `${session.aerobic_decoupling.toFixed(1)}%` : '—' },
  ]

  const highDrift = (session.aerobic_decoupling ?? 0) > 5

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* HR stats grid */}
      <div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)', marginBottom: 12 }}>
          Heart rate metrics
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px 12px' }}>
          {stats.map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--fg-1)', lineHeight: 1 }}>{s.value}</span>
                {s.unit && <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{s.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* HR zone breakdown */}
      <div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)', marginBottom: 8 }}>
          HR zone distribution
        </div>
        <ZoneBar zones={session.zones} fallbackColor={getSportColor(session.sport)} height={10} />
        <ZoneLabels zones={session.zones} />
        {!parseZoneSegments(session.zones) && (
          <div style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
            Zone data unavailable
          </div>
        )}
      </div>

      {/* Aerobic decoupling note */}
      {highDrift && (
        <div style={{ padding: '10px 14px', background: 'rgba(232,155,60,0.08)', border: '1px solid rgba(232,155,60,0.24)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Icon name="alert-triangle" size={14} color="var(--warning)" />
            <div style={{ fontSize: 12, color: '#E89B3C', lineHeight: 1.55 }}>
              Cardiac drift above 5% suggests accumulated fatigue or heat stress.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── LapsTab ───────────────────────────────────────────────────────────────────

function LapsTab({ session }: { session: SessionNoteRow }) {
  const isCycling = session.sport === 'cycling'
  const isRunning = session.sport === 'running'
  const laps = parseLaps(session.intervals_data)

  if (!laps) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <Icon name="layers" size={24} color="var(--fg-4)" />
        <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 12 }}>No lap data available for this session.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)', marginBottom: 12 }}>
        {laps.length} {laps.length === 1 ? 'interval' : 'intervals'}
      </div>
      <div style={{ border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isCycling
            ? '2fr 1fr 1fr 1fr 1fr 1fr'
            : isRunning
              ? '2fr 1fr 1fr 1fr 1fr'
              : '2fr 1fr 1fr 1fr',
          padding: '8px 14px',
          background: 'var(--bg-1)',
          borderBottom: '1px solid var(--border-subtle)',
          gap: 8,
        }}>
          {(isCycling
            ? ['Lap', 'Duration', 'Avg Power', 'NP', 'Avg HR', 'TSS']
            : isRunning
              ? ['Lap', 'Duration', 'Pace', 'Avg HR', 'Elevation']
              : ['Lap', 'Duration', 'Avg HR', 'Distance']
          ).map(h => (
            <div key={h} style={{ fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {laps.map((lap, i) => {
          const lapPace = speedToPace(lap.average_speed)
          return (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: isCycling
                  ? '2fr 1fr 1fr 1fr 1fr 1fr'
                  : isRunning
                    ? '2fr 1fr 1fr 1fr 1fr'
                    : '2fr 1fr 1fr 1fr',
                padding: '10px 14px',
                borderBottom: i < laps.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--fg-1)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lap.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)' }}>{formatDuration(lap.elapsed_time)}</div>

              {isCycling && <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)' }}>
                  {lap.average_watts != null ? `${Math.round(lap.average_watts)}W` : '—'}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)' }}>
                  {lap.normalized_watts != null ? `${Math.round(lap.normalized_watts)}W` : '—'}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)' }}>
                  {lap.average_heartrate != null ? `${Math.round(lap.average_heartrate)}` : '—'}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)' }}>
                  {lap.icu_training_load != null ? lap.icu_training_load.toFixed(1) : '—'}
                </div>
              </>}

              {isRunning && <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)' }}>
                  {lapPace != null ? formatPace(lapPace) : '—'}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)' }}>
                  {lap.average_heartrate != null ? `${Math.round(lap.average_heartrate)}` : '—'}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)' }}>
                  {lap.total_elevation_gain != null ? `+${Math.round(lap.total_elevation_gain)}m` : '—'}
                </div>
              </>}

              {!isCycling && !isRunning && <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)' }}>
                  {lap.average_heartrate != null ? `${Math.round(lap.average_heartrate)}` : '—'}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)' }}>
                  {lap.distance != null ? formatDistance(lap.distance) : '—'}
                </div>
              </>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
