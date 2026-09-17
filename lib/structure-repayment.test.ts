import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { splitsOf } from './deal-structure'
import { dealFigures } from './deal-figures'

// 17 Sep 2026. Dylan Smyth and Megan Isherwood - an investment PURCHASE with
// Interest Only ticked on the product, P&I printed on the deal structure, and
// nowhere in the portal to change it. The per-lender splits box, where the type
// is normally answered, is drawn on refinances only.

const deal = (over: any = {}) => ({
  id: 'deal-1',
  bc_data: { splits: [{ id: 'a', label: 'Investment loan', amount: '540000', type: 'P&I' }], loanTerm: '30' },
  lo_data: {
    refinanceSplits: [{ id: 'a', label: 'Investment loan', amount: '540000' }],
    lenders: [{ id: 'L1', lenderName: 'ubank', productName: 'Flex', lenderSplits: [],
                variableIO: { enabled: true, rate: '6.84', ioYears: '3' } }],
  },
  compliance_data: {},
  ...over,
})

const answered = (type: string) => deal({
  compliance_data: { splitDetail: { a: { repaymentType: type } } },
})

describe('the answer given on the deal structure wins', () => {
  it('beats the BC split it used to be stuck with', () => {
    expect(splitsOf(deal())[0].repaymentType).toBe('P&I')      // where it came from
    expect(splitsOf(answered('IO'))[0].repaymentType).toBe('IO')
  })

  it('beats the per-lender copy on a refinance too', () => {
    const d = answered('IO')
    d.lo_data.lenders[0].lenderSplits = [{ id: 'a', label: 'Investment loan', amount: '540000',
                                           lvr: '', rate: '6.84', repayment: '', repaymentType: 'P&I' }]
    expect(splitsOf(d)[0].repaymentType).toBe('IO')
  })

  it('changes nothing on a deal where nobody has answered', () => {
    expect(splitsOf(answered(''))[0].repaymentType).toBe('P&I')
  })
})

describe("Fabio's question: does changing it flag the compliance notes", () => {
  // "my concern with editable box is that the compliance notes are based on that
  // so if I change it messes up compliance" - 17 Sep 2026.
  it('the repayment type is one of the figures a note is stamped with', () => {
    const before = dealFigures(deal())
    expect(Object.keys(before).some(k => /repayment type/i.test(k))).toBe(true)
  })

  it('changing it changes that figure, so every note written before says so', () => {
    const before = dealFigures(deal())
    const after = dealFigures(answered('IO'))
    const key = Object.keys(after).find(k => /Investment loan repayment type/i.test(k))
    expect(key, 'the split is not named in the figures').toBeTruthy()
    expect(before[key!]).toBe('P&I')
    expect(after[key!]).toBe('IO')
  })

  it('names the split, so the warning reads like a sentence', () => {
    expect(Object.keys(dealFigures(answered('IO'))))
      .toContain('Investment loan repayment type')
  })
})

describe('the column is a control, not a label', () => {
  const src = readFileSync('components/DealStructure.tsx', 'utf8')

  it('offers the repayment type as a dropdown wherever the panel is editable', () => {
    expect(src).toMatch(/repaymentType: e\.target\.value/)
    expect(src).toMatch(/P&I or interest only\?/)
  })

  it('still prints plain text where the panel is read only', () => {
    expect(src).toMatch(/: <span className="text-\[13\.5px\] text-\[#221F1B\]">\{s\.repaymentType \|\| '—'\}<\/span>/)
  })
})
