import { describe, it, expect } from 'vitest'
import { liabilityLine, assetBreakdown } from './box-power'
import { boxFour } from './box-four'

// THE NOTES SAY WHAT IS TRUE, AND SAY IT ONCE.
//
// 19 Nov 2026. Fabio sent two real compliance notes beside Katie's corrections
// of them - the Makeham land purchase and the Makeham refinance. Every change
// she made by hand was the portal getting something wrong, and this holds the
// ones that were facts rather than taste.
//
// Fabio: "everything that is repetitive to be excluded and become a rule
// within the portal."

const deal = (over: any = {}) => ({
  id: 'd1',
  property_use: 'investment',
  bc_data: {
    template: 'investment_purchase',
    propertyType: 'Land',
    suburb: 'Oura',
    purchasePrice: '200000',
    loanTerm: '30',
    splits: [{ amount: '160000', termYears: '30' }],
    ...(over.bc_data || {}),
  },
  fact_find_data: over.fact_find_data || {},
  compliance_data: over.compliance_data || {},
  ...over,
})

describe('a purchase says what is being bought, and what for', () => {
  it('vacant land for investment is not an owner-occupied property', () => {
    const t = boxFour(deal()).text
    expect(t, 'the five words that were typed in and never read anything')
      .not.toContain('owner-occupied property')
    expect(t).toContain('to purchase vacant land in Oura for investment purposes')
  })

  it('a house to live in still reads as owner-occupied', () => {
    const t = boxFour(deal({
      property_use: 'owner_occupied',
      bc_data: { template: 'oo_purchase', propertyType: 'House', suburb: 'Oura',
                 purchasePrice: '200000', loanTerm: '30', splits: [{ amount: '160000' }] },
    })).text
    expect(t).toContain('to purchase an owner-occupied house in Oura')
    expect(t).not.toContain('for investment purposes')
  })

  it('and a deal with no property type recorded says property, not a guess', () => {
    const t = boxFour(deal({
      bc_data: { template: 'investment_purchase', suburb: 'Oura',
                 purchasePrice: '200000', loanTerm: '30', splits: [{ amount: '160000' }] },
    })).text
    expect(t).toContain('to purchase a property in Oura for investment purposes')
  })
})

describe('what this loan pays out, and what it does not', () => {
  const card = { id: 'c', liabilityType: 'Credit card', lenderName: 'CBA', balance: '4,200' }
  const car = { id: 'v', liabilityType: 'Car loan', lenderName: 'Toyota Finance', balance: '47,341.12' }

  it('a consolidated debt is cleared by this loan, and says why', () => {
    const t = liabilityLine({ fact_find_data: { liabilities: [{ ...car, status: 'To be consolidated' }] } })
    expect(t).toContain('being cleared as part of this loan to meet lender servicing requirements')
  })

  it('a closed debt is the clients’ own doing', () => {
    const t = liabilityLine({ fact_find_data: { liabilities: [{ ...card, status: 'To be closed' }] } })
    expect(t).toContain('will be closed by the clients by their own means before formal approval')
    expect(t, 'this loan does not touch it').not.toMatch(/being cleared/)
  })

  it('and a file with both tells them apart', () => {
    const t = liabilityLine({ fact_find_data: { liabilities: [
      { ...card, status: 'To be closed' },
      { ...car, status: 'To be consolidated' },
    ] } })
    // Written out rather than matched with [^.]*, because a balance has a
    // decimal point in it and the regex stopped at the cents.
    expect(t).toContain('A car loan with Toyota Finance of $47,341.12 is being cleared '
      + 'as part of this loan to meet lender servicing requirements.')
    expect(t).toContain('A credit card with CBA of $4,200 will be closed by the clients '
      + 'by their own means before formal approval.')
  })
})

// $120,000 THAT WAS IN THE TOTAL AND IN NONE OF THE WORDS.
//
// "Recorded assets total $336,738.82 — $38,627.21 in bank accounts and
// $178,111.61 in superannuation." That is $216,738. Home contents and vehicles
// were counted and never named, and nobody caught it - not the broker, not
// credit, not Katie.
describe('the assets add up to what the sentence says', () => {
  const assets = [
    { assetType: 'Super', value: '178111.61' },
    { assetType: 'Home contents', value: '100000' },
    { assetType: 'Savings', value: '38627.21' },
    { assetType: 'Vehicle', value: '20000' },
  ]

  it('every kind is named, biggest first', () => {
    const { total, named } = assetBreakdown({ fact_find_data: { assets } })
    expect(total).toBeCloseTo(336_738.82, 2)
    expect(named).toHaveLength(4)
    expect(named[0]).toContain('superannuation')
  })

  it('and the total is the sum of exactly those words', () => {
    const { total, named } = assetBreakdown({ fact_find_data: { assets } })
    const summed = named
      .map(n => Number(n.replace(/^\$/, '').split(' ')[0].replace(/,/g, '')))
      .reduce((a, b) => a + b, 0)
    expect(summed).toBeCloseTo(total, 2)
  })

  it('the compliance note prints the same breakdown', () => {
    const t = boxFour(deal({ fact_find_data: { assets } })).text
    expect(t).toContain('$100,000 in home contents')
    expect(t).toContain('$20,000 in vehicles')
  })
})

describe('the small things Katie crossed out', () => {
  const ff = {
    dependants: '2',
    applicants: [{
      firstName: 'Dale', lastName: 'Makeham',
      employment: [{ isCurrent: true, occupation: 'Carpenter', employmentType: 'Self-Employed',
                     employmentBasis: 'Self-Employed', startDate: '2018-07-01' }],
    }],
  }

  it('self-employed is not said twice', () => {
    const t = boxFour(deal({ fact_find_data: ff })).text
    expect(t).not.toContain('self-employed self-employed')
    expect(t).toContain('Dale is a self-employed carpenter')
  })

  it('the dependants keep their privacy', () => {
    const t = boxFour(deal({ fact_find_data: ff })).text
    expect(t).toContain('They have two dependants.')
    expect(t).not.toContain('whose ages are not recorded')
  })
})
