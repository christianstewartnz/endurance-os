'use client'

import { useState, useEffect, useTransition } from 'react'
import { Icon, Button } from '@/components/atoms'
import { signoutAction } from '@/app/auth/actions'

interface IntervalsConnectionState {
  isConnected: boolean
  athleteId: string | null
  lastSyncedAt: string | null
  isInvalid: boolean
}

interface AnthropicKeyState {
  connected: boolean
  last4: string | null
  valid?: boolean
  error?: string
}

interface AthleteProfileData {
  name?: string | null
  location?: string | null
}

interface SettingsViewProps {
  intervalsConnection?: IntervalsConnectionState
  anthropicKeyState?: AnthropicKeyState
  userEmail?: string | null
  athleteProfile?: AthleteProfileData | null
}

export default function SettingsView({ intervalsConnection, anthropicKeyState, userEmail, athleteProfile }: SettingsViewProps) {
  const [section, setSection] = useState('connections')
  const sections = [
    { id: 'account',     label: 'Account',    icon: 'user' },
    { id: 'connections', label: 'Connections', icon: 'plug' },
    { id: 'ai',          label: 'AI model',   icon: 'cpu' },
    { id: 'keys',        label: 'API keys',   icon: 'key' },
    { id: 'appearance',  label: 'Appearance', icon: 'palette' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>Settings</div>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Workspace preferences</h1>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 6 }}>
          {sections.map((s) => (
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
            >
              <Icon name={s.icon} size={14} color={section === s.id ? 'var(--fg-1)' : 'var(--fg-3)'} />
              {s.label}
            </div>
          ))}
        </div>

        <div>
          {section === 'account'     && <AccountPanel email={userEmail ?? null} initialProfile={athleteProfile ?? null} />}
          {section === 'connections' && <ConnectionsPanel intervals={intervalsConnection} />}
          {section === 'ai'          && <AIModelComingSoonPanel />}
          {section === 'keys'        && <APIKeysPanel initial={anthropicKeyState} />}
          {section === 'appearance'  && <AppearancePanel />}
        </div>
      </div>
    </div>
  )
}

// ── Account panel ─────────────────────────────────────────────────────────────

function InlineEditField({ label, value, placeholder, onSave }: {
  label: string
  value: string | null | undefined
  placeholder: string
  onSave: (v: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setSaving(true); setErr(null)
    try {
      await onSave(draft)
      setEditing(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    }
    setSaving(false)
  }

  const fieldStyle: React.CSSProperties = { padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }
  const inputStyle: React.CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 5, padding: '5px 10px', color: 'var(--fg-1)', fontSize: 13, outline: 'none', minWidth: 200 }

  return (
    <div style={fieldStyle}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', flexShrink: 0 }}>{label}</div>
      {editing ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            placeholder={placeholder}
            style={inputStyle}
          />
          <Button kind="primary" size="sm" onClick={save}>{saving ? 'Saving…' : 'Save'}</Button>
          <Button kind="ghost" size="sm" onClick={() => { setEditing(false); setDraft(value ?? '') }}>Cancel</Button>
          {err && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{err}</span>}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: value ? 'var(--fg-1)' : 'var(--fg-4)' }}>
            {value || <span style={{ fontStyle: 'italic' }}>Not set</span>}
          </span>
          <Button kind="ghost" size="sm" icon="pencil-line" onClick={() => { setDraft(value ?? ''); setEditing(true) }}>Edit</Button>
        </div>
      )}
    </div>
  )
}

function AccountPanel({ email, initialProfile }: { email: string | null; initialProfile: { name?: string | null; location?: string | null } | null }) {
  const [pending, startTransition] = useTransition()
  const [profile, setProfile] = useState({ name: initialProfile?.name ?? null, location: initialProfile?.location ?? null })

  async function saveField(field: 'name' | 'location', value: string) {
    const res = await fetch('/api/context/athlete_profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value || null }),
    })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      throw new Error(b.error ?? `Save failed (HTTP ${res.status})`)
    }
    setProfile((p) => ({ ...p, [field]: value || null }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Account details</h2>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>Your identity and login information.</div>
        </div>

        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>Email</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>{email ?? '—'}</span>
            <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', background: 'var(--bg-3)', border: '1px solid var(--border-subtle)', padding: '1px 6px', borderRadius: 3 }}>read only</span>
          </div>
        </div>

        <InlineEditField
          label="Name"
          value={profile.name}
          placeholder="Your name"
          onSave={(v) => saveField('name', v)}
        />

        <InlineEditField
          label="Location"
          value={profile.location}
          placeholder="City, Country"
          onSave={(v) => saveField('location', v)}
        />
      </div>

      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Danger zone</h2>
        </div>

        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--fg-1)' }}>Sign out</div>
            <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 2 }}>You will be redirected to the login page.</div>
          </div>
          <Button
            kind="ghost"
            size="sm"
            icon="log-out"
            onClick={() => startTransition(() => { signoutAction() })}
          >
            {pending ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>

        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.4, pointerEvents: 'none' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--fg-1)' }}>Delete account</div>
            <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 2 }}>Permanently remove your account and all data.</div>
          </div>
          <Button kind="ghost" size="sm" icon="trash-2">Delete account</Button>
        </div>
      </div>
    </div>
  )
}

// ── Connections panel ─────────────────────────────────────────────────────────

function ConnectionsPanel({ intervals }: { intervals?: IntervalsConnectionState }) {
  const comingSoon = [
    { label: 'TrainingPeaks', icon: 'activity' },
    { label: 'Strava',        icon: 'zap' },
    { label: 'Garmin Direct', icon: 'watch' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <IntervalsConnectionPanel initial={intervals} />

      {/* Coming soon section */}
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>Coming soon</div>
        </div>
        {comingSoon.map((c, i) => (
          <div
            key={c.label}
            style={{
              padding: '14px 20px',
              borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              opacity: 0.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name={c.icon} size={14} color="var(--fg-3)" />
              <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>{c.label}</span>
            </div>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', background: 'var(--bg-3)', border: '1px solid var(--border-subtle)', padding: '2px 7px', borderRadius: 3 }}>
              Coming soon
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function IntervalsConnectionPanel({ initial }: { initial?: IntervalsConnectionState }) {
  const [state, setState] = useState({
    isConnected: initial?.isConnected ?? false,
    athleteId: initial?.athleteId ?? '',
    lastSyncedAt: initial?.lastSyncedAt ?? null,
    isInvalid: initial?.isInvalid ?? false,
  })
  const [apiKey, setApiKey] = useState('')
  const [athleteIdInput, setAthleteIdInput] = useState(initial?.athleteId ?? '')
  const [showForm, setShowForm] = useState(!initial?.isConnected)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSave() {
    if (!apiKey.trim() || !athleteIdInput.trim()) return
    setSaving(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/intervals/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, athlete_id: athleteIdInput }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Failed to connect')
        return
      }
      setState({ isConnected: true, athleteId: athleteIdInput, lastSyncedAt: data.synced_at, isInvalid: false })
      setApiKey('')
      setShowForm(false)
    } catch {
      setErrorMsg('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/intervals/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Sync failed')
        return
      }
      if (!data.success) {
        setErrorMsg(`Sync failed: ${data.errors?.join(', ') ?? 'unknown error'}`)
        return
      }
      setState((s) => ({ ...s, lastSyncedAt: data.synced_at }))
    } catch {
      setErrorMsg('Network error — please try again')
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    await fetch('/api/intervals/connect', { method: 'DELETE' })
    setState({ isConnected: false, athleteId: '', lastSyncedAt: null, isInvalid: false })
    setAthleteIdInput('')
    setShowForm(true)
  }

  function formatSyncTime(ts: string | null) {
    if (!ts) return 'Never'
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return d.toLocaleDateString()
  }

  return (
    <div style={{ background: 'var(--bg-2)', border: `1px solid ${state.isInvalid ? 'var(--danger)' : 'var(--border-default)'}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>intervals.icu</h2>
            {state.isConnected && !state.isInvalid && (
              <span style={{ fontSize: 11, color: 'var(--success)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: 'var(--success)' }} />
                Connected
              </span>
            )}
            {state.isInvalid && (
              <span style={{ fontSize: 11, color: 'var(--danger)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="alert-circle" size={11} />
                Invalid credentials
              </span>
            )}
            {!state.isConnected && !state.isInvalid && (
              <span style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>Not connected</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
            Wellness, activities, and training load sync automatically.
          </div>
        </div>
        {state.isConnected && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button kind="secondary" size="sm" icon="refresh-cw" onClick={handleSync}>
                {syncing ? 'Syncing…' : 'Sync now'}
              </Button>
              <Button kind="ghost" size="sm" onClick={() => setShowForm((v) => !v)}>
                {showForm ? 'Cancel' : 'Edit'}
              </Button>
            </div>
            {syncing && (
              <div style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
                Fetching activity details — may take 30–60s
              </div>
            )}
          </div>
        )}
      </div>

      {state.isConnected && !showForm && (
        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
              Athlete ID: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>{state.athleteId}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>
              Last synced: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>{formatSyncTime(state.lastSyncedAt)}</span>
            </div>
          </div>
          <Button kind="ghost" size="sm" icon="trash-2" onClick={handleDisconnect}>Disconnect</Button>
        </div>
      )}

      {showForm && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 6 }}>
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={state.isConnected ? '••••••••••••••••' : 'Paste your Intervals.icu API key'}
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '8px 10px', color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 6 }}>
              Athlete ID
            </label>
            <input
              type="text"
              value={athleteIdInput}
              onChange={(e) => setAthleteIdInput(e.target.value)}
              placeholder="e.g. i12345"
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '8px 10px', color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none' }}
            />
            <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 5 }}>Found in Settings → About on intervals.icu</div>
          </div>
          {errorMsg && (
            <div style={{ fontSize: 12, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="alert-circle" size={12} />
              {errorMsg}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button kind="primary" size="sm" onClick={handleSave}>
              {saving ? 'Connecting…' : state.isConnected ? 'Update' : 'Connect & sync'}
            </Button>
            {state.isConnected && (
              <Button kind="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── AI model — coming soon ────────────────────────────────────────────────────

function AIModelComingSoonPanel() {
  const previewModels = [
    { label: 'Claude Sonnet', sub: 'Recommended' },
    { label: 'Claude Opus',   sub: 'Premium' },
    { label: 'GPT-4o',        sub: 'Coming soon' },
  ]

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>AI model</h2>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', background: 'var(--bg-3)', border: '1px solid var(--border-subtle)', padding: '2px 7px', borderRadius: 3 }}>Coming soon</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>Hosted model subscription — coming soon.</div>
      </div>

      <div style={{ padding: '20px', opacity: 0.45, pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.6, marginBottom: 20, maxWidth: 440 }}>
          Choose a hosted AI model powered by Endurance OS — no key required. Available in a future subscription plan.
        </div>
        {previewModels.map((m, i) => (
          <div
            key={m.label}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 0',
              borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
            }}
          >
            <div style={{ width: 16, height: 16, borderRadius: 999, border: `1.5px solid ${i === 0 ? 'var(--accent)' : 'var(--border-strong)'}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {i === 0 && <div style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent)' }} />}
            </div>
            <div>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>{m.label}</span>
              <span style={{ fontSize: 11, color: 'var(--fg-4)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>— {m.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-1)' }}>
        <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
          Connect your own API key in{' '}
          <span
            style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
          >
            Settings → API keys
          </span>
          {' '}to power the Coach today.
        </div>
      </div>
    </div>
  )
}

// ── API keys panel ────────────────────────────────────────────────────────────

function APIKeysPanel({ initial }: { initial?: AnthropicKeyState }) {
  const [keyState, setKeyState] = useState<AnthropicKeyState>(
    initial ?? { connected: false, last4: null }
  )
  const [keyInput, setKeyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<'valid' | 'invalid' | null>(null)

  useEffect(() => {
    if (!initial) {
      fetch('/api/keys/anthropic')
        .then((r) => r.json())
        .then((d) => setKeyState({ connected: d.connected, last4: d.last4 }))
        .catch(() => {})
    }
  }, [initial])

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    setError(null)
    try {
      const res = await fetch('/api/keys/anthropic?verify=true')
      const data = await res.json() as { connected: boolean; valid?: boolean; error?: string }
      if (data.valid === false) {
        setTestResult('invalid')
        setError(data.error ?? 'Key is invalid or expired')
      } else {
        setTestResult('valid')
      }
    } catch {
      setTestResult('invalid')
      setError('Could not reach Anthropic API')
    } finally {
      setTesting(false)
    }
  }

  async function handleConnect() {
    if (!keyInput.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/keys/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyInput.trim() }),
      })
      const data = await res.json() as { success: boolean; error?: string; last4?: string }
      if (!data.success) {
        setError(data.error ?? 'Failed to connect key')
        return
      }
      setKeyState({ connected: true, last4: data.last4 ?? null })
      setKeyInput('')
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    setError(null)
    try {
      await fetch('/api/keys/anthropic', { method: 'DELETE' })
      setKeyState({ connected: false, last4: null })
    } catch {
      setError('Network error — please try again')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>API keys</h2>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>Bring your own API key to power the AI Coach.</div>
      </div>

      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkles" size={11} color="var(--ai)" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>Anthropic</span>
          {keyState.connected && (
            <span style={{ fontSize: 11, color: 'var(--success)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: 'var(--success)' }} />
              Connected · sk-ant-••••{keyState.last4}
            </span>
          )}
        </div>

        <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.55, marginBottom: 14, maxWidth: 480 }}>
          Your API key is stored securely and never shared. All AI conversations are billed directly to your Anthropic account.
        </div>

        {keyState.connected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button kind="ghost" size="sm" icon="zap" onClick={handleTest}>
                {testing ? 'Testing…' : 'Test connection'}
              </Button>
              <Button kind="ghost" size="sm" icon="trash-2" onClick={handleRemove}>
                {removing ? 'Removing…' : 'Remove key'}
              </Button>
            </div>
            {testResult === 'valid' && (
              <div style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="check-circle" size={12} />
                Key is valid and working
              </div>
            )}
            {testResult === 'invalid' && error && (
              <div style={{ fontSize: 12, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="alert-circle" size={12} />
                {error}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConnect() }}
              placeholder="sk-ant-…"
              style={{ background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '8px 10px', color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none' }}
            />
            {error && (
              <div style={{ fontSize: 12, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="alert-circle" size={12} />
                {error}
              </div>
            )}
            <div>
              <Button kind="primary" size="sm" onClick={handleConnect}>
                {saving ? 'Verifying…' : 'Connect'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>OpenAI</div>
          <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 2 }}>Optional — for future model switching</div>
        </div>
        <Button kind="ghost" size="sm">Connect</Button>
      </div>
    </div>
  )
}

// ── Appearance panel ──────────────────────────────────────────────────────────

type Density = 'comfortable' | 'compact'

function AppearancePanel() {
  const [density, setDensity] = useState<Density>('comfortable')
  const [showSync, setShowSync] = useState(true)

  useEffect(() => {
    const d = localStorage.getItem('eos_density')
    if (d === 'comfortable' || d === 'compact') setDensity(d)
    setShowSync(localStorage.getItem('eos_show_sync_indicator') !== 'false')
  }, [])

  function handleDensity(v: Density) {
    setDensity(v)
    localStorage.setItem('eos_density', v)
  }

  function handleShowSync(v: boolean) {
    setShowSync(v)
    localStorage.setItem('eos_show_sync_indicator', String(v))
  }

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Appearance</h2>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>Display preferences saved locally to this browser.</div>
      </div>

      {/* Theme */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 3 }}>Theme</div>
          <div style={{ fontSize: 13, color: 'var(--fg-1)' }}>Graphite · Dark</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>More themes coming soon</span>
          <div style={{ opacity: 0.4, pointerEvents: 'none' }}>
            <ToggleDot on={true} />
          </div>
        </div>
      </div>

      {/* Density */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>Density</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['comfortable', 'compact'] as Density[]).map((v) => (
            <button
              key={v}
              onClick={() => handleDensity(v)}
              style={{
                padding: '4px 12px', fontSize: 12, fontFamily: 'inherit',
                background: density === v ? 'var(--bg-4)' : 'var(--bg-1)',
                border: '1px solid var(--border-default)',
                borderRadius: 4,
                color: density === v ? 'var(--fg-1)' : 'var(--fg-3)',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Sync indicator */}
      <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 3 }}>Show sync indicator</div>
          <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>Shows &ldquo;Synced from Intervals.icu · Xm ago&rdquo; on the dashboard</div>
        </div>
        <div onClick={() => handleShowSync(!showSync)} style={{ cursor: 'pointer' }}>
          <ToggleDot on={showSync} />
        </div>
      </div>
    </div>
  )
}

// ── Shared ────────────────────────────────────────────────────────────────────

function ToggleDot({ on }: { on: boolean }) {
  return (
    <div style={{ display: 'inline-block', width: 26, height: 14, borderRadius: 999, background: on ? 'var(--accent)' : 'var(--bg-3)', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-default)'}`, position: 'relative' }}>
      <div style={{ position: 'absolute', top: 1, left: on ? 13 : 1, width: 10, height: 10, borderRadius: 999, background: on ? 'var(--accent-fg)' : 'var(--fg-3)', transition: 'left var(--dur-micro) var(--ease-out)' }} />
    </div>
  )
}
