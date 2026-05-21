'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import CoachPanel from '@/components/coach-panel'
import CommandPalette from '@/components/command-palette'
import { Button, Kbd, Avatar } from '@/components/atoms'

// Coach panel context — lets any nested component open the panel
const CoachCtx = createContext({ openCoach: () => {} })
export const useCoachPanel = () => useContext(CoachCtx)

const ROUTE_NAMES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/calendar':  'Calendar',
  '/context':   'Context',
  '/races':     'Races',
  '/settings':  'Settings',
}

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const [coachOpen, setCoachOpen] = useState(true)
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((o) => !o)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setCoachOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const routeName = ROUTE_NAMES[pathname] ?? 'Dashboard'
  const breadcrumb = ['Mira Lindqvist', routeName]

  return (
    <CoachCtx.Provider value={{ openCoach: () => setCoachOpen(true) }}>
      <div className="app-shell">
        <Sidebar onSearch={() => setCmdOpen(true)} />

        <main className="app-main">
          {/* Top bar */}
          <div className="top-bar">
            <div className="crumb">
              {breadcrumb.map((crumb, i, arr) => (
                <span key={crumb} style={{ display: 'contents' }}>
                  <span style={{ color: i === arr.length - 1 ? 'var(--fg-1)' : 'var(--fg-3)' }}>
                    {crumb}
                  </span>
                  {i < arr.length - 1 && <span className="crumb-sep">/</span>}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button kind="ghost" size="sm" icon="search" onClick={() => setCmdOpen(true)}>
                Search… <Kbd>⌘K</Kbd>
              </Button>
              <Button
                kind={coachOpen ? 'ai' : 'ghost'}
                size="sm"
                icon="sparkles"
                onClick={() => setCoachOpen((o) => !o)}
              >
                Coach <Kbd>⌘/</Kbd>
              </Button>
              <Avatar initials="ML" color="#D8FE5F" />
            </div>
          </div>

          {/* Page content */}
          <div className="app-content">
            <div className="inner">{children}</div>
          </div>
        </main>

        {coachOpen && <CoachPanel onClose={() => setCoachOpen(false)} />}

        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      </div>
    </CoachCtx.Provider>
  )
}
