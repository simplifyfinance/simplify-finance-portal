'use client'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { addSystemNote } from '@/components/DealFile'
import { stuckPatch, stuckOn, validateStuck, STAGE_LABEL } from '@/lib/my-work'
import { type Stage } from '@/lib/who-did-this-stage'

// I CANNOT ACTION THIS.
//
// Alan's item 3, and the half that makes a queue mean anything: a deal nobody
// can work must not sit in somebody's list looking like work.
//
// IT IS SEND IT BACK, POINTING THE OTHER WAY. A broker already answers two
// questions to push a deal back to credit - see components/SendItBack.tsx.
// This is credit answering going the other direction, so the portal holds one
// idea rather than two.
//
// NO LIST OF REASONS. Fabio, 11 Nov 2026: "don't want buttons just an
// explanation why deal is going back to broker, make field enough for a couple
// of sentences." Six chips is a list where everybody picks the first one and
// the broker rings up to ask what it meant.
//
// THE STAGE IS HANDED TO THE BROKER rather than a new flag being invented.
// Every screen in this portal already reads who owns a stage, so one write
// moves the deal off the queue, onto the broker's list, and onto the board.
//
// NOTHING IS DELETED. The work already done stays on the deal and stays
// counted for the day it was done.

const BOX = 'w-full border border-field-line rounded-lg px-2.5 py-2 text-[12.5px] bg-card ' +
            'text-ink outline-none focus:border-brand placeholder:text-faint resize-none'

export default function CannotAction({ deal, stage, me, onDone }: {
  deal: any
  stage: Stage
  me?: { id?: string | null; name?: string }
  /** The caller reloads - the deal has left this person's hands. */
  onDone?: (patch: any) => void
}) {
  const supabase = createSupabaseBrowser()
  const [open, setOpen] = useState(false)
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  const broker = String(deal?.assigned_broker || '').trim()
  const already = stuckOn(deal)

  async function send() {
    const bad = validateStuck(why)
    if (bad) { setProblem(bad); return }
    setBusy(true); setProblem('')
    const patch = stuckPatch(deal, stage, me || {}, why)
    const err = await checkedWrite(
      supabase.from('deals').update(patch).eq('id', deal.id), 'Sending it back')
    if (err) { setBusy(false); setProblem(err); return }

    try {
      await addSystemNote(deal.id,
        `${STAGE_LABEL[stage]} could not be actioned and has gone back to ${broker || 'the broker'}. `
        + why.trim(),
        { id: me?.id || null, name: me?.name || '' })
    } catch { /* the line is smaller than the handover */ }

    // TOLD, NOT JUST MOVED. A deal that lands on somebody's list without a word
    // is the phone call this screen exists to remove.
    let told = true
    try {
      const res = await fetch('/api/cannot-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, stage }),
      })
      told = res.ok
    } catch { told = false }

    setBusy(false)
    if (!told) setProblem('It has gone back, but the email to the broker did not go. Tell them.')
    onDone?.(patch)
  }

  if (already) {
    return (
      <div className="bg-chase-bg border border-chase-edge rounded-xl px-3.5 py-3">
        <p className="text-[9.5px] font-bold tracking-[.09em] uppercase text-chase m-0 mb-1.5">
          Back with the broker
        </p>
        <p className="text-[12.5px] text-body leading-[1.55] m-0">{already.why}</p>
        <p className="text-[11px] text-muted m-0 mt-1.5">
          {already.byName || 'Credit'} could not action it.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-card-line rounded-xl px-3.5 py-3">
      <p className="text-[9.5px] font-bold tracking-[.09em] uppercase text-faint m-0 mb-2">
        Cannot action this?
      </p>

      {!open ? (
        <>
          <p className="text-[12px] text-muted leading-[1.5] m-0 mb-2">
            It leaves your list and goes back to {broker || 'the broker'} with your words on it.
          </p>
          <button onClick={() => { setOpen(true); setProblem('') }}
            className="block text-[11.5px] font-semibold text-brand-ink">
            Send it back →
          </button>
        </>
      ) : (
        <div>
          <p className="text-[10px] font-bold tracking-[.08em] uppercase text-muted m-0 mb-1.5">
            What is stopping you?
          </p>
          <textarea value={why} onChange={e => setWhy(e.target.value)} autoFocus rows={4}
            placeholder="The payslips are from July and the lender wants two inside 60 days. Can you ask the client for the last two, and the latest group certificate while they are at it?"
            className={BOX} />
          <p className="text-[11px] text-faint leading-[1.5] m-0 mt-1">
            A couple of sentences — what is stopping you, and what they need to do about it. Enough
            that nobody has to ring you.
          </p>
          {problem && <p className="text-[11.5px] text-chase m-0 mt-2 leading-[1.5]">{problem}</p>}
          <div className="flex items-center gap-2 mt-3">
            <button onClick={() => { setOpen(false); setProblem(''); setWhy('') }} disabled={busy}
              className="text-[12px] text-muted">Cancel</button>
            <button onClick={() => void send()} disabled={busy}
              className="ml-auto text-[12px] font-semibold bg-chase text-page rounded-lg px-3 py-1.5
                disabled:opacity-50">
              {busy ? 'Sending…' : `Send it to ${broker || 'the broker'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
