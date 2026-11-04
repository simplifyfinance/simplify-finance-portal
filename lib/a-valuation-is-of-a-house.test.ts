import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  buildValuation, splitAddress, loanPurposeOf, valueTypeOf, propertyUseOf,
  expectedLvr, isAnz, valuationRef, canOrder, VALUER_EMAIL,
} from './order-a-valuation'

// A VALUATION IS OF A HOUSE, NOT OF A DEAL.
//
// 4 Nov 2026. Fabio: "I want a button in the BC stage that the credit team can
// press... just remember, we want this to be easy."
//
// So it sits on the security rather than at the top of the page. A deal with a
// house being refinanced and a house being bought has two of them: valued
// separately, by different lenders, at different times. One button above the
// page could not say which it meant, and somebody would have to type an
// address into the box - which is how a valuer ends up at the wrong house.
//
// Valerio's spec is docs/CRM_valuation_email_spec.md. It asks fifteen
// questions; eleven are already on the deal.

const SECURITY = {
  id: 'p1',
  address: '13 Kalinga Road, Ocean Grove VIC 3226, Australia',
  use: 'Owner occupied',
  subtype: 'House',
  value: '1,200,000',
  limit: '960,000',
}

const DEAL = {
  id: '5b3163bc-90bd-447c-b620-8b68c2d01622',
  bc_data: { template: 'refi_equity', dutyState: 'VIC' },
  fact_find_data: {
    applicants: [{ firstName: 'Mai', lastName: 'Chen' }],
    properties: [{ id: 'p1', address: '13 Kalinga Road, Ocean Grove VIC 3226',
      loans: [{ lenderName: 'ANZ', balance: '600000', status: 'Refinance' }] }],
  },
}

const ANSWERS = {
  lender: 'ING', propertyType: 'House', accessType: 'Owner',
  accessMobile: '0412 345 678',
}
const WHO = { name: 'Ellie', email: 'ellie@simplifyfinance.com.au' }
const v = buildValuation(DEAL, SECURITY, ANSWERS, WHO)

describe('THE ADDRESS IS PULLED APART, NEVER RETYPED', () => {
  it('street, suburb, state and postcode out of one line', () => {
    expect(splitAddress('13 Kalinga Road, Ocean Grove VIC 3226, Australia')).toEqual({
      street: '13 Kalinga Road', suburb: 'Ocean Grove', state: 'VIC', postcode: '3226',
    })
  })

  it('and a unit number stays with the street', () => {
    expect(splitAddress('5/12 Example St, Ryde NSW 2112').street).toBe('5/12 Example St')
  })

  it('AND ANYTHING IT CANNOT READ COMES BACK EMPTY', () => {
    // A blank is something Valerio writes back about. A wrong suburb is a
    // valuation of somebody else's house.
    expect(splitAddress('TBA')).toEqual({ street: '', suburb: '', state: '', postcode: '' })
    expect(splitAddress('')).toEqual({ street: '', suburb: '', state: '', postcode: '' })
  })

  it('and it reaches the email in four separate keys', () => {
    expect(v.body).toContain('StreetAddress: 13 Kalinga Road')
    expect(v.body).toContain('Suburb: Ocean Grove')
    expect(v.body).toContain('State: VIC')
    expect(v.body).toContain('Postcode: 3226')
  })
})

describe('WHAT THE DEAL ALREADY KNOWS IS NOT ASKED', () => {
  it('the purpose, off the security’s own loans', () => {
    expect(loanPurposeOf(SECURITY, DEAL.bc_data, DEAL.fact_find_data)).toBe('REFINANCE')
    expect(loanPurposeOf({ id: 'BEING_PURCHASED' }, {}, {})).toBe('PURCHASE')
    expect(v.body).toContain('LoanPurpose: REFINANCE')
  })

  it('AND THE VALUE TYPE FOLLOWS FROM IT, which is why it is not a question', () => {
    expect(valueTypeOf('PURCHASE')).toBe('CONTRACT_PRICE')
    expect(valueTypeOf('REFINANCE')).toBe('CUSTOMER_ESTIMATE')
    expect(v.body).toContain('ValueType: CUSTOMER_ESTIMATE')
  })

  it('the use, the loan and the value', () => {
    expect(propertyUseOf('Owner occupied')).toBe('OWNER_OCCUPIED')
    expect(v.body).toContain('PropertyUse: OWNER_OCCUPIED')
    expect(v.body).toContain('LoanAmount: 960000')
    expect(v.body).toContain('ValueAmount: 1200000')
  })

  it('and the borrower, surname and all', () => {
    // DELIBERATE, and the opposite of lib/serviceability-request.ts. A valuer
    // has to get inside a house.
    expect(v.body).toContain('BorrowerFirstName: Mai')
    expect(v.body).toContain('BorrowerLastName: Chen')
  })

  it('AND WHO OPENS THE DOOR IS THE CLIENT WHERE IT IS THE CLIENT', () => {
    expect(v.body).toContain('AccessContactType: OWNER')
    expect(v.body).toContain('AccessFirstName: Mai')
    expect(v.body).toContain('AccessLastName: Chen')
  })

  it('and an agent is somebody the deal has never heard of', () => {
    const agent = buildValuation(DEAL, SECURITY,
      { ...ANSWERS, accessType: 'Agent', accessFirst: 'Sam', accessLast: 'Reed' }, WHO)
    expect(agent.body).toContain('AccessFirstName: Sam')
    expect(agent.body).toContain('AccessLastName: Reed')
  })
})

describe('ANZ ASKS FIVE MORE, AND NOBODY ELSE IS ASKED THEM', () => {
  const anz = buildValuation(DEAL, SECURITY, {
    ...ANSWERS, lender: 'ANZ', anzLvr: '80', anzTenure: 'Company title',
    anzHolds: true, anzOnCompletion: false, anzAncillary: ['Pool', 'Carport'],
  }, WHO)

  it('it knows which lender that is', () => {
    expect(isAnz('ANZ')).toBe(true)
    expect(isAnz('anz')).toBe(true)
    expect(isAnz('ING')).toBe(false)
  })

  it('and the five go out in its words', () => {
    expect(anz.body).toContain('ANZ_ExpectedLVR: 80')
    expect(anz.body).toContain('ANZ_Tenure: COMPANY_TITLE')
    expect(anz.body).toContain('ANZ_HoldsSecurity: Y')
    expect(anz.body).toContain('ANZ_OnCompletion: N')
    expect(anz.body).toContain('ANZ_Ancillary: POOL, CARPORT')
  })

  it('AND FOR ANY OTHER LENDER THEY ARE BLANK, NOT MISSING', () => {
    // "Fields that don't apply are sent blank - never removed."
    expect(v.body).toContain('ANZ_ExpectedLVR:')
    expect(v.body).toContain('ANZ_Tenure:')
    expect(v.body).toContain('ANZ_HoldsSecurity:')
    expect(v.body).toContain('ANZ_Ancillary:')
    expect(v.body).not.toContain('ANZ_HoldsSecurity: N\n')
  })

  it('and an answer typed for ANZ does not leak out under another lender', () => {
    const ing = buildValuation(DEAL, SECURITY,
      { ...ANSWERS, lender: 'ING', anzLvr: '80', anzTenure: 'Strata' }, WHO)
    expect(ing.body).not.toContain('STRATA')
    expect(ing.body).not.toContain('ANZ_ExpectedLVR: 80')
  })

  it('AND THE LVR IS WORKED OUT, NOT ASKED', () => {
    expect(expectedLvr('960000', '1200000')).toBe('80')
    expect(expectedLvr('', '1200000')).toBe('')
    expect(expectedLvr('960000', '')).toBe('')
  })
})

describe('AND THE SHAPE IS VALERIO’S', () => {
  it('the version line and the end line', () => {
    expect(v.body.startsWith('=== VALUATION REQUEST v1 ===')).toBe(true)
    expect(v.body.trimEnd().endsWith('=== END ===')).toBe(true)
  })

  it('the subject it parses', () => {
    expect(v.subject).toBe('VALUATION REQUEST v1 – Mai – Ocean Grove')
  })

  it('it goes to the valuations bot and nowhere else', () => {
    expect(v.to).toBe(VALUER_EMAIL)
  })

  it('money is digits, with no dollar sign and no commas', () => {
    expect(v.body).not.toContain('$')
    expect(v.body).not.toContain('1,200,000')
  })

  it('AND NOTHING ASKS ABOUT URGENCY', () => {
    // Every BC-stage order is standard, so there is no question to ask.
    expect(v.body).not.toContain('Urgency')
  })

  it('and the reference is the same for the same house every time', () => {
    expect(valuationRef(DEAL, SECURITY)).toBe(v.ref)
    expect(/^SF-\d{5}$/.test(v.ref)).toBe(true)
  })

  it('AND TWO SECURITIES ON ONE DEAL ARE TWO DIFFERENT REFERENCES', () => {
    // One email per property per lender, and the answer has to find its way
    // back to the right house.
    expect(valuationRef(DEAL, { id: 'BEING_PURCHASED' })).not.toBe(v.ref)
  })
})

describe('AND IT SAYS WHAT VALERIO WOULD ASK FOR', () => {
  it('nothing, when the box is filled in', () => {
    expect(v.missing).toEqual([])
  })

  it('and names each one in words, not as a key', () => {
    const bare = buildValuation(DEAL, SECURITY, {}, WHO)
    expect(bare.missing).toContain('the lender')
    expect(bare.missing).toContain('the property type')
    expect(bare.missing).toContain('who lets the valuer in')
    expect(bare.missing).toContain('a mobile for the access contact')
  })

  it('AND A HOUSE WITH NO ADDRESS CANNOT BE VALUED', () => {
    // A purchase that is still TBA has nothing for CoreLogic to look up.
    const tba = buildValuation(DEAL, { ...SECURITY, address: 'TBA' }, ANSWERS, WHO)
    expect(tba.missing.join(' ')).toContain('a full address')
    expect(canOrder({ address: 'TBA' })).toBe(true)
    expect(canOrder({ address: '' })).toBe(false)
  })

  it('and a company name is only wanted when the tick is on', () => {
    expect(buildValuation(DEAL, SECURITY, { ...ANSWERS, inCompany: true }, WHO).missing)
      .toContain('the company name')
    expect(buildValuation(DEAL, SECURITY, ANSWERS, WHO).missing)
      .not.toContain('the company name')
  })

  it('AND ANZ’S OWN QUESTIONS ARE ONLY MISSING FOR ANZ', () => {
    expect(buildValuation(DEAL, SECURITY, { ...ANSWERS, lender: 'ANZ' }, WHO).missing)
      .toContain("ANZ's expected LVR")
    expect(v.missing).not.toContain("ANZ's expected LVR")
  })
})

describe('AND THE TWO BOTS DISAGREE ABOUT NAMES ON PURPOSE', () => {
  it('each file says why', () => {
    const val = readFileSync('lib/order-a-valuation.ts', 'utf8')
    const serv = readFileSync('lib/serviceability-request.ts', 'utf8')
    expect(val).toContain('AND SURNAMES GO IN THIS ONE')
    expect(serv).toContain('PRIVACY IS NOT A SETTING HERE')
  })
})

describe('AND THE SCREEN ASKS FOUR THINGS, NOT FIFTEEN', () => {
  const UI = readFileSync('components/OrderValuation.tsx', 'utf8')
  const BC = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

  it('it is on the security row, not at the top of the page', () => {
    expect(BC).toContain('<OrderValuation deal={deal} me={me}')
    expect(BC).toContain('security={{ id: String(p.id)')
  })

  it('AND THE LENDER LIST IS THE LIBRARY, NOT TEN NAMES IN THE CODE', () => {
    // Ten written in here would be wrong the first time somebody adds the
    // eleventh. Fabio: "carry all the lenders from the library."
    expect(UI).toContain("from('lenders')")
    expect(UI).not.toContain("'Bankwest', 'Macquarie'")
  })

  it('and the request is built in one place', () => {
    expect(UI).toContain('buildValuation(deal, security')
    expect(UI).not.toContain('=== VALUATION REQUEST')
    expect(UI).not.toContain('BorrowerLastName')
  })

  it('AND THE CLIPBOARD IS WRITTEN BEFORE THE MAILTO SPENDS THE CLICK', () => {
    const at = UI.indexOf('async function order()')
    const block = UI.slice(at, UI.indexOf('const Pills', at))
    expect(block.indexOf('window.location.href')).toBeGreaterThan(block.indexOf('clipboard.writeText'))
  })

  it('AND A FAILED WRITE DOES NOT SAY THE ORDER DID NOT HAPPEN', () => {
    // By then the email is open. Saying nothing was sent would send somebody
    // to order the same valuation twice.
    expect(UI).toContain('The email is open and on your clipboard')
  })

  it('and the file writes itself', () => {
    expect(UI).toContain('Valuation requested for')
  })

  it('AND THE BUTTON SAYS WHEN, AND STAYS PRESSABLE', () => {
    expect(UI).toContain('ask again')
    expect(UI).not.toContain('disabled={!!ordered}')
  })

  it('and nothing is blocked when something is missing', () => {
    // Same rule as the rest of the portal: it says what Valerio will ask for
    // and leaves the decision alone.
    expect(UI).toContain('Valerio will write back asking for')
    expect(UI).not.toContain('disabled={req.missing.length')
  })

  it('AND A STRAY CLICK DOES NOT THROW A TYPED MOBILE AWAY', () => {
    expect(UI).toContain('NO CLICK-AWAY')
  })
})
