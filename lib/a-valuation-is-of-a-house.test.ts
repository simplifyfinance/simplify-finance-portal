import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  buildValuation, splitAddress, loanPurposeOf, valueTypeOf, propertyUseOf,
  expectedLvr, isAnz, hasBankwest, byHandOnly, copyList, valuationRef, canOrder,
  VALUER_EMAIL, COPY_TO,
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
  lenders: ['ING'], propertyType: 'House', accessType: 'Owner',
  accessMobile: '0412 345 678',
}
const WHO = { name: 'Ellie', email: 'ellie@simplifyfinance.com.au' }
const BROKER = { name: 'Fabio De Castro', email: 'fabio@simplifyfinance.com.au' }
const v = buildValuation(DEAL, SECURITY, ANSWERS, WHO, BROKER)

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
      { ...ANSWERS, accessType: 'Agent', accessFirst: 'Sam', accessLast: 'Reed' }, WHO, BROKER)
    expect(agent.body).toContain('AccessFirstName: Sam')
    expect(agent.body).toContain('AccessLastName: Reed')
  })
})

describe('ANZ ASKS FIVE MORE, AND NOBODY ELSE IS ASKED THEM', () => {
  const anz = buildValuation(DEAL, SECURITY, {
    ...ANSWERS, lenders: ['ANZ - Brokers'], anzLvr: '80', anzTenure: 'Company title',
    anzHolds: true, anzOnCompletion: false, anzAncillary: ['Pool', 'Carport'],
  }, WHO, BROKER)

  it('it knows which lender that is, whatever the library calls it', () => {
    // CoreLogic's own list says "ANZ - Brokers", so an exact match misses it.
    expect(isAnz(['ANZ'])).toBe(true)
    expect(isAnz(['ANZ - Brokers'])).toBe(true)
    expect(isAnz(['ING', 'ANZ'])).toBe(true)
    expect(isAnz(['ING'])).toBe(false)
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
      { ...ANSWERS, lenders: ['ING'], anzLvr: '80', anzTenure: 'Strata' }, WHO, BROKER)
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
    const bare = buildValuation(DEAL, SECURITY, {}, WHO, BROKER)
    expect(bare.missing).toContain('at least one lender')
    expect(bare.missing).toContain('the property type')
    expect(bare.missing).toContain('who lets the valuer in')
    expect(bare.missing).toContain('a mobile for the access contact')
  })

  it('AND A HOUSE WITH NO ADDRESS CANNOT BE VALUED', () => {
    // A purchase that is still TBA has nothing for CoreLogic to look up.
    const tba = buildValuation(DEAL, { ...SECURITY, address: 'TBA' }, ANSWERS, WHO, BROKER)
    expect(tba.missing.join(' ')).toContain('a full address')
    expect(canOrder({ address: 'TBA' })).toBe(true)
    expect(canOrder({ address: '' })).toBe(false)
  })

  it('and a company name is only wanted when the tick is on', () => {
    expect(buildValuation(DEAL, SECURITY, { ...ANSWERS, inCompany: true }, WHO, BROKER).missing)
      .toContain('the company name')
    expect(buildValuation(DEAL, SECURITY, ANSWERS, WHO, BROKER).missing)
      .not.toContain('the company name')
  })

  it('AND ANZ’S OWN QUESTIONS ARE ONLY MISSING FOR ANZ', () => {
    expect(buildValuation(DEAL, SECURITY, { ...ANSWERS, lenders: ['ANZ'] }, WHO, BROKER).missing)
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

  // THE PORTAL SENDS IT NOW. 17 Aug 2026.
  //
  // This used to put the request on the clipboard and open a blank mail window
  // for somebody to paste into - six steps, three of which can simply not
  // happen with nothing here any the wiser. Fabio: "I don't want to copy and
  // paste to the bot - cant we use resend so the email goes without my staff
  // having to press". See app/api/send-valuation/route.ts.
  it('SENDS IT RATHER THAN ASKING SOMEBODY TO PASTE IT', () => {
    const at = UI.indexOf('async function send()')
    expect(at).toBeGreaterThan(-1)
    const block = UI.slice(at, UI.indexOf('async function copyAndOpen', at))
    expect(block).toContain("fetch('/api/send-valuation'")
    expect(block).not.toContain('clipboard.writeText')
    expect(block).not.toContain('window.location.href')
  })

  it('AND THE OLD WAY IS KEPT AS THE FALLBACK', () => {
    // Nothing in this portal is ever blocked. The day the mail service is down,
    // the clipboard and the mail window are one button away.
    expect(UI).toContain('async function copyAndOpen')
    expect(UI).toContain('Copy it and open my mail')
  })

  it('AND NOTHING IS RECORDED UNTIL IT HAS ACTUALLY GONE', () => {
    // A deal that says a valuation was ordered when none was is worse than no
    // record at all. The route writes the date after the send, not before.
    // The UPDATE, not the SELECT - the route reads the column on the way in,
    // which is why this looks for the write and not just the name.
    const route = readFileSync('app/api/send-valuation/route.ts', 'utf8')
    const write = route.indexOf('.update({ valuations_ordered')
    expect(write).toBeGreaterThan(-1)
    expect(write).toBeGreaterThan(route.indexOf('api.resend.com'))
  })

  it('AND A FAILED WRITE DOES NOT SAY THE ORDER DID NOT HAPPEN', () => {
    // By then the email has gone. Saying nothing was sent would send somebody
    // to order the same valuation twice.
    expect(UI).toContain('It was sent, but the date could not be saved')
  })

  it('and the file writes itself, with the figures in it', () => {
    expect(UI).toContain('sentNote(box)')
  })

  it('and the box that comes back says what went', () => {
    // Fabio's own list: valuation amount, LVR, banks, broker.
    expect(UI).toContain('Valuation ordered')
    expect(UI).toContain('sent.box.rows')
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

// --- 5 Nov 2026, the second spec -------------------------------------------
//
// Five changes, and three of them exist because the person who PRESSES the
// button is not always the person whose deal it is.

describe('ONE PROPERTY, SEVERAL LENDERS, ONE EMAIL', () => {
  const three = buildValuation(DEAL, SECURITY,
    { ...ANSWERS, lenders: ['ING', 'ANZ - Brokers', 'Macquarie'],
      anzLvr: '80', anzTenure: 'Freehold', anzHolds: false, anzOnCompletion: false }, WHO, BROKER)

  it('they go out on one line, as CoreLogic spells them', () => {
    // "separated by ' | ' (e.g. ING | ANZ - Brokers | Macquarie)". These are
    // the library's names, which is why they are not an enum of ours.
    expect(three.body).toContain('Lender: ING | ANZ - Brokers | Macquarie')
  })

  it('AND EVERYTHING ELSE IS ASKED ONCE', () => {
    // Three lenders is three orders off one set of answers. Asking the same
    // fifteen questions per bank would be asking them again.
    expect((three.body.match(/StreetAddress:/g) || []).length).toBe(1)
    expect((three.body.match(/AccessMobile:/g) || []).length).toBe(1)
  })

  it('and a bank in the list brings its own questions with it', () => {
    expect(three.body).toContain('ANZ_ExpectedLVR: 80')
  })

  it('AND A LENDER VALERIO CANNOT ORDER IS NAMED, NOT REFUSED', () => {
    // He orders the others and writes back that this one needs a person, so
    // ticking it is a note rather than a mistake.
    expect(byHandOnly(['ING', 'CBA'])).toEqual(['CBA'])
    expect(byHandOnly(['ING'])).toEqual([])
    expect(buildValuation(DEAL, SECURITY, { ...ANSWERS, lenders: ['ING', 'CBA'] }, WHO, BROKER).byHand)
      .toEqual(['CBA'])
  })

  it('and nothing ticked is the one thing it will not send', () => {
    expect(buildValuation(DEAL, SECURITY, { ...ANSWERS, lenders: [] }, WHO, BROKER).missing)
      .toContain('at least one lender')
  })
})

describe('AND IT IS ORDERED UNDER THE BROKER, NOT THE PRESSER', () => {
  it('both names go, and they are different people', () => {
    // Valerio signs into CoreLogic with the broker's own login, so a
    // valuation ordered by credit still lands in the right broker's account.
    expect(v.body).toContain('RequestedByName: Ellie')
    expect(v.body).toContain('RequestedByEmail: ellie@simplifyfinance.com.au')
    expect(v.body).toContain('BrokerName: Fabio De Castro')
    expect(v.body).toContain('BrokerEmail: fabio@simplifyfinance.com.au')
  })

  it('AND A DEAL WITH NO BROKER IS ASKED, NOT GUESSED', () => {
    const none = buildValuation(DEAL, SECURITY, ANSWERS, WHO, undefined)
    expect(none.missing).toContain('which broker to order it under')
  })

  it('and half a broker is no broker', () => {
    expect(buildValuation(DEAL, SECURITY, ANSWERS, WHO, { name: 'Someone' }).missing)
      .toContain('which broker to order it under')
  })
})

describe('AND NOBODY IS COPIED TWICE', () => {
  it('the broker and Fabio, when credit pressed it', () => {
    expect(copyList('ellie@simplifyfinance.com.au', 'mark@simplifyfinance.com.au'))
      .toEqual(['mark@simplifyfinance.com.au', COPY_TO])
  })

  it('AND FABIO ONCE WHEN FABIO IS THE BROKER', () => {
    expect(copyList('ellie@simplifyfinance.com.au', COPY_TO)).toEqual([COPY_TO])
  })

  it('AND NOT AT ALL WHEN FABIO PRESSED IT HIMSELF', () => {
    // The reply already goes to the sender. Copying them is a second email
    // saying the same thing.
    expect(copyList(COPY_TO, COPY_TO)).toEqual([])
    expect(copyList(COPY_TO, '')).toEqual([])
  })

  it('and the broker is not copied on their own request', () => {
    expect(copyList('mark@simplifyfinance.com.au', 'mark@simplifyfinance.com.au'))
      .toEqual([COPY_TO])
  })

  it('AND CASE IS NOT A DIFFERENT PERSON', () => {
    expect(copyList('Fabio@SimplifyFinance.com.au', COPY_TO)).toEqual([])
  })

  it('and the request carries the same list the screen shows', () => {
    expect(v.cc).toEqual([COPY_TO])
  })
})

describe('AND BANKWEST ASKS ITS OWN FOUR', () => {
  const bw = buildValuation(DEAL, SECURITY, {
    ...ANSWERS, lenders: ['Bankwest'], bwUnder50: false,
    bwCurrentLenderBwCba: true, bwSpecial: ['BRIDGING', 'OVER_2HA'],
  }, WHO, BROKER)

  it('it knows when Bankwest is one of them', () => {
    expect(hasBankwest(['Bankwest'])).toBe(true)
    expect(hasBankwest(['ING', 'Bankwest'])).toBe(true)
    expect(hasBankwest(['ING'])).toBe(false)
  })

  it('and the four go out in its words', () => {
    expect(bw.body).toContain('BW_Under50sqm: N')
    expect(bw.body).toContain('BW_CurrentLenderBWCBA: Y')
    expect(bw.body).toContain('BW_Special: BRIDGING, OVER_2HA')
  })

  it('AND NOTHING TICKED IS NONE, NOT BLANK', () => {
    // Blank would read as a question nobody was asked.
    const plain = buildValuation(DEAL, SECURITY,
      { ...ANSWERS, lenders: ['Bankwest'], bwUnder50: false, bwCurrentLenderBwCba: false }, WHO, BROKER)
    expect(plain.body).toContain('BW_Special: NONE')
  })

  it('AND IT ASKS ONE OR THE OTHER, NEVER BOTH', () => {
    // Off the plan on a purchase; the current lender on a refinance.
    expect(bw.body).toContain('BW_OffThePlan:\n')
    const buying = buildValuation(DEAL, { ...SECURITY, id: 'BEING_PURCHASED' },
      { ...ANSWERS, lenders: ['Bankwest'], bwUnder50: false, bwOffThePlan: true }, WHO, BROKER)
    expect(buying.body).toContain('BW_OffThePlan: Y')
    expect(buying.body).toContain('BW_CurrentLenderBWCBA:\n')
  })

  it('and a purchase is asked about off the plan, not about its current lender', () => {
    const buying = buildValuation(DEAL, { ...SECURITY, id: 'BEING_PURCHASED' },
      { ...ANSWERS, lenders: ['Bankwest'], bwUnder50: false }, WHO, BROKER)
    expect(buying.missing).toContain('whether it is off the plan — Bankwest asks')
    expect(buying.missing).not.toContain('whether the current lender is Bankwest or CBA — Bankwest asks')
  })

  it('AND NOTHING OF BANKWEST’S LEAKS OUT UNDER ANOTHER LENDER', () => {
    const ing = buildValuation(DEAL, SECURITY,
      { ...ANSWERS, lenders: ['ING'], bwUnder50: true, bwSpecial: ['BRIDGING'] }, WHO, BROKER)
    expect(ing.body).toContain('BW_Under50sqm:\n')
    expect(ing.body).not.toContain('BRIDGING')
  })

  it('AND AN UNANSWERED YES OR NO IS BLANK, NEVER A GUESSED NO', () => {
    // "No" is an answer with consequences. Nobody has given it yet.
    const unasked = buildValuation(DEAL, SECURITY, { ...ANSWERS, lenders: ['Bankwest'] }, WHO, BROKER)
    expect(unasked.body).toContain('BW_Under50sqm:\n')
    expect(unasked.missing).toContain('whether it is under 50 m² — Bankwest asks')
  })
})

describe('AND THE SCREEN KEEPS UP', () => {
  const UI = readFileSync('components/OrderValuation.tsx', 'utf8')

  it('lenders are ticked, not chosen one at a time', () => {
    expect(UI).toContain('Lenders — tick as many as you want')
    // The broker is still a dropdown, and should be - there is one of those.
    expect(UI).not.toContain('{lenders.map(l => <option')
  })

  it('AND THE BROKER COMES OFF user_profiles, WHICH ALREADY HOLDS THE EMAIL', () => {
    expect(UI).toContain("from('user_profiles')")
    expect(UI).toContain('broker_key')
  })

  it('and the deal’s own broker is shown rather than asked', () => {
    expect(UI).toContain('deal?.assigned_broker && broker')
  })

  it('AND THE CC LIST IS THE ONE THE LIBRARY WORKED OUT', () => {
    // So the screen and the email cannot disagree about who was copied.
    expect(UI).toContain('req.cc.join')
  })

  it('and Bankwest brings its panel with it', () => {
    expect(UI).toContain('Bankwest asks four more')
    expect(UI).toContain('BW_SPECIAL.map')
  })
})
