import { describe, it, expect } from 'vitest'
import { filledCount, looksLikeAWipe, wipeMessage } from './wipe-guard'

// The real thing, roughly: a BC somebody had finished.
const finishedBc = () => ({
  template: 'buy_sell',
  purchasePrice: '797,000', deposit: '160,000', stampDuty: '31,200', dutyState: 'NSW',
  suburb: 'Orange', propertyType: 'Investment', purchasePropertySubtype: 'House',
  salePrice: '640,000', agentFees: '14,000', netProceeds: '626,000',
  existingLoanBal: '410,000', loanTerm: '30', lvrPercent: '80',
  incomeOther: '12,000', incomeRental: '24,000', ccLimit: '15,000', hecs: '480',
  brokerNotes: 'Client wants to keep repayments under 4k a month.',
  brokerSig: 'Fabio de Castro', brand: 'Simplify Finance',
  splits: [{ id: 's1', amount: '637,000', rate: '6.14', type: 'P&I' }],
})

// What the form holds when it has come up empty.
const emptyBc = () => ({
  template: 'buy_sell', purchasePrice: '797,000', dutyState: 'NSW',
  deposit: '', stampDuty: '', suburb: '', brokerNotes: '',
  splits: [{ id: 's1', amount: '', rate: '', type: 'P&I' }],
})

describe('counting what somebody actually typed', () => {
  it('counts real values and ignores empty ones', () => {
    expect(filledCount({ a: 'x', b: '', c: null, d: '   ' })).toBe(1)
  })

  it('does not count an untouched field pretending to be filled in', () => {
    expect(filledCount({ a: '0', b: 'Select', c: 'Annually', d: false })).toBe(0)
  })

  it('sees inside lists and nested records', () => {
    expect(filledCount({ rows: [{ v: 'one' }, { v: 'two' }], deep: { deeper: { v: 'three' } } })).toBe(3)
  })
})

describe('refusing to empty a form', () => {
  // The Alexis Janes case.
  it('catches a finished BC being replaced by a nearly blank one', () => {
    const v = looksLikeAWipe(finishedBc(), emptyBc())
    expect(v.wipe).toBe(true)
  })

  it('lets an ordinary edit through', () => {
    const next = { ...finishedBc(), deposit: '170,000' }
    expect(looksLikeAWipe(finishedBc(), next).wipe).toBe(false)
  })

  it('lets somebody clear a few fields', () => {
    const next = { ...finishedBc(), salePrice: '', agentFees: '', netProceeds: '', incomeOther: '' }
    expect(looksLikeAWipe(finishedBc(), next).wipe).toBe(false)
  })

  // Switching scenario rewrites the notes and the splits but keeps the figures.
  it('lets a scenario change through', () => {
    const next = { ...finishedBc(), template: 'oo_purchase', brokerNotes: '', splits: [{ id: 's1', amount: '', rate: '', type: 'P&I' }] }
    expect(looksLikeAWipe(finishedBc(), next).wipe).toBe(false)
  })

  it('says nothing about a record that was nearly empty to begin with', () => {
    expect(looksLikeAWipe({ a: '1', b: '2' }, {}).wipe).toBe(false)
  })

  it('says nothing about a brand new record', () => {
    expect(looksLikeAWipe(null, finishedBc()).wipe).toBe(false)
    expect(looksLikeAWipe({}, finishedBc()).wipe).toBe(false)
  })

  it('tells the person nothing was lost and who to tell', () => {
    const m = wipeMessage('BC', { had: 40, keeping: 3 })
    expect(m).toContain('NOT SAVED')
    expect(m).toContain('Nothing has been changed')
    expect(m).toContain('tell Fabio')
  })
})
