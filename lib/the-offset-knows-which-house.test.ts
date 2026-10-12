import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { chosenOffsetSplits, offsetIsOn, toggleOffset, offsetsAfterRemoving, offsetNames } from './offset-splits'
import { offsetLine, offsetSplitLabels } from './debt-recycling'

// TICKING ONE OFFSET TICKED THREE.
//
// 12 Oct 2026. A complex refinance across three houses carries the same two
// split names on each of them. The tick was stored by the NAME, so one tick
// selected all three, and the client email - which lists the names and removes
// duplicates - said "Your offset account sits against Investment equity loan
// split" with nothing to say which house. One offset, described as sitting
// against three different loans.
const HOUSES = [
  { id: 'p1', address: '16 Mock Street Paddington' },
  { id: 'p2', address: '7/22 Mock Road Hawks Nest' },
  { id: 'p3', address: '14/22 Mock Road Hawks Nest' },
]

const SPLITS = [
  { label: 'Existing Investment Home loan', amount: '1,020,000', securityId: 'p1' },
  { label: 'Investment equity loan split',  amount: '740,000',   securityId: 'p1' },
  { label: 'Existing Investment Home loan', amount: '447,000',   securityId: 'p2' },
  { label: 'Investment equity loan split',  amount: '33,000',    securityId: 'p2' },
  { label: 'Existing Investment Home loan', amount: '238,000',   securityId: 'p3' },
  { label: 'Investment equity loan split',  amount: '242,000',   securityId: 'p3' },
]

const bc = (over: any = {}) => ({ splits: SPLITS, ffProperties: HOUSES, ...over })

describe('one tick means one split', () => {
  it('ticking the equity split on the second house picks that one only', () => {
    const d = bc({ offsetSplitIdx: [3] })
    expect(chosenOffsetSplits(d).map(r => r.index)).toEqual([3])
    expect(offsetIsOn(d, 3)).toBe(true)
    expect(offsetIsOn(d, 1)).toBe(false)
    expect(offsetIsOn(d, 5)).toBe(false)
  })

  it('names the house, so the client can tell them apart', () => {
    expect(offsetNames(bc({ offsetSplitIdx: [3] })))
      .toEqual(['Investment equity loan split on 7/22 Mock Road Hawks Nest'])
  })

  it('names three different loans as three, not as one', () => {
    const names = offsetNames(bc({ offsetSplitIdx: [1, 3, 5] }))
    expect(names).toHaveLength(3)
    expect(new Set(names).size).toBe(3)
  })

  it('reads them in the order the splits are in, whatever order they were ticked', () => {
    expect(chosenOffsetSplits(bc({ offsetSplitIdx: [5, 1, 3] })).map(r => r.index)).toEqual([1, 3, 5])
  })
})

// A SINGLE-HOUSE DEAL IS UNTOUCHED. The name on its own was always enough there.
describe('a deal with one house', () => {
  const one = { splits: [{ label: 'Home loan', amount: '500,000', securityId: 'p1' },
                         { label: 'Equity split', amount: '100,000', securityId: 'p1' }],
                ffProperties: HOUSES, offsetSplitIdx: [1] }

  it('says the split and nothing else', () => {
    expect(offsetNames(one)).toEqual(['Equity split'])
  })

  it('and the sentence reads as it always did', () => {
    expect(offsetLine(one)).toBe(
      'Your offset account sits against Equity split, where the savings held in it do the most good.')
  })
})

// NO DEAL CHANGES ITS MEANING ON ITS OWN.
describe('a record saved before today', () => {
  const old = bc({ offsetSplits: ['Investment equity loan split'] })

  it('still selects every split carrying that name, exactly as it did', () => {
    expect(chosenOffsetSplits(old).map(r => r.index)).toEqual([1, 3, 5])
  })

  it('but now says which house each one is on', () => {
    expect(offsetNames(old)).toEqual([
      'Investment equity loan split on 16 Mock Street Paddington',
      'Investment equity loan split on 7/22 Mock Road Hawks Nest',
      'Investment equity loan split on 14/22 Mock Road Hawks Nest',
    ])
  })

  it('reads the single value that shipped for one morning', () => {
    expect(chosenOffsetSplits(bc({ offsetSplit: 'Existing Investment Home loan' })).map(r => r.index))
      .toEqual([0, 2, 4])
  })

  it('and positions win over names once somebody has ticked', () => {
    expect(chosenOffsetSplits(bc({ offsetSplits: ['Investment equity loan split'], offsetSplitIdx: [0] }))
      .map(r => r.index)).toEqual([0])
  })
})

describe('ticking and unticking', () => {
  it('adds one', () => { expect(toggleOffset(bc({ offsetSplitIdx: [1] }), 3)).toEqual([1, 3]) })
  it('removes one', () => { expect(toggleOffset(bc({ offsetSplitIdx: [1, 3] }), 1)).toEqual([3]) })
  it('starts from nothing', () => { expect(toggleOffset(bc(), 2)).toEqual([2]) })
})

// AN OFFSET MUST NEVER SLIDE ONTO THE WRONG LOAN.
describe('removing a split moves the ticks with it', () => {
  it('everything after the hole comes up one', () => {
    expect(offsetsAfterRemoving(bc({ offsetSplitIdx: [1, 3, 5] }), 2)).toEqual([1, 2, 4])
  })

  it('the removed split takes its own tick with it', () => {
    expect(offsetsAfterRemoving(bc({ offsetSplitIdx: [1, 3] }), 3)).toEqual([1])
  })

  it('removing from the end disturbs nothing', () => {
    expect(offsetsAfterRemoving(bc({ offsetSplitIdx: [1, 3] }), 5)).toEqual([1, 3])
  })
})

describe('nothing ticked, nothing said', () => {
  it.each([[{}], [{ offsetSplitIdx: [] }], [{ offsetSplits: [] }], [{ offsetSplit: '' }]])(
    '%o puts no sentence in the email', (over) => {
      expect(offsetLine(bc(over))).toBe('')
      expect(offsetSplitLabels(bc(over))).toEqual([])
    })

  it('ignores a tick pointing at a split that is not there', () => {
    expect(chosenOffsetSplits(bc({ offsetSplitIdx: [99] }))).toEqual([])
  })

  it('ignores a split with no money in it', () => {
    const d = bc({ splits: [...SPLITS, { label: 'Empty', amount: '', securityId: 'p1' }], offsetSplitIdx: [6] })
    expect(chosenOffsetSplits(d)).toEqual([])
  })
})

describe('the form stores positions, not names', () => {
  const FORM = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

  it('ticks through the one rule', () => {
    expect(FORM).toContain('offsetIsOn(bcNow, i)')
    expect(FORM).toContain('setOffsetSplitIdx(toggleOffset(bcNow, i))')
  })

  it('does not tick by label any more', () => {
    expect(FORM).not.toContain('offsetSplits.includes(x.label)')
  })

  it('moves the ticks when a split is removed', () => {
    expect(FORM).toContain('setOffsetSplitIdx(offsetsAfterRemoving(buildBcData(), i))')
  })

  it('carries the new field in the record it saves', () => {
    expect(FORM).toContain('offsetSplitIdx')
  })
})
