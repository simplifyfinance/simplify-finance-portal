// THE BUTTON THAT DID NOTHING.
//
// 14 Nov 2026. "That is my week" at the bottom of the broker's Monday screen
// was a <span> dressed as a solid dark button. Fabio: "Why would I leave a
// button fake?"
//
// These tests pin two things that have each cost a day this week:
//
//   1. THE WEEK IS SYDNEY'S WEEK. Every fixture below is a UTC instant that
//      falls on a DIFFERENT calendar day in London than it does in the office.
//      Read the machine's clock and half of them come back as last week.
//
//   2. A MARK THE OFFICE CAN READ. Pressed, and when. Not pressed is not the
//      same as nothing to report, and the whole point of the mark is telling
//      those two apart.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  dayInSydney, mondayInSydney, wentThrough, wentThroughAt,
  donePatch, weekMark, buttonWords, toldAtWords,
} from './went-through-the-week'

// Every one of these was checked against Australia/Sydney before it was
// written down, and the office day is in the name.
const MON_0842   = '2026-11-15T21:42:00Z'  // Mon 16 Nov, 8:42 am  (UTC says Sunday)
const SUN_2200   = '2026-11-15T11:00:00Z'  // Sun 15 Nov, 10:00 pm
const SAT_1830   = '2026-11-14T07:30:00Z'  // Sat 14 Nov, 6:30 pm
const WED_1000   = '2026-11-17T23:00:00Z'  // Wed 18 Nov, 10:00 am (UTC says Tuesday)
const NEXT_MON   = '2026-11-22T22:00:00Z'  // Mon 23 Nov, 9:00 am  (UTC says Sunday)
const WINTER_MON = '2026-06-14T22:15:00Z'  // Mon 15 Jun, 8:15 am  (UTC+10, not +11)
const WINTER_SUN = '2026-06-21T13:59:00Z'  // Sun 21 Jun, 11:59 pm

const at = (iso: string) => new Date(iso)

describe('the week is the office\'s week', () => {
  it('reads the office day, not the machine day', () => {
    // 9:42pm UTC on a Sunday is already Monday morning in the office.
    expect(dayInSydney(MON_0842)).toBe('2026-11-16')
    expect(dayInSydney(WED_1000)).toBe('2026-11-18')
  })

  it('Monday morning in the office is THIS Monday, not last', () => {
    expect(mondayInSydney(at(MON_0842))).toBe('2026-11-16')
  })

  it('Sunday night belongs to the week that is ending', () => {
    expect(mondayInSydney(at(SUN_2200))).toBe('2026-11-09')
    expect(mondayInSydney(at(SAT_1830))).toBe('2026-11-09')
  })

  // SYDNEY IS +11 IN NOVEMBER AND +10 IN JUNE. A fixed offset is wrong for
  // half the year and only shows up in one season - see CLAUDE.md.
  it('and it is right in the other half of the year too', () => {
    expect(mondayInSydney(at(WINTER_MON))).toBe('2026-06-15')
    expect(mondayInSydney(at(WINTER_SUN))).toBe('2026-06-15')
  })

  it('an empty or unreadable value is not a date', () => {
    expect(dayInSydney(null)).toBe(null)
    expect(dayInSydney('')).toBe(null)
    expect(dayInSydney('not a date')).toBe(null)
  })
})

describe('has he been through it this week', () => {
  const pressed = { week_done_at: MON_0842 }

  it('yes, on the Monday he pressed it', () => {
    expect(wentThrough(pressed, at(MON_0842))).toBe(true)
  })

  it('and still yes on the Wednesday', () => {
    expect(wentThrough(pressed, at(WED_1000))).toBe(true)
  })

  // IT CLEARS ITSELF. Nothing resets the column on a Monday morning; the
  // question is only ever "was it this week".
  it('no, once the next week has started', () => {
    expect(wentThrough(pressed, at(NEXT_MON))).toBe(false)
  })

  it('last Sunday night does not count for the new week', () => {
    expect(wentThrough({ week_done_at: SUN_2200 }, at(MON_0842))).toBe(false)
  })

  it('never pressed is not pressed', () => {
    expect(wentThrough({}, at(WED_1000))).toBe(false)
    expect(wentThrough({ week_done_at: null }, at(WED_1000))).toBe(false)
    expect(wentThrough(null, at(WED_1000))).toBe(false)
  })
})

describe('what it writes', () => {
  it('one field, so it cannot clear anything else', () => {
    const patch = donePatch(at(MON_0842))
    expect(Object.keys(patch)).toEqual(['week_done_at'])
    // The moment, spelled the way the database keeps it: UTC, to the
    // millisecond. Turning it back into the office's day is reading's job.
    expect(patch.week_done_at).toBe('2026-11-15T21:42:00.000Z')
    expect(dayInSydney(patch.week_done_at)).toBe('2026-11-16')
  })
})

describe('what each side shows', () => {
  const pressed = { week_done_at: MON_0842 }

  it('the time is the office clock, not the machine', () => {
    expect(wentThroughAt(pressed, at(WED_1000))).toBe('8:42 am')
  })

  it('and nothing is shown for a week he has not answered', () => {
    expect(wentThroughAt(pressed, at(NEXT_MON))).toBe('')
    expect(toldAtWords({}, at(WED_1000))).toBe('')
  })

  it('admin sees whether he went through it, and when', () => {
    expect(weekMark(pressed, at(WED_1000))).toEqual({
      done: true, words: 'Went through it · 8:42 am',
    })
    expect(weekMark({}, at(WED_1000))).toEqual({
      done: false, words: 'Has not been through it',
    })
  })

  // NOTHING ON HIS OWN SCREEN IS A NAG, IN EITHER STATE.
  it('his button never tells him off', () => {
    expect(buttonWords({}, at(WED_1000))).toBe('That is my week')
    expect(buttonWords(pressed, at(WED_1000))).toBe('Told the team')
    for (const row of [{}, pressed]) {
      const words = buttonWords(row, at(WED_1000)).toLowerCase()
      for (const nag of ['not', 'still', 'missing', 'overdue', 'please']) {
        expect(words, `a broker is not chased`).not.toContain(nag)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// THE GUARD THAT WOULD HAVE CAUGHT 13 NOVEMBER
// ---------------------------------------------------------------------------
describe('the file never asks the machine what day it is', () => {
  const RAW = readFileSync('lib/went-through-the-week.ts', 'utf8')

  // IT READS CODE, NOT COMMENTS. 14 Nov 2026: the first version of this guard
  // failed on its own file, because the header explains the fault by naming
  // getDay() and getDate() in prose. scripts/check-one-clock.sh was wrong the
  // same way twice this week. A check that cannot tell an explanation from an
  // instruction is a check somebody eventually switches off.
  const CODE = RAW
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

  it('no local-clock calendar reads', () => {
    for (const banned of ['getDate(', 'getDay(', 'getMonth(', 'getFullYear(']) {
      expect(CODE, `${banned} is the machine's day, not the office's`).not.toContain(banned)
    }
  })

  it('and the zone is the shared one, never spelled out again', () => {
    expect(CODE).toContain("from './same-date-everywhere'")
    expect(CODE).toContain('OFFICE')
    expect(CODE, 'a second copy of the zone name is a second thing to get wrong')
      .not.toContain("'Australia/Sydney'")
  })
})
