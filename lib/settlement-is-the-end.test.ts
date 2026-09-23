import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// FOUR THINGS FOUND BY ACTUALLY SETTLING A DEAL ON STAGING, 23 SEP 2026.
//
// The first day staging has been a real mirror, and the first time anybody had
// pressed "Mark as settled" on this build. All four are small; three of them
// had been there since the screen was written.

const settlement = readFileSync('app/(app)/deals/[id]/DealSettlement.tsx', 'utf8')
const prompt = readFileSync('components/PositionAtSettlement.tsx', 'utf8')

describe('a settled deal is the end of the road', () => {
  // Fabio: "if a deal is settled the what happens next shouldn't be there".
  // It was offering Lodged and Formal approval - stages that are behind you,
  // and pressing one would have written a lodged date after the settlement.
  it('offers no further stage once it has settled', () => {
    expect(settlement, 'stages are still offered after settlement')
      .toContain('.filter(() => !deal.settled_at)')
  })
})

describe('the split boxes', () => {
  it('the amount groups its thousands like every other money box', () => {
    // 100000 and 1000000 read the same at a glance, on the box that decides
    // what gets reported as settled.
    expect(settlement, 'the split amount is a plain input again')
      .toMatch(/<CurrencyInput[^>]*onChange=\{v => setSplit\(i, 'amount', v\)\}/)
  })

  it('a split typed by mistake can be removed', () => {
    expect(settlement, 'there is no way to remove a split')
      .toContain('setSplits(splits.filter((_, j) => j !== i))')
  })

  // Removable while it is being typed; not after. A recorded split is what
  // completed, and commission is worked out from it.
  it('the editor is only drawn before the stage is recorded', () => {
    const at = settlement.indexOf("setSplits(splits.filter((_, j) => j !== i))")
    const confirm = settlement.indexOf('Mark as settled')
    expect(at, 'the remove button is gone').toBeGreaterThan(-1)
    expect(confirm, 'the confirm step is gone - re-read this test').toBeGreaterThan(-1)
  })
})

describe('when there is nobody to record against', () => {
  // The same fault in a third costume: deciding not to act, and saying nothing.
  // Fabio settled a deal on staging, saw no prompt, and could not tell whether
  // the feature was broken or the deal was.
  it('it says so rather than drawing nothing', () => {
    expect(prompt, 'an unlinked deal silently shows no prompt again')
      .not.toMatch(/if \(linked\.length === 0\) return null/)
    expect(prompt).toContain('Nothing to record against')
    // A short fragment on purpose: the sentence is wrapped across two lines in
    // the JSX, so anything longer spans a newline and never matches.
    expect(prompt).toContain('no applicant on it is linked to a')
  })

  it('it tells them nothing was lost', () => {
    expect(prompt).toContain('Nothing is lost')
  })
})
