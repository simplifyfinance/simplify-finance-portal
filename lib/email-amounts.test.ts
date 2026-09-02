import { describe, it, expect } from 'vitest'
import { moneyCents, showsOwnLoanAmount } from './email-amounts'

describe('the same number twice is not information', () => {
  it('drops the loan amount when it is the headline figure copied', () => {
    // What the form does by default: existing balance -> split 1 amount.
    expect(showsOwnLoanAmount('500,000', '500,000')).toBe(false)
    // Equity release -> split 2 amount.
    expect(showsOwnLoanAmount('200,000', '200,000')).toBe(false)
  })

  it('does not care how the number was typed', () => {
    expect(showsOwnLoanAmount('500000', '500,000')).toBe(false)
    expect(showsOwnLoanAmount('$500,000', '500000.00')).toBe(false)
    expect(showsOwnLoanAmount(500000, '500,000')).toBe(false)
  })

  it('KEEPS the loan amount when the broker made it different', () => {
    // Capitalised LMI or costs: the new loan is bigger than the balance paid out.
    // Hiding this row would tell the client their old balance is their new loan.
    expect(showsOwnLoanAmount('500,000', '515,000')).toBe(true)
    expect(showsOwnLoanAmount('200,000', '180,000')).toBe(true)
  })

  it('keeps it when there is no headline figure to compare against', () => {
    expect(showsOwnLoanAmount('', '500,000')).toBe(true)
    expect(showsOwnLoanAmount(null, '500,000')).toBe(true)
  })

  it('prints nothing when there is no amount at all, rather than an empty row', () => {
    expect(showsOwnLoanAmount('500,000', '')).toBe(false)
    expect(showsOwnLoanAmount('500,000', null)).toBe(false)
    expect(showsOwnLoanAmount('500,000', undefined)).toBe(false)
    expect(showsOwnLoanAmount('', '')).toBe(false)
    // and never "$0"
    expect(showsOwnLoanAmount('500,000', '0')).toBe(false)
  })

  it('reads cents, so a rounding difference is not hidden', () => {
    expect(moneyCents('500,000.50')).toBe(50000050)
    expect(showsOwnLoanAmount('500,000.00', '500,000.50')).toBe(true)
  })
})
