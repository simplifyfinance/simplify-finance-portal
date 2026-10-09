// THE PURPOSE A BROKER TYPED REACHES THE DOCUMENTS.
//
// 9 Oct 2026. Owner occupied or investment is recorded in two places in two
// vocabularies, and neither knew about the other:
//
//   the BC's split dropdown      'owner_occupied' | 'investment'
//   the deal strip's dropdown    'OO' | 'INV'
//
// Both write split.purpose. lib/deal-structure.ts CAST it to its own type
// rather than checking it, so the BC's spelling read as blank. On top of that,
// initRefinanceSplits() seeded the lending options splits from the BC's with
// id, label and amount only - and splitsOf() prefers that list the moment it
// exists, falling back to the BC split for the repayment type but not for this.
//
// So on debt recycling and complex refinance - the two scenarios that exist
// because each split holds one purpose - the answer reached nothing. The strip
// showed it unanswered and offered "set on the LO", which is the portal telling
// a broker the answer they just gave does not count.
//
// Invented clients, invented figures.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { normalisePurpose } from './split-purpose'
import { splitsOf, purposeSummary, dealRow } from './deal-structure'
import { purposeOf, everySplitHasAPurpose } from './debt-recycling'

const BC_SPLITS = [
  { label: 'Home', amount: '620,000', rate: '6.14', type: 'P&I', purpose: 'owner_occupied' },
  { label: 'Investment', amount: '380,000', rate: '6.39', type: 'Interest only', purpose: 'investment' },
]

const recycling = (lo: any = null) => ({
  bc_data: { template: 'debt_recycling', totalLimit: '1,000,000', splits: BC_SPLITS },
  ...(lo ? { lo_data: lo } : {}),
})

describe('one answer, however it was written down', () => {
  it('reads both vocabularies and nothing else', () => {
    expect(normalisePurpose('owner_occupied')).toBe('OO')
    expect(normalisePurpose('OO')).toBe('OO')
    expect(normalisePurpose('investment')).toBe('INV')
    expect(normalisePurpose('INV')).toBe('INV')
  })

  it('leaves blank blank, and never guesses', () => {
    // debt-recycling.ts: "A default here would be the portal deciding,
    // silently, that a split nobody has labelled is private borrowing."
    for (const v of ['', null, undefined, '   ', 'Home loan', 'yes']) {
      expect(normalisePurpose(v)).toBe('')
    }
  })
})

describe('the BC answer reaches the deal strip', () => {
  it('is no longer blank on a deal with no lending options yet', () => {
    const splits = splitsOf(recycling())
    expect(splits.map(s => s.purpose)).toEqual(['OO', 'INV'])
  })

  it('survives the lending options list that used to drop it', () => {
    // The LO's splits exist and carry no purpose - every deal created before
    // today. splitsOf prefers that list, so without the fall back to the BC the
    // answer is gone.
    const lo = { refinanceSplits: [
      { id: 'a', label: 'Home', amount: '620,000' },
      { id: 'b', label: 'Investment', amount: '380,000' },
    ] }
    expect(splitsOf(recycling(lo)).map(s => s.purpose)).toEqual(['OO', 'INV'])
  })

  it('still lets the lending options override the BC where somebody answered there', () => {
    const lo = { refinanceSplits: [
      { id: 'a', label: 'Home', amount: '620,000', purpose: 'INV' },
      { id: 'b', label: 'Investment', amount: '380,000' },
    ] }
    expect(splitsOf(recycling(lo)).map(s => s.purpose)).toEqual(['INV', 'INV'])
  })
})

describe('and therefore reaches the documents', () => {
  it('lets the portal say what this deal is', () => {
    // Returned '' before, which is what made brokerNotes print "No split has a
    // purpose recorded" and drop a whole paragraph.
    expect(purposeSummary(recycling())).toBe('Owner occupied & investment')
  })

  it('adds the money up on each side instead of filing it all as unset', () => {
    const r = dealRow(recycling())
    expect(r.ooTotal).toBe(620_000)
    expect(r.invTotal).toBe(380_000)
    expect(r.unsetTotal).toBe(0)
  })
})

describe('and the debt recycling wording reads the strip too', () => {
  it('accepts a split answered on the deal strip', () => {
    expect(purposeOf({ purpose: 'OO' })).toBe('owner_occupied')
    expect(purposeOf({ purpose: 'INV' })).toBe('investment')
  })

  it('keeps reading its own spelling exactly as before', () => {
    expect(purposeOf({ purpose: 'owner_occupied' })).toBe('owner_occupied')
    expect(purposeOf({ purpose: 'investment' })).toBe('investment')
    expect(purposeOf({ purpose: '' })).toBe('')
    expect(purposeOf({ purpose: 'Home loan' })).toBe('')
  })

  it('counts a deal answered either way as complete', () => {
    expect(everySplitHasAPurpose({ splits: BC_SPLITS })).toBe(true)
    expect(everySplitHasAPurpose({ splits: [
      { label: 'Home', amount: '620,000', purpose: 'OO' },
      { label: 'Investment', amount: '380,000', purpose: 'INV' },
    ] })).toBe(true)
    expect(everySplitHasAPurpose({ splits: [
      { label: 'Home', amount: '620,000', purpose: 'OO' },
      { label: 'Investment', amount: '380,000' },
    ] })).toBe(false)
  })
})

describe('the copy carries it from now on', () => {
  it('seeds the lending options splits with the purpose, not just the amount', () => {
    const form = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')
    const seed = form.slice(form.indexOf('const initRefinanceSplits'),
                            form.indexOf('const initRefinanceSplits') + 900)
    expect(seed).toContain('purpose: normalisePurpose(s.purpose)')
  })

  it('nobody compares this field against a bare string any more', () => {
    // The cast is what hid the fault: 'owner_occupied' as SplitPurpose compiles
    // and is wrong at runtime.
    const src = readFileSync(new URL('./deal-structure.ts', import.meta.url), 'utf8')
      .replace(/\/\/[^\n]*/g, '')
    expect(src).not.toMatch(/as SplitPurpose/)
  })
})
