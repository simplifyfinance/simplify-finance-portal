import { describe, it, expect } from 'vitest'
import { boxNine, securitiesOf } from './box-security'
import { DEAL } from './box-fixture'

const deal = (over: any = {}) => ({ ...JSON.parse(JSON.stringify(DEAL)), id: 'deal-1', ...over })

const bc = (over: any, lending?: string) => {
  const d = deal()
  d.bc_data = { ...d.bc_data, ...over }
  if (lending !== undefined) d.lo_data = { ...d.lo_data, loanAmount: lending }
  return d
}

// A property on the fact find that IS being refinanced.
const withRefinanced = (over: any = {}, propOver: any = {}) => {
  const d = bc({ template: 'refinance_only', purchasePrice: '', newPurchasePrice: '',
                 propertyValue: '', ...over }, '640000')
  d.compliance_data = { ...d.compliance_data, securityAddress: '' }
  d.fact_find_data = { ...d.fact_find_data, properties: [{
    id: 'p1', address: '8 Sample Road, Hawthorn VIC 3122', value: '1,050,000',
    ownershipType: 'Owner occupied', propertySubtype: 'Townhouse', zoning: 'Residential',
    futureUse: 'Ongoing', valuationMethod: 'Applicant estimate',
    loans: [{ id: 'l1', lenderName: 'Macquarie', balance: '640,000', status: 'To be refinanced' }],
    ...propOver,
  }] }
  return d
}

// WHAT IS SECURITY AND WHAT IS NOT.
//
// The whole box turns on this. A property the clients own is not security
// unless it is being bought or a loan on it is being refinanced - naming one
// that is not tells an assessor the lender is taking something it is not.
describe('what counts as security', () => {
  it('does not name a property the clients merely own', () => {
    // Fielding own 14 Sample Street worth $3m with an Ongoing Macquarie loan.
    const t = boxNine(deal()).text
    expect(t).not.toContain('14 Sample Street')
    expect(t).not.toContain('Macquarie')
  })

  it('names a property whose loan is being refinanced', () => {
    expect(boxNine(withRefinanced()).text).toContain('8 Sample Road, Hawthorn VIC 3122')
  })

  it('counts a loan marked for consolidation too', () => {
    const d = withRefinanced({}, { loans: [{ id: 'l1', lenderName: 'ANZ', balance: '80,000', status: 'To be consolidated' }] })
    expect(securitiesOf(d)).toHaveLength(1)
  })

  it('ignores a loan that is simply ongoing', () => {
    const d = withRefinanced({}, { loans: [{ id: 'l1', lenderName: 'Macquarie', balance: '640,000', status: 'Ongoing' }] })
    expect(securitiesOf(d)).toHaveLength(0)
  })

  it('agrees with the deal structure block on how many there are', () => {
    // securityValue() counts them for the block; this lists them. If the two
    // ever disagree the box is describing a deal nobody is looking at.
    const both = withRefinanced({ purchasePrice: '780,000' }, {})
    expect(securitiesOf(both)).toHaveLength(2)
  })

  it('says so when there is nothing at all', () => {
    const d = bc({ purchasePrice: '', newPurchasePrice: '', propertyValue: '', splits: [] }, '')
    d.fact_find_data = { ...d.fact_find_data, properties: [] }
    const r = boxNine(d)
    expect(r.text).toMatch(/\*\* NOT RECORDED — no property is recorded as security/)
    expect(r.gaps.map(g => g.what)).toContain('Security')
  })
})

describe('a pre-approval with no address', () => {
  it('never doubles the article or the word', () => {
    // 10 Sep 2026, first run: "The security for this loan is the an
    // owner-occupied owner-occupied to be purchased in NSW." Two faults - "the"
    // in front of a phrase that already carried "an", and newPurchasePropertyType
    // read as a subtype when it holds the use.
    const t = boxNine(deal()).text
    expect(t).not.toMatch(/\bthe an?\b/)
    expect(t).not.toMatch(/\b(\w[\w-]+) \1\b/)
    expect(t).toContain('the owner-occupied property to be purchased in NSW')
  })

  it('states it plainly rather than shouting, because it is a fact', () => {
    const t = boxNine(deal()).text
    expect(t).toMatch(/The address is not yet known as this is a pre-approval/)
    expect(t).not.toMatch(/NOT RECORDED — the security address/)
  })

  it('names the state the duty was worked out in', () => {
    expect(boxNine(deal()).text).toContain('in NSW')
  })

  it('shouts when the address is blank and it is NOT a pre-approval', () => {
    const d = deal()
    d.compliance_data = { ...d.compliance_data, preApproval: false, securityAddress: '' }
    const r = boxNine(d)
    expect(r.text).toMatch(/\*\* NOT RECORDED — the security address\. \*\*/)
    expect(r.gaps.map(g => g.what)).toContain('Security address')
  })
})

describe('a purchase with an address', () => {
  const d = () => {
    const x = bc({ purchasePrice: '780,000', propertyType: 'Owner occupied',
                   purchasePropertySubtype: 'Fully detached house', dutyState: 'VIC' }, '624000')
    x.compliance_data = { ...x.compliance_data, preApproval: false,
                          securityAddress: '12 Example Street, Richmond VIC 3121' }
    return x
  }

  it('names the address, what it is, and the price', () => {
    const t = boxNine(d()).text
    expect(t).toContain('12 Example Street, Richmond VIC 3121')
    expect(t).toContain('an owner occupied fully detached house being purchased for $780,000')
  })

  it('states the LVR from the deal structure block', () => {
    expect(boxNine(d()).text).toMatch(/loan to value ratio of 80%/)
  })

  it('never assembles a description out of blanks', () => {
    const x = bc({ purchasePrice: '780,000', propertyType: '', purchasePropertySubtype: '',
                   newPurchasePropertyType: '', dutyState: 'VIC' }, '624000')
    x.compliance_data = { ...x.compliance_data, preApproval: false, securityAddress: '12 Example Street' }
    const t = boxNine(x).text
    expect(t).toContain('12 Example Street, the property being purchased')
    expect(t).not.toMatch(/\ba\s+being\b|an\s+being/)
  })
})

describe('a refinance of an existing property', () => {
  const t = () => boxNine(withRefinanced()).text

  it('names it, what it is, and what it is worth', () => {
    expect(t()).toContain('8 Sample Road, Hawthorn VIC 3122, an owner occupied townhouse valued at $1,050,000')
  })

  it('says the value is the applicants own estimate', () => {
    expect(t()).toMatch(/The value is the applicants' own estimate and will be confirmed by the lender's valuation\./)
  })

  it('does not say that when the value came from somewhere else', () => {
    const d = withRefinanced({}, { valuationMethod: 'Rates notice' })
    expect(boxNine(d).text).not.toMatch(/own estimate/)
  })

  it('names the existing mortgagee and what is owing', () => {
    expect(t()).toContain('currently mortgaged to Macquarie with $640,000 outstanding, which is being refinanced')
  })

  it('shouts for a missing value rather than treating it as nil', () => {
    const d = withRefinanced({}, { value: '' })
    const r = boxNine(d)
    expect(r.text).toMatch(/\*\* NOT RECORDED — the value of 8 Sample Road/)
    expect(r.gaps.some(g => /Value of/.test(g.what))).toBe(true)
  })

  it('shouts for a missing address', () => {
    const d = withRefinanced({}, { address: '' })
    const r = boxNine(d)
    expect(r.text).toMatch(/\*\* NOT RECORDED — the address of the property being taken as security/)
    expect(r.gaps.map(g => g.what)).toContain('Security address')
  })
})

describe('more than one security', () => {
  const d = () => withRefinanced({ purchasePrice: '780,000', dutyState: 'VIC',
    propertyType: 'Owner occupied', purchasePropertySubtype: 'Unit' }, {})

  it('says how many, then lists them', () => {
    const t = boxNine(d()).text
    expect(t).toMatch(/^Two properties are being taken as security\./)
    expect(t).toContain('8 Sample Road')
  })

  it('uses "One security is" rather than "The security for this loan is"', () => {
    const t = boxNine(d()).text
    expect(t).toContain('One security is')
    expect(t).not.toContain('The security for this loan is')
  })

  it('adds the LVR up across all of them', () => {
    expect(boxNine(d()).text).toMatch(/combined security of \$1,830,000 is a loan to value ratio/)
  })
})

describe('the two extra sentences, only when answered', () => {
  it('says nothing about future use when it is simply ongoing', () => {
    expect(boxNine(withRefinanced()).text).not.toMatch(/after settlement|to be sold/i)
  })

  it('says so when the property will change use', () => {
    const d = withRefinanced({}, { futureUse: 'Will become investment' })
    expect(boxNine(d).text).toContain('The property will become an investment after settlement.')
  })

  it('says so when it is to be sold', () => {
    const d = withRefinanced({}, { futureUse: 'To be sold' })
    expect(boxNine(d).text).toContain('The property is to be sold.')
  })

  it('says nothing about zoning when it is residential', () => {
    expect(boxNine(withRefinanced()).text).not.toMatch(/zoned/)
  })

  it('flags a zoning that could narrow the lenders', () => {
    const d = withRefinanced({}, { zoning: 'Rural' })
    expect(boxNine(d).text).toContain('The property is zoned rural, which may restrict the lenders able to consider it.')
  })
})

describe('it does not do box four’s job', () => {
  it('never lists the lender fees', () => {
    for (const d of [deal(), withRefinanced()]) {
      expect(boxNine(d).text).not.toMatch(/application fee|annual fee|legal fee|valuation fee of|government charges/i)
    }
  })
})

describe('it reads like a person wrote it', () => {
  it('leaves no raw key, placeholder or NaN', () => {
    for (const d of [deal(), withRefinanced(), withRefinanced({ purchasePrice: '780,000' })]) {
      const t = boxNine(d).text
      expect(t).not.toMatch(/undefined|NaN|\[object|propertySubtype|ownershipType|oo_purchase/)
      expect(t).not.toMatch(/ {2}|\.\.|,,| ,/)
    }
  })

  it('stays short', () => {
    const n = boxNine(deal()).text.split(/\s+/).length
    expect(n).toBeGreaterThan(15)
    expect(n).toBeLessThan(180)
  })

  it('is the same words every time for one deal', () => {
    expect(new Set(Array.from({ length: 20 }, () => boxNine(deal()).text)).size).toBe(1)
  })
})
