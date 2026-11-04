import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  buildRequest, dealRef, suburbPostcode, stateOf, annual, monthly,
  employmentType, maritalStatus, liabilityType, liabilityAction, scenarioType,
  BOT_EMAIL,
} from './serviceability-request'

// NO SURNAME LEAVES THE BUILDING.
//
// 4 Nov 2026. Fabio: "we are asking for help from a bot to do serviceability
// calculations... I'm very conscious on privacy in terms of individual names
// attached to payslips and things like that. So I want to make sure it is only
// first name, not last name, no contact details."
//
// This is the test that has to hold when nobody is looking at it. The deal
// below carries everything a person could be identified by - surnames, dates
// of birth, phone numbers, emails, a street address, employer names, an ABN
// and an account number - and the request is then searched for every one of
// them. Not "the code does not seem to read surnames": the actual email, the
// actual strings, every time this suite runs.
//
// The bot's spec requires a FIRST name and puts it in the subject line, so
// that one is deliberate and there is nowhere to hide it anyway.

const DEAL = {
  id: '5b3163bc-90bd-447c-b620-8b68c2d01622',
  bc_data: {
    template: 'investment_purchase', newPurchasePrice: '1,600,000',
    newPurchaseSuburb: '13 Kalinga Road, Ocean Grove VIC 3226, Australia',
    propertyType: 'House', loanTerm: '30', lvr: '80',
  },
  fact_find_data: {
    dependants: '3', dependantAges: ['3', '7', '11'],
    applicants: [{
      firstName: 'Mai', lastName: 'Chen', dob: '1980-01-29',
      phoneMobile: '+61455783960', emailPersonal: 'bizzylittlebean@gmail.com',
      relationshipStatus: 'Married',
      addresses: [{ isCurrent: true, address: '13 Kalinga Road, Ocean Grove VIC 3226',
        residentialStatus: 'Own home - mortgage' }],
      employment: [{ isCurrent: true, employmentBasis: 'Full time', occupation: 'Builder',
        startDate: '2023-01-13', employerName: 'KAKA ENTERPRISES PTY LTD',
        employerAbn: '49639194951', onProbation: false }],
      income: [{ incomeType: 'PAYG', grossSalary: '165000', grossSalaryFrequency: 'Annually' }],
    }, {
      firstName: 'Jessie', lastName: 'Cardey', dob: '1988-09-09',
      phoneMobile: '+61455783960', emailPersonal: 'jessecardey@hotmail.com',
      relationshipStatus: 'Married',
      employment: [{ isCurrent: true, employmentBasis: 'Full time', occupation: 'Defence Contractor',
        employerName: 'OG Consillum Pty Ltd', employerAbn: '58621370018' }],
      income: [{ incomeType: 'PAYG', grossSalary: '2307', grossSalaryFrequency: 'Weekly' }],
    }],
    liabilities: [
      { liabilityType: 'Credit card', lenderName: 'NAB', limitAmount: '$35,900', balance: '0',
        accountNumber: '4564 1234 5678 9012', status: 'Remain open' },
      { liabilityType: 'Car loan', lenderName: 'NAB Car Loan', balance: '$19,000',
        repaymentAmount: '$706', repaymentFrequency: 'Monthly', status: 'To be closed' },
    ],
    properties: [{ address: '13 Kalinga Road, Ocean Grove VIC 3226', ownershipType: 'Owner occupied',
      value: '1,200,000', rentalIncome: '', loans: [{ lenderName: 'ANZ', balance: '600,000',
        interestRate: '6.24', status: 'Refinance', accountNumber: '083-123 45678901' }] }],
    assets: [{ assetType: 'Savings', value: '50,000' }],
  },
}

const req = buildRequest(DEAL, { instructions: 'Max borrow, IO, 4% yield.', brokerName: 'Fabio' })
const whole = `${req.subject}\n${req.to}\n${req.body}`

describe('NOTHING THAT NAMES A PERSON GOES OUT', () => {
  it.each([
    ['a surname', 'Chen'],
    ['the other surname', 'Cardey'],
    ['a date of birth', '1980-01-29'],
    ['a phone number', '455783960'],
    ['an email address', 'bizzylittlebean'],
    ['the other email', 'hotmail'],
    ['a street address', 'Kalinga'],
    ['a street number', '13 Kalinga'],
    ['an employer', 'KAKA'],
    ['the other employer', 'Consillum'],
    ['an ABN', '49639194951'],
    ['a card number', '4564'],
    ['a BSB', '083-123'],
  ])('%s', (_what, secret) => {
    expect(whole, `${secret} reached the bot`).not.toContain(secret)
  })

  it('AND THE FIRST NAME DOES, BECAUSE THE SPEC ASKS FOR IT', () => {
    expect(req.subject).toContain('Mai')
    expect(req.body).toContain('FirstName: Mai')
    expect(req.body).toContain('FirstName: Jessie')
  })

  it('and it goes to the bot and nowhere else', () => {
    expect(req.to).toBe(BOT_EMAIL)
  })
})

describe('A SUBURB IS NOT AN ADDRESS', () => {
  it('the suburb and the postcode, out of a full one', () => {
    expect(suburbPostcode('13 Kalinga Road, Ocean Grove VIC 3226, Australia'))
      .toBe('Ocean Grove 3226')
    expect(req.body).toContain('SuburbPostcode: Ocean Grove 3226')
  })

  it('AND NOTHING AT ALL WHERE IT CANNOT BE READ', () => {
    // Half an address is worse than none: a blank key is a thing the bot asks
    // about, a wrong suburb is a thing it silently prices.
    expect(suburbPostcode('somewhere nice')).toBe('')
    expect(suburbPostcode('')).toBe('')
  })

  it('and the state comes with it', () => {
    expect(stateOf('13 Kalinga Road, Ocean Grove VIC 3226')).toBe('VIC')
    expect(req.body).toContain('State: VIC')
  })
})

describe('THE FORMAT IS THE BOT’S, NOT OURS', () => {
  it('the version line it parses on', () => {
    expect(req.body.startsWith('=== SERVICEABILITY REQUEST v1 ===')).toBe(true)
    expect(req.body.trimEnd().endsWith('=== END ===')).toBe(true)
  })

  it('AND A KEY IT CANNOT ANSWER IS BLANK, NEVER MISSING', () => {
    // "Leave values blank if unknown. Never delete a key."
    expect(req.body).toContain('DeclaredLivingExpenses_monthly:')
    expect(req.body).toContain('SelfEmployed_Addbacks_Y1:')
    expect(req.body).toContain('RemainingTermMonths:')
    expect(req.body).toContain('InterestRate:')
  })

  it('and money is digits, with no dollar sign and no commas', () => {
    expect(req.body).toContain('TargetPrice: 1600000')
    expect(req.body).toContain('Limit: 35900')
    expect(req.body).toContain('Balance: 19000')
    expect(req.body).not.toContain('$')
    expect(req.body).not.toContain('1,600,000')
  })

  it('AND INCOME IS ANNUAL, WHATEVER THE FACT FIND RECORDED', () => {
    expect(annual('2307', 'Weekly')).toBe('119964')
    expect(annual('165000', 'Annually')).toBe('165000')
    expect(annual('', 'Weekly')).toBe('')
    expect(req.body).toContain('BaseIncome: 165000')
    expect(req.body).toContain('BaseIncome: 119964')
  })

  it('and a repayment is monthly where the key says _monthly', () => {
    expect(monthly('706', 'Monthly')).toBe('706')
    expect(monthly('163', 'Weekly')).toBe('706')
    expect(req.body).toContain('Repayment_monthly: 706')
  })

  it('AND THE SUBJECT IS THE SHAPE IT PARSES', () => {
    expect(req.subject).toBe(`SERVICEABILITY | ${req.dealRef} | PURCHASE | Mai`)
  })

  it('and the reference is the same every time, so a re-run is a re-run', () => {
    expect(dealRef(DEAL)).toBe(req.dealRef)
    expect(dealRef(DEAL)).toBe(dealRef({ id: DEAL.id }))
    expect(/^SF-\d{5}$/.test(req.dealRef)).toBe(true)
  })
})

describe('AND THE ENUMERATED VALUES ARE ITS OWN WORDS', () => {
  it('employment', () => {
    expect(employmentType('Full time', 'PAYG')).toBe('PAYG_FULLTIME')
    expect(employmentType('Part time', 'PAYG')).toBe('PAYG_PARTTIME')
    expect(employmentType('Casual', 'PAYG')).toBe('PAYG_CASUAL')
    expect(employmentType('anything', 'Self-employed')).toBe('SELF_EMPLOYED')
  })

  it('AND A WORD IT DOES NOT KNOW IS BLANK, NEVER A GUESS', () => {
    // A wrong enum is a wrong calculation that looks like a right one.
    expect(employmentType('seasonal-ish', 'PAYG')).toBe('')
    expect(maritalStatus('complicated')).toBe('')
    expect(liabilityAction('something else')).toBe('')
  })

  it('liabilities', () => {
    expect(liabilityType('Credit card')).toBe('CREDIT_CARD')
    expect(liabilityType('Car loan')).toBe('CAR_LOAN')
    expect(liabilityAction('To be closed')).toBe('CLOSE')
    expect(liabilityAction('Remain open')).toBe('KEEP')
    expect(req.body).toContain('Type: CREDIT_CARD')
    expect(req.body).toContain('Action: CLOSE')
  })

  it('and the scenario comes off the BC template', () => {
    expect(scenarioType('investment_purchase')).toBe('PURCHASE')
    expect(scenarioType('refinance')).toBe('REFINANCE')
    expect(scenarioType('construction')).toBe('CONSTRUCTION')
    expect(scenarioType('')).toBe('')
  })
})

describe('AND IT SAYS WHAT THE BOT WOULD HAVE ASKED FOR', () => {
  it('nothing, on a deal that has it all', () => {
    expect(req.gaps).toEqual([])
  })

  it('AND NAMES THE APPLICANT WHO IS SHORT', () => {
    const thin = buildRequest({
      ...DEAL,
      fact_find_data: { ...DEAL.fact_find_data,
        applicants: [{ firstName: 'Mai', relationshipStatus: 'Married' }] },
    }, {})
    expect(thin.gaps).toContain('an income for Mai')
    expect(thin.gaps).toContain("Mai's employment type")
  })

  it('and a missing scenario is named as the thing to go and set', () => {
    const noScenario = buildRequest({ ...DEAL, bc_data: {} }, {})
    expect(noScenario.gaps.join(' ')).toContain('what kind of deal this is')
  })
})

describe('AND THE FILE SAYS SO IN WORDS, NOT IN CODE', () => {
  it('the privacy rule is written down where somebody will read it', () => {
    const src = readFileSync('lib/serviceability-request.ts', 'utf8')
    expect(src).toContain('PRIVACY IS NOT A SETTING HERE')
  })
})

describe('AND THE SCREEN DOES NOT COMPOSE ANYTHING', () => {
  const UI = readFileSync('components/RunServiceability.tsx', 'utf8')
  const FF = readFileSync('app/(app)/deals/[id]/FactFindForm.tsx', 'utf8')

  it('the request is built in one place', () => {
    expect(UI).toContain('buildRequest(deal, {')
    // A browser that can put words into this email is a browser that can put
    // a surname into it.
    expect(UI).not.toContain('FirstName:')
    expect(UI).not.toContain('=== SERVICEABILITY')
  })

  it('AND IT GOES FROM THE BROKER’S OWN MAIL', () => {
    // The bot returns results to the sender. A server-sent email would come
    // from the portal's address, and the answers would go to nobody.
    expect(UI).toContain('mailto:')
    expect(UI).toContain('COPY_TO')
  })

  it('AND THE CLIPBOARD IS WRITTEN BEFORE ANYTHING SPENDS THE CLICK', () => {
    // The lesson from lib/send-again.ts: a browser only allows a clipboard
    // write while a click is still live, and opening a mailto spends it.
    const at = UI.indexOf('async function send()')
    const block = UI.slice(at, UI.indexOf('return (', at))
    expect(block.indexOf('clipboard.writeText')).toBeGreaterThan(-1)
    expect(block.indexOf('window.location.href')).toBeGreaterThan(block.indexOf('clipboard.writeText'))
  })

  it('and a copy that fails opens nothing', () => {
    expect(UI).toContain('so nothing was opened')
  })

  it('AND THE FILE WRITES ITSELF WHEN THE REQUEST GOES', () => {
    expect(UI).toContain('addSystemNote(deal.id')
    expect(UI).toContain('Serviceability requested')
  })

  it('and it is on the fact find, above the applicant tabs', () => {
    expect(FF).toContain('<RunServiceability deal={deal} me={me} />')
  })

  it('AND A STRAY CLICK DOES NOT THROW THE TYPING AWAY', () => {
    expect(UI).toContain('NO CLICK-AWAY')
  })
})
