// The approval terms moved off a list of ten banks and onto the lender. 17 Aug 2026.
import { describe, it, expect } from 'vitest'
import {
  approvalOf, approvalUnknown, extensionWords, approvalSummary, lenderWord,
} from './lender-approval'

const ANZ = { name: 'ANZ', preapproval_days: 90, preapproval_extends: true,
              preapproval_extend_days: 90 }
const NAB = { name: 'NAB', preapproval_days: 90, preapproval_extends: false }
const WLTH = { name: 'WLTH', preapproval_days: 90, preapproval_extends: true,
               preapproval_extend_days: 90, preapproval_extend_fee: 100 }
const PEPPER = { name: 'Pepper' }

describe('reading the terms', () => {
  it('reads a lender that has been filled in', () => {
    expect(approvalOf(ANZ)).toEqual({ days: 90, extends: true, extendDays: 90, extendFee: null })
  })

  // THE POINT OF THE WHOLE CHANGE. Pepper was not on the list of ten, so the
  // panel drew nothing - which on a screen about a deadline reads as "there
  // is no deadline".
  it('says nothing is recorded rather than guessing 90 days', () => {
    expect(approvalOf(PEPPER)).toBeNull()
    expect(approvalUnknown(PEPPER)).toBe(true)
    expect(approvalUnknown(ANZ)).toBe(false)
  })

  it('treats a missing lender as not recorded', () => {
    expect(approvalOf(null)).toBeNull()
    expect(approvalOf(undefined)).toBeNull()
    expect(approvalUnknown(null)).toBe(true)
  })

  // An extension fee with no term is still a lender nobody has told us how
  // long the approval runs for.
  it('needs the days before anything else counts', () => {
    expect(approvalOf({ name: 'X', preapproval_extend_fee: 100 })).toBeNull()
    expect(approvalOf({ name: 'X', preapproval_days: 0 })).toBeNull()
    expect(approvalOf({ name: 'X', preapproval_days: null })).toBeNull()
  })

  it('does not read a blank tick as a yes', () => {
    expect(approvalOf({ name: 'X', preapproval_days: 60 })?.extends).toBe(false)
  })
})

describe('what the offer accepted panel says', () => {
  it('names the extension the way it always has', () => {
    expect(extensionWords(approvalOf(ANZ))).toBe(' They will extend it by another 90 days.')
    expect(extensionWords(approvalOf(NAB))).toBe(' They do not extend it.')
    expect(extensionWords(approvalOf(WLTH))).toBe(' They will extend it, for $100.')
  })

  it('says nothing at all where nothing is recorded', () => {
    expect(extensionWords(approvalOf(PEPPER))).toBe('')
    expect(extensionWords(null)).toBe('')
  })

  it('still says something useful where they extend but nobody said how long', () => {
    expect(extensionWords(approvalOf({ name: 'X', preapproval_days: 90, preapproval_extends: true })))
      .toBe(' They will extend it.')
  })
})

describe('the line on the lender row', () => {
  it('reads at a glance', () => {
    expect(approvalSummary(ANZ)).toBe('preapproval 90 days, +90 days')
    expect(approvalSummary(NAB)).toBe('preapproval 90 days, no extension')
    expect(approvalSummary(WLTH)).toBe('preapproval 90 days, $100 to extend')
  })

  it('says so when it is blank', () => {
    expect(approvalSummary(PEPPER)).toBe('preapproval not recorded')
    expect(approvalSummary(null)).toBe('preapproval not recorded')
  })

  it('names the lender, or does not pretend to', () => {
    expect(lenderWord(PEPPER)).toBe('Pepper')
    expect(lenderWord({})).toBe('this lender')
    expect(lenderWord(null)).toBe('this lender')
  })
})
