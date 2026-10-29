import { describe, it, expect } from 'vitest'
import { propertyChecklist } from './property-checklist'
import { isSavings, ASSET_TYPES } from './fact-find-options'

// SAVINGS REACH THE CLIENT.
//
// 29 Oct 2026. Fabio: "ensure 'savings' on the dropdown under assets section on
// fact find AND that figure comes across 'Based on your numbers' section on the
// HTML template."
//
// He asked for both halves on 13 Oct - "Change 'bank account' to 'savings' on
// the other assets page in the Fact Find, and then have this come through on
// the BC email." The dropdown landed that day. The email half did not: savings
// reached the compliance pack and never reached the client, who is the person
// being asked to produce the deposit out of it.
//
// Invented clients.

const ff = (assets: any[]) => ({ applicants: [], properties: [], liabilities: [], assets })

describe('THE LIST STILL OFFERS IT', () => {
  it('and offers it first, because it is the one that funds a deposit', () => {
    expect(ASSET_TYPES[0]).toBe('Savings')
  })

  it('and the word is answered in one place', () => {
    expect(isSavings('Savings')).toBe(true)
    // Every deal recorded before 13 Oct 2026 still says this and always will.
    expect(isSavings('Bank account')).toBe(true)
    expect(isSavings('bank account')).toBe(true)
    expect(isSavings('Super')).toBe(false)
    expect(isSavings('')).toBe(false)
    expect(isSavings(null)).toBe(false)
  })
})

describe('AND THE FIGURE REACHES THE EMAIL', () => {
  it('one account, with the bank it is at', () => {
    const out = propertyChecklist(ff([
      { assetType: 'Savings', description: 'Westpac', value: '85,000' },
    ])).join(' ')
    expect(out).toContain('Savings')
    expect(out).toContain('Westpac')
    expect(out).toContain('$85,000')
  })

  it('AND A DEAL RECORDED BEFORE THE RENAME IS NOT LEFT OUT', () => {
    expect(propertyChecklist(ff([
      { assetType: 'Bank account', description: 'ING', value: '40,000' },
    ])).join(' ')).toContain('$40,000')
  })

  it('and two accounts are two lines and a total, because two is two statements', () => {
    const out = propertyChecklist(ff([
      { assetType: 'Savings', description: 'Westpac', value: '40,000' },
      { assetType: 'Savings', description: 'ING', value: '45,000' },
    ])).join(' ')
    expect(out).toContain('$40,000')
    expect(out).toContain('$45,000')
    expect(out).toContain('Total $85,000')
  })

  it('and one account is not given a total of itself', () => {
    expect(propertyChecklist(ff([
      { assetType: 'Savings', description: 'Westpac', value: '85,000' },
    ])).join(' ')).not.toContain('Total')
  })

  it('and it comes before the properties and the debts', () => {
    const items = propertyChecklist({
      applicants: [], assets: [{ assetType: 'Savings', description: 'Westpac', value: '85,000' }],
      properties: [{ address: '4 Example St', value: '900,000' }],
      liabilities: [{ liabilityType: 'Credit card', limitAmount: '20,000' }],
    })
    expect(items[0]).toContain('Savings')
  })
})

describe('AND NOTHING IS INVENTED', () => {
  it('an account with no figure is not a line', () => {
    expect(propertyChecklist(ff([{ assetType: 'Savings', description: 'Westpac', value: '' }])))
      .toEqual([])
  })

  it('a figure with no bank name still prints the figure', () => {
    expect(propertyChecklist(ff([{ assetType: 'Savings', description: '', value: '12,000' }])).join(' '))
      .toContain('$12,000')
  })

  it('and the car and the super stay out of a lending email', () => {
    const out = propertyChecklist(ff([
      { assetType: 'Vehicle', description: '2019 Mazda CX-5', value: '22,000' },
      { assetType: 'Super', description: 'Australian Super', value: '160,000' },
    ])).join(' ')
    expect(out).toBe('')
  })

  it('and a fact find with no assets at all does not throw', () => {
    expect(() => propertyChecklist({ applicants: [], properties: [], liabilities: [] })).not.toThrow()
  })
})
