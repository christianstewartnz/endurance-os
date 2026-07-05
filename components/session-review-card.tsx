'use client'

import type { SessionReviewData } from '@/lib/types/coach-widgets'

export function SessionReviewCard({ data }: { data: SessionReviewData }) {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border-default)',
      borderRadius: 10,
      overflow: 'hidden',
      fontSize: 13,
    }}>
      {/* Headline */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border-default)',
        background: 'rgba(139,124,246,0.06)',
      }}>
        <span style={{ fontWeight: 600, color: 'var(--fg-1)', fontSize: 13, lineHeight: 1.4 }}>{data.headline}</span>
      </div>

      {/* Analysis */}
      <div style={{ padding: '10px 12px', borderBottom: data.flags.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.6 }}>{data.analysis}</p>
      </div>

      {/* Flags */}
      {data.flags.length > 0 && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(232,155,60,0.06)',
          borderLeft: '3px solid var(--warning)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
            Flags
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {data.flags.map((f, i) => (
              <li key={i} style={{ fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.45 }}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
