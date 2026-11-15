// A TRAIL, NOT A BOX.
//
// 17 Nov 2026: "Every entry dated and named, nothing typed over. So 'what did
// we tell them last week' has an answer."
import { describe, it, expect } from 'vitest'
import { trailOf, seedFrom, trailFor, addPatch, entryLine } from './the-settlement-trail'

const NOW = new Date('2026-11-16T09:00:00Z')
const e = (at: string, by: string, text: string) => ({ at, by, text })

describe('the trail', () => {
  it('comes back newest first', () => {
    const raw = [e('2026-11-10T00:00:00Z', 'A', 'older'), e('2026-11-12T00:00:00Z', 'B', 'newer')]
    expect(trailOf(raw).map(x => x.text)).toEqual(['newer', 'older'])
  })

  // A COLUMN THAT HAS HELD THREE SHAPES WILL HAND BACK A SURPRISE ONE DAY.
  it('and anything that is not an entry is dropped, not drawn as a blank row', () => {
    expect(trailOf([null, 'words', {}, { text: '   ' }, e('x', 'y', 'real')]).map(x => x.text))
      .toEqual(['real'])
    expect(trailOf(null)).toEqual([])
    expect(trailOf({})).toEqual([])
  })
})

// NOTHING IS LOST TURNING THE OLD BOX INTO A TRAIL.
describe('the one-line note that was there before', () => {
  it('becomes the first entry', () => {
    const d = { settlement_note: 'settling 3pm', settlement_updated_at: '2026-11-01T00:00:00Z' }
    const t = trailFor(d)
    expect(t).toHaveLength(1)
    expect(t[0].text).toBe('settling 3pm')
    expect(t[0].at).toBe('2026-11-01T00:00:00Z')
  })

  // A deal written on since is already carrying its history, and an old
  // sentence must not be pushed into the middle of it.
  it('but never once somebody has written on the trail', () => {
    const d = {
      settlement_note: 'settling 3pm',
      settlement_trail: [e('2026-11-12T00:00:00Z', 'Belle', 'Docs back')],
    }
    expect(trailFor(d).map(x => x.text)).toEqual(['Docs back'])
  })

  it('and a deal with neither has an empty trail', () => {
    expect(trailFor({})).toEqual([])
    expect(seedFrom('', '')).toEqual([])
  })
})

describe('writing on it', () => {
  it('puts the new entry on top, with a name and a time', () => {
    const p = addPatch({}, 'Called the client', 'Belle Nguyen', NOW)!
    expect(p.settlement_trail).toHaveLength(1)
    expect(p.settlement_trail[0]).toEqual({
      at: NOW.toISOString(), by: 'Belle Nguyen', text: 'Called the client',
    })
  })

  // NOTHING IS TYPED OVER. That is the whole point of the field.
  it('and keeps everything that was already there', () => {
    const d = { settlement_trail: [e('2026-11-12T00:00:00Z', 'Julian', 'Docs issued')] }
    const p = addPatch(d, 'Docs back', 'Belle', NOW)!
    expect(p.settlement_trail.map((x: any) => x.text)).toEqual(['Docs back', 'Docs issued'])
  })

  it('the old note is carried up when the first entry is written', () => {
    const d = { settlement_note: 'settling 3pm', settlement_updated_at: '2026-11-01T00:00:00Z' }
    const p = addPatch(d, 'Pushed to the 30th', 'Belle', NOW)!
    expect(p.settlement_trail.map((x: any) => x.text)).toEqual(['Pushed to the 30th', 'settling 3pm'])
  })

  it('an empty line writes nothing at all', () => {
    expect(addPatch({}, '', 'Belle', NOW)).toBe(null)
    expect(addPatch({}, '   ', 'Belle', NOW)).toBe(null)
  })

  // ATTN SETTLEMENTS IS THE SAME SHAPE, and it is the field that crosses the
  // handover - the broker writes into it before formal, settlements after.
  it('and the same thing serves ATTN Settlements', () => {
    const d = { attn_settlements: [e('2026-11-06T00:00:00Z', 'Fabio', 'Client travelling')] }
    const p = addPatch(d, 'Email CBA on settlement', 'Katie', NOW, 'attn_settlements')!
    expect(p.attn_settlements.map((x: any) => x.text))
      .toEqual(['Email CBA on settlement', 'Client travelling'])
    expect(p.settlement_trail).toBeUndefined()
  })

  it('and ATTN Settlements never inherits the settlement note', () => {
    expect(trailFor({ settlement_note: 'settling 3pm' }, 'attn_settlements')).toEqual([])
  })
})

describe('the line under an entry', () => {
  const fmt = (iso: string) => '12 Nov, 2:40 pm'

  it('names who wrote it and when', () => {
    expect(entryLine(e('2026-11-12T00:00:00Z', 'Belle Nguyen', 'x'), fmt))
      .toBe('Belle Nguyen · 12 Nov, 2:40 pm')
  })

  it('and reads as a time alone where nobody is named', () => {
    expect(entryLine(e('2026-11-12T00:00:00Z', '', 'x'), fmt)).toBe('12 Nov, 2:40 pm')
  })
})
