'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import StatementQueries from '@/components/StatementQueries'

// The deal's internal notes, on every tab.
//
// There used to be three boxes all labelled "Internal notes" — one on Fact Find,
// one on BC, one on Lending Options — each saving somewhere different, none of
// them aware of the others. The Fact Find one said "stays visible on every tab",
// which described it being sticky while you scrolled that ONE tab. Someone would
// write the background on Fact Find, open BC, find an empty box with the same
// label and write more there, and the story ended up split with no signpost.
//
// Worse: Compliance had no notes box at all, and Compliance is where the
// regulated write-up gets drafted. The person writing it could not see "partner
// VISA, sole trader ABN since April 2026, so the loan is in her name only"
// without leaving the tab.
//
// One field now, on all five tabs. Compliance's "Application submission notes" is
// a different thing with a real job and is untouched.

export default function InternalNotes({ dealId, initial }: { dealId: string; initial?: string }) {
  const [text, setText] = useState(initial || '')
  const [status, setStatus] = useState<'' | 'saving' | 'saved' | 'error'>('')
  const [err, setErr] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loaded = useRef(false)

  // Read on mount rather than trusting what the tab was handed: the notes may
  // have been edited on another tab in this same session.
  useEffect(() => {
    (async () => {
      const supabase = createSupabaseBrowser()
      const { data } = await supabase.from('deals').select('internal_notes').eq('id', dealId).maybeSingle()
      if (data && typeof (data as any).internal_notes === 'string') setText((data as any).internal_notes)
      loaded.current = true
    })()
  }, [dealId])

  const save = useCallback(async (value: string) => {
    setStatus('saving'); setErr('')
    const supabase = createSupabaseBrowser()
    // Checked, like every other write: RLS refuses by returning no rows and no
    // error, and notes that looked saved and were not is exactly the kind of
    // quiet loss this box exists to prevent.
    const { data, error } = await supabase.from('deals')
      .update({ internal_notes: value }).eq('id', dealId).select('id')
    if (error || !data || data.length === 0) {
      setStatus('error'); setErr(error?.message || 'Not saved. Copy the text somewhere safe and try again.')
      return
    }
    setStatus('saved')
  }, [dealId])

  function onChange(v: string) {
    setText(v)
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { if (loaded.current) save(v) }, 900)
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
      {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
      <textarea spellCheck="true"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF] min-h-[300px] resize-y"
        placeholder="Jot notes while on the phone with the client..."
        value={text}
        onChange={e => onChange(e.target.value)}
        onBlur={() => { if (timer.current) clearTimeout(timer.current); if (loaded.current) save(text) }}
      />
      <StatementQueries dealId={dealId} />
    </div>
  )
}
