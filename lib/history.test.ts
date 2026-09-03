import { describe, it, expect } from 'vitest'
import { monthsBetween, totalHistoryMonths, REQUIRED_HISTORY_MONTHS, stillToConfirm } from './fact-find'

const TODAY = new Date('2026-09-03')

describe('two years of history', () => {
  it('counts a finished period between its two dates', () => {
    expect(monthsBetween('2023-01-15', '2024-01-15', TODAY)).toBe(12)
  })

  it('counts a current period up to today', () => {
    expect(monthsBetween('2025-09-03', '', TODAY)).toBe(12)
  })

  it('is nothing when there is no start date — which is the bug', () => {
    expect(monthsBetween('', '', TODAY)).toBe(0)
  })

  it('never goes backwards', () => {
    expect(monthsBetween('2026-01-01', '2025-01-01', TODAY)).toBe(0)
  })

  it('adds the periods up', () => {
    expect(totalHistoryMonths([
      { isCurrent: true, startDate: '2025-09-03' },
      { isCurrent: false, startDate: '2023-09-03', endDate: '2025-09-03' },
    ], TODAY)).toBe(36)
  })
})

// NOT WORKING IS HISTORY TOO. The form hid the dates on a not-working entry, so
// these applicants sat permanently at "0 months recorded" with nothing they
// could do about it. Fabio, 3 Sep 2026: "we need to establish 24 months of
// history not working as well."
describe('an applicant who is not working', () => {
  const natasha = (startDate: string) => ({
    fact_find_data: { applicants: [{
      firstName: 'Natasha', lastName: 'Chapman', dob: '1974-08-02',
      phoneMobile: '0400 000 000',
      addresses: [{ isCurrent: true, address: '1 Test St', residentialStatus: 'Owner',
                    startDate: '2020-01-01' }],
      employment: [{ isCurrent: true, employmentPriority: 'Primary',
                     employmentType: 'Not working', startDate }],
      income: [],
    }] },
    bc_data: {},
  })

  it('counts the time not working towards the 24 months', () => {
    const emp = natasha('2022-09-03').fact_find_data.applicants[0].employment
    expect(totalHistoryMonths(emp, TODAY)).toBe(48)
  })

  it('asks for the date they stopped working, not for an employer', () => {
    const out = stillToConfirm(natasha(''))
    expect(out.join(' ')).toContain('the date they stopped working')
    expect(out.join(' ')).not.toContain('employer')
    expect(out.join(' ')).not.toContain('occupation')
    expect(out.join(' ')).not.toContain('no income recorded')
  })

  it('stops asking once the date is there', () => {
    const out = stillToConfirm(natasha('2022-09-03'))
    expect(out.join(' ')).not.toContain('stopped working')
    expect(out.join(' ')).not.toContain('months of employment history')
  })

  // The form already warns about the 24 months, in amber, under the entries it
  // is counting. Repeating it here would be a second warning about the same
  // thing on the same screen.
  it('leaves the 24-month total to the warning already on the form', () => {
    const out = stillToConfirm(natasha('2026-01-03'))
    expect(out.join(' ')).not.toContain('months of employment history')
    expect(totalHistoryMonths(natasha('2026-01-03').fact_find_data.applicants[0].employment, TODAY))
      .toBeLessThan(REQUIRED_HISTORY_MONTHS)
  })
})
