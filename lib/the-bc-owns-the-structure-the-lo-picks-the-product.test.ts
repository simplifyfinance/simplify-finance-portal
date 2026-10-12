// THE ONE RULE, WRITTEN DOWN WHERE IT CANNOT BE LOST AGAIN.
//
// Fabio, 13 Oct 2026, on the Veljovic deal, having said it several times before:
//
//   "the logic is ALWAYS THE SAME BC sets the tone structure the LO is JUST
//    where we select products DO YOU FINALLY UNDERSTAND THIS LO is not where
//    the srtructur is decided is JUST the product and rates I need this fixed
//    ONCE and for all for ALL splits"
//
// What he was looking at: six splits all answered Interest only on the BC, and
// the lending options drawing an empty "P&I or interest only?" dropdown beside
// every one of them. Three separate faults underneath that.
//
//   The panel OFFERED the question on a tab that does not own the answer.
//   splitsOf read three other copies BEFORE the BC's.
//   The term, the IO years and the product were typed boxes on the same row.
//
// ONE FIELD HAS TWO OWNERS and that is the only subtlety here. P&I or interest
// only is the BC's. Fixed or variable rides on the same string as "Fixed P&I"
// and is the product, so it is the lending options'. settleRepayment is that
// line, and this file holds it.
//
// Invented clients, invented figures.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { splitsOf, settleRepayment } from './deal-structure'

const strip = readFileSync('components/DealStructure.tsx', 'utf8')
const lo = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')

const deal = (over: any = {}) => ({
  id: 'd1',
  bc_data: {
    loanTerm: '30',
    splits: [
      { label: 'Existing Investment Home loan', amount: '1313000', type: 'Interest only', ioYears: '5', purpose: 'INV' },
      { label: 'Investment equity loan split', amount: '447000', type: 'Interest only', ioYears: '5', purpose: 'INV' },
    ],
  },
  lo_data: { refinanceSplits: [{ id: 'u1', label: 'x', amount: '1313000' }, { id: 'u2', label: 'y', amount: '447000' }] },
  compliance_data: {},
  ...over,
})

describe('what the BC answered is what every split reads', () => {
  it('interest only on the BC is interest only everywhere', () => {
    expect(splitsOf(deal()).map(s => s.repaymentType)).toEqual(['Interest only', 'Interest only'])
  })

  it('and the interest only years come with it', () => {
    expect(splitsOf(deal()).map(s => s.ioYears)).toEqual(['5', '5'])
  })

  // THE VELJOVIC FAULT EXACTLY. A stale P&I on another copy used to win.
  it('a stale copy saying otherwise does not overrule it', () => {
    const d = deal({ compliance_data: { splitDetail: { u1: { repaymentType: 'P&I' } } } })
    expect(splitsOf(d)[0].repaymentType).toBe('Interest only')
  })

  it('for every split, not just the first', () => {
    const d = deal()
    d.bc_data.splits.push({ label: 'Equity release', amount: '200000', type: 'P&I', purpose: 'INV' })
    expect(splitsOf(d).map(s => s.repaymentType)).toEqual(['Interest only', 'Interest only', 'P&I'])
  })
})

describe('fixed or variable is still the product', () => {
  it('kept, because it agrees about which of the two the split is', () => {
    expect(settleRepayment('Interest only', 'Fixed IO')).toBe('Fixed IO')
    expect(settleRepayment('P&I', 'Fixed P&I')).toBe('Fixed P&I')
  })

  it('dropped, when it disagrees with the BC about that', () => {
    expect(settleRepayment('Interest only', 'P&I')).toBe('Interest only')
    expect(settleRepayment('P&I', 'IO')).toBe('P&I')
  })

  it('and where one side is silent the other answers', () => {
    expect(settleRepayment('', 'Fixed P&I')).toBe('Fixed P&I')
    expect(settleRepayment('Interest only', '')).toBe('Interest only')
  })
})

describe('the lending options shows the structure, it does not ask for it', () => {
  it('the tab says so out loud', () => {
    expect(lo).toContain('structureIsBc')
  })

  it('and the panel only draws the dropdowns where the tab owns the answer', () => {
    expect(strip).toContain('const canEditStructure = !!onSplitChange && !structureIsBc')
    for (const asked of ['s.purpose', 's.repaymentType', 's.funds']) {
      const at = strip.indexOf(`value={${asked} || ''}`)
      expect(at, `${asked} is not drawn at all`).toBeGreaterThan(-1)
      // The nearest gate above the control is the structure one, never the
      // bare handler check it used to be.
      expect(strip.slice(0, at)).toMatch(/canEditStructure\s*$|canEditStructure[\s\S]{0,200}$/)
    }
  })

  it('the term, the IO years and the product are printed there, not typed', () => {
    for (const shown of ['{s.termYears || \'—\'}', '{s.ioYears || \'—\'}', '{s.productType ||']) {
      expect(strip, `${shown} is still a box on the lending options`).toContain(shown)
    }
    expect(strip).toContain('from the lender option you tick')
  })

  // Adding a split is structure too. Every extra one on Veljovic existed only
  // because the BC's were not arriving.
  it('and a new split is added on the BC, not here', () => {
    expect(strip).toContain('{onAddSplit && !structureIsBc && (')
  })

  it('a missing answer sends you to the tab that owns it', () => {
    expect(strip).toContain("const setItOn = structureIsBc ? 'BC' : 'LO'")
    expect(strip, 'it still tells you to set it on the tab you are already on').not.toContain('set on the LO ↗')
  })
})

describe('value and LVR, one per house', () => {
  it('the panel draws them per property once there is more than one', () => {
    expect(strip).toContain('Value and LVR, per property')
  })

  // Fabio asked for the per-property figures, saw them, and then asked twice
  // for the combined line to go: "the 'all together' line still there".
  it('and adds nothing up underneath them', () => {
    expect(strip, 'the combined total is back').not.toContain('together</span>')
    expect(strip).not.toContain('All {ticked.length} together')
  })

  // The LVR was printing a dash beside a real value because it read a limit
  // typed on the BC that nobody fills in. The lending on a house is the sum of
  // the splits secured against it, and that is already on the deal.
  it('and the LVR comes from the splits secured on each house', () => {
    expect(strip).toContain("String(sp.securityId || '') === String(x.id)")
  })

  it('and says when a total is short because a house has no value', () => {
    expect(strip).toContain('so the total is lower than the real one')
  })
})
