import { describe, it, expect } from 'vitest'
import { monthsBetween, totalHistoryMonths, REQUIRED_HISTORY_MONTHS, stillToConfirm,
         gapsInHistory, gapInWords } from './fact-find'

const TODAY = new Date('2026-09-03')

// THREE YEARS, NOT TWO.
//
// 27 Oct 2026. Every assertion here reads REQUIRED_HISTORY_MONTHS rather than a
// number, which is why raising it cost nothing. That was luck as much as
// design - a test that had typed 24 would have had to be edited to agree with
// the bug, which is how the LMI figure stayed wrong for five weeks.
describe('three years of history', () => {
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

  it('and the bar is three years, not two', () => {
    expect(REQUIRED_HISTORY_MONTHS).toBe(36)
  })

  it('TWENTY FIVE MONTHS IS NOT ENOUGH ANY MORE', () => {
    // The exact file that kept coming back from credit. Under the old number
    // this read as finished and nobody was warned.
    const twentyFive = [{ isCurrent: true, startDate: '2024-08-03' }]
    expect(totalHistoryMonths(twentyFive, TODAY)).toBe(25)
    expect(totalHistoryMonths(twentyFive, TODAY)).toBeLessThan(REQUIRED_HISTORY_MONTHS)
  })
})

// NOT WORKING IS HISTORY TOO. The form hid the dates on a not-working entry, so
// these applicants sat permanently at "0 months recorded" with nothing they
// could do about it. Fabio, 3 Sep 2026: "we need to establish 24 months of
// history not working as well." The rule he set that day still holds; only the
// number has moved, and it moved because credit kept asking for a third year.
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

  it('counts the time not working towards the three years', () => {
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

  // The form already warns about the shortfall, in red, under the entries it is
  // counting. Repeating it here would be a second warning about the same thing
  // on the same screen.
  it('leaves the total to the warning already on the form', () => {
    const out = stillToConfirm(natasha('2026-01-03'))
    expect(out.join(' ')).not.toContain('months of employment history')
    expect(totalHistoryMonths(natasha('2026-01-03').fact_find_data.applicants[0].employment, TODAY))
      .toBeLessThan(REQUIRED_HISTORY_MONTHS)
  })
})

// A GAP IN THE MIDDLE IS INVISIBLE TO AN ADDITION.
//
// 27 Oct 2026. Fabio: "fix the gap between 2 jobs".
//
// totalHistoryMonths adds the periods up. Three years of work with four months
// missing in the middle comes to thirty-two and reads as "short by four" - and
// those are not the same problem. A lender asks about the HOLE. Nothing in the
// portal could see one.
describe('a hole in the middle', () => {
  const words = (e: any[]) => gapsInHistory(e, TODAY).map(gapInWords)

  it('is found, and named by its months', () => {
    expect(words([
      { isCurrent: true, startDate: '2025-07-03' },
      { startDate: '2023-01-03', endDate: '2025-03-03' },
    ])).toEqual(['March 2025 and July 2025'])
  })

  it('AND THE ADDITION ALONE WOULD HAVE SAID NOTHING WAS WRONG', () => {
    // This is the whole bug. 41 months is past the 36 a lender wants, so the
    // warning on the form went quiet while four months sat unaccounted for.
    const withHole = [
      { isCurrent: true, startDate: '2025-07-03' },
      { startDate: '2023-01-03', endDate: '2025-03-03' },
    ]
    expect(totalHistoryMonths(withHole, TODAY)).toBeGreaterThan(REQUIRED_HISTORY_MONTHS)
    expect(gapsInHistory(withHole, TODAY)).toHaveLength(1)
  })

  it('two holes are two questions, not one', () => {
    expect(words([
      { isCurrent: true, startDate: '2026-06-03' },
      { startDate: '2025-01-03', endDate: '2025-09-03' },
      { startDate: '2024-01-03', endDate: '2024-06-03' },
    ])).toEqual(['June 2024 and January 2025', 'September 2025 and June 2026'])
  })

  it('and an unbroken run has none', () => {
    expect(words([
      { isCurrent: true, startDate: '2025-03-03' },
      { startDate: '2023-01-03', endDate: '2025-03-03' },
    ])).toEqual([])
  })

  it('jobs that overlap are not a gap', () => {
    // Somebody who started the new one before finishing the old.
    expect(words([
      { isCurrent: true, startDate: '2025-01-03' },
      { startDate: '2023-01-03', endDate: '2025-06-03' },
    ])).toEqual([])
  })
})

describe('a hole at the end', () => {
  it('counts, because it is usually an answer nobody wrote down', () => {
    // "She stopped work in March" is a fact about the file. A blank is not.
    expect(gapsInHistory([{ startDate: '2022-01-03', endDate: '2026-03-03' }], TODAY)
      .map(gapInWords)).toEqual(['March 2026 and September 2026'])
  })
})

describe('a hole at the start', () => {
  it('is NOT reported where the history is already short', () => {
    // The earliest stretch IS the shortfall there, and the total already says
    // "24 of the 36 a lender needs". Saying it twice helps nobody.
    const short = [{ isCurrent: true, startDate: '2024-10-03' }]
    expect(totalHistoryMonths(short, TODAY)).toBeLessThan(REQUIRED_HISTORY_MONTHS)
    expect(gapsInHistory(short, TODAY)).toEqual([])
  })

  it('but IS reported where old history pushes the total over the line', () => {
    // A job in 2015 and a job from last year add up to eighty months, so the
    // shortfall warning says nothing at all - and the four months at the start
    // of the window are a real hole a lender will ask about. I missed this in
    // my own check of the function and only found it by printing the cases out.
    //
    // TODAY in this file is 3 Sep 2026, so the window opens in September 2023.
    const oldAndNew = [
      { isCurrent: true, startDate: '2024-01-03' },
      { startDate: '2015-01-03', endDate: '2019-01-03' },
    ]
    expect(totalHistoryMonths(oldAndNew, TODAY)).toBeGreaterThan(REQUIRED_HISTORY_MONTHS)
    expect(gapsInHistory(oldAndNew, TODAY).map(gapInWords)).toEqual(['September 2023 and January 2024'])
  })
})

describe('nothing is invented', () => {
  it('no entries, no gaps', () => {
    expect(gapsInHistory([], TODAY)).toEqual([])
    expect(gapsInHistory(null, TODAY)).toEqual([])
    expect(gapsInHistory(undefined, TODAY)).toEqual([])
  })

  it('an entry with no start date is left out rather than guessed at', () => {
    expect(gapsInHistory([{ isCurrent: true, startDate: '' }], TODAY)).toEqual([])
  })

  it('and a date nobody can read does not become a gap', () => {
    expect(gapsInHistory([{ isCurrent: true, startDate: 'last winter' }], TODAY)).toEqual([])
  })

  it('a gap entirely before the three years is nobody\'s business', () => {
    expect(gapsInHistory([
      { isCurrent: true, startDate: '2019-01-03' },
      { startDate: '2010-01-03', endDate: '2014-01-03' },
    ], TODAY)).toEqual([])
  })
})
