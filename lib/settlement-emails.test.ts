import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  loanDocumentsEmail, settlementNumbersEmail, settlementBookedEmail,
  settledEmail, monthInEmail, shouldSendNumbers, type SettlementEmailContext,
} from './settlement-emails'
import { REVIEW_URL } from './the-review-ask'

const base: SettlementEmailContext = {
  clientNames: 'Tomas and Lina',
  lenderName: 'Bankwest',
  settlementDate: 'Friday 28 November',
  senderName: 'Belle Tran',
  senderEmail: 'belle@simplifyfinance.com.au',
  senderPhone: '02 8355 4100',
  senderWeb: 'simplifyfinance.com.au',
}

const ALL = [
  loanDocumentsEmail(base), settlementNumbersEmail(base),
  settlementBookedEmail(base), settledEmail(base), monthInEmail(base),
]

describe('every one of them', () => {
  it('wears the brand shell and signs off', () => {
    for (const e of ALL) {
      expect(e.html).toContain('Simplify Finance')
      expect(e.html).toContain('Belle Tran')
      expect(e.subject.trim()).not.toBe('')
      expect(e.plainText.trim()).not.toBe('')
    }
  })

  // WORD PAINTS A BACKGROUND ONLY FROM THE ATTRIBUTE.
  it('paints every coloured cell with a bgcolor attribute', () => {
    for (const e of ALL) {
      const cells = e.html.match(/<td[^>]*background-color:[^>]*>/g) || []
      for (const c of cells) expect(/bgcolor=/i.test(c), c.slice(0, 80)).toBe(true)
    }
  })

  // Fabio has said it about every screen in this build.
  it('carries no amber anywhere', () => {
    for (const e of ALL) expect(e.html).not.toContain('#E8C98A')
  })

  it('takes its colours from the brand, never a hard-coded company', () => {
    const navy = { ...base, brand: {
      id: 'navigate', name: 'Navigate Finance', headerColor: '#101820',
      accentColor: '#7FD4C1', logoUrl: '', footerAddress: 'Sydney', acl: '387025',
      web: 'navigatefinance.com.au',
    } }
    // registrationFirst, because that note is where the accent is actually
    // used. The outstandings box uses the portal's shared pale blue instead -
    // see the note on outstandingBox about tinting an arbitrary accent.
    const e = loanDocumentsEmail({
      ...navy, outstandings: ['Signed loan documents'], registrationFirst: true })
    expect(e.html).toContain('Navigate Finance')
    expect(e.html).toContain('#7FD4C1')
    expect(e.html).not.toContain('Simplify Finance')
  })
})

// Fabio, 17 Nov 2026: "Still outstandings, make a light blue line around it to
// make sure it pops."
describe('what we are still waiting on', () => {
  // A WASH, NOT AN OUTLINE. Same pale blue every settlements screen uses.
  it('sits on the pale blue, not in a white box with a line round it', () => {
    const e = loanDocumentsEmail({ ...base, outstandings: ['Signed loan documents'] })
    expect(e.html).toContain('bgcolor="#EAF7FE"')
    expect(e.html).toContain('border:1px solid #BFE4F7')
    expect(e.html).toContain('Still outstanding')
  })

  // The heading and the ticks are inside the box, so they sit on the tint too -
  // a white strip behind the heading is the bug this catches.
  it('and everything inside it sits on the same tint', () => {
    const e = loanDocumentsEmail({ ...base, outstandings: ['Signed loan documents'] })
    const box = e.html.slice(e.html.indexOf('#EAF7FE'))
    const upToClose = box.slice(0, box.indexOf('</table></td>'))
    expect(upToClose).not.toContain('bgcolor="#ffffff"')
  })

  it('and no box at all when nothing is outstanding', () => {
    expect(loanDocumentsEmail(base).html).not.toContain('Still outstanding')
  })
})

// NOTHING IS INVENTED. An unanswered lender rule leaves its block out.
describe('the lender switches', () => {
  it('no insurance line without the exact name to put on it', () => {
    expect(loanDocumentsEmail(base).html).not.toContain('Building insurance')
    expect(loanDocumentsEmail({ ...base, insuredParty: 'Bankwest, a division of CBA' }).html)
      .toContain('Bankwest, a division of CBA')
  })

  it("NAB's blank page quirk appears only on a NAB deal", () => {
    const nab = loanDocumentsEmail({ ...base, lenderName: 'NAB', insuredParty: 'NAB Limited' })
    expect(nab.html).toContain('upload a blank page')
    expect(loanDocumentsEmail({ ...base, insuredParty: 'Bankwest' }).html)
      .not.toContain('upload a blank page')
  })

  // On a purchase the certificate comes from the solicitor; the client is never
  // asked. On a refinance, only where that lender wants it.
  it('strata is asked of the client on a refinance only, and only where required', () => {
    const buy = loanDocumentsEmail({ ...base, isStrata: true, isPurchase: true })
    expect(buy.html).toContain('directly from your solicitor')
    const refiNo = loanDocumentsEmail({ ...base, isStrata: true, isRefinance: true })
    expect(refiNo.html).not.toContain('strata manager')
    const refiYes = loanDocumentsEmail({
      ...base, isStrata: true, isRefinance: true, strataFromClient: true })
    expect(refiYes.html).toContain('strata manager')
  })

  it('the direct debit falls back to the plain ask', () => {
    expect(loanDocumentsEmail(base).html).toContain('direct debit form in your loan pack')
    expect(loanDocumentsEmail({ ...base, directDebitGuidance: 'Call 13 17 19 first.' }).html)
      .toContain('Call 13 17 19 first.')
  })

  it('and the first repayment is left out entirely where nobody has answered', () => {
    expect(settlementBookedEmail(base).html).not.toContain('first repayment')
    expect(settlementBookedEmail({ ...base, firstRepaymentIO: 'A month after it settled' }).html)
      .toContain('A month after it settled')
  })
})

// AN EMAIL HEADED "YOUR SETTLEMENT NUMBERS" WITH NOTHING IN IT IS WORSE THAN SILENCE.
describe('the settlement numbers', () => {
  const rows = [{ label: 'Loan amount', value: '$560,000' }]

  it('are not sent on a dollar-for-dollar refinance', () => {
    expect(shouldSendNumbers({ ...base, rows, dollarForDollar: true })).toBe(false)
  })

  it('nor when there are no figures to show', () => {
    expect(shouldSendNumbers(base)).toBe(false)
  })

  it('and are sent where there is something to tell them', () => {
    expect(shouldSendNumbers({ ...base, rows })).toBe(true)
  })
})

describe('the settled email', () => {
  it('asks for the review as a button, with the link only in the href', () => {
    const e = settledEmail(base)
    expect(e.html).toContain(`href="${REVIEW_URL}"`)
    expect(e.html.split(REVIEW_URL).length - 1).toBe(1)
    expect(e.html).toContain('Leave us a review')
  })

  it('and keeps the services and the BBQ line', () => {
    const e = settledEmail(base)
    expect(e.html).toContain('Vehicle and equipment finance')
    expect(e.html).toContain('BBQ')
  })
})

// THE COMMUNICATION BREAKDOWN NEVER LISTED THE FOUR CHECKS.
describe('one month in', () => {
  it('prints no checks until somebody says what they are', () => {
    expect(monthInEmail(base).html).not.toContain('Worth a look')
  })

  it('and prints them when they arrive', () => {
    const e = monthInEmail({ ...base, checks: ['Your first repayment came out'] })
    expect(e.html).toContain('Worth a look')
    expect(e.html).toContain('Your first repayment came out')
  })
})

// The review ask lives in exactly one of the six.
describe('the one review ask', () => {
  it('is in the settled email and nowhere else', () => {
    const others = [loanDocumentsEmail(base), settlementNumbersEmail(base),
      settlementBookedEmail(base), monthInEmail(base)]
    for (const e of others) expect(e.html).not.toContain(REVIEW_URL)
    expect(settledEmail(base).html).toContain(REVIEW_URL)
  })
})

// Nothing here sends. Fabio: "we're not building automatic emails."
describe('nothing sends itself', () => {
  it('the builders only build', () => {
    const src = readFileSync('lib/settlement-emails.ts', 'utf8')
    for (const never of ['resend', 'Resend', 'fetch(', 'supabase']) {
      expect(src, `${never} would mean this file can send`).not.toContain(never)
    }
  })
})
