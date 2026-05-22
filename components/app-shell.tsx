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
  fullWidth?: boolean
  userName?: string
  userEmail?: string
}

function deriveInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(/[\s._-]+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) {
    const local = email.split('@')[0]
    const parts = local.split(/[._-]+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return local.slice(0, 2).toUpperCase()
  }
  return 'U'
}

function deriveDisplayName(name?: string, email?: string): string {
  if (name) return name
  if (email) {
    const local = email.split('@')[0]
    return local
      .split(/[._-]+/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ')
  }
  return 'Account'
}

export default function AppShell({ children, fullWidth = false, userName, userEmail }: AppShellProps) {
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
  const displayName = deriveDisplayName(userName, userEmail)
  const initials = deriveInitials(userName, userEmail)
  const breadcrumb = [displayName, routeName]

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
              <Avatar initials={initials} color="#D8FE5F" />
            </div>
          </div>

          {/* Page content */}
          <div className="app-content">
            <div className={fullWidth ? 'inner inner-full' : 'inner'}>{children}</div>
          </div>
        </main>

        {coachOpen && <CoachPanel onClose={() => setCoachOpen(false)} />}

        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      </div>
    </CoachCtx.Provider>
  )
}
