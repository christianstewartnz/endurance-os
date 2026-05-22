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
}

interface SettingsViewProps {
  intervalsConnection?: IntervalsConnectionState
  anthropicKeyState?: AnthropicKeyState
  userEmail?: string | null
}

export default function SettingsView({ intervalsConnection, anthropicKeyState, userEmail }: SettingsViewProps) {
  const [section, setSection] = useState('ai')
  const sections = [
    { id: 'account',     label: 'Account',          icon: 'user' },
    { id: 'connections', label: 'Connections',       icon: 'plug' },
    { id: 'ai',          label: 'AI model',          icon: 'cpu' },
    { id: 'coach',       label: 'Coach style',       icon: 'message-square' },
    { id: 'rules',       label: 'Adaptation rules',  icon: 'sliders-horizontal' },
    { id: 'keys',        label: 'API keys',          icon: 'key' },
    { id: 'appearance',  label: 'Appearance',        icon: 'palette' },
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
          {section === 'ai'          && <AIModelPanel />}
          {section === 'keys'        && <APIKeysPanel initial={anthropicKeyState} />}
          {section === 'coach'       && <CoachStylePanel />}
          {section === 'rules'       && <RulesPanel />}
          {section === 'account'     && <AccountPanel email={userEmail ?? null} />}
          {section === 'connections' && <ConnectionsPanel intervals={intervalsConnection} />}
          {section === 'appearance'  && <SimplePanel title="Appearance" items={[['Theme','Graphite (dark)'],['Density','Comfortable'],['Accent','Electric lime'],['Font','Geist · default']]} />}
        </div>
      </div>
    </div>
  )
}

// ── Account panel ────────────────────────────────────────────────────────────

function AccountPanel({ email }: { email: string | null }) {
  const [pending, startTransition] = useTransition()

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Account</h2>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>Your Endurance OS login details.</div>
      </div>

      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>Email</div>
        <div style={{ fontSize: 13, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>{email ?? '—'}</div>
      </div>

      <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
    </div>
  )
}

// ── Connections panel ────────────────────────────────────────────────────────

function ConnectionsPanel({ intervals }: { intervals?: IntervalsConnectionState }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <IntervalsConnectionPanel initial={intervals} />
      <SimpleConnectionRow label="Garmin Connect" status="Connected · 2m ago" />
      <SimpleConnectionRow label="TrainingPeaks" status="Not connected" />
      <SimpleConnectionRow label="Strava" status="Connected · 14m ago" />
      <SimpleConnectionRow label="Apple Health" status="Connected" />
    </div>
  )
}

function SimpleConnectionRow({ label, status }: { label: string; status: string }) {
  const connected = !status.startsWith('Not')
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: connected ? 'var(--success)' : 'var(--fg-3)' }}>
          {connected && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: 'var(--success)', marginRight: 6, verticalAlign: 'middle' }} />}
          {status}
        </span>
        <Button kind="ghost" size="sm">{connected ? 'Disconnect' : 'Connect'}</Button>
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
      {/* Header */}
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
          <div style={{ display: 'flex', gap: 8 }}>
            <Button kind="secondary" size="sm" icon="refresh-cw" onClick={handleSync}>
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
            <Button kind="ghost" size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cancel' : 'Edit'}
            </Button>
          </div>
        )}
      </div>

      {/* Connected status row */}
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

      {/* Form */}
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
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-1)', border: '1px solid var(--border-default)',
                borderRadius: 6, padding: '8px 10px', color: 'var(--fg-1)',
                fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none',
              }}
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
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-1)', border: '1px solid var(--border-default)',
                borderRadius: 6, padding: '8px 10px', color: 'var(--fg-1)',
                fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none',
              }}
            />
            <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 5 }}>
              Found in Settings → About on intervals.icu
            </div>
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

// ── Existing panels (unchanged) ──────────────────────────────────────────────

function AIModelPanel() {
  const models = [
    { id: 'sonnet', vendor: 'Anthropic', name: 'Claude Sonnet 4.5', desc: 'Default. Deep training reasoning, long context.',                    tag: 'Recommended', active: true },
    { id: 'opus',   vendor: 'Anthropic', name: 'Claude Opus 4.5',   desc: 'Highest-fidelity reasoning. Slow. Use for hard adaptations.',        tag: 'Premium',     active: false },
    { id: 'gpt',    vendor: 'OpenAI',    name: 'GPT-5',             desc: 'Fast, broad. Bring your own key.',                                   tag: 'BYOK',        active: false },
    { id: 'local',  vendor: 'Local',     name: 'Ollama · llama-3.3',desc: 'On-device. Works offline. Lower training-context depth.',            tag: 'Local',       active: false },
    { id: 'custom', vendor: 'Custom',    name: 'Custom endpoint',   desc: 'OpenAI-compatible URL + auth. For self-hosted models.',              tag: 'Custom',      active: false },
  ]
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>AI model</h2>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>The Coach is model-agnostic. Use ours, bring your own, or self-host.</div>
      </div>
      <div>
        {models.map((m, i) => (
          <div key={m.id} style={{ padding: '14px 20px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 16, height: 16, borderRadius: 999, border: `1.5px solid ${m.active ? 'var(--accent)' : 'var(--border-strong)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {m.active && <div style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent)' }} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>{m.name}</span>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>· {m.vendor}</span>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: m.active ? 'var(--accent)' : 'var(--fg-3)', background: m.active ? 'var(--accent-soft)' : 'var(--bg-3)', padding: '1px 6px', borderRadius: 3 }}>{m.tag}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{m.desc}</div>
            </div>
            <Button kind="ghost" size="sm">{m.active ? 'Configure' : 'Use'}</Button>
          </div>
        ))}
      </div>
    </div>
  )
}

function APIKeysPanel({ initial }: { initial?: AnthropicKeyState }) {
  const [keyState, setKeyState] = useState<AnthropicKeyState>(
    initial ?? { connected: false, last4: null }
  )
  const [keyInput, setKeyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!initial) {
      fetch('/api/keys/anthropic')
        .then((r) => r.json())
        .then((d) => setKeyState({ connected: d.connected, last4: d.last4 }))
        .catch(() => {})
    }
  }, [initial])

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

      {/* Anthropic section */}
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
          <Button kind="ghost" size="sm" icon="trash-2" onClick={handleRemove}>
            {removing ? 'Removing…' : 'Remove key'}
          </Button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConnect() }}
              placeholder="sk-ant-…"
              style={{
                background: 'var(--bg-1)', border: '1px solid var(--border-default)',
                borderRadius: 6, padding: '8px 10px', color: 'var(--fg-1)',
                fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none',
              }}
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

      {/* Remaining placeholder rows */}
      {[{ provider: 'OpenAI', note: 'Optional — for future model switching' }].map((k) => (
        <div key={k.provider} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>{k.provider}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 2 }}>{k.note}</div>
          </div>
          <Button kind="ghost" size="sm">Connect</Button>
        </div>
      ))}
    </div>
  )
}

function CoachStylePanel() {
  const rows: [string, string[], number][] = [
    ['Tone',         ['Direct', 'Friendly', 'Mentor', 'Pro coach'], 0],
    ['Length',       ['Short', 'Standard', 'Verbose'],              0],
    ['Praise',       ['None', 'Minimal', 'Encouraging'],            1],
    ['Challenge me', ['Never', 'When data conflicts', 'Always'],    1],
  ]
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Coach style</h2>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>How the Coach talks to you. Edited fields apply to every future conversation.</div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {rows.map(([k, opts, defaultIdx], i) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '12px 0', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'center' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>{k}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {opts.map((o, oi) => (
                <button key={o} style={{ padding: '4px 10px', fontSize: 12, fontFamily: 'inherit', background: oi === defaultIdx ? 'var(--bg-4)' : 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 4, color: oi === defaultIdx ? 'var(--fg-1)' : 'var(--fg-3)', cursor: 'pointer' }}>{o}</button>
              ))}
            </div>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 8 }}>System prompt (advanced)</div>
          <textarea
            defaultValue={`You are a head endurance coach. Talk like a former pro: precise, grounded, brief. Never use motivational language. State the recommendation, then briefly why. When data conflicts with the athlete's plan, surface it.`}
            rows={4}
            style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: 10, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.5, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
      </div>
    </div>
  )
}

function RulesPanel() {
  const rules = [
    { name: 'HRV-driven swap',  when: 'HRV < −7% for 2d',       then: 'Propose Z2 swap',                mode: 'Auto-propose', enabled: true  },
    { name: 'Sleep guard',      when: 'Sleep < 6h',               then: 'Downshift today\'s intensity',   mode: 'Auto-propose', enabled: true  },
    { name: 'Travel cap',       when: 'Flight > 2h',              then: 'Cap intensity 24h post-flight',  mode: 'Auto-apply',   enabled: true  },
    { name: 'Race week',        when: 'T-7 days to A-race',       then: 'No Z4+ work · openers Thu',     mode: 'Auto-apply',   enabled: true  },
    { name: 'Injury pause',     when: 'Pain reported',            then: 'Pause 48h · resume Z1',         mode: 'Manual',       enabled: true  },
    { name: 'Sauna post-VO2',   when: 'VO2 logged today',         then: 'Skip sauna recommendation',     mode: 'Auto-propose', enabled: false },
  ]
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Adaptation rules</h2>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>Conditions the Coach uses to propose or apply changes to your plan.</div>
        </div>
        <Button kind="secondary" size="sm" icon="plus">New rule</Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 110px 60px', background: 'var(--bg-1)', padding: '8px 20px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--border-subtle)' }}>
        <span>Rule</span><span>When</span><span>Then</span><span>Mode</span><span style={{ textAlign: 'right' }}>On</span>
      </div>
      {rules.map((r, i) => (
        <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 110px 60px', padding: '12px 20px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'center', fontSize: 12, opacity: r.enabled ? 1 : 0.5 }}>
          <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{r.name}</span>
          <span style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>{r.when}</span>
          <span style={{ color: 'var(--fg-2)' }}>{r.then}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: r.mode === 'Auto-apply' ? 'var(--ai)' : 'var(--fg-3)' }}>{r.mode}</span>
          <span style={{ textAlign: 'right' }}><ToggleDot on={r.enabled} /></span>
        </div>
      ))}
    </div>
  )
}

function ToggleDot({ on }: { on: boolean }) {
  return (
    <div style={{ display: 'inline-block', width: 26, height: 14, borderRadius: 999, background: on ? 'var(--accent)' : 'var(--bg-3)', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-default)'}`, position: 'relative', cursor: 'pointer' }}>
      <div style={{ position: 'absolute', top: 1, left: on ? 13 : 1, width: 10, height: 10, borderRadius: 999, background: on ? 'var(--accent-fg)' : 'var(--fg-3)', transition: 'left var(--dur-micro) var(--ease-out)' }} />
    </div>
  )
}

function SimplePanel({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>{title}</h2>
      </div>
      {items.map(([k, v], i) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
          <div style={{ fontSize: 13, color: 'var(--fg-1)' }}>{k}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>{v}</div>
            <Icon name="chevron-right" size={14} color="var(--fg-4)" />
          </div>
        </div>
      ))}
    </div>
  )
}
