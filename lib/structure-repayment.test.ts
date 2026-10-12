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

// 13 OCT 2026. THE ANSWER ABOVE IS NO LONGER THE DEAL STRUCTURE PANEL'S TO GIVE.
//
// The three tests below used to say the panel's own answer beat the BC's. That
// was right in September, when the BC could not be relied on to carry anything
// to the lending options and the per-lender box did not exist on a purchase -
// there was genuinely nowhere else to say it.
//
// It carries now. And on the Veljovic deal the old rule did real damage: all
// six splits were answered Interest only on the BC, a stale P&I sat on another
// copy, and the lending options showed an empty "P&I or interest only?" beside
// every one of them.
//
// Fabio, 13 Oct 2026: "the logic is ALWAYS THE SAME BC sets the tone structure
// the LO is JUST where we select products DO YOU FINALLY UNDERSTAND THIS".
//
// ONE FIELD, TWO OWNERS - which is the subtlety that made this worth a careful
// fix rather than a blunt one. P&I or interest only is the BC's. Fixed or
// variable rides on the same string and is the product, so it is the lending
// options'. See settleRepayment in lib/deal-structure.ts.
describe('the borrowing capacity decides P&I or interest only', () => {
  it('its answer is what shows, even where an older copy disagrees', () => {
    expect(splitsOf(deal())[0].repaymentType).toBe('P&I')
    // The panel used to be able to overrule this. It cannot any more.
    expect(splitsOf(answered('IO'))[0].repaymentType).toBe('P&I')
  })

  it('and when the BC says interest only, that is what every copy reads', () => {
    const d = answered('P&I')
    d.bc_data.splits[0].type = 'Interest only'
    d.lo_data.lenders[0].lenderSplits = [{ id: 'a', label: 'Investment loan', amount: '540000',
                                           lvr: '', rate: '6.84', repayment: '', repaymentType: 'P&I' }]
    expect(splitsOf(d)[0].repaymentType).toBe('Interest only')
  })

  // THE HALF THE LENDING OPTIONS KEEPS. "Fixed P&I" is the product saying fixed,
  // and it agrees with the BC about which of the two this split is, so it stands.
  it('but fixed or variable is the product, and it survives', () => {
    const d = deal()
    d.lo_data.lenders[0].lenderSplits = [{ id: 'a', label: 'Investment loan', amount: '540000',
                                           lvr: '', rate: '5.94', repayment: '', repaymentType: 'Fixed P&I' }]
    expect(splitsOf(d)[0].repaymentType).toBe('Fixed P&I')
  })

  it('and where the BC has said nothing, the other copies still answer', () => {
    const d = answered('IO')
    d.bc_data.splits[0].type = ''
    expect(splitsOf(d)[0].repaymentType).toBe('IO')
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
    // Changed ON THE BC now, because that is where it is changed.
    const io = deal(); io.bc_data.splits[0].type = 'IO'
    const before = dealFigures(deal())
    const after = dealFigures(io)
    const key = Object.keys(after).find(k => /Investment loan repayment type/i.test(k))
    expect(key, 'the split is not named in the figures').toBeTruthy()
    expect(before[key!]).toBe('P&I')
    expect(after[key!]).toBe('IO')
  })

  it('names the split, so the warning reads like a sentence', () => {
    expect(Object.keys(dealFigures(deal())))
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
    // The ink colour is a token now, not a hex, so that it turns over in dark -
    // 5 Oct 2026. What this is guarding is the read-only BRANCH, not the shade,
    // so it pins the shape and lets the colour be named.
    expect(src).toMatch(/: <span className="text-\[13\.5px\] text-ink">\{s\.repaymentType \|\| '—'\}<\/span>/)
  })
})
