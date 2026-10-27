// ONE ASK EACH, PER BROKER, PER DAY.
//
// 27 Oct 2026. Catherine, Operations Manager: "When Mark and Kylie
// reprioritise, other brokers' deals, like Justin's, keep getting pushed back.
// Possibly a queuing system?"
//
// The test that matters most in this file is the one named after her
// complaint. Everything else is scaffolding around it.
import { describe, it, expect } from 'vitest'
import {
  askOn, askPatch, clearAskPatch, validateAsk, alreadyAsked,
  interleaveByBroker, askChip,
} from './a-slot-each'

const DAY = '2026-10-27'
const at = (hhmm: string) => `${DAY}T${hhmm}:00+11:00`

const deal = (id: string, by: string, hhmm: string, why = 'Finance clause Friday, agent asked twice') =>
  ({ id, priority_by: by, priority_why: why, priority_at: at(hhmm), priority_day: DAY })

describe('an ask on a deal', () => {
  it('is read back with who, why and when', () => {
    const a = askOn(deal('d1', 'mark', '08:10'), DAY)
    expect(a?.by).toBe('mark')
    expect(a?.why).toContain('Finance clause')
  })

  it('a key and a name are the same broker', () => {
    // Deals carry "mark"; a dropdown carries "Mark Gallo". Same person.
    expect(askOn({ ...deal('d1', 'Mark Gallo', '08:10') }, DAY)?.by).toBe('mark')
  })

  it('AND YESTERDAY’S ASK IS NOT TODAY’S', () => {
    // A slot resets overnight whether or not it was used. Without this, an ask
    // from last Tuesday sits at the top of somebody's day forever and the list
    // quietly stops being about today.
    expect(askOn({ ...deal('d1', 'mark', '08:10'), priority_day: '2026-10-26' }, DAY)).toBeNull()
  })

  it('and a deal nobody asked for has none', () => {
    expect(askOn({ id: 'd1' }, DAY)).toBeNull()
    expect(askOn({ id: 'd1', priority_by: '', priority_day: DAY }, DAY)).toBeNull()
  })
})

describe('asking', () => {
  it('needs a reason, like every other box in the portal', () => {
    expect(validateAsk({ by: 'mark' })).toContain('Say why')
    expect(validateAsk({ by: 'mark', why: 'urgent' })).toContain('Say why')
    expect(validateAsk({ by: 'mark', why: 'Finance clause is Friday' })).toBe('')
  })

  it('and a broker to ask on behalf of', () => {
    expect(validateAsk({ why: 'Finance clause is Friday' })).toContain('No broker')
  })

  it('writes the key, not the name', () => {
    const p = askPatch({ by: 'Mark Gallo', why: 'Finance clause is Friday' },
                       new Date(at('08:10')), DAY)
    expect(p.priority_by).toBe('mark')
    expect(p.priority_day).toBe(DAY)
  })

  it('and moving the slot clears the old one completely', () => {
    expect(clearAskPatch()).toEqual({
      priority_by: null, priority_why: null, priority_at: null, priority_day: null,
    })
  })
})

describe('one a day', () => {
  const book = [deal('d1', 'mark', '08:10'), deal('d2', 'justin', '08:20'), { id: 'd3' }]

  it('finds the one this broker already asked for', () => {
    expect(alreadyAsked(book, 'mark', DAY)?.id).toBe('d1')
    expect(alreadyAsked(book, 'Mark Gallo', DAY)?.id).toBe('d1')
  })

  it('and nothing for a broker who has not asked', () => {
    expect(alreadyAsked(book, 'kylie', DAY)).toBeNull()
  })

  it('yesterday’s does not count against today’s slot', () => {
    const old = [{ ...deal('d1', 'mark', '08:10'), priority_day: '2026-10-26' }]
    expect(alreadyAsked(old, 'mark', DAY)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
describe('CATHERINE’S COMPLAINT, which is the whole point', () => {
  // Mark gets in first, three times. Justin and Kylie ask once each, later.
  const asked = [
    { id: 'm1', ask: askOn(deal('m1', 'mark', '08:00'), DAY) },
    { id: 'm2', ask: askOn(deal('m2', 'mark', '08:05'), DAY) },
    { id: 'm3', ask: askOn(deal('m3', 'mark', '08:09'), DAY) },
    { id: 'k1', ask: askOn(deal('k1', 'kylie', '08:30'), DAY) },
    { id: 'j1', ask: askOn(deal('j1', 'justin', '09:40'), DAY) },
  ]

  it('first come first served would bury Justin, which is what happens today', () => {
    const byTime = [...asked].sort((a, b) =>
      new Date(a.ask!.at).getTime() - new Date(b.ask!.at).getTime())
    expect(byTime.map(x => x.id)).toEqual(['m1', 'm2', 'm3', 'k1', 'j1'])
  })

  it('and a slot each does not', () => {
    expect(interleaveByBroker(asked).map(x => x.id))
      .toEqual(['m1', 'k1', 'j1', 'm2', 'm3'])
  })

  it('Mark still goes first, because he asked first', () => {
    // This is not a punishment for chasing. It is a limit on how far ahead
    // chasing gets you.
    expect(interleaveByBroker(asked)[0].id).toBe('m1')
  })

  it('and Justin is seen before Mark gets a second one', () => {
    const order = interleaveByBroker(asked).map(x => x.id)
    expect(order.indexOf('j1')).toBeLessThan(order.indexOf('m2'))
  })
})

describe('the ordering in ordinary cases', () => {
  it('one ask each comes out in the order they asked', () => {
    const three = [
      { id: 'k', ask: askOn(deal('k', 'kylie', '09:00'), DAY) },
      { id: 'm', ask: askOn(deal('m', 'mark', '08:00'), DAY) },
      { id: 'j', ask: askOn(deal('j', 'justin', '08:30'), DAY) },
    ]
    expect(interleaveByBroker(three).map(x => x.id)).toEqual(['m', 'j', 'k'])
  })

  it('one ask on its own is just itself', () => {
    const one = [{ id: 'm', ask: askOn(deal('m', 'mark', '08:00'), DAY) }]
    expect(interleaveByBroker(one).map(x => x.id)).toEqual(['m'])
  })

  it('and deals nobody asked for are not in the list at all', () => {
    const mixed = [{ id: 'x', ask: null }, { id: 'm', ask: askOn(deal('m', 'mark', '08:00'), DAY) }]
    expect(interleaveByBroker(mixed).map(x => x.id)).toEqual(['m'])
    expect(interleaveByBroker([{ id: 'x', ask: null }])).toEqual([])
  })

  it('a broker with two keeps their own in the order they asked', () => {
    const two = [
      { id: 'm2', ask: askOn(deal('m2', 'mark', '09:00'), DAY) },
      { id: 'm1', ask: askOn(deal('m1', 'mark', '08:00'), DAY) },
    ]
    expect(interleaveByBroker(two).map(x => x.id)).toEqual(['m1', 'm2'])
  })

  it('and nothing is ever lost from the list', () => {
    const many = ['mark', 'kylie', 'justin', 'mark', 'keanen', 'kylie']
      .map((b, i) => ({ id: `d${i}`, ask: askOn(deal(`d${i}`, b, `08:${String(i).padStart(2, '0')}`), DAY) }))
    const out = interleaveByBroker(many)
    expect(out).toHaveLength(many.length)
    expect(new Set(out.map(x => x.id)).size).toBe(many.length)
  })
})

describe('what credit reads on the row', () => {
  it('names the broker who asked', () => {
    expect(askChip(askOn(deal('d1', 'justin', '09:40'), DAY), 'Justin'))
      .toBe('JUSTIN ASKED FOR THIS')
  })

  it('and falls back to the key rather than saying nothing', () => {
    expect(askChip(askOn(deal('d1', 'justin', '09:40'), DAY))).toBe('JUSTIN ASKED FOR THIS')
    expect(askChip(null)).toBe('')
  })
})
