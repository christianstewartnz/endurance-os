'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon, Button, Pill, Sparkline } from '@/components/atoms'
import { useCoachPanel } from '@/components/app-shell'
import type { WellnessCacheRow, SessionNoteRow, IntervalEvent } from '@/lib/intervals/types'

// ── Props ────────────────────────────────────────────────────────────────────

interface DashboardProps {
  wellnessToday: WellnessCacheRow | null
  wellness14d: WellnessCacheRow[]
  weekSessions: SessionNoteRow[]
  weekEvents: IntervalEvent[]
  hasIntervalsConnected: boolean
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
}: DashboardProps) {
  const router = useRouter()
  const { openCoach } = useCoachPanel()

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
          <Button kind="secondary" size="md" icon="plus">New session</Button>
        </div>
      </div>

      <TodaysSessionCard onOpenCoach={openCoach} />
      <ReadinessRow
        wellnessToday={wellnessToday}
        wellness14d={wellness14d}
        hasIntervalsConnected={hasIntervalsConnected}
        onConnect={() => router.push('/settings?section=connections')}
      />
      <WeekStrip weekSessions={weekSessions} weekEvents={weekEvents} />
      <MemoryInbox onNavigateToContext={() => router.push('/context')} />
    </div>
  )
}

// ── TodaysSessionCard (unchanged logic) ──────────────────────────────────────

function TodaysSessionCard({ onOpenCoach }: { onOpenCoach: () => void }) {
  const [adaptation, setAdaptation] = useState<'pending' | 'accepted' | 'rejected'>('pending')
  const accepted = adaptation === 'accepted'

  const stats = accepted
    ? [['Duration', '1:30', 'h:mm'], ['Target IF', '0.68', ''], ['TSS', '62', ''], ['Start', '06:30', 'Tue']]
    : [['Duration', '1:42', 'h:mm'], ['Target IF', '0.94', ''], ['TSS', '128', ''], ['Start', '06:30', 'Tue']]

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>Today&apos;s session</div>
            <Pill color="z4">Z4 · Threshold</Pill>
            {accepted && <Pill color="ai"><Icon name="sparkles" size={10} style={{ marginRight: 2 }} />Adapted to Z2</Pill>}
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15, color: 'var(--fg-1)' }}>
            {accepted ? 'Endurance · 90 min Z2' : 'Threshold intervals · 4 × 8 min'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--fg-2)', marginTop: 8, lineHeight: 1.55, maxWidth: 520 }}>
            {accepted ? (
              <>Steady at <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-1)' }}>180–210 W</span> · cadence <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-1)' }}>88–92</span>. Threshold moves to Thursday.</>
            ) : (
              <>Hold <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-1)' }}>285 W</span> · cadence <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-1)' }}>92</span>. 4 min easy between. Wind 6 m/s SW — bias the steady direction for the long efforts.</>
            )}
          </div>
          <div style={{ display: 'flex', gap: 28, marginTop: 24 }}>
            {stats.map(([k, v, u]) => (
              <div key={k}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>{k}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: 'var(--fg-1)', letterSpacing: '-0.01em', marginTop: 4, lineHeight: 1 }}>
                  {v}{u && <span style={{ fontSize: 11, color: 'var(--fg-3)', marginLeft: 4 }}>{u}</span>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <Button kind="primary" size="md" icon="play">Start session</Button>
            <Button kind="secondary" size="md" icon="pencil-line">Edit</Button>
            <Button kind="ghost" size="md" icon="sparkles" onClick={onOpenCoach}>Discuss</Button>
            <Button kind="ghost" size="md" iconRight="chevron-down" style={{ marginLeft: 'auto' }}>More</Button>
          </div>
        </div>
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>Profile</span>
            <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>W / time</span>
          </div>
          {accepted ? <Z2Profile /> : <WorkoutProfile />}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            <span>0:00</span><span>0:30</span><span>1:00</span>
            <span>{accepted ? '1:30' : '1:42'}</span>
          </div>
        </div>
      </div>

      {adaptation === 'pending' && (
        <AdaptationSuggestion
          onAccept={() => setAdaptation('accepted')}
          onReject={() => setAdaptation('rejected')}
          onDiscuss={onOpenCoach}
        />
      )}
      {adaptation === 'rejected' && (
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-1)', fontSize: 12, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="check" size={12} />
          Suggestion declined. Keeping threshold as planned.
          <button onClick={() => setAdaptation('pending')} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--fg-3)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
            Show again
          </button>
        </div>
      )}
    </div>
  )
}

function AdaptationSuggestion({ onAccept, onReject, onDiscuss }: { onAccept: () => void; onReject: () => void; onDiscuss: () => void }) {
  return (
    <div style={{ borderTop: '1px solid var(--ai-edge)', background: 'linear-gradient(180deg, rgba(139,124,246,0.05), rgba(139,124,246,0.02))', padding: '16px 24px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        <Icon name="sparkles" size={12} color="var(--ai)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ai)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Adaptation proposed</span>
          <span style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>06:12 · auto</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.55, marginBottom: 4 }}>
          HRV <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ai)' }}>−8%</span> vs 14-day baseline and yesterday&apos;s threshold session created unusually high cardiac drift. Swap to <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', background: 'var(--ai-soft)', padding: '0 4px', borderRadius: 3 }}>90 min Z2</span>; move threshold to Thursday.
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>
          <span>Reading <span style={{ color: 'var(--ai)' }}>@todayshrv</span></span>
          <span>·</span>
          <span><span style={{ color: 'var(--ai)' }}>@lastthresholdsession</span></span>
          <span>·</span>
          <span><span style={{ color: 'var(--ai)' }}>@plandna</span></span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button kind="ai" size="sm" icon="check" onClick={onAccept}>Accept</Button>
          <Button kind="ghost" size="sm" icon="pencil-line">Modify</Button>
          <Button kind="ghost" size="sm" icon="x" onClick={onReject}>Reject</Button>
          <Button kind="ghost" size="sm" icon="message-square" onClick={onDiscuss}>Discuss with AI</Button>
        </div>
      </div>
    </div>
  )
}

function Z2Profile() {
  return (
    <div style={{ height: 120, display: 'flex', alignItems: 'flex-end', gap: 1 }}>
      {[{ w: 10, p: 0.35 }, { w: 70, p: 0.62 }, { w: 8, p: 0.30 }].map((b, i) => (
        <div key={i} style={{ flex: b.w, height: `${b.p * 100}%`, background: 'linear-gradient(180deg, #3FB37F55, #3FB37Faa)', borderTop: '2px solid #3FB37F', borderRadius: '2px 2px 0 0' }} />
      ))}
    </div>
  )
}

function WorkoutProfile() {
  const blocks = [
    { w: 12, p: 0.38, z: 'z2' }, { w: 16, p: 0.95, z: 'z4' }, { w: 8, p: 0.45, z: 'z2' },
    { w: 16, p: 0.95, z: 'z4' }, { w: 8, p: 0.45, z: 'z2' }, { w: 16, p: 0.95, z: 'z4' },
    { w: 8, p: 0.45, z: 'z2' }, { w: 16, p: 0.95, z: 'z4' }, { w: 10, p: 0.35, z: 'z2' },
  ]
  const colors: Record<string, string> = { z2: '#3FB37F', z3: '#E8C547', z4: '#E89B3C', z5: '#E5484D' }
  return (
    <div style={{ height: 120, display: 'flex', alignItems: 'flex-end', gap: 1 }}>
      {blocks.map((b, i) => (
        <div key={i} style={{ flex: b.w, height: `${b.p * 100}%`, background: `linear-gradient(180deg, ${colors[b.z]}55, ${colors[b.z]}aa)`, borderTop: `2px solid ${colors[b.z]}`, borderRadius: '2px 2px 0 0' }} />
      ))}
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

interface WeekStripProps {
  weekSessions: SessionNoteRow[]
  weekEvents: IntervalEvent[]
}

function WeekStrip({ weekSessions, weekEvents }: WeekStripProps) {
  const zColors: Record<string, string> = { z1: '#5C6470', z2: '#3FB37F', z3: '#E8C547', z4: '#E89B3C', z5: '#E5484D' }
  const todayStr = new Date().toISOString().split('T')[0]

  // Build Mon–Sun date array for the current week
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  // Index completed sessions by date
  const sessionByDate = new Map<string, SessionNoteRow>()
  for (const s of weekSessions) {
    sessionByDate.set(s.session_date, s)
  }

  // Index planned events by date
  const eventByDate = new Map<string, IntervalEvent>()
  for (const e of weekEvents) {
    const date = e.start_date_local.split('T')[0]
    eventByDate.set(date, e)
  }

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const plannedTss = weekEvents.reduce((s, e) => s + (e.icu_training_load ?? 0), 0)
  const weekLabel = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '18px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>This week</div>
          <span style={{ fontSize: 12, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>{weekLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {plannedTss > 0 && (
            <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              Planned TSS <span style={{ color: 'var(--fg-1)' }}>{Math.round(plannedTss)}</span>
            </span>
          )}
          <Button kind="ghost" size="sm" icon="chevron-left" />
          <Button kind="ghost" size="sm" icon="chevron-right" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderTop: '1px solid var(--border-subtle)' }}>
        {weekDates.map((date, i) => {
          const dateStr = date.toISOString().split('T')[0]
          const session = sessionByDate.get(dateStr)
          const event   = eventByDate.get(dateStr)
          const isPast  = dateStr < todayStr
          const isToday = dateStr === todayStr

          let state: 'done' | 'today' | 'planned' | 'off'
          let displayName: string | null = null
          let duration: string | null = null
          let tss: number | null = null
          let zone: string | null = null

          if (session) {
            state = isToday ? 'today' : 'done'
            displayName = session.session_type ?? 'Workout'
            duration = formatDuration(session.actual_duration_seconds)
            tss = session.actual_tss
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

          return (
            <div key={dateStr} style={{ padding: '14px 14px 18px', borderRight: i < 6 ? '1px solid var(--border-subtle)' : 'none', background: isCurrent ? 'var(--bg-3)' : 'transparent', position: 'relative', cursor: 'pointer' }}>
              {isCurrent && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--accent)' }} />}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: isCurrent ? 'var(--accent)' : 'var(--fg-3)', fontWeight: 500 }}>{dayNames[i]}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: isCurrent ? 'var(--fg-1)' : 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>{date.getDate()}</span>
              </div>

              {zone && displayName ? (
                <div style={{ padding: '8px 10px', background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, borderLeft: `2px solid ${zColors[zone] ?? zColors.z2}`, opacity: isDone ? 0.55 : 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--fg-1)', fontWeight: 500, marginBottom: 4, textDecoration: isDone ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                    <span>{duration ?? '—'}</span>
                    {tss != null && tss > 0 && <span>{Math.round(tss)} TSS</span>}
                  </div>
                </div>
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

// ── MemoryInbox (unchanged) ───────────────────────────────────────────────────

function MemoryInbox({ onNavigateToContext }: { onNavigateToContext: () => void }) {
  const items = [
    { target: 'Training Patterns', text: 'Athlete struggles with stacked VO2 sessions after long endurance weekends.', source: 'last 3 weeks' },
    { target: 'Fueling Strategy', text: 'Gut tolerance drops on bars after 90 min — switch to gels for second half of long rides.', source: 'Sat ride · May 31' },
  ]
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '18px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>Memory updates</div>
          <Pill color="ai">{items.length} pending</Pill>
        </div>
        <Button kind="ghost" size="sm" iconRight="arrow-right" onClick={onNavigateToContext}>Open Context</Button>
      </div>
      {items.map((it, i) => (
        <div key={i} style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon name="sparkles" size={11} color="var(--ai)" />
              <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                Suggested update → <span style={{ color: 'var(--ai)' }}>{it.target}</span>
              </span>
              <span style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>· {it.source}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.5 }}>{it.text}</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <Button kind="ai" size="sm" icon="check">Accept</Button>
            <Button kind="ghost" size="sm" icon="pencil-line">Edit</Button>
            <Button kind="ghost" size="sm" icon="x">Reject</Button>
          </div>
        </div>
      ))}
    </div>
  )
}
