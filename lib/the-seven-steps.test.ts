// THE SEVEN STEPS, AND THE TWO BOARD COLUMNS THAT HAVE NEVER HELD A DEAL.
//
// 17 Nov 2026. Fabio's spec of 6 November, answered by Julian Kok and Belle.
import { describe, it, expect } from 'vitest'
import {
  STEPS, STEP_LABEL, STEP_MEANS, DEFAULT_CHASE, BOARD_COLUMN,
  isStep, stepOf, stepIndex, reached, workdaysBetween, daysOnStep, isOverdue,
  movePatch, cannotMoveBecause,
} from './the-seven-steps'

const on = (step: any, at: string, over: any = {}) =>
  ({ settlement_stage: step, settlement_stage_at: at, ...over })

describe('the seven steps', () => {
  it('are the seven, in order', () => {
    expect(STEPS).toEqual(['formal', 'contracts_issued', 'contracts_reviewing',
      'outstandings', 'pending_booking', 'settlement_booked', 'settled'])
  })

  it('and every one of them has words a person would use', () => {
    for (const s of STEPS) {
      expect(STEP_LABEL[s], `${s} has no label`).toBeTruthy()
      expect(STEP_MEANS[s], `${s} does not say what it means`).toBeTruthy()
      expect(BOARD_COLUMN[s], `${s} is in no board column`).toBeTruthy()
    }
  })

  it('anything else is not a step', () => {
    expect(isStep('formal')).toBe(true)
    expect(isStep('booked')).toBe(false)
    expect(isStep('')).toBe(false)
    expect(isStep(null)).toBe(false)
  })

  // A DEAL THAT HAS NEVER BEEN MOVED HAS NO STEP, and the panel offers Formal
  // rather than guessing one from a date somebody set for another reason.
  it('a deal nobody has moved is on no step at all', () => {
    expect(stepOf({})).toBe(null)
    expect(stepOf({ settlement_stage: 'nonsense' })).toBe(null)
    expect(stepOf(null)).toBe(null)
  })

  it('and reaching a step means that one or anything past it', () => {
    const d = on('outstandings', '2026-11-10')
    expect(reached(d, 'formal')).toBe(true)
    expect(reached(d, 'outstandings')).toBe(true)
    expect(reached(d, 'settlement_booked')).toBe(false)
    expect(reached({}, 'formal')).toBe(false)
  })
})

// 17 Nov 2026. Julian said the timeframes were fine. Belle asked for five days
// on Pending Booking, and Fabio took it.
describe('how long a step may sit', () => {
  it('two, two, three, two', () => {
    expect(DEFAULT_CHASE.formal).toBe(2)
    expect(DEFAULT_CHASE.contracts_issued).toBe(2)
    expect(DEFAULT_CHASE.contracts_reviewing).toBe(3)
    expect(DEFAULT_CHASE.outstandings).toBe(2)
  })

  it('five on pending booking, because a solicitor can go quiet', () => {
    expect(DEFAULT_CHASE.pending_booking).toBe(5)
  })

  // THEY AGREED ON THIS ONE. Once the date is accepted there is nothing to chase.
  it('and nothing on settlement booked or settled', () => {
    expect(DEFAULT_CHASE.settlement_booked).toBe(null)
    expect(DEFAULT_CHASE.settled).toBe(null)
  })
})

// EVERY DATE IN THIS PORTAL IS THE NEW SOUTH WALES CALENDAR, public holidays
// included. A four day Easter weekend must not make the whole book look
// neglected on the Tuesday.
describe('business days', () => {
  it('skip the weekend', () => {
    // Fri 13 Nov 2026 to Mon 16 Nov is one business day.
    expect(workdaysBetween('2026-11-13', '2026-11-16')).toBe(1)
  })

  it('and skip a public holiday', () => {
    // Christmas Day 2026 is a Friday, Boxing Day falls on the Saturday and is
    // observed on Monday 28th. Thu 24 Dec to Tue 29 Dec is one business day.
    expect(workdaysBetween('2026-12-24', '2026-12-29')).toBe(1)
  })

  it('a step entered this morning is nought days old', () => {
    expect(workdaysBetween('2026-11-16', '2026-11-16')).toBe(0)
  })

  it('and a date nobody can read counts nothing, never everything', () => {
    expect(workdaysBetween('', '2026-11-16')).toBe(0)
    expect(workdaysBetween('2026-11-16', '')).toBe(0)
    expect(workdaysBetween(null, null)).toBe(0)
  })

  it('a backwards pair is nought, not a negative', () => {
    expect(workdaysBetween('2026-11-16', '2026-11-13')).toBe(0)
  })

  it('daysOnStep reads the clock the step was entered on', () => {
    expect(daysOnStep(on('formal', '2026-11-11T09:00:00Z'), new Date('2026-11-16T09:00:00Z'))).toBe(3)
  })
})

describe('when a deal is past its chase time', () => {
  const NOW = new Date('2026-11-16T09:00:00+11:00')

  it('three business days on a two day step', () => {
    expect(isOverdue(on('formal', '2026-11-11'), DEFAULT_CHASE, NOW)).toBe(true)
  })

  it('and not before it', () => {
    expect(isOverdue(on('formal', '2026-11-13'), DEFAULT_CHASE, NOW)).toBe(false)
  })

  // A STEP WITH NO CHASE TIME NEVER IS.
  it('settlement booked is never late, however long it sits', () => {
    expect(isOverdue(on('settlement_booked', '2026-01-01'), DEFAULT_CHASE, NOW)).toBe(false)
  })

  // Chasing somebody for not starting a process that did not exist yesterday is
  // how a new screen loses people in its first week.
  it('a deal nobody has moved is never late', () => {
    expect(isOverdue({}, DEFAULT_CHASE, NOW)).toBe(false)
  })

  it('and a settled deal is off the clock whatever step it says', () => {
    expect(isOverdue(on('outstandings', '2026-01-01', { settled_at: '2026-10-01' }),
      DEFAULT_CHASE, NOW)).toBe(false)
  })
})

// THE WHOLE REASON THESE STEPS EXIST.
describe('the two moves that fill the empty board columns', () => {
  const NOW = new Date('2026-11-16T09:00:00Z')

  it('moving to contracts reviewing writes the date behind Contracts returned', () => {
    const p = movePatch({}, 'contracts_reviewing', NOW)
    expect(p.contracts_returned_at).toBe(NOW.toISOString())
    expect(p.settlement_step).toBe('contracts_returned')
  })

  it('moving to settlement booked writes the date behind Settlement booked', () => {
    const p = movePatch({ contracts_returned_at: '2026-11-10' }, 'settlement_booked', NOW)
    expect(p.settlement_booked_at).toBe(NOW.toISOString())
    expect(p.settlement_step).toBe('settlement_booked')
  })

  it('and every move records the step and starts its clock', () => {
    const p = movePatch({}, 'outstandings', NOW)
    expect(p.settlement_stage).toBe('outstandings')
    expect(p.settlement_stage_at).toBe(NOW.toISOString())
  })

  // A DATE ALREADY THERE IS A RECORD. It is not rewritten by passing through
  // the step a second time.
  it('a date already written is left alone', () => {
    const p = movePatch({ contracts_returned_at: '2026-11-02T00:00:00Z' }, 'contracts_reviewing', NOW)
    expect(p.contracts_returned_at).toBeUndefined()
  })

  // Moving backwards does not unsay what happened.
  it('and going back a step never unwrites one', () => {
    const d = { contracts_returned_at: '2026-11-02', settlement_booked_at: '2026-11-09' }
    const p = movePatch(d, 'outstandings', NOW)
    expect(p.settlement_booked_at).toBeUndefined()
    expect(p.contracts_returned_at).toBeUndefined()
    expect(p.settlement_step).toBe('settlement_booked')
  })

  // SETTLED IS MARKED IN ONE PLACE. The stage ladder writes settled_at with a
  // snapshot of the loan as it settled, and commission is calculated from that
  // snapshot - so a deal must never become settled without one.
  it('moving to settled never writes settled_at', () => {
    const p = movePatch({}, 'settled', NOW)
    expect(p.settled_at).toBeUndefined()
  })
})

describe('the one thing that refuses', () => {
  it('settlement booked needs a date on the deal', () => {
    expect(cannotMoveBecause({}, 'settlement_booked')).toContain('settlement date')
  })

  it('and goes through once there is one', () => {
    expect(cannotMoveBecause({ confirmed_settlement_date: '2026-11-28' }, 'settlement_booked')).toBe('')
    expect(cannotMoveBecause({ expected_settlement_date: '2026-11-28' }, 'settlement_booked')).toBe('')
  })

  // EVERYTHING ELSE WARNS AND CARRIES ON. Fabio: "I don't want to block it
  // because it makes it hard."
  it('nothing else is ever blocked', () => {
    for (const s of STEPS) {
      if (s === 'settlement_booked') continue
      expect(cannotMoveBecause({}, s), `${s} is blocking somebody`).toBe('')
    }
  })
})
