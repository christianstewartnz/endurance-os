'use client'

import { useState, useCallback } from 'react'
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
  recoveryPreferences: Row | null
  pendingSuggestions: ContextSuggestion[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: unknown): string {
  if (v == null || v === '') return '—'
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') return JSON.stringify(v, null, 2)
  return String(v)
}

function summarise(module: string, data: Row | null): string {
  if (!data) return 'Not set up yet'
  switch (module) {
    case 'athlete': {
      const parts = [data.name, data.age ? `${data.age}y` : null, data.location].filter(Boolean)
      return parts.join(' · ') || 'Profile data present'
    }
    case 'coach-style':
      return [data.tone, data.reply_length, data.praise_level].filter(Boolean).join(' · ') || 'Style configured'
    case 'plan-dna': {
      const p = data.philosophy?.toString().replace('_', '/') ?? '—'
      return `${p} · ${data.long_session_day ?? '—'} long · ${data.quality_sessions_per_week ?? '—'} quality/wk`
    }
    default:
      return 'Data loaded'
  }
}

function moduleFields(module: string, data: Row | null): Array<[string, string]> {
  if (!data) return []
  switch (module) {
    case 'athlete':
      return [
        ['Name', fmt(data.name)],
        ['Age / Sex', [data.age, data.sex].filter(Boolean).join(' · ') || '—'],
        ['Location', fmt(data.location)],
        ['Sports', fmt(data.sports)],
        ['Experience', data.experience_years ? `${data.experience_years} years` : '—'],
        ['Coaching history', fmt(data.coaching_history)],
        ['Strengths', fmt(data.strengths)],
        ['Weaknesses', fmt(data.weaknesses)],
        ['FTP', data.ftp_watts ? `${data.ftp_override ?? data.ftp_watts}W${data.ftp_override ? ' (override)' : ''}` : '—'],
        ['Threshold pace', data.threshold_pace_per_km ? `${data.threshold_pace_override ?? data.threshold_pace_per_km}s/km` : '—'],
      ]
    case 'coach-style':
      return [
        ['Tone', fmt(data.tone)],
        ['Reply length', fmt(data.reply_length)],
        ['Praise level', fmt(data.praise_level)],
        ['Challenge mode', fmt(data.challenge_mode)],
        ['System prompt override', fmt(data.system_prompt_override)],
      ]
    case 'plan-dna':
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
    case 'fueling':
      return [
        ['Race carb / h', data.race_carb_per_hour_g ? `${data.race_carb_per_hour_g}g` : '—'],
        ['Race fluid / h', data.race_fluid_per_hour_ml ? `${data.race_fluid_per_hour_ml}ml` : '—'],
        ['Race sodium / h', data.race_sodium_per_hour_mg ? `${data.race_sodium_per_hour_mg}mg` : '—'],
        ['Training carb / h', data.training_carb_per_hour_g ? `${data.training_carb_per_hour_g}g` : '—'],
        ['Bars until (min)', fmt(data.bars_allowed_until_mins)],
        ['Caffeine strategy', fmt(data.caffeine_strategy)],
        ['Pre-race meal', fmt(data.pre_race_meal)],
        ['Pre-race timing', data.pre_race_timing_hours ? `T-${data.pre_race_timing_hours}h` : '—'],
        ['GI notes', fmt(data.gi_notes)],
        ['Heat threshold', data.heat_threshold_celsius ? `${data.heat_threshold_celsius}°C` : '—'],
      ]
    case 'health':
      return [
        ['Active injuries', fmt(data.active_injuries)],
        ['Monitoring flags', fmt(data.monitoring_flags)],
        ['Allergies', fmt(data.allergies)],
        ['Medications', fmt(data.medications)],
      ]
    case 'recovery':
      return [
        ['Sleep target', data.sleep_target_hours ? `${data.sleep_target_hours}h` : '—'],
        ['Rest days', fmt(data.preferred_rest_days)],
        ['Modalities', fmt(data.recovery_modalities)],
        ['HRV device', fmt(data.hrv_device)],
        ['HRV measurement time', fmt(data.hrv_measurement_time)],
        ['Deload frequency', data.deload_frequency_weeks ? `every ${data.deload_frequency_weeks}wk` : '—'],
        ['Deload load', data.deload_load_percent ? `${data.deload_load_percent}%` : '—'],
      ]
    default:
      return []
  }
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function ContextView({
  athleteProfile,
  coachStyle,
  planDna,
  trainingPatterns,
  adaptationRules,
  raceGoals,
  fuelingStrategy,
  healthInjury,
  recoveryPreferences,
  pendingSuggestions: initialSuggestions,
}: ContextViewProps) {
  const [activeId, setActiveId] = useState('plan-dna')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [suggestions, setSuggestions] = useState<ContextSuggestion[]>(initialSuggestions)
  const [editingSuggId, setEditingSuggId] = useState<string | null>(null)
  const [suggEditVal, setSuggEditVal] = useState('')

  const modules = [
    { id: 'athlete',     title: 'Athlete Profile',      icon: 'user',               tag: '@athlete',    data: athleteProfile,      editable: true },
    { id: 'coach-style', title: 'Coach Style',           icon: 'message-square',     tag: '@coachstyle', data: coachStyle,          editable: true },
    { id: 'plan-dna',    title: 'Plan DNA',              icon: 'git-fork',           tag: '@plandna',    data: planDna,             editable: true },
    { id: 'patterns',    title: 'Training Patterns',     icon: 'activity',           tag: '@patterns',   data: null,                editable: false },
    { id: 'rules',       title: 'Adaptation Rules',      icon: 'sliders-horizontal', tag: '@rules',      data: null,                editable: false },
    { id: 'goals',       title: 'Race Goals',            icon: 'flag',               tag: '@goals',      data: null,                editable: false },
    { id: 'fueling',     title: 'Fueling Strategy',      icon: 'utensils',           tag: '@fueling',    data: fuelingStrategy,     editable: true },
    { id: 'health',      title: 'Health & Injury Notes', icon: 'heart',              tag: '@health',     data: healthInjury,        editable: true },
    { id: 'recovery',    title: 'Recovery Preferences',  icon: 'bed',                tag: '@recovery',   data: recoveryPreferences, editable: true },
  ]

  const active = modules.find((m) => m.id === activeId) ?? modules[0]

  async function handleSave() {
    if (!active.editable || !editFields) return
    setSaving(true)
    const moduleMap: Record<string, string> = {
      'athlete': 'athlete_profile',
      'coach-style': 'coach_style',
      'plan-dna': 'plan_dna',
      'fueling': 'fueling_strategy',
      'health': 'health_injury',
      'recovery': 'recovery_preferences',
    }
    const apiModule = moduleMap[active.id]
    if (apiModule) {
      await fetch(`/api/context/${apiModule}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFields),
      })
    }
    setSaving(false)
    setEditingId(null)
    setEditFields({})
  }

  async function handleSuggestion(id: string, action: 'accept' | 'reject' | 'edit', editedValue?: string) {
    const res = await fetch(`/api/context/suggestions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, editedValue }),
    })
    if (res.ok) {
      setSuggestions((prev) => prev.filter((s) => s.id !== id))
      setEditingSuggId(null)
    }
  }

  function startEdit() {
    const fields = moduleFields(active.id, active.data)
    const init: Record<string, string> = {}
    for (const [k, v] of fields) init[k] = v === '—' ? '' : v
    setEditFields(init)
    setEditingId(active.id)
  }

  const pendingCount = (id: string) => {
    const modMap: Record<string, string> = {
      'plan-dna': 'plan_dna',
      'patterns': 'training_patterns',
      'rules': 'adaptation_rules',
      'goals': 'race_goals',
      'fueling': 'fueling_strategy',
      'health': 'health_injury',
      'recovery': 'recovery_preferences',
    }
    return suggestions.filter((s) => s.target_module === modMap[id]).length
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>Context</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>The Coach&apos;s brain</h1>
            <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 6, maxWidth: 620 }}>
              Every module here is editable. The Coach reads from these when it plans, suggests, or reasons about your training. Nothing is hidden.
            </div>
          </div>
        </div>
      </div>

      {suggestions.length > 0 && (
        <MemorySuggestions
          suggestions={suggestions}
          editingSuggId={editingSuggId}
          suggEditVal={suggEditVal}
          onEditStart={(s) => { setEditingSuggId(s.id); setSuggEditVal(s.suggested_value) }}
          onEditChange={setSuggEditVal}
          onAction={handleSuggestion}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Module list */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 6 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)', padding: '10px 10px 6px', fontFamily: 'var(--font-mono)' }}>
            Intelligence modules
          </div>
          {modules.map((m) => {
            const pc = pendingCount(m.id)
            return (
              <div
                key={m.id}
                onClick={() => setActiveId(m.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                  background: activeId === m.id ? 'var(--bg-3)' : 'transparent',
                  boxShadow: activeId === m.id ? 'inset 2px 0 0 var(--accent)' : 'none',
                }}
                onMouseEnter={(e) => { if (activeId !== m.id) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-1)' }}
                onMouseLeave={(e) => { if (activeId !== m.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <Icon name={m.icon} size={14} color={activeId === m.id ? 'var(--fg-1)' : 'var(--fg-3)'} />
                <span style={{ flex: 1, fontSize: 13, color: activeId === m.id ? 'var(--fg-1)' : 'var(--fg-2)', fontWeight: activeId === m.id ? 500 : 400 }}>
                  {m.title}
                </span>
                {pc > 0 && (
                  <span style={{ width: 16, height: 16, borderRadius: 999, background: 'var(--ai-soft)', color: 'var(--ai)', fontSize: 10, fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {pc}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Detail */}
        <ModuleDetail
          module={active}
          editing={editingId === active.id}
          editFields={editFields}
          saving={saving}
          trainingPatterns={trainingPatterns}
          adaptationRules={adaptationRules}
          raceGoals={raceGoals}
          onEdit={startEdit}
          onFieldChange={(k, v) => setEditFields((prev) => ({ ...prev, [k]: v }))}
          onSave={handleSave}
          onClose={() => { setEditingId(null); setEditFields({}) }}
        />
      </div>
    </div>
  )
}

// ── ModuleDetail ──────────────────────────────────────────────────────────────

interface ModuleDetailProps {
  module: { id: string; title: string; icon: string; tag: string; data: Row | null; editable: boolean }
  editing: boolean
  editFields: Record<string, string>
  saving: boolean
  trainingPatterns: Row[]
  adaptationRules: Row[]
  raceGoals: Row[]
  onEdit: () => void
  onFieldChange: (k: string, v: string) => void
  onSave: () => void
  onClose: () => void
}

function ModuleDetail({ module, editing, editFields, saving, trainingPatterns, adaptationRules, raceGoals, onEdit, onFieldChange, onSave, onClose }: ModuleDetailProps) {
  const fields = moduleFields(module.id, module.data)

  function renderSpecialModule() {
    if (module.id === 'patterns') {
      if (!trainingPatterns.length) return <EmptyState label="No training patterns observed yet. Patterns are detected automatically through your session reviews." />
      return (
        <div style={{ padding: '8px 0' }}>
          {trainingPatterns.map((p, i) => (
            <div key={String(p.id ?? i)} style={{ padding: '14px 24px', borderBottom: i < trainingPatterns.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: confidenceColor(String(p.confidence ?? 'low')), textTransform: 'uppercase' }}>
                  {String(p.confidence ?? 'low')}
                </span>
                <span style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
                  · {String(p.category ?? 'general')} · {String(p.sport ?? 'general')}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.5 }}>{String(p.pattern_text ?? '')}</div>
              {!!p.evidence && <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{String(p.evidence)}</div>}
            </div>
          ))}
        </div>
      )
    }
    if (module.id === 'rules') {
      if (!adaptationRules.length) return <EmptyState label="No adaptation rules set up. Add rules in Settings → Adaptation rules." />
      return (
        <div style={{ padding: '8px 0' }}>
          {adaptationRules.map((r, i) => (
            <div key={String(r.id ?? i)} style={{ padding: '14px 24px', borderBottom: i < adaptationRules.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>{String(r.name ?? '')}</span>
                <span style={{ fontSize: 11, color: r.apply_mode === 'auto_apply' ? 'var(--ai)' : 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{String(r.apply_mode ?? 'auto_propose')}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>IF {String(r.trigger_condition ?? '')} → {String(r.action ?? '')}</div>
            </div>
          ))}
        </div>
      )
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
              <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>
                {String(g.race_date ?? '')} · {String(g.distance_format ?? '')} · {String(g.sport ?? '')}
              </div>
              {!!g.notes && <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>{String(g.notes)}</div>}
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  const special = renderSpecialModule()

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Icon name={module.icon} size={16} color="var(--fg-2)" />
            <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em', margin: 0 }}>{module.title}</h2>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ai)', background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)', padding: '2px 6px', borderRadius: 4 }}>{module.tag}</span>
          </div>
          {!module.data && module.editable && (
            <div style={{ fontSize: 12, color: 'var(--fg-4)', fontStyle: 'italic' }}>Not set up yet</div>
          )}
        </div>
        {module.editable && (
          <div style={{ display: 'flex', gap: 6 }}>
            {!editing ? (
              <Button kind="secondary" size="sm" icon="pencil-line" onClick={onEdit}>Edit</Button>
            ) : (
              <>
                <Button kind="ghost" size="sm" onClick={onClose}>Cancel</Button>
                <Button kind="primary" size="sm" icon="check" onClick={onSave}>{saving ? 'Saving…' : 'Save'}</Button>
              </>
            )}
          </div>
        )}
      </div>

      {special ?? (
        <div style={{ padding: '8px 0' }}>
          {fields.length === 0 ? (
            <EmptyState label="No data yet." />
          ) : (
            fields.map(([k, v], i) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '14px 24px', borderBottom: i < fields.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'baseline' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', fontWeight: 500 }}>{k}</div>
                {editing ? (
                  <textarea
                    value={editFields[k] ?? ''}
                    onChange={(e) => onFieldChange(k, e.target.value)}
                    rows={v.length > 60 ? 2 : 1}
                    style={{ background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '8px 10px', color: 'var(--fg-1)', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, resize: 'vertical', outline: 'none' }}
                  />
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.55, whiteSpace: 'pre-wrap', fontFamily: typeof (module.data?.[k.toLowerCase().replace(/ /g, '_')] ?? null) === 'number' ? 'var(--font-mono)' : 'inherit' }}>
                    {v}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ padding: '32px 24px', textAlign: 'center', fontSize: 13, color: 'var(--fg-4)', fontStyle: 'italic' }}>
      {label}
    </div>
  )
}

function confidenceColor(c: string): string {
  if (c === 'high') return 'var(--success)'
  if (c === 'medium') return '#E8C547'
  return 'var(--fg-3)'
}

// ── MemorySuggestions ────────────────────────────────────────────────────────

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
              <textarea
                value={suggEditVal}
                onChange={(e) => onEditChange(e.target.value)}
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '8px 10px', color: 'var(--fg-1)', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, resize: 'vertical', outline: 'none', marginBottom: 8 }}
              />
            ) : (
              <div style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.5, marginBottom: 6 }}>{s.suggested_value}</div>
            )}
            {s.evidence && (
              <div style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                <Icon name="activity" size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                {s.evidence}
              </div>
            )}
            {s.reasoning && (
              <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>{s.reasoning}</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, flexDirection: 'column', alignItems: 'flex-end' }}>
            {editingSuggId === s.id ? (
              <>
                <Button kind="ai" size="sm" icon="check" onClick={() => onAction(s.id, 'edit', suggEditVal)}>Save</Button>
                <Button kind="ghost" size="sm" onClick={() => onAction(s.id, 'accept')}>Cancel</Button>
              </>
            ) : (
              <>
                <Button kind="ai" size="sm" icon="check" onClick={() => onAction(s.id, 'accept')}>Accept</Button>
                <Button kind="ghost" size="sm" icon="pencil-line" onClick={() => onEditStart(s)}>Edit</Button>
                <Button kind="ghost" size="sm" icon="x" onClick={() => onAction(s.id, 'reject')}>Reject</Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
