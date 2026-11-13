// A HOUSE WITH TWO LOANS IS DRAWN ONE WAY, NOT TWO.
//
// 12 Nov 2026. Karen Terry's Pindari house carries $565,000 and $192,000.
// Fabio: "there is a split missing from the HTML email." It was not missing.
// It came out as a bare row under the loan term, labelled with the house,
// below a "New loan amount $757,000" that was really the two added together.
//
// THE CAUSE WAS TWO BUILDERS ANSWERING ONE QUESTION. refinanceBoxes inlined
// the first split and tacked the rest on; equityBoxes listed them all. Same
// data, same question, two layouts, and the weaker one was on the scenario
// where two loans on one house are rare enough that nobody looked.
//
// Fabio, that night: "find root cause so it doesnt have agin."
//
// THE GUARD IS THAT THERE IS NOW ONE FUNCTION AND BOTH CALL IT. The first
// describe block is what stops the next person quietly writing a third.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { refinanceBoxes, equityBoxes } from '@/app/api/generate-email/route'
import {
  loansAgainst, namesTheHouse, titleForLoan,
} from './loans-against-a-house'

const ROUTE = 'app/api/generate-email/route.ts'

/** One exported function's source, so a guard can look inside it alone. */
function bodyOf(code: string, name: string): string {
  const start = code.indexOf(`export function ${name}(`)
  expect(start, `${name} not found in ${ROUTE}`).toBeGreaterThan(-1)
  const next = code.indexOf('\nexport ', start + 1)
  return code.slice(start, next === -1 ? undefined : next)
}

describe('one way to show the loans, and every card asks for it', () => {
  const code = readFileSync(ROUTE, 'utf8')

  for (const name of ['refinanceBoxes', 'equityBoxes']) {
    it(`${name} asks for the loans rather than laying them out itself`, () => {
      const body = bodyOf(code, name)
      expect(body, `${name} must call loansAgainst()`).toContain('loansAgainst(')
      // Reaching into the splits is how both of these drifted apart. A card
      // builder says WHICH house and WHAT the total is called; the loans
      // underneath are not its business.
      expect(body, `${name} reaches into splits itself`).not.toMatch(/splits\[\d\]/)
      expect(body, `${name} slices the splits itself`).not.toContain('.slice(1)')
      expect(body, `${name} loops the splits itself`).not.toContain('splits.map(')
    })
  }
})

// KAREN'S REAL SHAPE, WITH HER REAL FIGURES. Two loans, one house, and both
// splits named after the house because that is what was typed.
const PINDARI = {
  property: '21 Pindari Drive South Penrith NSW 2750',
  heading: '21 Pindari Drive South Penrith NSW 2750',
  limit: 757000,
  drawn: 757000,
  balance: 753400,
  lvr: 68.8,
  splits: [
    { label: '21 Pindari Drive South Penrith', amount: '565000', rate: '6.64',
      type: 'Interest only', ioYears: '5', repayment: '3127' },
    { label: '21 Pindari Drive South Penrith', amount: '192000', rate: '6.64',
      type: 'Interest only', ioYears: '5', repayment: '1052' },
  ],
}

describe('two loans on one house', () => {
  const html = loansAgainst(PINDARI, '30', { one: 'New loan amount', many: 'Total new lending' })

  it('names both of them as loans', () => {
    expect(html).toContain('Loan 1')
    expect(html).toContain('Loan 2')
  })

  // THE ASSERTION THAT WOULD HAVE FAILED ON 12 NOVEMBER.
  it('shows both amounts, not just the first', () => {
    expect(html).toContain('$565,000')
    expect(html).toContain('$192,000')
  })

  it('calls the total a total', () => {
    expect(html).toContain('Total new lending')
    expect(html).toContain('$757,000')
    // "New loan amount $757,000" was the row that read as one loan.
    expect(html).not.toContain('New loan amount</span></td><td style="font-size:12px;'
      + 'color:#343333;font-weight:500;text-align:right"><span style="color:#343333;">$757,000')
  })

  // A LABEL BOX MUST NEVER DECIDE WHETHER A LOAN IS VISIBLE. Katie typed the
  // address into both, which is a reasonable thing to type.
  it('does not let a typed label stand in for the loan', () => {
    expect(html).not.toContain('Loan 2 — 21 Pindari Drive')
  })

  it('gives each loan the same rows', () => {
    expect(html.match(/Indicative rate/g)?.length).toBe(2)
    expect(html.match(/Estimated repayments/g)?.length).toBe(2)
    expect(html.match(/Loan term/g)?.length).toBe(2)
  })
})

// THE CASE THAT MATTERS MORE, BECAUSE IT IS MOST DEALS.
describe('one loan on one house is untouched', () => {
  const ONE = {
    property: '907/225 Pacific Hwy, NORTH SYDNEY NSW 2060',
    heading: '907/225 Pacific Hwy, NORTH SYDNEY NSW 2060',
    limit: 940000, drawn: 940000, balance: 938135, lvr: 78.3,
    splits: [{ label: '907/225 Pacific Hwy, NORTH SYDNEY', amount: '940000',
               rate: '6.64', type: 'Interest only', repayment: '5201' }],
  }
  const html = loansAgainst(ONE, '30', { one: 'New loan amount', many: 'Total new lending' })

  it('says New loan amount, as it always has', () => {
    expect(html).toContain('New loan amount')
    expect(html).toContain('$940,000')
  })

  it('is not numbered and has no total line', () => {
    expect(html).not.toContain('Loan 1')
    expect(html).not.toContain('Total new lending')
  })
})

describe('a label that is just the house again', () => {
  const house = '21 Pindari Drive South Penrith NSW 2750'

  it('is recognised even without the state and postcode', () => {
    expect(namesTheHouse('21 Pindari Drive South Penrith', house)).toBe(true)
    expect(namesTheHouse('21 PINDARI DRIVE, SOUTH PENRITH', house)).toBe(true)
  })

  it('and a real name is kept', () => {
    expect(namesTheHouse('Equity release', house)).toBe(false)
    expect(titleForLoan(1, { label: 'Equity release' }, house)).toBe('Loan 2 — Equity release')
    expect(titleForLoan(1, { label: '21 Pindari Drive South Penrith' }, house)).toBe('Loan 2')
  })

  it('and an empty one is simply a number', () => {
    expect(titleForLoan(0, { label: '' }, house)).toBe('Loan 1')
    expect(titleForLoan(0, {}, house)).toBe('Loan 1')
  })
})

// BOTH DOORS, ONE ANSWER - the point of the whole file.
describe('the two scenarios agree with each other', () => {
  const deal = (template: string) => ({
    template,
    loanTerm: '30',
    splits: PINDARI.splits.map(s => ({ ...s, securityId: 'p1' })),
    ffProperties: [{ id: 'p1', address: PINDARI.property, value: '1100000' }],
    propertyLimits: { p1: '757000' },
    securityBalances: { p1: '753,400' },
  })

  it('a refinance and an equity release draw two loans the same way', () => {
    const refi = refinanceBoxes(deal('refinance_only'))
    const equity = equityBoxes(deal('refinance_equity'))
    for (const html of [refi, equity]) {
      expect(html).toContain('Loan 1')
      expect(html).toContain('Loan 2')
      expect(html).toContain('$565,000')
      expect(html).toContain('$192,000')
    }
  })
})
