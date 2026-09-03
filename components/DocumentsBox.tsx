'use client'
import { useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { documentsFor, documentsDue, groupedDocuments, type DocRound } from '@/lib/document-rules'
import { rowsFor, tickedCount, withTick, withAdded, withoutAdded, progressOf,
         COMMON_EXTRAS, type DocProgress, type DocRow } from '@/lib/document-progress'

// THE DOCUMENT BOX.
//
// One box, one list, in the same place on every stage - it sits with the deal
// information above the tabs rather than inside one, because documents are not
// a stage of the deal, they run alongside all of them. Fabio, 3 Sep 2026: "let's
// make sure it all sits on the same button with the same box where we're
// crossing documents along the way and adding. It's always the same button."
//
// NOTHING IS REQUESTED FROM HERE YET. The list appears and ticks save, so the
// rules can be checked against real deals before a single email goes to a
// client. The request button is the next block, deliberately.

const TICK = (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor"
       strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8.4 6.2 11.4 13 4.6" />
  </svg>
)

export default function DocumentsBox({ deal, me, onUpdated }: {
  deal: any
  // The same shape the deal page hands DealAlerts and FileNotes.
  me?: { id: string | null; name: string } | null
  onUpdated?: (patch: any) => void
}) {
  const supabase = createSupabaseBrowser()
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState<DocProgress>(() => progressOf(deal))
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [showLater, setShowLater] = useState(false)

  const who = me?.name || 'Somebody'

  // Worked out fresh on every render of a changed deal. Never stored.
  const { items, gaps } = useMemo(() => documentsFor(deal), [deal])
  const dueNow = useMemo(() => documentsDue(deal, 'proceed').items.map(i => i.key), [deal])

  const rows = useMemo(() => rowsFor(items, progress), [items, progress])
  const nowRows = rows.filter(r => dueNow.includes(r.key) || r.addedByHand)
  const laterRows = rows.filter(r => !dueNow.includes(r.key) && !r.addedByHand)
  const groups = useMemo(() => groupedDocuments(nowRows as any), [nowRows]) as
    { key: string; label: string; items: DocRow[] }[]

  const ticked = tickedCount(nowRows)

  // Optimistic, then verified. A write that silently affects zero rows is the
  // failure this codebase has been bitten by, so the screen goes back to what it
  // was and says so rather than showing a tick that never saved.
  async function save(next: DocProgress, what: string) {
    const before = progress
    setProgress(next)
    setBusy(what)
    const problem = await checkedWrite(
      supabase.from('deals').update({ document_progress: next }).eq('id', deal.id), 'That change')
    setBusy('')
    if (problem) { setProgress(before); setErr(problem); return }
    setErr('')
    onUpdated?.({ document_progress: next })
  }

  const toggle = (r: DocRow) => save(withTick(progress, r.key, !r.ticked, who), r.key)

  function addTyped() {
    const label = newLabel.trim()
    if (!label) return
    const known = COMMON_EXTRAS.find(e => e.label.toLowerCase() === label.toLowerCase())
    setNewLabel('')
    setAdding(false)
    save(withAdded(progress, known?.label || label, known?.forWhat || 'compliance', who, known?.detail), 'add')
  }

  return (
    <div className="bg-white border border-[#EDE7DD] rounded-xl mb-4 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#FDFCFA] transition">
        <span className="text-[9.5px] font-bold tracking-[.07em] uppercase text-[#A29889]">Documents</span>
        <span className="text-[13px] text-[#221F1B] font-semibold">{ticked} to request</span>
        <span className="text-[12px] text-[#A29889]">of {nowRows.length} on the list</span>
        {gaps.length > 0 && (
          <span className="text-[9px] font-bold tracking-[.04em] uppercase rounded px-1.5 py-[2px] border
                           text-[#946017] bg-[#FDF6EC] border-[#EBD9BE]">
            {gaps.length} to check
          </span>
        )}
        <span className="ml-auto text-[11px] text-[#A29889]">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="border-t border-[#F2EEE7]">
          {err && (
            <p className="m-4 mb-0 border border-[#E9D2CF] bg-[#FDF3F2] rounded-[10px] px-4 py-2.5 text-[12.5px] text-[#8E3A34]">
              {err}
            </p>
          )}

          {/* Not a request form yet, and saying so beats somebody waiting for an
              email that was never built. */}
          <p className="m-4 mb-0 border border-[#CDEBF8] bg-[#F4FCFF] rounded-[10px] px-4 py-2.5 text-[12.5px] text-[#0B5E8A]">
            <b className="text-[#141C24]">Nothing is requested from here yet.</b> This is the list the fact find
            works out on its own — tick and untick it, add what is missing, and tell me where it is wrong.
            The request button comes next.
          </p>

          {gaps.map(g => (
            <p key={g.key} className="m-4 mb-0 border border-[#EBD9BE] bg-[#FDF6EC] rounded-[10px] px-4 py-2.5 text-[12.5px] text-[#8A6218]">
              {g.message}
            </p>
          ))}

          {groups.map(group => (
            <div key={group.key}>
              <div className="px-4 pt-4 pb-1.5 text-[9.5px] font-bold tracking-[.07em] uppercase text-[#A29889]">
                {group.label}
              </div>
              {group.items.map(r => (
                <div key={r.key} className="flex gap-3 items-start px-4 py-[7px] border-t border-[#F7F4EF] hover:bg-[#FDFCFA]">
                  <button onClick={() => toggle(r)} disabled={busy === r.key}
                    aria-label={r.ticked ? `Do not ask for ${r.label}` : `Ask for ${r.label}`}
                    className={`w-4 h-4 rounded-[4px] border-[1.5px] mt-[3px] flex-none grid place-items-center transition
                      disabled:opacity-40 ${r.ticked
                        ? 'bg-[#221F1B] border-[#221F1B] text-white'
                        : 'bg-white border-[#CFC7BA] text-transparent hover:border-[#A29889]'}`}>
                    {TICK}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[13px] ${r.ticked ? 'text-[#221F1B] font-medium' : 'text-[#8B8378]'}`}>
                      {r.label}
                      {r.detail && <span className="font-normal text-[#A29889]"> — {r.detail}</span>}
                    </div>
                    {(r.why || r.decidedBy) && (
                      <div className="text-[11.5px] text-[#A29889] mt-[1px]">
                        {r.why}
                        {r.decidedBy && <span>{r.why ? ' · ' : ''}{r.ticked ? 'Added back' : 'Unticked'} by {r.decidedBy}</span>}
                      </div>
                    )}
                  </div>
                  <span className={`text-[9px] font-bold tracking-[.05em] uppercase rounded px-1.5 py-[2px] border mt-[2px] flex-none ${
                    r.forWhat === 'lodge'
                      ? 'text-[#0B5E8A] bg-[#F4FCFF] border-[#CDEBF8]'
                      : 'text-[#946017] bg-[#FDF6EC] border-[#EBD9BE]'}`}>
                    {r.forWhat === 'lodge' ? 'Lodge' : 'Compliance'}
                  </span>
                  {r.addedByHand && (
                    <button onClick={() => save(withoutAdded(progress, r.key), r.key)}
                      className="text-[11px] text-[#C3BDB2] hover:text-[#B23A34] flex-none mt-[3px]">Remove</button>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* Anything the rules would never produce. A short list to pick from,
              because free text alone gives you nine spellings of "accountant's
              letter" - and free text as well, because one-offs are real. */}
          <div className="px-4 py-3 border-t border-[#F2EEE7] bg-[#FDFCFA]">
            {adding ? (
              <div className="flex gap-2 items-center flex-wrap">
                <input autoFocus list="doc-extras" value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addTyped(); if (e.key === 'Escape') { setAdding(false); setNewLabel('') } }}
                  placeholder="Accountant's letter, older statements, …"
                  className="flex-1 min-w-[220px] border border-[#E8E1D6] rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-[#2DBEFF]" />
                <datalist id="doc-extras">
                  {COMMON_EXTRAS.map(e => <option key={e.label} value={e.label} />)}
                </datalist>
                <button onClick={addTyped} disabled={!newLabel.trim()}
                  className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold bg-[#221F1B] text-white disabled:opacity-40">Add</button>
                <button onClick={() => { setAdding(false); setNewLabel('') }}
                  className="text-[12.5px] text-[#A29889]">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setAdding(true)}
                className="text-[12.5px] text-[#0E8FCB] hover:underline">+ Add a document</button>
            )}
          </div>

          {/* The rows that are real but not due. Shown because somebody should be
              able to see what is coming, folded because chasing them now is
              exactly the mistake. */}
          {laterRows.length > 0 && (
            <div className="px-4 py-3 border-t border-[#F2EEE7]">
              <button onClick={() => setShowLater(s => !s)} className="text-[12px] text-[#A29889] hover:text-[#7A7266]">
                {showLater ? 'Hide' : `${laterRows.length} more that ${laterRows.length === 1 ? 'turns' : 'turn'} up later, on their own`}
              </button>
              {showLater && (
                <div className="mt-2">
                  {laterRows.map(r => (
                    <div key={r.key} className="flex gap-3 items-baseline py-[5px] text-[12.5px] text-[#A29889]">
                      <span className="flex-1">{r.label}{r.detail && <span> — {r.detail}</span>}</span>
                      <span className="text-[11px]">{roundLabel(r.round)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function roundLabel(r: DocRound): string {
  return r === 'offer_accepted' ? 'once the offer is accepted'
    : r === 'formal_approval' ? 'once formally approved'
    : ''
}
