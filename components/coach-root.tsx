'use client'

import { CoachProvider } from '@/lib/context/coach-context'

export default function CoachRoot({ children }: { children: React.ReactNode }) {
  return <CoachProvider>{children}</CoachProvider>
}
