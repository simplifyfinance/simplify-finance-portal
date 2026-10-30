import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'

// A SPLIT'S JOB IS NOT ITS POSITION IN THE LIST.
//
// 30 Oct 2026, the audit Fabio asked for after four deals in two days came out
// wrong the same way: "these issues need to stop."
//
// Four live faults, one habit:
//
//   the headline on four purchase emails quoted splits[0] while the cards
//     underneath printed two loans
//   the purchase LVR divided splits[0] by the price - the fault that told a
//     construction client there was no LMI to think about, still sitting in
//     the purchase branch six weeks after it was fixed next door
//   typing a purchase price rewrote splits[0] and left the rest of the
//     structure alone, so the loans stopped adding up to the purchase
//   the equity release LVR called the first two splits "the refinance", on a
//     deal whose refinance is splits 1, 2 and 4

const ROUTE = readFileSync('app/api/generate-email/route.ts', 'utf8')
const FORM = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

describe('THE HEADLINE IS THE WHOLE LENDING', () => {
  it('on every template that prints it', () => {
    expect(ROUTE).not.toContain("amt(d.splits?.[0]?.amount, '[amount]')")
    expect(ROUTE).toContain("amt(fmtNum(totalLending(d.splits)), '[amount]')")
  })

  it('and the cards underneath still print every split', () => {
    expect(ROUTE).toContain("splitCards(d, 'Owner-occupied loan'")
    expect(ROUTE).toContain("splitCards(d, 'Investment loan'")
  })
})

describe('THE PURCHASE LVR COUNTS EVERY SPLIT', () => {
  it('not the first one', () => {
    expect(FORM).not.toContain("const loanAmt = parseFloat((splits[0]?.amount || '0')")
    expect(FORM).toContain('const loanAmt = splitsTotal(splits)')
  })

  it('AND THE REFINANCE PART IS EVERYTHING THAT IS NOT BUYING THE HOUSE', () => {
    expect(FORM).not.toContain('splits.slice(0, 2)')
    expect(FORM).toContain('findPurchaseSplit(splits)')
  })
})

describe('AND A STRUCTURE SOMEBODY BUILT IS NOT OVERWRITTEN', () => {
  it('the price only fills in a deal with one loan on it', () => {
    expect(FORM).toContain('if (realCount <= 1) {')
  })

  it('and the deposit is worked back from all of them', () => {
    expect(FORM).not.toContain("const loanAmt = parseFloat((splits[0]?.amount")
  })
})

describe('AND IT CANNOT COME BACK A FIFTH TIME', () => {
  it('there is a guard, and the ship runs it', () => {
    expect(existsSync('scripts/check-split-position.sh')).toBe(true)
    expect(readFileSync('scripts/ship.sh', 'utf8')).toContain('./scripts/check-split-position.sh')
  })

  it('and it names every file that is still allowed one', () => {
    const guard = readFileSync('scripts/check-split-position.sh', 'utf8')
    for (const f of ['lib/bc-ready.ts', 'lib/deal-facts.ts', 'lib/loan-id.ts',
                     'app/api/generate-email/route.ts']) {
      expect(guard, `${f} is not accounted for`).toContain(f)
    }
  })

  it('AND SAYS WHAT TO DO INSTEAD', () => {
    const guard = readFileSync('scripts/check-split-position.sh', 'utf8')
    expect(guard).toContain('securityId')
    expect(guard).toContain('findPurchaseSplit')
  })

  it('and a file nobody listed is refused on sight', () => {
    expect(readFileSync('scripts/check-split-position.sh', 'utf8'))
      .toContain('is not on the list')
  })
})
