import { describe, it, expect } from 'vitest'
import { withDefaults, rightShape } from './record-defaults'

// The compliance tab's shape, which is the one that broke.
const BLANK = {
  entityType: 'Individual(s)',
  applicants: [{ name: 'Rachel Fielding', type: 'applicant' }],
  risks: { 'Rachel Fielding': { declaredBankrupt: 'No' } },
  productReqs: { redraw: '', offsetAccount: '' },
  expenses: { rent: { monthlyAmount: '0' } },
  aiMeta: {},
  needsPrimary: '',
}
const SHAPES = {
  applicants: 'arrayNotEmpty', risks: 'object', productReqs: 'object', expenses: 'object', aiMeta: 'object',
} as const

describe('the record Melissa could not open', () => {
  it('survives a compliance_data written by the deal structure block alone', () => {
    // Wesley Perrott, 10 Sep 2026: a real object holding only what another
    // screen put there.
    const stored = { securityAddress: '12 Example St', splitDetail: { a: { termYears: '30' } } }
    const out = withDefaults(stored, BLANK, SHAPES)
    expect(out.applicants[0].name).toBe('Rachel Fielding')   // this is the line that crashed
    expect(out.risks).toEqual(BLANK.risks)
    expect(out.productReqs).toEqual(BLANK.productReqs)
    expect(out.expenses).toEqual(BLANK.expenses)
    expect((out as any).securityAddress).toBe('12 Example St')  // and nothing saved is lost
  })

  it('never returns a record missing a key the screen renders', () => {
    for (const stored of [{}, { a: 1 }, { applicants: null }, { risks: null }, null, undefined, 'nonsense', []]) {
      const out = withDefaults(stored, BLANK, SHAPES)
      for (const key of Object.keys(BLANK)) {
        expect(out[key as keyof typeof BLANK], `${key} on ${JSON.stringify(stored)}`).toBeDefined()
        expect(out[key as keyof typeof BLANK]).not.toBeNull()
      }
    }
  })
})

describe('what is saved is kept', () => {
  it('a full record comes back untouched', () => {
    const stored = {
      entityType: 'Company', applicants: [{ name: 'Someone', type: 'applicant' }],
      risks: { Someone: { declaredBankrupt: 'Yes' } }, productReqs: { redraw: 'Important' },
      expenses: { rent: { monthlyAmount: '900' } }, aiMeta: { needsPrimary: { confidence: 'High' } },
      needsPrimary: 'Written by a person.',
    }
    expect(withDefaults(stored, BLANK, SHAPES)).toEqual(stored)
  })

  it('keeps a section that is there and defaults only the one that is not', () => {
    const stored = { risks: { Someone: { declaredBankrupt: 'Yes' } } }
    const out = withDefaults(stored, BLANK, SHAPES)
    expect(out.risks).toEqual(stored.risks)
    expect(out.applicants).toEqual(BLANK.applicants)
  })

  it('keeps a saved key the blank has never heard of', () => {
    const out: any = withDefaults({ somethingNew: 'keep me' }, BLANK, SHAPES)
    expect(out.somethingNew).toBe('keep me')
  })

  it('keeps an empty string, which is a real answer', () => {
    const out = withDefaults({ needsPrimary: '' }, BLANK, SHAPES)
    expect(out.needsPrimary).toBe('')
  })

  it('keeps a false and a zero rather than treating them as absent', () => {
    const blank = { preApproval: true, count: 9 }
    expect(withDefaults({ preApproval: false, count: 0 }, blank)).toEqual({ preApproval: false, count: 0 })
  })
})

describe('the wrong shape is as bad as nothing at all', () => {
  it('replaces an array where an object belongs', () => {
    const out = withDefaults({ risks: [] }, BLANK, SHAPES)
    expect(out.risks).toEqual(BLANK.risks)
  })

  it('replaces an object where an array belongs', () => {
    const out = withDefaults({ applicants: { name: 'not a list' } }, BLANK, SHAPES)
    expect(out.applicants).toEqual(BLANK.applicants)
  })

  it('replaces an empty applicants list, because the page indexes into it', () => {
    // d.applicants[0] on [] is undefined, and the next line reads .name off it.
    const out = withDefaults({ applicants: [] }, BLANK, SHAPES)
    expect(out.applicants).toEqual(BLANK.applicants)
  })

  it('allows an empty array where emptiness is legitimate', () => {
    const blank = { assets: [{ v: 1 }] }
    expect(withDefaults({ assets: [] }, blank, { assets: 'array' }).assets).toEqual([])
  })

  it('replaces a string or a number sitting where a section belongs', () => {
    expect(withDefaults({ risks: 'oops' }, BLANK, SHAPES).risks).toEqual(BLANK.risks)
    expect(withDefaults({ expenses: 7 }, BLANK, SHAPES).expenses).toEqual(BLANK.expenses)
  })
})

describe('rightShape', () => {
  it('knows an object from an array from a null', () => {
    expect(rightShape({}, 'object')).toBe(true)
    expect(rightShape([], 'object')).toBe(false)
    expect(rightShape(null, 'object')).toBe(false)
    expect(rightShape([], 'array')).toBe(true)
    expect(rightShape([], 'arrayNotEmpty')).toBe(false)
    expect(rightShape([1], 'arrayNotEmpty')).toBe(true)
    expect(rightShape({}, 'array')).toBe(false)
  })
})
