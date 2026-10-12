import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// MOVING A DEAL ON WITHOUT WRITING TO THE CLIENT.
//
// 12 Oct 2026. Fabio: "sometimes we need the deal to go from BC straight to LO
// ... we dont so need that blockage to be an option".
//
// The dialog had one way forward and it always emailed. A client who had already
// sent their statements, or one being taken straight to a lender, did not need
// that email - and the only way to avoid it was Cancel, which left the deal on
// BC with the client never recorded as having agreed. The choice was between an
// email nobody wanted and a deal that could not move.
//
// THE TWO HALVES WERE ALREADY SEPARATE. markProceeded() records the agreement
// and moves the stage; the email is built after it. This stops short of the
// second half and changes nothing about the first.
const ROUTE = readFileSync('app/api/send-next-steps-email/route.ts', 'utf8')
const FORM = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

describe('the route', () => {
  it('takes the choice from the caller', () => {
    expect(ROUTE).toContain('const { dealId, stage, sendEmail } = await req.json()')
  })

  // ABSENT MEANS SEND. Every caller written before today, and the client's own
  // "ready to proceed" link, must behave exactly as they did.
  it('only skips the email when it is asked to, in those exact words', () => {
    expect(ROUTE).toContain('if (sendEmail === false)')
    expect(ROUTE).not.toContain('if (!sendEmail)')
  })

  it('still records the agreement and moves the stage first', () => {
    const i = ROUTE.indexOf('markProceeded(dealId, stage')
    const j = ROUTE.indexOf('if (sendEmail === false)')
    expect(i).toBeGreaterThan(-1)
    expect(j).toBeGreaterThan(i)
  })

  // The other way emailSent comes back false is a client with no address. The
  // two must never read the same afterwards.
  it('says that not sending was a decision, not a missing address', () => {
    expect(ROUTE).toContain('notSentOnPurpose: true')
    expect(ROUTE).toContain('No email on file for this client')
  })
})

describe('the dialog', () => {
  it('offers both ways out', () => {
    expect(FORM).toContain('Email the client and move')
    expect(FORM).toContain('Just move to LO')
  })

  it('sends on one and not on the other', () => {
    expect(FORM).toContain('handleMoveToLo(true)')
    expect(FORM).toContain('handleMoveToLo(false)')
  })

  // Emailing is still the normal case, so it keeps the dark button.
  it('keeps emailing as the obvious one', () => {
    const i = FORM.indexOf('handleMoveToLo(true)')
    const after = FORM.slice(i, i + 400)
    expect(after).toContain('bg-ink text-page')
  })

  it('still has a way to back out that does nothing', () => {
    expect(FORM).toContain('setShowMoveToLoPopup(false)')
  })

  it('defaults to sending when nobody says otherwise', () => {
    expect(FORM).toContain('async function handleMoveToLo(sendEmail = true)')
  })
})

describe('what it says afterwards', () => {
  it('names which of the two happened', () => {
    expect(FORM).toContain("'Moved to LO — client emailed'")
    expect(FORM).toContain("'Moved to LO — client not emailed'")
    expect(FORM).toContain("'Moved to LO — no email on file for client'")
  })

  it('reads the route\'s own word for a deliberate choice', () => {
    expect(FORM).toContain('data.notSentOnPurpose')
  })
})
