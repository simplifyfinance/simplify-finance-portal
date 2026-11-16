'use client'
import { Act } from '@/components/TheBubble'
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

  // RED ON THE MARK, NOT ON THE PAPER.
  //
  // 16 Nov 2026. This was one purple band across the top of every deal, and
  // beside it sat the rework warning in a red box, and under that two more.
  // Fabio: "why does it have to be a big red thing that says rework? ... maybe
  // just the triangle is red and everything else is just a normal colour...
  // It's just too loud."
  //
  // So each thing nobody has started is an ordinary line on an ordinary card.
  // The triangle is red. The sentence that says what is wrong is red. The
  // sentence that gives the detail is grey, and the button is the same button
  // every other box uses. Nothing is hidden and nothing shouts.
  const Warn = ({ children }: { children: React.ReactNode }) => (
    <div className="quiet-warn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" />
      </svg>
      {children}
    </div>
  )

  return (
    <>
      {askDocs && (
        <Warn>
          <span className="key">
            Nobody has asked the client for {outstanding.length} document{outstanding.length === 1 ? '' : 's'}.
          </span>
          <Act tone="docs" small onClick={request} disabled={sending}>
            {sending ? 'Sending…' : 'Request them'}
          </Act>
        </Warn>
      )}

      {askBc && (
        <Warn>
          <span className="key">Nobody is down as doing the BC.</span>
          <span className="rest"><WhoIsDoingTheBc bare deal={deal} onUpdated={onUpdated} /></span>
        </Warn>
      )}

      {sent && <p className="m-0 mb-3 text-[12px] text-done">{sent}</p>}
      {err && <p className="m-0 mb-3 text-[12px] text-chase">{err}</p>}
    </>
  )
}
