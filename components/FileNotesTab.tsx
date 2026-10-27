'use client'
import { useMemo, useState } from 'react'
import { whenLabel, type Note } from '@/lib/deal-notes'
import { kindOf, FILTERS, type NoteFilter } from '@/lib/file-note-kinds'

// THE FILE, FULL SCREEN.
//
// 29 Oct 2026. Catherine, Operations Manager, item 6. Fabio, before a line of
// it was written: "I still want to make sure we're not double handling the file
// update box to the file notes."
//
// SO THERE IS NOTHING HERE BUT A SECOND WAY TO READ THE SAME ROWS. Every entry
// comes from public.deal_notes, the same table the File update box on the right
// has always used, loaded once by the deal page and handed to both. There is no
// second store, no copy, and nowhere for the two to disagree - because they are
// the same array.
//
// WHAT THE TAB ADDS IS ROOM. The rail is 330 pixels wide and is for adding a
// line and glancing at the last few. This is for reading a year of them, and
// for handing one to somebody who is asking questions about the file.
//
// NOTHING ON THIS PAGE CAN CHANGE AN ENTRY. Not edit, not delete, not reorder.
// A log somebody can tidy up proves nothing about what happened, which is the
// entire reason it exists.

const CHIP = 'text-[12.5px] border rounded-full px-3.5 py-1.5 transition'

export default function FileNotesTab({ notes, dealId, dealName }: {
  notes: Note[]
  dealId: string
  dealName?: string
}) {
  const [filter, setFilter] = useState<NoteFilter>('all')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)

  const shown = useMemo(
    () => (notes || []).filter(n => filter === 'all' || kindOf(n) === filter),
    [notes, filter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: (notes || []).length }
    for (const n of notes || []) { const k = kindOf(n); c[k] = (c[k] || 0) + 1 }
    return c
  }, [notes])

  async function exportIt() {
    setBusy(true)
    try {
      const res = await fetch('/api/generate-file-notes-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId }),
      })
      if (!res.ok) { alert('Could not build the file notes PDF. Nothing was downloaded.'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `File notes - ${(dealName || 'deal').replace(/[\\/:*?"<>|]/g, '')}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert('Could not build the file notes PDF. Nothing was downloaded.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-card border border-card-line rounded-xl p-5">
      <div className="flex items-baseline gap-2.5 flex-wrap mb-1">
        <b className="text-[15px] text-ink">Every contact with this client, in order</b>
        <span className="text-[12px] text-faint">
          {counts.all === 1 ? '1 entry' : `${counts.all} entries`}
        </span>
      </div>
      <p className="text-[11.5px] text-faint m-0 mb-4 max-w-[760px] leading-relaxed">
        The same log as the File update box on the right. Nothing here can be edited or removed,
        by anybody. Add a line from the box on the right.
      </p>

      <div className="flex items-center gap-2 flex-wrap mb-5">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`${CHIP} ${filter === f.key
              ? 'bg-ink text-page border-ink font-semibold'
              : 'bg-card text-muted border-card-line hover:border-field-line'}`}>
            {f.label}{counts[f.key] ? ` ${counts[f.key]}` : ''}
          </button>
        ))}
        <button onClick={exportIt} disabled={busy || !counts.all}
          className="ml-auto text-[12.5px] font-semibold text-[#0E8FCB] bg-card border border-[#BFE6F9]
                     rounded-lg px-4 py-2 hover:bg-[#EAF7FE] disabled:opacity-40">
          {busy ? 'Building…' : 'Export for the file'}
        </button>
      </div>

      {!counts.all && (
        <p className="text-[12.5px] text-faint m-0">
          Nothing recorded yet. Emails to the client write themselves in here as they go,
          and calls go in from the box on the right.
        </p>
      )}

      {counts.all > 0 && !shown.length && (
        <p className="text-[12.5px] text-faint m-0">Nothing of that kind on this file.</p>
      )}

      {shown.length > 0 && (
        <div className="border-l-2 border-line pl-6 ml-1">
          {shown.map(n => {
            const kind = kindOf(n)
            return (
              <div key={n.id} className="relative mb-5 last:mb-0">
                <span className={`absolute -left-[31px] top-[6px] w-[9px] h-[9px] rounded-full bg-card border-2 ${
                  kind === 'email' ? 'border-info'
                  : kind === 'client' ? 'border-done'
                  : kind === 'typed' ? 'border-waiting' : 'border-[#E5DED2]'}`} />
                <p className="text-[11.5px] text-faint m-0 mb-1">
                  {whenLabel(n.created_at)}
                  {' · '}
                  {n.kind === 'system' ? 'recorded automatically' : (n.author_name || 'unknown')}
                </p>
                <p className={`text-[13.5px] m-0 leading-[1.55] ${
                  n.kind === 'system' ? 'text-muted' : 'text-body'}`}>
                  {n.body}
                </p>
                {n.detail && (
                  <>
                    <button onClick={() => setOpen(o => ({ ...o, [n.id]: !o[n.id] }))}
                      aria-expanded={!!open[n.id]} aria-controls={`sent-tab-${n.id}`}
                      className="text-[11.5px] font-semibold text-info underline mt-1.5">
                      {open[n.id] ? 'Hide' : 'Show what was sent'}
                    </button>
                    {open[n.id] && (
                      <pre id={`sent-tab-${n.id}`}
                        className="mt-2 mb-0 max-h-[460px] overflow-auto bg-page border border-line-soft
                                   rounded-lg px-4 py-3 text-[11.5px] leading-[1.65] text-body
                                   whitespace-pre-wrap font-mono">
                        {n.detail}
                      </pre>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
