// "THIS IS GOING TO BE A TEST AND TRIAL AND ERROR."
//
// 17 Nov 2026, Fabio, on the chase times: "let's build a whole section in
// settings that these all can be changed as we see fit."
import { describe, it, expect } from 'vitest'
import { SETTLEMENT_DEFAULTS, settlementSettings, isDefault } from './settlement-settings'
import { DEFAULT_CHASE, STEPS } from './the-seven-steps'

describe('an empty settings page changes nothing', () => {
  // THE WHOLE DISCIPLINE. A portal nobody has configured behaves exactly as it
  // would with no settings page at all.
  it('nothing saved reads as the defaults', () => {
    expect(settlementSettings(null)).toEqual(SETTLEMENT_DEFAULTS)
    expect(settlementSettings({})).toEqual(SETTLEMENT_DEFAULTS)
    expect(settlementSettings('nonsense')).toEqual(SETTLEMENT_DEFAULTS)
    expect(settlementSettings([])).toEqual(SETTLEMENT_DEFAULTS)
  })

  it('and the chase defaults are the ones the team argued about', () => {
    expect(settlementSettings({}).chase).toEqual(DEFAULT_CHASE)
    expect(settlementSettings({}).chase.pending_booking).toBe(5)
    expect(settlementSettings({}).chase.settlement_booked).toBe(null)
  })

  it('isDefault says so', () => {
    expect(isDefault(settlementSettings({}))).toBe(true)
    expect(isDefault(settlementSettings({ chase: { outstandings: 1 } }))).toBe(false)
  })
})

describe('a number somebody typed', () => {
  it('replaces the default for that one and leaves the rest alone', () => {
    const s = settlementSettings({ chase: { outstandings: 1 } })
    expect(s.chase.outstandings).toBe(1)
    expect(s.chase.formal).toBe(2)
    expect(s.numbersDaysBefore).toBe(7)
  })

  it('every step is answered even when only one was saved', () => {
    const s = settlementSettings({ chase: { formal: 4 } })
    for (const step of STEPS) expect(s.chase[step], `${step} is missing`).not.toBeUndefined()
  })

  // "CHASE IT THE SAME DAY" IS A THING SOMEBODY MIGHT GENUINELY WANT.
  it('nought is a real answer', () => {
    expect(settlementSettings({ chase: { formal: 0 } }).chase.formal).toBe(0)
  })

  it('and a chase can be switched off entirely', () => {
    expect(settlementSettings({ chase: { outstandings: null } }).chase.outstandings).toBe(null)
    expect(settlementSettings({ chase: { outstandings: 'off' } }).chase.outstandings).toBe(null)
  })

  // 17 Nov: Settlement Booked is off by default, and can be turned on if
  // Julian changes his mind in a month.
  it('or switched on where it was off', () => {
    expect(settlementSettings({ chase: { settlement_booked: 7 } }).chase.settlement_booked).toBe(7)
  })

  it('the dated jobs move too', () => {
    const s = settlementSettings({ numbersDaysBefore: 10, checkInDaysAfter: 45 })
    expect(s.numbersDaysBefore).toBe(10)
    expect(s.checkInDaysAfter).toBe(45)
    expect(s.shortfallDaysBefore).toBe(3)
  })

  it('and so do the board clocks that already existed', () => {
    const s = settlementSettings({ quietBusinessDays: 14, settlingSoonDays: 3, fundsToCompleteDays: 7 })
    expect(s.quietBusinessDays).toBe(14)
    expect(s.settlingSoonDays).toBe(3)
    expect(s.fundsToCompleteDays).toBe(7)
  })
})

// A FALLBACK IS NOT A ROUNDING. Nothing here turns a typo into a working number.
describe('something that is not a number', () => {
  it('falls back rather than being bent into one', () => {
    for (const bad of ['', 'two', -1, 1.5, NaN, {}, 1000]) {
      expect(settlementSettings({ chase: { formal: bad } }).chase.formal,
        `${JSON.stringify(bad)} was accepted`).toBe(2)
      expect(settlementSettings({ numbersDaysBefore: bad }).numbersDaysBefore,
        `${JSON.stringify(bad)} was accepted`).toBe(7)
    }
  })

  it('and a chase object that is not an object is ignored whole', () => {
    expect(settlementSettings({ chase: 'nope' }).chase).toEqual(DEFAULT_CHASE)
    expect(settlementSettings({ chase: [1, 2] }).chase).toEqual(DEFAULT_CHASE)
  })
})
