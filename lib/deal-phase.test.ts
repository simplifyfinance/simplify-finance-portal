import { describe, it, expect } from 'vitest'
import { phaseOf, isFinished, isInApplication, amountOf, phaseSince, PHASE_ORDER } from './deal-phase'

const ff = { fact_find_data: { applicants: [{}] } }

describe('which column a deal is in', () => {
  it('starts at fact find, and stays there until the form has something in it', () => {
    expect(phaseOf({})).toBe('fact_find')
    expect(phaseOf({ fact_find_data: {} })).toBe('fact_find')
    expect(phaseOf(ff)).toBe('bc')
  })

  it('walks the ladder on what actually happened', () => {
    expect(phaseOf({ ...ff, client_proceeded: true })).toBe('lo')
    expect(phaseOf({ ...ff, client_proceeded: true, lo_client_proceeded: true })).toBe('compliance')
    // Finishing compliance is not enough — it has to have actually gone out.
    expect(phaseOf({ ...ff, lo_client_proceeded: true, compliance_completed_at: 'x' })).toBe('compliance')
    expect(phaseOf({ ...ff, lo_client_proceeded: true, compliance_completed_at: 'x', compliance_sent_at: 'x' })).toBe('compliance_sent')
  })

  it('keeps a pushed deal on the board instead of calling it finished', () => {
    // The nine deals that were invisible on 1 Sep 2026.
    const pushed = { ...ff, compliance_completed_at: '2026-08-21', compliance_sent_at: '2026-08-21', status: 'completed' }
    expect(phaseOf(pushed)).toBe('compliance_sent')
    expect(isFinished(pushed)).toBe(false)
    expect(isInApplication(pushed)).toBe(true)
  })

  it('ignores the retired completed status entirely', () => {
    const a = { ...ff, compliance_completed_at: 'x', compliance_sent_at: 'x' }
    expect(phaseOf({ ...a, status: 'completed' })).toBe(phaseOf(a))
  })

  it('runs through the post-lodgement columns', () => {
    const base = { ...ff, compliance_completed_at: 'x', compliance_sent_at: 'x' }
    expect(phaseOf({ ...base, lodged_at: 'x' })).toBe('lodged')
    expect(phaseOf({ ...base, lodged_at: 'x', preapproval_at: 'x' })).toBe('preapproved')
    expect(phaseOf({ ...base, lodged_at: 'x', preapproval_at: 'x', formal_approval_at: 'x' })).toBe('formal')
    expect(phaseOf({ ...base, lodged_at: 'x', formal_approval_at: 'x', settled_at: 'x' })).toBe('settled')
  })

  it('lets a deal skip preapproval without getting stuck', () => {
    // Most deals never get one. Missing it must not hold the deal back.
    const straight = { ...ff, compliance_sent_at: 'x', lodged_at: 'x', formal_approval_at: 'x' }
    expect(phaseOf(straight)).toBe('formal')
  })

  it('is only finished when the money landed or the deal died', () => {
    expect(phaseOf({ ...ff, settled_at: 'x' })).toBe('settled')
    expect(isFinished({ ...ff, settled_at: 'x' })).toBe(true)
    expect(phaseOf({ ...ff, status: 'lost' })).toBe('lost')
    expect(isFinished({ ...ff, status: 'lost' })).toBe(true)
    expect(isFinished({ ...ff, compliance_sent_at: 'x' })).toBe(false)
  })

  it('calls a deal lost wherever it got to', () => {
    expect(phaseOf({ ...ff, status: 'lost', lodged_at: 'x', formal_approval_at: 'x' })).toBe('lost')
  })

  it('never reads deals.stage', () => {
    const d = { ...ff, client_proceeded: true, stage: 'Compliance' }
    expect(phaseOf(d)).toBe('lo')                   // the stale column said Compliance
    expect(phaseOf({ ...ff, stage: 'Settled' })).toBe('bc')
  })

  it('shows what settled over what was lodged over what was asked for', () => {
    expect(amountOf({ loan_amount: '500000' })).toBe(500000)
    expect(amountOf({ loan_amount: 500000, lodged_total: 520000 })).toBe(520000)
    expect(amountOf({ loan_amount: 500000, lodged_total: 520000, settled_total: 515000 })).toBe(515000)
    expect(amountOf({ lodged_total: '$1,250,000' })).toBe(1250000)
    expect(amountOf({})).toBeNull()
  })

  it('shows nothing before Lending Options — a BC figure is a capacity, not a loan', () => {
    // Nobody has applied for a borrowing capacity, and on the comparison template
    // it is two alternatives for one deal. Counting it inflates the pipeline.
    const bcOnly = { bc_data: { template: 'refinance_equity', splits: [
      { label: 'Existing loan refinanced', amount: '640000' },
      { label: 'Equity access', amount: '60,000' },
    ] } }
    expect(amountOf(bcOnly)).toBeNull()
  })

  it('counts the Lending Options figure once it exists', () => {
    expect(amountOf({ lo_data: { loanAmount: '387,000' } })).toBe(387000)
    expect(amountOf({ lo_data: { refinanceSplits: [{ amount: '400000' }, { amount: '60000' }] } })).toBe(460000)
  })

  it('prefers the deal\'s own column, which the LO now writes', () => {
    const d = { loan_amount: 530000, lo_data: { loanAmount: '500,000' } }
    expect(amountOf(d)).toBe(530000)
  })

  it('ignores an LO figure that was never filled in', () => {
    expect(amountOf({ lo_data: { loanAmount: '' } })).toBeNull()
    expect(amountOf({ lo_data: { refinanceSplits: [{ label: 'Owner-occupied loan', amount: '' }] } })).toBeNull()
  })

  it('adds up the real splits on a lodged loan', () => {
    expect(amountOf({ lodged_splits: [{ amount: 400000 }, { amount: 150000 }] })).toBe(550000)
  })

  it('ages from the milestone that put the deal in its column', () => {
    const d = { ...ff, compliance_completed_at: '2026-08-20', compliance_sent_at: '2026-08-21' }
    expect(phaseSince(d)).toBe('2026-08-21')        // not when compliance was finished
    expect(phaseSince({ ...d, lodged_at: '2026-08-28' })).toBe('2026-08-28')
    expect(phaseSince({ ...ff, status: 'lost', closed_at: '2026-07-01' })).toBe('2026-07-01')
  })

  it('has every phase in the order the board draws them', () => {
    expect(PHASE_ORDER).toHaveLength(10)
    expect(PHASE_ORDER.indexOf('compliance_sent')).toBeLessThan(PHASE_ORDER.indexOf('lodged'))
    expect(PHASE_ORDER.indexOf('preapproved')).toBeLessThan(PHASE_ORDER.indexOf('formal'))
  })
})
