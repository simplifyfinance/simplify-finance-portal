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

// AND THE SAME ONE STAGE LATER.
//
// Moving from lending options to Compliance emails the client too - a different
// email, "Next steps - documents to sign and submission", about the credit guide
// and the lender application form. Fabio, 12 Oct 2026, having asked whether it
// did: "so build it!".
//
// THIS ONE WENT UP WITHOUT BEING TESTED. It was written while a ship was already
// running, and ship.sh does `git add -A` after the tests have passed - so the
// change was committed in b687fb1 having never been through them. These are the
// tests it should have had. Nothing is written while a ship is running again.
const LO_FORM = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')

describe('moving to Compliance', () => {
  it('offers both ways out', () => {
    expect(LO_FORM).toContain('Email the client and move')
    expect(LO_FORM).toContain('Just move to Compliance')
  })

  it('sends on one and not on the other', () => {
    expect(LO_FORM).toContain('handleMoveToCompliance(true)')
    expect(LO_FORM).toContain('handleMoveToCompliance(false)')
  })

  it('defaults to sending when nobody says otherwise', () => {
    expect(LO_FORM).toContain('async function handleMoveToCompliance(sendEmail = true)')
  })

  it('passes the choice to the route', () => {
    expect(LO_FORM).toContain("stage: 'LO', sendEmail })")
  })

  it('keeps emailing as the obvious one', () => {
    const i = LO_FORM.indexOf('handleMoveToCompliance(true)')
    expect(LO_FORM.slice(i, i + 400)).toContain('bg-ink text-page')
  })

  it('names which of the two happened afterwards', () => {
    expect(LO_FORM).toContain("'Moved to Compliance — client emailed'")
    expect(LO_FORM).toContain("'Moved to Compliance — client not emailed'")
    expect(LO_FORM).toContain("'Moved to Compliance — no email on file'")
  })

  // The dialog also asks whether the client took the recommended lender. That
  // question is the reason this popup is not the same component as the BC one,
  // and it must survive the rewrite.
  it('still asks whether they agreed with the recommended lender', () => {
    expect(LO_FORM).toContain('Did the client agree with the recommended lender')
  })

  it('still has a way to back out that does nothing', () => {
    expect(LO_FORM).toContain('setShowMoveToCompliancePopup(false)')
  })
})

// BIG ENOUGH TO READ.
//
// Fabio, 12 Oct 2026: "I like the box just need the pop up box to be slightly
// larger hard to read on current size". It asks somebody to decide whether an
// email goes to a real client, which is the wrong place to be squinting.
describe('the dialog is readable', () => {
  it.each([
    ['app/(app)/deals/[id]/BCForm.tsx'],
    ['app/(app)/deals/[id]/LOForm.tsx'],
  ])('%s is wide enough', (f) => {
    const code = readFileSync(f, 'utf8')
    expect(code).toContain('w-[560px]')
    expect(code, 'back to the old narrow box').not.toContain('w-[440px]')
    expect(code).not.toContain('w-[470px]')
  })

  it.each([
    ['app/(app)/deals/[id]/BCForm.tsx'],
    ['app/(app)/deals/[id]/LOForm.tsx'],
  ])('%s does not set the choices in the smallest type we have', (f) => {
    const code = readFileSync(f, 'utf8')
    const i = code.indexOf('Email the client and move')
    const block = code.slice(Math.max(0, i - 2200), i + 600)
    expect(block, 'the option descriptions are back to text-xs').not.toContain('text-xs text-gray-500 leading-snug')
  })
})
