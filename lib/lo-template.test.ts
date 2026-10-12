import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { loTemplateFor, settleLoTemplate, isRefinanceScenario } from './lo-template'

// THE LENDING OPTIONS PAGE WAS SHOWING A PURCHASE ON A REFINANCE.
//
// 12 Oct 2026. A complex refinance opened its lending options on "LO Purchase",
// and that one value turns on Purchase price, Deposit, Stamp duty, a duty State
// and an LVR worked out from a purchase price that does not exist - which then
// warned "stamp duty exceeds the deposit" on a deal with neither.
//
// Two separate faults. The rule was written out three times by hand inside the
// form and complex refinance was missing from one copy; and the correction was
// only ever applied through the setter the form uses when it is arranging
// itself, which deliberately never writes - so the database kept the wrong
// answer and put it back on screen every time the record arrived.
describe('which lending options email a scenario calls for', () => {
  it.each([
    ['refinance_only'], ['refinance_equity'], ['debt_recycling'], ['complex_refinance'],
  ])('%s is a refinance', (t) => {
    expect(loTemplateFor(t)).toBe('lo_refinance')
    expect(isRefinanceScenario(t)).toBe(true)
  })

  it('bridging has its own email', () => {
    expect(loTemplateFor('bridging')).toBe('lo_bridging')
  })

  it.each([['oo_purchase'], ['investment_purchase'], ['fhb'], ['construction'], ['smsf']])(
    '%s is a purchase', (t) => {
      expect(loTemplateFor(t)).toBe('lo_purchase')
      expect(isRefinanceScenario(t)).toBe(false)
    })

  // Nothing known is not a refinance. An unknown template keeps the behaviour
  // every deal written before templates existed already had.
  it.each([[''], ['custom'], [undefined], [null], [42]])('%s falls back to the purchase email', (t) => {
    expect(loTemplateFor(t)).toBe('lo_purchase')
  })
})

describe('a stale template in the database cannot win', () => {
  // The exact shape of the deal that was wrong.
  const stored = { template: 'lo_purchase', purchasePrice: '1,000,000', deposit: '20,000' }

  it('a complex refinance holding "LO Purchase" is put right on the way to the screen', () => {
    expect(settleLoTemplate(stored, 'complex_refinance')).toBe('lo_refinance')
  })

  it('and it is put right every time, not once', () => {
    expect(settleLoTemplate(stored, 'complex_refinance')).toBe('lo_refinance')
    expect(settleLoTemplate(stored, 'complex_refinance')).toBe('lo_refinance')
  })

  it('a record with nothing stored at all still gets the right one', () => {
    expect(settleLoTemplate({}, 'complex_refinance')).toBe('lo_refinance')
    expect(settleLoTemplate(undefined, 'debt_recycling')).toBe('lo_refinance')
  })

  // The other half: somebody who picks the template themselves keeps it. This
  // is the same line the form already draws for the loan amount and the
  // refinance splits.
  it('somebody who chose the template keeps it', () => {
    expect(settleLoTemplate({ template: 'lo_purchase', templateByHand: true }, 'complex_refinance'))
      .toBe('lo_purchase')
  })

  it('but a chosen template that is not a real template is ignored', () => {
    expect(settleLoTemplate({ template: 'lo_nonsense', templateByHand: true }, 'complex_refinance'))
      .toBe('lo_refinance')
  })

  it('and a record that only LOOKS chosen is not trusted', () => {
    expect(settleLoTemplate({ template: 'lo_purchase', templateByHand: 'yes' }, 'complex_refinance'))
      .toBe('lo_refinance')
  })
})

// THE RULE LIVES IN ONE PLACE NOW. It was three copies, and the copies drifted.
describe('the form does not keep its own copy of the rule', () => {
  const FORM = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')

  it('no hand-written template ternary is left in the lending options form', () => {
    expect(FORM).not.toContain("startsWith('refinance') || isDebtRecycling")
  })

  it('every stored record is settled on its way to the screen', () => {
    expect(FORM).toContain('settleLoTemplate')
    // Both doors: the first record at open, and every record that arrives after.
    expect(FORM.match(/settleLoTemplate\(/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('picking one by hand is recorded as a choice', () => {
    expect(FORM).toContain('templateByHand: true')
  })
})
