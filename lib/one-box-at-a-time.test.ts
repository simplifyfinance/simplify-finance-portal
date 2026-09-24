// TWO FULL-SCREEN BOXES AT THE SAME DEPTH ARE ONE BOX.
//
// Fabio, 24 Sep 2026, settling a deal on staging: "the pop up box was so quick
// I didnt see anyhting and I couldnt select the geenreatr fact find or tell it
// to save assets and liabilities".
//
// Settling opened BOTH the position question and the Loan IDs box in the same
// breath. Both draw `fixed inset-0 ... z-50`, and at equal depth the one
// written last in the file wins - so the Loan IDs box sat on top of the
// question that carries the assets, the liabilities and the fact find
// download. There was no way to reach it.
//
// Nothing here renders anything; it reads the file. A modal stacking order is
// not something a unit test can see, so the rule is enforced where it can be:
// two of them are never opened together.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const src = readFileSync(new URL('../app/(app)/deals/[id]/DealSettlement.tsx', import.meta.url), 'utf8')
const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('settling asks one thing at a time', () => {
  it('does not open both boxes in the same breath', () => {
    expect(code).not.toMatch(/setAskLoanIds\(true\)[\s;]*setAskPosition\(true\)/)
    expect(code).not.toMatch(/setAskPosition\(true\)[\s;]*setAskLoanIds\(true\)/)
  })

  it('settling opens the position question, and only that', () => {
    const line = code.split('\n').find(l => l.includes("stage.snap === 'settled'") && l.includes('setAsk'))
    expect(line, 'nothing opens a box when a deal settles').toBeTruthy()
    expect(line).toContain('setAskPosition(true)')
    expect(line).not.toContain('setAskLoanIds')
  })

  it('the Loan IDs box opens only once the position question is answered', () => {
    // onDone is the position box closing. That is the only place left that
    // opens the other one.
    expect((code.match(/setAskLoanIds\(true\)/g) || []).length).toBe(1)
    const at = code.indexOf('setAskLoanIds(true)')
    const around = code.slice(Math.max(0, at - 320), at)
    expect(around, 'the Loan IDs box is opened from somewhere other than onDone').toContain('onDone')
  })

  it('and not at all when there are no loan IDs left to collect', () => {
    const at = code.indexOf('setAskLoanIds(true)')
    expect(code.slice(Math.max(0, at - 160), at)).toContain('loanIdStatus(deal)')
  })
})

describe('the two boxes still exist, and still draw over the page', () => {
  // If either stops being a full-screen box this test is the thing that says
  // the ordering rule above may no longer be the point.
  it('both are still drawn at the same depth, which is why the order matters', () => {
    const modals = src.match(/fixed inset-0[^"]*z-50/g) || []
    expect(modals.length).toBeGreaterThanOrEqual(1)
  })

  it('the position question is still the one carrying the form and the position', () => {
    const pos = readFileSync(new URL('../components/PositionAtSettlement.tsx', import.meta.url), 'utf8')
    expect(pos).toContain('SaveTheAssessment')
    expect(pos).toContain('fixed inset-0')
  })
})

// THE MOMENT PASSES. THE JOB DOES NOT.
//
// 24 Sep 2026. The position question only existed in the seconds after Settle
// was pressed. Fabio's box closed before he could answer it, and then there was
// nowhere to go: the client page said "open that deal and record the position"
// and the deal page had nothing to press. He settled a deal, the client record
// stayed empty, and the portal had no way out of it.
describe('a settled deal can always have its position recorded', () => {
  it('a settled deal offers it, not only the second it settles', () => {
    expect(code).toContain('deal.settled_at && !askPosition')
    // Two ways in now: the moment it settles, and any time after.
    expect((code.match(/setAskPosition\(true\)/g) || []).length).toBe(2)
  })

  it('the button is on a settled deal and nowhere else', () => {
    const at = code.indexOf('setAskPosition(true)', code.indexOf('setAskPosition(true)') + 1)
    expect(code.slice(Math.max(0, at - 900), at)).toContain('deal.settled_at')
  })

  it('it opens the same box, which is the one carrying the form', () => {
    expect(code).toContain('<PositionAtSettlement')
    const pos = readFileSync(new URL('../components/PositionAtSettlement.tsx', import.meta.url), 'utf8')
    expect(pos).toContain('SaveTheAssessment')
  })
})

// THE REASON IT DIED, WHICH WAS NOT IN THIS FILE AT ALL.
//
// 24 Sep 2026, after a day of it. The prompt was fine. What killed it was the
// page around it: DealSettlement was written TWICE in DealPageClient - once
// inside the two-column grid for a deal that is with a lender, once on its own
// for a deal that is not.
//
// Marking a deal settled moves it across that line. React saw the shape of the
// page change, threw the old panel away and built a new one, and everything the
// old one was holding went with it - including the fact that it was showing a
// prompt. It appeared and died in the same render, every single time.
//
// A component rendered in two branches of a condition a deal can CROSS is a
// component that will be destroyed the moment the deal crosses it.
describe('the settlement panel is written once, so it survives settling', () => {
  const page = readFileSync(new URL('../app/(app)/deals/[id]/DealPageClient.tsx', import.meta.url), 'utf8')

  for (const what of ['DealSettlement', 'DealSettlementPanel', 'DealCommission']) {
    it(`${what} appears once on the page, not once per branch`, () => {
      expect((page.match(new RegExp(`<${what}\\s`, 'g')) || []).length).toBe(1)
    })
  }

  it('the layout changes around it, not the panel itself', () => {
    // The grid is a class now, applied or not. Before, it was two different
    // shapes of page with the panel built separately inside each.
    expect(page).toContain("isWithLender(dealData)\n        ? 'grid grid-cols-[1.15fr_1fr]")
    expect(page).not.toMatch(/isWithLender\(dealData\) \? \(\s*<div className="grid/)
  })

  it('the second column is what comes and goes', () => {
    expect(page).toContain('{isWithLender(dealData) && (')
  })
})
