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

describe('approval turnaround is a phrase, not a number', () => {
  // 15 Sep 2026. The dropdown only offers ranges of words. Reading them with
  // the rate parser glued the digits together: "1-2 business days" became 12,
  // "7-10 business days" became 710, and the comparison then ranked 1-2 days as
  // slower than 10+ days.
  const two = (a: string, b: string) => compareLenders({
    recommendedLender: 'ING',
    lenders: [
      { lenderName: 'ING', productName: 'Orange Advantage', approvalDays: a,
        variablePI: { enabled: true, rate: '5.99' } },
      { lenderName: 'CBA', productName: 'Wealth Package', approvalDays: b,
        variablePI: { enabled: true, rate: '6.07' } },
    ],
  })

  it('never prints a number nobody recorded', () => {
    const said = two('1-2 business days', '7-10 business days').lines.join(' ')
    expect(said).toContain('1-2 business days')
    expect(said).not.toContain('12 days')
    expect(said).not.toContain('710')
  })

  it('puts 1-2 business days ahead of 10+ business days', () => {
    const said = two('1-2 business days', '10+ business days').lines.join(' ')
    expect(said).toContain('Fastest approval: ING at 1-2 business days.')
  })

  it('names the other lender as faster when it is', () => {
    const c = two('7-10 business days', '1-2 business days')
    expect(c.lines.join(' ')).toContain('Fastest approval: CBA at 1-2 business days. ING takes 7-10 business days.')
    expect(c.against.join(' ')).toContain('Fastest approval: CBA')
  })

  it('still says days when somebody typed a bare number', () => {
    expect(two('5', '12').lines.join(' ')).toContain('Fastest approval: ING at 5 days.')
  })
})

// ---------------------------------------------------------------------------
// RED FIRST. 15 Sep 2026, Kylie's ME Bank deal.
//
// The rates on a real deal are typed into each SPLIT under the lender, not into
// the four rate boxes at the top of the lender card. The comparison only ever
// read the boxes at the top, so a deal whose rates were all recorded properly
// came out as "** NOT RECORDED — no rate for Suncorp **" for every option.
describe('rates recorded under the splits', () => {
  const splitDeal = () => ({
    recommendedLender: 'ME Bank',
    refinanceSplits: [{ id: 's1', label: 'Loan 1', amount: '850,000' }],
    lenders: [
      { lenderName: 'ME Bank', productName: 'Flexible Home Loan', approvalDays: '5-7 business days',
        offsetAccount: 'Yes', annualFee: '395', applicationFee: '150',
        lenderSplits: [{ id: 's1', label: 'Loan 1', amount: '850,000', lvr: '',
                         rate: '5.94', repayment: '5,060', repaymentType: 'P&I' }] },
      { lenderName: 'Suncorp', productName: 'Home Package Plus', approvalDays: '3-5 business days',
        offsetAccount: 'Yes', annualFee: '375',
        lenderSplits: [{ id: 's1', label: 'Loan 1', amount: '850,000', lvr: '',
                         rate: '6.13', repayment: '5,180', repaymentType: 'P&I' }] },
    ],
  })

  it('reads the rate off the split', () => {
    const [me, suncorp] = optionsOf(splitDeal())
    expect(me.lowestRate).toBe(5.94)
    expect(suncorp.lowestRate).toBe(6.13)
  })

  it('labels it with the repayment type that was chosen', () => {
    const [me] = optionsOf(splitDeal())
    expect(me.rates).toEqual([{ label: 'P&I', rate: 5.94 }])
  })

  it('keeps every split when they are on different rates', () => {
    const d: any = splitDeal()
    d.lenders[0].lenderSplits.push({ id: 's2', label: 'Equity release', amount: '180,000',
                                     lvr: '', rate: '6.24', repayment: '', repaymentType: 'IO' })
    const [me] = optionsOf(d)
    expect(me.rates).toEqual([{ label: 'P&I', rate: 5.94 }, { label: 'IO', rate: 6.24 }])
    expect(me.lowestRate).toBe(5.94)
  })

  it('falls back to the splits recorded on the deal when a lender has none of its own', () => {
    const d: any = splitDeal()
    d.refinanceSplits = [{ id: 's1', label: 'Loan 1', amount: '850,000' }]
    d.lenders[1].lenderSplits = []
    // Nothing on the deal's own splits carries a rate, so there is genuinely
    // nothing to quote - and it must say so rather than borrow ME Bank's.
    expect(optionsOf(d)[1].lowestRate).toBe(null)
  })

  it('still reads the rate boxes at the top when that is where it was typed', () => {
    const d: any = splitDeal()
    d.lenders[0].lenderSplits = []
    d.lenders[0].variablePI = { enabled: true, rate: '5.99' }
    expect(optionsOf(d)[0].rates).toEqual([{ label: 'Variable P&I', rate: 5.99 }])
  })
})
