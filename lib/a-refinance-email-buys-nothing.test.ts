// WHAT A CLIENT READS ON A REFINANCE.
//
// 13 Oct 2026. Katie sent the Veljovic lending options email - a complex
// refinance, three properties, nothing being purchased - and it opened with:
//
//   Purchase Price: $1,000,000
//   Stamp Duty: $40,000
//   Deposit Required (plus solicitor's fees and incidentals): $20,000
//   Existing Loan Balance: $0
//
// Not one of those was typed for this deal. The BC stopped showing a purchase
// box on a complex refinance on 12 Oct; the figures somebody entered before
// that are still sitting on the record, and the email printed them because it
// asked "is there a number in that box" rather than "does this deal buy
// anything".
//
// lib/buying.ts has answered the second question since 12 Oct. box-security.ts
// was taught to ask it on the compliance side the same day. This is the
// client-facing half, which is the half that actually goes to somebody.
//
// Invented clients, invented figures.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { buysNothing, isBuying } from './buying'

const route = readFileSync('app/api/generate-lo-email/route.ts', 'utf8')

describe('a scenario that buys nothing prints no purchase lines', () => {
  it('the email asks the deal, not the box', () => {
    expect(route).toContain("import { buysNothing } from '@/lib/buying'")
    expect(route).toContain('const buying = !buysNothing(d.bcTemplate || bcData?.template)')
  })

  it('and every purchase line waits on that answer', () => {
    for (const line of ['Purchase Price', 'Stamp Duty', 'Deposit Required']) {
      const at = route.indexOf(line)
      expect(at, `${line} is not in the email at all`).toBeGreaterThan(-1)
      // The guard sits within a few lines above each of them.
      expect(route.slice(Math.max(0, at - 400), at), `${line} prints without asking whether the deal buys anything`)
        .toMatch(/buying/)
    }
  })

  it('a complex refinance is one of the scenarios that buys nothing', () => {
    expect(buysNothing('complex_refinance')).toBe(true)
    expect(buysNothing('refinance_only')).toBe(true)
    expect(buysNothing('debt_recycling')).toBe(true)
    expect(isBuying('complex_refinance')).toBe(false)
  })

  it('and a purchase still is one', () => {
    expect(buysNothing('buy_sell')).toBe(false)
    expect(isBuying('buy_sell')).toBe(true)
  })
})

describe('a balance of nothing is not a balance', () => {
  // "0" is a truthy string. That one fact sent the deal down the refinance
  // branch and then printed a zero to a client.
  it('the line waits on the figure being above zero', () => {
    expect(route).toContain('if (owing > 0) body += p(`Existing Loan Balance:')
    expect(route).toContain("const owes = Number(String(d.existingLoan ?? '').replace(/[^0-9.]/g, '')) || 0")
  })

  // 16 Oct 2026. The figure PRINTED is no longer d.existingLoan - that is the
  // lending options' copy of one box, and on a deal secured by two houses it
  // holds one of them. It is now the total the BC recorded against the
  // securities. `owes` still decides which branch the email takes, which is a
  // question about whether anything is being refinanced at all.
  it('and the balance it prints comes from the BC, not from the LO copy', () => {
    expect(route).toContain('const owing = balanceTotal(bcData || {})')
    expect(route).toContain('const extra = releaseTotal(bcData || {})')
  })

  // THE INFERENCE IS GONE. "Total lending minus one balance" printed $131,608
  // of equity release on a straight refinance.
  it('and nothing works an equity release out by subtraction', () => {
    expect(route).not.toContain('equityReleaseAmount(')
  })
})

describe('one option is a lender, not lenders', () => {
  // Katie, 13 Oct 2026: "one option only so should be lender - we have
  // specifically focused on a specific lender".
  it('counted, not hard-coded, so it is still right at three', () => {
    expect(route).toContain("=== 1 ? 'a lender' : 'lenders'")
    expect(route, 'it is back to saying lenders whatever the count')
      .not.toContain('we focused on lenders that would offer the following')
  })
})
