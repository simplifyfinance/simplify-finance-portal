// THE WEEK, AND THE LIST THAT HAS TO BE KEPT.
//
// 23 Oct 2026. "there is weekends. So don't do that on the weekend. So it's
// 7:30 Monday to Friday."
import { describe, it, expect } from 'vitest'
import {
  isWorkday, isWeekend, holidayName, whyNoPlan, dayBefore, lastWorkdayBefore,
  lastKnownHoliday, NSW_HOLIDAYS,
} from './the-week'

describe('what counts as a working day', () => {
  it('Monday to Friday is', () => {
    // 19-23 Oct 2026 is a Monday to a Friday.
    for (const d of ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']) {
      expect(isWorkday(d), `${d} should be a working day`).toBe(true)
    }
  })

  it('Saturday and Sunday are not', () => {
    expect(isWeekend('2026-10-24')).toBe(true)
    expect(isWeekend('2026-10-25')).toBe(true)
    expect(isWorkday('2026-10-24')).toBe(false)
    expect(isWorkday('2026-10-25')).toBe(false)
  })

  it('and nor is a NSW public holiday that falls midweek', () => {
    // Australia Day 2026 is a Monday.
    expect(isWeekend('2026-01-26')).toBe(false)
    expect(isWorkday('2026-01-26')).toBe(false)
    expect(holidayName('2026-01-26')).toBe('Australia Day')
  })

  it('says why, in the words the screen uses', () => {
    expect(whyNoPlan('2026-10-24')).toBe('the weekend')
    expect(whyNoPlan('2026-12-25')).toBe('Christmas Day')
    expect(whyNoPlan('2026-10-23')).toBeNull()
  })

  it('the August bank holiday is a working day here', () => {
    // Banks and certain financial institutions only. We work it, so it is
    // deliberately not on the list.
    expect(isWorkday('2026-08-03')).toBe(true)
  })
})

describe('yesterday, as a person means it', () => {
  it('Monday looks back to Friday, never to Sunday', () => {
    // 26 Oct 2026 is a Monday.
    expect(dayBefore('2026-10-26')).toBe('2026-10-25')
    expect(lastWorkdayBefore('2026-10-26')).toBe('2026-10-23')
  })

  it('an ordinary Wednesday looks back to Tuesday', () => {
    expect(lastWorkdayBefore('2026-10-21')).toBe('2026-10-20')
  })

  it('and the Tuesday after a long weekend looks back to Friday', () => {
    // Labour Day 2026 is Monday 5 October.
    expect(holidayName('2026-10-05')).toBe('Labour Day')
    expect(lastWorkdayBefore('2026-10-06')).toBe('2026-10-02')
  })

  it('Christmas week does not land on a holiday', () => {
    // 29 Dec 2026 is a Tuesday; the 28th is the Boxing Day holiday.
    expect(lastWorkdayBefore('2026-12-29')).toBe('2026-12-24')
  })
})

// THE ONE THAT NAGS.
//
// A holiday list nobody updates is worse than no list: the portal would start
// calling Christmas an ordinary working day and flag four people for not
// planning a day nobody was at work for. This fails sixty days before the list
// runs out, while there is time to fix it calmly.
describe('the holiday list has not run out', () => {
  it('covers at least sixty days from today', () => {
    const last = lastKnownHoliday()
    const runway = (new Date(`${last}T00:00:00Z`).getTime() - Date.now()) / 86_400_000
    expect(runway, `The NSW holiday list in lib/the-week.ts ends on ${last}. `
      + 'Add next year from nsw.gov.au/about-nsw/public-holidays - the dates move, '
      + 'so copy them, do not work them out.').toBeGreaterThan(60)
  })

  it('and every date on it is a real date, written the one way', () => {
    for (const day of Object.keys(NSW_HOLIDAYS)) {
      expect(day, `${day} is not written as YYYY-MM-DD`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10), `${day} is not a real date`).toBe(day)
      expect(NSW_HOLIDAYS[day].length, `${day} has no name`).toBeGreaterThan(3)
    }
  })
})
