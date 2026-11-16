import { describe, it, expect } from 'vitest'
import { whatThisDealOwes, morningList, morningWords, byKind } from './the-morning-list'
import { SETTLEMENT_DEFAULTS } from './settlement-settings'

const S = SETTLEMENT_DEFAULTS

// SYDNEY, NOT THE MACHINE. The first version of this file built its dates with
// toISOString(), which is UTC - so every case here passed on a UTC container
// and the settlement-day one failed on a Mac in Sydney. The code had the same
// fault, and that is the bug this file now guards.
const ymd = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(d)

const TODAY = new Date('2026-11-17T09:00:00+11:00')
const inDays = (n: number) => ymd(new Date(TODAY.getTime() + n * 86400000))

const deal = (over: any = {}) => ({ id: 'd1', deal_name: 'Beckett', ...over })

describe('a deal that has gone quiet', () => {
  it('appears once it is past the chase time for its step', () => {
    // Contracts issued is chased after 2 business days.
    const out = whatThisDealOwes(deal({
      settlement_stage: 'contracts_issued', settlement_stage_at: inDays(-9),
    }), S, TODAY)
    expect(out.map(i => i.kind)).toContain('chase')
    expect(out.find(i => i.kind === 'chase')!.words).toContain('Contracts issued')
  })

  it('and not before', () => {
    const out = whatThisDealOwes(deal({
      settlement_stage: 'contracts_issued', settlement_stage_at: inDays(0),
    }), S, TODAY)
    expect(out.filter(i => i.kind === 'chase')).toHaveLength(0)
  })

  // A settled deal is not late for anything.
  it('a settled deal never chases', () => {
    const out = whatThisDealOwes(deal({
      settlement_stage: 'contracts_issued', settlement_stage_at: inDays(-40),
      settled_at: inDays(-2),
    }), S, TODAY)
    expect(out.filter(i => i.kind === 'chase')).toHaveLength(0)
  })
})

describe('work with a date on it', () => {
  it('the settlement numbers come up a week out', () => {
    const out = whatThisDealOwes(deal({
      settlement_stage: 'pending_booking', settlement_stage_at: inDays(0),
      confirmed_settlement_date: inDays(5),
    }), S, TODAY)
    expect(out.find(i => i.words.includes('Settlement numbers'))!.since).toBe('settling in 5 days')
  })

  // A LIST OF WHAT IS OWED, NOT A LIST OF WHAT EXISTS.
  it('and drop off once that email has gone', () => {
    const out = whatThisDealOwes(deal({
      settlement_stage: 'pending_booking', settlement_stage_at: inDays(0),
      confirmed_settlement_date: inDays(5),
      emails_sent: [{ template: 'settlement_numbers', at: inDays(-1), by: 'Belle' }],
    }), S, TODAY)
    expect(out.find(i => i.words.includes('Settlement numbers'))).toBeUndefined()
  })

  it('the funds check comes up three days out, on a purchase', () => {
    const buy = deal({
      transaction_type: 'purchase',
      settlement_stage: 'settlement_booked', settlement_stage_at: inDays(0),
      confirmed_settlement_date: inDays(2),
    })
    expect(whatThisDealOwes(buy, S, TODAY).some(i => i.words.includes('Funds to complete'))).toBe(true)
  })

  // There is nothing for a refinancing client to bring.
  it('and never on a refinance', () => {
    const refi = deal({
      transaction_type: 'refinance',
      settlement_stage: 'settlement_booked', settlement_stage_at: inDays(0),
      confirmed_settlement_date: inDays(2),
    })
    expect(whatThisDealOwes(refi, S, TODAY).some(i => i.words.includes('Funds to complete'))).toBe(false)
  })

  it('and not once somebody has checked them', () => {
    const buy = deal({
      transaction_type: 'purchase',
      settlement_stage: 'settlement_booked', settlement_stage_at: inDays(0),
      confirmed_settlement_date: inDays(2),
      funds_to_complete_checked: inDays(-1),
    })
    expect(whatThisDealOwes(buy, S, TODAY).some(i => i.words.includes('Funds to complete'))).toBe(false)
  })

  // THE WORST PHONE CALL IN THIS BUSINESS.
  it('a shortfall unchecked on settlement day leads the whole screen', () => {
    const today = deal({
      transaction_type: 'purchase',
      settlement_stage: 'settlement_booked', settlement_stage_at: inDays(-30),
      confirmed_settlement_date: inDays(0),
    })
    const list = morningList([today], S, TODAY)
    expect(list[0].words).toContain('Funds to complete')
    expect(list[0].since).toBe('settling today')
  })
})

describe('a month on', () => {
  it('comes up thirty days after settlement', () => {
    const out = whatThisDealOwes(deal({ settled_at: inDays(-31) }), S, TODAY)
    expect(out.map(i => i.kind)).toContain('checkin')
  })

  it('not before', () => {
    expect(whatThisDealOwes(deal({ settled_at: inDays(-10) }), S, TODAY)
      .filter(i => i.kind === 'checkin')).toHaveLength(0)
  })

  it('and not once the email has gone', () => {
    const out = whatThisDealOwes(deal({
      settled_at: inDays(-31),
      emails_sent: [{ template: 'month_in', at: inDays(-1), by: 'Belle' }],
    }), S, TODAY)
    expect(out.filter(i => i.kind === 'checkin')).toHaveLength(0)
  })
})

// TWO JOBS ARE TWO ROWS. Rolling them into one means doing one and losing
// the other.
describe('one deal, more than one job', () => {
  it('appears once per thing it owes', () => {
    const out = whatThisDealOwes(deal({
      transaction_type: 'purchase',
      settlement_stage: 'outstandings', settlement_stage_at: inDays(-20),
      confirmed_settlement_date: inDays(1),
    }), S, TODAY)
    expect(out.length).toBeGreaterThan(1)
    expect(new Set(out.map(i => i.dealId)).size).toBe(1)
  })
})

describe('the order it is worked', () => {
  it('dates first, then the quiet ones oldest first, then the check-ins', () => {
    const quietOld = deal({ id: 'a', deal_name: 'Old',
      settlement_stage: 'formal', settlement_stage_at: inDays(-40) })
    const quietNew = deal({ id: 'b', deal_name: 'New',
      settlement_stage: 'formal', settlement_stage_at: inDays(-9) })
    const dated = deal({ id: 'c', deal_name: 'Dated',
      settlement_stage: 'pending_booking', settlement_stage_at: inDays(0),
      confirmed_settlement_date: inDays(3) })
    const old = deal({ id: 'd', deal_name: 'Settled', settled_at: inDays(-60) })

    const list = morningList([quietNew, old, quietOld, dated], S, TODAY)
    expect(list.map(i => i.kind)).toEqual(['dated', 'chase', 'chase', 'checkin'])
    expect(list[1].dealName).toBe('Old')
    expect(list[2].dealName).toBe('New')
  })
})

describe('what the screen says', () => {
  it('counts in English', () => {
    expect(morningWords([])).toBe('Nothing needs you this morning')
    expect(morningWords([{} as any])).toBe('1 thing needs you this morning')
    expect(morningWords([{}, {}] as any)).toBe('2 things need you this morning')
  })

  it('and splits into the three groups', () => {
    const groups = byKind(morningList([
      deal({ settled_at: inDays(-60) }),
      deal({ id: 'x', settlement_stage: 'formal', settlement_stage_at: inDays(-40) }),
    ], S, TODAY))
    expect(groups.checkin).toHaveLength(1)
    expect(groups.chase).toHaveLength(1)
    expect(groups.dated).toHaveLength(0)
  })
})

// THE BUG THAT BROKE THE SHIP. Vercel runs UTC; the office is in Sydney. A
// settlement date is a calendar date, so the answer must not depend on where
// the code is running or what time it is when somebody looks.
describe('the day is Sydney, wherever the server is', () => {
  const buying = (on: string) => deal({
    transaction_type: 'purchase',
    settlement_stage: 'settlement_booked', settlement_stage_at: '2026-10-01',
    confirmed_settlement_date: on,
  })

  it('late at night in Sydney, when UTC is still yesterday', () => {
    const lateHere = new Date('2026-11-17T23:30:00+11:00')  // 12:30 UTC, 17 Nov
    const out = whatThisDealOwes(buying('2026-11-17'), S, lateHere)
    expect(out.find(i => i.words.includes('Funds to complete'))!.since).toBe('settling today')
  })

  it('and first thing in the morning, when UTC is still the day before', () => {
    const earlyHere = new Date('2026-11-17T07:00:00+11:00')  // 20:00 UTC, 16 Nov
    const out = whatThisDealOwes(buying('2026-11-17'), S, earlyHere)
    expect(out.find(i => i.words.includes('Funds to complete'))!.since).toBe('settling today')
  })

  it('the day after is the day after, at either hour', () => {
    for (const t of ['2026-11-18T07:00:00+11:00', '2026-11-18T23:30:00+11:00']) {
      const out = whatThisDealOwes(buying('2026-11-17'), S, new Date(t))
      expect(out.find(i => i.words.includes('Funds to complete'))!.since, t)
        .toBe('settlement was 1 days ago')
    }
  })
})

// THE QUIETEST WAY TO LOSE MONEY ON A SCREEN.
//
// 17 Nov 2026. Twelve deals were formally approved, unsettled and carried no
// settlement date at all, so every one of them was invisible to the month -
// the band read $2.2m against a spreadsheet saying $24.2m and nothing looked
// broken. Three of them had a date in a spreadsheet cell and nowhere else.
describe('approved, and in no month at all', () => {
  it('is named every morning until somebody puts a date on it', () => {
    const out = whatThisDealOwes(deal({ formal_approval_at: '2026-11-04' }), S, TODAY)
    const row = out.find(i => i.kind === 'nodate')!
    expect(row.words).toBe('Approved, but no settlement date')
    expect(row.since).toContain('in no month')
  })

  it('not once it has a date, confirmed or expected', () => {
    for (const k of ['confirmed_settlement_date', 'expected_settlement_date']) {
      const out = whatThisDealOwes(
        deal({ formal_approval_at: '2026-11-04', [k]: inDays(7) }), S, TODAY)
      expect(out.filter(i => i.kind === 'nodate'), k).toHaveLength(0)
    }
  })

  it('not before it is approved - there is nothing to date yet', () => {
    expect(whatThisDealOwes(deal({}), S, TODAY).filter(i => i.kind === 'nodate')).toHaveLength(0)
  })

  it('and not once it has settled', () => {
    const out = whatThisDealOwes(
      deal({ formal_approval_at: '2026-11-04', settled_at: inDays(-2) }), S, TODAY)
    expect(out.filter(i => i.kind === 'nodate')).toHaveLength(0)
  })

  // Dates cannot be moved; a missing date is the next most urgent thing,
  // because until it exists the deal is in no total anywhere.
  it('sits under dated work and above the chases', () => {
    const list = morningList([
      deal({ id: 'a', deal_name: 'Needs a date', formal_approval_at: '2026-11-04' }),
      deal({ id: 'b', deal_name: 'Quiet', settlement_stage: 'formal',
             settlement_stage_at: inDays(-40) }),
    ], S, TODAY)
    expect(list.map(i => i.kind)).toEqual(['nodate', 'chase'])
  })
})

describe('a quiet book', () => {
  it('produces nothing at all rather than an empty shape', () => {
    expect(morningList([], S, TODAY)).toEqual([])
    expect(morningList([deal({})], S, TODAY)).toEqual([])
  })
})
