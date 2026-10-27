'use client'
import { useState } from 'react'
import {
  REWORK_REASONS, validateSendBack, sendBackTarget, clearedBySendingBack,
  BACK_STAGE_LABEL, type BackStage,
} from '@/lib/send-it-back'
import { handStageOver } from '@/lib/hand-this-stage-over'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

// THE BOX A BROKER FILLS IN TO SEND A DEAL BACK TO CREDIT.
//
// 27 Oct 2026. Fabio: "we have situatiomns where credit has worked on a BC but
// broker asked credit to reword that deal for exmaple do a different sceanrtio
// based on conversation with cleints. How can we communicate with credit person
// thgat this needs a rework so it gets flagged in her queue and needs rework?"
//
// IT IS THE HANDOVER BOX FACING THE OTHER WAY. Credit cannot hand a deal to a
// broker without saying what they need to know - see components/Handover.tsx,
// and "they need to fucking answer the boxes" - and until today a broker could
// send one back saying nothing at all. The same courtesy, in the same shape,
// pointing the other direction.
//
// BOTH BOXES ARE REQUIRED. Fabio, asked straight out on 27 Oct: both. A chip
// on its own - "figures are wrong" - is a phone call, which is the thing this
// screen exists to remove.
//
// NOTHING IS DELETED, AND THE SCREEN SAYS SO. The BC she wrote stays on the
// deal and stays counted in her finished work for the day she finished it. A
// person pressing a red button needs to know that before they press it, not
// afterwards.

const CHIP = 'text-[11.5px] rounded-full px-2.5 py-1 border transition'
const OFF = 'border-card-line bg-page text-body hover:bg-card'
const ON = 'border-chase-edge bg-chase-bg text-chase font-semibold'
const PICK = 'text-[12px] rounded-[9px] px-3 py-1.5 border transition text-left'
const PICK_OFF = 'border-card-line bg-page text-muted hover:bg-card'
const PICK_ON = 'border-brand bg-brand/10 text-brand-ink font-semibold'
const BTN = 'text-[12px] border border-card-line bg-card rounded-lg px-3 py-1.5 text-body hover:bg-page transition'
const INP = 'w-full border border-line rounded-[10px] px-3 py-2.5 text-[12.5px] text-ink leading-relaxed bg-card focus:outline-none focus:border-brand'

export default function SendItBack({ deal, stage, byName, onDone, onCancel }: {
  deal: any
  stage: BackStage
  /** The broker's name, which goes on the chip and in the email. */
  byName: string
  /** Called once it is back with credit. The caller reloads. */
  onDone: () => void
  onCancel: () => void
}) {
  const supabase = createSupabaseBrowser()
  const [why, setWhy] = useState('')
  const [note, setNote] = useState('')
  const [to, setTo] = useState<'same' | 'queue'>('same')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const who = sendBackTarget(deal, stage)
  const what = BACK_STAGE_LABEL[stage]
  const missing = validateSendBack({ why, note })
  const cleared = clearedBySendingBack(deal, stage)
  const wasSent = cleared.includes(`${stage}_sent_at`)

  async function send() {
    if (busy || missing.length) return
    setBusy(true); setErr('')
    try {
      // THE QUEUE RUNS FIRST, ON PURPOSE. Reallocating after the send-back
      // would email the person who is no longer on it, and leave the new one
      // to find out by looking.
      if (to === 'queue') {
        const moved = await handStageOver(supabase, deal.id, stage as any, 'queue', byName)
        if (!moved.ok) { setErr(moved.error); setBusy(false); return }
      }
      const res = await fetch('/api/send-it-back', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, stage, why, note, by: byName }),
      })
      const out = await res.json().catch(() => ({}))
      if (!res.ok || out?.ok === false) {
        setErr(out?.error || 'That was not saved — nothing reached the database.')
        setBusy(false); return
      }
      onDone()
    } catch (e: any) {
      setErr(e?.message || 'That did not go through.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/45 flex items-start justify-center p-6 overflow-y-auto">
      <div className="bg-card rounded-2xl w-[560px] max-w-full shadow-[0_24px_64px_rgba(0,0,0,0.32)] overflow-hidden">
        <div className="px-5 pt-4">
          <h3 className="m-0 mb-1 text-[15.5px] font-bold text-ink">
            Sending the {what} back to {who?.name || 'credit'}
          </h3>
          <p className="m-0 mb-4 text-[12px] text-muted leading-relaxed">
            It goes to the top of their day with your words on it, and they are emailed.
            Nothing is deleted — the {what} they wrote stays on the deal.
          </p>
        </div>

        <div className="px-5">
          <span className="block text-[10px] font-bold tracking-[.07em] uppercase text-muted mb-1.5">
            What needs doing again?
          </span>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {Object.entries(REWORK_REASONS).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setWhy(w => w === k ? '' : k)}
                className={`${CHIP} ${why === k ? ON : OFF}`}>{label}</button>
            ))}
          </div>

          <span className="block text-[10px] font-bold tracking-[.07em] uppercase text-muted mb-1.5">
            In your words — this is what they read
          </span>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            className={`${INP} min-h-[84px] resize-y`}
            placeholder="e.g. Spoke to them this morning. They want to keep the Ipswich Rd place rather than sell, so run it on three securities." />
          <p className="mt-1.5 mb-4 text-[11px] text-faint leading-relaxed">
            This is the whole point of the box. It reaches them before they open anything.
          </p>

          <span className="block text-[10px] font-bold tracking-[.07em] uppercase text-muted mb-1.5">
            Back to
          </span>
          <div className="flex gap-1.5 flex-wrap mb-4">
            <button type="button" onClick={() => setTo('same')}
              className={`${PICK} ${to === 'same' ? PICK_ON : PICK_OFF}`}>
              {who?.name || 'Credit'} — they did it
            </button>
            <button type="button" onClick={() => setTo('queue')}
              className={`${PICK} ${to === 'queue' ? PICK_ON : PICK_OFF}`}>
              The credit queue
              <span className="block text-[10.5px] font-normal opacity-80">
                If they are away. Whoever is carrying the least
              </span>
            </button>
          </div>

          {wasSent && (
            <p className="mb-3 text-[11.5px] text-body bg-info-bg border border-info-edge rounded-[10px] px-3 py-2 leading-relaxed">
              This one has already gone to the client. Sending it back unlocks{' '}
              <b>Send to client</b> so the new figures can go out — and the date it first
              went is kept on the deal.
            </p>
          )}
          {err && <p className="mb-3 text-[12px] text-chase">{err}</p>}
        </div>

        <div className="flex gap-2 items-center px-5 py-3 bg-page border-t border-line-soft flex-wrap">
          <span className="flex-1 min-w-[190px] text-[11px] leading-relaxed">
            {missing.length > 0
              ? <span className="text-chase">Still to answer: {missing.map(m => m.message).join('; ')}.</span>
              : <span className="text-muted">Goes with your name and the time.</span>}
          </span>
          <button type="button" onClick={onCancel} className={BTN} disabled={busy}>Cancel</button>
          <button type="button" onClick={send} disabled={busy || missing.length > 0}
            className="text-[12px] bg-chase text-white rounded-lg px-3.5 py-1.5 font-bold disabled:opacity-40">
            {busy ? 'Sending…' : `Send it back to ${to === 'queue' ? 'the queue' : (who?.name?.split(' ')[0] || 'credit')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// THE RED BANNER ON THE DEAL, which is what credit sees when they open it.
//
// A list is not enough. Somebody who opens the deal from a link, from an email,
// or from the board has never seen the day's list - and the one thing they must
// not do is start reworking without reading why.
export function ReworkBanner({ rework, what }: { rework: any; what: string }) {
  if (!rework) return null
  const when = new Date(rework.at)
  const at = isNaN(when.getTime()) ? '' : when.toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit',
  })
  return (
    <div className="mb-3 bg-chase-bg border border-chase-edge rounded-xl px-4 py-3">
      <b className="block text-[13.5px] text-chase mb-1">
        ↺ {rework.by || 'The broker'} sent this {what} back{at ? ` on ${at}` : ''} — {rework.label}
        {rework.count > 1 ? ` (${rework.count} times now)` : ''}
      </b>
      {rework.note && (
        <span className="block text-[12.5px] text-body leading-relaxed">&ldquo;{rework.note}&rdquo;</span>
      )}
      <span className="block text-[11px] text-muted mt-1.5 leading-relaxed">
        Nothing was deleted — your workings are exactly as you left them.
        Pressing Done closes this and tells {rework.by || 'the broker'}.
      </span>
    </div>
  )
}
