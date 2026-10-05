'use client'
import { useState } from 'react'
import { outstandingFromDeal } from '@/lib/documents-outstanding'
import { requestDocuments } from '@/lib/request-documents'
import WhoIsDoingTheBc, { bcUnanswered } from '@/components/WhoIsDoingTheBc'

// WHAT NOBODY HAS STARTED ON THIS DEAL.
//
// one-inside-the-deal-v4.html, the band under the broker and credit officer
// line: one line saying what has not been begun, with the button to begin it.
//
// IT DRAWS NOTHING WHEN THERE IS NOTHING. Most deals, most days, this renders
// nothing at all - which is the only way a band at the top of a page is still
// worth reading on the day it does appear.
//
// IT IS PURPLE, NOT RED. Red on this portal means somebody has to do something
// now. Purple means it is sitting with somebody. Nothing here is late - it is
// work nobody has picked up yet, which is what the mock drew.
//
// THE NUMBER AND THE SEND ARE NOT ITS OWN. The count comes from
// lib/documents-outstanding.ts, which the documents box in the rail reads too,
// and the send from lib/request-documents.ts, which it presses too. One of
// each, so the top of the page and the rail cannot disagree.
export default function DealPrompts({ deal, onUpdated }: {
  deal: any
  onUpdated?: (patch: any) => void
}) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState('')
  const [err, setErr] = useState('')

  const outstanding = outstandingFromDeal(deal)
  const askDocs = outstanding.length > 0 && !sent
  const askBc = bcUnanswered(deal)
  const count = (askDocs ? 1 : 0) + (askBc ? 1 : 0)

  if (count === 0 && !sent && !err) return null

  async function request() {
    setSending(true); setErr(''); setSent('')
    const r = await requestDocuments(deal.id, outstanding.map(o => o.key))
    if (r.ok) {
      setSent(`Asked for ${outstanding.length} document${outstanding.length === 1 ? '' : 's'}.`)
      onUpdated?.(r.data?.deal || {})
    } else {
      setErr(r.error)
    }
    setSending(false)
  }

  return (
    <div className="bg-waiting-bg border border-waiting-edge rounded-xl px-4 py-3 mb-3">
      <div className="flex items-center gap-x-2.5 gap-y-2 flex-wrap text-[12.5px] text-waiting">
        {count > 0 && (
          <b className="font-semibold">
            {count === 1 ? 'One thing nobody has started.' : 'Two things nobody has started.'}
          </b>
        )}

        {askDocs && (
          <>
            <span>
              Nobody has asked the client for {outstanding.length} document{outstanding.length === 1 ? '' : 's'}.
            </span>
            <button onClick={request} disabled={sending}
              className="text-[11.5px] font-semibold text-waiting bg-card border border-waiting-edge
                rounded-[7px] px-3 py-1.5 hover:opacity-90 disabled:opacity-50">
              {sending ? 'Sending…' : 'Request them'}
            </button>
          </>
        )}

        {askDocs && askBc && <span aria-hidden className="w-px h-4 bg-waiting-edge" />}

        {askBc && <WhoIsDoingTheBc bare deal={deal} onUpdated={onUpdated} />}
      </div>

      {sent && <p className="m-0 mt-2 text-[12px] text-done">{sent}</p>}
      {err && <p className="m-0 mt-2 text-[12px] text-chase">{err}</p>}
    </div>
  )
}
