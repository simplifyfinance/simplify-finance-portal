import { describe, it, expect } from 'vitest'
import { settlementDraft, draftOrder, plannedWords, howManyPlanned, A_DAY } from './the-settlement-day'
import { SETTLEMENT_DEFAULTS } from './settlement-settings'
import { LINE } from './the-days-plan'

const TODAY = new Date('2026-11-18T23:00:00Z')   // 19 Nov in Sydney

// A deal that owes two jobs this morning: the numbers have not gone out, and
// it is a purchase inside the funds window.
const twoJobs = {
  id: 'a', deal_name: 'Kurt Gruber 2026', assigned_broker: 'mark',
  formal_approval_at: '2026-11-01T00:00:00Z',
  confirmed_settlement_date: '2026-11-20',
  transaction_type: 'purchase',
  stage: 'Settlement',
}
const noDate = {
  id: 'b', deal_name: 'Jamila Okonkwo 2026',
  formal_approval_at: '2026-11-03T00:00:00Z',
}

describe('the settlement day, drafted', () => {
  it('is one row per deal, however many jobs it owes', () => {
    const draft = settlementDraft([twoJobs, noDate], SETTLEMENT_DEFAULTS, TODAY)
    expect(draft.filter(d => d.id === 'a')).toHaveLength(1)
    expect(draft.find(d => d.id === 'a')!.jobs).toBeGreaterThan(1)
  })

  it('keeps the most urgent reason, which is the one the list leads with', () => {
    const draft = settlementDraft([twoJobs], SETTLEMENT_DEFAULTS, TODAY)
    // The numbers lead: they are due seven days out, the contribution three,
    // so on a deal settling tomorrow the numbers have been owed for longer.
    expect(draft[0].stage).toContain('Settlement numbers')
  })

  it('carries the broker, because a list that does not say whose file it is costs a phone call', () => {
    const draft = settlementDraft([twoJobs], SETTLEMENT_DEFAULTS, TODAY)
    expect(draft[0].broker).toBe('mark')
  })

  it('says nothing about a deal that owes nothing', () => {
    expect(settlementDraft([{ id: 'c', deal_name: 'Quiet 2026' }], SETTLEMENT_DEFAULTS, TODAY)).toEqual([])
  })

  it('does not throw on no deals at all', () => {
    expect(settlementDraft([], SETTLEMENT_DEFAULTS, TODAY)).toEqual([])
  })
})

describe('where the line starts the day', () => {
  const draft = Array.from({ length: 12 }, (_, i) => ({
    id: `d${i}`, name: `Deal ${i}`, stage: 'Gone quiet', since: '', jobs: 1,
  }))

  it('puts seven above the line and the rest below', () => {
    const order = draftOrder(draft)
    expect(order.indexOf(LINE)).toBe(A_DAY)
    expect(order).toHaveLength(13)
  })

  it('a day somebody has already said beats the draft', () => {
    const order = draftOrder(draft, ['d9', 'd2'])
    expect(order.slice(0, 3)).toEqual(['d9', 'd2', LINE])
  })

  it('and what arrived since goes to the end of the queue, not into their day', () => {
    const order = draftOrder(draft, ['d9'])
    expect(order.indexOf('d0')).toBeGreaterThan(order.indexOf(LINE))
  })

  it('forgets a saved deal that no longer owes anything', () => {
    expect(draftOrder(draft, ['gone'])).toEqual([
      ...draft.slice(0, A_DAY).map(d => d.id), LINE, ...draft.slice(A_DAY).map(d => d.id),
    ])
  })
})

describe('what management is told', () => {
  it('names the person, not the row', () => {
    expect(plannedWords('Belle Carmody', '2026-11-18T22:10:00Z')).toBe('Belle has said what today is')
    expect(plannedWords('Belle Carmody', null)).toBe('Belle has not said yet')
  })

  it('counts who has said', () => {
    expect(howManyPlanned([
      { id: 'a', confirmedAt: '2026-11-18T22:10:00Z' },
      { id: 'b', confirmedAt: null },
    ])).toEqual({ said: 1, team: 2 })
  })

  it('an empty team is not a failure', () => {
    expect(howManyPlanned([])).toEqual({ said: 0, team: 0 })
  })
})
