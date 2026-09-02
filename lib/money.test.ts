import { describe, it, expect } from 'vitest'
import { readMoney, money, moneyOrBlank, sumMoney, annualise, withFrequency } from './money'

describe('reading money the forms actually store', () => {
  it('reads a comma-formatted string - the bug that printed 0', () => {
    // Number("5,250,000") is NaN. This is why the deal summary said "0".
    expect(readMoney('5,250,000')).toBe(5250000)
    expect(money('5,250,000')).toBe('$5,250,000')
    expect(money('3,841,500')).toBe('$3,841,500')
  })

  it('reads whatever else got typed', () => {
    expect(readMoney('$1,279,283.98')).toBe(1279283.98)
    expect(readMoney('1700000')).toBe(1700000)
    expect(readMoney(1700000)).toBe(1700000)
    expect(readMoney(' 25,000 ')).toBe(25000)
  })

  it('keeps cents only where there are cents', () => {
    expect(money('1,279,283.98')).toBe('$1,279,283.98')
    expect(money('3,000,000')).toBe('$3,000,000')
    expect(money('1,279,283.00')).toBe('$1,279,283')
  })

  it('treats zero as a value, not an absence', () => {
    // A credit card sitting at $0 is a fact worth printing.
    expect(readMoney('0')).toBe(0)
    expect(money('0')).toBe('$0')
    expect(moneyOrBlank('0')).toBe('$0')
  })

  it('says "not recorded" rather than "0" for an empty field', () => {
    // "0" is a claim about the client. Blank is a claim about the form.
    expect(moneyOrBlank('')).toBe('not recorded')
    expect(moneyOrBlank(null)).toBe('not recorded')
    expect(moneyOrBlank(undefined)).toBe('not recorded')
    expect(moneyOrBlank('', '—')).toBe('—')
  })

  it('gives nothing back for rubbish rather than pretending', () => {
    expect(readMoney('abc')).toBe(null)
    expect(readMoney('-')).toBe(null)
    expect(money('abc')).toBe('')
    expect(readMoney(NaN)).toBe(null)
    expect(readMoney(Infinity)).toBe(null)
  })

  it('adds up a column, ignoring the blanks', () => {
    expect(sumMoney(['142,000', '318,400', '', null])).toBe(460400)
    expect(sumMoney([])).toBe(0)
  })
})

describe('amounts said once a year', () => {
  it('annualises by frequency', () => {
    expect(annualise('780', 'Weekly')).toBe(40560)
    expect(annualise('1,000', 'Fortnightly')).toBe(26000)
    expect(annualise('450', 'Monthly')).toBe(5400)
    expect(annualise('446,428.63', 'Annually')).toBe(446428.63)
  })
  it('leaves an unknown frequency alone rather than guessing', () => {
    expect(annualise('1,000', 'Per shift')).toBe(1000)
  })
  it('gives nothing back when there is no amount', () => {
    expect(annualise('', 'Weekly')).toBe(null)
    expect(annualise(null, 'Weekly')).toBe(null)
  })
  it('writes an amount with its frequency', () => {
    expect(withFrequency('780', 'Weekly')).toBe('$780 weekly')
    expect(withFrequency('446,428.63', 'Annually')).toBe('$446,428.63 annually')
    expect(withFrequency('', 'Weekly')).toBe('')
    expect(withFrequency('500', '')).toBe('$500')
  })
})
