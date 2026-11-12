// ONE LIST, IN THE ORDER YOU CHOOSE TO DO IT.
//
// Alan's item 3, and Fabio's four answers on 11 Nov 2026: the queue is a
// person's own allocated work, credit arranges their own order, only whoever
// set an urgent flag can take it off, and a deal credit cannot action goes
// back to the broker.
import { describe, it, expect } from 'vitest'
import {
  urgentOn, urgentLine, urgentPatch, validateUrgent, mayClearUrgent, NOT_URGENT_PATCH,
  stuckOn, validateStuck, stuckPatch, stageFor,
} from './my-work'

const NOW = new Date('2026-11-11T00:00:00')
const ago = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString()

// Allocated to Mel, BC still open.
const mine = (over: any = {}) => ({
  id: 'd' + Math.random().toString(36).slice(2),
  assigned_broker: 'jess',
  bc_owner_officer: 'mel', bc_owner_name: 'Mellissa Sedin', bc_owner_since: ago(2),
  ...over,
})

describe('urgent carries its reason or it does not exist', () => {
  it('refuses a flag with nothing behind it', () => {
    expect(validateUrgent('')).toContain('Say why')
    expect(validateUrgent('asap')).toContain('A few more words')
    expect(validateUrgent('The finance clause is Friday.')).toBe('')
  })

  it('writes down who said it and when', () => {
    const p = urgentPatch({ id: 'u1', name: 'Jess Moreton' }, 'Finance clause is Friday.', NOW)
    expect(p.urgent_by).toBe('u1')
    expect(p.urgent_by_name).toBe('Jess Moreton')
    expect(p.urgent_why).toBe('Finance clause is Friday.')
    expect(urgentOn({ ...p })!.why).toBe('Finance clause is Friday.')
  })

  // A deal marked an hour ago and one that has carried the word for a week are
  // different problems, and the line says which.
  it('says how long it has carried the word', () => {
    const deal = { ...urgentPatch({ id: 'u1', name: 'Jess Moreton' }, 'Finance clause is Friday.', NOW) }
    expect(urgentLine(deal, NOW)).toBe('Urgent — Jess Moreton, today: Finance clause is Friday.')
    const older = { ...deal, urgent_at: ago(2) }
    expect(urgentLine(older, NOW)).toContain('2 days ago')
  })

  // THE ONE FABIO WAS ASKED STRAIGHT OUT. Credit must not be able to clear
  // their own queue by unflagging it.
  it('lets only whoever put it on take it off', () => {
    const deal = { ...urgentPatch({ id: 'u1', name: 'Jess Moreton' }, 'Finance clause is Friday.', NOW) }
    expect(mayClearUrgent(deal, { id: 'u1', name: 'Jess Moreton' })).toBe(true)
    expect(mayClearUrgent(deal, { id: 'u2', name: 'Mellissa Sedin' })).toBe(false)
  })

  // An older flag with no id on it still has to be clearable by somebody, or
  // it sits on the deal for ever.
  it('falls back to the name, and then to anybody', () => {
    expect(mayClearUrgent({ urgent_at: ago(1), urgent_by_name: 'Jess Moreton' },
      { id: 'x', name: 'jess moreton' })).toBe(true)
    expect(mayClearUrgent({ urgent_at: ago(1) }, { id: 'x', name: 'Anyone' })).toBe(true)
  })

  it('and clearing it leaves nothing behind', () => {
    expect(urgentOn({ ...NOT_URGENT_PATCH })).toBe(null)
  })
})

describe('a deal credit cannot action goes back to the broker', () => {
  // Fabio: "don't want buttons just an explanation... make field enough for a
  // couple of sentences."
  it('wants a couple of sentences, not a word', () => {
    expect(validateStuck('')).toContain('Say what is stopping you')
    expect(validateStuck('no payslips')).toContain('A couple of sentences')
    expect(validateStuck('The payslips are from July and the lender wants two inside 60 days.'))
      .toBe('')
  })

  // One write moves it off the queue, onto the broker's list and onto the
  // board, because every screen already reads who owns a stage.
  it('hands the stage to the broker and records why', () => {
    const deal = mine()
    const p = stuckPatch(deal, 'bc', { name: 'Mellissa Sedin' }, 'Payslips are out of date.', NOW)
    expect(p.bc_owner_officer).toBe(null)
    expect(p.bc_owner_name).toBe('jess')
    expect(p.stuck_by_name).toBe('Mellissa Sedin')
    expect(stuckOn({ ...deal, ...p })!.why).toBe('Payslips are out of date.')
  })

  it('and it leaves that person’s queue the moment it is written', () => {
    const deal = mine()
    expect(stageFor(deal, 'mel')).toBe('bc')
    expect(stageFor({ ...deal, ...stuckPatch(deal, 'bc', {}, 'x'.repeat(30), NOW) }, 'mel'))
      .toBe(null)
  })
})

// THE QUEUE'S OWN TESTS WENT WITH IT. 12 Nov 2026 - My work was Today twice,
// so myWork(), sortQueue(), orderAfterMove() and the broker-place wording are
// deleted. What is left here is what the deal page still uses.
