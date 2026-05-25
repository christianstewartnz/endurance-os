'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'

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
}

const CoachContext = createContext<CoachContextType | null>(null)

export function CoachProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID())
  const [conversationTitle, setConversationTitle] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(true)
  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [resumedConversation, setResumedConversation] = useState<ResumedConversation | null>(null)

  const startNewConversation = useCallback(() => {
    setMessages([])
    setConversationId(crypto.randomUUID())
    setConversationTitle(null)
    setActiveThread(null)
    setResumedConversation(null)
  }, [])

  return (
    <CoachContext.Provider value={{
      messages, setMessages,
      conversationId, setConversationId,
      conversationTitle, setConversationTitle,
      isOpen, setIsOpen,
      startNewConversation,
      activeThread, setActiveThread,
      resumedConversation, setResumedConversation,
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
