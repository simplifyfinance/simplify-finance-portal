import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { propertyChecklist } from './property-checklist'

// WHAT A CLIENT IS TOLD ABOUT A NUMBER WE DO NOT HAVE.
//
// 29 Oct 2026, two faults from the same morning, both on emails that had
// already gone to clients.
//
// ONE: the option columns on the BC email printed a rate and a repayment and
// never said whether it was P&I or interest only. Fabio: "it is not stating PI
// or IO... we have requested this to be fixed multiple times." The helper that
// does it - repaymentTypeLine, in lib/split-cards.ts - already existed, was
// already tested, and was already used in nine other places in the same file.
// These columns were hand-written separately and never picked it up.
//
// TWO: Based on your numbers printed "Limit" and then nothing, on a credit card
// whose limit nobody had typed.
//
// Both are the same mistake wearing different clothes: printing the shape of an
// answer without the answer.

const ROUTE = readFileSync('app/api/generate-email/route.ts', 'utf8')

describe('AN OPTION COLUMN SAYS HOW THE LOAN IS REPAID', () => {
  /** Every column in this route that prints a Rate to a client. */
  const columns = () => {
    const out: string[] = []
    for (const m of ROUTE.matchAll(/Rate: \$\{[^}]+\}% p\.a\.\*/g)) {
      // The column is the <td> the rate sits in.
      const start = ROUTE.lastIndexOf('<td', m.index!)
      const end = ROUTE.indexOf('</td>', m.index!)
      out.push(ROUTE.slice(start, end === -1 ? m.index! + 600 : end))
    }
    return out
  }

  it('finds the columns, so the rule below is testing something', () => {
    expect(columns().length, 'no option column prints a rate any more').toBeGreaterThanOrEqual(3)
  })

  it('EVERY COLUMN THAT QUOTES A RATE ALSO SAYS P&I OR INTEREST ONLY', () => {
    // The rule, not the three fixes. A fourth column copied from a neighbour
    // fails here rather than reaching a client.
    const silent = columns().filter(c => !c.includes('repaymentTypeLine('))
    expect(silent.length,
      `${silent.length} option column(s) quote a rate and never say how it is repaid`).toBe(0)
  })

  it('and none of them writes the type out by hand', () => {
    // `Type: ${s.type}` was the LVR-compare column: it said "Interest only" and
    // never the IO period or what follows it, and printed a bare "Type:" when
    // nothing was set.
    expect(ROUTE).not.toContain('Type: ${s.type}')
  })

  it('and it goes through the one helper, which knows about the IO period', () => {
    expect(ROUTE).toContain("repaymentTypeLine } from '@/lib/split-cards'")
  })
})

describe('A LABEL WITH NOTHING AFTER IT IS NOT A LINE', () => {
  const ff = (liab: any) => ({
    applicants: [{ id: 'a1', firstName: 'Carolyn', lastName: 'Mbeki' }],
    properties: [],
    liabilities: [{ ownership: { a1: 'Yes' }, ...liab }],
  })
  const text = (liab: any) => propertyChecklist(ff(liab)).join(' ')

  it('A CREDIT CARD WITH NO LIMIT DOES NOT SEND THE WORD "LIMIT"', () => {
    // Fabio's screenshot: "Limit" and then white space, to a client.
    const out = text({ liabilityType: 'Credit card' })
    expect(out).toContain('Credit card')
    expect(out, 'the client is sent a label with nothing after it').not.toMatch(/Limit\s*</)
    expect(out).not.toMatch(/Limit\s*$/)
  })

  it('and one with a limit says it', () => {
    expect(text({ liabilityType: 'Credit card', limitAmount: '20,000' })).toContain('Limit $20,000')
  })

  it('AND THE LIABILITY ITSELF IS NEVER HIDDEN', () => {
    // Leaving a debt off a credit document to tidy a layout is not a trade
    // worth making. What goes is the empty label, not the fact.
    expect(text({ liabilityType: 'Credit card' })).toContain('Credit card')
    expect(text({ liabilityType: 'Car loan' })).toContain('Car loan')
  })

  it('and a car loan with nothing recorded has no dangling slash or comma', () => {
    const out = text({ liabilityType: 'Car loan' })
    expect(out).not.toContain('Repayment /')
    expect(out).not.toMatch(/,\s*Balance\s*</)
  })

  it('and a car loan with only a balance says only the balance', () => {
    const out = text({ liabilityType: 'Car loan', balance: '22,000' })
    expect(out).toContain('Balance $22,000')
    expect(out).not.toContain('Repayment')
  })

  it('and a repayment never appears without its frequency attached', () => {
    const out = text({ liabilityType: 'Car loan', repaymentAmount: '650', repaymentFrequency: 'Monthly' })
    expect(out).toMatch(/Repayment \$650\/month/i)
  })

  it('and HECS with no balance says nothing rather than "Balance"', () => {
    expect(text({ liabilityType: 'HECS' })).not.toMatch(/Balance\s*</)
  })

  it('and health insurance with no premium prints no bare slash', () => {
    expect(text({ liabilityType: 'Health Insurance' })).not.toContain('/month')
  })

  it('and a fully recorded card is word for word what it was', () => {
    const out = text({ liabilityType: 'Credit card', limitAmount: '20,000', status: 'To be closed' })
    expect(out).toContain('To be closed')
    expect(out).toContain('Limit $20,000')
  })
})
