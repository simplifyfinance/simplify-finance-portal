'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'

// THE BANK'S NAME, AND THE BANK'S OWN REFERENCE FOR THIS APPLICATION.
//
// 16 Nov 2026, and it took three goes to put this in a place that does not
// break something.
//
// FIRST it was a join on the query that loads the deal - `lenders(name)`. The
// ship failed on "This page couldn't load": the entire deal page gone, on
// every deal, because one embedded table would not resolve. A name on a row
// is not worth a page.
//
// THEN it was a piece of state on the deal page, and lib/the-look.test.ts
// refused that - rightly. Every piece of state up there re-renders the form
// somebody is typing into, and we have spent weeks chasing letters that
// vanished mid-sentence.
//
// So it lives here, as a leaf: its own state, its own read, its own write. If
// the read fails nothing is drawn, nothing above it re-renders, and nothing
// breaks.
//
// THE REFERENCE IS NOT THE LOAN ID. The loan ID is issued at settlement and
// lives in settled_splits - see lib/loan-id.ts. This is the number the bank
// puts on the application the day it is lodged, and until 16 Nov 2026 the
// portal had nowhere to put it.

export default function TheBank({ dealId, lenderId, loanId, canTypeRef }: {
  dealId: string
  lenderId?: string | null
  /** The bank's number from settlement, where there is one. Read only. */
  loanId?: string
  /** Lodged or later. Before that there is no application to have a reference. */
  canTypeRef?: boolean
}) {
  const supabase = createSupabaseBrowser()
  const [name, setName] = useState('')
  const [ref, setRef] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [problem, setProblem] = useState('')

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const { data } = await supabase.from('deals')
          .select('lender_ref').eq('id', dealId).maybeSingle()
        if (alive) setRef(String((data as any)?.lender_ref || ''))
      } catch { /* the row still draws without it */ }
    })()
    return () => { alive = false }
  }, [dealId])

  useEffect(() => {
    if (!lenderId) { setName(''); return }
    let alive = true
    void (async () => {
      try {
        const { data } = await supabase.from('lenders').select('name').eq('id', lenderId).maybeSingle()
        if (alive) setName(String((data as any)?.name || ''))
      } catch { /* a missing name is smaller than a missing page */ }
    })()
    return () => { alive = false }
  }, [lenderId])

  async function save() {
    const next = draft.trim()
    setEditing(false)
    if (next === (ref || '')) return
    setProblem('')
    const err = await checkedWrite(
      supabase.from('deals').update({ lender_ref: next || null }).eq('id', dealId),
      'The reference')
    if (err) { setProblem(err); return }
    setRef(next)
  }

  // Settlement's loan ID wins where there is one: it is the number on the
  // documents. Before that, whatever somebody typed in at lodgement.
  const showing = loanId || ref || ''

  return (
    <>
      {name || <span className="text-faint">Not recorded</span>}

      {showing && !editing && (
        <span className="text-muted"> &middot; ref {showing}</span>
      )}

      {/* ROOM FOR IT, FROM LODGEMENT. Never before - see theRefCanBeTyped. */}
      {canTypeRef && !loanId && !editing && (
        <button onClick={() => { setDraft(ref || ''); setEditing(true) }}
          className="ml-2 text-[11.5px] font-[650] text-muted hover:text-ink">
          {ref ? 'Change ref' : 'Add ref'}
        </button>
      )}

      {editing && (
        <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setEditing(false)
          }}
          placeholder="The bank's reference"
          aria-label="The bank's reference for this application"
          className="ml-2 text-[12.5px] border border-field-line rounded-md px-2 py-[2px]
            bg-field w-[150px] focus:outline-none focus:border-brand" />
      )}

      {problem && <span className="ml-2 text-[11.5px] text-chase">{problem}</span>}
    </>
  )
}
