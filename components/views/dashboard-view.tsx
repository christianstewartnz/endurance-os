'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon, Button, Pill, Sparkline } from '@/components/atoms'
import { useCoachPanel } from '@/components/app-shell'

export default function DashboardView() {
  const router = useRouter()
  const { openCoach } = useCoachPanel()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 4 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
            Tuesday · Jun 3
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--fg-1)' }}>
            Today&apos;s training intelligence
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 6 }}>
            HRV is 8% below baseline. Coach has proposed an adaptation to today&apos;s session.
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
      <ReadinessRow />
      <WeekStrip />
      <MemoryInbox onNavigateToContext={() => router.push('/context')} />
    </div>
  )
}

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

        {/* Workout profile */}
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

function ReadinessRow() {
  const cards = [
    { k: 'HRV',        v: '64',   u: 'ms',  delta: '−8% · 14d',      tone: 'warning' as const, spark: [72,70,68,71,69,67,68,66,70,68,65,66,64,64], baseline: 70 },
    { k: 'Resting HR', v: '48',   u: 'bpm', delta: '+2 · 7d',         tone: 'warning' as const, spark: [46,45,47,45,46,47,46,48,47,49,48,48,49,48], baseline: 46 },
    { k: 'Sleep',      v: '6:12', u: 'h',   delta: '−1:18 · target',  tone: 'danger'  as const, spark: [7.4,7.8,7.2,8.1,7.5,7.2,6.9,7.1,7.0,6.5,6.8,6.2,5.9,6.2], baseline: 7.5 },
    { k: 'Form (TSB)', v: '−12',  u: '',    delta: 'Building',         tone: 'neutral' as const, spark: [4,2,-1,-3,-2,-5,-7,-6,-8,-10,-9,-11,-12,-12], baseline: 0 },
  ]
  const toneColor = { warning: '#E89B3C', danger: '#E5484D', neutral: 'var(--fg-3)' }
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

function WeekStrip() {
  const days = [
    { d: 'Mon', date: '2', type: 'Z2 base',   dur: '1:30', tss: 62,  zone: 'z2', state: 'done' },
    { d: 'Tue', date: '3', type: 'Threshold', dur: '1:42', tss: 128, zone: 'z4', state: 'today' },
    { d: 'Wed', date: '4', type: 'Recovery',  dur: '0:45', tss: 24,  zone: 'z1', state: 'planned' },
    { d: 'Thu', date: '5', type: 'VO2 6×3',   dur: '1:15', tss: 96,  zone: 'z5', state: 'planned' },
    { d: 'Fri', date: '6', type: 'Off',        dur: '—',   tss: 0,   zone: null, state: 'planned' },
    { d: 'Sat', date: '7', type: 'Long ride',  dur: '3:30', tss: 195, zone: 'z2', state: 'planned' },
    { d: 'Sun', date: '8', type: 'Brick run',  dur: '0:55', tss: 65,  zone: 'z3', state: 'planned' },
  ]
  const zColors: Record<string, string> = { z1: '#5C6470', z2: '#3FB37F', z3: '#E8C547', z4: '#E89B3C', z5: '#E5484D' }

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '18px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>Week 11 · Build</div>
          <span style={{ fontSize: 12, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>Jun 2 – Jun 8</span>
          <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>· 2 of 3 build weeks</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>Planned TSS <span style={{ color: 'var(--fg-1)' }}>570</span></span>
          <Button kind="ghost" size="sm" icon="chevron-left" />
          <Button kind="ghost" size="sm" icon="chevron-right" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderTop: '1px solid var(--border-subtle)' }}>
        {days.map((day, i) => {
          const isToday = day.state === 'today'
          const isDone  = day.state === 'done'
          return (
            <div key={day.d} style={{ padding: '14px 14px 18px', borderRight: i < 6 ? '1px solid var(--border-subtle)' : 'none', background: isToday ? 'var(--bg-3)' : 'transparent', position: 'relative', cursor: 'pointer' }}>
              {isToday && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--accent)' }} />}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: isToday ? 'var(--accent)' : 'var(--fg-3)', fontWeight: 500 }}>{day.d}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: isToday ? 'var(--fg-1)' : 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>{day.date}</span>
              </div>
              {day.zone ? (
                <div style={{ padding: '8px 10px', background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, borderLeft: `2px solid ${zColors[day.zone]}`, opacity: isDone ? 0.55 : 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--fg-1)', fontWeight: 500, marginBottom: 4, textDecoration: isDone ? 'line-through' : 'none' }}>{day.type}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                    <span>{day.dur}</span><span>{day.tss} TSS</span>
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
