// THE CLOCK IS SYDNEY'S, WHEREVER THE CODE IS RUNNING.
//
// 13 Nov 2026, past midnight. Katie's compliance card was saved at 10:02am
// Sydney time. The database records that as 23:02 the previous day, because it
// keeps UTC. Nothing turned it back, so I read it as "last night", told Fabio
// his staff had been working at eleven at night, and sent an entire
// investigation in the wrong direction. He had to stop me twice.
//
// Fabio: "the fact that the UTC on the Superbase is not matching the portal,
// it's not a thing. So fix that... I don't want to have this issue again."
//
// STORING UTC IS CORRECT AND DOES NOT CHANGE. What changes is that nothing
// reaches a human without being turned back into the office's day first.
//
// These tests pin the moment that caused it. They do not check that the word
// "timeZone" appears somewhere - scripts/check-one-clock.sh counts that. They
// check that the answer is right.
import { describe, it, expect } from 'vitest'
import { dayMonthYear, dayMonth, longDate, dayMonthTime, nowInSydney, OFFICE }
  from './same-date-everywhere'
import { draftWhen } from './draft-store'

// 12 Nov 2026 23:02:43 UTC. In Sydney that is 13 Nov, 10:02am - the morning,
// not the night before. This exact instant is the one that cost an hour.
const KATIE_SAVED = '2026-11-12T23:02:43.000Z'

describe('the moment that started all this', () => {
  it('is the 13th in Sydney, not the 12th', () => {
    expect(dayMonthYear(KATIE_SAVED)).toBe('13 Nov 2026')
    expect(dayMonth(KATIE_SAVED)).toBe('13 Nov')
    expect(longDate(KATIE_SAVED)).toBe('13 November 2026')
  })

  it('and it is ten past ten in the morning, not two minutes past eleven at night', () => {
    expect(dayMonthTime(KATIE_SAVED)).toBe('13 Nov, 10:02 am')
  })
})

describe('the office is named, once', () => {
  it('and it is Sydney', () => {
    expect(OFFICE).toBe('Australia/Sydney')
  })
})

// THE SERVERS RUN ON UTC AND THE OFFICE DOES NOT. Every one of these is a real
// instant that falls on a different DAY depending on which clock reads it.
describe('a day boundary is the office\'s, not the machine\'s', () => {
  const cases: Array<[string, string, string]> = [
    // UTC instant                 what Sydney calls it   why it matters
    ['2026-11-12T13:00:00.000Z', '13 Nov 2026', 'midnight Sydney, start of the next day'],
    ['2026-11-12T12:59:59.000Z', '12 Nov 2026', 'one second before it'],
    ['2026-06-30T14:00:00.000Z', '01 Jul 2026', 'the start of a financial year, in winter time'],
    ['2026-06-30T13:59:59.000Z', '30 Jun 2026', 'one second before THAT'],
  ]
  for (const [utc, sydney, why] of cases) {
    it(`${utc} is ${sydney} - ${why}`, () => {
      expect(dayMonthYear(utc)).toBe(sydney)
    })
  }
})

// DAYLIGHT SAVING IS WHY THE ZONE IS NAMED AND NOT AN OFFSET. Sydney is UTC+11
// in November and UTC+10 in June. A hardcoded +10 or +11 is wrong for half the
// year, which is worse than the bug being fixed because it only shows up in
// one season.
describe('summer and winter', () => {
  it('November is eleven hours ahead', () => {
    expect(dayMonthTime('2026-11-13T00:00:00.000Z')).toBe('13 Nov, 11:00 am')
  })

  it('June is ten', () => {
    expect(dayMonthTime('2026-06-13T00:00:00.000Z')).toBe('13 Jun, 10:00 am')
  })
})

// A DATE SOMEBODY TYPED IS DIGITS, NOT A MOMENT IN TIME. A settlement date of
// 2026-11-13 is the 13th in every country, and reading it as midnight UTC and
// then converting would hand half the world the 12th.
describe('a plain date is left exactly as it was typed', () => {
  it('whatever the machine thinks', () => {
    expect(dayMonthYear('2026-11-13')).toBe('13 Nov 2026')
    expect(dayMonthYear('2026-01-01')).toBe('01 Jan 2026')
    expect(dayMonthYear('2026-12-31')).toBe('31 Dec 2026')
  })
})

describe('and nothing invents a date it does not have', () => {
  for (const empty of ['', null, undefined, 'not a date']) {
    it(`${JSON.stringify(empty)} prints nothing`, () => {
      expect(dayMonthYear(empty as any)).toBe('')
      expect(dayMonthTime(empty as any)).toBe('')
    })
  }
})

describe('the clock on its own', () => {
  it('reads as the office reads it', () => {
    expect(nowInSydney(new Date(KATIE_SAVED))).toBe('10:02 am')
    expect(nowInSydney(new Date('2026-11-12T13:00:00.000Z'))).toBe('12:00 am')
    expect(nowInSydney(new Date('2026-11-13T01:00:00.000Z'))).toBe('12:00 pm')
  })
})

// AND THE PLACES THAT TELL SOMEBODY WHEN THEIR OWN WORK WAS KEPT.
describe('a draft says when it was kept, in Sydney', () => {
  it('on another day, it names that day', () => {
    const kept = new Date(KATIE_SAVED).getTime()
    // Two days later, so it is not "today" and the date is printed.
    const now = new Date('2026-11-15T03:00:00.000Z').getTime()
    expect(draftWhen(kept, now)).toContain('13 Nov')
  })
})
