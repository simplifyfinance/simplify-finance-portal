import { describe, it, expect } from 'vitest'
import { dealFacts, factsBlock, purposeLines, dealPurpose } from './deal-facts'

const chapman = () => ({
  bc_data: {
    template: 'investment_equity',
    purchasePrice: '850,000', deposit: '170,000', depositSource: 'Savings', stampDuty: '45,000',
    propertyType: 'Owner-occupied',
    splits: [
      { id: 'a', label: 'Existing loan refinanced', amount: '520,000', rate: '6.14', repaymentType: 'P&I', purpose: 'OO' },
      { id: 'b', label: 'Equity access', amount: '180,000', rate: '6.14', repaymentType: 'P&I', purpose: 'INV' },
      { id: 'c', label: 'New purchase', amount: '650,000', rate: '6.39', repaymentType: 'P&I', purpose: 'INV' },
    ],
    brokerNotes: 'Client wants offset on the OO split only.',
  },
  lo_data: { loanAmount: '1,350,000', recommendedLender: 'Macquarie', lenders: [] },
  fact_find_data: {
    dependants: '2',
    loanPurpose: 'Refinance the home loan and release equity to buy an investment unit.',
    goals2Years: 'Buy the investment property.',
    applicants: [{
      id: 'a1', firstName: 'Sarah', lastName: 'Chapman', dob: '1988-04-12',
      residencyStatus: 'Australian citizen',
      addresses: [{ isCurrent: true, address: '12 Smith St', residentialStatus: 'Owner' }],
      employment: [{ isCurrent: true, employmentType: 'PAYG', employmentBasis: 'Full time',
        occupation: 'Engineer', employerName: 'Aurecon', startDate: '2019-02-01' }],
      income: [{
        grossSalary: '145,000', grossSalaryFrequency: 'Annually',
        bonusAmount: '15,000', bonusFrequency: 'Annually',
        overtimeEssentialAmount: '4,000', overtimeEssentialFrequency: 'Annually',
      }],
    }],
    liabilities: [
      { liabilityType: 'Credit card', lenderName: 'NAB', limitAmount: '15,000', balance: '3,200', status: 'To be closed' },
      { liabilityType: 'Car loan', lenderName: 'Macquarie', balance: '22,000', repaymentAmount: '650', repaymentFrequency: 'Monthly', status: 'Remain open' },
    ],
    properties: [{
      address: '14 Collins St, Brunswick', ownershipType: 'Investment', propertySubtype: 'Unit',
      value: '620,000', rentalIncome: '540', rentalIncomeFrequency: 'Weekly',
      loans: [{ lenderName: 'CBA', balance: '380,000', repaymentType: 'Interest only', status: 'To be refinanced' }],
    }],
    assets: [{ assetType: 'Super', description: 'Australian Super', value: '210,000' }],
  },
  compliance_data: { expenses: { Groceries: { monthlyAmount: '1,200' }, Utilities: { monthlyAmount: '400' } } },
})

const all = (d: any) => factsBlock(dealFacts(d))

describe('the purpose — the complaint that started this', () => {
  it('says the scenario in words, not the database key', () => {
    const lines = purposeLines(chapman())
    expect(lines.join('\n')).toContain('Equity release + purchase')
    expect(lines.join('\n')).not.toContain('investment_equity')
  })

  // THE ONE THAT MATTERS. A three-part loan used to arrive as one number.
  it('keeps every split and its label, so a mixed purpose is visible', () => {
    const out = purposeLines(chapman()).join('\n')
    expect(out).toContain('3 parts')
    expect(out).toContain('Existing loan refinanced, $520,000')
    expect(out).toContain('Equity access, $180,000')
    expect(out).toContain('New purchase, $650,000')
  })

  it('carries what the client actually said', () => {
    expect(purposeLines(chapman()).join('\n'))
      .toContain('release equity to buy an investment unit')
  })

  it('does not make a fuss about a single split', () => {
    const one = chapman()
    one.bc_data.splits = [{ id: 'x', label: 'Owner-occupied loan', amount: '680,000', rate: '6.14', repaymentType: 'P&I', purpose: 'OO' }]
    const out = purposeLines(one).join('\n')
    expect(out).toContain('Owner-occupied loan, $680,000, Owner occupied')
    expect(out).not.toContain('parts')
  })

  // The number nothing in the portal could state before: how much of the
  // lending is for what.
  it('adds the splits up by purpose and says the deal is both', () => {
    const out = purposeLines(chapman()).join('\n')
    expect(out).toContain('Owner occupied $520,000, investment $830,000')
    expect(out).toContain('this deal is BOTH')
  })

  // Fabio, 3 Sep 2026: "I do not want to invent things ever."
  it('says out loud when a split has no purpose recorded', () => {
    const d = chapman()
    delete (d.bc_data.splits[1] as any).purpose
    const out = purposeLines(d).join('\n')
    expect(out).toContain('PURPOSE NOT RECORDED')
    expect(out).toContain('$180,000 of the lending has no purpose recorded')
  })
})

describe('income, by type', () => {
  it('lists salary, bonus and overtime separately rather than as one total', () => {
    const out = all(chapman())
    expect(out).toContain('Gross salary: $145,000 annually')
    expect(out).toContain('Bonus: $15,000 annually')
    expect(out).toContain('Overtime (essential): $4,000 annually')
    // The old behaviour: one flattened number. It must not be the only thing.
    expect(out).not.toContain('Income: $164,000')
  })

  it('keeps essential and non-essential overtime apart', () => {
    const d = chapman()
    d.fact_find_data.applicants[0].income[0].overtimeNonEssentialAmount = '2,000'
    d.fact_find_data.applicants[0].income[0].overtimeNonEssentialFrequency = 'Annually'
    const out = all(d)
    expect(out).toContain('Overtime (essential): $4,000')
    expect(out).toContain('Overtime (non-essential): $2,000')
  })

  it('says nothing at all about a bonus nobody recorded', () => {
    const d = chapman()
    delete (d.fact_find_data.applicants[0].income[0] as any).bonusAmount
    expect(all(d)).not.toContain('Bonus')
  })
})

describe('the applicant', () => {
  it('gives the age, residency, and how long in the job', () => {
    const out = all(chapman())
    expect(out).toMatch(/Age 3[0-9]/)
    expect(out).toContain('Residency: Australian citizen')
    expect(out).toContain('at Aurecon')
    expect(out).toMatch(/for \d+ years/)
  })

  it('shouts about probation, because it changes the assessment', () => {
    const d = chapman()
    ;(d.fact_find_data.applicants[0].employment[0] as any).onProbation = true
    expect(all(d)).toContain('ON PROBATION')
  })

  it('names a missing date of birth rather than leaving a hole', () => {
    const d = chapman(); d.fact_find_data.applicants[0].dob = ''
    expect(dealFacts(d).missing.join(' ')).toContain("Sarah Chapman's date of birth")
  })
})

describe('liabilities, one by one', () => {
  it('lists each with its lender, limit, balance and what happens to it', () => {
    const out = all(chapman())
    expect(out).toContain('Credit card, with NAB, limit $15,000, balance $3,200 — to be closed')
    expect(out).toContain('Car loan, with Macquarie, balance $22,000, repayment $650 monthly — remain open')
  })

  it('says plainly when there are none, rather than staying silent', () => {
    const d = chapman(); d.fact_find_data.liabilities = []
    expect(all(d)).toContain('None recorded on the fact find.')
  })
})

describe('properties and their loans', () => {
  it('gives the use, the value, the rent and the loan being refinanced', () => {
    const out = all(chapman())
    expect(out).toContain('14 Collins St, Brunswick, unit, investment, valued $620,000, rent $540 weekly')
    expect(out).toContain('Loan, with CBA, balance $380,000, Interest only — to be refinanced')
  })
})

describe('funds to complete', () => {
  // A plain purchase: no refinance anywhere, so the simple sum holds.
  const plain = () => {
    const d = chapman()
    d.fact_find_data.properties = []
    return d
  }

  it('shows the working and the answer', () => {
    const out = all(plain())
    expect(out).toContain('FUNDS TO COMPLETE')
    expect(out).toContain('+ Purchase price: $850,000')
    expect(out).toContain('+ Stamp duty: $45,000')
    expect(out).toContain('− Deposit: $170,000')
    expect(out).toContain('= Funds to complete')
  })

  // No completion to fund, so no section at all.
  it('says nothing on a refinance', () => {
    const d = plain()
    d.bc_data.purchasePrice = ''
    expect(all(d)).not.toContain('FUNDS TO COMPLETE')
  })

  // The Chapman deal refinances a property AND buys one. The splits carry no
  // role yet, so there is no total — but the section still appears, saying what
  // it needs.
  it('asks what each split does before totalling a mixed deal', () => {
    const out = all(chapman())
    expect(out).toContain('both refinances and buys')
    expect(out).not.toMatch(/= Funds to complete: \$/)
  })

  // Answered, the real number appears: 850,000 + 45,000 − 170,000 − 650,000.
  it('totals a mixed deal once every split has been answered', () => {
    const d = chapman()
    d.bc_data.splits[0].funds = 'payout'
    d.bc_data.splits[1].funds = 'equity'
    d.bc_data.splits[2].funds = 'purchase'
    expect(all(d)).toContain('= Funds to complete: $75,000')
  })
})

// THE HEART OF IT. Fabio, 3 Sep 2026: "I do not want to invent things ever
// rather less words that are meaningful than fluff."
describe('what it refuses to do', () => {
  it('names every hole out loud, at the end, under its own heading', () => {
    const d = chapman()
    d.fact_find_data.dependants = ''
    d.fact_find_data.properties = []      // a plain purchase, so funds applies
    d.bc_data.stampDuty = ''
    const out = all(d)
    expect(out).toContain('NOT RECORDED')
    expect(out).toContain('Do not estimate, assume, or write around them')
    expect(out).toContain('The number of dependants is not recorded')
    expect(out).toContain('Stamp duty has not been recorded')
  })

  it('says nobody has answered sole trader or company', () => {
    const d = chapman()
    ;(d.fact_find_data.applicants[0].employment[0] as any).employmentType = 'Self-employed'
    expect(dealFacts(d).missing.join(' ')).toContain('sole trader or a company')
  })

  it('refuses to produce an LVR it cannot work out', () => {
    const d = chapman()
    d.bc_data.purchasePrice = ''
    ;(d.bc_data as any).splits = []
    ;(d.lo_data as any).loanAmount = ''
    expect(all(d)).not.toContain('LVR:')
    expect(dealFacts(d).missing.join(' ')).toContain('LVR cannot be worked out')
  })

  it('adds no NOT RECORDED heading when nothing is missing', () => {
    // Contrived, but the block must not always end in a wall of apologies.
    const facts = { sections: [{ title: 'X', lines: ['y'] }], missing: [] }
    expect(factsBlock(facts)).toBe('X\ny')
  })

  it('never throws on an empty or broken deal', () => {
    for (const d of [{}, null, undefined, { fact_find_data: null }, { bc_data: 'nonsense' }]) {
      expect(() => all(d)).not.toThrow()
    }
  })

  it('says the fact find is empty rather than writing about nobody', () => {
    expect(dealFacts({}).missing.join(' ')).toContain('No applicants are recorded')
  })
})

describe('the broker’s own words are kept, not paraphrased', () => {
  it('passes the notes through', () => {
    expect(all(chapman())).toContain('Client wants offset on the OO split only.')
  })
})

describe('owner occupied, investment, or both', () => {

  // THE HOLE THE AUDIT FOUND. Decided everywhere by whether the scenario NAME
  // contained "investment", so this deal was filed Owner occupied outright.
  it('sees both when the splits say both', () => {
    const p = dealPurpose(chapman())
    expect(p.ownerOccupied).toBe(true)
    expect(p.investment).toBe(true)
    expect(p.label).toBe('Both')
  })

  it('says so in the facts, in words the model cannot miss', () => {
    expect(all(chapman())).toContain('this deal is BOTH')
  })

  it('picks investment as the single answer when a screen can only hold one', () => {
    expect(dealPurpose(chapman()).binary).toBe('Investment')
  })

  it('reads a plain owner-occupied purchase correctly', () => {
    const d = chapman()
    d.bc_data.propertyType = 'Owner-occupied'
    d.bc_data.template = 'oo_purchase'
    d.bc_data.splits = [{ label: 'Owner-occupied loan', amount: '680,000', rate: '6.14', type: 'P&I' }]
    d.fact_find_data.properties = []
    const p = dealPurpose(d)
    expect(p.label).toBe('Owner occupied')
    expect(p.investment).toBe(false)
  })

  it('reads a plain investment purchase correctly', () => {
    const d = chapman()
    d.bc_data.propertyType = 'Investment'
    d.bc_data.template = 'investment_purchase'
    d.bc_data.splits = [{ label: 'Investment loan', amount: '680,000', rate: '6.39', type: 'P&I' }]
    d.fact_find_data.properties = []
    expect(dealPurpose(d).label).toBe('Investment')
  })

  // The property being refinanced is investment; the scenario name says nothing
  // about investment. The old test would have said Owner occupied.
  it('notices an investment property being refinanced even when the name does not', () => {
    const d = chapman()
    d.bc_data.template = 'refinance_only'
    d.bc_data.splits = [{ label: 'Refinanced loan', amount: '380,000', rate: '6.14', type: 'P&I' }]
    delete (d.bc_data as any).propertyType
    delete (d.bc_data as any).purchasePrice
    expect(dealPurpose(d).investment).toBe(true)
  })

  it('falls back to the scenario name only when the deal itself says nothing', () => {
    expect(dealPurpose({ bc_data: { template: 'investment_purchase' } }).label).toBe('Investment')
    expect(dealPurpose({ bc_data: { template: 'oo_purchase' } }).label).toBe('Owner occupied')
  })


  // Honest, not clever. The splits are generically named and nothing records
  // what the purchase is for, so there is no owner-occupied evidence to find.
  it('does not invent an owner-occupied half it cannot see', () => {
    const d = chapman()
    delete (d.bc_data as any).propertyType
    const p = dealPurpose(d)
    expect(p.investment).toBe(true)
    expect(p.ownerOccupied).toBe(false)
    expect(p.label).toBe('Investment')
  })

  it('says nothing at all about an empty deal', () => {
    expect(dealPurpose({}).label).toBe('')
  })
})

describe('the broker’s own summary', () => {
  it('comes first, so it frames everything under it', () => {
    const out = all(chapman())
    expect(out.indexOf('OWN WORDS')).toBeLessThan(out.indexOf('THE LOAN'))
  })

  it('is passed word for word', () => {
    expect(all(chapman())).toContain('Buy the investment property.')
  })

  it('says so when nobody has written one', () => {
    const d = chapman()
    d.fact_find_data.goals2Years = ''
    d.bc_data.brokerNotes = ''
    ;(d.lo_data as any).recommendationNote = ''
    expect(dealFacts(d).missing.join(' ')).toContain('goals boxes on the fact find')
  })
})
