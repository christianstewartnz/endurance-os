'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { SessionNoteRow } from '@/lib/intervals/types'

export interface ContextTag {
  tag: string
  label: string
  description: string
  icon: string
  group: 'context' | 'today' | 'sessions' | 'races'
}

export interface Message {
  id: string
  role: 'system' | 'ai' | 'user'
  content: string
  modulesRead?: string[]
}

export interface ResumedConversation {
  id: string
  title: string | null
  updated_at: string
}

export interface PendingReviewRequest {
  message: string
  contextType: 'session_review'
  sessionId: string
}

interface CoachContextType {
  messages: Message[]
  setMessages: Dispatch<SetStateAction<Message[]>>
  conversationId: string
  setConversationId: (id: string) => void
  conversationTitle: string | null
  setConversationTitle: (t: string | null) => void
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  startNewConversation: () => void
  activeThread: string | null
  setActiveThread: (id: string | null) => void
  resumedConversation: ResumedConversation | null
  setResumedConversation: (c: ResumedConversation | null) => void
  pendingRequest: PendingReviewRequest | null
  setPendingRequest: (r: PendingReviewRequest | null) => void
  startSessionReview: (session: SessionNoteRow) => void
  hasApiKey: boolean | null
  availableTags: ContextTag[]
}

function fmtDuration(secs: number | null): string {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min`
}

const CoachContext = createContext<CoachContextType | null>(null)

export function CoachProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID())
  const [conversationTitle, setConversationTitle] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(true)
  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [resumedConversation, setResumedConversation] = useState<ResumedConversation | null>(null)
  const [pendingRequest, setPendingRequest] = useState<PendingReviewRequest | null>(null)
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [availableTags, setAvailableTags] = useState<ContextTag[]>([])

  useEffect(() => {
    fetch('/api/keys/anthropic')
      .then((r) => r.json())
      .then((d) => setHasApiKey((d as { connected: boolean }).connected))
      .catch(() => setHasApiKey(false))
  }, [])

  useEffect(() => {
    fetch('/api/coach/context-tags')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.tags) setAvailableTags(d.tags) })
      .catch(() => {})
  }, [])

  const startNewConversation = useCallback(() => {
    setMessages([])
    setConversationId(crypto.randomUUID())
    setConversationTitle(null)
    setActiveThread(null)
    setResumedConversation(null)
  }, [])

  const startSessionReview = useCallback((session: SessionNoteRow) => {
    startNewConversation()
    setIsOpen(true)
    const name = session.activity_name || session.session_type || 'session'
    const dur = fmtDuration(session.actual_duration_seconds)
    const tss = session.actual_tss != null ? `${Math.round(session.actual_tss)} TSS` : null
    const parts = [name, dur, tss].filter(Boolean).join(' · ')
    const message = `Please review my session from today — ${parts}. Check my readiness data and give me your assessment.`
    setPendingRequest({ message, contextType: 'session_review', sessionId: session.session_id })
  }, [startNewConversation])

  return (
    <CoachContext.Provider value={{
      messages, setMessages,
      conversationId, setConversationId,
      conversationTitle, setConversationTitle,
      isOpen, setIsOpen,
      startNewConversation,
      activeThread, setActiveThread,
      resumedConversation, setResumedConversation,
      pendingRequest, setPendingRequest,
      startSessionReview,
      hasApiKey,
      availableTags,
    }}>
      {children}
    </CoachContext.Provider>
  )
}

export function useCoach(): CoachContextType {
  const ctx = useContext(CoachContext)
  if (!ctx) throw new Error('useCoach must be used inside CoachProvider')
  return ctx
}
