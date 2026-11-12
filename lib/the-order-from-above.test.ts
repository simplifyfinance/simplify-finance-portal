// MANAGEMENT SETS THE ORDER, AND SHE IS TOLD WHO AND WHY.
//
// Invented names throughout.
import { describe, it, expect } from 'vitest'
import {
  minutesSince, moveBy, orderFrom, orderPatch, putOn, putOnHerDay, seenState,
  takeOff, unseen, whatSheIsTold,
} from './the-order-from-above'

const NOW = new Date('2026-11-12T09:21:00+11:00')
const AT = '2026-11-12T09:12:00+11:00'

const row = (over: any = {}) => ({
  order_from: { by: 'u1', byName: 'Fabio', at: AT, dealIds: ['b', 'a', 'v'], note: 'ANZ by 2pm.' },
  seen_at: null,
  ...over,
})

describe('what management wrote', () => {
  it('is read back whole', () => {
    const o = orderFrom(row())!
    expect(o.byName).toBe('Fabio')
    expect(o.dealIds).toEqual(['b', 'a', 'v'])
    expect(o.note).toBe('ANZ by 2pm.')
  })

  it('is nothing at all when no order has been set', () => {
    expect(orderFrom({})).toBe(null)
    expect(orderFrom({ order_from: {} })).toBe(null)
    expect(orderFrom(null)).toBe(null)
  })

  it('writes the order, who set it and why', () => {
    const p = orderPatch({ id: 'u1', name: 'Fabio' }, ['b', 'a'], 'ANZ by 2pm.', new Date(AT))
    expect(p.deal_ids).toEqual(['b', 'a'])
    expect(p.order_from.byName).toBe('Fabio')
    expect(p.order_from.note).toBe('ANZ by 2pm.')
  })

  // A SECOND CHANGE MUST RAISE THE FLAG LIKE THE FIRST.
  it('clears her Got it, so a new order is unseen again', () => {
    expect(orderPatch({ id: 'u1', name: 'Fabio' }, ['a'], '', new Date(AT)).seen_at).toBe(null)
  })

  it('refuses to carry an essay', () => {
    const p = orderPatch({ id: 'u1', name: 'F' }, ['a'], 'x'.repeat(900), new Date(AT))
    expect(p.order_from.note.length).toBe(400)
  })
})

describe('has she seen it', () => {
  it('no, while she has not pressed anything', () => {
    expect(unseen(row())).toBe(true)
  })

  it('yes, once she has', () => {
    expect(unseen(row({ seen_at: '2026-11-12T09:14:00+11:00' }))).toBe(false)
  })

  // By timestamp, not by a flag - so nobody has to remember to clear anything.
  it('and no again when he changes it after she looked', () => {
    const later = {
      order_from: { by: 'u1', byName: 'Fabio', at: '2026-11-12T10:30:00+11:00', dealIds: ['a'], note: '' },
      seen_at: '2026-11-12T09:14:00+11:00',
    }
    expect(unseen(later)).toBe(true)
  })

  it('is never raised when no order was set', () => {
    expect(unseen({})).toBe(false)
  })
})

describe('the strip on her screen', () => {
  it('names him, the time, and what he said', () => {
    const told = whatSheIsTold(row(), ['a', 'b'], NOW)!
    expect(told.line).toContain('Fabio changed your order at')
    expect(told.note).toBe('ANZ by 2pm.')
  })

  // "He also put Van Der Beek on your day" - true, because it is worked out
  // against the day SHE saved rather than guessed.
  it('says what he added that she had not picked', () => {
    expect(whatSheIsTold(row(), ['a', 'b'], NOW)!.added).toEqual(['v'])
    expect(whatSheIsTold(row(), ['a', 'b', 'v'], NOW)!.added).toEqual([])
  })

  it('says nothing once she has pressed Got it', () => {
    expect(whatSheIsTold(row({ seen_at: '2026-11-12T09:14:00+11:00' }), ['a'], NOW)).toBe(null)
  })

  it('says nothing when nobody has ordered anything', () => {
    expect(whatSheIsTold({}, ['a'], NOW)).toBe(null)
  })

  it('leaves the time off when it was not today', () => {
    const old = row({ order_from: { ...row().order_from, at: '2026-11-10T09:12:00+11:00' } })
    expect(whatSheIsTold(old, [], NOW)!.line).toBe('Fabio changed your order.')
  })

  it('falls back to a word rather than printing nobody', () => {
    const anon = row({ order_from: { ...row().order_from, byName: '' } })
    expect(whatSheIsTold(anon, [], NOW)!.line).toContain('Management changed your order')
  })
})

describe("management's own screen", () => {
  it('says nothing to do where no order was set', () => {
    expect(seenState({}, NOW).none).toBe(true)
  })

  it('says when she saw it', () => {
    const s = seenState(row({ seen_at: '2026-11-12T09:14:00+11:00' }), NOW)
    expect(s.seen).toBe(true)
    expect(s.words).toContain('Seen')
  })

  // THE ONE STATE WORTH A PHONE CALL, said in minutes.
  it('says how long it has sat unopened', () => {
    const s = seenState(row(), NOW)
    expect(s.seen).toBe(false)
    expect(s.waiting).toBe(9)
    expect(s.words).toContain('Not opened yet')
  })

  it('counts minutes, and never a negative one', () => {
    expect(minutesSince(AT, NOW)).toBe(9)
    expect(minutesSince('2026-11-12T09:30:00+11:00', NOW)).toBe(0)
    expect(minutesSince('')).toBe(null)
    expect(minutesSince('not a date')).toBe(null)
  })
})

describe('arranging it', () => {
  it('moves one up and one down', () => {
    expect(moveBy(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b'])
    expect(moveBy(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c'])
  })

  it('does nothing at the ends, or to something not there', () => {
    expect(moveBy(['a', 'b'], 'a', -1)).toEqual(['a', 'b'])
    expect(moveBy(['a', 'b'], 'b', 1)).toEqual(['a', 'b'])
    expect(moveBy(['a', 'b'], 'zz', -1)).toEqual(['a', 'b'])
  })

  it('pulls one onto today, once', () => {
    expect(putOn(['a'], 'b')).toEqual(['a', 'b'])
    expect(putOn(['a', 'b'], 'b')).toEqual(['a', 'b'])
    expect(putOn(['a'], '')).toEqual(['a'])
  })

  // IT GOES BACK TO HER QUEUE, NOT AWAY. Nothing here deletes anybody's work.
  it('takes one off today again', () => {
    expect(takeOff(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('knows what was added to her own list', () => {
    expect(putOnHerDay(orderFrom(row()), ['a', 'b'])).toEqual(['v'])
    expect(putOnHerDay(null, ['a'])).toEqual([])
  })
})
