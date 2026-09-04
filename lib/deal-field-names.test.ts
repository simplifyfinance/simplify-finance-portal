import { describe, it, expect } from 'vitest'
import { humanise, describePath, describePaths } from './deal-field-names'

describe('a field name a broker would recognise', () => {
  it('breaks up the way we write field names', () => {
    expect(humanise('grossSalaryFrequency')).toBe('Gross salary frequency')
    expect(humanise('purchasePrice')).toBe('Purchase price')
  })

  it('leaves the words this business shouts alone', () => {
    expect(humanise('lvrPercent')).toBe('LVR percent')
    expect(humanise('lmiApplicable')).toBe('LMI applicable')
    expect(humanise('employerAbn')).toBe('Employer ABN')
    expect(humanise('hecs')).toBe('HECS')
  })

  it('uses the name the field actually goes by here', () => {
    expect(humanise('needsPrimary')).toBe('Primary reasons for seeking credit')
    expect(humanise('applicationSubmissionComment')).toBe('Application submission notes')
    expect(humanise('purchasePropertySubtype')).toBe('House or strata')
  })
})

describe('where in the record', () => {
  it('counts rows from one and names one of them', () => {
    expect(describePath(['applicants', 0, 'firstName'])).toBe('Applicant 1 - First name')
    expect(describePath(['applicants', 1, 'income', 1, 'grossSalary']))
      .toBe('Applicant 2 - Income 2 - Gross salary')
    expect(describePath(['lenders', 0, 'variablePI', 'rate'])).toBe('Lender option 1 - Variable P&I - Rate')
  })

  it('has something to say about the whole record', () => {
    expect(describePath([])).toBe('this tab')
  })
})

describe('a list of them, for a banner', () => {
  it('reads like a sentence', () => {
    expect(describePaths([['dependants']])).toBe('Dependants')
    expect(describePaths([['dependants'], ['loanPurpose']])).toBe('Dependants and Loan purpose')
    expect(describePaths([['dependants'], ['loanPurpose'], ['internalNotes']]))
      .toBe('Dependants, Loan purpose and Internal notes')
  })

  it('stops before it becomes a wall of text', () => {
    expect(describePaths([['a'], ['b'], ['c'], ['d'], ['e']])).toBe('A, B and C, and 2 more')
  })

  it('does not say the same field twice', () => {
    expect(describePaths([['dependants'], ['dependants']])).toBe('Dependants')
  })
})
