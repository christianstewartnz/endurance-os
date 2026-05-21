// Secondary views: Calendar (with workout detail), Races, Settings.
const { useState: useStateO } = React;

/* ============================================================
   CalendarView — with workout detail drawer.
   ============================================================ */
function CalendarView() {
  const [selected, setSelected] = useStateO({ wk: 1, day: 1 }); // wk10 Tue threshold (completed)

  const weeks = [
    { label: 'Wk 11 · Build 2/3', range: 'Jun 2 – 8',  tss: 570, completed: 128 },
    { label: 'Wk 10 · Build 1/3', range: 'May 26 – Jun 1', tss: 612, completed: 612 },
    { label: 'Wk 9 · Recovery',   range: 'May 19 – 25', tss: 320, completed: 320 },
    { label: 'Wk 8 · Build 3/3',  range: 'May 12 – 18', tss: 658, completed: 658 },
  ];
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const grid = [
    [['Z2 base','62','z2','done',2,'Jun'],['Threshold','128','z4','today',3,'Jun'],['Recovery','24','z1','planned',4,'Jun'],['VO2 6×3','96','z5','planned',5,'Jun'],null,['Long ride','195','z2','planned',7,'Jun'],['Brick run','65','z3','planned',8,'Jun']],
    [['Off','—',null,'done',26,'May'],['Threshold 4×8','128','z4','done',27,'May'],['Z2 base','64','z2','done',28,'May'],['VO2 5×4','110','z5','done',29,'May'],['Recovery','22','z1','done',30,'May'],['Long ride','190','z2','done',31,'May'],['Brick','98','z3','done',1,'Jun']],
    [['Recovery','18','z1','done',19,'May'],['Z2','60','z2','done',20,'May'],['Off','—',null,'done',21,'May'],['Tempo','82','z3','done',22,'May'],['Z2','58','z2','done',23,'May'],['Long easy','78','z1','done',24,'May'],['Off','—',null,'done',25,'May']],
    [['Off','—',null,'done',12,'May'],['Threshold','120','z4','done',13,'May'],['Z2','68','z2','done',14,'May'],['VO2','105','z5','done',15,'May'],['Recovery','22','z1','done',16,'May'],['Long ride','215','z2','done',17,'May'],['Brick','108','z3','done',18,'May']],
  ];
  const zColors = { z1: '#5C6470', z2: '#3FB37F', z3: '#E8C547', z4: '#E89B3C', z5: '#E5484D' };
  const selectedCell = grid[selected.wk] && grid[selected.wk][selected.day];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>Calendar</div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Macrocycle · Lahti M70.3</h1>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 6 }}>
            Build block 2 of 3 · peak Wk 13 · taper begins Wk 15.
          </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(7, 1fr) 70px', background: 'var(--bg-1)', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ padding: '10px 14px', fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Week</div>
            {days.map(d => <div key={d} style={{ padding: '10px 8px', fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d}</div>)}
            <div style={{ padding: '10px 14px', fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>TSS</div>
          </div>
          {weeks.map((wk, wi) => (
            <div key={wi} style={{
              display: 'grid',
              gridTemplateColumns: '140px repeat(7, 1fr) 70px',
              borderBottom: wi < weeks.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            }}>
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-1)' }}>{wk.label}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{wk.range}</div>
              </div>
              {grid[wi].map((cell, ci) => {
                const isSel = selected.wk === wi && selected.day === ci;
                return (
                  <div key={ci}
                    onClick={() => cell && setSelected({ wk: wi, day: ci })}
                    style={{
                      padding: 8,
                      borderLeft: '1px solid var(--border-subtle)',
                      minHeight: 80,
                      cursor: cell ? 'pointer' : 'default',
                      background: isSel ? 'var(--bg-3)' : 'transparent',
                  }}>
                    {cell ? (
                      <div style={{
                        padding: '8px 10px',
                        background: 'var(--bg-1)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 6,
                        borderLeft: cell[2] ? `2px solid ${zColors[cell[2]]}` : '2px solid var(--border-default)',
                        opacity: cell[3] === 'done' ? 0.75 : 1,
                        boxShadow: cell[3] === 'today' ? 'inset 0 0 0 1px var(--accent)' : (isSel ? 'inset 0 0 0 1px var(--border-strong)' : 'none'),
                      }}>
                        <div style={{ fontSize: 12, color: 'var(--fg-1)', fontWeight: 500 }}>{cell[0]}</div>
                        <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{cell[1]} TSS</div>
                      </div>
                    ) : <div style={{ fontSize: 11, color: 'var(--fg-4)', fontStyle: 'italic', padding: '8px 10px' }}>—</div>}
                  </div>
                );
              })}
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', borderLeft: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', fontWeight: 500 }}>{wk.tss}</div>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{wk.completed}/{wk.tss}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workout detail drawer */}
      <WorkoutDetail cell={selectedCell} />
    </div>
  );
}

function WorkoutDetail({ cell }) {
  if (!cell) {
    return (
      <div style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        padding: 24,
        position: 'sticky',
        top: 0,
      }}>
        <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>Select a session.</div>
      </div>
    );
  }
  const [name, tss, zone, state, date, mo] = cell;
  const done = state === 'done';
  const today = state === 'today';
  const zColors = { z1: '#5C6470', z2: '#3FB37F', z3: '#E8C547', z4: '#E89B3C', z5: '#E5484D' };

  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border-default)',
      borderRadius: 10,
      position: 'sticky',
      top: 0,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {zone && <Pill color={zone}>{zone.toUpperCase()}</Pill>}
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

      {/* Stats */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)', marginBottom: 10 }}>
          {done ? 'Actuals' : 'Targets'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {(done ? [
            ['Time', '1:38'], ['Avg HR', '162'], ['NP', '278 W'],
            ['IF', '0.92'], ['TSS', tss], ['Drift', '+8%'],
          ] : [
            ['Time', '1:42'], ['Target', '285 W'], ['TSS', tss],
          ]).map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: 'var(--fg-1)', marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI summary */}
      {done && (
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(139,124,246,0.03)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Icon name="sparkles" size={11} color="var(--ai)" />
            <span style={{ fontSize: 10, color: 'var(--ai)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI summary</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.55 }}>
            Held threshold within <span style={{ fontFamily: 'var(--font-mono)' }}>2%</span> of target on first three intervals. Cardiac drift was <span style={{ fontFamily: 'var(--font-mono)' }}>+8%</span> — above your typical 4–5%. Heat (24°C) likely the driver. Solid execution; recovery focus tomorrow.
          </div>
        </div>
      )}

      {/* Conversation */}
      {done && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Conversation · 4 msgs</span>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--fg-3)', fontSize: 11, cursor: 'pointer' }}>Open in Chat ↗</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              padding: '8px 10px', background: 'var(--bg-1)',
              border: '1px solid var(--border-subtle)', borderRadius: 6,
              fontSize: 12, color: 'var(--fg-2)',
            }}>
              <span style={{ color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>You · 19:32</span>
              <div style={{ marginTop: 2 }}>Felt OK but legs were heavier than I expected by #3.</div>
            </div>
            <div style={{
              padding: '8px 10px', background: 'rgba(139,124,246,0.06)',
              border: '1px solid rgba(139,124,246,0.16)', borderRadius: 6,
              fontSize: 12, color: 'var(--fg-1)',
            }}>
              <span style={{ color: 'var(--ai)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>Coach · 19:33</span>
              <div style={{ marginTop: 2 }}>Sat ride was 12% over plan TSS. Likely the cause. Flagging the volume pattern for review.</div>
            </div>
          </div>
        </div>
      )}

      {/* Adaptation notes */}
      {done && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Adaptation notes
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Icon name="git-branch" size={11} color="var(--fg-4)" style={{ marginTop: 3 }} />
            <span>Moved Wed recovery from <span style={{ fontFamily: 'var(--font-mono)' }}>0:45</span> to <span style={{ fontFamily: 'var(--font-mono)' }}>0:30</span> based on RPE 7/10 reported here.</span>
          </div>
        </div>
      )}

      {/* Athlete reflection */}
      <div style={{ padding: '14px 20px' }}>
        <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          {done ? 'Your reflection' : 'Pre-session note'}
        </div>
        <div style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: 10,
          minHeight: 60,
          fontSize: 12,
          color: done ? 'var(--fg-2)' : 'var(--fg-4)',
          fontStyle: done ? 'normal' : 'italic',
          lineHeight: 1.5,
        }}>
          {done
            ? 'Held the power but mentally hard from #2 onward. Considered pulling #4 but stayed on.'
            : 'Add a pre-session note…'}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   RacesView
   ============================================================ */
function RacesView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>Races · 2026 season</div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>The road to Lahti</h1>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 6 }}>
            1 A-race · 2 supporting races · everything else is training.
          </div>
        </div>
        <Button kind="secondary" size="md" icon="plus">Add race</Button>
      </div>

      <RaceRow tier="A" race={{
        name: 'Ironman 70.3 Lahti',
        date: 'Sat, Aug 16',
        countdown: '74d',
        location: 'Lahti, FI',
        goal: 'Sub 4:55 · top 5 AG',
        legs: [
          ['Swim · 1.9 km', '32:00'],
          ['Bike · 90 km', '2:38'],
          ['Run · 21.1 km', '1:35'],
        ],
        primary: true,
      }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <RaceRow tier="B" compact race={{
          name: 'Tampere Olympic',
          date: 'Sun, Jul 6',
          countdown: '33d',
          location: 'Tampere, FI',
          goal: 'Race-pace bike at IM effort',
        }} />
        <RaceRow tier="C" compact race={{
          name: 'Helsinki Sprint Series #3',
          date: 'Sat, Jun 21',
          countdown: '18d',
          location: 'Helsinki, FI',
          goal: 'Brick + open-water exposure',
        }} />
      </div>

      {/* Strategy + AI discussion */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <StrategyCard
          title="Pacing strategy · Lahti"
          tag="@pacing"
          items={[
            ['Swim', 'Settle by 200m. Feet of P4–P6.'],
            ['Bike', 'NP 210–215 W · cap surges at 280 W on climbs'],
            ['Run', 'First 5 km @ 4:35/km · close in 4:25/km'],
            ['Mental', 'Mile-by-mile from 14 km. No splits in head.'],
          ]}
        />
        <StrategyCard
          title="Fueling strategy · Lahti"
          tag="@fueling"
          items={[
            ['Pre-race', 'Oats + banana + coffee · T-3h'],
            ['Bike', '90 g carb/h · 750 ml/h · 600 mg Na/h'],
            ['Run', '1 gel every 25 min · water at every aid'],
            ['Caffeine', '100 mg T-0 · 100 mg at km 7 run'],
          ]}
        />
        <StrategyCard
          title="Equipment notes · Lahti"
          tag="@equipment"
          items={[
            ['Bike', 'TT bike · 60mm front · disc rear'],
            ['Wheels', 'Sub 20°C → standard tubeless · over → race tires'],
            ['Helmet', 'Aero · short-tail'],
            ['Tri suit', 'Sleeved · sleeves only if water <16°C'],
          ]}
        />
        <RaceDiscussion />
      </div>
    </div>
  );
}

function RaceRow({ race, tier, compact }) {
  const tierColors = { A: 'var(--accent)', B: 'var(--ai)', C: 'var(--fg-3)' };
  return (
    <div style={{
      background: race.primary ? 'var(--bg-2)' : 'var(--bg-2)',
      border: '1px solid var(--border-default)',
      borderRadius: 10,
      padding: compact ? 20 : 24,
      borderLeft: `2px solid ${tierColors[tier]}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
              color: tierColors[tier],
              border: `1px solid ${tierColors[tier]}55`,
              padding: '2px 6px', borderRadius: 3,
              background: tier === 'A' ? 'var(--accent-soft)' : tier === 'B' ? 'var(--ai-soft)' : 'var(--bg-3)',
            }}>{tier}-RACE</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
              {race.date} · {race.location}
            </span>
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
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: compact ? 22 : 32, fontWeight: 500, color: tierColors[tier], letterSpacing: '-0.02em', lineHeight: 1 }}>
            {race.countdown}
          </div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginTop: 4 }}>to go</div>
        </div>
      </div>
    </div>
  );
}

function StrategyCard({ title, tag, items }) {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border-default)',
      borderRadius: 10,
      padding: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>{title}</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ai)', background: 'var(--ai-soft)', padding: '1px 5px', borderRadius: 3 }}>{tag}</span>
        </div>
        <Button kind="ghost" size="sm" icon="pencil-line" />
      </div>
      <div>
        {items.map(([k, v], i) => (
          <div key={k} style={{
            display: 'grid',
            gridTemplateColumns: '90px 1fr',
            gap: 12,
            padding: '10px 0',
            borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
            alignItems: 'baseline',
          }}>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
            <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.5 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RaceDiscussion() {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border-default)',
      borderRadius: 10,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="sparkles" size={12} color="var(--ai)" />
          <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>Recent race discussions</span>
        </div>
        <Button kind="ghost" size="sm" iconRight="arrow-right">Open chat</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {[
          ['Should I race Tampere as a tune-up or skip?', '2 days ago'],
          ['Bike split target — what\'s realistic?', '5 days ago'],
          ['Fueling rehearsal during Wk 13 long ride?', '1 week ago'],
        ].map(([q, t]) => (
          <div key={q} style={{
            padding: '10px 12px',
            background: 'var(--bg-1)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}>
            <span style={{ fontSize: 13, color: 'var(--fg-1)' }}>{q}</span>
            <span style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   SettingsView — extended with AI model / API keys / coach customization
   ============================================================ */
function SettingsView() {
  const [section, setSection] = useStateO('ai');
  const sections = [
    { id: 'account', label: 'Account', icon: 'user' },
    { id: 'connections', label: 'Connections', icon: 'plug' },
    { id: 'ai', label: 'AI model', icon: 'cpu' },
    { id: 'coach', label: 'Coach style', icon: 'message-square' },
    { id: 'rules', label: 'Adaptation rules', icon: 'sliders-horizontal' },
    { id: 'keys', label: 'API keys', icon: 'key' },
    { id: 'appearance', label: 'Appearance', icon: 'palette' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>Settings</div>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Workspace preferences</h1>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Side nav */}
        <div style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          padding: 6,
        }}>
          {sections.map(s => (
            <div
              key={s.id}
              onClick={() => setSection(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                background: section === s.id ? 'var(--bg-3)' : 'transparent',
                boxShadow: section === s.id ? 'inset 2px 0 0 var(--accent)' : 'none',
                color: section === s.id ? 'var(--fg-1)' : 'var(--fg-2)',
                fontSize: 13,
                fontWeight: section === s.id ? 500 : 400,
              }}
              onMouseEnter={e => { if (section !== s.id) e.currentTarget.style.background = 'var(--bg-1)'; }}
              onMouseLeave={e => { if (section !== s.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon name={s.icon} size={14} color={section === s.id ? 'var(--fg-1)' : 'var(--fg-3)'} />
              {s.label}
            </div>
          ))}
        </div>

        {/* Detail */}
        <div>
          {section === 'ai' && <AIModelPanel />}
          {section === 'keys' && <APIKeysPanel />}
          {section === 'coach' && <CoachStylePanel />}
          {section === 'rules' && <RulesPanel />}
          {section === 'account' && <SimplePanel title="Account" items={[
            ['Name', 'Mira Lindqvist'],
            ['Email', 'mira@endurance.os'],
            ['Discipline', 'Triathlon · Long course'],
            ['Time zone', 'Europe/Helsinki · GMT+3'],
          ]} />}
          {section === 'connections' && <SimplePanel title="Connections" items={[
            ['Garmin Connect', 'Connected · 2m ago'],
            ['TrainingPeaks', 'Not connected'],
            ['Strava', 'Connected · 14m ago'],
            ['Apple Health', 'Connected'],
            ['intervals.icu', 'Not connected'],
          ]} />}
          {section === 'appearance' && <SimplePanel title="Appearance" items={[
            ['Theme', 'Graphite (dark)'],
            ['Density', 'Comfortable'],
            ['Accent', 'Electric lime'],
            ['Font', 'Geist · default'],
          ]} />}
        </div>
      </div>
    </div>
  );
}

function AIModelPanel() {
  const models = [
    { id: 'sonnet', vendor: 'Anthropic', name: 'Claude Sonnet 4.5', desc: 'Default. Deep training reasoning, long context.', tag: 'Recommended', active: true },
    { id: 'opus',   vendor: 'Anthropic', name: 'Claude Opus 4.5',   desc: 'Highest-fidelity reasoning. Slow. Use for hard adaptations.', tag: 'Premium' },
    { id: 'gpt',    vendor: 'OpenAI',    name: 'GPT-5',             desc: 'Fast, broad. Bring your own key.', tag: 'BYOK' },
    { id: 'local',  vendor: 'Local',     name: 'Ollama · llama-3.3',desc: 'On-device. Works offline. Lower training-context depth.', tag: 'Local' },
    { id: 'custom', vendor: 'Custom',    name: 'Custom endpoint',   desc: 'OpenAI-compatible URL + auth. For self-hosted models.', tag: 'Custom' },
  ];
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border-default)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>AI model</h2>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
          The Coach is model-agnostic. Use ours, bring your own, or self-host.
        </div>
      </div>
      <div>
        {models.map((m, i) => (
          <div key={m.id} style={{
            padding: '14px 20px',
            borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
            display: 'grid',
            gridTemplateColumns: '24px 1fr auto',
            gap: 14,
            alignItems: 'center',
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: 999,
              border: `1.5px solid ${m.active ? 'var(--accent)' : 'var(--border-strong)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {m.active && <div style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent)' }} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>{m.name}</span>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>· {m.vendor}</span>
                {m.tag && (
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: m.active ? 'var(--accent)' : 'var(--fg-3)', background: m.active ? 'var(--accent-soft)' : 'var(--bg-3)', padding: '1px 6px', borderRadius: 3 }}>{m.tag}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{m.desc}</div>
            </div>
            <Button kind="ghost" size="sm">{m.active ? 'Configure' : 'Use'}</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function APIKeysPanel() {
  const keys = [
    { provider: 'Anthropic', key: 'sk-ant-•••••••••••••3f2a', status: 'Verified', added: '14 days ago' },
    { provider: 'OpenAI',    key: 'sk-•••••••••••••a91c', status: 'Verified', added: '14 days ago' },
    { provider: 'Custom · self-hosted', key: 'https://endurance.local:11434', status: 'Reachable', added: '4 days ago' },
  ];
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border-default)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>API keys</h2>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
          Keys stay on this device. Never transmitted to Endurance.OS servers.
        </div>
      </div>
      {keys.map((k, i) => (
        <div key={i} style={{
          padding: '14px 20px',
          borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>{k.provider}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{k.key}</div>
          </div>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: 'var(--success)', marginRight: 5, verticalAlign: 'middle' }} />
            {k.status}
          </span>
          <span style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>{k.added}</span>
          <Button kind="ghost" size="sm" icon="trash-2" />
        </div>
      ))}
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)' }}>
        <Button kind="secondary" size="sm" icon="plus">Add key</Button>
      </div>
    </div>
  );
}

function CoachStylePanel() {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border-default)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Coach style</h2>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
          How the Coach talks to you. Edited fields apply to every future conversation.
        </div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {[
          ['Tone', ['Direct', 'Friendly', 'Mentor', 'Pro coach']],
          ['Length', ['Short', 'Standard', 'Verbose']],
          ['Praise', ['None', 'Minimal', 'Encouraging']],
          ['Challenge me', ['Never', 'When data conflicts', 'Always']],
        ].map(([k, opts], i) => (
          <div key={k} style={{
            display: 'grid',
            gridTemplateColumns: '180px 1fr',
            gap: 16,
            padding: '12px 0',
            borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
            alignItems: 'center',
          }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>{k}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {opts.map((o, oi) => (
                <button key={o} style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  background: oi === (k === 'Tone' ? 0 : k === 'Length' ? 0 : k === 'Praise' ? 1 : 1) ? 'var(--bg-4)' : 'var(--bg-1)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 4,
                  color: oi === (k === 'Tone' ? 0 : k === 'Length' ? 0 : k === 'Praise' ? 1 : 1) ? 'var(--fg-1)' : 'var(--fg-3)',
                  cursor: 'pointer',
                }}>{o}</button>
              ))}
            </div>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 8 }}>System prompt (advanced)</div>
          <textarea
            defaultValue={`You are a head endurance coach. Talk like a former pro: precise, grounded, brief. Never use motivational language. State the recommendation, then briefly why. When data conflicts with the athlete's plan, surface it.`}
            rows={4}
            style={{
              width: '100%',
              background: 'var(--bg-1)',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              padding: 10,
              color: 'var(--fg-1)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              lineHeight: 1.5,
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function RulesPanel() {
  const rules = [
    { name: 'HRV-driven swap', when: 'HRV < −7% for 2d', then: 'Propose Z2 swap', mode: 'Auto-propose', enabled: true },
    { name: 'Sleep guard', when: 'Sleep < 6h', then: 'Downshift today\'s intensity', mode: 'Auto-propose', enabled: true },
    { name: 'Travel cap', when: 'Flight > 2h', then: 'Cap intensity 24h post-flight', mode: 'Auto-apply', enabled: true },
    { name: 'Race week', when: 'T-7 days to A-race', then: 'No Z4+ work · openers Thu', mode: 'Auto-apply', enabled: true },
    { name: 'Injury pause', when: 'Pain reported', then: 'Pause 48h · resume Z1', mode: 'Manual', enabled: true },
    { name: 'Sauna post-VO2', when: 'VO2 logged today', then: 'Skip sauna recommendation', mode: 'Auto-propose', enabled: false },
  ];
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border-default)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Adaptation rules</h2>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
            Conditions the Coach uses to propose or apply changes to your plan.
          </div>
        </div>
        <Button kind="secondary" size="sm" icon="plus">New rule</Button>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 110px 60px',
        background: 'var(--bg-1)',
        padding: '8px 20px',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--fg-3)',
        fontFamily: 'var(--font-mono)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <span>Rule</span>
        <span>When</span>
        <span>Then</span>
        <span>Mode</span>
        <span style={{ textAlign: 'right' }}>On</span>
      </div>
      {rules.map((r, i) => (
        <div key={r.name} style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 110px 60px',
          padding: '12px 20px',
          borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
          alignItems: 'center',
          fontSize: 12,
          opacity: r.enabled ? 1 : 0.5,
        }}>
          <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{r.name}</span>
          <span style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>{r.when}</span>
          <span style={{ color: 'var(--fg-2)' }}>{r.then}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: r.mode === 'Auto-apply' ? 'var(--ai)' : 'var(--fg-3)' }}>{r.mode}</span>
          <span style={{ textAlign: 'right' }}>
            <ToggleDot on={r.enabled} />
          </span>
        </div>
      ))}
    </div>
  );
}

function ToggleDot({ on }) {
  return (
    <div style={{
      display: 'inline-block',
      width: 26, height: 14, borderRadius: 999,
      background: on ? 'var(--accent)' : 'var(--bg-3)',
      border: `1px solid ${on ? 'var(--accent)' : 'var(--border-default)'}`,
      position: 'relative',
      cursor: 'pointer',
    }}>
      <div style={{
        position: 'absolute',
        top: 1, left: on ? 13 : 1,
        width: 10, height: 10, borderRadius: 999,
        background: on ? 'var(--accent-fg)' : 'var(--fg-3)',
        transition: 'left var(--dur-micro) var(--ease-out)',
      }} />
    </div>
  );
}

function SimplePanel({ title, items }) {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border-default)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>{title}</h2>
      </div>
      {items.map(([k, v], i) => (
        <div key={k} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
          borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
        }}>
          <div style={{ fontSize: 13, color: 'var(--fg-1)' }}>{k}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--fg-2)', fontFamily: v.match(/^[A-Z][a-z]+( |$)/) ? 'inherit' : 'var(--font-mono)' }}>{v}</div>
            <Icon name="chevron-right" size={14} color="var(--fg-4)" />
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { CalendarView, RacesView, SettingsView });
