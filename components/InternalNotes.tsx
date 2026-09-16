'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import StatementQueries from '@/components/StatementQueries'
import { mergeNotes, removesAnything } from '@/lib/notes-merge'
import { keepVersion } from '@/lib/deal-history'
import { useDraft } from '@/components/useDraft'
import DraftBanner from '@/components/DraftBanner'

// The deal's internal notes, on every tab.
//
// There used to be three boxes all labelled "Internal notes" - one on Fact Find,
// one on BC, one on Lending Options - each saving somewhere different, none of
// them aware of the others. One field now, on all five tabs.
//
// ---------------------------------------------------------------------------
// 14 SEP 2026: THIS BOX WAS DESTROYING NOTES, AND IT DID NOT NEED TWO PEOPLE TO
// DO IT.
//
// A robot reproduced it twice. Kylie typed a note. Melissa typed ONE SPACE into
// the same box on her own screen. Kylie's note was gone from the database - and
// her screen carried on showing it, so she would have closed the tab believing
// it had saved.
//
// Two separate faults, both here:
//
//   1. THE READ ON OPEN OVERWROTE WHAT YOU WERE TYPING. This box re-read the
//      notes from the database when it appeared and called setText with the
//      answer, whatever was in the box by then. That read is a network round
//      trip, and the box is rebuilt on EVERY tab change - so the window reopened
//      constantly. Worse, saving was blocked until that read returned, so what
//      you typed in the gap was not only wiped off the screen, it was never
//      written down. That is Erienne, with one person and nobody else involved.
//
//   2. NO PROTECTION AT ALL AGAINST ANYBODY ELSE. When these notes lived inside
//      the Fact Find record they went through saveGuarded - version checked,
//      merged field by field, previous copy kept. Moving them to their own
//      column left every bit of that behind. Last write wins, no error, nothing
//      recoverable.
//
// So, in order: the read never touches a box somebody has typed in; the write is
// pinned to the version it read, and merges rather than replaces; and anything
// being taken away is copied first.
//
// See lib/notes-merge.ts for the merge and what it deliberately will not do.
// ---------------------------------------------------------------------------

// meId is what makes a draft safe to keep. A cache keyed on the deal alone once
// showed one person another person's work - see lib/draft-store.ts - so with no
// user id no draft is kept at all.
export default function InternalNotes({ dealId, initial, meId }: { dealId: string; initial?: string; meId?: string | null }) {
  const [text, setText] = useState(initial || '')
  const [status, setStatus] = useState<'' | 'saving' | 'saved' | 'error'>('')
  const [err, setErr] = useState('')
  const [cameIn, setCameIn] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // A COPY THAT SURVIVES THE TAB DYING. This box has its own save path - a 900ms
  // debounce, no keepalive - so when the write fails the note lives only in this
  // tab. It is the same hole the four deal tabs closed on 16 Sep 2026.
  const draft = useDraft({ meId, dealId, column: 'internal_notes', stored: initial || '' })

  // WHAT WE BELIEVE THE DATABASE HOLDS. The third copy the merge needs: without
  // it there is no way to tell "they added a line" from "I deleted one".
  const base = useRef<string>(initial || '')
  // Has anybody typed in this box since it appeared? Nothing arriving from the
  // database may touch it once this is true.
  const dirty = useRef(false)
  // The text as it is right now, readable from inside a timer that was created
  // several keystrokes ago.
  const live = useRef<string>(initial || '')
  live.current = text
  const me = useRef<{ id: string | null; name: string }>({ id: null, name: '' })

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user
      if (!u) return
      supabase.from('user_profiles').select('full_name').eq('id', u.id).single()
        .then(({ data: p }) => { me.current = { id: u.id, name: (p as any)?.full_name || u.email || '' } })
    })
  }, [])

  // READ ON OPEN - BUT NEVER OVER SOMEBODY'S TYPING.
  //
  // The notes may have been edited on another tab, so reading is right. Putting
  // the answer on screen regardless of what is in the box is what was wrong.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const supabase = createSupabaseBrowser()
      const { data } = await supabase.from('deals').select('internal_notes').eq('id', dealId).maybeSingle()
      if (!alive) return
      const stored = typeof (data as any)?.internal_notes === 'string' ? (data as any).internal_notes : ''
      // The database is now known, whatever happens to the screen.
      base.current = stored
      // Somebody has been typing while that was in flight. Their words stay;
      // the merge on the next save brings the two together.
      if (dirty.current) return
      setText(stored)
      live.current = stored
    })()
    return () => { alive = false }
  }, [dealId])

  // Bounded, like saveGuarded's. Going round for ever because somebody is
  // saving without pause would be its own kind of blocking.
  const RETRIES = 4
  const save = useCallback(async (value: string, go = 0) => {
    setStatus('saving'); setErr(''); setCameIn('')
    const supabase = createSupabaseBrowser()

    // WHAT IS THERE NOW, and the version to pin the write to.
    const { data: current, error: readErr } = await supabase
      .from('deals').select('internal_notes,row_version').eq('id', dealId).maybeSingle()

    const stored = typeof (current as any)?.internal_notes === 'string' ? (current as any).internal_notes : ''
    const seen: number | undefined =
      typeof (current as any)?.row_version === 'number' ? (current as any).row_version : undefined

    // A failed read is not evidence of anything, and a box that stops saving
    // because the network hiccuped is worse than the problem being solved.
    let toWrite = value
    if (!readErr) {
      if (stored === value) { base.current = stored; setStatus('saved'); return }
      const merged = mergeNotes(base.current, stored, value)
      toWrite = merged.text
      if (merged.broughtIn.length) {
        // Their words go on screen. Said out loud, because a box that changes
        // under somebody with no explanation is its own kind of bug.
        setText(merged.text)
        live.current = merged.text
        setCameIn(merged.broughtIn.length === 1
          ? 'A line from somebody else came in.'
          : `${merged.broughtIn.length} lines from somebody else came in.`)
      }
      // KEEP WHAT IS ABOUT TO GO. Before the write, never after.
      if (removesAnything(stored, toWrite)) {
        await keepVersion(supabase, dealId, 'internal_notes', stored, me.current)
      }
    }

    const fields: any = { internal_notes: toWrite }
    if (seen !== undefined) fields.row_version = seen + 1
    let write = supabase.from('deals').update(fields).eq('id', dealId)
    // AND ONLY IF NOBODY HAS SAVED SINCE I READ IT. Postgres applies this at the
    // instant of writing, which is the one moment the browser cannot reach.
    if (seen !== undefined) write = write.eq('row_version', seen)

    const { data, error } = await write.select('id')

    if (error) { setStatus('error'); setErr(error.message); return }
    if (!data || data.length === 0) {
      if (seen !== undefined && go < RETRIES) {
        // Somebody saved in the gap. Nothing is lost and nothing is written -
        // go round again against what the record holds now.
        return save(live.current, go + 1)
      }
      setStatus('error')
      setErr('Not saved. Copy the text somewhere safe and try again.')
      return
    }

    base.current = toWrite
    dirty.current = false
    // It is in the database now, so the copy has done its job.
    draft.clear()
    setStatus('saved')
  }, [dealId])

  function onChange(v: string) {
    setText(v)
    live.current = v
    dirty.current = true
    draft.keep(v)
    setStatus('saving')
    setCameIn('')
    if (timer.current) clearTimeout(timer.current)
    // NO LONGER GATED ON THE READ. It used to refuse to save until the read on
    // open had returned, which is exactly when somebody types.
    timer.current = setTimeout(() => save(v), 900)
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 sticky top-4">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
        </svg>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Internal notes</span>
        <span className="ml-auto text-[11px]">
          {status === 'saving' ? <span className="text-gray-400">Saving…</span>
            : status === 'saved' ? <span className="text-green-600">Saved</span>
            : status === 'error' ? <span className="text-red-600">Not saved</span> : null}
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-2">The same notes on every tab of this deal — not client facing</p>
      {draft.offer && (
        <DraftBanner at={draft.offer.at}
          onRestore={() => {
            const v = String(draft.offer!.value ?? '')
            setText(v); live.current = v; dirty.current = true; draft.taken()
          }}
          onDiscard={draft.dismiss} />
      )}
      {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
      {cameIn && <p className="text-xs text-[#0E8FCB] mb-2">{cameIn} Nothing you wrote was lost.</p>}
      <textarea spellCheck="true"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF] min-h-[300px] resize-y"
        placeholder="Jot notes while on the phone with the client..."
        value={text}
        onChange={e => onChange(e.target.value)}
        onBlur={() => { if (timer.current) clearTimeout(timer.current); save(live.current) }}
      />
      <StatementQueries dealId={dealId} />
    </div>
  )
}
