'use client'

import { useState } from 'react'
import { Icon, Button, Pill } from '@/components/atoms'

const MODULES = [
  {
    id: 'athlete', title: 'Athlete Profile', icon: 'user', tag: '@athlete',
    summary: '34 · F · Helsinki · 6 y triathlon · 4 y self-coached',
    fields: [['Name','Mira Lindqvist'],['Age / Sex','34 · Female'],['Discipline','Triathlon · Long course (70.3, IM)'],['Experience','6 years racing · 4 years self-coached'],['Strengths','Bike threshold, mental durability'],['Weaknesses','Open-water sighting · running off the bike past 18 km']],
    edited: '2 weeks ago',
  },
  {
    id: 'coach-style', title: 'Coach Style', icon: 'message-square', tag: '@coachstyle',
    summary: 'Direct · evidence-led · short replies · no motivational copy',
    fields: [['Tone','Direct'],['Length','Short. State the recommendation, then briefly why.'],['Praise','Minimal. Numbers speak.'],['Push vs protect','Bias toward protecting form during build blocks.'],['When to challenge me','Always, when readiness data contradicts my plan.']],
    edited: 'Yesterday',
  },
  {
    id: 'plan-dna', title: 'Plan DNA', icon: 'git-fork', tag: '@plandna',
    summary: '80/20 polarized · Sat long · 2 quality/wk · 48h between hard sessions',
    fields: [['Philosophy','80/20 polarized'],['Quality days','Tue + Thu (48h between hard)'],['Long ride','Saturday — fixed'],['Long run','Sunday brick'],['Ramp rate','4–6 TSS/wk'],['Volume target','12–16 h/wk in build']],
    edited: '4 days ago',
  },
  {
    id: 'patterns', title: 'Training Patterns', icon: 'activity', tag: '@patterns',
    summary: '4 patterns observed · 1 new suggestion pending',
    fields: [['Threshold response','Strong on Tue; struggles when Mon TSS > 80.'],['Recovery rebound','2 easy days restore HRV to baseline within 36h.'],['Hot weather','Cardiac drift +9% when bike temp > 24°C.'],['VO2 stacking','Athlete struggles with stacked VO2 after long endurance weekends.', { pending: true }]],
    edited: '6 days ago', pending: 1,
  },
  {
    id: 'rules', title: 'Adaptation Rules', icon: 'sliders-horizontal', tag: '@rules',
    summary: '6 active rules · auto-propose, never auto-apply',
    fields: [['HRV trigger','IF HRV < −7% for 2 days → propose Z2 swap'],['Sleep trigger','IF sleep < 6h → propose intensity downshift'],['Travel','IF >2h flight in window → cap intensity 24h post'],['Race week','No Z4+ work in T-7. Openers Thu.'],['Sick / injured','Auto-pause for 48h. Resume Z1 only.'],['Apply mode','Auto-propose · always ask before applying.']],
    edited: '2 days ago',
  },
  {
    id: 'goals', title: 'Race Goals', icon: 'flag', tag: '@goals',
    summary: 'A-race Lahti 70.3 · sub 4:55 · run 1:35',
    fields: [['A-race','Ironman 70.3 Lahti · Aug 16'],['Overall goal','Sub 4:55 · top 5 AG'],['Bike target','2:38 @ NP 215 W (0.79 IF)'],['Run target','1:35 (4:30/km off the bike)'],['Stretch goal','AG podium if conditions hold']],
    edited: '1 week ago',
  },
  {
    id: 'fueling', title: 'Fueling Strategy', icon: 'utensils', tag: '@fueling',
    summary: '90 g/h carb · gels post-90min · 750 ml/h fluid',
    fields: [['Race fuel','90 g carb/h (gel + drink mix)'],['Long ride fuel','70 g/h · bars allowed in first 90 min only'],['Pre-race','Oats + banana + coffee, T-3h'],['Hydration','750 ml/h · 600 mg sodium/h hot'],['Caffeine','200 mg, split T-0 and T+90 on race day']],
    edited: '3 days ago',
  },
  {
    id: 'health', title: 'Health & Injury Notes', icon: 'heart', tag: '@health',
    summary: 'Left Achilles flare history · monitor on consecutive run days',
    fields: [['Active','None'],['History','Left Achilles tendinopathy · 2023 winter. 6 wk loaded eccentrics resolved.'],['Triggers','Consecutive run days · downhill running'],['Allergies','Pine pollen (spring)'],['Meds','None']],
    edited: '3 weeks ago',
  },
  {
    id: 'recovery', title: 'Recovery Preferences', icon: 'bed', tag: '@recovery',
    summary: 'Sleep 7h 30m target · Sun rest preferred · sauna 2x/wk',
    fields: [['Sleep target','7h 30m'],['Rest day','Sunday preferred · Friday if travel'],['Modalities','Sauna 2×/wk · light Z1 spin OK on rest'],['HRV measurement','Garmin · wrist · upon wake'],['Off-week cadence','Every 4th week, 60% load']],
    edited: '1 week ago',
  },
] as const

type ModuleId = typeof MODULES[number]['id']

export default function ContextView() {
  const [activeId, setActiveId] = useState<ModuleId>('plan-dna')
  const [editingId, setEditingId] = useState<ModuleId | null>(null)
  const active = MODULES.find((m) => m.id === activeId)!

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>Context</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>The Coach&apos;s brain</h1>
            <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 6, maxWidth: 620 }}>
              Every module here is editable. The Coach reads from these when it plans, suggests, or reasons about your training. Nothing is hidden.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button kind="ghost" size="md" icon="download">Export</Button>
            <Button kind="secondary" size="md" icon="git-pull-request">Version history</Button>
          </div>
        </div>
      </div>

      <MemorySuggestions />

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Module list */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 6 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)', padding: '10px 10px 6px', fontFamily: 'var(--font-mono)' }}>
            Intelligence modules
          </div>
          {MODULES.map((m) => (
            <div
              key={m.id}
              onClick={() => setActiveId(m.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                background: activeId === m.id ? 'var(--bg-3)' : 'transparent',
                boxShadow: activeId === m.id ? 'inset 2px 0 0 var(--accent)' : 'none',
              }}
              onMouseEnter={(e) => { if (activeId !== m.id) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-1)' }}
              onMouseLeave={(e) => { if (activeId !== m.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              <Icon name={m.icon} size={14} color={activeId === m.id ? 'var(--fg-1)' : 'var(--fg-3)'} />
              <span style={{ flex: 1, fontSize: 13, color: activeId === m.id ? 'var(--fg-1)' : 'var(--fg-2)', fontWeight: activeId === m.id ? 500 : 400 }}>
                {m.title}
              </span>
              {'pending' in m && m.pending && (
                <span style={{ width: 16, height: 16, borderRadius: 999, background: 'var(--ai-soft)', color: 'var(--ai)', fontSize: 10, fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {m.pending}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Detail */}
        <ModuleDetail
          module={active}
          editing={editingId === active.id}
          onEdit={() => setEditingId(active.id)}
          onClose={() => setEditingId(null)}
        />
      </div>
    </div>
  )
}

function ModuleDetail({ module, editing, onEdit, onClose }: {
  module: typeof MODULES[number]
  editing: boolean
  onEdit: () => void
  onClose: () => void
}) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Icon name={module.icon} size={16} color="var(--fg-2)" />
            <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em', margin: 0 }}>{module.title}</h2>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ai)', background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)', padding: '2px 6px', borderRadius: 4 }}>{module.tag}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>{module.summary}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
            Edited {module.edited} · used in 142 conversations
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button kind="ghost" size="sm" icon="copy">Copy tag</Button>
          {!editing ? (
            <Button kind="secondary" size="sm" icon="pencil-line" onClick={onEdit}>Edit</Button>
          ) : (
            <>
              <Button kind="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button kind="primary" size="sm" icon="check" onClick={onClose}>Save</Button>
            </>
          )}
        </div>
      </div>
      <div style={{ padding: '8px 0' }}>
        {(module.fields as readonly (readonly [string, string] | readonly [string, string, { pending?: boolean }])[]).map((fieldTuple, i) => {
          const [k, v, opts] = fieldTuple as [string, string, { pending?: boolean } | undefined]
          const isPending = opts?.pending
          return (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '14px 24px', borderBottom: i < module.fields.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'baseline', background: isPending ? 'rgba(139,124,246,0.04)' : 'transparent' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                {k}
                {isPending && <span style={{ fontSize: 9, color: 'var(--ai)', fontFamily: 'var(--font-mono)', textTransform: 'none', letterSpacing: 0 }}>pending</span>}
              </div>
              {editing ? (
                <textarea defaultValue={v} rows={v.length > 60 ? 2 : 1} style={{ background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '8px 10px', color: 'var(--fg-1)', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, resize: 'vertical', outline: 'none' }} />
              ) : (
                <div style={{ fontSize: 13, color: isPending ? 'var(--ai)' : 'var(--fg-1)', lineHeight: 1.55 }}>
                  {v}
                  {isPending && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <Button kind="ai" size="sm" icon="check">Accept</Button>
                      <Button kind="ghost" size="sm" icon="pencil-line">Edit</Button>
                      <Button kind="ghost" size="sm" icon="x">Reject</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {editing && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-subtle)' }}>
            <Button kind="ghost" size="sm" icon="plus">Add field</Button>
          </div>
        )}
      </div>
    </div>
  )
}

function MemorySuggestions() {
  const items = [
    { target: 'Training Patterns', tag: '@patterns', text: 'Athlete struggles with stacked VO2 sessions after long endurance weekends.', evidence: 'Observed Wks 4, 7, 10 · 3 missed VO2 sets · avg 36h after long ride', source: 'auto · last 3 build blocks' },
    { target: 'Fueling Strategy', tag: '@fueling', text: 'Switch from bars to gels after 90 min on long rides — gut tolerance drops.', evidence: '3 of 4 long rides reported GI discomfort with bars past 90 min', source: 'Sat May 31 · debrief conversation' },
    { target: 'Recovery Preferences', tag: '@recovery', text: 'Add sauna restriction after VO2 days — reported elevated next-morning RHR (+3 bpm).', evidence: 'Last 2 cycles, sauna post-VO2 → RHR +3 bpm next morning', source: 'pattern detection' },
  ]
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkles" size={11} color="var(--ai)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>Memory suggestions</div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Coach proposed updates to your context. Nothing applies until you accept.</div>
        </div>
        <Pill color="ai">{items.length} pending</Pill>
        <Button kind="ghost" size="sm">Review all</Button>
      </div>
      {items.map((it, i) => (
        <div key={i} style={{ padding: '16px 20px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                Update → <span style={{ color: 'var(--ai)' }}>{it.tag}</span>
                <span style={{ color: 'var(--fg-4)' }}> · {it.target}</span>
              </span>
              <span style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>· {it.source}</span>
            </div>
            <div style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.5, marginBottom: 6 }}>{it.text}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              <Icon name="chart-line" size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              {it.evidence}
            </div>
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
