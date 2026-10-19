"use client"
import { useEffect, useRef, useState } from 'react'
import type { ProceedState } from './actions'
import type { LenderOnOffer } from '@/lib/client-lender-choice'

// THE PAGE RECORDS ITSELF, ONCE, AFTER IT IS ON SCREEN - AND THEN SAYS WHAT IT
// RECORDED.
//
// 19 Oct 2026. Fabio asked for the confirm button to go: the client has already
// said yes by pressing the button in the email, and being asked a second time
// reads like the first press failed. "I don't understand the point of the
// second page. It should just be a landing page."
//
// THE ONE THING THIS MUST NOT UNDO is the fix from 31 Aug 2026 - "Proceed page:
// nothing happens until the client presses the button" - which was written
// because mail security scanners follow every link in an email and were moving
// deals for clients who had not read them.
//
// This is not that. That bug hung off the LINK: a scanner issues a GET, reads
// the HTML that comes back and stops. It does not mount React, it does not run
// an effect, and it does not POST. This write hangs off the rendered page, so
// the scanner records nothing and the client records once. Fabio was shown the
// August commit and chose this on 19 Oct 2026.
//
// ONCE IS DONE PROPERLY, not hoped for:
//   - a ref, because React runs effects twice in development and a second call
//     is wasted work even though the server ignores it
//   - the server is idempotent anyway: markProceeded checks the deal before it
//     writes, so a refresh, a back button or a forwarded link changes nothing
//
// AND THE BANK COMES BACK WITH THE ANSWER. The page itself never reads the
// lending options record - see the select in loadProceed and why it stays
// narrow - so the name the client is shown is the name that was just written
// against their confirmation. The two cannot drift apart.
//
// IT SAYS SO WHEN IT FAILS. This page cannot tell a client "we're going ahead
// with St George" over a write that did not land. That is the quiet failure
// that cost a month of proceeds in September, in a worse form, because this
// time there is no button left for them to press again.
export default function ConfirmedPanel({ action, clientName, children }: {
  action: () => Promise<ProceedState>
  clientName: string
  children: React.ReactNode
}) {
  const fired = useRef(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [offer, setOffer] = useState<LenderOnOffer | null>(null)
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    action()
      .then(r => {
        if (!r.ok) setFailed(r.error || 'That did not save.')
        else setOffer(r.offer ?? null)
        setSettled(true)
      })
      .catch(() => { setFailed('That did not save.'); setSettled(true) })
  }, [action])

  if (failed) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
        <div style={{ width: '56px', height: '56px', backgroundColor: '#FDEDED', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '22px', color: '#D32F2F', fontWeight: 'bold' }}>!</div>
        <p style={{ color: '#343333', fontSize: '15px', lineHeight: 1.5, margin: '0 0 8px', fontWeight: 700 }}>
          We could not record that just now
        </p>
        <p style={{ color: '#666', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
          Nothing has been lost, and nothing has been submitted. Please give us a call and we will
          sort it out straight away.
        </p>
      </div>
    )
  }

  // A held beat rather than a wrong sentence. Telling somebody their
  // application is going ahead before the write has landed is the one thing
  // this page must not do.
  if (!settled) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <p style={{ color: '#8A8278', fontSize: '13px', margin: 0 }}>Just a moment&hellip;</p>
      </div>
    )
  }

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: '26px' }}>
        <div style={{ width: '56px', height: '56px', backgroundColor: '#4FBBEA', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '22px', color: '#0F1115', fontWeight: 'bold' }}>&#10003;</div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#343333', margin: '0 0 6px' }}>
          Great news, {clientName}!
        </h1>
        <p style={{ fontSize: '13px', color: '#666', margin: 0, lineHeight: 1.5 }}>
          {offer
            ? `We're going ahead with ${offer.name}. Here's exactly what happens next.`
            : "We're moving your application forward. Here's exactly what happens next."}
        </p>
      </div>

      {/* THE BOX THAT NAMES WHAT THEY HAVE AGREED TO. The bank, the product and
          the loan amount - approved 19 Oct 2026. Each line is left out when it
          is not recorded, because a blank on a client's screen reads better
          than a label with nothing after it. The rate is deliberately not here:
          see lib/client-lender-choice.ts. */}
      {offer && (
        <div style={{ margin: '0 0 24px', backgroundColor: '#F7F4EF', border: '1px solid #E8E2D8', borderRadius: '10px', padding: '15px 16px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#8A8278', margin: '0 0 5px' }}>Going ahead with</p>
          <p style={{ fontSize: '17px', fontWeight: 700, color: '#343333', margin: 0 }}>{offer.name}</p>
          {[offer.product, offer.amount ? `Loan amount ${offer.amount}` : ''].filter(Boolean).map((l, i) => (
            <p key={i} style={{ fontSize: '12.5px', color: '#666', margin: '5px 0 0', lineHeight: 1.5 }}>{l}</p>
          ))}
        </div>
      )}

      {children}
    </>
  )
}
