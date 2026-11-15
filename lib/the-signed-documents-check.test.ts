import { describe, it, expect } from 'vitest'
import {
  checkSignedDocuments, readYesNo, askAboutSigned, NOT_NOMINATED, NOT_DATED,
} from './the-signed-documents-check'
import { differences } from './a-checked-row'

const at = (f: string) => (rows: any[]) => rows.find(r => r.field === f)

const complete = {
  signedBy: ['Daniel Rourke', 'Priya Rourke'],
  signaturesDated: 'yes',
  directDebit: 'CBA 062-000 1234 5678',
  repaymentFrequency: 'Monthly',
  offsetAccount: '',
}
const want = { borrowers: ['Daniel Rourke', 'Priya Rourke'], hasOffset: false }

describe('a complete pack', () => {
  it('has nothing to answer', () => {
    expect(differences(checkSignedDocuments(complete, want))).toHaveLength(0)
  })
})

describe('what sends a pack back to the lender', () => {
  it('somebody did not sign', () => {
    const rows = checkSignedDocuments({ ...complete, signedBy: ['Daniel Rourke'] }, want)
    expect(at('signedBy')(rows).state).toBe('differs')
  })

  it('nobody signed at all', () => {
    const rows = checkSignedDocuments({ ...complete, signedBy: [] }, want)
    const r = at('signedBy')(rows)
    expect(r.says).toBe(NOT_NOMINATED)
    expect(askAboutSigned(r)).toContain('Nobody has signed')
  })

  it('a signature is not dated', () => {
    const rows = checkSignedDocuments({ ...complete, signaturesDated: 'no' }, want)
    expect(at('signaturesDated')(rows).says).toBe(NOT_DATED)
    expect(at('signaturesDated')(rows).state).toBe('differs')
  })

  it('no direct debit account, so the first repayment fails', () => {
    const rows = checkSignedDocuments({ ...complete, directDebit: '' }, want)
    expect(at('directDebit')(rows).says).toBe(NOT_NOMINATED)
    expect(askAboutSigned(at('directDebit')(rows))).toBe('Nothing is nominated for the direct debit.')
  })

  it('no repayment frequency, so the lender picks one', () => {
    const rows = checkSignedDocuments({ ...complete, repaymentFrequency: '' }, want)
    expect(at('repaymentFrequency')(rows).state).toBe('differs')
  })
})

// A BLANK IS THE FINDING HERE, not an absence of information.
describe('a blank is the point', () => {
  it('a missing nomination never reads as "nobody said"', () => {
    const rows = checkSignedDocuments(
      { signedBy: [], signaturesDated: '', directDebit: '', repaymentFrequency: '' }, want)
    expect(rows.every(r => r.state !== 'not stated')).toBe(true)
  })
})

describe('the offset', () => {
  it('is only asked about where the deal records one', () => {
    const rows = checkSignedDocuments(complete, want)
    expect(rows.find(r => r.field === 'offsetAccount')).toBeUndefined()
  })

  it('and then an unnominated account goes to a person', () => {
    const rows = checkSignedDocuments(complete, { ...want, hasOffset: true })
    const r = at('offsetAccount')(rows)
    expect(r.state).toBe('differs')
    expect(askAboutSigned(r)).toContain('the deal records an offset on this loan')
  })

  it('a nominated one is fine', () => {
    const rows = checkSignedDocuments({ ...complete, offsetAccount: '062-000 9999 1111' },
      { ...want, hasOffset: true })
    expect(at('offsetAccount')(rows).state).toBe('matches')
  })
})

describe('reading a yes or a no off a form', () => {
  it('reads the words people write', () => {
    expect(readYesNo('Yes')).toBe(true)
    expect(readYesNo('all dated')).toBe(true)
    expect(readYesNo('No')).toBe(false)
    expect(readYesNo('undated')).toBe(false)
  })

  // NOTHING IS INVENTED. "Could not tell" is a real answer.
  it('and says nothing where it cannot tell', () => {
    expect(readYesNo('')).toBe(null)
    expect(readYesNo('see page 4')).toBe(null)
  })

  it('which the screen shows as could not tell, and still asks about', () => {
    const rows = checkSignedDocuments({ ...complete, signaturesDated: 'see page 4' }, want)
    expect(at('signaturesDated')(rows).says).toBe('Could not tell')
    expect(at('signaturesDated')(rows).state).toBe('differs')
  })
})

// Middle names, order, and the way a lender writes a name are not two people.
describe('names', () => {
  it('a middle name on the pack is the same person', () => {
    const rows = checkSignedDocuments(
      { ...complete, signedBy: ['Daniel James Rourke', 'Priya Rourke'] }, want)
    expect(at('signedBy')(rows).state).toBe('matches')
  })

  it('and so is the other order', () => {
    const rows = checkSignedDocuments(
      { ...complete, signedBy: ['Priya Rourke', 'Daniel Rourke'] }, want)
    expect(at('signedBy')(rows).state).toBe('matches')
  })
})
