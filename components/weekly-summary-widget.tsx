'use client'

import type { WeeklySummaryData } from '@/lib/types/coach-widgets'

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—'
  return n.toFixed(decimals)
}

export function WeeklySummaryWidget({ data }: { data: WeeklySummaryData }) {
  const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' }
  const cellStyle: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: 12,
    color: 'var(--fg-1)',
    borderBottom: '1px solid var(--border-subtle)',
    verticalAlign: 'middle',
  }
  const headerCell: React.CSSProperties = {
    ...cellStyle,
    fontSize: 11,
    color: 'var(--fg-4)',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid var(--border-default)',
  }
  const numCell: React.CSSProperties = { ...cellStyle, ...mono, textAlign: 'right' }
  const numHeader: React.CSSProperties = { ...headerCell, textAlign: 'right' }

  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border-default)',
      borderRadius: 10,
      overflow: 'hidden',
      fontSize: 13,
    }}>
      {/* Header bar */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
      }}>
        <span style={{ fontWeight: 600, color: 'var(--fg-1)', fontSize: 13 }}>Weekly Review</span>
        <span style={{ fontSize: 11, color: 'var(--fg-4)', ...mono }}>
          {data.week_start} – {data.week_end}
        </span>
      </div>

      {/* Day table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...headerCell, textAlign: 'left', width: 40 }}>Day</th>
              <th style={{ ...headerCell, textAlign: 'left' }}>Session</th>
              <th style={{ ...numHeader, width: 64 }}>Duration</th>
              <th style={{ ...numHeader, width: 48 }}>TSS</th>
              <th style={{ ...numHeader, width: 40 }}>IF</th>
            </tr>
          </thead>
          <tbody>
            {data.days.map((d, i) => {
              const isRest = !d.session_name
              return (
                <tr key={i} style={{ background: isRest ? 'transparent' : 'rgba(139,124,246,0.03)' }}>
                  <td style={{ ...cellStyle, ...mono, color: 'var(--fg-3)', fontSize: 11 }}>{d.day_label}</td>
                  <td style={{ ...cellStyle, color: isRest ? 'var(--fg-4)' : 'var(--fg-1)' }}>
                    {isRest ? <em style={{ fontStyle: 'normal', color: 'var(--fg-4)' }}>Rest</em> : d.session_name}
                  </td>
                  <td style={numCell}>
                    {d.duration_minutes != null ? `${d.duration_minutes}m` : '—'}
                  </td>
                  <td style={numCell}>{fmt(d.tss)}</td>
                  <td style={numCell}>{d.intensity_factor != null ? fmt(d.intensity_factor, 2) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        gap: 20,
        padding: '8px 12px',
        borderTop: '1px solid var(--border-default)',
        background: 'var(--bg-3)',
      }}>
        <StatPill label="Weekly TSS" value={fmt(data.weekly_tss)} />
        <StatPill label="Sessions" value={String(data.session_count)} />
      </div>

      {/* Went well */}
      {data.went_well && data.went_well.length > 0 && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
            What went well
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {data.went_well.map((item, i) => (
              <li key={i} style={{ fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.45 }}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Flags */}
      {data.flags && data.flags.length > 0 && (
        <div style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'rgba(232,155,60,0.06)',
          borderLeft: '3px solid var(--warning)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
            Flags
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {data.flags.map((item, i) => (
              <li key={i} style={{ fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.45 }}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Bottom line */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'rgba(139,124,246,0.06)',
      }}>
        <span style={{ fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.5 }}>{data.bottom_line}</span>
      </div>

      {/* Closing question */}
      {data.closing_question && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5, fontStyle: 'italic' }}>{data.closing_question}</span>
        </div>
      )}
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  )
}
