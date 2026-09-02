import { describe, it, expect } from 'vitest'
import { hemStateOf, countsInHem, hemTotals, unansweredNote, type ExpenseCategory } from './hem'

const groceries: ExpenseCategory = { key: 'groceries', label: 'Groceries', inHem: true }
const schooling: ExpenseCategory = { key: 'privateSchoolingTuition', label: 'Private schooling', inHem: false }
const health: ExpenseCategory = { key: 'healthInsurance', label: 'Health insurance', inHem: true, askHem: true }
const strata: ExpenseCategory = { key: 'primaryResidenceBodyCorp', label: 'Strata (primary residence)', inHem: true, askHem: true }

describe('who decides whether an expense is in HEM', () => {
  it('leaves a settled category alone - no toggle, no question', () => {
    expect(hemStateOf(groceries, { hem: 'out' })).toBe('in')
    expect(hemStateOf(schooling, { hem: 'in' })).toBe('out')
  })

  it('starts the two askable ones unanswered', () => {
    expect(hemStateOf(health, undefined)).toBe('unanswered')
    expect(hemStateOf(strata, {})).toBe('unanswered')
    expect(hemStateOf(health, { hem: '' })).toBe('unanswered')
    expect(hemStateOf(health, { hem: 'maybe' })).toBe('unanswered')
  })

  it('takes the answer once it is given', () => {
    expect(hemStateOf(health, { hem: 'out' })).toBe('out')
    expect(hemStateOf(strata, { hem: 'in' })).toBe('in')
  })

  it('counts an unanswered row as in HEM, where it already sat', () => {
    expect(countsInHem('unanswered')).toBe(true)
    expect(countsInHem('in')).toBe(true)
    expect(countsInHem('out')).toBe(false)
  })
})

describe('the totals', () => {
  const cats = [groceries, health, strata, schooling]
  const money = {
    groceries: { monthlyAmount: '1,400' },
    healthInsurance: { monthlyAmount: '280' },
    primaryResidenceBodyCorp: { monthlyAmount: '360' },
    privateSchoolingTuition: { monthlyAmount: '900' },
  }

  it('does not move on its own before anyone answers', () => {
    // Exactly what the screen showed before this existed.
    const t = hemTotals(cats, money)
    expect(t.all).toBe(2940)
    expect(t.inHem).toBe(2040)
    expect(t.notInHem).toBe(900)
    expect(t.unanswered).toBe(2)
  })

  it('moves the money when health insurance goes outside', () => {
    const t = hemTotals(cats, { ...money, healthInsurance: { monthlyAmount: '280', hem: 'out' } })
    expect(t.inHem).toBe(1760)
    expect(t.notInHem).toBe(1180)
    expect(t.all).toBe(2940)          // the grand total never changes
    expect(t.unanswered).toBe(1)
  })

  it('clears the count once both are answered', () => {
    const t = hemTotals(cats, {
      ...money,
      healthInsurance: { monthlyAmount: '280', hem: 'out' },
      primaryResidenceBodyCorp: { monthlyAmount: '360', hem: 'in' },
    })
    expect(t.unanswered).toBe(0)
    expect(t.inHem).toBe(1760)
  })

  it('still counts a blank row as unanswered', () => {
    // No amount typed is not the same as no question to answer.
    const t = hemTotals([health], { healthInsurance: { monthlyAmount: '' } })
    expect(t.unanswered).toBe(1)
    expect(t.all).toBe(0)
  })

  it('survives an empty deal', () => {
    expect(hemTotals([], null)).toEqual({ all: 0, inHem: 0, notInHem: 0, unanswered: 0 })
  })
})

describe('the banner', () => {
  it('says nothing when there is nothing to say', () => {
    expect(unansweredNote(0)).toBe('')
  })
  it('counts in plain English', () => {
    expect(unansweredNote(1)).toBe('1 expense still needs a HEM answer. It is counted as in HEM until you decide.')
    expect(unansweredNote(2)).toBe('2 expenses still need a HEM answer. They are counted as in HEM until you decide.')
  })
})
