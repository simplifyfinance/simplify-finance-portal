// ONE LIST, IN THE ORDER YOU CHOOSE TO DO IT.
//
// Alan's item 3, and Fabio's four answers on 11 Nov 2026: the queue is a
// person's own allocated work, credit arranges their own order, only whoever
// set an urgent flag can take it off, and a deal credit cannot action goes
// back to the broker.
import { describe, it, expect } from 'vitest'
import {
  urgentOn, urgentLine, urgentPatch, validateUrgent, mayClearUrgent, NOT_URGENT_PATCH,
  stuckOn, validateStuck, stuckPatch,
  myWork, sortQueue, orderAfterMove, stageFor, brokerPlaceWords, ordinal,
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

describe('the queue', () => {
  it('is only what is allocated to this person', () => {
    const deals = [mine(), mine({ bc_owner_officer: 'kylie' }), mine({ status: 'lost' })]
    expect(myWork(deals, 'mel', NOW)).toHaveLength(1)
  })

  it('and a finished stage is not work', () => {
    expect(myWork([mine({ bc_completed_at: ago(1) })], 'mel', NOW)).toHaveLength(0)
  })

  it('counts the days from when it became theirs', () => {
    expect(myWork([mine({ bc_owner_since: ago(3) })], 'mel', NOW)[0].waitingDays).toBe(3)
  })

  // Until somebody drags something, the default is the honest one.
  it('starts urgent above everything that is not urgent', () => {
    const plain = mine({ id: 'plain', bc_owner_since: ago(9) })
    const hot = mine({
      id: 'hot', bc_owner_since: ago(1),
      urgent_at: ago(1), urgent_by: 'u1', urgent_by_name: 'Jess', urgent_why: 'Finance clause Friday.',
    })
    expect(myWork([plain, hot], 'mel', NOW).map(i => i.deal.id)).toEqual(['hot', 'plain'])
  })

  it('then by whatever has been sitting longest', () => {
    const old = mine({ id: 'old', bc_owner_since: ago(9) })
    const fresh = mine({ id: 'fresh', bc_owner_since: ago(1) })
    expect(myWork([fresh, old], 'mel', NOW).map(i => i.deal.id)).toEqual(['old', 'fresh'])
  })

  // FABIO'S ANSWER: credit can re-order their own queue. A row somebody has
  // placed stays where they put it.
  it('keeps a row where its owner put it', () => {
    const a = mine({ id: 'a', credit_order: 2, bc_owner_since: ago(9) })
    const b = mine({ id: 'b', credit_order: 1, bc_owner_since: ago(1) })
    expect(myWork([a, b], 'mel', NOW).map(i => i.deal.id)).toEqual(['b', 'a'])
  })

  it('and anything unplaced falls in underneath', () => {
    const placed = mine({ id: 'placed', credit_order: 1, bc_owner_since: ago(1) })
    const loose = mine({ id: 'loose', bc_owner_since: ago(9) })
    expect(sortQueue(myWork([loose, placed], 'mel', NOW)).map(i => i.deal.id))
      .toEqual(['placed', 'loose'])
  })

  // A list half placed and half defaulted rearranges itself behind somebody's
  // back, so moving one row numbers all of them.
  it('numbers every row when one is moved', () => {
    const items = myWork([mine({ id: 'a' }), mine({ id: 'b' }), mine({ id: 'c' })], 'mel', NOW)
    const next = orderAfterMove(items, 2, 0)
    expect(next.map(n => n.credit_order)).toEqual([1, 2, 3])
    expect(next[0].id).toBe(items[2].deal.id)
    expect(next).toHaveLength(3)
  })

  it('and refuses a move that goes nowhere', () => {
    const items = myWork([mine()], 'mel', NOW)
    expect(orderAfterMove(items, 0, 5)).toEqual([])
  })
})

describe("the broker's own order is a marker, not the sort", () => {
  it('says whose opinion it is', () => {
    const items = myWork([mine({ broker_priority: 1 })], 'mel', NOW)
    expect(brokerPlaceWords(items[0], 'Pat Walsh')).toBe('Pat’s 1st')
    expect(brokerPlaceWords(items[0], '')).toBe('jess’s 1st')
  })

  it('says nothing where the broker has no opinion', () => {
    expect(brokerPlaceWords(myWork([mine()], 'mel', NOW)[0], 'Pat Walsh')).toBe('')
  })

  // It does not decide the order - that is the whole of Fabio's answer.
  it('does not move a deal up the queue', () => {
    const second = mine({ id: 'second', broker_priority: 1, bc_owner_since: ago(1) })
    const first = mine({ id: 'first', bc_owner_since: ago(9) })
    expect(myWork([second, first], 'mel', NOW).map(i => i.deal.id)).toEqual(['first', 'second'])
  })

  it('counts in words a person would use', () => {
    expect([1, 2, 3, 4, 11, 21].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '21st'])
  })
})
