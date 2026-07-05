'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon, Button, Pill } from '@/components/atoms'

// ── Types ────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>

interface ContextSuggestion {
  id: string
  target_module: string
  target_field: string | null
  action_type: string
  suggested_value: string
  reasoning: string
  evidence: string | null
  created_at: string
}

interface ContextViewProps {
  athleteProfile: Row | null
  coachStyle: Row | null
  planDna: Row | null
  trainingPatterns: Row[]
  adaptationRules: Row[]
  raceGoals: Row[]
  fuelingStrategy: Row | null
  healthInjury: Row | null
  illnesses: Row[]
  injuries: Row[]
  recoveryPreferences: Row | null
  pendingSuggestions: ContextSuggestion[]
}

interface IllnessForm {
  id: string; name: string; description: string; dateStart: string
  restrictions: string; canCycle: boolean; canRun: boolean; canSwim: boolean
  notes: string; date_cleared?: string | null; date_added?: string
}

interface InjuryForm {
  id: string; bodyPart: string; description: string; dateStart: string
  restrictions: string; canCycle: boolean; canRun: boolean; canSwim: boolean
  physioNotes: string; date_cleared?: string | null; date_added?: string
}

interface HealthFormState {
  illnessForms: IllnessForm[]
  injuryForms: InjuryForm[]
  monitoringFlags: string[]
  allergies: string
  medications: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: unknown): string {
  if (v == null || v === '') return '—'
  if (Array.isArray(v)) {
    if (v.length === 0) return '—'
    if (typeof v[0] === 'object') return JSON.stringify(v, null, 2)
    return v.join(', ')
  }
  if (typeof v === 'object') return JSON.stringify(v, null, 2)
  return String(v)
}

function fmtSleepHours(v: unknown): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (isNaN(n)) return String(v)
  const h = Math.floor(n)
  const m = Math.round((n - h) * 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function fmtRestDays(v: unknown): string {
  if (!Array.isArray(v) || v.length === 0) return '—'
  return (v as string[]).map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(' · ')
}

function fmtHrvTime(v: unknown): string {
  const map: Record<string, string> = { upon_wake: 'Upon wake', morning: 'Morning', night: 'Night' }
  return map[String(v ?? '')] ?? fmt(v)
}

function fmtRelativeDate(ts: string | null | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fieldValueFromData(data: Row | null, key: string): string {
  const v = data?.[key]
  if (v == null || v === '') return ''
  if (Array.isArray(v)) {
    if (v.length === 0) return ''
    if (typeof v[0] === 'object') return JSON.stringify(v, null, 2)
    return v.join(', ')
  }
  if (typeof v === 'object') return JSON.stringify(v, null, 2)
  return String(v)
}

function confidenceColor(c: string): string {
  if (c === 'high') return 'var(--success)'
  if (c === 'medium') return '#E8C547'
  return 'var(--fg-3)'
}

function confidenceBg(c: string): string {
  if (c === 'high') return 'rgba(72,187,120,0.12)'
  if (c === 'medium') return 'rgba(232,197,71,0.12)'
  return 'var(--bg-3)'
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function ContextView({
  athleteProfile, coachStyle, planDna, trainingPatterns, adaptationRules,
  raceGoals, fuelingStrategy, healthInjury, illnesses, injuries, recoveryPreferences,
  pendingSuggestions: initialSuggestions,
}: ContextViewProps) {
  const router = useRouter()
  const [activeId, setActiveId] = useState('plan-dna')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<Record<string, string>>({})
  const [healthForm, setHealthForm] = useState<HealthFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<ContextSuggestion[]>(initialSuggestions)
  const [editingSuggId, setEditingSuggId] = useState<string | null>(null)
  const [suggEditVal, setSuggEditVal] = useState('')

  const modules = [
    { id: 'athlete',     title: 'Athlete Profile',      icon: 'user',               tag: '@athlete',    data: athleteProfile,      editable: true  },
    { id: 'coach-style', title: 'Coach Style',           icon: 'message-square',     tag: '@coachstyle', data: coachStyle,          editable: false },
    { id: 'plan-dna',    title: 'Plan DNA',              icon: 'git-fork',           tag: '@plandna',    data: planDna,             editable: true  },
    { id: 'patterns',    title: 'Training Patterns',     icon: 'activity',           tag: '@patterns',   data: null,                editable: false },
    { id: 'rules',       title: 'Adaptation Rules',      icon: 'sliders-horizontal', tag: '@rules',      data: null,                editable: false },
    { id: 'goals',       title: 'Race Goals',            icon: 'flag',               tag: '@goals',      data: null,                editable: false },
    { id: 'fueling',     title: 'Fueling Strategy',      icon: 'droplets',           tag: '@fueling',    data: fuelingStrategy,     editable: true  },
    { id: 'health',      title: 'Health & Injury',       icon: 'heart',              tag: '@health',     data: healthInjury,        editable: true  },
    { id: 'recovery',    title: 'Recovery Preferences',  icon: 'bed',                tag: '@recovery',   data: recoveryPreferences, editable: true  },
  ]

  const active = modules.find((m) => m.id === activeId) ?? modules[0]

  const pendingCount = (id: string) => {
    const modMap: Record<string, string> = {
      'plan-dna': 'plan_dna', 'patterns': 'training_patterns', 'rules': 'adaptation_rules',
      'goals': 'race_goals', 'fueling': 'fueling_strategy', 'recovery': 'recovery_preferences',
    }
    if (id === 'health') return suggestions.filter((s) => s.target_module === 'illnesses' || s.target_module === 'injuries').length
    return suggestions.filter((s) => s.target_module === modMap[id]).length
  }

  async function handleMarkIllnessRecovered(illnessId: string) {
    const today = new Date().toISOString().split('T')[0]
    await fetch(`/api/context/illnesses/${illnessId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date_cleared: today }) })
    router.refresh()
  }

  async function handleMarkInjuryResolved(injuryId: string) {
    const today = new Date().toISOString().split('T')[0]
    await fetch(`/api/context/injuries/${injuryId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date_cleared: today }) })
    router.refresh()
  }

  async function handleSave() {
    if (!active.editable) return
    setSaving(true); setSaveError(null)
    const moduleMap: Record<string, string> = {
      'athlete': 'athlete_profile', 'plan-dna': 'plan_dna',
      'fueling': 'fueling_strategy', 'health': 'health_injury', 'recovery': 'recovery_preferences',
    }
    const apiModule = moduleMap[active.id]
    if (!apiModule) { setSaving(false); return }
    try {
      if (active.id === 'health' && healthForm) {
        const today = new Date().toISOString().split('T')[0]
        const existingIllnessIds = new Set(illnesses.map((il) => String(il.id)))
        const existingInjuryIds = new Set(injuries.map((inj) => String(inj.id)))

        await Promise.all([
          ...healthForm.illnessForms.map((f) => {
            const payload = { name: f.name, description: f.description, date_start: f.dateStart, restrictions: f.restrictions.split('\n').filter(Boolean), can_cycle: f.canCycle, can_run: f.canRun, can_swim: f.canSwim, notes: f.notes, date_cleared: f.date_cleared ?? null }
            if (existingIllnessIds.has(f.id)) {
              return fetch(`/api/context/illnesses/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            }
            return fetch('/api/context/illnesses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, date_start: f.dateStart || today }) })
          }),
          ...healthForm.injuryForms.map((f) => {
            const payload = { body_part: f.bodyPart, description: f.description, date_start: f.dateStart, restrictions: f.restrictions.split('\n').filter(Boolean), can_cycle: f.canCycle, can_run: f.canRun, can_swim: f.canSwim, physio_notes: f.physioNotes, date_cleared: f.date_cleared ?? null }
            if (existingInjuryIds.has(f.id)) {
              return fetch(`/api/context/injuries/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            }
            return fetch('/api/context/injuries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, date_start: f.dateStart || today }) })
          }),
          fetch('/api/context/health_injury', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monitoring_flags: healthForm.monitoringFlags, allergies: healthForm.allergies, medications: healthForm.medications }) }),
        ])
        router.refresh(); setEditingId(null); setEditFields({}); setHealthForm(null)
        setSaving(false); return
      }
      const body = editFields
      const res = await fetch(`/api/context/${apiModule}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) { router.refresh(); setEditingId(null); setEditFields({}); setHealthForm(null) }
      else { const b = await res.json().catch(() => ({})); setSaveError(b.error ?? `Save failed (HTTP ${res.status})`) }
    } catch (e) { setSaveError(e instanceof Error ? e.message : 'Network error') }
    setSaving(false)
  }

  function startEdit() {
    if (active.id === 'health') {
      const d = active.data
      const activeIllnesses = illnesses.filter((il) => !il.date_cleared)
      const activeInjuries = injuries.filter((inj) => !inj.date_cleared)
      const flags = Array.isArray(d?.monitoring_flags) ? (d.monitoring_flags as string[]) : []
      setHealthForm({
        illnessForms: activeIllnesses.map((il) => ({ id: String(il.id ?? crypto.randomUUID()), name: String(il.name ?? ''), description: String(il.description ?? ''), dateStart: String(il.date_start ?? ''), restrictions: Array.isArray(il.restrictions) ? (il.restrictions as string[]).join('\n') : '', canCycle: typeof il.can_cycle === 'boolean' ? il.can_cycle : true, canRun: typeof il.can_run === 'boolean' ? il.can_run : false, canSwim: typeof il.can_swim === 'boolean' ? il.can_swim : true, notes: String(il.notes ?? ''), date_cleared: (il.date_cleared as string | null | undefined) ?? null })),
        injuryForms: activeInjuries.map((inj) => ({ id: String(inj.id ?? crypto.randomUUID()), bodyPart: String(inj.body_part ?? ''), description: String(inj.description ?? ''), dateStart: String(inj.date_start ?? ''), restrictions: Array.isArray(inj.restrictions) ? (inj.restrictions as string[]).join('\n') : '', canCycle: typeof inj.can_cycle === 'boolean' ? inj.can_cycle : true, canRun: typeof inj.can_run === 'boolean' ? inj.can_run : false, canSwim: typeof inj.can_swim === 'boolean' ? inj.can_swim : true, physioNotes: String(inj.physio_notes ?? ''), date_cleared: (inj.date_cleared as string | null | undefined) ?? null })),
        monitoringFlags: flags, allergies: d?.allergies ? String(d.allergies) : '', medications: d?.medications ? String(d.medications) : '',
      })
      setEditingId(active.id); return
    }
    if (active.id === 'athlete') {
      const d = active.data
      setEditFields({
        name: fieldValueFromData(d, 'name'),
        location: fieldValueFromData(d, 'location'),
        sports: fieldValueFromData(d, 'sports'),
        experience_years: fieldValueFromData(d, 'experience_years'),
        coaching_history: fieldValueFromData(d, 'coaching_history'),
        strengths: fieldValueFromData(d, 'strengths'),
        weaknesses: fieldValueFromData(d, 'weaknesses'),
        ftp_override: fieldValueFromData(d, 'ftp_override'),
        threshold_pace_override: fieldValueFromData(d, 'threshold_pace_override'),
        css_override: fieldValueFromData(d, 'css_override'),
      })
      setEditingId(active.id); return
    }
    let keys: string[]
    if (active.id === 'fueling') {
      keys = ['training_carb_per_hour_g', 'bars_allowed_until_mins', 'caffeine_strategy', 'pre_race_meal', 'pre_race_timing_hours', 'gi_notes', 'heat_threshold_celsius']
    } else if (active.id === 'recovery') {
      keys = ['sleep_target_hours', 'preferred_rest_days', 'hrv_measurement_time', 'hrv_device', 'deload_frequency_weeks', 'deload_load_percent', 'recovery_modalities']
    } else {
      keys = planDnaFieldDefs().map((d) => d.key)
    }
    const init: Record<string, string> = {}
    for (const key of keys) init[key] = fieldValueFromData(active.data, key)
    setEditFields(init)
    setEditingId(active.id)
  }

  async function handleSuggestion(id: string, action: 'accept' | 'reject' | 'edit', editedValue?: string) {
    const res = await fetch(`/api/context/suggestions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, editedValue }) })
    if (res.ok) { setSuggestions((prev) => prev.filter((s) => s.id !== id)); setEditingSuggId(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>Context</div>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>The Coach&apos;s brain</h1>
        <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 6, maxWidth: 620 }}>Every module here is editable. The Coach reads from these when it plans, suggests, or reasons about your training.</div>
      </div>

      {suggestions.length > 0 && (
        <MemorySuggestions suggestions={suggestions} editingSuggId={editingSuggId} suggEditVal={suggEditVal}
          onEditStart={(s) => { setEditingSuggId(s.id); setSuggEditVal(s.suggested_value) }}
          onEditChange={setSuggEditVal} onAction={handleSuggestion} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Nav */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 6 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)', padding: '10px 10px 6px', fontFamily: 'var(--font-mono)' }}>Intelligence modules</div>
          {modules.map((m) => {
            const pc = pendingCount(m.id)
            return (
              <div key={m.id} onClick={() => setActiveId(m.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', background: activeId === m.id ? 'var(--bg-3)' : 'transparent', boxShadow: activeId === m.id ? 'inset 2px 0 0 var(--accent)' : 'none' }}
                onMouseEnter={(e) => { if (activeId !== m.id) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-1)' }}
                onMouseLeave={(e) => { if (activeId !== m.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <Icon name={m.icon} size={14} color={activeId === m.id ? 'var(--fg-1)' : 'var(--fg-3)'} />
                <span style={{ flex: 1, fontSize: 13, color: activeId === m.id ? 'var(--fg-1)' : 'var(--fg-2)', fontWeight: activeId === m.id ? 500 : 400 }}>{m.title}</span>
                {pc > 0 && <span style={{ width: 16, height: 16, borderRadius: 999, background: 'var(--ai-soft)', color: 'var(--ai)', fontSize: 10, fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{pc}</span>}
              </div>
            )
          })}
        </div>

        {/* Detail */}
        {activeId === 'coach-style' && <CoachStylePanel initialData={coachStyle} />}
        {activeId === 'patterns'    && <TrainingPatternsPanel initialPatterns={trainingPatterns} />}
        {activeId === 'rules'       && <AdaptationRulesPanel initialRules={adaptationRules} />}
        {!['coach-style', 'patterns', 'rules'].includes(activeId) && (
          <ModuleDetail
            module={active}
            editing={editingId === active.id}
            editFields={editFields}
            healthForm={healthForm}
            saving={saving}
            saveError={saveError}
            raceGoals={raceGoals}
            illnesses={illnesses}
            injuries={injuries}
            onEdit={startEdit}
            onFieldChange={(k, v) => setEditFields((prev) => ({ ...prev, [k]: v }))}
            onHealthFormChange={setHealthForm}
            onSave={handleSave}
            onClose={() => { setEditingId(null); setEditFields({}); setHealthForm(null); setSaveError(null) }}
            onRefresh={() => router.refresh()}
            onMarkIllnessRecovered={handleMarkIllnessRecovered}
            onMarkInjuryResolved={handleMarkInjuryResolved}
          />
        )}
      </div>
    </div>
  )
}

// ── Coach Style Panel ─────────────────────────────────────────────────────────

const TONE_OPTS    = [{ v: 'direct',   l: 'Direct' }, { v: 'friendly', l: 'Friendly' }, { v: 'mentor', l: 'Mentor-style' }, { v: 'pro', l: 'Pro coach' }]
const LENGTH_OPTS  = [{ v: 'short',    l: 'Short replies' }, { v: 'standard', l: 'Standard replies' }, { v: 'verbose', l: 'Detailed replies' }]
const PRAISE_OPTS  = [{ v: 'none',     l: 'No praise' }, { v: 'minimal', l: 'Minimal praise' }, { v: 'encouraging', l: 'Encouraging' }]
const CHALLENGE_OPTS = [{ v: 'never', l: 'Never challenges' }, { v: 'when_data_conflicts', l: 'When data conflicts' }, { v: 'always', l: 'Always challenges' }]

function CoachStylePanel({ initialData }: { initialData: Row | null }) {
  const [data, setData] = useState<Row>(initialData ?? {})
  const [savedFlash, setSavedFlash] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  const tone     = String(data.tone ?? 'direct')
  const length   = String(data.reply_length ?? 'standard')
  const praise   = String(data.praise_level ?? 'minimal')
  const challenge = String(data.challenge_mode ?? 'when_data_conflicts')

  async function select(field: string, value: string) {
    const newData = { ...data, [field]: value }
    setData(newData)
    setSaveErr(null)
    try {
      const res = await fetch('/api/context/coach_style', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newData) })
      if (res.ok) { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500) }
      else setSaveErr('Save failed')
    } catch { setSaveErr('Network error') }
  }

  const summaryParts = [
    TONE_OPTS.find((o) => o.v === tone)?.l ?? tone,
    LENGTH_OPTS.find((o) => o.v === length)?.l ?? length,
    PRAISE_OPTS.find((o) => o.v === praise)?.l ?? praise,
    CHALLENGE_OPTS.find((o) => o.v === challenge)?.l ?? challenge,
  ]

  const groups = [
    { label: 'Tone',        field: 'tone',            opts: TONE_OPTS,      val: tone },
    { label: 'Reply length',field: 'reply_length',    opts: LENGTH_OPTS,    val: length },
    { label: 'Praise',      field: 'praise_level',    opts: PRAISE_OPTS,    val: praise },
    { label: 'Challenge me',field: 'challenge_mode',  opts: CHALLENGE_OPTS, val: challenge },
  ]

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <PanelHeader title="Coach Style" icon="message-square" tag="@coachstyle" action={
        savedFlash ? <span style={{ fontSize: 11, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>Saved ✓</span>
          : saveErr ? <span style={{ fontSize: 11, color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>{saveErr}</span>
          : null
      } />
      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {groups.map((g, i) => (
          <div key={g.field} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, padding: '12px 0', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'center' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>{g.label}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {g.opts.map((o) => (
                <button key={o.v} onClick={() => select(g.field, o.v)}
                  style={{ padding: '4px 10px', fontSize: 12, fontFamily: 'inherit', background: g.val === o.v ? 'var(--accent)' : 'var(--bg-1)', border: `1px solid ${g.val === o.v ? 'var(--accent)' : 'var(--border-default)'}`, borderRadius: 4, color: g.val === o.v ? 'var(--accent-fg, #fff)' : 'var(--fg-3)', cursor: 'pointer' }}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ margin: '0 24px 20px', padding: '12px 14px', background: 'var(--bg-1)', border: '1px solid var(--border-subtle)', borderRadius: 6, fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5 }}>
        <span style={{ color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Your Coach will be</span>
        {summaryParts.join(' · ')}
      </div>
    </div>
  )
}

// ── Training Patterns Panel ───────────────────────────────────────────────────

function TrainingPatternsPanel({ initialPatterns }: { initialPatterns: Row[] }) {
  const [patterns, setPatterns] = useState<Row[]>(initialPatterns)

  async function handleArchive(id: string) {
    const res = await fetch(`/api/context/training-patterns/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'archive' }) })
    if (res.ok) setPatterns((prev) => prev.filter((p) => String(p.id) !== id))
  }

  async function handlePromote(id: string, currentConfidence: string) {
    const res = await fetch(`/api/context/training-patterns/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'promote' }) })
    if (res.ok) {
      const levels = ['low', 'medium', 'high']
      const next = levels[Math.min(levels.indexOf(currentConfidence) + 1, 2)]
      setPatterns((prev) => prev.map((p) => String(p.id) === id ? { ...p, confidence: next } : p))
    }
  }

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <PanelHeader title="Training Patterns" icon="activity" tag="@patterns" />
      {patterns.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Icon name="activity" size={32} color="var(--fg-4)" />
          <div style={{ fontSize: 13, color: 'var(--fg-3)', maxWidth: 320, margin: '12px auto 0', lineHeight: 1.55 }}>
            No patterns yet. The Coach detects patterns from your training conversations and suggests saving them here.
          </div>
        </div>
      ) : (
        <div>
          {patterns.map((p, i) => {
            const conf = String(p.confidence ?? 'low')
            const id = String(p.id ?? i)
            const isHigh = conf === 'high'
            return (
              <div key={id} style={{ padding: '16px 24px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', color: confidenceColor(conf), background: confidenceBg(conf), padding: '2px 7px', borderRadius: 3, flexShrink: 0, marginTop: 2 }}>{conf}</span>
                  {!!p.unconfirmed && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', background: 'var(--bg-3)', border: '1px solid var(--border-default)', padding: '2px 7px', borderRadius: 3, flexShrink: 0, marginTop: 2 }}>unconfirmed</span>}
                  <span style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>· {String(p.category ?? 'general')} · {String(p.sport ?? 'general')}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.55, marginBottom: 6 }}>{String(p.pattern_text ?? '')}</div>
                {!!p.evidence && <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 8, lineHeight: 1.4 }}>{String(p.evidence)}</div>}
                <div style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
                  {p.observation_count ? `Observed ${p.observation_count}× · ` : ''}
                  First seen {fmtRelativeDate(String(p.first_seen_at ?? p.created_at ?? ''))}
                  {p.last_seen_at ? ` · Last seen ${fmtRelativeDate(String(p.last_seen_at))}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button kind="ghost" size="sm" icon="archive" onClick={() => handleArchive(id)}>Archive</Button>
                  {!isHigh && <Button kind="ghost" size="sm" icon="arrow-up" onClick={() => handlePromote(id, conf)}>Promote</Button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Adaptation Rules Panel ────────────────────────────────────────────────────

interface AdaptRule {
  id: string
  name: string
  trigger_condition: string
  action: string
  apply_mode: string
  sport: string
  enabled: boolean
}

const APPLY_MODE_OPTS = [
  { v: 'auto_propose', l: 'Auto-propose' },
  { v: 'auto_apply',   l: 'Auto-apply' },
  { v: 'manual',       l: 'Manual' },
]
const SPORT_OPTS = [
  { v: 'all',      l: 'All' },
  { v: 'cycling',  l: 'Cycling' },
  { v: 'running',  l: 'Running' },
  { v: 'swimming', l: 'Swimming' },
]

function applyModeColor(m: string): string {
  if (m === 'auto_apply') return 'var(--ai)'
  if (m === 'auto_propose') return 'var(--fg-2)'
  return 'var(--fg-3)'
}

function rowToRule(r: Row): AdaptRule {
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    trigger_condition: String(r.trigger_condition ?? ''),
    action: String(r.action ?? ''),
    apply_mode: String(r.apply_mode ?? 'auto_propose'),
    sport: String(r.sport ?? 'all'),
    enabled: r.enabled !== false,
  }
}

const RULE_INPUT: React.CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '7px 10px', color: 'var(--fg-1)', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, outline: 'none', width: '100%', boxSizing: 'border-box' }

interface AdaptRuleFormProps {
  draft: Partial<AdaptRule>
  setDraft: React.Dispatch<React.SetStateAction<Partial<AdaptRule>>>
  err: string | null
  saving: boolean
  isNew: boolean
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
}

function AdaptRuleForm({ draft, setDraft, err, saving, isNew, onSave, onCancel, onDelete }: AdaptRuleFormProps) {
  return (
    <div style={{ padding: '16px 20px', background: 'var(--bg-1)', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 5 }}>Rule name</label>
          <input style={RULE_INPUT} value={draft.name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. HRV swap" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 5 }}>Sport</label>
          <select style={{ ...RULE_INPUT, WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }} value={draft.sport ?? 'all'} onChange={(e) => setDraft((d) => ({ ...d, sport: e.target.value }))}>
            {SPORT_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 5 }}>When</label>
        <textarea style={{ ...RULE_INPUT, minHeight: 56, resize: 'vertical' }} value={draft.trigger_condition ?? ''} onChange={(e) => setDraft((d) => ({ ...d, trigger_condition: e.target.value }))} placeholder="e.g. HRV < -7% for 2 consecutive days" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 5 }}>Then</label>
        <textarea style={{ ...RULE_INPUT, minHeight: 56, resize: 'vertical' }} value={draft.action ?? ''} onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))} placeholder="e.g. Propose Z2 swap for today's session" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 5 }}>Mode</label>
        <select style={{ ...RULE_INPUT, WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }} value={draft.apply_mode ?? 'auto_propose'} onChange={(e) => setDraft((d) => ({ ...d, apply_mode: e.target.value }))}>
          <option value="auto_propose">Auto-propose (AI suggests, you decide)</option>
          <option value="auto_apply">Auto-apply (AI applies automatically)</option>
          <option value="manual">Manual (reminder only)</option>
        </select>
      </div>
      {err && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button kind="primary" size="sm" onClick={onSave}>{saving ? 'Saving…' : 'Save'}</Button>
        <Button kind="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        {!isNew && <Button kind="ghost" size="sm" icon="trash-2" onClick={onDelete} style={{ marginLeft: 'auto', color: 'var(--danger)' }}>Delete</Button>}
      </div>
    </div>
  )
}

function AdaptationRulesPanel({ initialRules }: { initialRules: Row[] }) {
  const [rules, setRules] = useState<AdaptRule[]>(initialRules.map(rowToRule))
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<AdaptRule>>({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function openNew() {
    setDraft({ name: '', trigger_condition: '', action: '', apply_mode: 'auto_propose', sport: 'all', enabled: true })
    setExpandedId('__new__')
  }

  function openEdit(rule: AdaptRule) {
    if (expandedId === rule.id) { setExpandedId(null); return }
    setDraft({ ...rule })
    setExpandedId(rule.id)
    setErr(null)
  }

  async function handleToggle(id: string, current: boolean) {
    const res = await fetch(`/api/context/adaptation-rules/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !current }) })
    if (res.ok) setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !current } : r))
  }

  async function handleSave() {
    setSaving(true); setErr(null)
    try {
      if (expandedId === '__new__') {
        const res = await fetch('/api/context/adaptation-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) })
        if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error ?? 'Save failed'); return }
        const newRule = await res.json()
        setRules((prev) => [rowToRule(newRule as Row), ...prev])
      } else {
        const res = await fetch(`/api/context/adaptation-rules/${expandedId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) })
        if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error ?? 'Save failed'); return }
        const updated = await res.json()
        setRules((prev) => prev.map((r) => r.id === expandedId ? rowToRule(updated as Row) : r))
      }
      setExpandedId(null); setDraft({})
    } catch { setErr('Network error') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/context/adaptation-rules/${id}`, { method: 'DELETE' })
    if (res.ok) { setRules((prev) => prev.filter((r) => r.id !== id)); setExpandedId(null) }
  }

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <PanelHeader title="Adaptation Rules" icon="sliders-horizontal" tag="@rules" action={
        <Button kind="secondary" size="sm" icon="plus" onClick={openNew}>New rule</Button>
      } />

      {expandedId === '__new__' && <AdaptRuleForm draft={draft} setDraft={setDraft} err={err} saving={saving} isNew={true} onSave={handleSave} onCancel={() => { setExpandedId(null); setDraft({}); setErr(null) }} onDelete={() => {}} />}

      {rules.length === 0 && expandedId !== '__new__' ? (
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <Icon name="sliders-horizontal" size={28} color="var(--fg-4)" />
          <div style={{ fontSize: 13, color: 'var(--fg-3)', maxWidth: 340, margin: '12px auto 0', lineHeight: 1.55 }}>
            No adaptation rules set up yet. Rules tell the Coach when to automatically propose or apply changes to your training.
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-4)', margin: '16px auto 0', maxWidth: 320, lineHeight: 1.6 }}>
            Example rules:<br />
            · If HRV drops 7%+ for 2 days → propose Z2 swap<br />
            · If sleep &lt; 6h → downshift today&apos;s intensity<br />
            · If T-7 days to A-race → no Z4+ work
          </div>
          <div style={{ marginTop: 16 }}>
            <Button kind="secondary" size="sm" icon="plus" onClick={openNew}>Create your first rule</Button>
          </div>
        </div>
      ) : (
        <>
          {rules.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 120px 52px', background: 'var(--bg-1)', padding: '8px 20px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', borderTop: '1px solid var(--border-subtle)' }}>
              <span>Rule</span><span>When</span><span>Then</span><span>Mode</span><span style={{ textAlign: 'right' }}>On</span>
            </div>
          )}
          {rules.map((r, i) => (
            <div key={r.id}>
              <div
                onClick={() => openEdit(r)}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 120px 52px', padding: '12px 20px', borderTop: i > 0 || rules.length > 0 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'center', fontSize: 12, opacity: r.enabled ? 1 : 0.5, cursor: 'pointer', background: expandedId === r.id ? 'var(--bg-1)' : 'transparent' }}
                onMouseEnter={(e) => { if (expandedId !== r.id) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-1)' }}
                onMouseLeave={(e) => { if (expandedId !== r.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{r.name || '—'}</span>
                <span style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 11, paddingRight: 12 }}>{r.trigger_condition || '—'}</span>
                <span style={{ color: 'var(--fg-2)', paddingRight: 12 }}>{r.action || '—'}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: applyModeColor(r.apply_mode) }}>
                  {APPLY_MODE_OPTS.find((o) => o.v === r.apply_mode)?.l ?? r.apply_mode}
                </span>
                <span style={{ textAlign: 'right' }} onClick={(e) => { e.stopPropagation(); handleToggle(r.id, r.enabled) }}>
                  <ToggleDot on={r.enabled} />
                </span>
              </div>
              {expandedId === r.id && <AdaptRuleForm draft={draft} setDraft={setDraft} err={err} saving={saving} isNew={false} onSave={handleSave} onCancel={() => { setExpandedId(null); setDraft({}); setErr(null) }} onDelete={() => handleDelete(r.id)} />}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ── Module Detail ─────────────────────────────────────────────────────────────

function planDnaFieldDefs() {
  return [
    { label: 'Philosophy', key: 'philosophy' },
    { label: 'Philosophy notes', key: 'philosophy_notes' },
    { label: 'Weekly structure', key: 'weekly_structure' },
    { label: 'Quality sessions / wk', key: 'quality_sessions_per_week', hint: 'number' },
    { label: 'Long session day', key: 'long_session_day' },
    { label: 'Ramp rate (TSS/wk)', key: 'ramp_rate_tss_per_week', hint: 'number' },
    { label: 'Peak weekly hours', key: 'peak_weekly_hours', hint: 'number' },
    { label: 'Peak weekly TSS', key: 'peak_weekly_tss', hint: 'number' },
    { label: 'Current phase', key: 'current_phase' },
    { label: 'Current week in phase', key: 'current_week_in_phase', hint: 'number' },
    { label: 'Phase length (weeks)', key: 'phase_length_weeks', hint: 'number' },
  ]
}

function planDnaViewFields(data: Row | null): Array<[string, string]> {
  if (!data) return []
  return [
    ['Philosophy', fmt(data.philosophy)],
    ['Notes', fmt(data.philosophy_notes)],
    ['Weekly structure', fmt(data.weekly_structure)],
    ['Quality sessions / wk', fmt(data.quality_sessions_per_week)],
    ['Long session day', fmt(data.long_session_day)],
    ['Ramp rate', data.ramp_rate_tss_per_week ? `${data.ramp_rate_tss_per_week} TSS/wk` : '—'],
    ['Peak weekly hours', data.peak_weekly_hours ? `${data.peak_weekly_hours}h` : '—'],
    ['Peak weekly TSS', fmt(data.peak_weekly_tss)],
    ['Current phase', fmt(data.current_phase)],
    ['Current week', data.current_week_in_phase && data.phase_length_weeks ? `${data.current_week_in_phase} of ${data.phase_length_weeks}` : '—'],
  ]
}

interface ModuleDetailProps {
  module: { id: string; title: string; icon: string; tag: string; data: Row | null; editable: boolean }
  editing: boolean
  editFields: Record<string, string>
  healthForm: HealthFormState | null
  saving: boolean
  saveError: string | null
  raceGoals: Row[]
  illnesses: Row[]
  injuries: Row[]
  onEdit: () => void
  onFieldChange: (k: string, v: string) => void
  onHealthFormChange: (s: HealthFormState) => void
  onSave: () => void
  onClose: () => void
  onRefresh: () => void
  onMarkIllnessRecovered?: (id: string) => Promise<void>
  onMarkInjuryResolved?: (id: string) => Promise<void>
}

function ModuleDetail({ module, editing, editFields, healthForm, saving, saveError, raceGoals, illnesses, injuries, onEdit, onFieldChange, onHealthFormChange, onSave, onClose, onRefresh, onMarkIllnessRecovered, onMarkInjuryResolved }: ModuleDetailProps) {

  function renderContent() {
    if (module.id === 'athlete') {
      return <AthleteProfileContent data={module.data} editing={editing} editFields={editFields} onFieldChange={onFieldChange} onRefresh={onRefresh} />
    }
    if (module.id === 'health') {
      if (editing && healthForm) return <HealthModuleEdit healthForm={healthForm} onFormChange={onHealthFormChange} />
      return <HealthModuleView data={module.data} illnesses={illnesses} injuries={injuries} onMarkIllnessRecovered={onMarkIllnessRecovered} onMarkInjuryResolved={onMarkInjuryResolved} />
    }
    if (module.id === 'fueling') {
      if (editing) return <FuelingEditContent editFields={editFields} onFieldChange={onFieldChange} />
      return <FuelingViewContent data={module.data} />
    }
    if (module.id === 'recovery') {
      if (editing) return <RecoveryEditContent editFields={editFields} onFieldChange={onFieldChange} />
      return <RecoveryViewContent data={module.data} />
    }
    if (module.id === 'goals') {
      if (!raceGoals.length) return <EmptyState label="No upcoming races. Add your race goals in the Races tab." />
      return (
        <div style={{ padding: '8px 0' }}>
          {raceGoals.map((g, i) => (
            <div key={String(g.id ?? i)} style={{ padding: '14px 24px', borderBottom: i < raceGoals.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Pill color={g.priority === 'A' ? 'z4' : g.priority === 'B' ? 'z3' : 'z2'}>{String(g.priority ?? 'C')}-race</Pill>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>{String(g.race_name ?? '')}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>{String(g.race_date ?? '')} · {String(g.distance_format ?? '')} · {String(g.sport ?? '')}</div>
              {!!g.notes && <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>{String(g.notes)}</div>}
            </div>
          ))}
        </div>
      )
    }
    // plan-dna generic
    if (!editing) {
      const fields = planDnaViewFields(module.data)
      if (!fields.length) return <EmptyState label="No data yet. Click Edit to set up this module." />
      return (
        <div style={{ padding: '8px 0' }}>
          {fields.map(([k, v], i) => (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '14px 24px', borderBottom: i < fields.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'baseline' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>{k}</div>
              <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{v}</div>
            </div>
          ))}
        </div>
      )
    }
    return (
      <div style={{ padding: '8px 0' }}>
        {planDnaFieldDefs().map((def, i, arr) => (
          <div key={def.key} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, padding: '12px 24px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>{def.label}</div>
              {def.hint && <div style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{def.hint}</div>}
            </div>
            <textarea value={editFields[def.key] ?? ''} onChange={(e) => onFieldChange(def.key, e.target.value)} rows={(editFields[def.key] ?? '').length > 80 ? 3 : 1}
              style={{ background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '8px 10px', color: 'var(--fg-1)', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, resize: 'vertical', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <PanelHeader title={module.title} icon={module.icon} tag={module.tag} action={
        module.editable ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {!editing ? (
                <Button kind="secondary" size="sm" icon="pencil-line" onClick={onEdit}>Edit</Button>
              ) : (
                <>
                  <Button kind="ghost" size="sm" onClick={onClose}>Cancel</Button>
                  <Button kind="primary" size="sm" icon="check" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                </>
              )}
            </div>
            {saveError && editing && <div style={{ fontSize: 11, color: 'var(--danger)', maxWidth: 240, textAlign: 'right', lineHeight: 1.4 }}>{saveError}</div>}
          </div>
        ) : null
      } />
      {renderContent()}
    </div>
  )
}

// ── PB helpers ────────────────────────────────────────────────────────────────

function fmtPace(secsPerKm: number | null, unit: string): string {
  if (secsPerKm == null) return '—'
  const m = Math.floor(secsPerKm / 60)
  const s = Math.round(secsPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/${unit}`
}

function fmtPBDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    const [y, mo, d] = dateStr.split('-').map(Number)
    return new Date(y, mo - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}

interface PBEntry { value: number | null; unit: string; date: string | null; source: string | null; override: number | null }
type PBSport = Record<string, PBEntry>
interface PBData { cycling?: PBSport; running?: PBSport; swimming?: PBSport }

function PBRow({ label, entry, sport, metric, onOverride }: {
  label: string
  entry: PBEntry | undefined
  sport: string
  metric: string
  onOverride: (sport: string, metric: string, entry: PBEntry | undefined) => void
}) {
  const effective = entry?.override != null ? entry.override : entry?.value
  const isManual = entry?.override != null

  let displayVal = '—'
  if (effective != null) {
    if (sport === 'cycling') {
      displayVal = `${effective} W`
    } else if (sport === 'running') {
      displayVal = fmtPace(effective, 'km')
    } else if (sport === 'swimming') {
      displayVal = fmtPace(effective, '100m')
    }
  }

  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: '150px 1fr auto auto', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 13, color: effective == null ? 'var(--fg-4)' : 'var(--fg-1)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {displayVal}
        {isManual && (
          <span style={{ fontSize: 10, color: 'var(--ai)', background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)', padding: '1px 5px', borderRadius: 3 }}>manual</span>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
        {fmtPBDate(entry?.date ?? null)}
      </div>
      {hovered ? (
        <button
          onClick={() => onOverride(sport, metric, entry)}
          title="Edit"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'var(--fg-3)', fontSize: 13, lineHeight: 1 }}
        >
          ✎
        </button>
      ) : (
        <div style={{ width: 18 }} />
      )}
    </div>
  )
}

interface OverrideState {
  sport: string
  metric: string
  entry: PBEntry | undefined
  wattsVal: string
  minVal: string
  secVal: string
}

const CYCLING_PB_ROWS: Array<[string, string]> = [
  ['5 sec power',  'power_5s'],
  ['1 min power',  'power_1min'],
  ['5 min power',  'power_5min'],
  ['20 min power', 'power_20min'],
  ['60 min power', 'power_60min'],
]
const RUNNING_PB_ROWS: Array<[string, string]> = [
  ['1 km',          'pace_1km'],
  ['5 km',          'pace_5km'],
  ['10 km',         'pace_10km'],
  ['Half marathon', 'pace_half_marathon'],
  ['Marathon',      'pace_marathon'],
]
const SWIMMING_PB_ROWS: Array<[string, string]> = [
  ['100m', 'pace_100m'],
  ['400m', 'pace_400m'],
]

function PersonalBestsSection({ data, onRefresh }: { data: Row | null; onRefresh: () => void }) {
  const pbs = (data?.pbs ?? {}) as PBData
  const sports = Array.isArray(data?.sports) ? (data.sports as string[]) : []

  const defaultTab: 'cycling' | 'running' | 'swimming' =
    sports.includes('cycling') ? 'cycling' :
    sports.includes('running') ? 'running' : 'cycling'

  const [activeTab, setActiveTab] = useState<'cycling' | 'running' | 'swimming'>(defaultTab)
  const [override, setOverride] = useState<OverrideState | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  const cycling = pbs.cycling ?? {}
  const running = pbs.running ?? {}
  const swimming = pbs.swimming ?? {}

  function startOverride(sport: string, metric: string, entry: PBEntry | undefined) {
    if (sport === 'cycling') {
      const v = entry?.override ?? entry?.value
      setOverride({ sport, metric, entry, wattsVal: v != null ? String(v) : '', minVal: '', secVal: '' })
    } else {
      const v = entry?.override ?? entry?.value
      if (v != null) {
        const m = Math.floor(v / 60)
        const s = Math.round(v % 60)
        setOverride({ sport, metric, entry, wattsVal: '', minVal: String(m), secVal: String(s).padStart(2, '0') })
      } else {
        setOverride({ sport, metric, entry, wattsVal: '', minVal: '', secVal: '' })
      }
    }
    setSaveErr(null)
  }

  async function handleSaveOverride() {
    if (!override) return
    setSaving(true); setSaveErr(null)
    let val: number | null = null
    if (override.sport === 'cycling') {
      val = override.wattsVal.trim() === '' ? null : Number(override.wattsVal)
    } else {
      const m = parseInt(override.minVal || '0', 10)
      const s = parseInt(override.secVal || '0', 10)
      if (override.minVal.trim() === '' && override.secVal.trim() === '') {
        val = null
      } else {
        val = m * 60 + s
      }
    }
    try {
      const res = await fetch('/api/athlete/pb-override', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport: override.sport, metric: override.metric, value: val }),
      })
      if (res.ok) { setOverride(null); onRefresh() }
      else { const b = await res.json().catch(() => ({})); setSaveErr(b.error ?? 'Save failed') }
    } catch { setSaveErr('Network error') }
    setSaving(false)
  }

  async function handleClearOverride() {
    if (!override) return
    setSaving(true); setSaveErr(null)
    try {
      const res = await fetch('/api/athlete/pb-override', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport: override.sport, metric: override.metric, clear: true }),
      })
      if (res.ok) { setOverride(null); onRefresh() }
      else { const b = await res.json().catch(() => ({})); setSaveErr(b.error ?? 'Clear failed') }
    } catch { setSaveErr('Network error') }
    setSaving(false)
  }

  const inputNumStyle: React.CSSProperties = {
    background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 5,
    padding: '6px 8px', color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none',
  }

  return (
    <div style={{ borderTop: '1px solid var(--border-default)', padding: '14px 24px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-3)', marginBottom: 3 }}>PERSONAL BESTS</div>
        <div style={{ fontSize: 11, color: 'var(--fg-4)', lineHeight: 1.4 }}>
          Cycling and running PBs sync automatically from Intervals.icu · Swimming requires manual entry
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 4, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 0 }}>
        {([
          { id: 'cycling',  label: 'Cycling',  manual: false },
          { id: 'running',  label: 'Running',  manual: false },
          { id: 'swimming', label: 'Swimming', manual: true  },
        ] as const).map((tab) => (
          <button key={tab.id}
            onClick={() => { setActiveTab(tab.id); setOverride(null) }}
            style={{
              padding: '6px 14px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
              background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? 'var(--accent)' : 'transparent'}`,
              color: activeTab === tab.id ? 'var(--fg-1)' : 'var(--fg-3)',
              fontWeight: activeTab === tab.id ? 500 : 400,
              marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {tab.label}
            {tab.manual && (
              <span style={{ fontSize: 9, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>manual</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab rows */}
      <div style={{ paddingTop: 4 }}>
        {activeTab === 'cycling' && CYCLING_PB_ROWS.map(([label, key]) => (
          <PBRow key={key} label={label} entry={cycling[key] as PBEntry | undefined}
            sport="cycling" metric={key} onOverride={startOverride} />
        ))}
        {activeTab === 'running' && RUNNING_PB_ROWS.map(([label, key]) => (
          <PBRow key={key} label={label} entry={running[key] as PBEntry | undefined}
            sport="running" metric={key} onOverride={startOverride} />
        ))}
        {activeTab === 'swimming' && SWIMMING_PB_ROWS.map(([label, key]) => (
          <PBRow key={key} label={label} entry={swimming[key] as PBEntry | undefined}
            sport="swimming" metric={key} onOverride={startOverride} />
        ))}
      </div>

      {/* Inline override form */}
      {override && override.sport === activeTab && (
        <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 7 }}>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
            Override <span style={{ color: 'var(--fg-1)' }}>{override.metric}</span>
            {override.entry?.value != null && (
              <span style={{ color: 'var(--fg-4)', marginLeft: 8 }}>
                Auto: {override.sport === 'cycling' ? `${override.entry.value}W` : fmtPace(override.entry.value, override.sport === 'swimming' ? '100m' : 'km')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {override.sport === 'cycling' ? (
              <>
                <input type="number" value={override.wattsVal}
                  onChange={(e) => setOverride((o) => o ? { ...o, wattsVal: e.target.value } : o)}
                  placeholder="watts"
                  style={{ ...inputNumStyle, width: 80 }} />
                <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>W</span>
              </>
            ) : (
              <>
                <input type="number" min="0" max="99" value={override.minVal}
                  onChange={(e) => setOverride((o) => o ? { ...o, minVal: e.target.value } : o)}
                  placeholder="min"
                  style={{ ...inputNumStyle, width: 52 }} />
                <span style={{ color: 'var(--fg-3)', fontSize: 13 }}>:</span>
                <input type="number" min="0" max="59" value={override.secVal}
                  onChange={(e) => setOverride((o) => o ? { ...o, secVal: e.target.value } : o)}
                  placeholder="sec"
                  style={{ ...inputNumStyle, width: 52 }} />
                <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>{override.sport === 'swimming' ? '/100m' : '/km'}</span>
              </>
            )}
            <button onClick={handleSaveOverride} disabled={saving}
              style={{ background: 'var(--accent)', border: 'none', borderRadius: 5, padding: '6px 12px', fontSize: 12, fontWeight: 500, color: '#0a0a0a', cursor: 'pointer' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {override.entry?.override != null && (
              <button onClick={handleClearOverride} disabled={saving}
                style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: 5, padding: '6px 12px', fontSize: 12, color: 'var(--fg-3)', cursor: 'pointer' }}>
                Clear
              </button>
            )}
            <button onClick={() => setOverride(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-4)', fontSize: 13, padding: '6px 4px' }}>✕</button>
          </div>
          {saveErr && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 6 }}>{saveErr}</div>}
        </div>
      )}

      <div style={{ paddingBottom: 14 }} />
    </div>
  )
}

// ── Athlete Profile Content ───────────────────────────────────────────────────

function AthleteProfileContent({ data, editing, editFields, onFieldChange, onRefresh }: {
  data: Row | null; editing: boolean; editFields: Record<string, string>; onFieldChange: (k: string, v: string) => void; onRefresh?: () => void
}) {
  const inputStyle: React.CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '7px 10px', color: 'var(--fg-1)', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, outline: 'none', width: '100%', boxSizing: 'border-box' }

  const coachingFields: Array<[string, string]> = data ? [
    ['Name', fmt(data.name)],
    ['Location', fmt(data.location)],
    ['Sports', fmt(data.sports)],
    ['Experience', data.experience_years ? `${data.experience_years} years` : '—'],
    ['Coaching history', fmt(data.coaching_history)],
    ['Strengths', fmt(data.strengths)],
    ['Weaknesses', fmt(data.weaknesses)],
  ] : []

  const syncDate = data?.updated_at ? fmtRelativeDate(String(data.updated_at)) : null
  const ftp = data?.ftp_override ?? data?.ftp_watts
  const pace = data?.threshold_pace_override ?? data?.threshold_pace_per_km
  const css = data?.css_override ?? data?.css_per_100m

  if (editing) {
    const editDefs = [
      { label: 'Name', key: 'name', placeholder: 'Your name' },
      { label: 'Location', key: 'location', placeholder: 'City, Country' },
      { label: 'Sports', key: 'sports', hint: 'comma-separated' },
      { label: 'Experience years', key: 'experience_years', hint: 'number' },
      { label: 'Coaching history', key: 'coaching_history' },
      { label: 'Strengths', key: 'strengths' },
      { label: 'Weaknesses', key: 'weaknesses' },
    ]
    const overrideDefs = [
      { label: 'FTP override (watts)', key: 'ftp_override', hint: 'Overrides Intervals.icu estimate' },
      { label: 'Threshold pace override (s/km)', key: 'threshold_pace_override', hint: 'Overrides Intervals.icu estimate' },
      { label: 'CSS override (s/100m)', key: 'css_override', hint: 'Overrides Intervals.icu estimate' },
    ]
    return (
      <div style={{ padding: '8px 0' }}>
        {editDefs.map((def, i) => (
          <div key={def.key} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>{def.label}</div>
              {def.hint && <div style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{def.hint}</div>}
            </div>
            <textarea value={editFields[def.key] ?? ''} onChange={(e) => onFieldChange(def.key, e.target.value)} rows={1}
              placeholder={def.placeholder}
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        ))}
        <div style={{ padding: '14px 24px 6px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-3)', marginBottom: 4 }}>FITNESS METRIC OVERRIDES</div>
          <div style={{ fontSize: 12, color: 'var(--fg-4)', marginBottom: 12 }}>Override takes precedence over Intervals.icu estimate</div>
        </div>
        {overrideDefs.map((def) => (
          <div key={def.key} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, padding: '10px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>{def.label}</div>
            <input type="number" value={editFields[def.key] ?? ''} onChange={(e) => onFieldChange(def.key, e.target.value)} style={inputStyle} placeholder="Leave blank to use synced value" />
          </div>
        ))}
      </div>
    )
  }

  if (!data) return <EmptyState label="No athlete profile yet. Click Edit to set up." />
  return (
    <div>
      <div style={{ padding: '8px 0' }}>
        {coachingFields.map(([k, v], i) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '14px 24px', borderBottom: i < coachingFields.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'baseline' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>{k}</div>
            <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.55 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid var(--border-default)', padding: '14px 24px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-3)' }}>FITNESS METRICS</div>
          {syncDate && <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>· Synced from Intervals.icu · {syncDate}</span>}
        </div>
        {[
          ['FTP', ftp ? `${ftp}W${data.ftp_override ? ' (override)' : ''}` : '—'],
          ['Threshold pace', pace ? `${pace}s/km${data.threshold_pace_override ? ' (override)' : ''}` : '—'],
          ['Threshold HR cycling', data.threshold_hr_cycling ? `${data.threshold_hr_cycling} bpm` : '—'],
          ['Threshold HR running', data.threshold_hr_running ? `${data.threshold_hr_running} bpm` : '—'],
          ['CSS', css ? `${css}s/100m${data.css_override ? ' (override)' : ''}` : '—'],
        ].map(([k, v], i, arr) => (
          <div key={String(k)} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'baseline' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>{k}</div>
            <div style={{ fontSize: 13, color: v === '—' ? 'var(--fg-4)' : 'var(--fg-1)', lineHeight: 1.55 }}>{String(v)}</div>
          </div>
        ))}
        <div style={{ paddingBottom: 14 }} />
      </div>
      <PersonalBestsSection data={data} onRefresh={onRefresh ?? (() => {})} />
    </div>
  )
}

// ── Fueling Content ───────────────────────────────────────────────────────────

function FuelingViewContent({ data }: { data: Row | null }) {
  const hasData = data && (data.training_carb_per_hour_g || data.caffeine_strategy || data.pre_race_meal)

  if (!hasData) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <Icon name="droplets" size={32} color="var(--fg-4)" />
        <div style={{ fontSize: 13, color: 'var(--fg-3)', maxWidth: 320, margin: '12px auto 0', lineHeight: 1.55 }}>
          Your fueling preferences aren&apos;t set up yet. The Coach will reference this during long session discussions. Race-day fueling targets are set per-race on the Races page.
        </div>
      </div>
    )
  }

  const sections: Array<[string, Array<[string, string]>]> = [
    ['TRAINING FUELING', [
      ['Carbohydrate / h', data.training_carb_per_hour_g ? `${data.training_carb_per_hour_g}g` : '—'],
      ['Bars until', data.bars_allowed_until_mins ? `${data.bars_allowed_until_mins} min, then gels` : '—'],
    ]],
    ['CAFFEINE & NUTRITION', [
      ['Caffeine strategy', fmt(data.caffeine_strategy)],
      ['Pre-race meal', fmt(data.pre_race_meal)],
      ['Pre-race timing', data.pre_race_timing_hours ? `T-${data.pre_race_timing_hours}h before start` : '—'],
      ['GI notes', fmt(data.gi_notes)],
      ['Heat threshold', data.heat_threshold_celsius ? `${data.heat_threshold_celsius}°C` : '—'],
    ]],
  ]

  return (
    <div style={{ padding: '8px 0' }}>
      {sections.map(([heading, fields]) => (
        <div key={heading}>
          <div style={{ padding: '14px 24px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-3)' }}>{heading}</div>
          {fields.map(([k, v], i) => (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '10px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'baseline' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>{k}</div>
              <div style={{ fontSize: 13, color: v === '—' ? 'var(--fg-4)' : 'var(--fg-1)', lineHeight: 1.55 }}>{v}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function FuelingEditContent({ editFields, onFieldChange }: { editFields: Record<string, string>; onFieldChange: (k: string, v: string) => void }) {
  const inputStyle: React.CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '7px 10px', color: 'var(--fg-1)', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, outline: 'none', width: '100%', boxSizing: 'border-box' }

  function numRow(label: string, k: string, suffix: string) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '10px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" value={editFields[k] ?? ''} onChange={(e) => onFieldChange(k, e.target.value)} style={{ ...inputStyle, width: 80 }} />
          <span style={{ color: 'var(--fg-3)', fontSize: 12, flexShrink: 0 }}>{suffix}</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ padding: '14px 24px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-3)' }}>TRAINING FUELING</div>
      {numRow('Carbohydrate', 'training_carb_per_hour_g', 'g/h')}
      {numRow('Bars until', 'bars_allowed_until_mins', 'min then gels')}
      <div style={{ padding: '14px 24px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-3)' }}>CAFFEINE & NUTRITION</div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '10px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'start' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>Caffeine strategy</div>
        <textarea value={editFields['caffeine_strategy'] ?? ''} onChange={(e) => onFieldChange('caffeine_strategy', e.target.value)} rows={2} style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '10px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'start' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>Pre-race meal</div>
        <textarea value={editFields['pre_race_meal'] ?? ''} onChange={(e) => onFieldChange('pre_race_meal', e.target.value)} rows={2} style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} />
      </div>
      {numRow('Pre-race timing', 'pre_race_timing_hours', 'h before start')}
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '10px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'start' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>GI notes</div>
        <textarea value={editFields['gi_notes'] ?? ''} onChange={(e) => onFieldChange('gi_notes', e.target.value)} rows={2} style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} />
      </div>
      {numRow('Heat threshold', 'heat_threshold_celsius', '°C')}
    </div>
  )
}

// ── Recovery Content ──────────────────────────────────────────────────────────

function RecoveryViewContent({ data }: { data: Row | null }) {
  if (!data) return <EmptyState label="No recovery preferences set up yet. Click Edit to configure." />

  const fields: Array<[string, string]> = [
    ['Sleep target', fmtSleepHours(data.sleep_target_hours)],
    ['Rest days', fmtRestDays(data.preferred_rest_days)],
    ['HRV measurement', fmtHrvTime(data.hrv_measurement_time)],
    ['HRV device', fmt(data.hrv_device)],
    ['Deload frequency', data.deload_frequency_weeks ? `Every ${data.deload_frequency_weeks} weeks` : '—'],
    ['Deload load', data.deload_load_percent ? `${data.deload_load_percent}% of normal load` : '—'],
    ['Recovery modalities', fmt(data.recovery_modalities)],
  ]

  return (
    <div style={{ padding: '8px 0' }}>
      {fields.map(([k, v], i) => (
        <div key={k} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '14px 24px', borderBottom: i < fields.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'baseline' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>{k}</div>
          <div style={{ fontSize: 13, color: v === '—' ? 'var(--fg-4)' : 'var(--fg-1)', lineHeight: 1.55 }}>{v}</div>
        </div>
      ))}
    </div>
  )
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HRV_DEVICES = ['Garmin', 'Oura', 'WHOOP', 'Apple Watch', 'Other']

function RecoveryEditContent({ editFields, onFieldChange }: { editFields: Record<string, string>; onFieldChange: (k: string, v: string) => void }) {
  const inputStyle: React.CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '7px 10px', color: 'var(--fg-1)', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, outline: 'none', width: '100%', boxSizing: 'border-box' }

  const restDays: string[] = editFields['preferred_rest_days']
    ? editFields['preferred_rest_days'].split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    : []

  function toggleRestDay(d: string) {
    const next = restDays.includes(d) ? restDays.filter((r) => r !== d) : [...restDays, d]
    onFieldChange('preferred_rest_days', next.join(', '))
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>Sleep target</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" step="0.5" min="4" max="12" value={editFields['sleep_target_hours'] ?? ''} onChange={(e) => onFieldChange('sleep_target_hours', e.target.value)} style={{ ...inputStyle, width: 70 }} />
          <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>hours</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>Rest days</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {DAYS.map((d, i) => (
            <button key={d} onClick={() => toggleRestDay(d)}
              style={{ padding: '4px 8px', fontSize: 11, fontFamily: 'inherit', background: restDays.includes(d) ? 'var(--accent)' : 'var(--bg-1)', border: `1px solid ${restDays.includes(d) ? 'var(--accent)' : 'var(--border-default)'}`, borderRadius: 4, color: restDays.includes(d) ? 'var(--accent-fg, #fff)' : 'var(--fg-3)', cursor: 'pointer' }}>
              {DAY_LABELS[i]}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>HRV measurement</div>
        <select value={editFields['hrv_measurement_time'] ?? ''} onChange={(e) => onFieldChange('hrv_measurement_time', e.target.value)} style={{ ...inputStyle, WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}>
          <option value="">Select</option>
          <option value="upon_wake">Upon wake</option>
          <option value="morning">Morning</option>
          <option value="night">Night</option>
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>HRV device</div>
        <select value={editFields['hrv_device'] ?? ''} onChange={(e) => onFieldChange('hrv_device', e.target.value)} style={{ ...inputStyle, WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}>
          <option value="">Select</option>
          {HRV_DEVICES.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>Deload frequency</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>Every</span>
          <input type="number" min="1" max="16" value={editFields['deload_frequency_weeks'] ?? ''} onChange={(e) => onFieldChange('deload_frequency_weeks', e.target.value)} style={{ ...inputStyle, width: 60 }} />
          <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>weeks</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>Deload load</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" min="10" max="100" value={editFields['deload_load_percent'] ?? ''} onChange={(e) => onFieldChange('deload_load_percent', e.target.value)} style={{ ...inputStyle, width: 70 }} />
          <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>% of normal load</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '14px 24px', alignItems: 'start' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>Recovery modalities</div>
        <textarea value={editFields['recovery_modalities'] ?? ''} onChange={(e) => onFieldChange('recovery_modalities', e.target.value)} rows={3} style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} placeholder="e.g. Sauna, ice bath, compression boots" />
      </div>
    </div>
  )
}

// ── Panel Header ──────────────────────────────────────────────────────────────

function PanelHeader({ title, icon, tag, action }: { title: string; icon: string; tag: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name={icon} size={16} color="var(--fg-2)" />
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em', margin: 0 }}>{title}</h2>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ai)', background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)', padding: '2px 6px', borderRadius: 4 }}>{tag}</span>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── Toggle Dot ────────────────────────────────────────────────────────────────

function ToggleDot({ on }: { on: boolean }) {
  return (
    <div style={{ display: 'inline-block', width: 26, height: 14, borderRadius: 999, background: on ? 'var(--accent)' : 'var(--bg-3)', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-default)'}`, position: 'relative', cursor: 'pointer' }}>
      <div style={{ position: 'absolute', top: 1, left: on ? 13 : 1, width: 10, height: 10, borderRadius: 999, background: on ? 'var(--accent-fg)' : 'var(--fg-3)', transition: 'left var(--dur-micro) var(--ease-out)' }} />
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center', fontSize: 13, color: 'var(--fg-4)' }}>
      {label}
    </div>
  )
}

// ── Health Module View ────────────────────────────────────────────────────────

interface Illness {
  id?: string; name?: string; description?: string; date_start?: string
  date_cleared?: string | null; hrv_impact?: string; restrictions?: string[]
  can_cycle?: boolean; can_run?: boolean; can_swim?: boolean; physio_notes?: string; date_added?: string
}
interface Injury {
  id?: string; body_part?: string; description?: string; date_start?: string
  date_cleared?: string | null; restrictions?: string[]; can_cycle?: boolean
  can_run?: boolean; can_swim?: boolean; physio_notes?: string; date_added?: string
}

function fmtHealthDate(d?: string | null): string {
  if (!d) return '—'
  try { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return d }
}

function HealthModuleView({ data, illnesses: illnessRows, injuries: injuryRows, onMarkIllnessRecovered, onMarkInjuryResolved }: {
  data: Row | null
  illnesses: Row[]
  injuries: Row[]
  onMarkIllnessRecovered?: (id: string) => Promise<void>
  onMarkInjuryResolved?: (id: string) => Promise<void>
}) {
  const [pastExpanded, setPastExpanded] = useState(false)
  const [marking, setMarking] = useState<string | null>(null)
  const activeIllnesses = illnessRows.filter((il) => !il.date_cleared) as Illness[]
  const pastIllnesses = illnessRows.filter((il) => !!il.date_cleared) as Illness[]
  const activeInjuries = injuryRows.filter((inj) => !inj.date_cleared) as Injury[]

  async function doMark(id: string, fn?: (id: string) => Promise<void>) {
    if (!fn || !id) return; setMarking(id); await fn(id); setMarking(null)
  }

  const cardStyle: React.CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-3)', marginBottom: 10 }}>ACTIVE ILLNESSES</div>
        {activeIllnesses.length === 0 ? <div style={{ fontSize: 13, color: 'var(--fg-4)' }}>No active illnesses</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeIllnesses.map((il, i) => (
              <div key={il.id ?? i} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>{il.name ?? 'Illness'}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Started {fmtHealthDate(il.date_start)}</div>
                {il.description && <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>{il.description}</div>}
                {il.restrictions?.map((r, ri) => <div key={ri} style={{ fontSize: 12, color: 'var(--fg-2)', display: 'flex', gap: 6 }}><span style={{ color: 'var(--fg-4)' }}>•</span><span>{r}</span></div>)}
                {il.id && <div style={{ marginTop: 4 }}><Button kind="ghost" size="sm" icon="check" onClick={() => doMark(il.id!, onMarkIllnessRecovered)} disabled={marking === il.id}>{marking === il.id ? 'Saving…' : 'Mark as recovered'}</Button></div>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-3)', marginBottom: 10 }}>ACTIVE INJURIES</div>
        {activeInjuries.length === 0 ? <div style={{ fontSize: 13, color: 'var(--fg-4)' }}>No active injuries</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeInjuries.map((inj, i) => (
              <div key={inj.id ?? i} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>{inj.body_part ?? 'Injury'}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Started {fmtHealthDate(inj.date_start)}</div>
                {inj.description && <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>{inj.description}</div>}
                {inj.restrictions?.map((r, ri) => <div key={ri} style={{ fontSize: 12, color: 'var(--fg-2)', display: 'flex', gap: 6 }}><span style={{ color: 'var(--fg-4)' }}>•</span><span>{r}</span></div>)}
                {inj.id && <div style={{ marginTop: 4 }}><Button kind="ghost" size="sm" icon="check" onClick={() => doMark(inj.id!, onMarkInjuryResolved)} disabled={marking === inj.id}>{marking === inj.id ? 'Saving…' : 'Mark as resolved'}</Button></div>}
              </div>
            ))}
          </div>
        )}
      </div>
      {pastIllnesses.length > 0 && (
        <div>
          <button onClick={() => setPastExpanded((p) => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 6, padding: 0, marginBottom: pastExpanded ? 10 : 0 }}>
            <Icon name={pastExpanded ? 'chevron-down' : 'chevron-right'} size={12} color="var(--fg-4)" />
            Past illnesses ({pastIllnesses.length})
          </button>
          {pastExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pastIllnesses.map((il, i) => (
                <div key={il.id ?? i} style={{ ...cardStyle, opacity: 0.7 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-2)' }}>{il.name ?? 'Illness'}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{fmtHealthDate(il.date_start)} → cleared {fmtHealthDate(il.date_cleared)}</div>
                  {il.description && <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>{il.description}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {(data?.allergies || data?.medications || (Array.isArray(data?.monitoring_flags) && (data.monitoring_flags as unknown[]).length > 0)) && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.isArray(data?.monitoring_flags) && (data.monitoring_flags as string[]).length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>Monitoring flags</div>
              <div style={{ fontSize: 13, color: 'var(--fg-1)' }}>{(data!.monitoring_flags as string[]).join(', ')}</div>
            </div>
          )}
          {!!data?.allergies && <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}><div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>Allergies</div><div style={{ fontSize: 13, color: 'var(--fg-1)' }}>{String(data.allergies)}</div></div>}
          {!!data?.medications && <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}><div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>Medications</div><div style={{ fontSize: 13, color: 'var(--fg-1)' }}>{String(data.medications)}</div></div>}
        </div>
      )}
      {!data && <div style={{ fontSize: 13, color: 'var(--fg-4)' }}>No health data yet. Click Edit to set up.</div>}
    </div>
  )
}

// ── Health Module Edit ────────────────────────────────────────────────────────

function HealthModuleEdit({ healthForm, onFormChange }: { healthForm: HealthFormState; onFormChange: (s: HealthFormState) => void }) {
  const [newFlagInput, setNewFlagInput] = useState('')
  const today = new Date().toISOString().split('T')[0]
  const inputStyle: React.CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '7px 10px', color: 'var(--fg-1)', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, outline: 'none', width: '100%', boxSizing: 'border-box' }
  const sectionLabel: React.CSSProperties = { fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-3)', marginBottom: 10 }
  const addBtnStyle: React.CSSProperties = { marginTop: 10, background: 'none', border: '1px dashed var(--border-default)', borderRadius: 6, padding: '8px 14px', fontSize: 12, color: 'var(--fg-3)', cursor: 'pointer', width: '100%', textAlign: 'left' }

  const updateIllness = (id: string, patch: Partial<IllnessForm>) => onFormChange({ ...healthForm, illnessForms: healthForm.illnessForms.map((f) => f.id === id ? { ...f, ...patch } : f) })
  const removeIllness = (id: string) => onFormChange({ ...healthForm, illnessForms: healthForm.illnessForms.filter((f) => f.id !== id) })
  const addIllness = () => onFormChange({ ...healthForm, illnessForms: [...healthForm.illnessForms, { id: crypto.randomUUID(), name: '', description: '', dateStart: today, restrictions: '', canCycle: true, canRun: true, canSwim: true, notes: '', date_added: today }] })
  const updateInjury = (id: string, patch: Partial<InjuryForm>) => onFormChange({ ...healthForm, injuryForms: healthForm.injuryForms.map((f) => f.id === id ? { ...f, ...patch } : f) })
  const removeInjury = (id: string) => onFormChange({ ...healthForm, injuryForms: healthForm.injuryForms.filter((f) => f.id !== id) })
  const addInjury = () => onFormChange({ ...healthForm, injuryForms: [...healthForm.injuryForms, { id: crypto.randomUUID(), bodyPart: '', description: '', dateStart: today, restrictions: '', canCycle: true, canRun: true, canSwim: true, physioNotes: '', date_added: today }] })
  const addFlag = () => { const v = newFlagInput.trim(); if (!v) return; onFormChange({ ...healthForm, monitoringFlags: [...healthForm.monitoringFlags, v] }); setNewFlagInput('') }
  const removeFlag = (i: number) => onFormChange({ ...healthForm, monitoringFlags: healthForm.monitoringFlags.filter((_, fi) => fi !== i) })

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <div style={sectionLabel}>Active Illnesses</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {healthForm.illnessForms.length === 0 && <div style={{ fontSize: 13, color: 'var(--fg-4)' }}>No active illnesses</div>}
          {healthForm.illnessForms.map((ill) => <IllnessCard key={ill.id} form={ill} onChange={(p) => updateIllness(ill.id, p)} onRemove={() => removeIllness(ill.id)} inputStyle={inputStyle} />)}
        </div>
        <button type="button" onClick={addIllness} style={addBtnStyle}>+ Add illness</button>
      </div>
      <div>
        <div style={sectionLabel}>Active Injuries</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {healthForm.injuryForms.length === 0 && <div style={{ fontSize: 13, color: 'var(--fg-4)' }}>No active injuries</div>}
          {healthForm.injuryForms.map((inj) => <InjuryCard key={inj.id} form={inj} onChange={(p) => updateInjury(inj.id, p)} onRemove={() => removeInjury(inj.id)} inputStyle={inputStyle} />)}
        </div>
        <button type="button" onClick={addInjury} style={addBtnStyle}>+ Add injury</button>
      </div>
      <div>
        <div style={sectionLabel}>Monitoring Flags</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {healthForm.monitoringFlags.map((flag, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '4px 6px 4px 10px', background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 999, fontSize: 12, color: 'var(--fg-1)' }}>
              {flag}<RemoveButton onClick={() => removeFlag(i)} />
            </span>
          ))}
          <input value={newFlagInput} onChange={(e) => setNewFlagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFlag() } }} placeholder="+ Add flag" style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: 'var(--fg-2)', padding: '4px 0', minWidth: 80, cursor: 'text' }} />
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={sectionLabel}>General Health</div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, alignItems: 'center' }}>
          <label style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>Allergies</label>
          <input value={healthForm.allergies} onChange={(e) => onFormChange({ ...healthForm, allergies: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, alignItems: 'center' }}>
          <label style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>Medications</label>
          <input value={healthForm.medications} onChange={(e) => onFormChange({ ...healthForm, medications: e.target.value })} style={inputStyle} />
        </div>
      </div>
    </div>
  )
}

// ── Illness / Injury Cards ────────────────────────────────────────────────────

function IllnessCard({ form, onChange, onRemove, inputStyle }: { form: IllnessForm; onChange: (p: Partial<IllnessForm>) => void; onRemove: () => void; inputStyle: React.CSSProperties }) {
  const fieldLabel: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500, marginBottom: 4, display: 'block' }
  return (
    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{form.name || 'New illness'}</span>
        <RemoveButton onClick={onRemove} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><label style={fieldLabel}>Name</label><input value={form.name} onChange={(e) => onChange({ name: e.target.value })} style={inputStyle} placeholder="e.g. Cold" /></div>
        <div><label style={fieldLabel}>Date started</label><input type="date" value={form.dateStart} onChange={(e) => onChange({ dateStart: e.target.value })} style={inputStyle} /></div>
      </div>
      <div><label style={fieldLabel}>Description</label><input value={form.description} onChange={(e) => onChange({ description: e.target.value })} style={inputStyle} /></div>
      <div><label style={fieldLabel}>Restrictions (one per line)</label><textarea value={form.restrictions} onChange={(e) => onChange({ restrictions: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
      <div><label style={fieldLabel}>Can train</label><div style={{ display: 'flex', gap: 6 }}><TogglePill label="Cycle" checked={form.canCycle} onChange={(v) => onChange({ canCycle: v })} /><TogglePill label="Run" checked={form.canRun} onChange={(v) => onChange({ canRun: v })} /><TogglePill label="Swim" checked={form.canSwim} onChange={(v) => onChange({ canSwim: v })} /></div></div>
      <div><label style={fieldLabel}>Notes</label><input value={form.notes} onChange={(e) => onChange({ notes: e.target.value })} style={inputStyle} /></div>
    </div>
  )
}

function InjuryCard({ form, onChange, onRemove, inputStyle }: { form: InjuryForm; onChange: (p: Partial<InjuryForm>) => void; onRemove: () => void; inputStyle: React.CSSProperties }) {
  const fieldLabel: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500, marginBottom: 4, display: 'block' }
  return (
    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{form.bodyPart || 'New injury'}</span>
        <RemoveButton onClick={onRemove} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><label style={fieldLabel}>Body part</label><input value={form.bodyPart} onChange={(e) => onChange({ bodyPart: e.target.value })} style={inputStyle} placeholder="e.g. Left knee" /></div>
        <div><label style={fieldLabel}>Date started</label><input type="date" value={form.dateStart} onChange={(e) => onChange({ dateStart: e.target.value })} style={inputStyle} /></div>
      </div>
      <div><label style={fieldLabel}>Description</label><input value={form.description} onChange={(e) => onChange({ description: e.target.value })} style={inputStyle} /></div>
      <div><label style={fieldLabel}>Restrictions (one per line)</label><textarea value={form.restrictions} onChange={(e) => onChange({ restrictions: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
      <div><label style={fieldLabel}>Can train</label><div style={{ display: 'flex', gap: 6 }}><TogglePill label="Cycle" checked={form.canCycle} onChange={(v) => onChange({ canCycle: v })} /><TogglePill label="Run" checked={form.canRun} onChange={(v) => onChange({ canRun: v })} /><TogglePill label="Swim" checked={form.canSwim} onChange={(v) => onChange({ canSwim: v })} /></div></div>
      <div><label style={fieldLabel}>Physio notes</label><input value={form.physioNotes} onChange={(e) => onChange({ physioNotes: e.target.value })} style={inputStyle} /></div>
    </div>
  )
}

function TogglePill({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: '1px solid', borderColor: checked ? 'var(--success, #48bb78)' : 'var(--border-default)', background: checked ? 'rgba(72, 187, 120, 0.12)' : 'transparent', color: checked ? 'var(--success, #48bb78)' : 'var(--fg-4)', outline: 'none', lineHeight: 1.4 }}>
      {checked ? '✓' : '✗'} {label}
    </button>
  )
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 5px', borderRadius: 4, fontSize: 14, lineHeight: 1, color: hovered ? 'var(--error, #e05252)' : 'var(--fg-4)', transition: 'color 0.1s', outline: 'none' }} title="Remove">
      ×
    </button>
  )
}

// ── Memory Suggestions ────────────────────────────────────────────────────────

interface MemorySuggestionsProps {
  suggestions: ContextSuggestion[]
  editingSuggId: string | null
  suggEditVal: string
  onEditStart: (s: ContextSuggestion) => void
  onEditChange: (v: string) => void
  onAction: (id: string, action: 'accept' | 'reject' | 'edit', editedValue?: string) => void
}

function MemorySuggestions({ suggestions, editingSuggId, suggEditVal, onEditStart, onEditChange, onAction }: MemorySuggestionsProps) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkles" size={11} color="var(--ai)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>Memory suggestions</div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Coach proposed updates to your context. Nothing applies until you accept.</div>
        </div>
        <Pill color="ai">{suggestions.length} pending</Pill>
      </div>
      {suggestions.map((s, i) => (
        <div key={s.id} style={{ padding: '16px 20px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                Update → <span style={{ color: 'var(--ai)' }}>@{s.target_module.replace('_', '')}</span>
                {s.target_field && <span style={{ color: 'var(--fg-4)' }}> · {s.target_field}</span>}
              </span>
            </div>
            {editingSuggId === s.id ? (
              <textarea value={suggEditVal} onChange={(e) => onEditChange(e.target.value)} rows={3} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '8px 10px', color: 'var(--fg-1)', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, resize: 'vertical', outline: 'none', marginBottom: 8 }} />
            ) : (
              <div style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.5, marginBottom: 6 }}>{s.suggested_value}</div>
            )}
            {s.evidence && <div style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{s.evidence}</div>}
            {s.reasoning && <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>{s.reasoning}</div>}
          </div>
          <div style={{ display: 'flex', gap: 4, flexDirection: 'column', alignItems: 'flex-end' }}>
            {editingSuggId === s.id ? (
              <><Button kind="ai" size="sm" icon="check" onClick={() => onAction(s.id, 'edit', suggEditVal)}>Save</Button><Button kind="ghost" size="sm" onClick={() => onAction(s.id, 'accept')}>Cancel</Button></>
            ) : (
              <><Button kind="ai" size="sm" icon="check" onClick={() => onAction(s.id, 'accept')}>Accept</Button><Button kind="ghost" size="sm" icon="pencil-line" onClick={() => onEditStart(s)}>Edit</Button><Button kind="ghost" size="sm" icon="x" onClick={() => onAction(s.id, 'reject')}>Reject</Button></>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
