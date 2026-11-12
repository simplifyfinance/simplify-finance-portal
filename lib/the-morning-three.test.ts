// THREE THINGS TO PRESS, IN ORDER.
//
// Invented client names throughout.
import { describe, it, expect } from 'vitest'
import {
  keyOf, stillOwed, toggleRemoved, whereSheIsUpTo, withAdded, withoutAdded,
  yesterdayShown, type Done,
} from './the-morning-three'

const bc: Done = { id: 'd1', name: 'Okonkwo, C', what: 'BC', days: 1.1 }
const comp: Done = { id: 'd2', name: 'Ivanishvili, N', what: 'Compliance', days: 2.4 }

describe('the list she is agreeing with', () => {
  it('is what the portal saw, when she changes nothing', () => {
    expect(yesterdayShown([bc, comp])).toEqual([bc, comp])
  })

  // ONE DEAL CAN FINISH TWO STAGES IN A DAY. Keying on the deal alone would
  // have "Not me" on the BC quietly remove a compliance she did finish.
  it('takes off only the stage she pressed Not me on', () => {
    const both: Done[] = [bc, { ...bc, what: 'Compliance', days: 0.2 }]
    const out = yesterdayShown(both, [], [keyOf('d1', 'BC')])
    expect(out).toHaveLength(1)
    expect(out[0].what).toBe('Compliance')
  })

  it('puts what she added on the end, marked as hers', () => {
    const out = yesterdayShown([bc], [{ id: 'd9', name: 'Petrakis, A', what: 'Lending options' }])
    expect(out).toHaveLength(2)
    expect(out[1]).toEqual({
      id: 'd9', name: 'Petrakis, A', what: 'Lending options', days: null, byHand: true,
    })
  })

  // The portal has since seen it move, so both rows exist. The portal's is the
  // one that carries the real elapsed days.
  it('does not list a deal twice when the portal catches up', () => {
    const out = yesterdayShown([bc], [{ id: 'd1', name: 'Okonkwo, C', what: 'BC' }])
    expect(out).toEqual([bc])
  })

  it('ignores half a row', () => {
    expect(yesterdayShown([bc], [{ id: '', name: 'x', what: 'BC' }])).toEqual([bc])
    expect(yesterdayShown([bc], [{ id: 'd9', name: 'x', what: '' }])).toEqual([bc])
  })

  it('survives being handed nothing', () => {
    expect(yesterdayShown([])).toEqual([])
    expect(yesterdayShown(null as any, null as any, null as any)).toEqual([])
  })
})

describe('her corrections', () => {
  it('Not me goes on and comes off again', () => {
    const once = toggleRemoved([], 'd1', 'BC')
    expect(once).toEqual(['d1|BC'])
    expect(toggleRemoved(once, 'd1', 'BC')).toEqual([])
  })

  it('adding the same thing twice adds it once', () => {
    const row = { id: 'd9', name: 'Petrakis, A', what: 'BC' }
    expect(withAdded(withAdded([], row), row)).toHaveLength(1)
  })

  it('and can be taken off again', () => {
    const list = withAdded([], { id: 'd9', name: 'Petrakis, A', what: 'BC' })
    expect(withoutAdded(list, 'd9', 'BC')).toEqual([])
  })
})

// THE THIRD BUTTON NEVER INVITES A PRESS IT WOULD REFUSE.
//
// A button saying "Inform management" that then does nothing teaches people
// the screen is broken.
describe('what the third button says', () => {
  it('says nothing has gone, until both are done', () => {
    const none = whereSheIsUpTo({})
    expect(none.ready).toBe(false)
    expect(none.label).toBe('Nothing has been sent yet')

    const half = whereSheIsUpTo({ yesterdayOkAt: '2026-11-12T08:04:00Z' })
    expect(half.ready).toBe(false)
    expect(half.label).toBe('Nothing has been sent yet')
  })

  it('works once both are done', () => {
    const w = whereSheIsUpTo({
      yesterdayOkAt: '2026-11-12T08:04:00Z', daySavedAt: '2026-11-12T08:09:00Z',
    })
    expect(w.ready).toBe(true)
    expect(w.label).toBe('Inform management')
  })

  // AN EMPTY DAY IS A REAL ANSWER. Somebody on leave, or a morning of nothing
  // but phone calls, has still told us what today looks like.
  it('counts a saved day even when she picked nothing', () => {
    expect(whereSheIsUpTo({ daySavedAt: '2026-11-12T08:09:00Z' }).today).toBe(true)
  })

  it('says so once it has gone', () => {
    const w = whereSheIsUpTo({
      yesterdayOkAt: 'a', daySavedAt: 'b', sentAt: '2026-11-12T08:11:00Z',
    })
    expect(w.sent).toBe(true)
    expect(w.label).toBe('Sent to management')
  })

  it('names what is still owed, in the order she does it', () => {
    expect(stillOwed(whereSheIsUpTo({})))
      .toEqual(['What you did yesterday', 'What you are doing today'])
    expect(stillOwed(whereSheIsUpTo({ yesterdayOkAt: 'a' })))
      .toEqual(['What you are doing today'])
    expect(stillOwed(whereSheIsUpTo({ yesterdayOkAt: 'a', daySavedAt: 'b' }))).toEqual([])
  })
})
