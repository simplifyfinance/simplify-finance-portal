'use client'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { sayTheWeek } from '@/lib/say-the-week'
import { type AnswerKey } from '@/lib/lodging-when'

// THE THREE BUTTONS, AND EVERYTHING THAT HAPPENS AROUND THEM.
//
// 12 Nov 2026. Moving the write into lib/say-the-week.ts was not enough: both
// screens still had the same six lines of state around it - which row is
// saving, what went wrong, and the patch held locally so the row moves without
// a reload. The duplicate guard was right to keep failing.
//
// So the whole behaviour lives here and both screens call it. Due to lodge and
// the Monday run-through now cannot drift apart in how they save, how they
// report a failure, or how they show the answer that was just given.

export function useSayTheWeek(when: Date = new Date()) {
  const supabase = createSupabaseBrowser()
  const [patched, setPatched] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState('')
  const [problem, setProblem] = useState('')

  async function say(dealId: any, key: AnswerKey) {
    const id = String(dealId ?? '')
    if (!id) return
    setBusy(id); setProblem('')
    const said = await sayTheWeek(supabase, id, key, when)
    setBusy('')
    if (!said.ok) { setProblem(said.error); return }
    setPatched(p => ({ ...p, [id]: said.patch }))
  }

  /** The deals with whatever has been answered since the page loaded. */
  function withAnswers<T extends { id?: any }>(deals: T[]): T[] {
    return (deals || []).map(d => (patched[d.id] ? { ...d, ...patched[d.id] } : d))
  }

  return { say, busy, problem, setProblem, withAnswers }
}
