import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { seedFromGlobal, seedType, typesOffered, typeContradictsProduct,
         resolveLenderSplits, SPLIT_TYPES } from './lo-splits'

// 17 Sep 2026. Dylan Smyth and Megan Isherwood: Interest Only ticked on the
// product, P&I on the deal structure, and nobody had typed either.

const on = { enabled: true }
const off = { enabled: false }
const GLOBALS = [
  { id: 'a', label: 'Existing loan refinanced', amount: '540000' },
  { id: 'b', label: 'Equity release', amount: '180000' },
]

const lender = (over: any = {}) => ({
  variablePI: off, variableIO: off, fixedPI: off, fixedIO: off, ...over,
})

describe('a split starts as what was ticked on the product', () => {
  it('interest only ticked, and every split starts interest only', () => {
    const splits = seedFromGlobal(GLOBALS, lender({ variableIO: on }))
    expect(splits.map(s => s.repaymentType)).toEqual(['IO', 'IO'])
  })

  it('principal and interest ticked, and every split starts P&I', () => {
    expect(seedFromGlobal(GLOBALS, lender({ variablePI: on }))[0].repaymentType).toBe('P&I')
  })

  it('a fixed module seeds the fixed type, not the variable one', () => {
    expect(seedType(lender({ fixedIO: on }))).toBe('Fixed IO')
    expect(seedType(lender({ fixedPI: on }))).toBe('Fixed P&I')
  })

  it('every type it can seed is one the dropdown offers', () => {
    for (const k of ['variablePI', 'variableIO', 'fixedPI', 'fixedIO']) {
      const t = seedType(lender({ [k]: on }))
      expect(SPLIT_TYPES).toContain(t as any)
    }
  })
})

describe('what it refuses to guess', () => {
  it('leaves a split loan blank rather than picking one', () => {
    const splits = seedFromGlobal(GLOBALS, lender({ variablePI: on, variableIO: on }))
    expect(splits.map(s => s.repaymentType)).toEqual(['', ''])
  })

  it('leaves a brand new lender blank - nothing is ticked yet', () => {
    expect(seedFromGlobal(GLOBALS, lender())[0].repaymentType).toBe('')
    expect(seedFromGlobal(GLOBALS, null)[0].repaymentType).toBe('')
    expect(seedFromGlobal(GLOBALS, undefined)[0].repaymentType).toBe('')
  })

  it('NEVER stamps P&I on a product that does not offer it', () => {
    for (const mods of [{ variableIO: on }, { fixedIO: on }, { variableIO: on, fixedIO: on }]) {
      for (const s of seedFromGlobal(GLOBALS, lender(mods))) {
        expect(s.repaymentType).not.toBe('P&I')
      }
    }
  })

  it('an enabled flag that is not true does not count', () => {
    expect(seedType({ variableIO: { enabled: undefined } } as any)).toBe('')
    expect(seedType({ variableIO: {} } as any)).toBe('')
  })
})

describe('the rest of the split is untouched', () => {
  it('keeps the label and the amount, and leaves rate and repayment empty', () => {
    const [first] = seedFromGlobal(GLOBALS, lender({ variableIO: on }))
    // ioYears joined the row on 17 Sep 2026 - the interest only period is a
    // property of the split, not of the lender.
    expect(first).toEqual({ id: 'a', label: 'Existing loan refinanced', amount: '540000',
                            lvr: '', rate: '', repayment: '', repaymentType: 'IO', ioYears: '' })
  })

  it('a lender that already has its own splits keeps every one of them', () => {
    const own = [{ id: 'a', label: 'x', amount: '1', lvr: '', rate: '6', repayment: '', repaymentType: 'P&I' }]
    const out = resolveLenderSplits({ ...lender({ variableIO: on }), lenderSplits: own } as any, GLOBALS)
    expect(out).toBe(own)
  })

  it('a lender with no splits of its own is seeded from its own ticks', () => {
    const out = resolveLenderSplits({ ...lender({ fixedPI: on }), lenderSplits: [] } as any, GLOBALS)
    expect(out.map(s => s.repaymentType)).toEqual(['Fixed P&I', 'Fixed P&I'])
  })
})

describe('the warning, which points and never corrects', () => {
  it('fires when the split says P&I and only interest only is ticked', () => {
    expect(typeContradictsProduct({ repaymentType: 'P&I' }, lender({ variableIO: on }))).toBe(true)
  })

  it('is quiet when the split is one of the types the product offers', () => {
    const both = lender({ variablePI: on, variableIO: on })
    expect(typeContradictsProduct({ repaymentType: 'P&I' }, both)).toBe(false)
    expect(typeContradictsProduct({ repaymentType: 'IO' }, both)).toBe(false)
  })

  it('is quiet on a blank split and on a product with nothing ticked', () => {
    expect(typeContradictsProduct({ repaymentType: '' }, lender({ variableIO: on }))).toBe(false)
    expect(typeContradictsProduct({ repaymentType: 'P&I' }, lender())).toBe(false)
    expect(typeContradictsProduct(null, lender({ variableIO: on }))).toBe(false)
  })

  it('does not fire on a difference of case or spacing alone', () => {
    expect(typeContradictsProduct({ repaymentType: ' io ' }, lender({ variableIO: on }))).toBe(false)
  })

  it('knows fixed from variable', () => {
    expect(typeContradictsProduct({ repaymentType: 'Fixed IO' }, lender({ variableIO: on }))).toBe(true)
    expect(typesOffered(lender({ fixedIO: on, variablePI: on }))).toEqual(['P&I', 'Fixed IO'])
  })
})

describe('nothing seeds a repayment type by hand any more', () => {
  it("no file outside lo-splits.ts writes repaymentType: 'P&I'", () => {
    for (const f of ['lib/lo-splits.ts']) {
      const src = readFileSync(f, 'utf8')
      const hard = src.split('\n')
        .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
        .filter(l => /repaymentType:\s*'P&I'/.test(l))
      expect(hard, 'a split is being born holding P&I again').toEqual([])
    }
  })
})
