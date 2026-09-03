import { describe, it, expect } from 'vitest'
import { optionsOf, compareLenders, comparisonBlock } from './lender-comparison'

const lo = (over: any = {}) => ({
  recommendedLender: 'ING',
  criteriaUsed: ['Competitive interest rate', 'Good turnaround times'],
  lenders: [
    { lenderName: 'ING', productName: 'Orange Advantage', applicationFee: '0', annualFee: '299',
      offsetAccount: 'Yes', approvalDays: '5', variablePI: { enabled: true, rate: '5.64' } },
    { lenderName: 'Macquarie', productName: 'Basic', applicationFee: '350', annualFee: '0',
      offsetAccount: 'No', approvalDays: '12', variablePI: { enabled: true, rate: '5.49' } },
  ],
  ...over,
})
const said = (o: any) => comparisonBlock(o).join('\n')

describe('what each option is', () => {
  it('marks the recommended one', () => {
    expect(optionsOf(lo()).find(o => o.recommended)!.name).toBe('ING')
  })

  // A disabled module still holds whatever was last typed into it. Quoting that
  // would be quoting a rate the lender was never offered on.
  it('ignores a rate module the broker switched off', () => {
    const o = optionsOf(lo({ lenders: [{ lenderName: 'ING', variablePI: { enabled: false, rate: '5.10' },
                                         fixedPI: { enabled: true, rate: '5.80' } }] }))
    expect(o[0].rates.map(r => r.label)).toEqual(['Fixed P&I'])
    expect(o[0].lowestRate).toBe(5.8)
  })

  it('adds every upfront fee together, and keeps the annual fee apart', () => {
    const o = optionsOf(lo({ lenders: [{ lenderName: 'ING', applicationFee: '600', legalFee: '350',
      valuationFee: '', establishmentFee: '250', annualFee: '395' }] }))
    expect(o[0].upfront).toBe(1200)
    expect(o[0].ongoing).toBe(395)
  })

  it('reads "No" as no offset, and anything else as having one', () => {
    expect(optionsOf(lo({ lenders: [{ lenderName: 'A', offsetAccount: 'No' }] }))[0].offset).toBe(false)
    expect(optionsOf(lo({ lenders: [{ lenderName: 'A', offsetAccount: 'Yes' }] }))[0].offset).toBe(true)
    expect(optionsOf(lo({ lenders: [{ lenderName: 'A', offsetAccount: '' }] }))[0].offset).toBe(false)
  })
})

// Fabio, 3 Sep 2026: "if it's a lower rate, compare the rates. If it's a lower
// fee, compare the fees. If he has more features, compare the features."
describe('how they compare', () => {
  it('names the cheaper rate and the gap', () => {
    expect(said(lo())).toContain('Lowest rate: Macquarie at 5.49%. ING is 0.15% higher at 5.64%.')
  })

  it('says so when the recommendation IS the cheapest', () => {
    expect(said(lo())).toContain('Lowest upfront fees: ING at $0 — the recommended lender is the cheapest to set up.')
  })

  it('compares the annual fee separately, in dollars a year', () => {
    expect(said(lo())).toContain('ING charges $299, $299 more each year')
  })

  it('compares the feature', () => {
    expect(said(lo())).toContain('Offset account: available with ING — including the recommended lender.')
  })

  it('compares turnaround', () => {
    expect(said(lo())).toContain('Fastest approval: ING at 5 days.')
  })
})

// The lines a credit assessor will ask about, pulled out so the prompt can make
// the model address each one rather than listing strengths and stopping.
describe('where the recommendation is not ahead', () => {
  it('lists only the losing measures', () => {
    const c = compareLenders(lo())
    expect(c.against).toHaveLength(2)
    expect(c.against.join(' ')).toContain('Lowest rate: Macquarie')
    expect(c.against.join(' ')).toContain('Lowest ongoing fees: Macquarie')
    expect(c.against.join(' ')).not.toContain('upfront')
  })

  it('is empty when the recommendation wins on everything', () => {
    const best = lo({ lenders: [
      { lenderName: 'ING', applicationFee: '0', annualFee: '0', offsetAccount: 'Yes',
        approvalDays: '5', variablePI: { enabled: true, rate: '5.00' } },
      { lenderName: 'Macquarie', applicationFee: '350', annualFee: '395', offsetAccount: 'No',
        approvalDays: '12', variablePI: { enabled: true, rate: '5.90' } },
    ] })
    expect(compareLenders(best).against).toEqual([])
    expect(said(best)).not.toContain('WHERE THE RECOMMENDATION IS NOT')
  })

  it('says nothing at all with only one option to compare', () => {
    const one = lo({ lenders: [{ lenderName: 'ING', variablePI: { enabled: true, rate: '5.64' } }] })
    expect(compareLenders(one).lines).toEqual([])
    expect(compareLenders(one).against).toEqual([])
  })
})

describe('the research criteria', () => {
  it('carries what the client said mattered', () => {
    expect(said(lo())).toContain('Competitive interest rate')
    expect(said(lo())).toContain('Good turnaround times')
  })

  it('leaves the section out when none were ticked', () => {
    expect(said(lo({ criteriaUsed: [] }))).not.toContain('WHAT THE CLIENT SAID MATTERS')
  })
})

describe('what it refuses to do', () => {
  it('says a rate is not recorded rather than treating it as zero', () => {
    expect(said(lo({ lenders: [
      { lenderName: 'ING', variablePI: { enabled: true, rate: '5.64' } },
      { lenderName: 'Macquarie' }] }))).toContain('No rate recorded')
  })

  it('copes with an empty lending options tab', () => {
    expect(comparisonBlock({})).toEqual([])
    expect(comparisonBlock(null)).toEqual([])
  })

  it('ignores a lender option nobody named', () => {
    expect(optionsOf(lo({ lenders: [{ lenderName: '' }, { lenderName: 'ING' }] }))).toHaveLength(1)
  })
})
