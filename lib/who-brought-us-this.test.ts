// WHAT WE LODGED AND SETTLED, AND WHO BROUGHT IT.
//
// 11 Nov 2026. Fabio: "right now we have a manual process that we go to a
// Teams channel, and every time we lodge a deal, we write there that the deal
// is lodged." This is that, read off the dates the board already writes.
import { describe, it, expect } from 'vitest'
import {
  happened, byReferral, byBroker, totals, forReferrer, referralName, termsWords, dayWords,
  OURS, UNANSWERED, referralKey,
} from './who-brought-us-this'
import {
  referrerSubject, referrerBody, managementSubject, managementBody, weekEndingWords, modeOf,
} from './the-friday-email'

// Monday 9 to Friday 13 November 2026.
const WEEK = { from: '2026-11-09', to: '2026-11-13' }
const YEAR = { from: '2026-07-01', to: '2026-11-13' }

const justin = (over: any = {}) => ({
  id: 'j' + Math.random().toString(36).slice(2),
  deal_name: 'Chen & Cardey', assigned_broker: 'pat', lender: 'Bankwest', lodged_total: 740000,
  commission_split_id: 'split-justin', commission_split_name: 'Justin Cornock',
  commission_split_kind: 'referrer',
  commission_split_lines: [
    { who: 'Justin Cornock', upfront: 50, trail: 50 },
    { who: 'Simplify Finance', upfront: 50, trail: 50 },
  ],
  ...over,
})
const ours = (over: any = {}) => ({
  id: 'o' + Math.random().toString(36).slice(2),
  deal_name: 'Hartley, D & K', assigned_broker: 'pat', commission_split_none: true,
  lodged_total: 880000, ...over,
})

describe('what crossed a line, and when', () => {
  it('counts the day it was marked, not the day it was created', () => {
    const deals = [
      justin({ lodged_at: '2026-11-10' }),
      justin({ lodged_at: '2026-11-06' }),   // last week
      justin({ created_at: '2026-11-10' }),  // never lodged
    ]
    expect(happened(deals, 'lodged', WEEK)).toHaveLength(1)
  })

  it('leaves a lost deal out', () => {
    expect(happened([justin({ lodged_at: '2026-11-10', status: 'lost' })], 'lodged', WEEK))
      .toHaveLength(0)
  })

  it('adds the week up', () => {
    const t = totals([
      justin({ lodged_at: '2026-11-10' }),
      ours({ lodged_at: '2026-11-11', settled_at: '2026-11-12' }),
    ], WEEK)
    expect(t.lodged).toBe(2)
    expect(t.settled).toBe(1)
  })
})

describe('who brought it', () => {
  // "Ours" is an answer somebody gave. Nobody having answered is a different
  // thing, and the report must not quietly treat the two as the same.
  it('tells ours apart from nobody having said', () => {
    expect(referralKey(ours())).toBe(OURS)
    expect(referralKey({ deal_name: 'x' })).toBe(UNANSWERED)
    expect(referralName({ deal_name: 'x' })).toBe('Nobody has said')
    expect(referralName(ours())).toBe('Ours, no split')
  })

  // THE TERMS COME OFF THE DEAL, NOT OFF THE SPLIT. A split renegotiated next
  // year must not change what a settled deal says was agreed at the time.
  it('reads the terms the deal kept', () => {
    expect(termsWords(justin())).toContain('Justin Cornock')
    expect(termsWords(justin())).toContain('50')
    expect(termsWords(ours())).toBe('')
  })

  it('groups the week by the split that was chosen', () => {
    const rows = byReferral([
      justin({ lodged_at: '2026-11-10' }),
      justin({ lodged_at: '2026-11-11' }),
      ours({ lodged_at: '2026-11-12' }),
    ], WEEK)
    expect(rows[0].name).toBe('Justin Cornock')
    expect(rows[0].lodged).toHaveLength(2)
    expect(rows[1].name).toBe('Ours, no split')
  })

  // A deal is in both breakdowns, once each. That is correct, and it is the
  // thing somebody will query first.
  it('and the same deal is counted once under its broker', () => {
    const deals = [justin({ lodged_at: '2026-11-10', assigned_broker: 'pat' })]
    expect(byBroker(deals, WEEK, { pat: 'Pat Walsh' })[0].name).toBe('Pat Walsh')
    expect(byBroker(deals, WEEK)[0].lodged).toHaveLength(1)
    expect(byReferral(deals, WEEK)[0].lodged).toHaveLength(1)
  })

  it('counts a deal that lodged and settled in the same week on both lines', () => {
    const rows = byReferral([justin({ lodged_at: '2026-11-10', settled_at: '2026-11-12' })], WEEK)
    expect(rows[0].lodged).toHaveLength(1)
    expect(rows[0].settled).toHaveLength(1)
  })
})

describe('one referral partner’s week', () => {
  const deals = [
    justin({ lodged_at: '2026-11-10' }),
    justin({ deal_name: 'Rahman, S', settled_at: '2026-11-11' }),
    justin({ lodged_at: '2026-08-04' }),          // earlier in the year
    ours({ lodged_at: '2026-11-10' }),            // not theirs
  ]

  it('is only their deals, with the year behind it', () => {
    const r = forReferrer(deals, 'split-justin', WEEK, YEAR)!
    expect(r.lodged).toHaveLength(1)
    expect(r.settled).toHaveLength(1)
    expect(r.yearLodged).toBe(2)
    expect(r.yearSettled).toBe(1)
  })

  // THERE IS DELIBERATELY NO EMPTY VERSION. A Friday email saying "nothing
  // this week" is how a weekly email stops being opened.
  it('is nothing at all in a quiet week', () => {
    expect(forReferrer(deals, 'split-justin',
      { from: '2026-10-05', to: '2026-10-09' }, YEAR)).toBe(null)
    expect(forReferrer(deals, 'split-nobody', WEEK, YEAR)).toBe(null)
  })
})

describe('the Friday email', () => {
  const r = forReferrer([
    justin({ lodged_at: '2026-11-10' }),
    justin({ deal_name: 'Rahman, S', settled_at: '2026-11-11' }),
  ], 'split-justin', WEEK, YEAR)!

  it('says the week in the subject', () => {
    expect(referrerSubject(r, 'Friday 13 November'))
      .toBe('Justin Cornock — week to Friday 13 November: 1 lodged, 1 settled')
  })

  it('is written to them, deal by deal', () => {
    const body = referrerBody(r, 'Justin')
    expect(body.startsWith('Hi Justin,')).toBe(true)
    expect(body).toContain('Chen & Cardey')
    expect(body).toContain('Bankwest')
    expect(body).toContain('Lodged — 1')
    expect(body).toContain('Settled — 1')
  })

  // The line that manages the relationship. Three this week is a number;
  // eleven since July is a conversation.
  it('carries the year to date', () => {
    expect(referrerBody(r)).toContain('since 1 July')
  })

  it('and management gets the two breakdowns and what is coming', () => {
    const deals = [justin({ lodged_at: '2026-11-10' }), ours({ lodged_at: '2026-11-11' })]
    const body = managementBody(totals(deals, WEEK), byReferral(deals, WEEK),
      byBroker(deals, WEEK, { pat: 'Pat Walsh' }), { next: 2, noWeek: 67 }, 'Friday 13 November')
    expect(body).toContain('WHO BROUGHT IT')
    expect(body).toContain('BY BROKER')
    expect(body).toContain('Due to lodge next week: 2')
    expect(body).toContain('Still with no week set: 67')
    expect(managementSubject(totals(deals, WEEK), 'Friday 13 November'))
      .toBe('Week to Friday 13 November: 2 lodged, 0 settled')
  })

  it('names the Friday of whatever week it runs in', () => {
    expect(weekEndingWords(new Date(2026, 10, 11))).toContain('13 November')
    expect(weekEndingWords(new Date(2026, 10, 11))).toContain('Friday')
    // Monday and Friday of the same week give the same answer.
    expect(weekEndingWords(new Date(2026, 10, 9)))
      .toBe(weekEndingWords(new Date(2026, 10, 13)))
  })

  // Off unless somebody turned it on, and direct only if somebody chose it.
  it('is off until somebody says otherwise', () => {
    expect(modeOf(null)).toBe('off')
    expect(modeOf('nonsense')).toBe('off')
    expect(modeOf('to_us')).toBe('to_us')
    expect(modeOf('direct')).toBe('direct')
  })
})

describe('the Sydney day, not the UTC one', () => {
  // 12 Nov 2026. Fabio: "we more than 1 deal this week." There were three and
  // the report showed one.
  //
  // A lodgement is recorded as a DATE and stored as Sydney midnight, which is
  // 13:00 the day before in UTC. Two of Mark's lodged on Monday 9 November
  // were stored as 2026-11-08T13:00:00+00 and fell out of the week entirely -
  // and the SQL written to check it had the same flaw, so it agreed.
  const MON = '2026-11-08T13:00:00+00:00'   // Monday 9 Nov, Sydney
  const FRI = '2026-11-13T12:59:00+00:00'   // Friday 13 Nov, late in the day

  it('counts a Monday lodgement that UTC calls Sunday', () => {
    expect(happened([{ id: 'a', lodged_at: MON }], 'lodged', WEEK)).toHaveLength(1)
  })

  it('and the last minute of Friday is still that week', () => {
    expect(happened([{ id: 'b', lodged_at: FRI }], 'lodged', WEEK)).toHaveLength(1)
  })

  it('and the week really did hold three', () => {
    const deals = [
      { id: 'a', lodged_at: MON, assigned_broker: 'mark' },
      { id: 'b', lodged_at: MON, assigned_broker: 'mark' },
      { id: 'c', lodged_at: '2026-11-10T13:00:00+00:00', assigned_broker: 'fabio' },
    ]
    expect(totals(deals, WEEK).lodged).toBe(3)
    expect(byBroker(deals, WEEK).find(r => r.name === 'mark')!.lodged).toHaveLength(2)
  })

  // "Lodged Tuesday" on a deal stored as Sydney midnight read as Monday
  // anywhere the clock was not set to Sydney.
  it('names the weekday in Sydney too', () => {
    expect(dayWords({ lodged_at: MON }, 'lodged')).toBe('Monday')
  })
})
