'use client'
import { useState } from 'react'
import InternalNotes from '@/components/InternalNotes'

// The same notes, on the tabs that have no room for a sidebar.
//
// Fact Find keeps its sticky left column, because it already had one and it
// works. Every other tab gets this: collapsed to one line so it costs nothing,
// opened with a click. It reads and writes the same field, so it is not "another
// notes box" — it is the same notes.
//
// It starts OPEN on Compliance. That is where the regulated write-up is drafted
// and where, until now, there was no background on screen at all.
export default function InternalNotesStrip({ dealId, initial, openByDefault }: {
  dealId: string; initial?: string; openByDefault?: boolean
}) {
  const [open, setOpen] = useState(!!openByDefault)
  const preview = (initial || '').trim().replace(/\s+/g, ' ')

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="w-full text-left mb-4 bg-white border border-gray-100 rounded-xl px-4 py-2.5 flex items-center gap-2 hover:bg-gray-50">
      <svg className="w-4 h-4 text-gray-400 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
      </svg>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider flex-none">Internal notes</span>
      <span className="text-xs text-gray-400 truncate">
        {preview ? preview.slice(0, 130) + (preview.length > 130 ? '…' : '') : 'Nothing written yet'}
      </span>
      <span className="ml-auto text-xs text-[#2DBEFF] flex-none">Open</span>
    </button>
  )

  return (
    <div className="mb-4 relative">
      <button onClick={() => setOpen(false)}
        className="absolute right-4 top-4 z-10 text-xs text-gray-400 hover:text-gray-600">Hide</button>
      <InternalNotes dealId={dealId} initial={initial} />
    </div>
  )
}
