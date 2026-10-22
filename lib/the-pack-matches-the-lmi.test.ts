// THE COMPLIANCE PACK AND THE LMI AGREE, OR THE PACK SAYS SO.
//
// 22 Oct 2026. Fabio: "compliance notes need to be matching LMIs". Two ways
// they did not.
//
// The LVR box read bc.lmiApplicable and bc.lmi directly. On 20 Oct the premium
// moved onto each security, so on a deal recorded that way the pack shouted
// "NOT RECORDED - whether lenders mortgage insurance applies at 91.8%" with
// the figure sitting on the file. A false red flag in a document that goes to
// a lender.
//
// And it never said HOW the premium is paid, so an assessor could not tell
// whether the loan amount three boxes up already had it in.
import { describe, it, expect } from 'vitest'
import { lvrLine } from './box-deposit'

const deal = (bc: any) => ({ bc_data: bc, lo_data: {}, fact_find_data: {} })

// A build at 91.8%: land 378,000 + build 375,576 + duty 19,035, lending
// 780,000 against an "as if complete" valuation of 850,000.
const BUILD = {
  template: 'construction', landFunding: 'purchase', landValue: '378,000',
  constructionCost: '375,576', stampDuty: '19,035',
  propertyValue: '850,000', asIfCompleteValue: '850,000',
  splits: [{ amount: '780,000' }],
}
const PER_SECURITY = {
  securityIds: ['a'], securityLimits: { a: '780,000' },
  securityLmiApplicable: { a: 'Applicable' },
  securityLmi: { a: '18,000' },
}
const said = (bc: any) => lvrLine(deal(bc)).parts.join(' ')
const gapsOf = (bc: any) => lvrLine(deal(bc)).gaps.map(g => g.what)

describe('a premium recorded against the security', () => {
  const bc = { ...BUILD, ...PER_SECURITY, securityLmiTreatment: { a: 'Capitalised' } }

  it('is read, not reported missing', () => {
    expect(said(bc)).toContain('$18,000')
    expect(said(bc)).not.toContain('NOT RECORDED')
    expect(gapsOf(bc)).toHaveLength(0)
  })
})

describe('how the premium is paid', () => {
  it('capitalised says the loan figure already includes it', () => {
    const bc = { ...BUILD, lmiApplicable: 'Applicable', lmi: '18,000', lmiTreatment: 'Capitalised' }
    expect(said(bc)).toContain('capitalised onto the loan')
    expect(gapsOf(bc)).toHaveLength(0)
  })

  it('settlement says it is not in the loan figure', () => {
    const bc = { ...BUILD, lmiApplicable: 'Applicable', lmi: '18,000', lmiTreatment: 'Settlement' }
    expect(said(bc)).toContain('not included in the loan amount')
    expect(gapsOf(bc)).toHaveLength(0)
  })

  it('unanswered is named as a gap rather than guessed at', () => {
    const bc = { ...BUILD, lmiApplicable: 'Applicable', lmi: '18,000' }
    expect(said(bc)).toContain('$18,000')
    expect(gapsOf(bc)).toContain('How the LMI is paid')
  })
})

describe('what does not change', () => {
  it('waived still reads exactly as it did', () => {
    const bc = { ...BUILD, lmiApplicable: 'Waived' }
    expect(said(bc)).toContain('has been waived')
    expect(gapsOf(bc)).toHaveLength(0)
  })

  it('applicable with no figure anywhere still asks for the estimate', () => {
    const bc = { ...BUILD, lmiApplicable: 'Applicable' }
    expect(gapsOf(bc)).toContain('LMI estimate')
  })

  it('nothing answered at all still asks the first question', () => {
    expect(gapsOf(BUILD)).toContain('LMI status')
  })

  it('at or under 80% the pack says nothing about LMI, as before', () => {
    const bc = { ...BUILD, splits: [{ amount: '600,000' }] }
    expect(said(bc)).not.toContain('mortgage insurance')
    expect(gapsOf(bc)).toHaveLength(0)
  })
})
