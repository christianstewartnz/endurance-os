'use client'

import { Icon, Button } from '@/components/atoms'

export default function RacesView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>Races · 2026 season</div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>The road to Lahti</h1>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 6 }}>1 A-race · 2 supporting races · everything else is training.</div>
        </div>
        <Button kind="secondary" size="md" icon="plus">Add race</Button>
      </div>

      <RaceRow tier="A" race={{ name: 'Ironman 70.3 Lahti', date: 'Sat, Aug 16', countdown: '74d', location: 'Lahti, FI', goal: 'Sub 4:55 · top 5 AG', legs: [['Swim · 1.9 km','32:00'],['Bike · 90 km','2:38'],['Run · 21.1 km','1:35']], primary: true }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <RaceRow tier="B" compact race={{ name: 'Tampere Olympic', date: 'Sun, Jul 6', countdown: '33d', location: 'Tampere, FI', goal: 'Race-pace bike at IM effort' }} />
        <RaceRow tier="C" compact race={{ name: 'Helsinki Sprint Series #3', date: 'Sat, Jun 21', countdown: '18d', location: 'Helsinki, FI', goal: 'Brick + open-water exposure' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <StrategyCard title="Pacing strategy · Lahti" tag="@pacing" items={[['Swim','Settle by 200m. Feet of P4–P6.'],['Bike','NP 210–215 W · cap surges at 280 W on climbs'],['Run','First 5 km @ 4:35/km · close in 4:25/km'],['Mental','Mile-by-mile from 14 km. No splits in head.']]} />
        <StrategyCard title="Fueling strategy · Lahti" tag="@fueling" items={[['Pre-race','Oats + banana + coffee · T-3h'],['Bike','90 g carb/h · 750 ml/h · 600 mg Na/h'],['Run','1 gel every 25 min · water at every aid'],['Caffeine','100 mg T-0 · 100 mg at km 7 run']]} />
        <StrategyCard title="Equipment notes · Lahti" tag="@equipment" items={[['Bike','TT bike · 60mm front · disc rear'],['Wheels','Sub 20°C → standard tubeless · over → race tires'],['Helmet','Aero · short-tail'],['Tri suit','Sleeved · sleeves only if water <16°C']]} />
        <RaceDiscussion />
      </div>
    </div>
  )
}

interface Race {
  name: string
  date: string
  countdown: string
  location: string
  goal: string
  legs?: [string, string][]
  primary?: boolean
}

function RaceRow({ race, tier, compact }: { race: Race; tier: 'A' | 'B' | 'C'; compact?: boolean }) {
  const tierColors = { A: 'var(--accent)', B: 'var(--ai)', C: 'var(--fg-3)' }
  const tierBg     = { A: 'var(--accent-soft)', B: 'var(--ai-soft)', C: 'var(--bg-3)' }
  const color = tierColors[tier]
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, padding: compact ? 20 : 24, borderLeft: `2px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color, border: `1px solid ${color}55`, padding: '2px 6px', borderRadius: 3, background: tierBg[tier] }}>{tier}-RACE</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{race.date} · {race.location}</span>
          </div>
          <div style={{ fontSize: compact ? 18 : 22, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--fg-1)' }}>{race.name}</div>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 4 }}>{race.goal}</div>
          {race.legs && (
            <div style={{ display: 'flex', gap: 28, marginTop: 18 }}>
              {race.legs.map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>{k}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--fg-1)', marginTop: 4 }}>{v}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: compact ? 22 : 32, fontWeight: 500, color, letterSpacing: '-0.02em', lineHeight: 1 }}>{race.countdown}</div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginTop: 4 }}>to go</div>
        </div>
      </div>
    </div>
  )
}

function StrategyCard({ title, tag, items }: { title: string; tag: string; items: [string, string][] }) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>{title}</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ai)', background: 'var(--ai-soft)', padding: '1px 5px', borderRadius: 3 }}>{tag}</span>
        </div>
        <Button kind="ghost" size="sm" icon="pencil-line" />
      </div>
      <div>
        {items.map(([k, v], i) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 12, padding: '10px 0', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'baseline' }}>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
            <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.5 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RaceDiscussion() {
  const threads = [
    ['Should I race Tampere as a tune-up or skip?', '2 days ago'],
    ["Bike split target — what's realistic?", '5 days ago'],
    ['Fueling rehearsal during Wk 13 long ride?', '1 week ago'],
  ]
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="sparkles" size={12} color="var(--ai)" />
          <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>Recent race discussions</span>
        </div>
        <Button kind="ghost" size="sm" iconRight="arrow-right">Open chat</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {threads.map(([q, t]) => (
          <div key={q} style={{ padding: '10px 12px', background: 'var(--bg-1)', border: '1px solid var(--border-subtle)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <span style={{ fontSize: 13, color: 'var(--fg-1)' }}>{q}</span>
            <span style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
