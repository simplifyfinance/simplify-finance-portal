import { describe, it, expect } from 'vitest'
import { missingForEmail, missingSentence } from './bc-ready'

// Alexis Janes, refinance only, 8 Sep 2026 - every box the email needed was
// empty, and the email went out with placeholders where the figures should be.
const alexisBc = {
  template: 'refinance_only',
  suburb: '', existingLoanBal: '', propertyValue: '',
  splits: [{ label: 'Refinanced loan', amount: '', rate: '6.14', type: 'P&I' }],
  loanTerm: '30',
}

describe('what this email wanted and did not get', () => {
  it('names every empty box, and where to find it', () => {
    const missing = missingForEmail('refinance_only', alexisBc)
    expect(missing.map(m => m.label)).toEqual(['Suburb', 'Existing loan balance', 'Property value', 'Amount'])
    expect(missing.find(m => m.label === 'Amount')!.where).toBe('Loan splits, split 1')
    // The rate was typed, so it is not on the list.
    expect(missing.map(m => m.label)).not.toContain('Rate')
  })

  it('says nothing when the BC is finished', () => {
    const done = { ...alexisBc, suburb: 'Summer Hill', existingLoanBal: '506,514', propertyValue: '825,000',
                   splits: [{ amount: '506,514', rate: '6.14', type: 'P&I' }] }
    expect(missingForEmail('refinance_only', done)).toEqual([])
  })

  // A warning that lists things the email would never print is one nobody reads
  // twice. A refinance email has no purchase price on it.
  it('only asks for what this scenario actually prints', () => {
    const labels = missingForEmail('refinance_only', alexisBc).map(m => m.label)
    expect(labels).not.toContain('Purchase price')
    expect(labels).not.toContain('Deposit')
  })

  it('asks for the right things on a purchase', () => {
    const labels = missingForEmail('oo_purchase', { splits: [{}] }).map(m => m.label)
    expect(labels).toContain('Purchase price')
    expect(labels).toContain('Deposit')
    expect(labels).not.toContain('Existing loan balance')
  })

  it('asks for both splits on a refinance with equity release', () => {
    const missing = missingForEmail('refinance_equity', { splits: [{ amount: '400,000', rate: '6.14' }, {}] })
    expect(missing.filter(m => m.where === 'Loan splits, split 2').map(m => m.label)).toEqual(['Amount', 'Rate'])
  })

  it('treats a zero as empty, because that is what an untouched money box holds', () => {
    expect(missingForEmail('refinance_only', { ...alexisBc, propertyValue: '0' }).map(m => m.label))
      .toContain('Property value')
  })

  it('copes with a scenario it has never heard of', () => {
    expect(missingForEmail('something_new', { splits: [{}] }).map(m => m.label)).toEqual(['Amount', 'Rate'])
  })
})

describe('saying it in a sentence', () => {
  it('reads properly', () => {
    expect(missingSentence(missingForEmail('refinance_only', alexisBc)))
      .toBe('Suburb, Existing loan balance, Property value and Amount')
    expect(missingSentence([])).toBe('')
  })
})
