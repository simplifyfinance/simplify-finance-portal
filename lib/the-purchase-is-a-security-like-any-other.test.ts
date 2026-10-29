import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { autoTagSplits } from './split-security-tag'
import { orphanSplits, securitiesWithPurchase, BEING_PURCHASED } from './securities'
import { lmiAmount, lmiBySecurity } from './lmi'

// THE HOUSE BEING BOUGHT IS THE SECURITY FOR THE LOAN THAT BUYS IT.
//
// 29 Oct 2026, both faults on one screen. Fabio, on an Equity release +
// purchase:
//
//   "equity release and purchase scenario on the purchase LVR is above 80%
//    and you are not giving me LMI"
//   "also look at it I cannot link the new purchase to the security at the top"
//
// 87.1% on the purchase and no LMI question anywhere, and a red line saying
// "1 split not against any security - New purchase" with no way to answer it.
//
// Invented clients. The shapes are real.

const FORM = fs.readFileSync(
  path.join(process.cwd(), 'app/(app)/deals/[id]/BCForm.tsx'), 'utf8')

const purchase = { label: 'New purchase', amount: '610,000', rate: '6.39', type: 'P&I' }
const refi = { label: 'Existing loan refinanced', amount: '480,000', rate: '6.14', type: 'P&I' }

describe('THE SPLIT THAT BUYS THE HOUSE POINTS AT THE HOUSE', () => {
  it('on Equity release + purchase, which is the one Fabio was looking at', () => {
    const out = autoTagSplits([refi, purchase], 'investment_equity', ['p1'])
    expect(out?.[1].securityId).toBe(BEING_PURCHASED)
  })

  it('AND THE RED LINE GOES, BECAUSE THE QUESTION IS ANSWERED', () => {
    // "1 split not against any security - New purchase. Pick one on the split,
    // or tick the property it belongs to." The property it belongs to has no
    // tick box, because nobody owns it yet.
    const secs = [{ id: 'p1' } as any]
    const before = orphanSplits([refi, purchase], secs).map((x: any) => x.label)
    expect(before, 'this is what he was seeing').toContain('New purchase')
    const after = autoTagSplits([refi, purchase], 'investment_equity', ['p1'])!
    expect(orphanSplits(after, secs).map((x: any) => x.label)).not.toContain('New purchase')
  })

  it('and a refinance split with no house is still a real question', () => {
    // Deliberately NOT auto-answered. The purchase names itself; every other
    // split is somebody's decision, and a deal can hold two securities.
    const after = autoTagSplits([refi, purchase], 'investment_equity', ['p1'])!
    expect(orphanSplits(after, [{ id: 'p1' } as any]).map((x: any) => x.label))
      .toContain('Existing loan refinanced')
  })

  it('and on Top up + purchase, which already worked', () => {
    const out = autoTagSplits([refi, purchase], 'top_up_purchase', ['p1'])
    expect(out?.[1].securityId).toBe(BEING_PURCHASED)
  })

  it('and it never points a purchase at a house being refinanced', () => {
    // The Alter Street fault of 15 Oct: a purchase loan parked on a property
    // that was not buying anything, and the LVR printed 124%.
    const out = autoTagSplits([purchase], 'investment_equity', ['p1'])
    expect(out?.[0].securityId).not.toBe('p1')
  })
})

describe('ONE TICKED SECURITY ANSWERS FOR THE REST, ON A TOP UP', () => {
  it('because choosing between one option is not a choice', () => {
    const out = autoTagSplits([refi], 'top_up', ['p1'])
    expect(out?.[0].securityId).toBe('p1')
  })

  it('but never where there are two, because then it is a real question', () => {
    expect(autoTagSplits([refi], 'top_up', ['p1', 'p2'])).toBe(null)
  })

  it('AND NOT ON THE OTHER TEMPLATES, EVEN WITH ONE SECURITY TICKED', () => {
    // Deliberate. On an equity release the purchase names itself and every
    // other split is still a question somebody has to answer.
    const out = autoTagSplits([refi, purchase], 'investment_equity', ['p1'])
    expect(out?.[0].securityId).toBeFalsy()
  })
})

describe('AND IT NEVER OVERWRITES AN ANSWER', () => {
  it('a split that already names a house keeps it', () => {
    const named = { ...purchase, securityId: 'p9' }
    const out = autoTagSplits([named], 'investment_equity', ['p1'])
    expect(out === null || out[0].securityId === 'p9').toBe(true)
  })

  it('and nothing to fill in means nothing to write', () => {
    expect(autoTagSplits([{ ...refi, securityId: 'p1' }], 'top_up', ['p1'])).toBe(null)
    expect(autoTagSplits([refi, purchase], 'refinance_only', ['p1'])).toBe(null)
    expect(autoTagSplits([], 'investment_equity', [])).toBe(null)
  })

  it('and rubbish in does not throw', () => {
    expect(() => autoTagSplits(null as any, 'investment_equity', null as any)).not.toThrow()
  })
})

describe('OVER 80% ON THE PURCHASE, SO THE PREMIUM IS ASKED FOR', () => {
  // $610,000 against $700,000 is 87.1% - the figure on his screen.
  const bc: any = {
    template: 'investment_equity',
    newPurchasePrice: '700,000',
    splits: [refi, { ...purchase, securityId: BEING_PURCHASED }],
    securityIds: ['p1'],
    securityLmiApplicable: { [BEING_PURCHASED]: 'Applicable' },
    securityLmi: { [BEING_PURCHASED]: '18,400' },
    securityLmiTreatment: { [BEING_PURCHASED]: 'capitalised' },
  }
  const ff = { properties: [{ id: 'p1', address: '4 Example St', value: '900,000' }] }

  it('the house being bought is a security row like any other', () => {
    const secs = securitiesWithPurchase(bc, ff)
    expect(secs.map(s => s.id)).toContain(BEING_PURCHASED)
  })

  it('AND THE PREMIUM RECORDED ON IT IS THE FIGURE EVERY SCREEN READS', () => {
    // Not a second box. The same per-property store the other securities use,
    // so the client email, the funds to complete and the compliance pack all
    // see it without being told anything new. See lib/lmi.ts.
    expect(lmiBySecurity(bc).map(r => r.id)).toEqual([BEING_PURCHASED])
    expect(lmiAmount(bc)).toBe(18400)
  })

  it('and waived records no premium', () => {
    expect(lmiAmount({ ...bc, securityLmiApplicable: { [BEING_PURCHASED]: 'Waived' } })).toBe(null)
  })
})

describe('THE FORM ASKS IT WHERE THE LVR IS SHOWN', () => {
  it('the new purchase panel carries the LMI question', () => {
    const panel = FORM.slice(FORM.indexOf('>New purchase</div>'))
    const lvr = panel.indexOf('LVR (calculated)')
    const lmi = panel.indexOf('LMI status')
    expect(lvr, 'the panel still shows its own LVR').toBeGreaterThan(-1)
    expect(lmi, 'and the question it raises').toBeGreaterThan(lvr)
  })

  it('and it writes into the per-property store, not a new field', () => {
    const panel = FORM.slice(FORM.indexOf('>New purchase</div>'))
    expect(panel).toContain('setSecurityLmiApplicable')
    expect(panel).toContain('setSecurityLmi(')
    expect(panel).toContain('setSecurityLmiTreatment')
  })

  it('and the tagging is done by the shared function, not a second copy', () => {
    expect(FORM).toContain('autoTagSplits(')
    expect(FORM).not.toContain("if (!isTopUp(template)) return\n    const ids = securityIds")
  })
})

describe('AND THE CARD UNDER THE TEMPLATE BUTTONS SAYS WHAT IS IN IT', () => {
  it('a buy and sell is not a refinance', () => {
    // 29 Oct 2026. Fabio: "Buy and sell scenario asking 'property being
    // refinanced'... same box for being sold and purchased so sentence needs
    // to match the intention of the boxes in that section."
    expect(FORM).toContain("'Sale and purchase'")
  })

  it('and a refinance still says so', () => {
    expect(FORM).toContain("'Property being refinanced'")
  })
})
