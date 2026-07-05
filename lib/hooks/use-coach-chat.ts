'use client'

import { useState, useRef, useCallback } from 'react'

export interface FuelingSuggestion {
  carb_g_per_hour?: number | null
  fluid_ml_per_hour?: number | null
  sodium_mg_per_hour?: number | null
  note?: string | null
}

export interface ProposeSessionInput {
  name: string
  type: string
  sport: 'cycling' | 'running' | 'swimming' | 'strength' | 'general'
  date: string
  description?: string
  duration_seconds: number
  estimated_tss: number
  intervals_format: string
  fueling_suggestion?: FuelingSuggestion | null
}

export interface StreamResult {
  fullText: string
  modulesLoaded: string[]
  newSuggestionIds: string[]
  proposedSession: ProposeSessionInput | null
}

export interface StreamCallbacks {
  onTextDelta: (delta: string) => void
  onComplete: (result: StreamResult) => void | Promise<void>
  onError: (errorMessage: string) => void
}

function mapApiError(code?: string): string {
  switch (code) {
    case 'no_api_key': return 'No API key connected. Please add your Anthropic key in Settings.'
    case 'invalid_api_key': return 'API key is invalid. Please update it in Settings → API Keys.'
    case 'rate_limited': return 'Too many requests — please wait a moment and try again.'
    case 'network_error': return 'Could not reach Anthropic. Check your connection.'
    default: return 'Something went wrong. Please try again.'
  }
}

export function useCoachChat() {
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const streamChat = useCallback(async (
    apiMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
    opts: {
      conversationId?: string
      contextType?: string
      sessionId?: string
    },
    callbacks: StreamCallbacks,
  ) => {
    if (isStreaming) return
    setIsStreaming(true)

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          ...(opts.conversationId ? { conversationId: opts.conversationId } : {}),
          contextType: opts.contextType ?? 'general',
          ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
        }),
        signal: abort.signal,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string }
        callbacks.onError(mapApiError(errData.error))
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let buffer = ''
      let enduranceMeta: {
        modulesLoaded?: string[]
        newSuggestionIds?: string[]
        proposedSession?: ProposeSessionInput
      } | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data) as {
              type?: string
              delta?: { type?: string; text?: string }
              modulesLoaded?: string[]
              newSuggestionIds?: string[]
              proposedSession?: ProposeSessionInput
            }
            if (parsed.type === 'endurance_meta') {
              enduranceMeta = parsed
            } else if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              const delta = parsed.delta.text ?? ''
              fullText += delta
              callbacks.onTextDelta(delta)
            }
          } catch { /* skip malformed SSE lines */ }
        }
      }

      await Promise.resolve(callbacks.onComplete({
        fullText,
        modulesLoaded: enduranceMeta?.modulesLoaded ?? [],
        newSuggestionIds: enduranceMeta?.newSuggestionIds ?? [],
        proposedSession: enduranceMeta?.proposedSession ?? null,
      }))
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      callbacks.onError('Connection error. Please retry.')
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [isStreaming])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { streamChat, isStreaming, abort }
}
