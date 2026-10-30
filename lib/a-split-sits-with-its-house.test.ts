import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// A SPLIT GOES IN THE COLUMN OF THE HOUSE IT IS AGAINST.
//
// 30 Oct 2026. Fabio, on the Ollie Murphy email: "split 4, see it is clearly
// linked to security in Woodend, why does the HTML have that as a separate
// box?"
//
// The two columns on this template were written around three fixed positions -
// splits[0] and splits[1] on the left, splits[2] on the right - and anything
// past the third fell out of the bottom as "SPLIT 4" in a box with no house
// named on it. The comment above it said "A fourth split belongs to neither".
// It belongs to 18 Coach Rd, and says so on the split.

const ROUTE = readFileSync('app/api/generate-email/route.ts', 'utf8')
const BLOCK = ROUTE.slice(ROUTE.indexOf("template === 'investment_equity'"),
                          ROUTE.indexOf("template === 'debt_recycling'"))

describe('THE EQUITY RELEASE + PURCHASE EMAIL', () => {
  it('no longer reads the splits by position', () => {
    expect(BLOCK).not.toContain('d.splits?.[0]?.amount')
    expect(BLOCK).not.toContain('d.splits?.[1]?.amount')
    expect(BLOCK).not.toContain('d.splits?.[2]?.amount')
  })

  it('and names the purchase the same way the form does', () => {
    expect(BLOCK).toContain('findPurchaseSplit(eqSplits)')
  })

  it('AND NOTHING FALLS OUT OF THE BOTTOM ANY MORE', () => {
    // Every split is in one of the two columns, so there is no card left over
    // with no house named on it.
    expect(BLOCK).not.toContain("splitCards(d, 'Additional lending'")
    expect(BLOCK).not.toContain('from: 3')
  })

  it('and every split brings its own label', () => {
    // It printed "Existing loan refinanced" and "Equity access" whatever the
    // broker had called them, so two equity releases read as one.
    expect(BLOCK).toContain('colLines(sp, true)')
    expect(BLOCK).not.toContain('>Existing loan refinanced</span>')
  })

  it('and the summary card reads the loan that buys the house', () => {
    expect(BLOCK).toContain('loan: loanThatBuysIt(d)')
  })

  it('AND THE REPAYMENT TYPE CARRIES ITS INTEREST ONLY PERIOD', () => {
    // "Interest only" on its own reads as thirty years of it. One shared line
    // decides it everywhere - see repaymentTypeLine in lib/split-cards.ts.
    expect(BLOCK).toContain('repaymentTypeLine(sp, d.loanTerm)')
  })
})

describe('AND THE COLUMNS STILL SAY WHOSE HOUSE IS WHOSE', () => {
  it('the left is headed with the property they already own', () => {
    expect(BLOCK).toContain('Against ${securedHeading(d)')
  })

  it('and the right with the one being bought', () => {
    expect(BLOCK).toContain('Against new purchase')
  })
})
