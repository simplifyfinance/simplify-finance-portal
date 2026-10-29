import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// NOT ONE FIGURE ACROSS TWO TRANSACTIONS. NOT IN THE EMAIL, NOT ON THE FORM.
//
// 29 Oct 2026. Fabio, on the securities block of the Mawing deal: "we DO NOT DO
// Total security and loan even in form, the boxes are blank."
//
// The block printed "Total security $2,680,000 against $2,230,000 — 83.2% LVR":
// a house worth $1,150,000 carrying $920,000, added to a house worth $1,530,000
// carrying $1,310,000. Two houses, two loans, two transactions, one percentage
// describing neither of them.
//
// AND THE BOXES UNDER IT WERE EMPTY, which is the sharper half. Nobody had typed
// an owes-now or a limit against that house. Each row's own LVR being worked out
// from the lending against it is right - that is one house and one answer. Two
// deals added together is not.
//
// 16 Oct 2026, the same instruction about the compliance notes: "when multiple
// properties I want the breakdown per property not combined." So it goes
// everywhere rather than being switched off on one template and left on four.

const FORM = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
const ROUTE = readFileSync('app/api/generate-email/route.ts', 'utf8')

describe('THE SECURITIES BLOCK', () => {
  it('prints no combined total', () => {
    expect(FORM).not.toContain('Total security')
  })

  it('and no combined LVR beside it', () => {
    expect(FORM).not.toContain('{pct(t.lvr)} LVR')
  })

  it('but every property still carries its own', () => {
    // 80% on the house they own, 85.6% on the one being bought.
    expect(FORM).toContain('{l === null ? \'\' : pct(l)}')
    expect(FORM).toContain('{lvrOf(buyRow) === null ? \'\' : pct(lvrOf(buyRow) as number)}')
  })

  it('AND THE PREMIUM STILL NAMES THE HOUSE IT WAS PRICED ON', () => {
    expect(FORM).toContain('recorded against')
  })

  it('and a value nobody recorded is still said out loud', () => {
    // A missing value makes every figure near it understated. That warning is
    // about one fact find, not about a total, so it stays.
    expect(FORM).toContain('so the total is understated')
  })
})

describe('AND THE EMAIL AGREES WITH IT', () => {
  it('no total lending across a deal that buys and refinances', () => {
    expect(ROUTE).toContain('if (canBuyAndRefinance(d?.template)) return')
  })

  it('AND THE GLANCE SAYS WHAT THE OPTION BUYS', () => {
    // Fabio, 29 Oct: "at glance still does not show what you mock up with
    // purchase price etc." The column said what they borrow and never what for.
    expect(ROUTE).toContain("['Purchase price', money(purchasePriceOf(bc))]")
  })

  it('and it is above the lending, not instead of it', () => {
    const at = ROUTE.indexOf('...buyingRow')
    expect(at).toBeGreaterThan(-1)
    expect(ROUTE.indexOf('...lendingRows')).toBeGreaterThan(at)
  })

  it('and a scenario that buys nothing prints no price', () => {
    expect(ROUTE).toContain('buys && buys > 0\n        ? [[\'Purchase price\'')
  })

  it('and the price is read from the box that scenario uses', () => {
    // An Equity release + purchase holds it in newPurchasePrice.
    expect(ROUTE).toContain('const buys = readMoney(purchasePriceOf(bc))')
  })
})
