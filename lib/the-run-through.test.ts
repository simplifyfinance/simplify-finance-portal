// THE MONDAY MEETING, WITHOUT THE SPREADSHEET.
//
// Invented client names throughout.
import { describe, it, expect } from 'vitest'
import {
  SEATS, SLIPPING_DAYS, inTeam, isSlipping, notInTeam, runThrough, seatCounts, seatOf,
  theirOwnBook, bySection, carriedOver, couldLodge, matches, readTarget, unansweredDays,
  weekSoFar,
  worthOf,
} from './the-run-through'
import { mondayOf } from './lodging-when'

// Wednesday, so "this week" started two days ago.
const NOW = new Date('2026-11-18T09:00:00+11:00')
const MONDAY = mondayOf(NOW)
const ago = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString()

// Far enough along to be worth a meeting - see couldLodge(). Everything in
// these tests has compliance out unless it says otherwise.
const deal = (over: any = {}) => ({
  id: 'd', deal_name: 'A deal', assigned_broker: 'mark', stage: 'Compliance',
  created_at: ago(5), loan_amount: 500_000,
  // The clock the meeting counts from is when the deal became discussable, so
  // a fixture that sets created_at is setting that too.
  compliance_sent_at: over.created_at ?? ago(4),
  ...over,
})
const said = (key: 'this' | 'next' | 'client', over: any = {}) =>
  key === 'client'
    ? deal({ lodgement_plan: 'client', ...over })
    : deal({
      lodgement_plan: 'week',
      lodgement_week: key === 'this' ? MONDAY
        : new Date(new Date(MONDAY).getTime() + 7 * 86_400_000).toISOString().slice(0, 10),
      ...over,
    })

describe('where a deal sits in the meeting', () => {
  it('is Nobody has said until somebody says', () => {
    expect(seatOf(deal(), NOW)).toBe('nobody')
  })

  it('follows the answer', () => {
    expect(seatOf(said('this'), NOW)).toBe('this_week')
    expect(seatOf(said('next'), NOW)).toBe('next_week')
    expect(seatOf(said('client'), NOW)).toBe('client')
  })

  // ONCE IT IS IN, WHAT SOMEBODY PREDICTED IS HISTORY.
  it('is Lodged once it lodged this week, whatever was predicted', () => {
    expect(seatOf(said('next', { lodged_at: ago(1) }), NOW)).toBe('lodged')
  })

  it('leaves the meeting once it lodged in an earlier week', () => {
    expect(seatOf(deal({ lodged_at: ago(20) }), NOW)).toBe(null)
  })

  it('is never a lost or a settled deal', () => {
    expect(seatOf(deal({ status: 'lost' }), NOW)).toBe(null)
    expect(seatOf(deal({ settled_at: ago(2) }), NOW)).toBe(null)
  })

  it('counts them per seat', () => {
    const c = seatCounts([deal(), deal(), said('this'), said('client')], NOW)
    expect(c.nobody).toBe(2)
    expect(c.this_week).toBe(1)
    expect(c.client).toBe(1)
    expect(SEATS).toHaveLength(5)
  })
})

// "we're trying to do 10 to 12 deals a week. How are we tracking?"
describe('are we going to make twelve', () => {
  const week = (lodged: number, promised: number) => [
    ...Array.from({ length: lodged }, () => deal({ lodged_at: ago(1) })),
    ...Array.from({ length: promised }, () => said('this')),
  ]

  it('adds what is in to what was promised', () => {
    const w = weekSoFar(week(4, 7), NOW)
    expect(w.lodged).toBe(4)
    expect(w.promised).toBe(7)
    expect(w.onTrack).toBe(11)
    expect(w.short).toBe(1)
    expect(w.made).toBe(true)
    expect(w.words).toBe('inside 10–12')
  })

  it('says how far short when the week is light', () => {
    const w = weekSoFar(week(2, 3), NOW)
    expect(w.onTrack).toBe(5)
    expect(w.made).toBe(false)
    expect(w.words).toBe('5 short of 10')
  })

  it('says so at the top of the range', () => {
    expect(weekSoFar(week(6, 6), NOW).words).toBe('at the top of 10–12')
  })

  it('never reports a negative shortfall', () => {
    expect(weekSoFar(week(9, 9), NOW).short).toBe(0)
  })

  it('counts nothing as nothing rather than falling over', () => {
    const w = weekSoFar([], NOW)
    expect(w.onTrack).toBe(0)
    expect(w.made).toBe(false)
  })
})

// THE NUMBER THAT MAKES A MEETING WORTH HAVING.
describe('the one nobody has answered on', () => {
  it('counts days since the deal was ready to be talked about', () => {
    expect(unansweredDays(deal({ created_at: ago(22) }), NOW)).toBe(22)
  })

  it('is nothing once somebody has answered', () => {
    expect(unansweredDays(said('next', { created_at: ago(30) }), NOW)).toBe(null)
  })

  it('flags three weeks of silence', () => {
    expect(isSlipping(deal({ created_at: ago(SLIPPING_DAYS) }), NOW)).toBe(true)
    expect(isSlipping(deal({ created_at: ago(SLIPPING_DAYS - 1) }), NOW)).toBe(false)
    expect(isSlipping(said('this', { created_at: ago(99) }), NOW)).toBe(false)
  })

  it('prefers the day it reached compliance over the day it was created', () => {
    expect(unansweredDays(deal({ created_at: ago(60), compliance_sent_at: ago(4) }), NOW)).toBe(4)
  })
})

describe('the run-through, broker by broker', () => {
  const names = (k: string) => ({ mark: 'Mark Gallo', keanen: 'Keanen Wood' }[k] || k)
  const team = (k: string) =>
    k === 'keanen' ? 'Simplify Finance Brokers' : 'Simplify Finance'

  const deals = [
    deal({ id: 'm1', assigned_broker: 'Mark' }),
    deal({ id: 'm2', assigned_broker: 'Mark', created_at: ago(30) }),
    deal({ id: 'k1', assigned_broker: 'Keanen' }),
  ]

  it('groups by broker and names them from the register', () => {
    const runs = runThrough(deals, 'nobody', names, team, NOW)
    expect(runs.map(r => r.name)).toEqual(['Mark Gallo', 'Keanen Wood'])
    expect(runs[0].total).toBe(2)
    expect(runs[0].toDecide).toBe(2)
  })

  // THE MEETING WORKS DOWN FROM THE WORST.
  it('puts the one nobody has answered on in three weeks first', () => {
    const runs = runThrough(deals, 'nobody', names, team, NOW)
    expect(runs[0].deals[0].id).toBe('m2')
  })

  it('leaves out a broker with nothing on this seat', () => {
    expect(runThrough(deals, 'lodged', names, team, NOW)).toEqual([])
  })

  it('leaves out a deal with no broker on it rather than inventing one', () => {
    expect(runThrough([deal({ assigned_broker: '' })], 'nobody', names, team, NOW)).toEqual([])
  })

  it('splits the two groups', () => {
    const runs = runThrough(deals, 'nobody', names, team, NOW)
    expect(inTeam(runs, 'Simplify Finance Brokers').map(r => r.key)).toEqual(['keanen'])
    expect(notInTeam(runs, 'Simplify Finance Brokers').map(r => r.key)).toEqual(['mark'])
  })

  it('adds up what a section is worth', () => {
    expect(worthOf([deal({ loan_amount: 500_000 }), deal({ loan_amount: 250_000 })])).toBe(750_000)
    expect(worthOf([deal({ loan_amount: null })])).toBe(0)
    expect(worthOf([])).toBe(0)
  })
})

// WHICH SECTION A DEAL BELONGS IN - AND IT IS THE SPLIT, NOT THE BROKER.
//
// Fabio, 12 Nov 2026: "there are splits that we do 50-50 between Keanen and us
// and Justin and us. That sits on our admin load, not theirs. The only ones
// that sit on theirs are the ones that they get paid 80-20."
describe('whose load is this', () => {
  it('is theirs at eighty and above', () => {
    expect(theirOwnBook(80)).toBe(true)
    expect(theirOwnBook(100)).toBe(true)
  })

  it('is ours on a fifty-fifty, even though they wrote it', () => {
    expect(theirOwnBook(50)).toBe(false)
  })

  it('is ours where there is no split at all', () => {
    expect(theirOwnBook(null)).toBe(false)
    expect(theirOwnBook(undefined)).toBe(false)
  })

  it('sorts a mixed list of Justin’s own deals into the two sections', () => {
    const own = deal({ id: 'own', assigned_broker: 'justin' })      // 80/20, his book
    const with_us = deal({ id: 'ours', assigned_broker: 'justin' }) // 50/50, our load
    const share = (d: any) => (d.id === 'own' ? 80 : 50)
    const out = bySection([own, with_us], share)
    expect(out.theirs.map(d => d.id)).toEqual(['own'])
    expect(out.ours.map(d => d.id)).toEqual(['ours'])
  })
})

// "it's okay to edit that number... Doesn't need to be overthink this."
describe('the target somebody typed', () => {
  it('is used as given', () => {
    expect(readTarget({ floor: 15, ceiling: 20 })).toEqual({ floor: 15, ceiling: 20 })
  })

  it('falls back to ten to twelve where nothing is set', () => {
    expect(readTarget(null)).toEqual({ floor: 10, ceiling: 12 })
    expect(readTarget({})).toEqual({ floor: 10, ceiling: 12 })
  })

  it('ignores nonsense rather than printing it', () => {
    expect(readTarget({ floor: 'ten', ceiling: 0 })).toEqual({ floor: 10, ceiling: 12 })
    expect(readTarget({ floor: -4, ceiling: 9999 })).toEqual({ floor: 10, ceiling: 12 })
  })

  // A ceiling under the floor is somebody mid-typing, not a decision.
  it('never lets the ceiling fall under the floor', () => {
    expect(readTarget({ floor: 15, ceiling: 3 })).toEqual({ floor: 15, ceiling: 15 })
  })

  it('rounds a number somebody pasted', () => {
    expect(readTarget({ floor: 9.6, ceiling: 12.2 })).toEqual({ floor: 10, ceiling: 12 })
  })

  it('counts the week against it', () => {
    const w = weekSoFar(
      [deal({ lodged_at: ago(1) }), said('this'), said('this')], NOW, { floor: 15, ceiling: 20 })
    expect(w.onTrack).toBe(3)
    expect(w.floor).toBe(15)
    expect(w.words).toBe('12 short of 15')
  })
})

// "Kylie is the broker, but later on. So have her there, but just leave it
// blank because she will be part of that."
describe('a broker with nothing on the list', () => {
  const names = (k: string) => ({ mark: 'Mark Gallo', kylie: 'Kylie Searle' }[k] || k)
  const team = () => 'Simplify Finance'

  it('is still on the screen, so the meeting still asks', () => {
    const runs = runThrough([deal({ assigned_broker: 'Mark' })], 'nobody',
      names, team, NOW, ['mark', 'kylie'])
    expect(runs.map(r => r.name)).toEqual(['Mark Gallo', 'Kylie Searle'])
    expect(runs[1].total).toBe(0)
    expect(runs[1].deals).toEqual([])
  })

  it('never sits above somebody who has work', () => {
    const runs = runThrough([deal({ assigned_broker: 'Mark' })], 'nobody',
      names, team, NOW, ['kylie', 'mark'])
    expect(runs[0].key).toBe('mark')
  })
})


// "nobody has said, it says 64 fucking deals. What do you think?"
describe('what the meeting is even about', () => {
  // "Anything starts with everything that is sitting in BC and then LO."
  it('leaves out a fact find nobody has filled in', () => {
    const ff = { id: 'ff', assigned_broker: 'mark', created_at: ago(40) }
    expect(couldLodge(ff)).toBe(false)
    expect(seatCounts([ff], NOW).nobody).toBe(0)
  })

  // "compliance issued, lending options, and BC with the client."
  it('is compliance issued, lending options, and a BC with the client', () => {
    expect(couldLodge({ compliance_sent_at: ago(1) })).toBe(true)
    expect(couldLodge({ client_proceeded: true })).toBe(true)
  })

  it('leaves out a BC that is still ours to write', () => {
    expect(couldLodge({ bc_data: { started: true } })).toBe(false)
  })

  // Lodged is a result, not a candidate - but it still counts for the week.
  it('keeps a deal lodged this week on its own tab and in the count', () => {
    expect(seatOf(deal({ lodged_at: ago(1) }), NOW)).toBe('lodged')
    expect(weekSoFar([deal({ lodged_at: ago(1) })], NOW).lodged).toBe(1)
  })

  // "make sure we can search"
  it('finds one by client, by deal name and by lender', () => {
    const d = deal({ deal_name: 'Okonkwo Purchase', lender: 'ING',
      clients: { first_name: 'Chidi', last_name: 'Okonkwo' } })
    expect(matches(d, 'okon')).toBe(true)
    expect(matches(d, 'chidi')).toBe(true)
    expect(matches(d, 'ing')).toBe(true)
    expect(matches(d, 'westpac')).toBe(false)
  })

  it('shows everything until somebody has typed two letters', () => {
    expect(matches(deal(), '')).toBe(true)
    expect(matches(deal(), 'x')).toBe(true)
  })

  // The search beside a broker's name reaches EVERY deal of theirs that could
  // lodge, not just the tab on screen - that is the point of it.
  it('carries the whole of a broker’s lodgeable book for the search', () => {
    const names = (k: string) => k
    const team = () => 'Simplify Finance'
    const a = deal({ id: 'a', deal_name: 'Okonkwo Purchase' })
    const b = said('this', { id: 'b', deal_name: 'Barbieri Refi' })
    const runs = runThrough([a, b], 'nobody', names, team, NOW)
    expect(runs[0].deals.map(d => d.id)).toEqual(['a'])
    expect(runs[0].all.map(d => d.id).sort()).toEqual(['a', 'b'])
  })
})

// "if I tick the box that says next week... on next week's summary that starts
// on Monday, you're going to bring the ones that we clicked from next week and
// then bring it back and highlight it for this week."
describe('what was promised at an earlier meeting', () => {
  const lastMonday = new Date(new Date(MONDAY).getTime() - 7 * 86_400_000)
    .toISOString().slice(0, 10)

  it('rolls into this week by itself', () => {
    // Marked "next week" last Monday: that stored THIS Monday.
    const d = deal({ lodgement_plan: 'week', lodgement_week: MONDAY,
      lodgement_week_at: new Date(lastMonday + 'T09:00:00+11:00').toISOString() })
    expect(seatOf(d, NOW)).toBe('this_week')
  })

  it('and is marked as carried in, not decided just now', () => {
    const d = deal({ lodgement_plan: 'week', lodgement_week: MONDAY,
      lodgement_week_at: new Date(lastMonday + 'T09:00:00+11:00').toISOString() })
    expect(carriedOver(d, NOW)).toBe('carried')
  })

  it('says slipped where the week it was promised for has gone', () => {
    const d = deal({ lodgement_plan: 'week', lodgement_week: lastMonday,
      lodgement_week_at: new Date(lastMonday + 'T09:00:00+11:00').toISOString() })
    expect(carriedOver(d, NOW)).toBe('slipped')
  })

  it('says nothing about one decided in this morning’s meeting', () => {
    expect(carriedOver(said('this'), NOW)).toBe(null)
  })

  it('says nothing once it has lodged', () => {
    expect(carriedOver(said('this', { lodged_at: ago(1) }), NOW)).toBe(null)
  })
})
