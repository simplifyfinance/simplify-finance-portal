"use client"
import { useCallback, useEffect, useRef, useState } from 'react'
import { draftKey, shouldOffer, type Draft } from '@/lib/draft-store'

// THE BROWSER SIDE OF THE DRAFT. What may be kept and what may be offered is
// decided in lib/draft-store.ts; this is the part that touches storage.
//
// EVERY READ AND WRITE IS WRAPPED. localStorage throws in a private window, when
// site data is blocked, and when the quota is full. A form that cannot keep a
// draft still has to work perfectly - this is a safety net, never a dependency.

function read(key: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed.at === 'number' ? parsed as Draft : null
  } catch { return null }
}

function write(key: string, draft: Draft): void {
  try { window.localStorage.setItem(key, JSON.stringify(draft)) } catch { /* full, blocked, private */ }
}

function drop(key: string): void {
  try { window.localStorage.removeItem(key) } catch { /* nothing to do about it */ }
}

export type DraftOffer = { at: number; value: any } | null

export function useDraft(opts: {
  meId: any
  dealId: any
  column: string
  // The record as the database handed it over, for judging whether a draft is
  // worth offering at all.
  stored: any
}) {
  const key = draftKey(opts.meId, opts.dealId, opts.column)
  const [offer, setOffer] = useState<DraftOffer>(null)
  // The record only gets judged once, against what was on the server when this
  // screen opened. Re-judging as the person types would withdraw the offer the
  // moment they touched anything.
  const judged = useRef(false)

  useEffect(() => {
    if (!key || judged.current) return
    judged.current = true
    const draft = read(key)
    if (!draft) return
    if (shouldOffer(draft, opts.stored)) setOffer({ at: draft.at, value: draft.value })
    // Not worth offering - expired, empty, already saved, or it would empty the
    // record. Either way it is not wanted again.
    else drop(key)
  }, [key])

  // KEPT ONLY WHILE THE DATABASE DOES NOT HAVE IT. Called as the person types.
  const keep = useCallback((value: any) => {
    if (!key) return
    write(key, { at: Date.now(), value })
  }, [key])

  // THE SAVE LANDED. The copy has done its job and goes, so nothing stale can
  // ever be offered back.
  const clear = useCallback(() => {
    if (!key) return
    drop(key)
  }, [key])

  // The person said no. Their choice is final and the copy goes with it.
  const dismiss = useCallback(() => {
    setOffer(null)
    if (key) drop(key)
  }, [key])

  const taken = useCallback(() => {
    setOffer(null)
    if (key) drop(key)
  }, [key])

  return { offer, keep, clear, dismiss, taken, enabled: !!key }
}
