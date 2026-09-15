import { describe, it, expect } from 'vitest'
import { dealFigures, loFigures, figureChanges, notesMentioning } from './deal-figures'

// A deal shaped the way the fact find actually stores one: money as
// comma-formatted strings, income as a list of entries per applicant.
const DEAL = {
  fact_find_data: {
    dependants: '2',
    depositSource: 'Savings',
    applicants: [
      { firstName: 'Alexis', lastName: 'Janes', income: [{ incomeType: 'PAYG', grossSalary: '146,380', grossSalaryFrequency: 'Annually' }] },
    ],
    liabilities: [
      { liabilityType: 'Credit card', lenderName: 'ANZ', limitAmount: '15,000', balance: '2,300' },
      { liabilityType: 'Car loan', lenderName: 'Toyota Finance', balance: '18,400' },
    ],
    properties: [
      { address: '12 Smith St, Brunswick', value: '980,000', loans: [{ lenderName: 'CBA', balance: '506,514' }] },
    ],
  },
}

describe('the figures a note or an email was written from', () => {
  it('names each applicant income by the person, not by a slot number', () => {
    expect(dealFigures(DEAL)["Alexis Janes's income"]).toBe('$146,380')
  })

  it('reads comma-formatted money instead of turning it into zero', () => {
    // Number('146,380') is NaN. This is the bug that made every income read $0.
    const f = dealFigures(DEAL)
    expect(f["Alexis Janes's income"]).not.toBe('$0')
    expect(f['the value of 12 Smith St, Brunswick']).toBe('$980,000')
    expect(f['the CBA loan on 12 Smith St, Brunswick']).toBe('$506,514')
  })

  it('records a credit card by its limit and everything else by its balance', () => {
    const f = dealFigures(DEAL)
    expect(f['the credit card with ANZ limit']).toBe('$15,000')
    expect(f['the car loan with Toyota Finance balance']).toBe('$18,400')
  })

  it('keeps empty figures rather than dropping them', () => {
    // "was blank, now $15,000" is a change worth hearing about, so a blank has
    // to be recorded as something.
    const f = dealFigures({ fact_find_data: { applicants: [{ firstName: 'Sam', income: [] }] } })
    expect(f["Sam's income"]).toBe('nothing recorded')
    expect(f['the number of dependants']).toBe('not recorded')
  })

  it('tells "nothing typed yet" apart from "typed, and it comes to nothing"', () => {
    // $0 has already cost this business a day of trust. An empty income list
    // says so in words; a row that genuinely assesses at nothing says $0.
    const empty = dealFigures({ fact_find_data: { applicants: [{ firstName: 'Sam', income: [] }] } })
    const zero = dealFigures({ fact_find_data: { applicants: [{ firstName: 'Sam',
      income: [{ incomeType: 'PAYG', grossSalary: '', grossSalaryFrequency: 'Annually' }] }] } })
    expect(empty["Sam's income"]).toBe('nothing recorded')
    expect(zero["Sam's income"]).toBe('$0')
  })

  it('survives a deal with nothing on it', () => {
    expect(() => dealFigures({})).not.toThrow()
    expect(() => dealFigures(null)).not.toThrow()
  })
})

describe('what moved', () => {
  it('says nothing when nothing has changed', () => {
    expect(figureChanges(dealFigures(DEAL), dealFigures(DEAL))).toEqual([])
  })

  it('names the figure, the old value and the new one', () => {
    const was = dealFigures(DEAL)
    const now = { ...was, 'the credit card with ANZ limit': '$10,000' }
    const moved = figureChanges(was, now)
    expect(moved).toHaveLength(1)
    expect(moved[0].name).toBe('the credit card with ANZ limit')
    expect(moved[0].was).toBe('$15,000')
    expect(moved[0].now).toBe('$10,000')
    expect(moved[0].sentence).toBe('the credit card with ANZ limit changed from $15,000 to $10,000')
  })

  it('reports an income corrected upwards', () => {
    const was = dealFigures(DEAL)
    const now = dealFigures({ ...DEAL, fact_find_data: { ...DEAL.fact_find_data,
      applicants: [{ firstName: 'Alexis', lastName: 'Janes', income: [{ incomeType: 'PAYG', grossSalary: '160,000', grossSalaryFrequency: 'Annually' }] }] } })
    expect(figureChanges(was, now).map(c => c.sentence))
      .toEqual(["Alexis Janes's income changed from $146,380 to $160,000"])
  })

  it('reports something that has gone off the fact find altogether', () => {
    const was = dealFigures(DEAL)
    const now = { ...was }
    delete now['the car loan with Toyota Finance balance']
    expect(figureChanges(was, now).map(c => c.sentence))
      .toEqual(['the car loan with Toyota Finance balance was $18,400, and is no longer on the fact find'])
  })

  it('does not call a brand new figure a change', () => {
    // A second applicant added afterwards is not a figure that MOVED - nothing
    // written before could have quoted it.
    const was = dealFigures(DEAL)
    const now = { ...was, "Jordan Lee's income": '$90,000' }
    expect(figureChanges(was, now)).toEqual([])
  })

  it('says nothing at all when there is no record of what it was written from', () => {
    // Every note and email written before this existed. Silence, not a false alarm.
    expect(figureChanges(undefined, dealFigures(DEAL))).toEqual([])
  })
})

describe('which notes actually mention the figure', () => {
  const change = { name: 'the credit card with ANZ limit', was: '$15,000', now: '$10,000',
                   sentence: 'the credit card with ANZ limit changed from $15,000 to $10,000' }

  it('finds the old figure written in prose', () => {
    expect(notesMentioning(change, [
      { key: 'analysis', label: 'Analysis', text: 'The ANZ card has a $15,000 limit which is being retained.' },
      { key: 'goals', label: 'Goals', text: 'Client wants a 30 year term.' },
    ])).toEqual(['Analysis'])
  })

  it('finds it written without the dollar sign, the way a table has it', () => {
    expect(notesMentioning(change, [{ key: 'bp', label: 'Borrowing power', text: 'Card limit 15,000 assessed at 3.8%.' }]))
      .toEqual(['Borrowing power'])
  })

  it('finds it written plainly, with no comma', () => {
    expect(notesMentioning(change, [{ key: 'bp', label: 'Borrowing power', text: 'Limit 15000.' }]))
      .toEqual(['Borrowing power'])
  })

  it('points at nothing when nothing quotes the number', () => {
    expect(notesMentioning(change, [{ key: 'a', label: 'Analysis', text: 'The card is being closed at settlement.' }]))
      .toEqual([])
  })

  it('does not go hunting when the old value was a blank', () => {
    const fromBlank = { name: "Sam's income", was: 'nothing recorded', now: '$90,000', sentence: '' }
    expect(notesMentioning(fromBlank, [{ key: 'a', label: 'Analysis', text: 'nothing recorded here' }])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// NATASHA & RICHARD CHAPMAN, 9 Sep 2026. The real one.
//
// The saved email quoted CBA at 6.09% and $10,291 a month. The deal held 6.07%
// and $10,269. Nothing on the screen said so, because the LO only checked that
// the SCENARIO had not changed - and it had not. By the time it was found the
// deal was five days into Compliance Sent.
describe('the figures a lending options email quotes', () => {
  const CHAPMAN = {
    loanAmount: '1,700,000', purchasePrice: '5,250,000', deposit: '3,841,500',
    stampDuty: '291,500', existingLoan: '', recommendedLender: 'ING',
    lenders: [
      { lenderName: 'ING', applicationFee: '$0', annualFee: '$299/yr', valuationFee: '$0', legalFee: '350',
        variablePI: { enabled: true, rate: '5.99', repayment: '10,182', loanTerm: '30' },
        variableIO: { enabled: false, rate: '', repayment: '', loanTerm: '30' },
        fixedPI:    { enabled: false, rate: '', repayment: '', loanTerm: '30' },
        fixedIO:    { enabled: false, rate: '', repayment: '', loanTerm: '30' } },
      { lenderName: 'CBA', applicationFee: '$0', annualFee: '$395/yr', valuationFee: '$0', legalFee: '200',
        variablePI: { enabled: true, rate: '6.07', repayment: '10,269', loanTerm: '30' },
        variableIO: { enabled: false, rate: '', repayment: '', loanTerm: '30' },
        fixedPI:    { enabled: false, rate: '', repayment: '', loanTerm: '30' },
        fixedIO:    { enabled: false, rate: '', repayment: '', loanTerm: '30' } },
    ],
  }
  // What the email on that deal was actually built from.
  const AS_THE_EMAIL_WAS_WRITTEN = { ...loFigures(CHAPMAN),
    "CBA's variable P&I rate": '6.09%', "CBA's variable P&I repayment": '$10,291' }

  it('names each lender rate and repayment by the lender', () => {
    const f = loFigures(CHAPMAN)
    expect(f["ING's variable P&I rate"]).toBe('5.99%')
    expect(f["ING's variable P&I repayment"]).toBe('$10,182')
    expect(f["CBA's variable P&I rate"]).toBe('6.07%')
  })

  it('ignores rate types nobody is offering', () => {
    // Three of the four modules on each lender are switched off and empty.
    // Recording them would be recording a figure no client was ever told.
    const f = loFigures(CHAPMAN)
    expect(Object.keys(f).some(k => k.includes('fixed'))).toBe(false)
    expect(Object.keys(f).some(k => k.includes('interest only'))).toBe(false)
  })

  it('keeps the money figures and the recommended lender', () => {
    const f = loFigures(CHAPMAN)
    expect(f['the loan amount']).toBe('$1,700,000')
    expect(f['the purchase price']).toBe('$5,250,000')
    expect(f['the stamp duty']).toBe('$291,500')
    expect(f['the recommended lender']).toBe('ING')
  })

  it('leaves out what this deal does not have', () => {
    // A purchase has no existing loan. An empty box is not a figure.
    expect(loFigures(CHAPMAN)['the existing loan balance']).toBeUndefined()
  })

  // THE ONE THAT MATTERS.
  it('catches the rate that moved after the email was written', () => {
    const moved = figureChanges(AS_THE_EMAIL_WAS_WRITTEN, loFigures(CHAPMAN))
    expect(moved.map(c => c.sentence).sort()).toEqual([
      "CBA's variable P&I rate changed from 6.09% to 6.07%",
      "CBA's variable P&I repayment changed from $10,291 to $10,269",
    ])
  })

  it('says nothing when the email still matches the deal', () => {
    expect(figureChanges(loFigures(CHAPMAN), loFigures(CHAPMAN))).toEqual([])
  })

  it('notices the recommendation being switched to the other lender', () => {
    const now = loFigures({ ...CHAPMAN, recommendedLender: 'CBA' })
    expect(figureChanges(loFigures(CHAPMAN), now).map(c => c.sentence))
      .toEqual(['the recommended lender changed from ING to CBA'])
  })

  it('does not mistake a fee being written differently for a fee changing', () => {
    // "$395/yr" is stored as typed. Tidying it here would make a formatting
    // change look like a price change to the client.
    const f = loFigures(CHAPMAN)
    expect(f["CBA's annual fee"]).toBe('$395/yr')
    expect(f["CBA's legal fee"]).toBe('200')
  })

  it('survives a deal with no lenders on it yet', () => {
    expect(() => loFigures({})).not.toThrow()
    expect(() => loFigures(null)).not.toThrow()
    expect(loFigures({}) ['the recommended lender']).toBe('not chosen yet')
  })
})

// ---------------------------------------------------------------------------
// THE LENDING OPTIONS THE COMPLIANCE NOTES WERE WRITTEN FROM.
//
// 16 Sep 2026. Fabio: "staff will adjust LO and FF data as they go" - so how
// does the portal make sure a compliance box written on Monday is not quietly
// describing Monday's deal on Friday?
//
// It already tries. Every box is stamped with what it was written from, and a
// box whose facts have moved is marked stale by name. But the stamp watched the
// FACT FIND and six headline facts, and nothing else. Change a rate on a split,
// a fee, a product name or an approval turnaround and NOTHING went stale - the
// prose sat there naming figures the deal no longer holds.
//
// Same shape as the fault found on 15 Sep in the compliance boxes themselves:
// the code only ever looked at the four rate boxes at the top of the lender
// card, and the team types the rates into the splits.
describe('the lending options a compliance note was written from', () => {
  const deal = () => ({
    fact_find_data: { applicants: [], liabilities: [], properties: [], dependants: '2' },
    lo_data: {
      recommendedLender: 'ME Bank',
      refinanceSplits: [{ id: 's1', label: 'Loan 1', amount: '408,000' }],
      lenders: [{
        lenderName: 'ME Bank', productName: 'Flexible Home Loan',
        approvalDays: '5-7 business days', annualFee: '395', offsetAccount: 'Yes',
        lenderSplits: [{ id: 's1', label: 'Loan 1', amount: '408,000', lvr: '',
                         rate: '6.46', repayment: '2,569', repaymentType: 'P&I' }],
      }],
    },
  })

  it('A RATE TYPED INTO A SPLIT IS ONE OF THE FIGURES', () => {
    const was = dealFigures(deal())
    const d = deal()
    d.lo_data.lenders[0].lenderSplits[0].rate = '6.94'
    const moved = figureChanges(was, dealFigures(d))
    expect(moved.map(c => c.sentence).join(' '),
      'a rate change on a split marked nothing stale').toMatch(/6\.46.*6\.94|6\.94/)
  })

  it('so is the repayment on that split', () => {
    const was = dealFigures(deal())
    const d = deal()
    d.lo_data.lenders[0].lenderSplits[0].repayment = '2,780'
    expect(figureChanges(was, dealFigures(d)).length,
      'a repayment change marked nothing stale').toBeGreaterThan(0)
  })

  it('so is the product the client is being recommended', () => {
    const was = dealFigures(deal())
    const d = deal()
    d.lo_data.lenders[0].productName = 'Everyday Home Loan'
    expect(figureChanges(was, dealFigures(d)).length,
      'the product name changed and nothing went stale').toBeGreaterThan(0)
  })

  it('so is a fee', () => {
    const was = dealFigures(deal())
    const d = deal()
    d.lo_data.lenders[0].annualFee = '450'
    expect(figureChanges(was, dealFigures(d)).length,
      'a fee changed and nothing went stale').toBeGreaterThan(0)
  })

  it('so is how long the lender takes', () => {
    const was = dealFigures(deal())
    const d = deal()
    d.lo_data.lenders[0].approvalDays = '10+ business days'
    expect(figureChanges(was, dealFigures(d)).length,
      'the approval turnaround changed and nothing went stale').toBeGreaterThan(0)
  })

  it('names the lender it belongs to, so two options do not collide', () => {
    const d = deal()
    d.lo_data.lenders.push({
      lenderName: 'Suncorp', productName: 'Home Package Plus',
      approvalDays: '3-5 business days', annualFee: '375', offsetAccount: 'Yes',
      lenderSplits: [{ id: 's1', label: 'Loan 1', amount: '408,000', lvr: '',
                       rate: '6.13', repayment: '2,480', repaymentType: 'P&I' }],
    } as any)
    const names = Object.keys(dealFigures(d)).join(' | ')
    expect(names).toMatch(/ME Bank/)
    expect(names).toMatch(/Suncorp/)
  })

  it('a deal with no lending options yet says nothing about it', () => {
    const bare = { fact_find_data: { applicants: [], liabilities: [], properties: [] } }
    const names = Object.keys(dealFigures(bare)).join(' | ')
    expect(names).not.toMatch(/rate|repayment|fee|approval/i)
  })

  it('and none of this disturbs the fact find figures', () => {
    const d = deal()
    ;(d.fact_find_data as any).dependants = '3'
    const moved = figureChanges(dealFigures(deal()), dealFigures(d))
    expect(moved.map(c => c.sentence).join(' ')).toMatch(/dependants/i)
  })
})
