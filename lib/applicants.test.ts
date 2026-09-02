import { describe, it, expect } from 'vitest'
import { applicantsOf, applicantNamesOf } from './applicants'

describe('who is on the deal', () => {
  const chapman = {
    clients: { first_name: 'Natasha', last_name: 'Chapman' },
    fact_find_data: { applicants: [
      { firstName: 'Natasha', lastName: 'Chapman' },
      { firstName: 'Richard', lastName: 'Chapman' },
    ]},
  }

  it('takes BOTH applicants from the fact find', () => {
    // The bug: compliance read bc.jointFirstName, which the BC never saves, so
    // Richard was dropped from every joint deal.
    expect(applicantNamesOf(chapman, { firstName: 'Natasha', lastName: 'Chapman', joint: 'No' }))
      .toEqual(['Natasha Chapman', 'Richard Chapman'])
  })

  it('does not care what the BC thinks about joint', () => {
    expect(applicantNamesOf(chapman, {})).toHaveLength(2)
    expect(applicantNamesOf(chapman, { joint: 'Yes', jointFirstName: 'Someone' })).toHaveLength(2)
  })

  it('falls back to the BC when the fact find is empty', () => {
    expect(applicantNamesOf({ fact_find_data: {} }, { firstName: 'Solo', lastName: 'Buyer' }))
      .toEqual(['Solo Buyer'])
  })

  it('falls back to the client record when the BC is empty too', () => {
    expect(applicantNamesOf({ clients: { first_name: 'Solo', last_name: 'Buyer' } }, {}))
      .toEqual(['Solo Buyer'])
  })

  it('never hands back an empty list', () => {
    expect(applicantNamesOf({}, {})).toEqual(['Applicant 1'])
    expect(applicantNamesOf(null, null)).toEqual(['Applicant 1'])
  })

  it('ignores a half-filled applicant row', () => {
    const d = { fact_find_data: { applicants: [{ firstName: 'Natasha', lastName: 'Chapman' }, { firstName: '', lastName: '' }] } }
    expect(applicantNamesOf(d, {})).toEqual(['Natasha Chapman'])
  })

  it('copes with a first name and no surname', () => {
    const d = { fact_find_data: { applicants: [{ firstName: 'Prince' }] } }
    expect(applicantNamesOf(d, {})).toEqual(['Prince'])
  })

  it('counts the same person once', () => {
    const d = { fact_find_data: { applicants: [{ firstName: 'A', lastName: 'B' }, { firstName: 'A', lastName: 'B' }] } }
    expect(applicantNamesOf(d, {})).toEqual(['A B'])
  })

  it('marks every one of them as an applicant', () => {
    expect(applicantsOf(chapman, {}).every(a => a.type === 'applicant')).toBe(true)
  })
})
