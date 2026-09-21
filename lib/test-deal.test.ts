import { describe, it, expect } from 'vitest'
import {
  isTestDeal, realDealsOnly, testDealsOnly, emailGoesTo,
  testSubject, recordsRateData, canChangeTestFlag, testFlagNote,
} from './test-deal'

describe('what counts as a test deal', () => {
  it('only a deal explicitly ticked is a test', () => {
    expect(isTestDeal({ is_test: true })).toBe(true)
    expect(isTestDeal({ is_test: false })).toBe(false)
  })

  // The safe direction. A deal that has somehow lost its flag - an old row, a
  // select that did not ask for the column, a half-built object - still counts
  // and still reaches its client. We are preventing a test deal being treated
  // as real, never the reverse.
  it('anything unknown is a real deal', () => {
    expect(isTestDeal({})).toBe(false)
    expect(isTestDeal(null)).toBe(false)
    expect(isTestDeal(undefined)).toBe(false)
    expect(isTestDeal({ is_test: null })).toBe(false)
  })

  it('splits a book into the real ones and the test ones', () => {
    const book = [{ is_test: false }, { is_test: true }, {}, { is_test: true }]
    expect(realDealsOnly(book)).toHaveLength(2)
    expect(testDealsOnly(book)).toHaveLength(2)
    expect(realDealsOnly(null)).toEqual([])
  })
})

describe('where a client email goes', () => {
  it('a real deal emails the client, untouched', () => {
    const r = emailGoesTo({
      deal: { is_test: false },
      clientEmail: 'emma@example.com',
      testerEmail: 'fabio@simplifyfinance.com.au',
    })
    expect(r).toEqual({ to: 'emma@example.com', redirected: false, insteadOf: null })
  })

  // The part that actually matters. Today a test deal with a real-looking
  // address typed into it sends that person a genuine email about a loan they
  // never applied for.
  it('a test deal emails the person testing, never the client', () => {
    const r = emailGoesTo({
      deal: { is_test: true },
      clientEmail: 'emma@example.com',
      testerEmail: 'fabio@simplifyfinance.com.au',
    })
    expect(r.to).toBe('fabio@simplifyfinance.com.au')
    expect(r.redirected).toBe(true)
    expect(r.insteadOf).toBe('emma@example.com')
  })

  it('with nobody to send it to, a test deal sends nothing - it does not fall back to the client', () => {
    const r = emailGoesTo({
      deal: { is_test: true },
      clientEmail: 'emma@example.com',
      testerEmail: '',
    })
    expect(r.to).toBeNull()
    expect(r.redirected).toBe(true)
  })

  it('a redirected email says so in its subject', () => {
    expect(testSubject('Your next steps')).toBe('[TEST DEAL] Your next steps')
  })
})

describe('the rest of the rule', () => {
  it('a test deal records no lender rate', () => {
    expect(recordsRateData({ is_test: true })).toBe(false)
    expect(recordsRateData({ is_test: false })).toBe(true)
  })

  it('only an admin may change the flag, in either direction', () => {
    expect(canChangeTestFlag('admin')).toBe(true)
    expect(canChangeTestFlag('broker')).toBe(false)
    expect(canChangeTestFlag('staff')).toBe(false)
    expect(canChangeTestFlag(null)).toBe(false)
  })

  it('both directions leave a line on the file', () => {
    expect(testFlagNote(true)).toMatch(/counted nowhere/)
    expect(testFlagNote(false)).toMatch(/real deal/)
  })
})
