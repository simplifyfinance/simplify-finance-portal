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
