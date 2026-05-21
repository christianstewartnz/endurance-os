'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Icon, Kbd } from '@/components/atoms'

const ALL_ITEMS = [
  { path: '/dashboard', icon: 'layout-dashboard', label: 'Go to Dashboard',               group: 'Navigate', kbd: 'G D' },
  { path: '/calendar',  icon: 'calendar',         label: 'Go to Calendar',                group: 'Navigate', kbd: 'G C' },
  { path: '/context',   icon: 'brain',            label: 'Open Context',                  group: 'Navigate', kbd: 'G X' },
  { path: '/races',     icon: 'flag',             label: 'Go to Races',                   group: 'Navigate', kbd: 'G R' },
  { path: '/settings',  icon: 'settings-2',       label: 'Settings',                      group: 'Navigate', kbd: 'G S' },
  { icon: 'plus',                label: 'New session',                    group: 'Create',  kbd: 'C S' },
  { icon: 'message-square-plus', label: 'New chat thread',                group: 'Create',  kbd: 'C N' },
  { icon: 'flag',                label: 'New race',                       group: 'Create',  kbd: 'C R' },
  { icon: 'sliders-horizontal',  label: 'New adaptation rule',            group: 'Create' },
  { icon: 'at-sign',             label: 'Tag context · @todaysworkout',   group: 'Coach',   ai: true },
  { icon: 'shuffle',             label: 'Rebalance this week',            group: 'Coach',   ai: true },
  { icon: 'sparkles',            label: 'Review pending memory updates',  group: 'Coach',   ai: true, kbd: '⌘M' },
  { icon: 'cpu',                 label: 'Switch AI model',                group: 'Coach' },
  { icon: 'refresh-cw',          label: 'Sync Garmin',                    group: 'System' },
  { icon: 'palette',             label: 'Toggle density',                 group: 'System' },
] as const

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setActive(0)
    }
  }, [open])

  if (!open) return null

  const filtered = query
    ? ALL_ITEMS.filter((it) => it.label.toLowerCase().includes(query.toLowerCase()))
    : ALL_ITEMS

  const grouped: Record<string, typeof filtered[number][]> = {}
  filtered.forEach((it) => {
    grouped[it.group] = grouped[it.group] || []
    grouped[it.group].push(it)
  })

  let runningIdx = -1

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter') {
      const it = filtered[active]
      if ('path' in it && it.path) router.push(it.path)
      onClose()
    }
  }

  function handleClick(it: typeof ALL_ITEMS[number]) {
    if ('path' in it && it.path) router.push(it.path)
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(8, 9, 10, 0.72)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 120,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          background: 'var(--bg-1)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.60), 0 0 0 1px var(--border-default)',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <Icon name="search" size={14} color="var(--fg-3)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={handleKey}
            placeholder="Search sessions, plans, athletes — or type a command…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--fg-1)', fontFamily: 'inherit', fontSize: 14,
            }}
          />
          <Kbd>ESC</Kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 380, overflowY: 'auto', padding: '6px 0' }}>
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div style={{
                fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
                color: 'var(--fg-4)', padding: '8px 16px 4px',
              }}>{group}</div>
              {items.map((it) => {
                runningIdx++
                const isActive = runningIdx === active
                return (
                  <div
                    key={it.label}
                    onMouseEnter={() => setActive(filtered.indexOf(it))}
                    onClick={() => handleClick(it)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 16px',
                      background: isActive ? 'var(--bg-3)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon name={it.icon} size={14} color={'ai' in it && it.ai ? 'var(--ai)' : 'var(--fg-3)'} />
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--fg-1)' }}>{it.label}</span>
                    {'kbd' in it && it.kbd && (
                      <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>{it.kbd}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
              No matches. Try fewer words.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '8px 16px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)',
        }}>
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate</span>
          <span><Kbd>↵</Kbd> select</span>
          <span><Kbd>ESC</Kbd> close</span>
        </div>
      </div>
    </div>
  )
}
