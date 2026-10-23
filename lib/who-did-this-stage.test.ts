// EACH STAGE REMEMBERS ITS OWN PERSON.
//
// 23 Oct 2026. The portal kept one credit officer for the whole deal, so a
// broker who wrote the BC and handed the lending options to Sylvan produced a
// file that said Sylvan did both. Fabio: "i need each stage tro be recoreded
// and managed by that perison remmeber as we measure productivy".
import { describe, it, expect } from 'vitest'
import {
  ownerOf, defaultOwnerFor, showingOwner, daysOnStage, handOver,
  needsAllocating, STAGES, STAGE_LABEL,
} from './who-did-this-stage'

const deal = (x: any = {}) => ({ assigned_broker: 'Mark', ...x })

describe('who owns a stage', () => {
  it('nobody, until somebody does', () => {
    expect(ownerOf(deal(), 'bc')).toBeNull()
  })

  it('a broker who kept it', () => {
    const o = ownerOf(deal({ bc_owner_name: 'Mark', bc_owner_since: '2026-10-20T09:00:00Z' }), 'bc')!
    expect(o.name).toBe('Mark')
    expect(o.isCredit).toBe(false)
  })

  it('a credit officer who was given it', () => {
    const o = ownerOf(deal({ bc_owner_officer: 'katie-id', bc_owner_name: 'Katie' }), 'bc')!
    expect(o.isCredit).toBe(true)
    expect(o.officerId).toBe('katie-id')
  })
})

describe('the rule Fabio gave: it carries forward', () => {
  it('allocated on the BC, the LO opens on the same person', () => {
    const d = deal({ bc_owner_officer: 'katie-id', bc_owner_name: 'Katie' })
    expect(defaultOwnerFor(d, 'lo')!.name).toBe('Katie')
    expect(showingOwner(d, 'lo')!.isCredit).toBe(true)
  })

  it('but it is only a default - the LO can go somewhere else', () => {
    const d = deal({ bc_owner_officer: 'katie-id', bc_owner_name: 'Katie',
                     lo_owner_officer: 'sylvan-id', lo_owner_name: 'Sylvan' })
    expect(showingOwner(d, 'lo')!.name).toBe('Sylvan')
    // AND THE BC IS UNTOUCHED. This is the whole point.
    expect(showingOwner(d, 'bc')!.name).toBe('Katie')
  })

  it('broker did the BC himself, then hands the LO to credit', () => {
    const d = deal({ bc_owner_name: 'Mark',
                     lo_owner_officer: 'sylvan-id', lo_owner_name: 'Sylvan' })
    expect(showingOwner(d, 'bc')!.isCredit).toBe(false)
    expect(showingOwner(d, 'bc')!.name).toBe('Mark')
    expect(showingOwner(d, 'lo')!.name).toBe('Sylvan')
  })

  it('and compliance carries from the LO, not the BC', () => {
    const d = deal({ bc_owner_name: 'Mark',
                     lo_owner_officer: 'sylvan-id', lo_owner_name: 'Sylvan' })
    expect(defaultOwnerFor(d, 'compliance')!.name).toBe('Sylvan')
  })

  it('nothing owned anywhere - it opens on the broker', () => {
    expect(defaultOwnerFor(deal(), 'bc')!.name).toBe('Mark')
    expect(defaultOwnerFor(deal(), 'bc')!.isCredit).toBe(false)
  })

  it('a default is never mistaken for a decision', () => {
    const d = deal({ bc_owner_officer: 'katie-id', bc_owner_name: 'Katie' })
    // The LO shows Katie, but nobody has answered the LO yet.
    expect(showingOwner(d, 'lo')!.name).toBe('Katie')
    expect(ownerOf(d, 'lo')).toBeNull()
    expect(defaultOwnerFor(d, 'lo')!.since).toBeNull()
  })
})

describe('the clock, which is what the productivity numbers read', () => {
  it('runs from when the stage became theirs', () => {
    const d = deal({ lo_owner_officer: 's', lo_owner_name: 'Sylvan', lo_owner_since: '2026-10-20T09:00:00Z' })
    expect(daysOnStage(d, 'lo', '2026-10-22T09:00:00Z')).toBe(2)
  })

  it('and stops when the stage was finished', () => {
    const d = deal({ bc_owner_officer: 'k', bc_owner_name: 'Katie', bc_owner_since: '2026-10-20T09:00:00Z' })
    const now = new Date('2026-10-30T09:00:00Z')
    expect(daysOnStage(d, 'bc', '2026-10-21T21:00:00Z', now)).toBe(1.5)
  })

  it('says nothing rather than guessing where no clock was running', () => {
    expect(daysOnStage(deal({ bc_owner_name: 'Mark' }), 'bc')).toBeNull()
    expect(daysOnStage(deal(), 'bc')).toBeNull()
  })

  it('three people on one deal, each on their own stage', () => {
    const d = deal({
      bc_owner_name: 'Mark', bc_owner_since: '2026-10-19T09:00:00Z',
      lo_owner_officer: 's', lo_owner_name: 'Sylvan', lo_owner_since: '2026-10-22T09:00:00Z',
      compliance_owner_officer: 'k', compliance_owner_name: 'Katie', compliance_owner_since: '2026-10-24T09:00:00Z',
    })
    expect(daysOnStage(d, 'bc', '2026-10-21T09:00:00Z')).toBe(2)
    expect(daysOnStage(d, 'lo', '2026-10-23T09:00:00Z')).toBe(1)
    expect(daysOnStage(d, 'compliance', '2026-10-25T09:00:00Z')).toBe(1)
  })
})

describe('handing a stage over', () => {
  it('writes the three columns for that stage and no other', () => {
    const w = handOver('lo', { officerId: 'sylvan-id', name: 'Sylvan' }, new Date('2026-10-23T09:00:00Z'))
    expect(Object.keys(w).sort()).toEqual(['lo_owner_name', 'lo_owner_officer', 'lo_owner_since'])
    expect(w.lo_owner_since).toBe('2026-10-23T09:00:00.000Z')
  })

  it('a broker keeping it writes a name and no officer', () => {
    const w = handOver('bc', { officerId: null, name: 'Mark' })
    expect(w.bc_owner_officer).toBeNull()
    expect(w.bc_owner_name).toBe('Mark')
  })
})

describe('the queue runs per stage, not per deal', () => {
  it('a stage with no officer needs the queue', () => {
    expect(needsAllocating(deal({ bc_owner_name: 'Mark' }), 'lo')).toBe(true)
  })

  it('a stage that already has one does not', () => {
    expect(needsAllocating(deal({ lo_owner_officer: 's', lo_owner_name: 'Sylvan' }), 'lo')).toBe(false)
  })

  // THE BUG THIS REPLACES. allocateCreditOfficer() asked the DEAL whether it
  // had an officer and bailed out if it did - so a broker who did the BC
  // himself and then wanted the LO in the queue got nothing at all.
  it('the BC having an officer does not stop the LO being queued', () => {
    const d = deal({ bc_owner_officer: 'katie-id', bc_owner_name: 'Katie' })
    expect(needsAllocating(d, 'lo')).toBe(true)
  })
})

describe('the three stages', () => {
  it('are in the order a deal goes through them', () => {
    expect(STAGES).toEqual(['bc', 'lo', 'compliance'])
  })
  it('and are named the way the team says them', () => {
    expect(STAGE_LABEL.lo).toBe('Lending options')
  })
})
