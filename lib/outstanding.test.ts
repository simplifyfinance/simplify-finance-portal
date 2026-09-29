// THE CONDITIONS A LENDER HANDS BACK AFTER LODGEMENT.
//
// Fabio, 29 Sep 2026, on why this needed a stage of its own: a conditionally
// approved deal was sitting in Lodged looking identical to one nobody had heard
// a word about.

import { describe, it, expect } from 'vitest'
import {
  outstandingItems, stillWaiting, received, allReceived, oldestWaitDays,
  waitingLine, waitTone, withNewItem, withReceived, withUnreceived, withoutItem,
} from './outstanding'
import { derivedPhaseOf, PHASE_ORDER, PHASE_FIELDS, moveBack } from './deal-phase'

const NOW = new Date('2026-09-29T09:00:00Z')
const ago = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString()

const deal = (items: any[]) => ({
  lodged_at: '2026-09-18T00:00:00Z',
  outstanding_at: '2026-09-25T00:00:00Z',
  outstanding_items: items,
})

const THREE = deal([
  { id: 'a', what: 'Signed privacy form', waitingOn: 'client', askedAt: ago(4),
    receivedAt: ago(3), receivedBy: 'Katie Amos' },
  { id: 'b', what: 'Two most recent payslips for Andrew', waitingOn: 'client', askedAt: ago(4) },
  { id: 'c', what: 'Council rates notice', waitingOn: 'client', askedAt: ago(4) },
])

describe('the stage sits between lodged and preapproved', () => {
  it('a conditionally approved deal is no longer indistinguishable from a lodged one', () => {
    expect(derivedPhaseOf({ lodged_at: '2026-09-18' })).toBe('lodged')
    expect(derivedPhaseOf(THREE)).toBe('outstanding')
  })

  it('does not replace the pre-approval - the deal moves on by itself', () => {
    expect(derivedPhaseOf({ ...THREE, preapproval_at: '2026-09-29' })).toBe('preapproved')
  })

  it('a deal approved outright skips it, the way deals already skip Preapproved', () => {
    expect(derivedPhaseOf({ lodged_at: '2026-09-18', preapproval_at: '2026-09-20' }))
      .toBe('preapproved')
  })

  it('sits in the right place in the order', () => {
    expect(PHASE_ORDER.indexOf('outstanding')).toBe(PHASE_ORDER.indexOf('lodged') + 1)
    expect(PHASE_ORDER.indexOf('outstanding')).toBeLessThan(PHASE_ORDER.indexOf('preapproved'))
  })

  it('moving back clears the DATE and never the list', () => {
    // "I dont want anyhtuing to be wiped out no data to be lost" - 3 Sep 2026.
    expect(PHASE_FIELDS.outstanding).toEqual(['outstanding_at'])
    const back = moveBack('outstanding', 'lodged')
    expect(back.ok).toBe(true)
    if (back.ok) expect(back.fields).not.toContain('outstanding_items')
  })
})

describe('what is outstanding, and who with', () => {
  it('splits what is in from what is not', () => {
    expect(stillWaiting(THREE).map(i => i.id)).toEqual(['b', 'c'])
    expect(received(THREE).map(i => i.id)).toEqual(['a'])
  })

  it('says it the way somebody would say it', () => {
    expect(waitingLine(THREE)).toBe('Waiting on the client for 2 of 3 items.')
  })

  it('names BOTH when two different people are waited on', () => {
    // Ringing the client about something the bank has is how a deal stalls
    // twice. It never picks one.
    const mixed = deal([
      { id: 'b', what: 'Payslips', waitingOn: 'client', askedAt: ago(2) },
      { id: 'd', what: 'Valuation', waitingOn: 'lender', askedAt: ago(2) },
    ])
    expect(waitingLine(mixed)).toBe('Waiting on the client and the lender for 2 items.')
  })

  it('says when everything is in', () => {
    const done = deal([{ id: 'a', what: 'X', waitingOn: 'client', askedAt: ago(3), receivedAt: ago(1) }])
    expect(waitingLine(done)).toBe('All 1 item is in.')
    expect(allReceived(done)).toBe(true)
  })

  it('an empty list is not a finished one', () => {
    // A deal with nothing recorded must never announce that its conditions are
    // satisfied - that is a client told they are approved when nobody checked.
    expect(allReceived(deal([]))).toBe(false)
    expect(allReceived({})).toBe(false)
    expect(waitingLine(deal([]))).toBe('')
  })
})

describe('the clock', () => {
  it('counts the oldest thing nobody has sent', () => {
    expect(oldestWaitDays(THREE, NOW)).toBe(4)
  })

  it('ignores what has already come in', () => {
    const old = deal([
      { id: 'a', what: 'In', waitingOn: 'client', askedAt: ago(40), receivedAt: ago(1) },
      { id: 'b', what: 'Out', waitingOn: 'client', askedAt: ago(2) },
    ])
    expect(oldestWaitDays(old, NOW)).toBe(2)
  })

  it('is amber at five days and red at ten, the same as the board', () => {
    expect(waitTone(4)).toBe('ok')
    expect(waitTone(5)).toBe('warn')
    expect(waitTone(9)).toBe('warn')
    expect(waitTone(10)).toBe('late')
    expect(waitTone(null)).toBe('ok')
  })
})

describe('writing the list', () => {
  it('adds an item without disturbing the others', () => {
    const next = withNewItem(THREE, 'Contract of sale', 'client', NOW)
    expect(next).toHaveLength(4)
    expect(next.slice(0, 3)).toEqual(outstandingItems(THREE))
    expect(next[3].what).toBe('Contract of sale')
    expect(next[3].receivedAt).toBeUndefined()
  })

  it('refuses a blank one', () => {
    expect(withNewItem(THREE, '   ', 'client', NOW)).toHaveLength(3)
  })

  it('ticking stamps who and when, and keeps the row', () => {
    const next = withReceived(THREE, 'b', 'Ellie Watts', NOW)
    expect(next).toHaveLength(3)
    const b = next.find(i => i.id === 'b')!
    expect(b.receivedBy).toBe('Ellie Watts')
    expect(b.what).toBe('Two most recent payslips for Andrew')
    // The date it was ASKED survives, because that is the age worth keeping.
    expect(b.askedAt).toBe(ago(4))
  })

  it('unticking puts it back without losing when it was asked for', () => {
    const ticked = withReceived(THREE, 'b', 'Ellie Watts', NOW)
    const back = withUnreceived({ outstanding_items: ticked }, 'b')
    const b = back.find(i => i.id === 'b')!
    expect(b.receivedAt).toBeUndefined()
    expect(b.receivedBy).toBeUndefined()
    expect(b.askedAt).toBe(ago(4))
  })

  it('removing one leaves the rest alone', () => {
    expect(withoutItem(THREE, 'b').map(i => i.id)).toEqual(['a', 'c'])
  })

  it('survives rubbish in the column', () => {
    expect(outstandingItems({ outstanding_items: 'not a list' })).toEqual([])
    expect(outstandingItems({ outstanding_items: [null, { what: '' }] })).toEqual([])
    // An unknown waitingOn is read as the client rather than thrown away: the
    // item still has to be chased by somebody.
    expect(outstandingItems({ outstanding_items: [{ what: 'X', waitingOn: 'nonsense' }] })[0].waitingOn)
      .toBe('client')
  })
})
