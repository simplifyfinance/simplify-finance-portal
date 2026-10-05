'use client'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import {
  outstandingItems, stillWaiting, allReceived, oldestWaitDays, waitingLine,
  waitTone, withNewItem, withReceived, withUnreceived, withoutItem,
  WAITING_LABEL, type WaitingOn,
} from '@/lib/outstanding'
import { dayMonth } from '@/lib/same-date-everywhere'

// THE LENDER SAID YES, SUBJECT TO.
//
// Fabio, 29 Sep 2026: "it goes lodged, outstanding, and then pre-approval".
//
// Before this, a conditionally approved deal sat in Lodged looking exactly like
// one nobody had heard a word about. Those are opposite situations - one is
// waiting on a bank to pick a file up, the other is waiting on a client to send
// two payslips, and only the second can be chased.
//
// IT ANSWERS ITSELF AWAY, like components/WhoIsDoingTheBc.tsx. Before lodgement
// it does not exist. After the pre-approval it does not exist. In between it is
// either one line offering to record conditions, or the list itself.
//
// ONE WRITE PER PRESS. lib/outstanding.ts returns the WHOLE list every time and
// this saves it in one go, because outstanding_items is a JSON column and two
// half-writes to a shared blob is how a condition quietly disappears.

const CHIP: Record<WaitingOn, string> = {
  client: 'text-[#1D4ED8] bg-[#EFF6FF] border-[#BFDBFE]',
  lender: 'text-waiting bg-waiting-bg border-waiting-edge',
  us:     'text-[#166534] bg-[#ECFDF5] border-[#BBF7D0]',
}

export default function Outstanding({ deal, me, onUpdated }: {
  deal: any
  me?: { id: string | null; name: string }
  onUpdated?: (patch: any) => void
}) {
  const supabase = createSupabaseBrowser()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)
  const [what, setWhat] = useState('')
  const [who, setWho] = useState<WaitingOn>('client')

  // Not lodged yet, or already past it, or dead. Nothing to say.
  const lodged = !!deal?.lodged_at
  const past = !!deal?.preapproval_at || !!deal?.formal_approval_at || !!deal?.settled_at
  const dead = deal?.status === 'lost' || deal?.status === 'completed'
  if (!lodged || past || dead) return null

  const here = !!deal?.outstanding_at
  const items = outstandingItems(deal)
  const waitDays = oldestWaitDays(deal)
  const tone = waitTone(waitDays)

  async function save(patch: Record<string, any>) {
    setBusy(true); setErr('')
    const { data: rows, error } = await supabase.from('deals')
      .update(patch).eq('id', deal.id).select('id')
    // Zero rows and no error means the write was refused. Never fail silently.
    if (error || !rows?.length) {
      setErr(error ? `Not saved: ${error.message}`
                   : 'Not saved - nothing was written. Please tell Fabio.')
      setBusy(false); return false
    }
    onUpdated?.(patch)
    setBusy(false); return true
  }

  async function addItem() {
    const next = withNewItem(deal, what, who)
    if (next.length === items.length) return          // blank
    const patch: Record<string, any> = { outstanding_items: next }
    // The first item recorded is what puts the deal in the column. Nobody has
    // to press a second button to say what they have just plainly said.
    if (!here) {
      patch.outstanding_at = new Date().toISOString()
      patch.outstanding_by = me?.name || ''
    }
    if (await save(patch)) { setWhat(''); setOpen(false) }
  }

  const tick = (id: string, on: boolean) =>
    save({ outstanding_items: on ? withReceived(deal, id, me?.name || '') : withUnreceived(deal, id) })

  const everythingIn = allReceived(deal)

  return (
    <div className={`mb-6 rounded-xl border px-4 py-3.5 ${
      tone === 'late' ? 'border-chase-edge bg-chase-bg'
      : tone === 'warn' ? 'border-chase-edge bg-chase-bg'
      : 'border-line bg-card'}`}>

      <div className="flex items-baseline gap-2 flex-wrap mb-1">
        <span className="text-[10px] font-bold tracking-[.07em] uppercase text-faint">
          {here ? 'Outstanding' : 'Has the lender come back with conditions?'}
        </span>
        {here && deal.outstanding_at && (
          <span className="text-[11px] text-faint">
            conditionally approved {dayMonth(deal.outstanding_at)}
          </span>
        )}
        {waitDays !== null && (
          <span className={`text-[11px] font-semibold ${
            tone === 'late' ? 'text-chase' : tone === 'warn' ? 'text-chase' : 'text-faint'}`}>
            oldest {waitDays} day{waitDays === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {here && (
        <p className="text-[13px] text-[#3F4650] mb-2">{waitingLine(deal)}</p>
      )}

      {!here && !open && (
        <p className="text-[12.5px] text-muted">
          Record what they asked for and this deal moves to Outstanding, so it stops looking like one
          nobody has heard from.{' '}
          <button onClick={() => setOpen(true)}
            className="text-[#2DBEFF] font-semibold hover:underline">Add the first one</button>
        </p>
      )}

      {items.length > 0 && (
        <div className="mt-1">
          {items.map(i => {
            const got = !!i.receivedAt
            return (
              <div key={i.id} className="flex gap-2.5 items-start py-2 border-b border-[#F2F4F5] last:border-b-0">
                <button disabled={busy} onClick={() => tick(i.id, !got)}
                  aria-label={got ? 'Mark as not received' : 'Mark as received'}
                  className={`mt-[3px] w-[17px] h-[17px] rounded-[4px] border-[1.5px] flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    got ? 'bg-[#0F7B4F] border-[#0F7B4F] text-white' : 'bg-card border-[#CBD2D8]'}`}>
                  {got ? '✓' : ''}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] leading-snug ${got ? 'text-faint line-through' : 'text-ink'}`}>
                    {i.what}
                    {!got && (
                      <span className={`ml-1.5 align-[1px] inline-block text-[9px] font-bold tracking-[.04em] uppercase border rounded px-1.5 py-[1px] ${CHIP[i.waitingOn]}`}>
                        {WAITING_LABEL[i.waitingOn]}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-faint mt-[2px]">
                    {got
                      ? `Received ${dayMonth(i.receivedAt!)}${i.receivedBy ? ` by ${i.receivedBy}` : ''}`
                      : `Asked ${dayMonth(i.askedAt)}`}
                  </div>
                </div>
                <button disabled={busy} onClick={() => save({ outstanding_items: withoutItem(deal, i.id) })}
                  className="text-[11px] text-faint hover:text-chase shrink-0">remove</button>
              </div>
            )
          })}
        </div>
      )}

      {open ? (
        <div className="mt-2.5 flex gap-2 items-center flex-wrap">
          <input autoFocus value={what} onChange={e => setWhat(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem() }}
            placeholder="What did the lender ask for?"
            className="flex-1 min-w-[220px] text-[13px] border border-[#E3E6E8] rounded-lg px-3 py-1.5" />
          <select value={who} onChange={e => setWho(e.target.value as WaitingOn)}
            className="text-[12.5px] border border-[#E3E6E8] rounded-lg px-2 py-1.5 bg-card">
            <option value="client">Waiting on the client</option>
            <option value="lender">Waiting on the lender</option>
            <option value="us">Waiting on us</option>
          </select>
          <button disabled={busy || !what.trim()} onClick={addItem}
            className="text-[12px] font-semibold bg-ink text-page rounded-lg px-3 py-1.5 disabled:opacity-40">
            Add
          </button>
          <button onClick={() => { setOpen(false); setWhat('') }}
            className="text-[12px] text-faint">Cancel</button>
        </div>
      ) : here && (
        <button onClick={() => setOpen(true)}
          className="mt-2 text-[12px] text-[#2DBEFF] font-semibold hover:underline">+ Add another</button>
      )}

      {/* EVERYTHING IS IN - BUT THAT IS NOT THE SAME AS APPROVED.
          The lender still has to say so. Ticking the last box asks rather than
          moving the deal, because a deal that marks itself pre-approved on our
          say-so is a client told the wrong thing. */}
      {everythingIn && (
        <div className="mt-3 pt-3 border-t border-[#EFE8DC]">
          <p className="text-[12.5px] text-[#3F4650] mb-2">
            <b>Everything is in.</b> Has the pre-approval come through?
          </p>
          <button disabled={busy}
            onClick={() => save({ preapproval_at: new Date().toISOString() })}
            className="text-[12px] font-semibold bg-[#0F7B4F] text-white rounded-lg px-3 py-1.5 mr-2 disabled:opacity-40">
            Yes — move to Preapproved
          </button>
          <span className="text-[12px] text-faint">
            Not yet? Leave it. The deal stays here, waiting on the lender.
          </span>
        </div>
      )}

      {err && (
        <p className="mt-2.5 border border-chase-edge bg-chase-bg rounded-lg px-3 py-2 text-[12.5px] text-chase">{err}</p>
      )}
    </div>
  )
}
