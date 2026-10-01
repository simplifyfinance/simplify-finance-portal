import { describe, it, expect } from 'vitest'
import {
  isComplexRefinance, propertyOf, groupsOf, limitOf, valueOf, undrawnNoteFor,
  originalPurposeLine, everySplitHasAProperty, openingLine, aboutThisStructure,
  ACCOUNTANT_NOTE, UNASSIGNED,
} from './complex-refinance'

// THE WORKED EXAMPLE Fabio approved on 1 Oct 2026: three properties, four
// splits, one property carrying two of them, and a limit above what is drawn.
const P1 = '8 Example Street, Lane Cove'
const P2 = '12 Example Road, Ryde'
const P3 = '7 Other Street, Carlingford'

const bc = {
  template: 'complex_refinance',
  existingLoanBal: '1,930,000',
  propertyLimits: { [P1]: '650,000', [P2]: '750,000', [P3]: '560,000' },
  ffProperties: [
    { address: P1, value: '1,600,000' },
    { address: P2, value: '950,000' },
    { address: P3, value: '880,000' },
  ],
  offsetSplits: ['Home loan'],
  splits: [
    { label: 'Home loan', property: P1, amount: '620,000', rate: '6.14', type: 'P&I',
      purpose: 'owner_occupied', repayment: '3,773' },
    { label: 'Investment loan', property: P2, amount: '600,000', rate: '6.39', type: 'Interest only',
      purpose: 'investment', fundsUsedFor: 'purchase 12 Example Road', repayment: '3,195' },
    { label: 'Equity split', property: P2, amount: '150,000', rate: '6.39', type: 'Interest only',
      purpose: 'investment', fundsUsedFor: 'fund the deposit for 7 Other Street', repayment: '799' },
    { label: 'Investment loan', property: P3, amount: '560,000', rate: '6.39', type: 'Interest only',
      purpose: 'investment', fundsUsedFor: 'purchase 7 Other Street', repayment: '2,982' },
  ],
}

describe('one card per property', () => {
  it('groups four splits across three properties', () => {
    const g = groupsOf(bc)
    expect(g.map(x => x.property)).toEqual([P1, P2, P3])
    expect(g[1].splits.map(s => s.label)).toEqual(['Investment loan', 'Equity split'])
  })

  it('and each card totals itself', () => {
    const g = groupsOf(bc)
    expect(g[0].drawn).toBe(620000)
    expect(g[1].drawn).toBe(750000)
    expect(g[2].drawn).toBe(560000)
  })

  // The properties come out in the order the splits name them, not alphabetical
  // and not fact find order - the broker put them in the order they read.
  it('in the order the splits name them', () => {
    const reordered = { ...bc, splits: [bc.splits[3], bc.splits[0], bc.splits[1], bc.splits[2]] }
    expect(groupsOf(reordered).map(x => x.property)).toEqual([P3, P1, P2])
  })

  it('ignores the empty split rows the form always carries', () => {
    const d = { ...bc, splits: [...bc.splits, { label: '', property: '', amount: '' }] }
    expect(groupsOf(d)).toHaveLength(3)
    expect(everySplitHasAProperty(d)).toBe(true)
  })

  // A SPLIT WITH NO PROPERTY IS NOT HIDDEN. It collects in a last card that says
  // what it is - the same rule the milestone emails follow.
  it('collects what nobody assigned, last, under a name', () => {
    // FIRST IN THE LIST, LAST ON THE PAGE. Put at the end of the array this
    // passes whether or not anything sorts it, which is a test proving nothing.
    const d = { ...bc, splits: [{ label: 'Line of credit', amount: '40,000' }, ...bc.splits] }
    const g = groupsOf(d)
    expect(g).toHaveLength(4)
    expect(g[3].property).toBe('')
    expect(g[3].heading).toBe(UNASSIGNED)
    expect(everySplitHasAProperty(d)).toBe(false)
  })
})

describe('the limit against each property', () => {
  it('is read per address and the shortfall named', () => {
    expect(limitOf(bc, P1)).toBe(650000)
    const g = groupsOf(bc)
    expect(g[0].undrawn).toBe(30000)
    expect(undrawnNoteFor(g[0]))
      .toBe('$30,000 of the limit above is not drawn at settlement and remains available.')
  })

  it('and says nothing where the splits fill it', () => {
    expect(groupsOf(bc)[1].undrawn).toBe(0)
    expect(undrawnNoteFor(groupsOf(bc)[1])).toBe('')
  })

  // No limit typed is not a shortfall. There is nothing to disagree with.
  it('or where nobody typed a limit at all', () => {
    const g = groupsOf({ ...bc, propertyLimits: {} })
    expect(g[0].limit).toBe(0)
    expect(undrawnNoteFor(g[0])).toBe('')
  })
})

describe('the property value', () => {
  it('comes from the fact find, never from the BC', () => {
    expect(valueOf(bc, P2)).toBe('$950,000')
    expect(groupsOf(bc)[1].value).toBe('$950,000')
  })

  it('and is simply absent for a property the fact find does not hold', () => {
    expect(valueOf(bc, '99 Nowhere Street')).toBe('')
    expect(valueOf({ ...bc, ffProperties: undefined }, P1)).toBe('')
  })
})

describe('what each split says about itself', () => {
  it('names the purpose and what the money originally did', () => {
    expect(originalPurposeLine(bc.splits[1]))
      .toBe('Investment — originally used to purchase 12 Example Road')
    expect(originalPurposeLine(bc.splits[0])).toBe('Owner-occupied')
  })

  it('and says nothing at all without a purpose', () => {
    expect(originalPurposeLine({ amount: '100,000', fundsUsedFor: 'buy shares' })).toBe('')
  })
})

describe('the words', () => {
  it('counts the properties it actually has', () => {
    expect(openingLine(bc)).toContain('across your 3 properties')
    const one = { ...bc, splits: [bc.splits[0]] }
    expect(openingLine(one)).toContain('against your property')
  })

  it('keeps the accountant line and claims nothing about tax', () => {
    expect(ACCOUNTANT_NOTE).toContain('matter for your accountant')
    expect(ACCOUNTANT_NOTE).toContain('This is not tax advice.')
    expect(ACCOUNTANT_NOTE.toLowerCase()).not.toContain('deductib')
  })

  // Fabio was explicit: this scenario does not mention debt recycling anywhere.
  it('and never mentions debt recycling', () => {
    const everything = [openingLine(bc), ACCOUNTANT_NOTE, ...aboutThisStructure(bc)].join(' ')
    expect(everything.toLowerCase()).not.toContain('recycl')
    expect(everything.toLowerCase()).not.toContain('deductib')
  })

  it('names the offsets where somebody has ticked them', () => {
    expect(aboutThisStructure(bc).join(' ')).toContain('Your offset account sits against Home loan,')
    expect(aboutThisStructure({ ...bc, offsetSplits: [] }).join(' ').toLowerCase())
      .not.toContain('offset')
  })

  it('and the scenario knows its own name', () => {
    expect(isComplexRefinance('complex_refinance')).toBe(true)
    expect(isComplexRefinance('refinance_only')).toBe(false)
    expect(propertyOf(bc.splits[0])).toBe(P1)
  })
})
