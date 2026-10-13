import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  limitIsComingDown, limitToSend, reductionWithNoFigure, conditionFor,
  conditionsOn, withLimitConditions, conditionsChanged,
} from './limit-to-send'
import { LIMIT_REDUCED } from './fact-find-options'
import { stillWaiting } from './outstanding'

// Fabio, 13 Oct 2026: "handover goes 10,000 condition to be reduced".
const card = (over: any = {}) => ({
  liabilityType: 'Credit card', lenderName: 'Westpac',
  limitAmount: '30,000', balance: '4,120', ...over,
})
const deal = (liabilities: any[], outstanding: any[] = []) =>
  ({ fact_find_data: { liabilities }, outstanding_items: outstanding })

describe('the limit the bank is sent', () => {
  it('is the new one when the limit is coming down', () => {
    expect(limitToSend(card({ status: LIMIT_REDUCED, newLimitAmount: '10,000' }))).toBe('10,000')
  })

  it('and is today’s limit on a card that is just staying', () => {
    expect(limitToSend(card({ status: 'Remain open', newLimitAmount: '10,000' }))).toBe('30,000')
    expect(limitIsComingDown(card({ status: 'Remain open' }))).toBe(false)
  })

  // A REDUCTION WITH NO FIGURE IS A SENTIMENT, NOT A NUMBER. Assessing on a
  // sentiment is worse than assessing on the limit as it actually stands.
  it('falls back to today’s limit when nobody typed the new one', () => {
    expect(limitToSend(card({ status: LIMIT_REDUCED, newLimitAmount: '' }))).toBe('30,000')
    expect(reductionWithNoFigure(card({ status: LIMIT_REDUCED }))).toBe(true)
    expect(reductionWithNoFigure(card({ status: LIMIT_REDUCED, newLimitAmount: '10,000' }))).toBe(false)
  })

  it('and never sends a HIGHER figure as a reduction', () => {
    expect(limitToSend(card({ status: LIMIT_REDUCED, newLimitAmount: '40,000' }))).toBe('30,000')
    expect(limitToSend(card({ status: LIMIT_REDUCED, newLimitAmount: '30,000' }))).toBe('30,000')
  })

  it('and the assessment form actually uses it', () => {
    const content = readFileSync('lib/assessment-content.ts', 'utf8')
    expect(content).toContain('limitToSend(cards[k])')
    expect(content, 'the raw limit is going to the bank again').not.toContain('cards[k]?.limitAmount')
  })
})

// THE OTHER HALF, AND NEITHER IS ANY GOOD WITHOUT IT. On the day the form is
// lodged the card is still at its old limit. Sending the lower figure without
// anybody being made to do the reduction is how a file gets approved on a
// number that never comes true.
describe('the condition that makes it true', () => {
  it('says what to do, in words you can read down the phone', () => {
    expect(conditionFor(card({ status: LIMIT_REDUCED, newLimitAmount: '10,000' })))
      .toBe('Reduce the Westpac credit card limit to $10,000 before settlement, and send the confirmation')
  })

  it('and says the figure is missing when it is', () => {
    expect(conditionFor(card({ status: LIMIT_REDUCED })))
      .toMatch(/the new limit has not been recorded yet/)
  })

  it('copes with a card nobody named a lender for', () => {
    expect(conditionFor(card({ lenderName: '', status: LIMIT_REDUCED, newLimitAmount: '10,000' })))
      .toContain('Reduce the credit card limit to $10,000')
  })

  it('and says nothing about a card that is staying as it is', () => {
    expect(conditionFor(card({ status: 'Remain open' }))).toBe('')
    expect(conditionsOn(deal([card({ status: 'Remain open' })]))).toEqual([])
  })

  it('one condition per card being reduced', () => {
    const d = deal([
      card({ status: LIMIT_REDUCED, newLimitAmount: '10,000' }),
      card({ lenderName: 'ANZ', status: LIMIT_REDUCED, newLimitAmount: '5,000' }),
      card({ lenderName: 'NAB', status: 'To be closed' }),
    ])
    expect(conditionsOn(d)).toHaveLength(2)
  })

  it('and nothing on a deal with no fact find at all', () => {
    expect(conditionsOn({})).toEqual([])
    expect(conditionsOn(null)).toEqual([])
  })
})

describe('it lands on the deal card, waiting on the client', () => {
  it('adds the condition to the outstanding list', () => {
    const d = deal([card({ status: LIMIT_REDUCED, newLimitAmount: '10,000' })])
    const next = withLimitConditions(d)
    expect(next).toHaveLength(1)
    expect(next[0].waitingOn).toBe('client')
    expect(next[0].what).toContain('Reduce the Westpac credit card limit to $10,000')
    expect(conditionsChanged(d, next)).toBe(true)
  })

  it('and leaves everything already on the list alone', () => {
    const d = deal([card({ status: LIMIT_REDUCED, newLimitAmount: '10,000' })],
      [{ id: 'o1', what: 'Two payslips', waitingOn: 'client', askedAt: '2026-10-01' }])
    const next = withLimitConditions(d)
    expect(next).toHaveLength(2)
    expect(next[0].what).toBe('Two payslips')
  })

  // A FACT FIND IS SAVED THIRTY TIMES WHILE IT IS BEING BUILT. Adding the item
  // on every save would hand a client the same instruction thirty times.
  it('does not add the same job twice', () => {
    const d = deal([card({ status: LIMIT_REDUCED, newLimitAmount: '10,000' })])
    const once = withLimitConditions(d)
    const twice = withLimitConditions({ ...d, outstanding_items: once })
    expect(twice).toHaveLength(1)
    expect(conditionsChanged({ ...d, outstanding_items: once }, twice)).toBe(false)
  })

  // Correcting the figure is the same job, not a second one.
  it('nor again when somebody fixes the figure', () => {
    const d = deal([card({ status: LIMIT_REDUCED, newLimitAmount: '12,000' })])
    const once = withLimitConditions(d)
    const fixed = deal([card({ status: LIMIT_REDUCED, newLimitAmount: '10,000' })], once)
    expect(withLimitConditions(fixed)).toHaveLength(1)
  })

  it('but a second card is a second job', () => {
    const d = deal([card({ status: LIMIT_REDUCED, newLimitAmount: '10,000' })])
    const once = withLimitConditions(d)
    const both = deal([
      card({ status: LIMIT_REDUCED, newLimitAmount: '10,000' }),
      card({ lenderName: 'ANZ', status: LIMIT_REDUCED, newLimitAmount: '5,000' }),
    ], once)
    expect(withLimitConditions(both)).toHaveLength(2)
  })

  // NOTHING IS EVER REMOVED. A condition that was asked for and then changed
  // its mind is a record of what was asked, not a row to delete.
  it('and never takes one back off when the fact find changes', () => {
    const d = deal([card({ status: LIMIT_REDUCED, newLimitAmount: '10,000' })])
    const once = withLimitConditions(d)
    const changedMind = deal([card({ status: 'Remain open' })], once)
    expect(withLimitConditions(changedMind)).toHaveLength(1)
    expect(stillWaiting(changedMind)).toHaveLength(1)
  })
})
