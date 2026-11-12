// THE WEEK A DEAL IS MEANT TO LODGE IN.
//
// Alan's item 1. Fabio: "Alan sets the week in conjunction with brokers", and
// "I want both what we got done and what we have sitting."
import { describe, it, expect } from 'vitest'
import {
  ANSWERS, mondayOf, ymd, weeksFromNow, weekLabel, weekForAnswer, patchForAnswer, answerOf,
  standingOf, daysOver, tabOf, onTab, tabCounts,
} from './lodging-when'
import { doneThisWeek, sittingNow } from './the-week-so-far'

// Tuesday 10 November 2026. Its Monday is the 9th.
const TUE = new Date(2026, 10, 10)
const MON = '2026-11-09'
const NEXT = '2026-11-16'

describe('a week is a date, not a word', () => {
  it('finds the Monday of whatever week a day falls in', () => {
    expect(mondayOf(TUE)).toBe(MON)
    expect(mondayOf(new Date(2026, 10, 9))).toBe(MON)      // the Monday itself
    expect(mondayOf(new Date(2026, 10, 15))).toBe(MON)     // Sunday belongs to it
    expect(mondayOf(new Date(2026, 10, 16))).toBe(NEXT)
  })

  it('counts whole weeks either way', () => {
    expect(weeksFromNow(MON, TUE)).toBe(0)
    expect(weeksFromNow(NEXT, TUE)).toBe(1)
    expect(weeksFromNow('2026-11-02', TUE)).toBe(-1)
    expect(weeksFromNow('', TUE)).toBe(null)
  })

  // THE WHOLE REASON THE DATE IS STORED. The label is worked out against
  // today, so a week that was "this week" when somebody set it reads as last
  // week on Monday morning without anybody touching the record.
  it('names it against today, never against when it was set', () => {
    expect(weekLabel(MON, TUE)).toBe('This week — 9 to 13 Nov')
    expect(weekLabel(NEXT, TUE)).toBe('Next week — 16 to 20 Nov')
    expect(weekLabel(MON, new Date(2026, 10, 17))).toBe('Last week — 9 to 13 Nov')
    expect(weekLabel(MON, new Date(2026, 10, 24))).toBe('2 weeks ago — 9 to 13 Nov')
  })
})

describe('the three answers', () => {
  // Fabio, 17 Nov 2026: "'Later' makes no sense, it is either this week, next,
  // or client." There were four until then.
  it('are the only three offered', () => {
    expect(ANSWERS.map(a => a.key)).toEqual(['this', 'next', 'client'])
  })

  it('turn into a Monday, or into no week at all', () => {
    expect(weekForAnswer('this', TUE)).toBe(MON)
    expect(weekForAnswer('next', TUE)).toBe(NEXT)
    expect(weekForAnswer('client', TUE)).toBe(null)
  })

  // "Client" is an answer. Without it every deal waiting on somebody else sits
  // in No week set looking like an oversight.
  it('are each written down as what they are', () => {
    expect(patchForAnswer('this', TUE)).toEqual({ lodgement_plan: 'week', lodgement_week: MON })
    expect(patchForAnswer('client', TUE)).toEqual({ lodgement_plan: 'client', lodgement_week: null })
  })

  it('never write the retired answer', () => {
    for (const a of ANSWERS) {
      expect(patchForAnswer(a.key, TUE).lodgement_plan).not.toBe('later')
    }
  })

  it('light the button the deal is actually on', () => {
    expect(answerOf({ lodgement_plan: 'week', lodgement_week: MON }, TUE)).toBe('this')
    expect(answerOf({ lodgement_plan: 'week', lodgement_week: NEXT }, TUE)).toBe('next')
    expect(answerOf({ lodgement_plan: 'client' }, TUE)).toBe('client')
    expect(answerOf({}, TUE)).toBe(null)
    // A week that has gone past lights nothing - it is not "this week" any more.
    expect(answerOf({ lodgement_plan: 'week', lodgement_week: '2026-11-02' }, TUE)).toBe(null)
  })

  // THE DEALS ALREADY PARKED ON "LATER" MUST COME BACK. They were invisible on
  // every tab while the answer existed. Leaving them there after it is removed
  // would hide them for good.
  it('bring a deal still carrying "later" back to No week set', () => {
    const parked = { id: 'd', status: 'active', stage: 'pre_lodgement', lodgement_plan: 'later' }
    expect(answerOf(parked, TUE)).toBe(null)
    expect(tabOf(parked, TUE)).toBe('no_week')
  })
})

describe('slipped is the only red', () => {
  const due = (week: string, over: any = {}) =>
    ({ id: 'd', lodgement_plan: 'week', lodgement_week: week, ...over })

  it('is not late inside the week it was promised', () => {
    expect(standingOf(due(MON), TUE)).toBe('to_go')
    expect(daysOver(due(MON), TUE)).toBe(0)
  })

  // Counted from the Friday, because a deal promised for last week is not late
  // on the Monday of it.
  it('counts from the Friday of the week it was due', () => {
    const after = new Date(2026, 10, 17)                  // Tuesday the 17th
    expect(standingOf(due(MON), after)).toBe('slipped')
    expect(daysOver(due(MON), after)).toBe(4)             // Fri 13th to Tue 17th
  })

  it('and a deal that lodged is neither', () => {
    expect(standingOf(due(MON, { lodged_at: '2026-11-10' }), new Date(2026, 10, 17)))
      .toBe('lodged')
  })
})

describe('the three tabs', () => {
  const deal = (over: any) => ({ id: Math.random().toString(36), ...over })
  const WAITING = { bc_completed_at: null }

  const thisWeek = deal({ ...WAITING, lodgement_plan: 'week', lodgement_week: MON })
  const nextWeek = deal({ ...WAITING, lodgement_plan: 'week', lodgement_week: NEXT })
  const noWeek   = deal({ ...WAITING })
  const client   = deal({ ...WAITING, lodgement_plan: 'client' })
  const slipped  = deal({ ...WAITING, lodgement_plan: 'week', lodgement_week: '2026-10-26' })
  const lodged   = deal({ lodgement_plan: 'week', lodgement_week: MON, lodged_at: '2026-11-10' })
  const lost     = deal({ ...WAITING, status: 'lost' })
  const ALL = [thisWeek, nextWeek, noWeek, client, slipped, lodged, lost]

  it('puts each deal on one tab, or on none', () => {
    expect(tabOf(thisWeek, TUE)).toBe('this_week')
    expect(tabOf(nextWeek, TUE)).toBe('next_week')
    expect(tabOf(noWeek, TUE)).toBe('no_week')
    // Answered, so not an oversight - and not due in a week either.
    expect(tabOf(client, TUE)).toBe(null)
    // A deal nobody is going to lodge is not pending anything.
    expect(tabOf(lost, TUE)).toBe(null)
  })

  // It is this week's problem now, and a tab it cannot be seen on is a deal
  // nobody chases.
  it('brings a slipped deal onto this week', () => {
    expect(tabOf(slipped, TUE)).toBe('this_week')
  })

  // The week should read as a result rather than emptying itself as it succeeds.
  it('keeps a deal that lodged on the week it was due', () => {
    expect(tabOf(lodged, TUE)).toBe('this_week')
  })

  it('counts each tab for its pill', () => {
    expect(tabCounts(ALL, TUE)).toEqual({ this_week: 3, next_week: 1, no_week: 1 })
  })

  // Chase first, then work in hand, then what is already done.
  it('orders the list by what has to be done about it', () => {
    const order = onTab(ALL, 'this_week', TUE).map(d => standingOf(d, TUE))
    expect(order).toEqual(['slipped', 'to_go', 'lodged'])
  })
})

describe('the week so far, both halves', () => {
  const on = (col: string, day: string) => ({ id: day + col, [col]: day })

  it('counts what crossed a line since Monday', () => {
    const deals = [
      on('lodged_at', '2026-11-09'), on('lodged_at', '2026-11-10'),
      on('lodged_at', '2026-11-06'),                    // last week
      on('settled_at', '2026-11-10'),
    ]
    const done = doneThisWeek(deals, TUE)
    expect(done.find(l => l.key === 'lodged')!.count).toBe(2)
    expect(done.find(l => l.key === 'settled')!.count).toBe(1)
    expect(done.find(l => l.key === 'approved')!.count).toBe(0)
  })

  // THE SAME STRETCH OF LAST WEEK, not the whole of it. On a Tuesday,
  // comparing two days against five makes every week look like a collapse.
  it('compares against the same days of last week', () => {
    const deals = [
      on('lodged_at', '2026-11-02'), on('lodged_at', '2026-11-03'),
      on('lodged_at', '2026-11-05'),                    // Thursday, out of range
    ]
    expect(doneThisWeek(deals, TUE).find(l => l.key === 'lodged')!.lastWeek).toBe(2)
  })

  it('leaves a lost deal out of both', () => {
    const deals = [{ id: 'x', lodged_at: '2026-11-10', status: 'lost' }]
    expect(doneThisWeek(deals, TUE).find(l => l.key === 'lodged')!.count).toBe(0)
  })

  it('says what is standing there, and how long the oldest has been', () => {
    // WRITTEN WITHOUT THE Z, ON PURPOSE. A UTC instant measured against a
    // local midnight is eleven days in London and ten in Sydney, and a test
    // that passes depending on where it runs is not a test.
    const sitting = sittingNow([
      { id: 'a', created_at: '2026-10-30T00:00:00' },
      { id: 'b', created_at: '2026-11-09T00:00:00' },
    ], TUE)
    const pre = sitting.find(l => l.key === 'pre_lodgement')!
    expect(pre.count).toBe(2)
    expect(pre.longest).toBe(11)
  })

  // Settled and lost are finished. Counting them as sitting makes a pile that
  // grows for ever and means nothing.
  it('does not count a finished deal as sitting', () => {
    const sitting = sittingNow([
      { id: 'a', settled_at: '2026-11-02' },
      { id: 'b', status: 'lost' },
    ], TUE)
    expect(sitting.every(l => l.count === 0)).toBe(true)
  })

  it('and nothing in the pile means nothing to report, not nought days', () => {
    expect(sittingNow([], TUE).every(l => l.longest === null)).toBe(true)
  })
})
