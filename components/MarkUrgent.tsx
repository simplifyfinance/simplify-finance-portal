'use client'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { addSystemNote } from '@/components/DealFile'
import {
  urgentOn, urgentLine, urgentPatch, validateUrgent, mayClearUrgent, NOT_URGENT_PATCH,
} from '@/lib/my-work'

// URGENT, WITH THE REASON THAT MAKES IT MEAN ANYTHING.
//
// Alan's item 3. The word on its own spreads until everything carries it and
// nobody reads it - so there is no way to set this flag without saying why,
// and the words ride on the row in whoever's queue the deal lands in.
//
// ONLY WHOEVER PUT IT ON CAN TAKE IT OFF. Fabio, asked straight out on 11 Nov
// 2026. The person it was aimed at must not be able to clear their own queue
// by unflagging it.
//
// AND THE DATE IS PART OF THE FLAG. A deal marked urgent an hour ago and one
// that has carried the word for a week are different problems, and the line
// says which without anybody writing a rule about it.

const BOX = 'w-full border border-field-line rounded-lg px-2.5 py-2 text-[12.5px] bg-card ' +
            'text-ink outline-none focus:border-brand placeholder:text-faint resize-none'

export default function MarkUrgent({ deal, me, onSaved }: {
  deal: any
  me?: { id?: string | null; name?: string }
  onSaved?: (patch: any) => void
}) {
  const supabase = createSupabaseBrowser()
  const [open, setOpen] = useState(false)
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [now, setNow] = useState<any>(deal)

  const urgent = urgentOn(now)
  const mayClear = mayClearUrgent(now, me || {})

  async function save(patch: any, note: string) {
    setBusy(true); setProblem('')
    const err = await checkedWrite(
      supabase.from('deals').update(patch).eq('id', deal.id), 'That')
    setBusy(false)
    if (err) { setProblem(err); return }
    setNow({ ...now, ...patch })
    try {
      await addSystemNote(deal.id, note, { id: me?.id || null, name: me?.name || '' })
    } catch { /* a missing line is smaller than a lost flag */ }
    setOpen(false); setWhy('')
    onSaved?.(patch)
  }

  if (urgent) {
    return (
      <div className="bg-chase-bg border border-chase-edge rounded-xl px-3.5 py-3">
        <p className="text-[12px] text-chase leading-[1.5] m-0">
          <b className="text-ink">{urgentLine(now)}</b>
        </p>
        {problem && <p className="text-[11.5px] text-chase m-0 mt-2">{problem}</p>}
        {mayClear ? (
          <button disabled={busy}
            onClick={() => void save(NOT_URGENT_PATCH, 'No longer urgent.')}
            className="block text-[11.5px] font-semibold text-brand-ink mt-2">
            {busy ? 'Saving…' : 'Not urgent any more →'}
          </button>
        ) : (
          <p className="text-[11px] text-muted leading-[1.45] m-0 mt-2">
            {urgent.byName || 'Whoever set it'} marked this, so only they can take it off.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-card border border-card-line rounded-xl px-3.5 py-3">
      <p className="text-[9.5px] font-bold tracking-[.09em] uppercase text-faint m-0 mb-2">
        Is this urgent?
      </p>

      {!open ? (
        <>
          <p className="text-[12px] text-muted leading-[1.5] m-0 mb-2">
            It goes to the top of whoever has it, with your words attached.
          </p>
          <button onClick={() => { setOpen(true); setProblem('') }}
            className="block text-[11.5px] font-semibold text-brand-ink">
            Mark it urgent →
          </button>
        </>
      ) : (
        <div>
          <textarea value={why} onChange={e => setWhy(e.target.value)} autoFocus rows={3}
            placeholder="The client’s finance clause is Friday."
            className={BOX} />
          <p className="text-[11px] text-faint leading-[1.5] m-0 mt-1">
            Required. &ldquo;Urgent&rdquo; with nothing after it is why nobody reads the word.
          </p>
          {problem && <p className="text-[11.5px] text-chase m-0 mt-2 leading-[1.5]">{problem}</p>}
          <div className="flex items-center gap-2 mt-3">
            <button onClick={() => { setOpen(false); setProblem(''); setWhy('') }} disabled={busy}
              className="text-[12px] text-muted">Cancel</button>
            <button disabled={busy}
              onClick={() => {
                const bad = validateUrgent(why)
                if (bad) { setProblem(bad); return }
                void save(urgentPatch(me || {}, why),
                  `Marked urgent: ${why.trim()}`)
              }}
              className="ml-auto text-[12px] font-semibold bg-ink text-page rounded-lg px-3 py-1.5
                disabled:opacity-50">
              {busy ? 'Saving…' : 'Mark urgent'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
