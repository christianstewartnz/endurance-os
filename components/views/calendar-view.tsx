'use client'

import { useState } from 'react'
import { Icon, Button, Pill } from '@/components/atoms'

type Cell = [string, string, string | null, string, number, string] | null

const WEEKS = [
  { label: 'Wk 11 · Build 2/3', range: 'Jun 2 – 8',       tss: 570, completed: 128 },
  { label: 'Wk 10 · Build 1/3', range: 'May 26 – Jun 1',  tss: 612, completed: 612 },
  { label: 'Wk 9 · Recovery',   range: 'May 19 – 25',     tss: 320, completed: 320 },
  { label: 'Wk 8 · Build 3/3',  range: 'May 12 – 18',     tss: 658, completed: 658 },
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const GRID: Cell[][] = [
  [['Z2 base','62','z2','done',2,'Jun'],['Threshold','128','z4','today',3,'Jun'],['Recovery','24','z1','planned',4,'Jun'],['VO2 6×3','96','z5','planned',5,'Jun'],null,['Long ride','195','z2','planned',7,'Jun'],['Brick run','65','z3','planned',8,'Jun']],
  [null,['Threshold 4×8','128','z4','done',27,'May'],['Z2 base','64','z2','done',28,'May'],['VO2 5×4','110','z5','done',29,'May'],['Recovery','22','z1','done',30,'May'],['Long ride','190','z2','done',31,'May'],['Brick','98','z3','done',1,'Jun']],
  [['Recovery','18','z1','done',19,'May'],['Z2','60','z2','done',20,'May'],null,['Tempo','82','z3','done',22,'May'],['Z2','58','z2','done',23,'May'],['Long easy','78','z1','done',24,'May'],null],
  [null,['Threshold','120','z4','done',13,'May'],['Z2','68','z2','done',14,'May'],['VO2','105','z5','done',15,'May'],['Recovery','22','z1','done',16,'May'],['Long ride','215','z2','done',17,'May'],['Brick','108','z3','done',18,'May']],
]

const Z_COLORS: Record<string, string> = { z1: '#5C6470', z2: '#3FB37F', z3: '#E8C547', z4: '#E89B3C', z5: '#E5484D' }

export default function CalendarView() {
  const [selected, setSelected] = useState({ wk: 0, day: 1 })
  const selectedCell = GRID[selected.wk]?.[selected.day] ?? null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>Calendar</div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Macrocycle · Lahti M70.3</h1>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 6 }}>Build block 2 of 3 · peak Wk 13 · taper begins Wk 15.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button kind="secondary" size="md" icon="chevron-left" />
          <Button kind="secondary" size="md">Today</Button>
          <Button kind="secondary" size="md" icon="chevron-right" />
          <div style={{ flex: 1 }} />
          <Button kind="ghost" size="md" icon="filter">Bike, Run, Swim</Button>
          <Button kind="primary" size="md" icon="plus">Add session</Button>
        </div>

        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(7, 1fr) 70px', background: 'var(--bg-1)', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ padding: '10px 14px', fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Week</div>
            {DAYS.map((d) => <div key={d} style={{ padding: '10px 8px', fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d}</div>)}
            <div style={{ padding: '10px 14px', fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>TSS</div>
          </div>

          {WEEKS.map((wk, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: '140px repeat(7, 1fr) 70px', borderBottom: wi < WEEKS.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-1)' }}>{wk.label}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{wk.range}</div>
              </div>
              {GRID[wi].map((cell, ci) => {
                const isSel = selected.wk === wi && selected.day === ci
                return (
                  <div key={ci}
                    onClick={() => cell && setSelected({ wk: wi, day: ci })}
                    style={{ padding: 8, borderLeft: '1px solid var(--border-subtle)', minHeight: 80, cursor: cell ? 'pointer' : 'default', background: isSel ? 'var(--bg-3)' : 'transparent' }}
                  >
                    {cell ? (
                      <div style={{ padding: '8px 10px', background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, borderLeft: cell[2] ? `2px solid ${Z_COLORS[cell[2]]}` : '2px solid var(--border-default)', opacity: cell[3] === 'done' ? 0.75 : 1, boxShadow: cell[3] === 'today' ? 'inset 0 0 0 1px var(--accent)' : (isSel ? 'inset 0 0 0 1px var(--border-strong)' : 'none') }}>
                        <div style={{ fontSize: 12, color: 'var(--fg-1)', fontWeight: 500 }}>{cell[0]}</div>
                        <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{cell[1]} TSS</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--fg-4)', fontStyle: 'italic', padding: '8px 10px' }}>—</div>
                    )}
                  </div>
                )
              })}
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', borderLeft: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', fontWeight: 500 }}>{wk.tss}</div>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{wk.completed}/{wk.tss}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <WorkoutDetail cell={selectedCell} />
    </div>
  )
}

function WorkoutDetail({ cell }: { cell: Cell }) {
  if (!cell) {
    return (
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 24, position: 'sticky', top: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>Select a session.</div>
      </div>
    )
  }
  const [name, tss, zone, state, date, mo] = cell
  const done  = state === 'done'
  const today = state === 'today'

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, position: 'sticky', top: 0, overflow: 'hidden' }}>
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {zone && <Pill color={zone as 'z1'|'z2'|'z3'|'z4'|'z5'}>{zone.toUpperCase()}</Pill>}
          <Pill color={done ? 'success' : today ? 'accent' : 'neutral'}>
            {done ? 'Completed' : today ? 'Today' : 'Planned'}
          </Pill>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{date} {mo}</span>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em', margin: 0 }}>{name}</h2>
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          <Button kind="secondary" size="sm" icon="pencil-line">Edit</Button>
          <Button kind="ghost" size="sm" icon="message-square">Discuss</Button>
          <Button kind="ghost" size="sm" icon="more-horizontal" />
        </div>
      </div>

      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)', marginBottom: 10 }}>{done ? 'Actuals' : 'Targets'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {(done
            ? [['Time','1:38'],['Avg HR','162'],['NP','278 W'],['IF','0.92'],['TSS',tss],['Drift','+8%']]
            : [['Time','1:42'],['Target','285 W'],['TSS',tss]]
          ).map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: 'var(--fg-1)', marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {done && (
        <>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(139,124,246,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon name="sparkles" size={11} color="var(--ai)" />
              <span style={{ fontSize: 10, color: 'var(--ai)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI summary</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.55 }}>
              Held threshold within <span style={{ fontFamily: 'var(--font-mono)' }}>2%</span> of target on first three intervals. Cardiac drift was <span style={{ fontFamily: 'var(--font-mono)' }}>+8%</span> — above your typical 4–5%. Heat (24°C) likely the driver. Solid execution; recovery focus tomorrow.
            </div>
          </div>

          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Conversation · 4 msgs</span>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--fg-3)', fontSize: 11, cursor: 'pointer' }}>Open in Chat ↗</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ padding: '8px 10px', background: 'var(--bg-1)', border: '1px solid var(--border-subtle)', borderRadius: 6, fontSize: 12, color: 'var(--fg-2)' }}>
                <span style={{ color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>You · 19:32</span>
                <div style={{ marginTop: 2 }}>Felt OK but legs were heavier than I expected by #3.</div>
              </div>
              <div style={{ padding: '8px 10px', background: 'rgba(139,124,246,0.06)', border: '1px solid rgba(139,124,246,0.16)', borderRadius: 6, fontSize: 12, color: 'var(--fg-1)' }}>
                <span style={{ color: 'var(--ai)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>Coach · 19:33</span>
                <div style={{ marginTop: 2 }}>Sat ride was 12% over plan TSS. Likely the cause. Flagging the volume pattern for review.</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Adaptation notes</div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Icon name="git-branch" size={11} color="var(--fg-4)" style={{ marginTop: 3 }} />
              <span>Moved Wed recovery from <span style={{ fontFamily: 'var(--font-mono)' }}>0:45</span> to <span style={{ fontFamily: 'var(--font-mono)' }}>0:30</span> based on RPE 7/10 reported here.</span>
            </div>
          </div>
        </>
      )}

      <div style={{ padding: '14px 20px' }}>
        <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{done ? 'Your reflection' : 'Pre-session note'}</div>
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 10, minHeight: 60, fontSize: 12, color: done ? 'var(--fg-2)' : 'var(--fg-4)', fontStyle: done ? 'normal' : 'italic', lineHeight: 1.5 }}>
          {done ? 'Held the power but mentally hard from #2 onward. Considered pulling #4 but stayed on.' : 'Add a pre-session note…'}
        </div>
      </div>
    </div>
  )
}
