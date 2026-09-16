"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SLOW_SAVE_MS, stampNow, plainFailure, type SaveStage, type SaveStatus } from '@/lib/save-indicator'

// THE TIMING BEHIND THE SAVE LINE. What it is allowed to SAY lives in
// lib/save-indicator.ts; this is the part that knows when each thing is true.
//
// The whole job is one question: is what I can see on screen in the database?
// Not "did a save succeed recently", which is what the old line answered and why
// it could say "Autosaved 10:42" over ten minutes of unsaved typing.
//
// It is answered with a counter rather than a flag, because a save takes time and
// people keep typing while it is in the air. Every change bumps `seq`. A write
// carries the `seq` it set out with, and only the write that comes back still
// holding the CURRENT seq may say "saved" - if anything was typed while it was
// away, the line stays on "Saving..." and the next write settles it. A flag
// cannot tell those apart and would go quiet a keystroke early, which is the same
// lie in a smaller size.
//
// All four tabs share this. Kylie should not get a different answer on BC than
// she gets on the Fact Find.
export function useSaveIndicator(report?: (s: SaveStatus) => void) {
  const [status, setStatus] = useState<SaveStatus>({ stage: 'clean' })

  // Bumped by every real change on screen.
  const seqRef = useRef(0)
  // The seq we last knew to be in the database.
  const cleanRef = useRef(0)
  // Time of the last save that actually carried something.
  const atRef = useRef<string | undefined>(undefined)
  // The stage as it is RIGHT NOW, readable outside a state updater. React may run
  // an updater twice, so nothing in one is allowed to have a consequence.
  const stageRef = useRef<SaveStage>('clean')
  const slowRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The effect that reports changes also runs once on mount, when nothing has
  // changed. Counting that would put "Saving..." on screen for opening a deal.
  const firstRef = useRef(true)

  // Up to the deal header, which owns the single indicator.
  useEffect(() => { report?.(status) }, [status])

  const put = useCallback((next: SaveStatus) => {
    stageRef.current = next.stage
    setStatus(next)
  }, [])

  const disarm = useCallback(() => {
    if (slowRef.current) { clearTimeout(slowRef.current); slowRef.current = null }
  }, [])

  useEffect(() => () => disarm(), [disarm])

  // THE COMPUTER HAS LOST THE INTERNET. Nothing in flight is going to land, and
  // the browser will not say so for a long time, so say it now rather than sitting
  // on "Saving..." looking calm.
  useEffect(() => {
    const gone = () => { if (stageRef.current === 'saving') put({ stage: 'slow', at: atRef.current }) }
    window.addEventListener('offline', gone)
    return () => window.removeEventListener('offline', gone)
  }, [put])

  // Something on screen changed.
  const changed = useCallback(() => {
    if (firstRef.current) { firstRef.current = false; return }
    seqRef.current += 1
    // Already late, or already failed and now being fixed - both go to "saving"
    // except 'slow', which has earned its noise until the write comes back.
    if (stageRef.current !== 'slow') put({ stage: 'saving', at: atRef.current })
  }, [put])

  // A write is going out. Hand the token it returns back to landed().
  const starting = useCallback((): number => {
    const token = seqRef.current
    // Only a write that is carrying something can be late. The save that fires
    // when a deal is opened is not news.
    if (token !== cleanRef.current) {
      disarm()
      slowRef.current = setTimeout(() => {
        if (stageRef.current === 'saving') put({ stage: 'slow', at: atRef.current })
      }, SLOW_SAVE_MS)
    }
    return token
  }, [disarm, put])

  // It landed. `stamp` is false where the database had nothing to do - there is no
  // moment worth putting a time on.
  const landed = useCallback((token: number, stamp = true) => {
    // Typed over while this was away. The newer write owns the answer.
    if (token !== seqRef.current) return
    const carriedSomething = token !== cleanRef.current
    disarm()
    cleanRef.current = token
    if (stamp && carriedSomething) atRef.current = stampNow()
    put({ stage: 'clean', at: atRef.current })
  }, [disarm, put])

  // THERE IS NOTHING TO SAVE. The autosave on BC and LO can decide, after the
  // timer has already fired, that this was the record arriving rather than a
  // person typing, and return without writing anything. Without this the line
  // would sit on "Saving..." for a write that is never going to happen - the same
  // lie as "Autosaved 10:42", just pointing the other way.
  const settled = useCallback(() => {
    // A real save failed and this one had nothing to carry. That does not make the
    // failure untrue.
    if (stageRef.current === 'failed') return
    disarm()
    cleanRef.current = seqRef.current
    put({ stage: 'clean', at: atRef.current })
  }, [disarm, put])

  // A DIFFERENT WRITE ON THIS PAGE SUCCEEDED - a link, a document, the deal name.
  // Those do not go through the autosave counter, so all they may do is take down
  // a red pill that is no longer true. What they must never do is claim the FORM
  // is saved when it is not.
  const recovered = useCallback(() => {
    if (stageRef.current !== 'failed') return
    put(seqRef.current === cleanRef.current
      ? { stage: 'clean', at: atRef.current }
      : { stage: 'saving', at: atRef.current })
  }, [put])

  // It did not land. Loud, and stays loud until something changes.
  const failed = useCallback((message: string, technical?: string) => {
    disarm()
    const plain = plainFailure(message, technical)
    put({ stage: 'failed', at: atRef.current, message: plain.message, technical: plain.technical })
  }, [disarm, put])

  // ONE OBJECT, NOT A NEW ONE EVERY RENDER. The forms put this in the dependency
  // list of writeNow, and writeNow is in the dependency list of the autosave
  // timer. A fresh object each render would restart that timer on every render,
  // which is a save loop, which is how letters go missing. All six callbacks are
  // already stable.
  return useMemo(() => ({ changed, starting, landed, failed, recovered, settled }),
    [changed, starting, landed, failed, recovered, settled])
}
