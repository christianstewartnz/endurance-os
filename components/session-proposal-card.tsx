'use client'

import { useState } from 'react'
import { Button } from '@/components/atoms'
import type { ProposeSessionInput, FuelingSuggestion } from '@/lib/hooks/use-coach-chat'

interface SessionProposalCardProps {
  proposal: ProposeSessionInput
  onAdd: (date: string) => void
  onDecline: () => void
  adding: boolean
}

function FuelingBlock({ fueling }: { fueling: FuelingSuggestion }) {
  const hasTargets = fueling.carb_g_per_hour || fueling.fluid_ml_per_hour || fueling.sodium_mg_per_hour
  const parts: string[] = []
  if (fueling.carb_g_per_hour) parts.push(`${fueling.carb_g_per_hour}g carbs/h`)
  if (fueling.fluid_ml_per_hour) parts.push(`${fueling.fluid_ml_per_hour}ml/h`)
  if (fueling.sodium_mg_per_hour) parts.push(`${fueling.sodium_mg_per_hour}mg sodium/h`)

  return (
    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(139,124,246,0.06)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--ai)', marginBottom: 4 }}>
        Fueling plan
      </div>
      {hasTargets && (
        <div style={{ fontSize: 12, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', marginBottom: fueling.note ? 4 : 0 }}>
          {parts.join(' · ')}
        </div>
      )}
      {fueling.note && (
        <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.5 }}>{fueling.note}</div>
      )}
    </div>
  )
}

function formatDateLabel(d: string): string {
  try {
    const [y, mo, da] = d.split('-').map(Number)
    return new Date(y, mo - 1, da).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    return d
  }
}

export function SessionProposalCard({ proposal, onAdd, onDecline, adding }: SessionProposalCardProps) {
  const [date, setDate] = useState(proposal.date)

  const dur = proposal.duration_seconds
    ? (() => {
        const h = Math.floor(proposal.duration_seconds / 3600)
        const m = Math.floor((proposal.duration_seconds % 3600) / 60)
        return h > 0 ? `~${h}h ${m}min` : `~${m}min`
      })()
    : '—'

  return (
    <div style={{ marginTop: 10, border: '1px solid var(--border-default)', background: 'var(--bg-2)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 6 }}>
          Session Proposal
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 4 }}>{proposal.name}</div>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
          {proposal.sport} · {dur}{proposal.estimated_tss ? ` · Est. TSS ${proposal.estimated_tss}` : ''}
        </div>
      </div>
      {proposal.description && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', lineHeight: 1.7, whiteSpace: 'pre-wrap' as const }}>
          {proposal.description}
        </div>
      )}
      {proposal.fueling_suggestion && (
        <FuelingBlock fueling={proposal.fueling_suggestion} />
      )}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 12, color: 'var(--fg-3)', flexShrink: 0 }}>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border-default)',
            borderRadius: 5,
            padding: '3px 7px',
            color: 'var(--fg-1)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            outline: 'none',
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{formatDateLabel(date)}</span>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
        <Button kind="ai" size="sm" icon="check" onClick={() => onAdd(date)}>
          {adding ? 'Adding…' : 'Add to calendar'}
        </Button>
        <Button kind="ghost" size="sm" icon="x" onClick={onDecline}>Decline</Button>
      </div>
    </div>
  )
}
