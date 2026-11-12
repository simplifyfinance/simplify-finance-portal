// THE MONDAY MEETING, WITHOUT THE SPREADSHEET.
//
// Invented client names throughout.
import { describe, it, expect } from 'vitest'
import {
  SEATS, SLIPPING_DAYS, inTeam, isSlipping, notInTeam, runThrough, seatCounts, seatOf,
  theirOwnBook, bySection, unansweredDays, weekSoFar, worthOf,
} from './the-run-through'
import { mondayOf } from './lodging-when'

// Wednesday, so "this week" started two days ago.
const NOW = new Date('2026-11-18T09:00:00+11:00')
const MONDAY = mondayOf(NOW)
const ago = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString()

const deal = (over: any = {}) => ({
  id: 'd', deal_name: 'A deal', assigned_broker: 'mark', stage: 'Compliance',
  created_at: ago(5), loan_amount: 500_000, ...over,
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
