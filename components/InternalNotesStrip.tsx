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

  // Closed, the note itself is the content - not a label announcing that a note
  // exists. Somebody scanning the deal should read "partner is on a visa, loan
  // in her name only" without clicking anything.
  //
  // This is the SALES team's running context off client calls, kept for credit
  // to read later. It is not the file note log (what happened, when, by whom)
  // and it is not an important note (something that needs doing).
  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="w-full text-left mb-3 bg-[#FCFAF6] border border-[#EFEAE0] rounded-xl px-3.5 py-2.5 flex items-start gap-2.5 hover:border-[#D6CCBC] transition">
      <span className="text-[9.5px] font-bold tracking-[.08em] uppercase text-[#A29889] flex-none mt-[3px]">Internal notes</span>
      <span className={`text-[12.5px] leading-[1.5] flex-1 ${preview ? 'text-[#575046]' : 'text-[#A29889] italic'}`}>
        {preview ? preview.slice(0, 180) + (preview.length > 180 ? '…' : '') : 'Nothing written yet — what the client told us goes here.'}
      </span>
      <span className="text-[11.5px] text-[#0E8FCB] flex-none mt-[1px]">{preview ? 'Edit' : 'Add'}</span>
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
