'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Icon, Kbd } from '@/components/atoms'

interface NextRace {
  id: string
  race_name: string
  race_date: string
  priority: 'A' | 'B' | 'C'
}

interface AthleteSummary {
  name: string | null
  sports: string[]
}

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'layout-dashboard', kbd: '⌘1' },
  { path: '/calendar',  label: 'Calendar',  icon: 'calendar',         kbd: '⌘2' },
  { path: '/context',   label: 'Context',   icon: 'brain',            kbd: '⌘3' },
  { path: '/races',     label: 'Races',     icon: 'flag',             kbd: '⌘4' },
  { path: '/settings',  label: 'Settings',  icon: 'settings-2',       kbd: '⌘,' },
] as const

interface SidebarProps {
  onSearch?: () => void
  userEmail?: string
}

function formatSportsSubtitle(sports: string[]): string {
  if (!sports.length) return ''
  const lower = sports.map((s) => s.toLowerCase())
  const hasAll = ['cycling', 'running', 'swimming'].every((s) => lower.includes(s))
  if (hasAll || lower.includes('triathlon')) return 'Triathlon'
  return sports.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' · ')
}

function deriveAthleteDisplayName(name: string | null, email?: string): string {
  if (name) return name
  if (email) return email.split('@')[0]
  return 'Athlete'
}

function parseDateLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((parseDateLocal(dateStr).getTime() - today.getTime()) / 86400000)
}

function formatShortDate(dateStr: string): string {
  return parseDateLocal(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Sidebar({ onSearch, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [contextDot, setContextDot] = useState(false)
  const [nextRace, setNextRace] = useState<NextRace | null | undefined>(undefined)
  const [athlete, setAthlete] = useState<AthleteSummary | null>(null)

  useEffect(() => {
    fetch('/api/context/suggestions/pending')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setContextDot(d.suggestions.length > 0) })
      .catch(() => {})
  }, [pathname])

  useEffect(() => {
    fetch('/api/races/next')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setNextRace(d?.race ?? null) })
      .catch(() => { setNextRace(null) })
  }, [pathname])

  useEffect(() => {
    fetch('/api/context/athlete_profile')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.data) {
          setAthlete({
            name: d.data.name ?? null,
            sports: Array.isArray(d.data.sports) ? d.data.sports : [],
          })
        }
      })
      .catch(() => {})
  }, [])

  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      background: 'var(--bg-1)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      height: '100%',
    }}>
      {/* Brand / athlete switcher */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '16px 14px 12px',
        cursor: 'pointer',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-mark.svg" width={22} height={22} alt="" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {deriveAthleteDisplayName(athlete?.name ?? null, userEmail)}
          </div>
          {athlete && athlete.sports.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              {formatSportsSubtitle(athlete.sports)}
            </div>
          )}
        </div>
        <Icon name="chevrons-up-down" size={14} color="var(--fg-3)" />
      </div>

      {/* Search */}
      <div style={{ padding: '4px 10px 10px' }}>
        <div
          onClick={onSearch}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 28,
            padding: '0 10px',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            color: 'var(--fg-3)',
            fontSize: 12,
            cursor: 'pointer',
          }}>
          <Icon name="search" size={13} />
          <span style={{ flex: 1 }}>Search…</span>
          <Kbd>⌘K</Kbd>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '4px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.path
          return (
            <div
              key={item.path}
              onClick={() => router.push(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 10px',
                height: 30,
                borderRadius: 6,
                background: active ? 'var(--bg-3)' : 'transparent',
                boxShadow: active ? 'inset 2px 0 0 var(--accent)' : 'none',
                color: active ? 'var(--fg-1)' : 'var(--fg-2)',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                cursor: 'pointer',
                transition: 'background var(--dur-micro) var(--ease-out)',
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-2)' }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              <Icon
                name={item.icon}
                size={15}
                color={active ? 'var(--fg-1)' : 'var(--fg-3)'}
              />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.path === '/context' && contextDot && !active && (
                <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />
              )}
              {active && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>{item.kbd}</span>
              )}
            </div>
          )
        })}
      </nav>

      {/* Race countdown footer */}
      <div style={{ padding: '12px 10px 16px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{
          padding: '10px 12px',
          background: 'var(--bg-2)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 4 }}>
            Next race
          </div>
          {nextRace === undefined ? (
            <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>—</div>
          ) : nextRace === null ? (
            <div>
              <div style={{ fontSize: 12, color: 'var(--fg-4)', marginBottom: 6 }}>No upcoming races</div>
              <button
                onClick={() => router.push('/races')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent)', padding: 0 }}
              >
                + Add race
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)', letterSpacing: '-0.01em' }}>
                {nextRace.race_name}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                  {formatShortDate(nextRace.race_date)}
                </span>
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 500 }}>
                  {daysUntil(nextRace.race_date)}<span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>d</span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
