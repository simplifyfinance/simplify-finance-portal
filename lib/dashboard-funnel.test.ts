// THE NUMBERS ON TODAY HAVE TO AGREE WITH EACH OTHER.
//
// Invented deals throughout.
//
// 12 Nov 2026. One page gave three different answers to "is this deal still
// alive", and the business is about to be run off those numbers.
//
//   Live deals              130   isFinished() - reads the timestamps
//   Where the book is       141   status is not 'completed' and not 'lost'
//   Waiting on someone else  53   the same test, but only YOUR deals
//
// NOTHING IN THE CODEBASE HAS EVER WRITTEN status = 'completed'. The only
// thing that writes a status is the Close Deal dialog and it writes 'lost'.
// So the second test only ever excluded lost deals, and every settled deal
// went on being counted as work waiting on a bank.
//
// The database settled it: 272 deals, 131 lost, 11 settled, 0 completed.
// 272 - 131 = 141. 141 - 11 = 130. The whole gap was the eleven settled ones.
//
// THE DEFINITIONS, AS FABIO SET THEM, 12 Nov 2026:
//
//   Settled  somebody pressed Mark as settled. Not work.
//   Lost     somebody closed it as lost. Not work.
//   Live     everything else - including a deal with a settlement date in the
//            diary that nobody has pressed anything on.
//
// "A settlement date does not mark a deal as settled... we need to physically
// mark the deal as settled." settled_at is written by that button and by
// nothing else, which is why isFinished() reading it is not the same as
// reading a date somebody typed.
import { describe, it, expect } from 'vitest'
import { isFinished, phaseOf, isInApplication } from './deal-phase'
import { whoHasIt } from './who-has-it'

// A deal with nothing on it has not left Fact Find.
const blank = (over: any = {}) => ({ id: 'd' + Math.random(), ...over })

// Far enough along to be with the bank: written, sent, agreed, lodged.
const lodged = (over: any = {}) => blank({
  fact_find_data: { name: 'x' },
  bc_completed_at: '2026-10-01T00:00:00+11:00',
  bc_sent_at: '2026-10-02T00:00:00+11:00',
  client_proceeded: true,
  lo_completed_at: '2026-10-05T00:00:00+11:00',
  lo_sent_at: '2026-10-06T00:00:00+11:00',
  lo_client_proceeded: true,
  compliance_completed_at: '2026-10-08T00:00:00+11:00',
  compliance_sent_at: '2026-10-08T00:00:00+11:00',
  lodged_at: '2026-10-09T13:00:00+00:00',
  ...over,
})

describe('what finished means', () => {
  it('is not a settlement date in the diary', () => {
    // THE ONE FABIO CORRECTED ME ON. A booked settlement is a live deal with
    // work in front of it, not a finished one.
    for (const col of ['expected_settlement_date', 'confirmed_settlement_date',
                       'settlement_booked_at', 'contracts_returned_at']) {
      expect(isFinished(lodged({ [col]: '2026-12-21' }))).toBe(false)
    }
  })

  it('is somebody having pressed Mark as settled', () => {
    expect(isFinished(lodged({ settled_at: '2026-12-21T13:00:00+00:00' }))).toBe(true)
  })

  it('is somebody having closed it as lost', () => {
    expect(isFinished(blank({ status: 'lost' }))).toBe(true)
  })

  it('is NOT a status nobody writes', () => {
    // status = 'completed' is written by no code anywhere. A test that relies
    // on it is testing a shape production cannot produce.
    expect(isFinished(lodged({ status: 'completed' }))).toBe(false)
  })

  it('leaves a deal sitting in Fact Find alive', () => {
    expect(isFinished(blank())).toBe(false)
  })
})

describe('a finished deal is waiting on nobody', () => {
  // THE FAULT ITSELF. whoHasIt walks eight steps and anything past the last
  // one is "with the lender". A settled deal is past the last step, so all
  // eleven of them were being counted as work waiting on a bank.
  it('does not say a settled deal is with the lender', () => {
    expect(whoHasIt(lodged({ settled_at: '2026-11-01T13:00:00+00:00' }))).toBe(null)
  })

  it('does not say a lost deal is with anybody', () => {
    expect(whoHasIt(blank({ status: 'lost' }))).toBe(null)
  })

  it('still says a lodged deal is with the lender', () => {
    expect(whoHasIt(lodged())?.holder).toBe('lender')
  })

  it('still says a deal with a booked settlement is with the lender', () => {
    expect(whoHasIt(lodged({ confirmed_settlement_date: '2026-12-21' }))?.holder).toBe('lender')
  })
})

describe('the three panels count the same book', () => {
  const book = [
    blank(),                                              // fact find
    blank({ fact_find_data: { a: 1 } }),                  // bc
    lodged(),                                             // with the lender
    lodged({ confirmed_settlement_date: '2026-12-21' }),  // still with the lender
    lodged({ settled_at: '2026-11-01T13:00:00+00:00' }),  // finished
    blank({ status: 'lost' }),                            // finished
  ]

  const live = book.filter(d => !isFinished(d))

  it('agrees on how many are alive', () => {
    expect(live).toHaveLength(4)
  })

  // WHERE THE BOOK IS must add back to the live count, or the page is lying
  // about one of them.
  it('adds the three holders back to the live count', () => {
    const held = live.map(d => whoHasIt(d)).filter(Boolean)
    expect(held).toHaveLength(live.length)
    const us = held.filter(h => h!.holder === 'us').length
    const client = held.filter(h => h!.holder === 'client').length
    const lender = held.filter(h => h!.holder === 'lender').length
    expect(us + client + lender).toBe(live.length)
  })

  // AND THE FUNNEL TILES. Fact Find had no tile, so thirteen deals fell out of
  // a strip that was meant to sum to the number printed beside it.
  it('adds the five stage tiles back to the live count', () => {
    const tiles = { 'Fact Find': 0, BC: 0, LO: 0, Compliance: 0, 'In application': 0 }
    for (const d of book) {
      if (isFinished(d)) continue
      const p = phaseOf(d)
      if (p === 'fact_find') tiles['Fact Find']++
      else if (p === 'bc') tiles.BC++
      else if (p === 'lo') tiles.LO++
      else if (p === 'compliance') tiles.Compliance++
      else if (isInApplication(d)) tiles['In application']++
    }
    const shown = Object.values(tiles).reduce((a, b) => a + b, 0)
    expect(shown).toBe(live.length)
  })
})
