import { describe, it, expect } from 'vitest'
import { bcLanes, inLaneOrder, laneOf, sentOn } from './bc-lanes'

// THE BC COLUMN, IN TWO LANES.
//
// Fabio, 15 Sep 2026: he wanted to see from the board when a BC has actually
// gone to a client. The column could not answer the question he asks of it -
// how many are still on us, and how many are sitting with clients.
//
// Nothing new is recorded. deals.bc_sent_at has existed since the Send to
// client button did; it just never reached the board.

const prep = (id: string) => ({ id, deal_name: id })
const sent = (id: string, at: string) => ({ id, deal_name: id, bc_sent_at: at })

describe('which lane a deal is in', () => {
  it('is waiting on us until it has been sent', () => {
    expect(laneOf(prep('a'))).toBe('preparing')
    expect(laneOf({ id: 'a', bc_sent_at: null })).toBe('preparing')
    expect(laneOf({ id: 'a', bc_sent_at: '' })).toBe('preparing')
  })

  it('is with the client once it has', () => {
    expect(laneOf(sent('a', '2026-09-11T02:00:00.000Z'))).toBe('sent')
  })
})

describe('the lanes', () => {
  const cards = [prep('a'), sent('b', '2026-09-11T02:00:00.000Z'), prep('c'), sent('d', '2026-09-08T02:00:00.000Z')]

  it('names both, with a count each', () => {
    const lanes = bcLanes(cards)
    expect(lanes.map(l => [l.label, l.items.length])).toEqual([
      ['Being prepared', 2], ['With the client', 2],
    ])
  })

  it('puts what is still on us first', () => {
    expect(inLaneOrder(cards).map(d => d.id)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('NEVER SHOWS A HEADING OVER AN EMPTY LANE', () => {
    expect(bcLanes([prep('a'), prep('c')]).map(l => l.key)).toEqual(['preparing'])
    expect(bcLanes([sent('b', '2026-09-11T02:00:00.000Z')]).map(l => l.key)).toEqual(['sent'])
  })

  it('has nothing to say about an empty column', () => {
    expect(bcLanes([])).toEqual([])
    expect(inLaneOrder([])).toEqual([])
  })

  it('keeps every card - a card cannot fall between the lanes', () => {
    expect(inLaneOrder(cards)).toHaveLength(cards.length)
  })
})

describe('the date on the card', () => {
  it('says when it went', () => {
    // "Sep" or "Sept" depending on the browser's own month names - the board
    // has always used whatever the browser says, and this follows it rather
    // than pinning a spelling that would differ from the date beside it.
    expect(sentOn(sent('b', '2026-09-11T02:00:00.000Z'))).toMatch(/^sent 11 Sept?$/)
  })

  it('says nothing for one that has not', () => {
    expect(sentOn(prep('a'))).toBe('')
    expect(sentOn(null)).toBe('')
  })

  it('says nothing rather than "Invalid Date"', () => {
    expect(sentOn({ bc_sent_at: 'not a date' })).toBe('')
  })
})
