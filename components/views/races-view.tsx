'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Icon, Button } from '@/components/atoms'
import { useCoach } from '@/lib/context/coach-context'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NoteItem {
  id: string
  category: string
  note: string
  added_at: string
  source: 'user' | 'ai_suggestion'
}

export interface PerLegTarget {
  time_seconds?: number
  power_watts?: number
  pace_per_km_seconds?: number
  notes?: string
}

export interface RaceGoal {
  id: string
  race_name: string
  race_date: string
  location: string | null
  sport: string | null
  distance_format: string | null
  priority: 'A' | 'B' | 'C'
  status: 'upcoming' | 'completed'
  overall_goal_time_seconds: number | null
  overall_goal_position: string | null
  stretch_goal: string | null
  per_leg_targets: Record<string, PerLegTarget> | null
  pacing_notes: NoteItem[] | null
  fueling_notes: NoteItem[] | null
  equipment_notes: NoteItem[] | null
  general_notes: string | null
}

export interface ContextSuggestion {
  id: string
  target_module: string
  target_field: string | null
  target_record_id?: string | null
  action_type: string
  suggested_value: string
  reasoning: string
  evidence: string | null
  created_at: string
}

interface RacesViewProps {
  upcoming: RaceGoal[]
  past: RaceGoal[]
  aRace: RaceGoal | null
  pendingSuggestions: ContextSuggestion[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDateLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((parseDateLocal(dateStr).getTime() - today.getTime()) / 86400000)
}

function formatRaceDate(dateStr: string): string {
  return parseDateLocal(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function formatTime(seconds: number): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatPacePerKm(secsPerKm: number): string {
  const m = Math.floor(secsPerKm / 60)
  const s = Math.round(secsPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

const TIER_COLOR: Record<string, string> = {
  A: 'var(--accent)', B: 'var(--ai)', C: 'var(--fg-3)',
}
const TIER_BG: Record<string, string> = {
  A: 'var(--accent-soft)', B: 'var(--ai-soft)', C: 'var(--bg-3)',
}

const LEG_DISTANCES: Record<string, Record<string, string>> = {
  '70.3':    { swim: '1.9 km', bike: '90 km',  run: '21.1 km' },
  'ironman': { swim: '3.8 km', bike: '180 km', run: '42.2 km' },
  'olympic': { swim: '1.5 km', bike: '40 km',  run: '10 km'   },
  'sprint':  { swim: '750 m',  bike: '20 km',  run: '5 km'    },
}

function getLegDistances(distanceFormat: string | null): Record<string, string> {
  if (!distanceFormat) return {}
  return LEG_DISTANCES[distanceFormat.toLowerCase()] ?? {}
}

function secondsToTimeStr(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function timeStrToSeconds(t: string): number | null {
  if (!t) return null
  const parts = t.split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60
  return null
}

function goalDisplay(race: RaceGoal): string {
  const parts = [
    race.overall_goal_time_seconds ? secondsToTimeStr(race.overall_goal_time_seconds) : null,
    race.overall_goal_position,
  ].filter(Boolean)
  return parts.join(' · ')
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function RacesView({ upcoming, past, aRace, pendingSuggestions }: RacesViewProps) {
  const router = useRouter()
  const [localUpcoming, setLocalUpcoming] = useState(upcoming)
  const [localPast]     = useState(past)
  const [selectedRace, setSelectedRace] = useState<RaceGoal | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPast, setShowPast] = useState(false)

  const primaryARace = localUpcoming.find((r) => r.priority === 'A') ?? aRace
  const supporting   = localUpcoming.filter((r) => r.priority !== 'A')
  const aCount = localUpcoming.filter((r) => r.priority === 'A').length
  const bCount = localUpcoming.filter((r) => r.priority !== 'A').length

  function handleRaceUpdate(updated: RaceGoal) {
    setLocalUpcoming((prev) => prev.map((r) => r.id === updated.id ? updated : r))
    setSelectedRace(updated)
  }

  function handleRaceAdded() {
    setShowAddModal(false)
    router.refresh()
  }

  const title    = primaryARace ? `The road to ${primaryARace.race_name}` : 'Your 2026 season'
  const subtitle = `${aCount} A-race · ${bCount} supporting ${bCount === 1 ? 'race' : 'races'} · everything else is training.`

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
              Races · 2026 season
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>{title}</h1>
            <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 6 }}>{subtitle}</div>
          </div>
          <Button kind="secondary" size="md" icon="plus" onClick={() => setShowAddModal(true)}>
            Add race
          </Button>
        </div>

        {/* A-race card */}
        {primaryARace ? (
          <RaceCard
            race={primaryARace}
            primary
            onClick={() => setSelectedRace(primaryARace)}
          />
        ) : (
          <EmptyARace onAdd={() => setShowAddModal(true)} />
        )}

        {/* B/C race cards */}
        {supporting.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {supporting.map((r) => (
              <RaceCard key={r.id} race={r} onClick={() => setSelectedRace(r)} />
            ))}
          </div>
        )}

        {/* Past races */}
        {localPast.length > 0 && (
          <div>
            <button
              onClick={() => setShowPast((p) => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: 'var(--fg-3)', padding: '4px 0',
              }}
            >
              <Icon name="chevron-right" size={14} color="var(--fg-3)" style={{ transform: showPast ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} />
              Past races ({localPast.length})
            </button>
            {showPast && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                {localPast.map((r) => (
                  <RaceCard key={r.id} race={r} muted onClick={() => setSelectedRace(r)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Race detail modal */}
      {selectedRace && (
        <RaceDetailModal
          race={selectedRace}
          pendingSuggestions={pendingSuggestions.filter((s) => s.target_record_id === selectedRace.id)}
          onClose={() => setSelectedRace(null)}
          onUpdate={handleRaceUpdate}
        />
      )}

      {/* Add race modal */}
      {showAddModal && (
        <AddRaceModal
          onClose={() => setShowAddModal(false)}
          onSaved={handleRaceAdded}
        />
      )}
    </>
  )
}

// ── Race card ─────────────────────────────────────────────────────────────────

function RaceCard({
  race, primary, muted, onClick,
}: {
  race: RaceGoal
  primary?: boolean
  muted?: boolean
  onClick: () => void
}) {
  const color = TIER_COLOR[race.priority] ?? 'var(--fg-3)'
  const bg    = TIER_BG[race.priority]   ?? 'var(--bg-3)'
  const days  = daysUntil(race.race_date)
  const isPast = days < 0
  const legDists = getLegDistances(race.distance_format)

  const legs: [string, string][] = []
  if (race.per_leg_targets) {
    for (const leg of ['swim', 'bike', 'run']) {
      const t = race.per_leg_targets[leg]
      if (t?.time_seconds) {
        const dist = legDists[leg] ? `${leg.charAt(0).toUpperCase() + leg.slice(1)} · ${legDists[leg]}` : leg.charAt(0).toUpperCase() + leg.slice(1)
        legs.push([dist, formatTime(t.time_seconds)])
      }
    }
  }

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        padding: primary ? 24 : 20,
        borderLeft: `2px solid ${color}`,
        cursor: 'pointer',
        opacity: muted ? 0.7 : 1,
        transition: 'background var(--dur-micro) var(--ease-out)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-3)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-2)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color, border: `1px solid ${color}55`, padding: '2px 6px', borderRadius: 3, background: bg }}>
              {race.priority}-RACE
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
              {formatRaceDate(race.race_date)}{race.location ? ` · ${race.location}` : ''}
            </span>
          </div>
          <div style={{ fontSize: primary ? 22 : 18, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--fg-1)' }}>
            {race.race_name}
          </div>
          {goalDisplay(race) && (
            <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 4 }}>{goalDisplay(race)}</div>
          )}
          {legs.length > 0 && (
            <div style={{ display: 'flex', gap: 28, marginTop: 18 }}>
              {legs.map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>{k}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--fg-1)', marginTop: 4 }}>{v}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: primary ? 32 : 22, fontWeight: 500, color: isPast ? 'var(--fg-3)' : color, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {isPast ? Math.abs(days) : days}
          </div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginTop: 4 }}>
            {isPast ? 'days ago' : 'to go'}
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyARace({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        background: 'var(--bg-2)', border: '1px dashed var(--border-default)',
        borderRadius: 10, padding: 32, textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 12 }}>No A-race set for this season</div>
      <Button kind="secondary" size="md" icon="plus" onClick={onAdd}>Add A-race</Button>
    </div>
  )
}

// ── Race detail modal ─────────────────────────────────────────────────────────

type ModalTab = 'overview' | 'pacing' | 'fueling' | 'equipment'

function RaceDetailModal({
  race: initialRace,
  pendingSuggestions,
  onClose,
  onUpdate,
}: {
  race: RaceGoal
  pendingSuggestions: ContextSuggestion[]
  onClose: () => void
  onUpdate: (r: RaceGoal) => void
}) {
  const [race, setRace] = useState(initialRace)
  const [tab, setTab] = useState<ModalTab>('overview')
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({
    race_name: race.race_name,
    race_date: race.race_date,
    location: race.location ?? '',
    overall_goal_time_str: race.overall_goal_time_seconds
      ? secondsToTimeStr(race.overall_goal_time_seconds)
      : '',
    overall_goal_position: race.overall_goal_position ?? '',
    stretch_goal: race.stretch_goal ?? '',
    general_notes: race.general_notes ?? '',
    status: race.status,
  })
  const [saving, setSaving] = useState(false)
  const [localSuggestions, setLocalSuggestions] = useState(pendingSuggestions)
  const { setIsOpen, startNewConversation, setMessages } = useCoach()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const days = daysUntil(race.race_date)
  const isPast = days < 0
  const color = TIER_COLOR[race.priority] ?? 'var(--fg-3)'
  const bg    = TIER_BG[race.priority]   ?? 'var(--bg-3)'

  function openCoachForRace(topic?: string) {
    startNewConversation()
    if (topic) {
      setMessages([{
        id: crypto.randomUUID(),
        role: 'user',
        content: `Let's discuss ${topic} for ${race.race_name} on ${formatRaceDate(race.race_date)}.`,
      }])
    }
    setIsOpen(true)
    onClose()
  }

  async function saveEdit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/races/${race.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        const { data } = await res.json()
        const updated = { ...race, ...data }
        setRace(updated)
        onUpdate(updated)
        setEditMode(false)
      }
    } finally {
      setSaving(false)
    }
  }

  function handleNotesUpdate(field: 'pacing_notes' | 'fueling_notes' | 'equipment_notes', notes: NoteItem[]) {
    const updated = { ...race, [field]: notes }
    setRace(updated)
    onUpdate(updated)
  }

  function handleSuggestionResolved(suggestionId: string) {
    setLocalSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
  }

  const TABS: { id: ModalTab; label: string }[] = [
    { id: 'overview',   label: 'Overview'  },
    { id: 'pacing',     label: 'Pacing'    },
    { id: 'fueling',    label: 'Fueling'   },
    { id: 'equipment',  label: 'Equipment' },
  ]

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 24,
        animation: 'fadeIn 150ms ease-out',
      }}
    >
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }`}</style>
      <div style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        width: '100%', maxWidth: 860,
        maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Modal header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
            {/* Left */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color, border: `1px solid ${color}55`, padding: '2px 6px', borderRadius: 3, background: bg }}>
                  {race.priority}-RACE
                </span>
                {race.distance_format && (
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{race.distance_format}</span>
                )}
              </div>
              {editMode ? (
                <input
                  value={editForm.race_name}
                  onChange={(e) => { const v = e.target.value; setEditForm((f) => ({ ...f, race_name: v })) }}
                  style={{ fontSize: 22, fontWeight: 600, background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '4px 8px', color: 'var(--fg-1)', width: '100%', marginBottom: 6 }}
                />
              ) : (
                <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--fg-1)', marginBottom: 4 }}>
                  {race.race_name}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                {formatRaceDate(race.race_date)}{race.location ? ` · ${race.location}` : ''}{race.sport ? ` · ${race.sport}` : ''}
              </div>
              {goalDisplay(race) && (
                <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>{goalDisplay(race)}</div>
              )}
              <div style={{ marginTop: 6 }}>
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                  color: isPast ? 'var(--fg-3)' : color,
                }}>
                  {isPast ? `Completed ${Math.abs(days)} days ago` : `${days} days to go`}
                </span>
              </div>
            </div>
            {/* Right */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Button kind="ai" size="sm" icon="sparkles" onClick={() => openCoachForRace('race planning')}>
                Discuss with Coach
              </Button>
              {editMode ? (
                <>
                  <Button kind="primary" size="sm" onClick={saveEdit} disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                  <Button kind="ghost" size="sm" onClick={() => setEditMode(false)}>Cancel</Button>
                </>
              ) : (
                <Button kind="ghost" size="sm" icon="pencil-line" onClick={() => setEditMode(true)}>
                  Edit race
                </Button>
              )}
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--fg-3)', display: 'flex' }}
              >
                <Icon name="x" size={18} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '10px 16px', fontSize: 13,
                  color: tab === t.id ? 'var(--fg-1)' : 'var(--fg-3)',
                  fontWeight: tab === t.id ? 500 : 400,
                  borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'color var(--dur-micro)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal body — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {tab === 'overview' && (
            <OverviewTab
              race={race}
              editMode={editMode}
              editForm={editForm}
              setEditForm={setEditForm}
              suggestions={localSuggestions.filter((s) => !s.target_field || !['pacing_notes','fueling_notes','equipment_notes'].includes(s.target_field))}
              onSuggestionResolved={handleSuggestionResolved}
            />
          )}
          {tab === 'pacing' && (
            <NotesTab
              race={race}
              field="pacing_notes"
              categories={['swim','bike','run','transition','mental','general']}
              suggestions={localSuggestions.filter((s) => s.target_field === 'pacing_notes')}
              onUpdate={(notes) => handleNotesUpdate('pacing_notes', notes)}
              onSuggestionResolved={handleSuggestionResolved}
              onAskCoach={() => openCoachForRace('pacing strategy')}
            />
          )}
          {tab === 'fueling' && (
            <NotesTab
              race={race}
              field="fueling_notes"
              categories={['pre_race','bike','run','caffeine','hydration','general']}
              suggestions={localSuggestions.filter((s) => s.target_field === 'fueling_notes')}
              onUpdate={(notes) => handleNotesUpdate('fueling_notes', notes)}
              onSuggestionResolved={handleSuggestionResolved}
              onAskCoach={() => openCoachForRace('fueling strategy')}
            />
          )}
          {tab === 'equipment' && (
            <NotesTab
              race={race}
              field="equipment_notes"
              categories={['bike','wheels','helmet','wetsuit','shoes','tri_suit','general']}
              suggestions={localSuggestions.filter((s) => s.target_field === 'equipment_notes')}
              onUpdate={(notes) => handleNotesUpdate('equipment_notes', notes)}
              onSuggestionResolved={handleSuggestionResolved}
              onAskCoach={() => openCoachForRace('equipment')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────

interface EditForm {
  race_name: string
  race_date: string
  location: string
  overall_goal_time_str: string
  overall_goal_position: string
  stretch_goal: string
  general_notes: string
  status: 'upcoming' | 'completed'
}

function OverviewTab({
  race, editMode, editForm, setEditForm, suggestions, onSuggestionResolved,
}: {
  race: RaceGoal
  editMode: boolean
  editForm: EditForm
  setEditForm: React.Dispatch<React.SetStateAction<EditForm>>
  suggestions: ContextSuggestion[]
  onSuggestionResolved: (id: string) => void
}) {
  const legDists = getLegDistances(race.distance_format)

  const grid: [string, React.ReactNode][] = [
    ['Date',         editMode ? <input value={editForm.race_date} onChange={(e) => { const v = e.target.value; setEditForm((f) => ({ ...f, race_date: v })) }} type="date" style={inputStyle} /> : formatRaceDate(race.race_date)],
    ['Location',     editMode ? <input value={editForm.location} onChange={(e) => { const v = e.target.value; setEditForm((f) => ({ ...f, location: v })) }} style={inputStyle} /> : (race.location ?? '—')],
    ['Distance',     race.distance_format ?? '—'],
    ['Sport',        race.sport ?? '—'],
    ['Priority',     `${race.priority}-race`],
    ['Status',       race.status],
    ['Goal time',    editMode ? <input value={editForm.overall_goal_time_str} onChange={(e) => { const v = e.target.value; setEditForm((f) => ({ ...f, overall_goal_time_str: v })) }} style={inputStyle} placeholder="h:mm:ss" /> : (race.overall_goal_time_seconds ? secondsToTimeStr(race.overall_goal_time_seconds) : '—')],
    ['Goal position', editMode ? <input value={editForm.overall_goal_position} onChange={(e) => { const v = e.target.value; setEditForm((f) => ({ ...f, overall_goal_position: v })) }} style={inputStyle} placeholder="e.g. Top 5 AG" /> : (race.overall_goal_position ?? '—')],
    ['Stretch goal', editMode ? <input value={editForm.stretch_goal} onChange={(e) => { const v = e.target.value; setEditForm((f) => ({ ...f, stretch_goal: v })) }} style={inputStyle} /> : (race.stretch_goal ?? '—')],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* AI suggestions */}
      {suggestions.map((s) => (
        <SuggestionCard
          key={s.id}
          suggestion={s}
          race={race}
          onResolved={onSuggestionResolved}
        />
      ))}

      {/* Details grid */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 12 }}>Race details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', background: 'var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
          {grid.map(([label, value]) => (
            <div key={label} style={{ background: 'var(--bg-2)', padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, color: 'var(--fg-1)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Leg targets */}
      {race.per_leg_targets && Object.keys(race.per_leg_targets).length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 12 }}>Leg targets</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['swim','bike','run'] as const).map((leg) => {
              const t = race.per_leg_targets![leg]
              if (!t) return null
              const parts: string[] = []
              if (t.time_seconds) parts.push(formatTime(t.time_seconds))
              if (t.power_watts)  parts.push(`@ ${t.power_watts}W`)
              if (t.pace_per_km_seconds) parts.push(`@ ${formatPacePerKm(t.pace_per_km_seconds)}`)
              if (t.notes) parts.push(`— ${t.notes}`)
              const dist = legDists[leg]
              return (
                <div key={leg} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12, alignItems: 'baseline', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>
                    {leg.charAt(0).toUpperCase() + leg.slice(1)}{dist ? ` · ${dist}` : ''}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>{parts.join(' ') || '—'}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* General notes */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 8 }}>Notes</div>
        {editMode ? (
          <textarea
            value={editForm.general_notes}
            onChange={(e) => { const v = e.target.value; setEditForm((f) => ({ ...f, general_notes: v })) }}
            rows={4}
            style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
          />
        ) : (
          <div style={{ fontSize: 13, color: race.general_notes ? 'var(--fg-1)' : 'var(--fg-4)', lineHeight: 1.6 }}>
            {race.general_notes || 'No notes yet.'}
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--border-default)',
  borderRadius: 6,
  padding: '5px 8px',
  fontSize: 13,
  color: 'var(--fg-1)',
  width: '100%',
  outline: 'none',
}

// ── Notes tab ─────────────────────────────────────────────────────────────────

function NotesTab({
  race, field, categories, suggestions, onUpdate, onSuggestionResolved, onAskCoach,
}: {
  race: RaceGoal
  field: 'pacing_notes' | 'fueling_notes' | 'equipment_notes'
  categories: string[]
  suggestions: ContextSuggestion[]
  onUpdate: (notes: NoteItem[]) => void
  onSuggestionResolved: (id: string) => void
  onAskCoach: () => void
}) {
  const [localNotes, setLocalNotes] = useState<NoteItem[]>(() => race[field] ?? [])
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [newNoteText, setNewNoteText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Derive the field label for coach button
  const fieldLabel = field === 'pacing_notes' ? 'pacing' : field === 'fueling_notes' ? 'fueling' : 'equipment'

  function categoryLabel(cat: string): string {
    return cat.replace(/_/g, ' ').toUpperCase()
  }

  async function saveNotes(notes: NoteItem[]) {
    setLocalNotes(notes)
    onUpdate(notes)
    // Save in background — revert handled by onUpdate being optimistic
    try {
      await fetch(`/api/races/${race.id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, notes }),
      })
    } catch {
      // Optimistic — silently fail; user can retry
    }
  }

  function addNote(category: string) {
    if (!newNoteText.trim()) { setAddingFor(null); return }
    const note: NoteItem = {
      id: crypto.randomUUID(),
      category,
      note: newNoteText.trim(),
      added_at: new Date().toISOString().split('T')[0],
      source: 'user',
    }
    saveNotes([...localNotes, note])
    setNewNoteText('')
    setAddingFor(null)
  }

  function removeNote(id: string) {
    saveNotes(localNotes.filter((n) => n.id !== id))
  }

  function saveEdit(id: string) {
    saveNotes(localNotes.map((n) => n.id === id ? { ...n, note: editingText.trim() } : n))
    setEditingId(null)
  }

  async function acceptSuggestion(suggestion: ContextSuggestion) {
    const note: NoteItem = {
      id: crypto.randomUUID(),
      category: 'general',
      note: suggestion.suggested_value,
      added_at: new Date().toISOString().split('T')[0],
      source: 'ai_suggestion',
    }
    await saveNotes([...localNotes, note])
    // Mark suggestion resolved
    await fetch(`/api/context/suggestions/${suggestion.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' }),
    })
    onSuggestionResolved(suggestion.id)
  }

  async function rejectSuggestion(suggestion: ContextSuggestion) {
    await fetch(`/api/context/suggestions/${suggestion.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    })
    onSuggestionResolved(suggestion.id)
  }

  useEffect(() => {
    if (addingFor && inputRef.current) inputRef.current.focus()
  }, [addingFor])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* AI suggestions */}
      {suggestions.map((s) => (
        <div key={s.id} style={{ background: 'var(--ai-soft)', border: '1px solid var(--ai)44', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Icon name="sparkles" size={13} color="var(--ai)" />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ai)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Coach suggestion → {fieldLabel.charAt(0).toUpperCase() + fieldLabel.slice(1)}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-1)', marginBottom: 6, lineHeight: 1.5 }}>
            &ldquo;{s.suggested_value}&rdquo;
          </div>
          {s.reasoning && (
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 12 }}>
              Because: {s.reasoning}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button kind="primary" size="sm" icon="check" onClick={() => acceptSuggestion(s)}>Accept</Button>
            <Button kind="ghost" size="sm" icon="x" onClick={() => rejectSuggestion(s)}>Reject</Button>
          </div>
        </div>
      ))}

      {/* Notes by category */}
      {categories.map((cat) => {
        const catNotes = localNotes.filter((n) => n.category === cat)
        const isAdding = addingFor === cat
        if (catNotes.length === 0 && !isAdding) return (
          <div key={cat}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>
                {categoryLabel(cat)}
              </span>
              <button
                onClick={() => { setAddingFor(cat); setNewNoteText('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Icon name="plus" size={12} /> Add note
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-4)', fontStyle: 'italic' }}>No notes yet.</div>
          </div>
        )
        return (
          <div key={cat}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>
                {categoryLabel(cat)}
              </span>
              {!isAdding && (
                <button
                  onClick={() => { setAddingFor(cat); setNewNoteText('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Icon name="plus" size={12} /> Add note
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {catNotes.map((n) => (
                <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--fg-3)', marginTop: 2, flexShrink: 0 }}>•</span>
                  <div style={{ flex: 1 }}>
                    {editingId === n.id ? (
                      <input
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(n.id); if (e.key === 'Escape') setEditingId(null) }}
                        onBlur={() => saveEdit(n.id)}
                        autoFocus
                        style={{ ...inputStyle, width: '100%' }}
                      />
                    ) : (
                      <span
                        onClick={() => { setEditingId(n.id); setEditingText(n.note) }}
                        style={{ fontSize: 13, color: 'var(--fg-1)', cursor: 'text', lineHeight: 1.5 }}
                      >
                        {n.note}
                        {n.source === 'ai_suggestion' && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--ai)', fontFamily: 'var(--font-mono)' }}>✦ ai</span>
                        )}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeNote(n.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-4)', padding: 2, flexShrink: 0 }}
                  >
                    <Icon name="x" size={12} />
                  </button>
                </div>
              ))}
              {isAdding && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4 }}>
                  <input
                    ref={inputRef}
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addNote(cat); if (e.key === 'Escape') setAddingFor(null) }}
                    placeholder="Type note and press Enter…"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={() => addNote(cat)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)' }}>
                    <Icon name="check" size={16} />
                  </button>
                  <button onClick={() => setAddingFor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)' }}>
                    <Icon name="x" size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Ask Coach */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
        <Button kind="ai" size="sm" icon="sparkles" onClick={onAskCoach}>
          Ask Coach about {fieldLabel}
        </Button>
      </div>
    </div>
  )
}

// ── Suggestion card (overview tab) ────────────────────────────────────────────

function SuggestionCard({
  suggestion, race, onResolved,
}: {
  suggestion: ContextSuggestion
  race: RaceGoal
  onResolved: (id: string) => void
}) {
  const [editValue, setEditValue] = useState(suggestion.suggested_value)
  const [editMode, setEditMode] = useState(false)

  async function handle(action: 'accept' | 'reject' | 'edit') {
    await fetch(`/api/context/suggestions/${suggestion.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, editedValue: action === 'edit' ? editValue : undefined }),
    })
    if (action !== 'reject') {
      // For race_goals updates, apply to the race field
      if (suggestion.target_field && suggestion.action_type === 'update_field') {
        await fetch(`/api/races/${race.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [suggestion.target_field]: action === 'edit' ? editValue : suggestion.suggested_value }),
        })
      }
    }
    onResolved(suggestion.id)
  }

  return (
    <div style={{ background: 'var(--ai-soft)', border: '1px solid var(--ai)44', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Icon name="sparkles" size={13} color="var(--ai)" />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ai)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Coach suggestion{suggestion.target_field ? ` → ${suggestion.target_field.replace(/_/g, ' ')}` : ''}
        </span>
      </div>
      {editMode ? (
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          rows={3}
          style={{ ...inputStyle, width: '100%', marginBottom: 8, fontFamily: 'inherit', resize: 'vertical' }}
        />
      ) : (
        <div style={{ fontSize: 13, color: 'var(--fg-1)', marginBottom: 6, lineHeight: 1.5 }}>
          &ldquo;{suggestion.suggested_value}&rdquo;
        </div>
      )}
      {suggestion.reasoning && (
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 12 }}>
          Because: {suggestion.reasoning}
          {suggestion.evidence && ` — ${suggestion.evidence}`}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        {editMode ? (
          <Button kind="primary" size="sm" icon="check" onClick={() => handle('edit')}>Save edit</Button>
        ) : (
          <Button kind="primary" size="sm" icon="check" onClick={() => handle('accept')}>Accept</Button>
        )}
        <Button kind="ghost" size="sm" icon="pencil-line" onClick={() => setEditMode((m) => !m)}>
          {editMode ? 'Cancel' : 'Edit'}
        </Button>
        <Button kind="ghost" size="sm" icon="x" onClick={() => handle('reject')}>Reject</Button>
      </div>
    </div>
  )
}

// ── Add race modal ────────────────────────────────────────────────────────────

const SPORTS = ['Triathlon', 'Cycling', 'Running', 'Swimming']

const DISTANCE_BY_SPORT: Record<string, string[]> = {
  Triathlon: ['Sprint', 'Olympic', '70.3', 'Ironman'],
  Running:   ['5k', '10k', 'Half marathon', 'Marathon', 'Ultra'],
  Cycling:   ['Gran fondo', 'Stage race', 'TT', 'Custom'],
  Swimming:  ['1.5km', '5km', '10km', 'Custom'],
}

const LEG_SPORTS = new Set(['Triathlon'])

function AddRaceModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    race_name: '', race_date: '', location: '',
    sport: 'Triathlon', distance_format: '',
    priority: 'B' as 'A' | 'B' | 'C',
    goal_time: '', goal_position: '', general_notes: '',
  })
  const [legs, setLegs] = useState({
    swim_time: '', bike_time: '', bike_power: '', run_time: '', run_pace: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function parseTimeToSeconds(t: string): number | null {
    if (!t) return null
    const parts = t.split(':').map(Number)
    if (parts.some(isNaN)) return null
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.race_name.trim() || !form.race_date) { setError('Race name and date are required'); return }
    setSaving(true)
    setError(null)

    const per_leg_targets: Record<string, PerLegTarget> = {}
    if (LEG_SPORTS.has(form.sport)) {
      const swimSecs = parseTimeToSeconds(legs.swim_time)
      if (swimSecs) per_leg_targets.swim = { time_seconds: swimSecs }
      const bikeSecs = parseTimeToSeconds(legs.bike_time)
      const bikePow  = legs.bike_power ? Number(legs.bike_power) : null
      if (bikeSecs || bikePow) per_leg_targets.bike = { time_seconds: bikeSecs ?? undefined, power_watts: bikePow ?? undefined }
      const runSecs  = parseTimeToSeconds(legs.run_time)
      const runPace  = legs.run_pace ? Number(legs.run_pace) : null
      if (runSecs || runPace) per_leg_targets.run = { time_seconds: runSecs ?? undefined, pace_per_km_seconds: runPace ?? undefined }
    }

    try {
      const res = await fetch('/api/races', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          race_name: form.race_name,
          race_date: form.race_date,
          location: form.location,
          sport: form.sport,
          distance_format: form.distance_format,
          priority: form.priority,
          overall_goal_time_str: form.goal_time,
          overall_goal_position: form.goal_position,
          general_notes: form.general_notes,
          per_leg_targets: Object.keys(per_leg_targets).length ? per_leg_targets : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to save'); return }
      onSaved()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const distances = DISTANCE_BY_SPORT[form.sport] ?? []
  const showLegs  = LEG_SPORTS.has(form.sport)

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 24,
        animation: 'fadeIn 150ms ease-out',
      }}
    >
      <div style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        width: '100%', maxWidth: 600,
        maxHeight: '90vh', overflowY: 'auto',
        padding: 28,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Add a race</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)' }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Race name *">
            <input
              value={form.race_name}
              onChange={(e) => setForm((f) => ({ ...f, race_name: e.target.value }))}
              placeholder="e.g. Ironman 70.3 Lahti"
              style={inputStyle}
              required
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Date *">
              <input
                type="date"
                value={form.race_date}
                onChange={(e) => setForm((f) => ({ ...f, race_date: e.target.value }))}
                style={inputStyle}
                required
              />
            </Field>
            <Field label="Location">
              <input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Lahti, Finland"
                style={inputStyle}
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Sport">
              <select
                value={form.sport}
                onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value, distance_format: '' }))}
                style={inputStyle}
              >
                {SPORTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Distance / format">
              <select
                value={form.distance_format}
                onChange={(e) => setForm((f) => ({ ...f, distance_format: e.target.value }))}
                style={inputStyle}
              >
                <option value="">Select…</option>
                {distances.map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Priority">
            <div style={{ display: 'flex', gap: 8 }}>
              {(['A','B','C'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, priority: p }))}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 6,
                    border: `1px solid ${form.priority === p ? TIER_COLOR[p] : 'var(--border-default)'}`,
                    background: form.priority === p ? TIER_BG[p] : 'var(--bg-2)',
                    color: form.priority === p ? TIER_COLOR[p] : 'var(--fg-2)',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Goal time (h:mm:ss)">
              <input
                value={form.goal_time}
                onChange={(e) => setForm((f) => ({ ...f, goal_time: e.target.value }))}
                placeholder="4:55:00"
                style={inputStyle}
              />
            </Field>
            <Field label="Goal position">
              <input
                value={form.goal_position}
                onChange={(e) => setForm((f) => ({ ...f, goal_position: e.target.value }))}
                placeholder="e.g. Top 5 AG"
                style={inputStyle}
              />
            </Field>
          </div>

          {showLegs && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 12 }}>Leg targets</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Swim target (hh:mm:ss)">
                  <input value={legs.swim_time} onChange={(e) => setLegs((l) => ({ ...l, swim_time: e.target.value }))} placeholder="00:32:00" style={inputStyle} />
                </Field>
                <Field label="Bike target (h:mm:ss)">
                  <input value={legs.bike_time} onChange={(e) => setLegs((l) => ({ ...l, bike_time: e.target.value }))} placeholder="2:38:00" style={inputStyle} />
                </Field>
                <Field label="Bike power (W)">
                  <input type="number" value={legs.bike_power} onChange={(e) => setLegs((l) => ({ ...l, bike_power: e.target.value }))} placeholder="210" style={inputStyle} />
                </Field>
                <Field label="Run target (h:mm:ss)">
                  <input value={legs.run_time} onChange={(e) => setLegs((l) => ({ ...l, run_time: e.target.value }))} placeholder="1:35:00" style={inputStyle} />
                </Field>
                <Field label="Run pace (sec/km)">
                  <input type="number" value={legs.run_pace} onChange={(e) => setLegs((l) => ({ ...l, run_pace: e.target.value }))} placeholder="270" style={inputStyle} />
                </Field>
              </div>
            </div>
          )}

          <Field label="Notes">
            <textarea
              value={form.general_notes}
              onChange={(e) => setForm((f) => ({ ...f, general_notes: e.target.value }))}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Field>

          {error && (
            <div style={{ fontSize: 13, color: 'var(--error, #f87171)', padding: '8px 12px', background: 'rgba(248,113,113,0.1)', borderRadius: 6 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <Button kind="ghost" size="md" onClick={onClose} type="button">Cancel</Button>
            <Button kind="primary" size="md" type="submit" disabled={saving}>
              {saving ? 'Adding…' : 'Add race'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}
