import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { offsetAnswer, hasOffset, offsetRecorded } from './offset'
import { structureOf, flexibilityPassage } from './box-one'
import { DEAL } from './box-fixture'

// 17 Sep 2026. A live deal - MA Money, Residential Prime Alt Doc - told the
// credit team the product had no offset account, on a product the lender library
// records as having several. These are the wordings that broke it.

const lender = (over: any = {}) => ({
  lenderName: 'MA Money', productName: 'Residential Prime Alt Doc',
  annualFee: '$0', offsetAccount: 'Yes — multiple offsets',
  variablePI: { enabled: true, rate: '6.29' }, variableIO: { enabled: false },
  fixedPI: { enabled: false }, fixedIO: { enabled: false }, ...over,
})

const deal = (offsetAccount: any) => {
  const d = JSON.parse(JSON.stringify(DEAL))
  d.id = 'deal-offset'
  d.lo_data = { lenders: [lender({ offsetAccount })], recommendedOptionId: '' }
  return d
}

const passages = (offsetAccount: any) =>
  ([1, 2, 3] as const).map(v => flexibilityPassage(structureOf(deal(offsetAccount)), 'they', v))

const DENIALS = /does not include an offset|no offset account|without an offset account/i

describe('every way the library says yes', () => {
  // The exact strings LOForm writes when a product is picked, plus the ones a
  // person types into the box by hand.
  for (const yes of ['Yes', 'Yes — multiple offsets', 'Yes - multiple offsets',
                     'yes', 'YES', 'Yes, one per loan account', 'Available',
                     '100% offset', 'Multiple offsets']) {
    it(`"${yes}" is an offset`, () => {
      expect(offsetAnswer(yes)).toBe('yes')
      expect(hasOffset(yes)).toBe(true)
    })
  }
})

describe('every way it says no', () => {
  for (const no of ['No', 'no', 'NO', 'None', 'Nil', 'No offset', 'No offset available',
                    'Not available', 'Not offered', '0']) {
    it(`"${no}" is not an offset`, () => {
      expect(offsetAnswer(no)).toBe('no')
      expect(hasOffset(no)).toBe(false)
      expect(offsetRecorded(no)).toBe(true)
    })
  }
})

describe('nobody has answered', () => {
  for (const blank of ['', '   ', '-', '—', 'n/a', 'N/A', 'TBC', 'not recorded',
                       null, undefined]) {
    it(`${JSON.stringify(blank)} is unknown, not a no`, () => {
      expect(offsetAnswer(blank)).toBe('unknown')
      expect(hasOffset(blank)).toBe(false)
      expect(offsetRecorded(blank)).toBe(false)
    })
  }
})

describe('the sentence that went to the credit team', () => {
  it('NEVER denies the offset on a product the library records as having several', () => {
    for (const text of passages('Yes — multiple offsets')) {
      expect(text).not.toMatch(DENIALS)
      expect(text).toMatch(/offset/i)
    }
  })

  it('says nothing at all about offset when the box is blank', () => {
    for (const text of passages('')) {
      expect(text).not.toMatch(DENIALS)
      expect(text).not.toMatch(/offset/i)
      // Still a real passage - the rest of the structure survives.
      expect(text.length).toBeGreaterThan(80)
    }
  })

  it('still states the absence when somebody has actually recorded No', () => {
    for (const text of passages('No')) expect(text).toMatch(DENIALS)
  })

  it('does not claim a fee saving the product has not recorded', () => {
    const d = deal('No')
    d.lo_data.lenders[0].annualFee = ''
    for (const v of [1, 2, 3] as const)
      expect(flexibilityPassage(structureOf(d), 'they', v)).not.toMatch(/annual fee/i)
  })
})

describe('one rule, not three', () => {
  it('nothing outside lib/offset.ts decides what an offset answer means', () => {
    for (const f of ['lib/box-one.ts', 'lib/lender-comparison.ts',
                     'app/(app)/deals/[id]/ComplianceForm.tsx']) {
      const src = readFileSync(f, 'utf8')
        .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
      expect(src, `${f} is testing the offset answer by hand again`)
        .not.toMatch(/offsetAccount\s*\)?\s*(\.toLowerCase\(\)\s*)?[!=]==?\s*['"]/i)
    }
  })
})
