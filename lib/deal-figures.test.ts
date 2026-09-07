import { describe, it, expect } from 'vitest'
import { dealFigures, figureChanges, notesMentioning } from './deal-figures'

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
