"use client"
import { useEffect, useRef, useState } from 'react'
import type { ProceedState } from './actions'

// "I'D RATHER TALK IT THROUGH FIRST", AND "I PRESSED THAT BY MISTAKE".
//
// 19 Oct 2026. The second button on the lending options email, and the honest
// no. Until today the client's page had one button and no way to disagree, so a
// client who was not comfortable simply did not press anything - and a deal
// waiting on a client who has decided against the recommendation looked exactly
// like a deal waiting on a client who had not opened the email.
//
// NOTHING MOVES. No stage, no credit officer, no documents, no card - see
// markWantsCall in lib/proceed-flow.ts for why that is the point rather than a
// shortcut. The client is told so in as many words, because the thing somebody
// in two minds is actually worried about is that pressing a button in an email
// has already committed them.
//
// It records from the rendered page for the same reason ConfirmedPanel does.
export default function TalkFirstPanel({ action, clientName, lenderName, backHref }: {
  action: () => Promise<ProceedState>
  clientName: string
  lenderName: string
  backHref: string
}) {
  const fired = useRef(false)
  const [failed, setFailed] = useState(false)
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    action()
      .then(r => { if (!r.ok) setFailed(true); setSettled(true) })
      .catch(() => { setFailed(true); setSettled(true) })
  }, [action])

  if (!settled) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <p style={{ color: '#8A8278', fontSize: '13px', margin: 0 }}>Just a moment&hellip;</p>
      </div>
    )
  }

  // A client who asked us to hold off and was not heard is worse off than one
  // who never pressed it, because they believe the message got through. So the
  // page says plainly that it did not, and tells them the one thing that is
  // still true: nothing has been submitted.
  if (failed) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
        <div style={{ width: '56px', height: '56px', backgroundColor: '#FDEDED', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '22px', color: '#D32F2F', fontWeight: 'bold' }}>!</div>
        <p style={{ color: '#343333', fontSize: '15px', lineHeight: 1.5, margin: '0 0 8px', fontWeight: 700 }}>
          We could not pass that on just now
        </p>
        <p style={{ color: '#666', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
          Nothing has been submitted to any lender. Please give us a call and we will talk it
          through.
        </p>
      </div>
    )
  }

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ width: '56px', height: '56px', backgroundColor: '#D8CCF0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '22px', color: '#5B3A9E', fontWeight: 'bold' }}>&#9742;</div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#343333', margin: '0 0 6px' }}>
          No problem, {clientName}
        </h1>
        <p style={{ fontSize: '13px', color: '#666', margin: 0, lineHeight: 1.5 }}>
          We have let your broker know and they will call you to talk it through.
        </p>
      </div>

      <div style={{ margin: '0 0 22px', backgroundColor: '#F7F4EF', border: '1px solid #E8E2D8', borderRadius: '10px', padding: '15px 16px' }}>
        <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#8A8278', margin: '0 0 5px' }}>Nothing has changed</p>
        <p style={{ fontSize: '17px', fontWeight: 700, color: '#343333', margin: 0 }}>Your application is on hold</p>
        <p style={{ fontSize: '12.5px', color: '#666', margin: '5px 0 0', lineHeight: 1.5 }}>Nothing has been submitted to any lender.</p>
        <p style={{ fontSize: '12.5px', color: '#666', margin: '5px 0 0', lineHeight: 1.5 }}>We will be in touch within one business day.</p>
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '11.5px', color: '#8A8278', lineHeight: 1.6 }}>
          Changed your mind?{' '}
          <a href={backHref} style={{ color: '#107EA8', textDecoration: 'underline' }}>
            {lenderName ? `Go ahead with ${lenderName}` : 'Go ahead after all'}
          </a>
        </p>
      </div>
    </>
  )
}
