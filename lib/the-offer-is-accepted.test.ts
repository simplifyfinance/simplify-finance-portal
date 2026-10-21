import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  buildOfferAcceptedEmail, valuationLine, loanMovedLine, depositPaidLine,
  sentWithWords, fixedYears, SENT_WITH,
  type OfferAcceptedContext,
} from './offer-accepted-email'
import { offerAcceptedBlocks } from './milestone-blocks'
import { TEMPLATES, menuFor } from './milestone-emails'

// THE OFFER ACCEPTED EMAIL.
//
// 21 Oct 2026. A pre-approved client has found a house. Built from Fabio's own
// blank template and one completed email a client actually received.
//
// HIS BLANK TEMPLATE CARRIED THREE THINGS TO DELETE BY HAND: two versions of
// the valuation paragraph wrapped in asterisks, a Queensland paragraph headed
// "DELETE IF NOT QLD", and five state names on the stamp duty line. Every one
// of them is answered by the deal now, and most of this file is about keeping
// it that way.

const ctx = (over: Partial<OfferAcceptedContext> = {}): OfferAcceptedContext => ({
  clientNames: 'Oliver and Margot',
  lenderName: 'Ubank',
  propertyAddress: '14 Dorrington Street, Ashgrove',
  valuation: 'desktop',
  sentWith: 'the Contract and rental appraisal',
  businessDays: '2',
  documents: ['Updated savings statement (Margot)'],
  extra: '',
  rows: [
    { label: 'Purchase price', value: '$1,200,000' },
    { label: 'Stamp duty (QLD)', value: '$48,000' },
    { label: "Total cost (plus solicitor's fees, and incidentals)", value: '$1,248,000' },
    { label: 'Loan amount', value: '$540,000' },
    { label: 'Your contribution required', value: '$708,000' },
  ] as any,
  details: [
    { label: 'Product', value: 'Flex Home Loan' },
    { label: 'Interest rate', value: '6.55%' },
  ],
  loanMoved: 'no change',
  depositPaid: '',
  blocks: offerAcceptedBlocks({}),
  fixedTerm: '',
  rateNotice: '',
  senderName: 'Fabio De Castro',
  senderEmail: 'fabio@simplifyfinance.com.au',
  senderPhone: '',
  senderWeb: '',
  ...over,
})

describe('it is one of the deal templates', () => {
  it('is in the list, so both doors open on their own', () => {
    const t = TEMPLATES.find(x => x.id === 'offer_accepted')
    expect(t, 'offer_accepted is not in TEMPLATES').toBeTruthy()
    expect(t!.name).toBe('Offer accepted')
  })

  // THERE IS NO LETTER FROM A BANK. An email that says "please find attached"
  // with nothing attached is a phone call, and this one says no such thing.
  it('promises no attachment, because there is none', () => {
    expect(TEMPLATES.find(x => x.id === 'offer_accepted')!.letterRequired).toBe(false)
  })

  // Fabio, 21 Oct 2026: "I don't want it to be locked to any stage. It's always
  // available." An agent rings the client; nothing in the record knows the
  // moment an offer is accepted.
  it('is available on any deal, at any stage', () => {
    const bare = menuFor({}, [])
    const row = bare.find((r: any) => r.id === 'offer_accepted')
    expect(row, 'offer_accepted is missing from the menu').toBeTruthy()
    expect(row!.state).toBe('ready')
  })
})

describe('the valuation paragraph', () => {
  it('says it came back at price on a desktop valuation', () => {
    const line = valuationLine(ctx({ valuation: 'desktop' }))
    expect(line).toContain('come back at purchase price')
    expect(line).toContain('the Contract and rental appraisal')
    expect(line).toContain('Ubank')
  })

  // A full valuation has not happened yet, so it cannot have come back at
  // anything. His own wording promises a call about the inspection instead.
  it('promises an inspection date on a full valuation', () => {
    const line = valuationLine(ctx({ valuation: 'full' }))
    expect(line).toContain('inspection date')
    expect(line).not.toContain('come back at purchase price')
  })

  it('still says something when no valuation has been ordered', () => {
    const line = valuationLine(ctx({ valuation: 'none' }))
    expect(line).toContain('arranging the valuation')
    expect(line.length).toBeGreaterThan(20)
  })

  // Only one of the three can reach a client, which is the whole point of the
  // choice. His template had two of them in the same email with asterisks
  // around them and a note to delete one.
  it('puts exactly one of them in the email', () => {
    const html = buildOfferAcceptedEmail(ctx({ valuation: 'desktop' })).html
    expect(html).toContain('come back at purchase price')
    expect(html).not.toContain('inspection date')
    expect(html).not.toContain('arranging the valuation')
  })
})

describe('the Queensland paragraph', () => {
  const insurance = 'recommend taking out insurance'

  it('is there on a Queensland purchase', () => {
    const blocks = offerAcceptedBlocks({ bc_data: { dutyState: 'QLD' } })
    expect(buildOfferAcceptedEmail(ctx({ blocks })).html).toContain(insurance)
  })

  // ANYWHERE ELSE THE SENTENCE IS WRONG, not merely unnecessary - risk passes
  // at settlement, not at contract.
  it('is absent everywhere else, and nobody deletes anything', () => {
    for (const state of ['NSW', 'VIC', 'WA', 'SA']) {
      const blocks = offerAcceptedBlocks({ bc_data: { dutyState: state } })
      expect(buildOfferAcceptedEmail(ctx({ blocks })).html,
        `${state} should not get the Queensland paragraph`).not.toContain(insurance)
    }
  })

  it('is absent when no state is recorded at all', () => {
    expect(buildOfferAcceptedEmail(ctx({ blocks: offerAcceptedBlocks({}) })).html)
      .not.toContain(insurance)
  })
})

describe('the fixed rate line', () => {
  const tick = (key: string) => offerAcceptedBlocks({}).map(b => b.key === key ? { ...b, on: true } : b)

  // Fabio asked for a tick box rather than a lender library field: it is a
  // thing a broker offers a particular client, not a fact about a bank.
  it('is off until somebody ticks it', () => {
    expect(offerAcceptedBlocks({}).find(b => b.key === 'fixed_rate')!.on).toBe(false)
    expect(buildOfferAcceptedEmail(ctx()).html).not.toContain('rate lock')
  })

  it('appears with the term when it is ticked', () => {
    const html = buildOfferAcceptedEmail(ctx({ blocks: tick('fixed_rate'), fixedTerm: '3 year' })).html
    expect(html).toContain('rate lock')
    expect(html).toContain('3 year')
  })
})

describe('the figures', () => {
  it('prints the five lines it was given and invents none', () => {
    const html = buildOfferAcceptedEmail(ctx()).html
    for (const v of ['$1,200,000', '$48,000', '$1,248,000', '$540,000', '$708,000']) {
      expect(html, `${v} is missing`).toContain(v)
    }
  })

  // THE ARITHMETIC IS NOT DONE HERE. purchaseRows owns it, including taking a
  // capitalised LMI out of the loan before working out the funds to complete -
  // the fault that told a client to bring the premium's worth less cash than
  // they needed on 14 Oct 2026.
  it('does no arithmetic of its own', () => {
    const file = readFileSync('lib/offer-accepted-email.ts', 'utf8')
    expect(file).not.toMatch(/price\s*\+\s*duty/)
    expect(file).not.toMatch(/total\s*-\s*loan/)
  })

  it('leaves the money block out entirely rather than printing a fragment', () => {
    const html = buildOfferAcceptedEmail(ctx({ rows: [] })).html
    expect(html).not.toContain('Your final purchase numbers')
  })
})

describe('what the deal works out for itself', () => {
  it('says the loan has not moved when it has not', () => {
    expect(loanMovedLine({ contract_loan_amount: 540000, lo_data: { loanAmount: 540000 } }))
      .toBe('no change')
  })

  it('says which way it moved when it has', () => {
    expect(loanMovedLine({ contract_loan_amount: 560000, lo_data: { loanAmount: 540000 } }))
      .toContain('increased from')
    expect(loanMovedLine({ contract_loan_amount: 520000, lo_data: { loanAmount: 540000 } }))
      .toContain('reduced from')
  })

  // SILENT WHERE IT CANNOT TELL. "No change" on a deal where nobody has
  // answered the funding is a claim, not an answer.
  it('says nothing when the contract funding has not been answered', () => {
    expect(loanMovedLine({ lo_data: { loanAmount: 540000 } })).toBe('')
    expect(loanMovedLine({})).toBe('')
  })

  it('names what has already gone in, and only when there is something', () => {
    expect(depositPaidLine({ deposit_paid: 60000 })).toContain('$60,000')
    expect(depositPaidLine({ deposit_paid: 0 })).toBe('')
    expect(depositPaidLine({})).toBe('')
  })
})

describe('what it looks like', () => {
  it('opens with the address in the band and in the subject', () => {
    const built = buildOfferAcceptedEmail(ctx())
    expect(built.subject).toContain('14 Dorrington Street, Ashgrove')
    expect(built.html).toContain('14 Dorrington Street, Ashgrove is yours')
  })

  it('still works on a deal with no address recorded', () => {
    const built = buildOfferAcceptedEmail(ctx({ propertyAddress: '' }))
    expect(built.subject).toContain('Congratulations')
    expect(built.html).toContain('Congratulations on your purchase')
  })

  // Fabio, 21 Oct 2026, on the party hat in his own template: "dont like emoji
  // party hat". Nothing else this portal sends to a client carries one.
  it('carries no emoji at all', () => {
    const built = buildOfferAcceptedEmail(ctx())
    expect(built.html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{FE0F}]/u)
    expect(built.plainText).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{FE0F}]/u)
  })

  it('carries the documents it was asked to chase, and nothing else', () => {
    const html = buildOfferAcceptedEmail(ctx({ documents: ['A payslip (Oliver)'] })).html
    expect(html).toContain('A payslip (Oliver)')
    expect(html).not.toContain('Updated savings statement')
  })

  it('has a plain text version that is not empty and not HTML', () => {
    const built = buildOfferAcceptedEmail(ctx())
    expect(built.plainText.length).toBeGreaterThan(100)
    expect(built.plainText).not.toContain('<')
  })
})

// ---------------------------------------------------------------------------
// WHAT WORD DOES TO IT
// ---------------------------------------------------------------------------

describe('it survives Outlook', () => {
  const html = buildOfferAcceptedEmail(ctx({
    blocks: offerAcceptedBlocks({ bc_data: { dutyState: 'QLD' } }),
    rateNotice: 'This rate reflects the recent RBA increase.',
    depositPaid: 'Of that, <b>$60,000</b> has already been paid as your deposit.',
  })).html

  it('uses no rgba, which Word drops', () => {
    expect(html).not.toContain('rgba(')
  })

  it('paints no background without a bgcolor attribute beside it', () => {
    // Every <td> that sets a background in a style must carry the attribute
    // too, because the attribute is the only one Word reads.
    const cells = html.match(/<td[^>]*background-color:[^>]*>/g) || []
    for (const cell of cells) {
      expect(cell, `a cell paints without bgcolor: ${cell}`).toContain('bgcolor=')
    }
  })
})

// ---------------------------------------------------------------------------
// A BROWSER CANNOT WRITE A SENTENCE IN A CLIENT EMAIL
// ---------------------------------------------------------------------------
//
// 21 Oct 2026. The first version of this template posted "the Contract and
// rental appraisal" as typed text, and the finished bullet list of documents.
// lib/emails-survive-the-lock.test.ts refused both, and it was right: a page
// that can write half a sentence in a client email can write any sentence in
// it. The screen posts keys now and these turn them into English.

describe('what went with the contract', () => {
  it('turns ticks into a phrase', () => {
    expect(sentWithWords(['contract'])).toBe('the Contract')
    expect(sentWithWords(['contract', 'rental_appraisal']))
      .toBe('the Contract and a rental appraisal')
    expect(sentWithWords(['contract', 'rental_appraisal', 'building_pest']))
      .toBe('the Contract, a rental appraisal and the building and pest report')
  })

  it('says nothing when nothing is ticked', () => {
    expect(sentWithWords([])).toBe('')
    expect(sentWithWords(undefined)).toBe('')
  })

  // THE WHOLE POINT. A key that is not one of ours contributes no words.
  it('ignores anything that is not one of the keys we know', () => {
    expect(sentWithWords(['and your loan has been declined'])).toBe('')
    expect(sentWithWords(['contract', 'nonsense'])).toBe('the Contract')
  })

  it('has a key and words for every option on the screen', () => {
    for (const x of SENT_WITH) {
      expect(x.key).toMatch(/^[a-z_]+$/)
      expect(x.words.length).toBeGreaterThan(2)
    }
  })
})

describe('the fixed rate term', () => {
  it('is a number of years, written out here', () => {
    expect(fixedYears('3')).toBe('3 year')
    expect(fixedYears(5)).toBe('5 year')
  })

  // Anything but digits falls back rather than reaching a client.
  it('refuses a phrase and uses two', () => {
    expect(fixedYears('2 year, and your rate has gone up')).toBe('2 year')
    expect(fixedYears('nonsense')).toBe('2 year')
    expect(fixedYears('')).toBe('2 year')
    expect(fixedYears('0')).toBe('2 year')
    expect(fixedYears('99')).toBe('2 year')
  })
})
