'use client'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { askOn, askPatch, clearAskPatch, validateAsk, alreadyAsked } from '@/lib/a-slot-each'
import { brokerLabel } from '@/lib/broker-key'

// ASK FOR THIS ONE NEXT.
//
// 27 Oct 2026. Catherine, Operations Manager, item 2 of nine: "When Mark and
// Kylie reprioritise, other brokers' deals, like Justin's, keep getting pushed
// back."
//
// ONE A DAY. That is the whole mechanism - see lib/a-slot-each.ts. A broker
// marks one file, credit's day takes one from each broker in turn, and chasing
// stops being how you get seen.
//
// ASKING FOR A SECOND ONE DOES NOT FAIL. It MOVES the slot, and says which
// file it is coming off before it does. A broker changing their mind at eleven
// o'clock is the normal case, not an error - and a message saying "you have
// already used today's slot" would just send them back to email.
//
// THE REASON IS REQUIRED. A mark with no reason is volume, and a credit
// assessor looking at three of them cannot tell which is real. Same rule as
// the handover box and the rework box.

const BTN = 'text-[11.5px] rounded-[9px] px-3 py-1 border font-semibold whitespace-nowrap'
const OFF = 'border-card-line bg-card text-brand-ink hover:bg-page'
const ON = 'border-chase-edge bg-chase-bg text-chase'
const INP = 'w-full border border-field-line rounded-[9px] px-3 py-2 text-[13px] text-ink bg-card focus:outline-none focus:border-brand'

export default function AskForThisNext({ deal, deals, brokerKey: me, onDone }: {
  deal: any
  /** Every deal of this broker's, so the one they already asked for is known. */
  deals: any[]
  brokerKey: string
  onDone?: () => void
}) {
  const supabase = createSupabaseBrowser()
  const [open, setOpen] = useState(false)
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const mine = askOn(deal)
  const isMine = mine?.by === String(me || '').trim().toLowerCase().split(' ')[0]
  const other = alreadyAsked(deals, me)
  const moving = other && other.id !== deal.id ? other : null
  const problem = validateAsk({ by: me, why })

  async function ask() {
    if (busy || problem) return
    setBusy(true); setErr('')
    try {
      // THE OLD ONE GOES FIRST. The database holds one ask per broker per day -
      // see the unique index in docs/a-slot-each.sql - so writing the new one
      // while the old one stands would simply be refused.
      if (moving) {
        const { error } = await supabase.from('deals').update(clearAskPatch()).eq('id', moving.id)
        if (error) { setErr(error.message); setBusy(false); return }
      }
      const { data, error } = await supabase.from('deals')
        .update(askPatch({ by: me, why })).eq('id', deal.id).select('id')
      if (error || !data?.length) {
        setErr(error?.message || 'That was not saved — nothing reached the database.')
        setBusy(false); return
      }
      setOpen(false); setWhy('')
      onDone?.()
    } finally { setBusy(false) }
  }

  async function unask() {
    setBusy(true); setErr('')
    const { error } = await supabase.from('deals').update(clearAskPatch()).eq('id', deal.id)
    if (error) setErr(error.message)
    else onDone?.()
    setBusy(false)
  }

  if (isMine) {
    return (
      <button onClick={unask} disabled={busy} title={mine?.why}
        className={`${BTN} ${ON}`}>
        {busy ? '…' : '★ You asked for this'}
      </button>
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={`${BTN} ${OFF}`}>
        ☆ Ask for this next
      </button>
    )
  }

  return (
    <div className="w-full mt-2 border-[1.5px] border-ink rounded-xl px-4 py-3 bg-card">
      <label className="block text-[10.5px] font-bold tracking-[.06em] uppercase text-muted mb-1.5">
        Why this one first? The person doing it reads this
      </label>
      <input className={INP} value={why} autoFocus
        onChange={e => setWhy(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !problem) ask(); if (e.key === 'Escape') setOpen(false) }}
        placeholder="Finance clause is Friday and the agent has already asked twice." />

      {moving && (
        <p className="mt-2 mb-0 text-[11.5px] text-body bg-info-bg border border-info-edge rounded-[9px] px-3 py-2 leading-relaxed">
          <b>You already asked for {moving.deal_name} today</b>
          {askOn(moving)?.why ? ` — “${askOn(moving)!.why}”` : ''}. Marking this one instead puts it back
          in the ordinary queue. Credit is told either way.
        </p>
      )}
      {err && <p className="mt-2 mb-0 text-[11.5px] text-chase">{err}</p>}

      <div className="flex gap-2 items-center mt-3 flex-wrap">
        <span className="flex-1 min-w-[140px] text-[11px] text-faint leading-relaxed">
          {problem || 'One of these a day. It resets overnight.'}
        </span>
        <button onClick={() => { setOpen(false); setWhy('') }} disabled={busy}
          className="text-[12px] border border-card-line bg-card rounded-lg px-3 py-1.5 text-body hover:bg-page">
          Cancel
        </button>
        <button onClick={ask} disabled={busy || !!problem}
          className="text-[12px] bg-ink text-page rounded-lg px-3.5 py-1.5 font-bold disabled:opacity-40">
          {busy ? 'Asking…' : 'Ask for this next'}
        </button>
      </div>
    </div>
  )
}

/** What a broker sees on a file they have asked for, on any other screen. */
export function AskedChip({ deal }: { deal: any }) {
  const a = askOn(deal)
  if (!a) return null
  return (
    <span title={a.why}
      className="text-[10.5px] font-bold text-chase bg-chase-bg border border-chase-edge rounded-full px-2 py-[1px] whitespace-nowrap">
      {brokerLabel(a.by).toUpperCase()} ASKED FOR THIS
    </span>
  )
}
