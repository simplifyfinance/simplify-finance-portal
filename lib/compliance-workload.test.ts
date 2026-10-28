import { describe, it, expect } from 'vitest'
import {
  countPacks, daysOfMonth, sydneyDay, financialYearStartDay, quarterStartDay, monthStartDay, whyNoRow,
} from './compliance-workload'

// HOW MANY COMPLIANCE PACKS EACH PERSON HAS HAD.
//
// 28 Oct 2026. Fabio: "how many deals person number one and person number two
// are having in that particular month, in that particular day, in that
// particular quarter, in that particular year."
//
// Counted from the deals, so it cannot disagree with the deal card or with the
// allocation on the next push. Invented names.
//
// 28 Oct 2026 is a Wednesday. 31 Oct 2026 is a Saturday.

const ELLESSE = { id: 'u1', name: 'Ellesse Mowbray' }
const ELLIE = { id: 'u2', name: 'Ellie Nakamura' }
const PAIR = [ELLESSE, ELLIE]
const TODAY = '2026-10-28'

const pack = (who: { id: string }, day: string, hour = '03') =>
  ({ userId: who.id, at: `${day}T${hour}:00:00.000Z` })

describe('WHICH DAY A PACK BELONGS TO', () => {
  it('is the day it was in Sydney, not in Greenwich', () => {
    // 9am on a Sydney Monday is 10pm the Sunday before in UTC. Reading the
    // first ten characters of the timestamp would file a whole morning's work
    // under the day before - quietly, and only ever the early ones.
    expect(sydneyDay('2026-10-27T22:00:00.000Z')).toBe('2026-10-28')
    expect(sydneyDay('2026-10-28T02:00:00.000Z')).toBe('2026-10-28')
  })

  it('and nothing at all is not a day', () => {
    for (const bad of ['', null, undefined, 'not a date']) {
      expect(sydneyDay(bad), String(bad)).toBe('')
    }
  })
})

describe('the year this business reports in', () => {
  it('starts on 1 July', () => {
    expect(financialYearStartDay('2026-10-28')).toBe('2026-07-01')
    expect(financialYearStartDay('2026-03-12')).toBe('2025-07-01')
    expect(financialYearStartDay('2026-07-01')).toBe('2026-07-01')
    expect(financialYearStartDay('2026-06-30')).toBe('2025-07-01')
  })

  it('and its quarters run July, October, January, April', () => {
    expect(quarterStartDay('2026-08-15')).toBe('2026-07-01')
    expect(quarterStartDay('2026-10-28')).toBe('2026-10-01')
    expect(quarterStartDay('2027-02-03')).toBe('2027-01-01')
    expect(quarterStartDay('2027-05-20')).toBe('2027-04-01')
  })

  it('and a month starts on the first', () => {
    expect(monthStartDay('2026-10-28')).toBe('2026-10-01')
  })
})

describe('the four numbers per person', () => {
  const rows = [
    ...Array.from({ length: 5 }, () => pack(ELLESSE, TODAY)),
    ...Array.from({ length: 2 }, () => pack(ELLIE, TODAY)),
    pack(ELLESSE, '2026-10-12'),          // earlier this month and quarter
    pack(ELLESSE, '2026-08-03'),          // this financial year, last quarter
    pack(ELLESSE, '2026-05-04'),          // LAST financial year
    pack(ELLIE, '2026-10-01'),
  ]
  const [one, two] = countPacks(rows, PAIR, TODAY)

  it('today counts only today', () => {
    expect(one.today).toBe(5)
    expect(two.today).toBe(2)
  })

  it('the month counts from the first', () => {
    expect(one.month).toBe(6)
    expect(two.month).toBe(3)
  })

  it('the quarter counts from 1 October', () => {
    expect(one.quarter).toBe(6)
    expect(two.quarter).toBe(3)
  })

  it('AND THE YEAR STOPS AT 1 JULY, NOT 1 JANUARY', () => {
    // The May one is last financial year and must not be in it.
    expect(one.year).toBe(7)
    expect(two.year).toBe(3)
  })

  it('and the two from Settings are shown in order, even on an empty day', () => {
    const empty = countPacks([], PAIR, TODAY)
    expect(empty.map(p => p.name)).toEqual(['Ellesse Mowbray', 'Ellie Nakamura'])
    expect(empty[0].today).toBe(0)
  })
})

describe('SOMEBODY ELSE WHO ENDED UP WITH ONE IS STILL COUNTED', () => {
  // A deal reassigned to a third person. A workload page that hides work
  // somebody did is worse than one with an extra row.
  const third = { userId: 'u3', name: 'Marcus Oyelaran', at: `${TODAY}T03:00:00.000Z` }
  const out = countPacks([third], PAIR, TODAY)

  it('is added after the pair, not dropped', () => {
    expect(out).toHaveLength(3)
    expect(out[2].name).toBe('Marcus Oyelaran')
    expect(out[2].today).toBe(1)
  })

  it('and takes their name from the deal when Settings has never heard of them', () => {
    expect(out[2].id).toBe('u3')
  })
})

describe('a row with nothing on it counts for nothing', () => {
  it('no person, no day, no row', () => {
    const junk = [{ userId: '', at: `${TODAY}T03:00:00Z` }, { userId: 'u1', at: '' }, {}]
    const out = countPacks(junk as any, PAIR, TODAY)
    expect(out[0].today).toBe(0)
    expect(out).toHaveLength(2)
  })

  it('and no rows at all is noughts, not a crash', () => {
    expect(countPacks(null as any, PAIR, TODAY)[0].year).toBe(0)
  })
})

describe('every working day of the month', () => {
  const rows = [
    ...Array.from({ length: 5 }, () => pack(ELLESSE, TODAY)),
    ...Array.from({ length: 2 }, () => pack(ELLIE, TODAY)),
    pack(ELLESSE, '2026-10-27'),
  ]
  const days = daysOfMonth(rows, TODAY)

  it('newest first, so today is at the top', () => {
    expect(days[0].day).toBe(TODAY)
    expect(days[0].total).toBe(7)
    expect(days[0].counts['u1']).toBe(5)
    expect(days[0].counts['u2']).toBe(2)
  })

  it('and it stops at today rather than printing the rest of the month', () => {
    expect(days.some(d => d.day > TODAY)).toBe(false)
  })

  it('WEEKENDS AND PUBLIC HOLIDAYS ARE NOT ROWS', () => {
    // 3, 4, 10, 11, 17, 18, 24, 25 October 2026 are weekends, and the 5th is
    // Labour Day. A line of noughts only invites somebody to wonder what went
    // wrong that day.
    for (const quiet of ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-25']) {
      expect(days.some(d => d.day === quiet), `${quiet} should not be a row`).toBe(false)
    }
  })

  it('but a day somebody really did send one on IS a row, weekend or not', () => {
    // It happened. Hiding it would lose work somebody did.
    const sat = daysOfMonth([pack(ELLESSE, '2026-10-24')], TODAY)
    expect(sat.some(d => d.day === '2026-10-24')).toBe(true)
  })

  it('and a working day with nothing on it is still a row', () => {
    // The gap is the point - it says nothing went out that day.
    const quietTuesday = days.find(d => d.day === '2026-10-20')
    expect(quietTuesday).toBeTruthy()
    expect(quietTuesday!.total).toBe(0)
  })

  it('and it says why a day is missing', () => {
    expect(whyNoRow('2026-10-05')).toBe('Labour Day')
    expect(whyNoRow('2026-10-25')).toBe('Weekend')
    expect(whyNoRow('2026-10-28')).toBe('')
  })
})
