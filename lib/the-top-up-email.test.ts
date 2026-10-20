import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { topUpBoxes } from '../app/api/generate-email/route'
import { BUFFERED_TEMPLATES } from './buffer-note'

// THE TOP UP EMAIL, READ AS A CLIENT READS IT.
//
// Not as source text. A branch can contain every string a grep looks for and
// still print 30% where it should print 80% - see the note at the top of
// lib/two-boxes-on-a-refinance.test.ts.
//
// The deal is Fabio's own worked example, 20 Oct 2026: a house worth
// $1,000,000 with a $500,000 loan topped up by $300,000, beside a second house
// refinanced dollar for dollar.

const HARTLEY = 'p1'
const BERKELEY = 'p2'

const DEAL: any = {
  template: 'top_up_purchase', loanTerm: '30',
  securityIds: [HARTLEY, BERKELEY],
  securityBalances: { [HARTLEY]: '500,000', [BERKELEY]: '400,000' },
  securityIncreases: { [HARTLEY]: '300,000', [BERKELEY]: '160,000' },
  securityDollarForDollar: {},
  ffProperties: [
    { id: HARTLEY, address: '14 Hartley St, Marrickville NSW 2204', value: '1,000,000' },
    { id: BERKELEY, address: '9 Berkeley St, Speers Point NSW 2284', value: '800,000' },
  ],
  splits: [
    { label: 'Existing loan', amount: '500,000', rate: '6.14', type: 'Interest only', ioYears: '5', securityId: HARTLEY },
    { label: 'Loan increase', amount: '300,000', rate: '6.14', type: 'Interest only', ioYears: '5', securityId: HARTLEY },
    { label: 'Existing loan', amount: '400,000', rate: '6.14', type: 'Interest only', ioYears: '3', securityId: BERKELEY },
    { label: 'Loan increase', amount: '160,000', rate: '6.14', type: 'Interest only', ioYears: '5', securityId: BERKELEY },
  ],
}

const rows = (html: string): string[] =>
  html.replace(/<\/tr>/g, '\n').replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;|&#8212;/g, '—').replace(/&amp;/g, '&')
    .split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)

describe('a top up, kept as a separate split', () => {
  const out = rows(topUpBoxes(DEAL))

  // THE ONE THAT MATTERS. $500,000 + $300,000 against $1,000,000 is 80%.
  it('shows the LVR against the existing loan plus the increase', () => {
    expect(out).toContain('LVR 80%')
    expect(out).not.toContain('LVR 30%')
  })

  it('shows the second house its own way round', () => {
    expect(out).toContain('LVR 70%')
  })

  it('names what is owed now, the increase, and what it comes to', () => {
    expect(out).toContain('Your loan today $500,000')
    expect(out).toContain('Increase $300,000')
    expect(out).toContain('Total lending after the increase $800,000')
  })

  // Fabio, 20 Oct 2026: "if we mark it as a second split, then we can do the
  // repayments just on that split."
  it('prices the increase, not the whole facility', () => {
    expect(out).toContain('Indicative rate on the increase 6.14% p.a.*')
  })

  it('says how long the interest only runs', () => {
    expect(out.join(' ')).toContain('Interest only for 5 years')
  })

  it('says the existing loan is staying', () => {
    expect(out.join(' ')).toContain('Your existing loan stays as it is')
  })

  it('never calls any of it a refinance', () => {
    expect(out.join(' ')).not.toMatch(/refinanc/i)
  })
})

describe('a top up added to the current loan', () => {
  const out = rows(topUpBoxes({ ...DEAL, increaseMerged: true,
    splits: [
      { label: 'Loan increased', amount: '800,000', rate: '6.14', type: 'Interest only', ioYears: '5', securityId: HARTLEY },
      { label: 'Loan increased', amount: '560,000', rate: '6.14', type: 'Interest only', ioYears: '3', securityId: BERKELEY },
    ] }))

  // "just put one big loan that now from 500 is increasing to 800" - Fabio,
  // 20 Oct 2026.
  it('is one line at the new total', () => {
    expect(out).toContain('Your loan today $500,000')
    expect(out).toContain('Increases to $800,000')
    expect(out).not.toContain('Increase $300,000')
  })

  it('still reads 80%', () => {
    expect(out).toContain('LVR 80%')
  })
})

describe('a security ticked as dollar for dollar', () => {
  const MIXED = { ...DEAL, securityDollarForDollar: { [BERKELEY]: true },
    splits: [
      ...DEAL.splits.slice(0, 2),
      { label: 'Refinanced loan', amount: '400,000', rate: '6.14', type: 'Interest only', ioYears: '3', securityId: BERKELEY },
    ] }
  const out = rows(topUpBoxes(MIXED))

  it('shows no increase on that one, and the LVR is the balance alone', () => {
    expect(out).toContain('Existing loan balance $400,000')
    expect(out).toContain('New loan amount $400,000')
    expect(out).toContain('LVR 50%')
  })

  it('says the loan is moving across with nothing drawn out', () => {
    expect(out.join(' ')).toContain('moves across at the same balance')
  })

  it('leaves the topped up one exactly as it was', () => {
    expect(out).toContain('Total lending after the increase $800,000')
    expect(out).toContain('LVR 80%')
  })
})

describe('the buffer paragraph follows what is paid out', () => {
  const route = readFileSync('app/api/generate-email/route.ts', 'utf8')

  // A top up pays nothing out - the loan stays with the lender it is already
  // with, so there is no final repayment and no discharge fee. The paragraph
  // would be about a thing that is not happening.
  it('is asked of the securities on a top up, not the template', () => {
    expect(BUFFERED_TEMPLATES as readonly string[]).not.toContain('top_up')
    expect(BUFFERED_TEMPLATES as readonly string[]).not.toContain('top_up_purchase')
    const branch = route.slice(route.indexOf("template === 'top_up' || template === 'top_up_purchase'"),
                               route.indexOf("template === 'refinance_equity' && securedByMany(d)"))
    expect(branch).toContain('bufferNoteBlock(template, refis)')
  })
})

describe('the opening sentence is built, not written', () => {
  const route = readFileSync('app/api/generate-email/route.ts', 'utf8')
  const branch = route.slice(route.indexOf("template === 'top_up' || template === 'top_up_purchase'"),
                             route.indexOf("template === 'refinance_equity' && securedByMany(d)"))

  // "Nothing is being refinanced" is true of a plain top up and false the
  // moment one security is ticked. A sentence that is wrong on a document a
  // client keeps is worse than no sentence.
  it('asks the securities what is actually happening', () => {
    expect(branch).toContain('anyToppedUp(d)')
    expect(branch).toContain('anyRefinanced(d)')
  })

  it('has a version for all three cases', () => {
    expect(branch).toContain('increase your existing lending and move your remaining loan across')
    expect(branch).toContain('refinance your existing lending')
    expect(branch).toContain('increase your existing lending while keeping it where it is')
  })
})
