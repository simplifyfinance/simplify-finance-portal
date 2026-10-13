// AN EDIT BUTTON ON THE LENDING OPTIONS, AND WHY IT DOES NOT UNDO THE DAY.
//
// 12 Oct 2026 was spent removing two copies of one figure. 13 Oct 2026 Fabio
// asked for the lending options to be able to change a split amount, a property
// value and a rate without leaving the page: "I want an edit button next to
// loan amount property value and rates in the LO and that allow changes
// accross".
//
// Those two are not in conflict, and the distinction is the whole of this file.
// The fault was two COPIES of a figure, drifting apart. It was never two places
// to type. A figure edited here is written where it lives - the BC's split, the
// fact find's property - and the lending options goes on reading it. One copy.
//
// Fabio first asked for a yes/no afterwards. He then said: "now that I come
// think about it is alwasy yes so pop up just warnign sayibng we are changing
// ff we are changin BC." Which is right - a "no" that kept a different number
// on the lending options would have rebuilt the fault, and worse, because it
// would have looked deliberate.
//
// Invented clients, invented figures.
import { describe, it, expect } from 'vitest'
import {
  withSplitAmount, withPropertyValue, splitAmountEffect, propertyValueEffect,
  rateEffect, columnFor, LANDS_SAY,
} from './edit-across'
import { splitsOf } from './deal-structure'
import { loanAmount, securityValue } from './funds-to-complete'

const deal = () => ({
  id: 'd1',
  bc_data: {
    loanTerm: '30',
    securityIds: ['p1', 'p2'],
    splits: [
      { label: 'Existing Investment Home loan', amount: '1313000', type: 'Interest only', purpose: 'INV', securityId: 'p1' },
      { label: 'Investment equity loan split', amount: '447000', type: 'Interest only', purpose: 'INV', securityId: 'p2' },
    ],
  },
  fact_find_data: {
    properties: [
      { id: 'p1', address: '16 Spring Street Paddington', value: '2200000' },
      { id: 'p2', address: '7/22-26 Russell Street Hawks Nest', value: '600000' },
    ],
  },
  lo_data: {}, compliance_data: {},
})

describe('the change is written where the figure lives', () => {
  it('a split amount goes onto the borrowing capacity', () => {
    const bc = withSplitAmount(deal().bc_data, 1, '500000')
    expect(bc.splits[1].amount).toBe('500000')
    expect(bc.splits[0].amount).toBe('1313000')
  })

  it('and nothing else on the split is disturbed', () => {
    const bc = withSplitAmount(deal().bc_data, 1, '500000')
    expect(bc.splits[1].type).toBe('Interest only')
    expect(bc.splits[1].securityId).toBe('p2')
  })

  it('a property value goes onto the fact find', () => {
    const ff = withPropertyValue(deal().fact_find_data, 'p1', '2350000')
    expect(ff.properties[0].value).toBe('2350000')
    expect(ff.properties[1].value).toBe('600000')
  })

  it('each kind knows its own column', () => {
    expect(columnFor('bc')).toBe('bc_data')
    expect(columnFor('factfind')).toBe('fact_find_data')
    expect(columnFor('lo')).toBe('lo_data')
  })

  it('and an index or an id that matches nothing changes nothing', () => {
    expect(withSplitAmount(deal().bc_data, 9, '1').splits[0].amount).toBe('1313000')
    expect(withPropertyValue(deal().fact_find_data, 'nope', '1').properties[0].value).toBe('2200000')
  })
})

// THE PROOF THAT THERE IS STILL ONE COPY. Nothing writes to the lending
// options, so the figures it shows can only have come from the records that own
// them.
describe('what the rest of the deal reads afterwards', () => {
  it('the loan amount follows a changed split', () => {
    const d: any = deal()
    expect(loanAmount(d)).toBe(1_760_000)
    d.bc_data = withSplitAmount(d.bc_data, 1, '500000')
    expect(loanAmount(d)).toBe(1_813_000)
  })

  // Fabio: "dont forget to test LVR on the top is wrking based on new input".
  it('and the LVR at the top follows a changed property value', () => {
    const d: any = deal()
    const before = securityValue(d)
    expect(before.total).toBe(2_800_000)
    d.fact_find_data = withPropertyValue(d.fact_find_data, 'p1', '2350000')
    const after = securityValue(d)
    expect(after.total).toBe(2_950_000)
    expect(after.lvr).not.toBe(before.lvr)
    expect(after.lvr).toBe(Math.round((1_760_000 / 2_950_000) * 1000) / 10)
  })

  it('and a split amount moves the LVR too, because it moves the lending', () => {
    const d: any = deal()
    const before = securityValue(d).lvr
    d.bc_data = withSplitAmount(d.bc_data, 1, '500000')
    expect(securityValue(d).lvr).toBeGreaterThan(before!)
  })

  it('the split list itself is unchanged in shape - only the figure moved', () => {
    const d: any = deal()
    d.bc_data = withSplitAmount(d.bc_data, 1, '500000')
    expect(splitsOf(d)).toHaveLength(2)
    expect(splitsOf(d)[1].amount).toBe('500000')
    expect(splitsOf(d)[1].repaymentType).toBe('Interest only')
  })
})

// THE BOX TELLS YOU WHERE IT LANDS AND WHAT ELSE MOVES. It does not ask - the
// answer is always yes, so asking would only train people to click through it.
describe('what the box says before you save', () => {
  it('names the record the change leaves for', () => {
    expect(LANDS_SAY.bc).toContain('borrowing capacity')
    expect(LANDS_SAY.factfind).toContain('fact find')
    expect(LANDS_SAY.lo).toContain('stays')
  })

  // The sentence that makes somebody stop and check.
  it('a split amount warns that the client sees the total', () => {
    const said = splitAmountEffect(deal(), 1, '500000').join(' ')
    expect(said).toContain('$1,813,000')
    expect(said).toContain('the client sees')
    expect(said).toContain('compliance wording')
  })

  it('and names the house whose LVR moves', () => {
    const said = splitAmountEffect(deal(), 1, '500000').join(' ')
    expect(said).toContain('7/22-26 Russell Street Hawks Nest')
  })

  it('a property value says what its LVR becomes', () => {
    const said = propertyValueEffect(deal(), 'p1', '2350000').join(' ')
    expect(said).toContain('55.9%')
    expect(said).toContain('fact find')
  })

  it('and a rate says plainly that it goes nowhere', () => {
    const said = rateEffect().join(' ')
    expect(said).toContain('goes no further')
    expect(said).toContain('Nothing on the borrowing capacity or the fact find changes')
  })

  it('a change that moves nothing says nothing rather than padding', () => {
    expect(splitAmountEffect(deal(), 1, '447000')).toEqual([])
  })
})

// THE WIRING.
describe('the panel and the tab keep the promises', () => {
  const { readFileSync } = require('fs')
  const strip = readFileSync('components/DealStructure.tsx', 'utf8')
  const lo = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')

  it('there is an Edit beside all three figures', () => {
    expect(strip).toContain("lands: 'bc', title: `Split ${i + 1} — amount`")
    expect(strip).toContain("lands: 'factfind'")
    expect(strip).toContain("lands: 'lo'")
  })

  // A SPLIT THE BC HAS NEVER HEARD OF HAS NOTHING TO EDIT ON THE BC. Those are
  // removed with the ×, not edited across.
  it('but only on splits the borrowing capacity actually owns', () => {
    expect(strip).toContain('onSplitChange && i < bcOwned &&')
  })

  it('the change is written to the record that owns it, and checked', () => {
    expect(strip).toContain("saveAcross('bc_data'")
    expect(strip).toContain("saveAcross('fact_find_data'")
    expect(strip).toContain('const { problem } = await patchDealColumn')
  })

  // The one of the three that goes nowhere, and it is the LO tab that writes it
  // because the LO tab owns lo_data.
  it('a rate is changed on the lending options, on the recommended option only', () => {
    expect(lo).toContain('function setSplitRate')
    expect(lo).toContain('onRateChange={setSplitRate}')
    expect(lo).toContain('const rec = recommendedOption(d)')
  })

  it('nothing about this writes a second copy onto the lending options', () => {
    const save = strip.slice(strip.indexOf('async function saveAcross'),
                             strip.indexOf('async function saveAcross') + 700)
    expect(save, 'the edit is being written to lo_data as well').not.toContain('lo_data')
  })

  // It states, it does not ask. A yes/no would train people to click through,
  // and a "no" that kept a different number here would rebuild the fault.
  it('the box states where it lands rather than asking', () => {
    expect(strip).toContain('LANDS_SAY[editing.lands]')
    expect(strip).toContain('Save to the BC')
    expect(strip).toContain('Save to the fact find')
    expect(strip, 'it is asking yes or no again').not.toMatch(/Yes, update/)
  })

  it('and says what else moves before it is saved', () => {
    expect(strip).toContain('splitAmountEffect(deal, editing.at ?? -1, editing.value)')
    expect(strip).toContain('propertyValueEffect(deal, editing.propId')
  })
})
