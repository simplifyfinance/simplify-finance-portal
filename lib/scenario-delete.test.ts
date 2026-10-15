import { describe, it, expect } from 'vitest'
import { removeScenario, whyNotDelete, tabsOf, parkedOf } from './bc-scenarios'

// 15 Oct 2026. "If I remove the investment purchase scenario, it deletes
// everything within that scenario." Fabio, after a clone arrived carrying the
// parent's second scenario and the only control on offer removed the one he
// was not looking at.

const deal = (over: any = {}) => ({
  bc_data: { template: 'investment_equity', scenarioLabel: '', splits: [{ amount: '506,000' }] },
  bc_scenarios: [{ bc: { template: 'investment_purchase', splits: [{ amount: '438,000' }] }, completedAt: null }],
  bc_completed_at: null,
  lo_data: {},
  ...over,
})

describe('deleting the one you are not on', () => {
  const w = removeScenario(deal(), 1)!

  it('takes it away and leaves the live one alone', () => {
    expect(w.bc_scenarios).toHaveLength(0)
    expect(w.bc_data.template).toBe('investment_equity')
  })

  it('and everything typed into it goes with it', () => {
    expect(JSON.stringify(w)).not.toContain('438,000')
  })
})

describe('deleting the one you ARE on', () => {
  const w = removeScenario(deal(), 0)!

  it('promotes the other one rather than leaving no scenario', () => {
    expect(w.bc_data.template).toBe('investment_purchase')
    expect(w.bc_scenarios).toHaveLength(0)
  })

  it('and takes the deleted one with it', () => {
    expect(JSON.stringify(w)).not.toContain('506,000')
  })

  it('carries the promoted scenario-s own completed tick, not the old one', () => {
    const d = deal({ bc_completed_at: '2026-10-01T00:00:00Z' })
    expect(removeScenario(d, 0)!.bc_completed_at).toBeNull()
  })
})

describe('what it refuses', () => {
  it('REFUSES to delete the last scenario - a deal needs one', () => {
    expect(removeScenario(deal({ bc_scenarios: [] }), 0)).toBeNull()
    expect(whyNotDelete(deal({ bc_scenarios: [] }), 0)).toContain('needs one')
  })

  it('refuses to delete the live one once lending options exist', () => {
    // Deleting it would promote a different scenario underneath a written LO -
    // the same fault a swap is stopped for.
    const started = deal({ lo_data: { lenders: [{ lenderName: 'Bankwest' }] } })
    expect(removeScenario(started, 0)).toBeNull()
    expect(whyNotDelete(started, 0)).toContain('Switch to the other')
  })

  it('but STILL allows the parked one to go, because nothing is built on it', () => {
    const started = deal({ lo_data: { lenders: [{ lenderName: 'Bankwest' }] } })
    expect(removeScenario(started, 1)).not.toBeNull()
    expect(whyNotDelete(started, 1)).toBe('')
  })

  it('says nothing to an index that is not a tab', () => {
    expect(removeScenario(deal(), 7)).toBeNull()
  })
})

describe('the index lines up with the tabs on screen', () => {
  it('0 is the live tab and 1 is the parked one', () => {
    const tabs = tabsOf(deal())
    expect(tabs[0].live).toBe(true)
    expect(tabs[1].live).toBe(false)
    expect(parkedOf(removeScenario(deal(), 1)!)).toHaveLength(0)
  })
})
