import { describe, it, expect } from 'vitest'
import { documentsFor, documentsDue, groupedDocuments, isRefinance, isPurchase } from './document-rules'

// A deal shaped the way the fact find actually stores one.
function deal(over: any = {}) {
  return {
    bc_data: { template: 'oo_purchase' },
    fact_find_data: {
      applicants: [], properties: [], liabilities: [], assets: [],
      depositSource: '',
      ...(over.fact_find_data || {}),
    },
    ...(over.bc_data ? { bc_data: over.bc_data } : {}),
  }
}

function payg(over: any = {}) {
  return {
    id: 'a1', firstName: 'Sarah', lastName: 'Chapman',
    addresses: [{ id: 'ad1', isCurrent: true, address: '12 Smith St', residentialStatus: 'Owner' }],
    employment: [{ id: 'e1', isCurrent: true, employmentType: 'PAYG', employerName: 'Aurecon' }],
    income: [],
    ...over,
  }
}

function selfEmp(structure: string, over: any = {}) {
  return {
    id: 'a2', firstName: 'Michael', lastName: 'Chapman',
    addresses: [{ id: 'ad2', isCurrent: true, address: '12 Smith St', residentialStatus: 'Owner' }],
    employment: [{ id: 'e2', isCurrent: true, employmentType: 'Self-employed', selfEmployedStructure: structure }],
    income: [],
    ...over,
  }
}

const keys = (d: any) => documentsFor(d).items.map(x => x.key)
const labelOf = (d: any, key: string) => documentsFor(d).items.find(x => x.key === key)?.label

describe('what every applicant needs', () => {
  const d = deal({ fact_find_data: { applicants: [payg()] } })

  it('asks for ID, the salary account and super', () => {
    expect(keys(d)).toEqual(expect.arrayContaining(['id:a1', 'salary-account:a1', 'super:a1']))
  })

  it('sends ID to the lender and keeps the two accounts on our file', () => {
    const items = documentsFor(d).items
    expect(items.find(x => x.key === 'id:a1')!.forWhat).toBe('lodge')
    expect(items.find(x => x.key === 'salary-account:a1')!.forWhat).toBe('compliance')
    expect(items.find(x => x.key === 'super:a1')!.forWhat).toBe('compliance')
  })

  it('asks for one expenses account for the household, not one each', () => {
    const two = deal({ fact_find_data: { applicants: [payg(), selfEmp('Sole trader')] } })
    expect(keys(two).filter(k => k === 'expenses-account')).toHaveLength(1)
  })
})

describe('where they live', () => {
  const renting = (id: string, first: string, address: string) => ({
    id, firstName: first, lastName: 'Chapman',
    addresses: [{ id: `ad${id}`, isCurrent: true, address, residentialStatus: 'Renting' }],
    employment: [{ id: `e${id}`, isCurrent: true, employmentType: 'PAYG' }], income: [],
  })

  it('asks renters for a tenancy agreement', () => {
    const d = deal({ fact_find_data: { applicants: [renting('a1', 'Sarah', '9 Rose St')] } })
    expect(keys(d).some(k => k.startsWith('tenancy:'))).toBe(true)
    expect(keys(d).some(k => k.startsWith('rent-free:'))).toBe(false)
  })

  it('asks for the rent free letter when they live with family', () => {
    const d = deal({ fact_find_data: { applicants: [payg({
      addresses: [{ id: 'ad1', isCurrent: true, address: '3 Elm Rd', residentialStatus: 'Living with family' }] })] } })
    expect(keys(d).some(k => k.startsWith('rent-free:'))).toBe(true)
    expect(keys(d).some(k => k.startsWith('tenancy:'))).toBe(false)
  })

  it('asks for neither when they own', () => {
    const d = deal({ fact_find_data: { applicants: [payg()] } })
    expect(keys(d).some(k => k.startsWith('tenancy:'))).toBe(false)
    expect(keys(d).some(k => k.startsWith('rent-free:'))).toBe(false)
  })

  // A couple in one flat have ONE tenancy agreement. Asking twice for the same
  // piece of paper is how a list stops being believed.
  it('asks once for a couple renting the same place, and names both', () => {
    const d = deal({ fact_find_data: { applicants: [
      renting('a1', 'Sarah', '9 Rose St, Brunswick'),
      renting('a2', 'Michael', '9 Rose St, Brunswick')] } })
    const tenancies = documentsFor(d).items.filter(x => x.key.startsWith('tenancy:'))
    expect(tenancies).toHaveLength(1)
    expect(tenancies[0].why).toContain('Sarah Chapman and Michael Chapman')
  })

  it('is not fooled by the address being typed differently', () => {
    const d = deal({ fact_find_data: { applicants: [
      renting('a1', 'Sarah', '9 Rose St, Brunswick'),
      renting('a2', 'Michael', '9 rose st brunswick.')] } })
    expect(documentsFor(d).items.filter(x => x.key.startsWith('tenancy:'))).toHaveLength(1)
  })

  it('asks twice when they rent separately', () => {
    const d = deal({ fact_find_data: { applicants: [
      renting('a1', 'Sarah', '9 Rose St'),
      renting('a2', 'Michael', '41 Lygon St')] } })
    expect(documentsFor(d).items.filter(x => x.key.startsWith('tenancy:'))).toHaveLength(2)
  })

  it('does not merge a renter with somebody living at home', () => {
    const d = deal({ fact_find_data: { applicants: [
      renting('a1', 'Sarah', '9 Rose St'),
      payg({ id: 'a2', firstName: 'Michael',
        addresses: [{ id: 'ad2', isCurrent: true, address: '9 Rose St', residentialStatus: 'Living with family' }] })] } })
    expect(documentsFor(d).items.filter(x => x.key.startsWith('tenancy:'))).toHaveLength(1)
    expect(documentsFor(d).items.filter(x => x.key.startsWith('rent-free:'))).toHaveLength(1)
  })
})

describe('PAYG', () => {
  it('asks for payslips and the income statement', () => {
    const d = deal({ fact_find_data: { applicants: [payg()] } })
    expect(keys(d)).toEqual(expect.arrayContaining(['payslips:a1', 'income-statement:a1']))
  })

  it('only asks for a bonus payslip when a bonus was recorded', () => {
    const without = deal({ fact_find_data: { applicants: [payg()] } })
    expect(keys(without)).not.toContain('bonus-payslip:a1')

    const withBonus = deal({ fact_find_data: { applicants: [payg({
      income: [{ id: 'i1', incomeType: 'PAYG', bonusAmount: '12,000' }] })] } })
    expect(keys(withBonus)).toContain('bonus-payslip:a1')
  })

  it('ignores a bonus field left at zero', () => {
    const d = deal({ fact_find_data: { applicants: [payg({
      income: [{ id: 'i1', incomeType: 'PAYG', bonusAmount: '0' }] })] } })
    expect(keys(d)).not.toContain('bonus-payslip:a1')
  })
})

describe('self-employed — the split that decides five documents', () => {
  it('asks a sole trader for personal returns and notices of assessment, and nothing company', () => {
    const d = deal({ fact_find_data: { applicants: [selfEmp('Sole trader')] } })
    expect(keys(d)).toEqual(expect.arrayContaining(['personal-tax:a2', 'noa:a2']))
    expect(keys(d)).not.toContain('company-tax:a2')
    expect(keys(d)).not.toContain('company-financials:a2')
    expect(keys(d)).not.toContain('bas:a2')
  })

  it('asks a company for the full set', () => {
    const d = deal({ fact_find_data: { applicants: [selfEmp('Company')] } })
    expect(keys(d)).toEqual(expect.arrayContaining([
      'personal-tax:a2', 'company-tax:a2', 'company-financials:a2', 'bas:a2']))
    expect(keys(d)).not.toContain('noa:a2')
  })

  it('treats partnerships and trusts like a company', () => {
    for (const s of ['Partnership', 'Trust']) {
      const d = deal({ fact_find_data: { applicants: [selfEmp(s)] } })
      expect(keys(d)).toContain('company-financials:a2')
    }
  })

  it('leaves BAS sitting there unticked', () => {
    const d = deal({ fact_find_data: { applicants: [selfEmp('Company')] } })
    expect(documentsFor(d).items.find(x => x.key === 'bas:a2')!.auto).toBe(false)
  })

  // THE ONE THAT MATTERS MOST. Guessing here asks a client for the wrong
  // paperwork, and neither answer is safe.
  it('refuses to guess when nobody has said which, and says who it needs an answer about', () => {
    const d = deal({ fact_find_data: { applicants: [selfEmp('')] } })
    const { items, gaps } = documentsFor(d)
    const ks = items.map(x => x.key)
    expect(ks).toContain('personal-tax:a2')       // needed either way
    expect(ks).not.toContain('noa:a2')
    expect(ks).not.toContain('company-tax:a2')
    expect(gaps.map(g => g.key)).toContain('structure:a2')
    expect(gaps.find(g => g.key === 'structure:a2')!.message).toContain('Michael Chapman')
  })

  it('asks nothing of somebody not working', () => {
    const d = deal({ fact_find_data: { applicants: [payg({
      employment: [{ id: 'e1', isCurrent: true, employmentType: 'Not working' }] })] } })
    const ks = keys(d)
    expect(ks).not.toContain('payslips:a1')
    expect(ks).not.toContain('personal-tax:a1')
    expect(ks).toContain('id:a1')   // still a person
  })

  it('handles a couple where one is PAYG and one runs a company', () => {
    const d = deal({ fact_find_data: { applicants: [payg(), selfEmp('Company')] } })
    const ks = keys(d)
    expect(ks).toEqual(expect.arrayContaining(['payslips:a1', 'company-financials:a2']))
    expect(ks).not.toContain('payslips:a2')
    expect(ks).not.toContain('company-financials:a1')
  })
})

describe('properties', () => {
  it('asks for a rates notice on any property held, whatever it is used for', () => {
    for (const use of ['Owner occupied', 'Investment']) {
      const d = deal({ fact_find_data: { properties: [{ id: 'p1', address: '14 Collins St', ownershipType: use }] } })
      expect(keys(d)).toContain('rates:p1')
    }
  })

  it('never lodges a rates notice', () => {
    const d = deal({ fact_find_data: { properties: [{ id: 'p1', ownershipType: 'Investment' }] } })
    expect(documentsFor(d).items.find(x => x.key === 'rates:p1')!.forWhat).toBe('compliance')
  })

  it('asks for a rental statement only on an investment, and lodges it', () => {
    const inv = deal({ fact_find_data: { properties: [{ id: 'p1', ownershipType: 'Investment' }] } })
    expect(documentsFor(inv).items.find(x => x.key === 'rental-statement:p1')!.forWhat).toBe('lodge')

    const oo = deal({ fact_find_data: { properties: [{ id: 'p1', ownershipType: 'Owner occupied' }] } })
    expect(keys(oo)).not.toContain('rental-statement:p1')
  })

  it('asks once per property, not once per deal', () => {
    const d = deal({ fact_find_data: { properties: [
      { id: 'p1', ownershipType: 'Investment' }, { id: 'p2', ownershipType: 'Owner occupied' }] } })
    expect(keys(d).filter(k => k.startsWith('rates:'))).toHaveLength(2)
  })
})

describe('debts', () => {
  const d = deal({ fact_find_data: {
    liabilities: [
      { id: 'l1', liabilityType: 'Credit card', lenderName: 'NAB' },
      { id: 'l2', liabilityType: 'Car loan', lenderName: 'Macquarie' },
      { id: 'l3', liabilityType: 'HECS' },
      { id: 'l4', liabilityType: 'Health Insurance' },
      { id: 'l5', liabilityType: 'Personal loan', lenderName: 'Latitude' },
    ],
    properties: [{ id: 'p1', ownershipType: 'Owner occupied',
      loans: [{ id: 'ln1', lenderName: 'CBA' }] }],
  } })

  it('names the bank on the row', () => {
    expect(labelOf(d, 'cc-statement:l1')).toBe('Credit card statement — NAB')
    expect(labelOf(d, 'home-loan-statement:ln1')).toBe('Home loan statement — CBA')
  })

  it('records which bank would cover it, for the statement matching', () => {
    const items = documentsFor(d).items
    expect(items.find(x => x.key === 'cc-statement:l1')!.coveredByBank).toBe('NAB')
    expect(items.find(x => x.key === 'home-loan-statement:ln1')!.coveredByBank).toBe('CBA')
  })

  it('lodges the home loan statement and keeps the rest on file', () => {
    const items = documentsFor(d).items
    expect(items.find(x => x.key === 'home-loan-statement:ln1')!.forWhat).toBe('lodge')
    for (const k of ['cc-statement:l1', 'car-statement:l2', 'hecs:l3', 'personal-statement:l5']) {
      expect(items.find(x => x.key === k)!.forWhat).toBe('compliance')
    }
  })

  it('asks for nothing against health insurance', () => {
    expect(keys(d).some(k => k.endsWith(':l4'))).toBe(false)
  })

  it('copes with a bank nobody typed', () => {
    const nameless = deal({ fact_find_data: { liabilities: [{ id: 'l1', liabilityType: 'Credit card' }] } })
    expect(labelOf(nameless, 'cc-statement:l1')).toBe('Credit card statement')
    expect(documentsFor(nameless).items[0].coveredByBank).toBeUndefined()
  })
})

describe('the discharge, on a refinance', () => {
  const refi = deal({ bc_data: { template: 'refinance_only' } })

  it('appears on a refinance and asks before joining the list', () => {
    const item = documentsFor(refi).items.find(x => x.key === 'discharge')!
    expect(item.askFirst).toBe(true)
    expect(item.auto).toBe(false)
    expect(item.why).toContain('formally approved')
  })

  it('does not appear on a purchase', () => {
    expect(keys(deal())).not.toContain('discharge')
  })

  it('spots a refinance from a loan marked to be refinanced, not just the scenario', () => {
    const d = deal({ bc_data: { template: 'custom' }, fact_find_data: {
      properties: [{ id: 'p1', loans: [{ id: 'ln1', status: 'To be refinanced' }] }] } })
    expect(isRefinance(d)).toBe(true)
    expect(keys(d)).toContain('discharge')
  })
})

describe('the rows that turn up later', () => {
  it('keeps the contract and insurance out of the first round', () => {
    const d = deal()
    const now = documentsDue(d, 'proceed').items.map(x => x.key)
    expect(now).not.toContain('contract-of-sale')
    expect(now).not.toContain('insurance')

    const later = documentsDue(d, 'offer_accepted').items.map(x => x.key)
    expect(later).toEqual(expect.arrayContaining(['contract-of-sale', 'insurance']))
  })

  it('skips insurance on strata', () => {
    const unit = deal({ bc_data: { template: 'oo_purchase', purchasePropertySubtype: 'Unit' } })
    expect(keys(unit)).not.toContain('insurance')

    const house = deal({ bc_data: { template: 'oo_purchase', purchasePropertySubtype: 'House' } })
    expect(keys(house)).toContain('insurance')
  })

  it('asks for insurance and says why when nobody recorded the property type', () => {
    const d = deal()
    expect(keys(d)).toContain('insurance')
    expect(documentsFor(d).gaps.map(g => g.key)).toContain('purchase-property-type')
  })

  it('does not chase a contract of sale on a refinance', () => {
    const refi = deal({ bc_data: { template: 'refinance_only' } })
    expect(isPurchase(refi)).toBe(false)
    expect(keys(refi)).not.toContain('contract-of-sale')
  })
})

describe('SMSF', () => {
  const smsf = deal({ bc_data: { template: 'smsf' } })

  it('asks for the trust deed up front and the bare trust deed once there is a property', () => {
    expect(documentsDue(smsf, 'proceed').items.map(x => x.key)).toContain('smsf-deed')
    expect(documentsDue(smsf, 'offer_accepted').items.map(x => x.key)).toContain('bare-trust-deed')
  })

  it('leaves the SMSF tax returns unticked, since the fund may be new', () => {
    expect(documentsFor(smsf).items.find(x => x.key === 'smsf-tax')!.auto).toBe(false)
  })
})

describe('the gift letter', () => {
  it('appears only when the deposit is a gift', () => {
    const plain = deal({ fact_find_data: { applicants: [payg()], depositSource: 'Savings' } })
    expect(keys(plain)).not.toContain('gift-letter')

    const gifted = deal({ fact_find_data: { applicants: [payg()], depositSource: 'Gift' } })
    expect(keys(gifted)).toContain('gift-letter')
  })

  // One deposit, one letter. Per applicant it asked a couple for two letters
  // about one gift.
  it('asks once, however many applicants there are', () => {
    const d = deal({ fact_find_data: {
      applicants: [payg(), selfEmp('Company')], depositSource: 'Gift' } })
    expect(keys(d).filter(k => k === 'gift-letter')).toHaveLength(1)
  })
})

describe('grouping and keys', () => {
  const d = deal({ fact_find_data: {
    applicants: [payg(), selfEmp('Company')],
    properties: [{ id: 'p1', address: '14 Collins St', ownershipType: 'Investment' }],
    liabilities: [{ id: 'l1', liabilityType: 'Credit card', lenderName: 'NAB' }],
  } })

  it('reads people first, then properties, then debts, then the deal', () => {
    const g = groupedDocuments(documentsFor(d).items).map(x => x.label)
    expect(g[0]).toBe('Sarah Chapman')
    expect(g[1]).toBe('Michael Chapman')
    expect(g[2]).toBe('14 Collins St')
    expect(g[3]).toBe('Debts')
    expect(g[4]).toBe('This deal')
  })

  it('never repeats a key — ticks would collide', () => {
    const ks = documentsFor(d).items.map(x => x.key)
    expect(new Set(ks).size).toBe(ks.length)
  })

  it('keys survive a person being renamed', () => {
    const before = keys(d)
    const renamed = JSON.parse(JSON.stringify(d))
    renamed.fact_find_data.applicants[0].firstName = 'Sarah-Jane'
    expect(keys(renamed)).toEqual(before)
  })
})

describe('an empty or broken deal never throws', () => {
  it('copes with nothing at all', () => {
    for (const d of [{}, null, undefined, { fact_find_data: null }, { fact_find_data: {} }]) {
      expect(() => documentsFor(d)).not.toThrow()
    }
  })

  it('still asks for the household expenses account on an empty deal', () => {
    expect(documentsFor({}).items.map(x => x.key)).toContain('expenses-account')
  })
})

// HOUSE OR STRATA, ON THE PROPERTY BEING BOUGHT.
//
// The fact find has asked this about properties a client already owns since the
// beginning; nothing asked it about the one being purchased, so the BC now does.
// Fabio, 3 Sep 2026, on the two edge cases: land needs "nothing at all, ever",
// and commercial gets the certificate of currency the same as a house.
describe('insurance on the property being bought', () => {
  const buying = (purchasePropertySubtype: string) => documentsFor({
    bc_data: { template: 'oo_purchase', purchasePrice: '850,000', purchasePropertySubtype },
    fact_find_data: { applicants: [{ firstName: 'A', lastName: 'B' }] },
  })
  const asks = (sub: string) => buying(sub).items.some((i: any) => i.key === 'insurance')
  const why = (sub: string) => buying(sub).items.find((i: any) => i.key === 'insurance')?.why || ''

  it('asks for it on a house', () => {
    expect(asks('House')).toBe(true)
  })

  // The body corporate insures the building.
  it('does not ask on strata', () => {
    expect(asks('Unit')).toBe(false)
    expect(asks('Townhouse')).toBe(false)
  })

  // Nothing built yet.
  it('never asks on land', () => {
    expect(asks('Land')).toBe(false)
  })

  it('asks on commercial and rural', () => {
    expect(asks('Commercial')).toBe(true)
    expect(asks('Rural')).toBe(true)
  })

  // The first version listed the one type that qualified, so a commercial
  // purchase silently asked for nothing - which reads exactly like a deal that
  // needs no insurance rather than a rule nobody had written yet.
  it('asks for anything not on the list, rather than going quiet', () => {
    expect(asks('Warehouse')).toBe(true)
    expect(why('Warehouse')).toContain('recorded as Warehouse')
  })

  it('says why in words a client can read', () => {
    expect(why('Commercial')).toBe('The property being bought is a commercial property')
    expect(why('House')).toContain('not strata')
    // "is a commercial, not strata" and "is an other" are not English, and this
    // ends up on a document request somebody outside the business reads.
    for (const sub of ['House', 'Commercial', 'Rural', 'Other', 'Warehouse']) {
      expect(why(sub)).not.toMatch(/is an? (commercial|rural|other)\b(?! property)/i)
    }
  })

  it('still asks, and still says why, when nobody has answered', () => {
    const d = buying('')
    expect(d.items.some((i: any) => i.key === 'insurance')).toBe(true)
    expect(d.gaps.some((g: any) => g.key === 'purchase-property-type')).toBe(true)
  })

  // Answered, the question stops being asked.
  it('drops the gap once the question is answered', () => {
    for (const sub of ['House', 'Unit', 'Land', 'Commercial']) {
      expect(buying(sub).gaps.some((g: any) => g.key === 'purchase-property-type')).toBe(false)
    }
  })
})
