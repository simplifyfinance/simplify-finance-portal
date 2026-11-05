// The clone that carried a refinance into a purchase. 17 Aug 2026.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { figuresAfterScenarioChange, clearedSentence, refinancesNothing,
         SCENARIO_FIGURES, SECURITY_BOXES } from './a-scenario-keeps-its-own-figures'
import { securitiesOf as boxSecuritiesOf } from './box-security'

// Brad's cloned deal, as it reached the lending options.
const CLONE: any = {
  template: 'refinance_equity',
  existingLoanBal: '350,000',
  propertyValue: '538,085',
  equityRelease: '120,000',
  securityIds: ['p-glenfield'],
  securityBalances: { 'p-glenfield': '350,000' },
  securityLimits: {},
  securityReleases: {},
  purchasePrice: '650,000',
  deposit: '130,000',
}

describe('moving a refinance onto a purchase', () => {
  const cleared = figuresAfterScenarioChange(CLONE, 'oo_purchase')

  it('clears the existing balance that printed inside the purchase card', () => {
    expect(cleared.keys).toContain('existingLoanBal')
    expect(cleared.values.existingLoanBal).toBe('')
  })

  it('clears the property value that made the LVR 96.6%', () => {
    expect(cleared.keys).toContain('propertyValue')
  })

  it('clears the equity release', () => {
    expect(cleared.keys).toContain('equityRelease')
  })

  it('unticks the house that was security on the refinance', () => {
    expect(cleared.keys).toContain('securityIds')
    expect(cleared.values.securityIds).toEqual([])
    expect(cleared.values.securityBalances).toEqual({})
  })

  it('leaves the purchase alone', () => {
    expect(cleared.keys).not.toContain('purchasePrice')
    expect(cleared.keys).not.toContain('deposit')
  })

  // THE WHOLE POINT. The broker's own paragraph is not on this list and never
  // will be. Fabio, asked directly: "dont clear my paragrah".
  it('never touches the broker personalisation', () => {
    expect(cleared.keys).not.toContain('brokerNotes')
    expect(SCENARIO_FIGURES as readonly string[]).not.toContain('brokerNotes')
    expect(SECURITY_BOXES as readonly string[]).not.toContain('brokerNotes')
  })
})

describe('a move that costs nothing', () => {
  it('keeps the figures when the new scenario has the same boxes', () => {
    const cleared = figuresAfterScenarioChange(CLONE, 'refinance_only')
    expect(cleared.keys).not.toContain('existingLoanBal')
    expect(cleared.keys).not.toContain('propertyValue')
  })

  it('keeps the securities where the new scenario can hold them', () => {
    const cleared = figuresAfterScenarioChange(CLONE, 'complex_refinance')
    expect(cleared.keys).not.toContain('securityIds')
  })

  it('still drops the equity release on a refinance only', () => {
    const cleared = figuresAfterScenarioChange(CLONE, 'refinance_only')
    expect(cleared.keys).toContain('equityRelease')
  })

  it('returns nothing at all on a deal with nothing in those boxes', () => {
    const bare = { template: 'oo_purchase', purchasePrice: '650,000' }
    expect(figuresAfterScenarioChange(bare, 'investment_purchase').keys).toHaveLength(0)
  })

  it('does not report a box that is already empty', () => {
    const half = { ...CLONE, propertyValue: '', securityIds: [] }
    const cleared = figuresAfterScenarioChange(half, 'oo_purchase')
    expect(cleared.keys).not.toContain('propertyValue')
    expect(cleared.keys).not.toContain('securityIds')
    expect(cleared.keys).toContain('existingLoanBal')
  })
})

describe('what it says out loud', () => {
  it('names the six security boxes once', () => {
    const said = clearedSentence(figuresAfterScenarioChange(CLONE, 'oo_purchase'))
    expect(said).toBe('Existing loan balance, Property value, Equity release and the securities')
  })

  it('is empty when nothing went', () => {
    expect(clearedSentence({ keys: [], values: {} })).toBe('')
  })

  it('does not say "and" on its own for one box', () => {
    const one = figuresAfterScenarioChange(
      { template: 'refinance_only', equityRelease: '50,000' }, 'refinance_only')
    expect(clearedSentence(one)).toBe('Equity release')
  })
})

describe('an unknown scenario', () => {
  // custom means "leave my structure alone and show me everything", so it has
  // no box list of its own. Clearing a figure on the way into it would take a
  // typed number off a form that was about to draw every box there is.
  it('does not strip a custom scenario of its figures', () => {
    expect(figuresAfterScenarioChange(CLONE, 'custom').keys).toHaveLength(0)
  })

  it('leaves a template this build has never heard of alone', () => {
    expect(figuresAfterScenarioChange(CLONE, 'something_shipped_later').keys).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// AND THE TWO PLACES DOWNSTREAM THAT WERE READING THE STALE FIGURES.

describe('the lending options no longer count a house the scenario cannot hold', () => {
  const ff = {
    properties: [{ id: 'p-glenfield', address: '2/6-14 Mirrul Street, Glenfield Park NSW 2650',
                   value: '538085', ownershipType: 'Investment', loans: [] }],
  }

  it('ignores a tick left over from the refinance on a purchase', () => {
    const deal: any = {
      fact_find_data: ff,
      bc_data: { template: 'oo_purchase', purchasePrice: '650,000', securityIds: ['p-glenfield'] },
    }
    const secs = boxSecuritiesOf(deal)
    expect(secs.map((x: any) => x.address)).not.toContain('2/6-14 Mirrul Street, Glenfield Park NSW 2650')
  })

  // The fact find came across with the clone, and its loan still said "to be
  // refinanced". Unticking the house is not enough on its own.
  it('ignores a loan still marked to be refinanced on a purchase', () => {
    const stale = { properties: [{ ...ff.properties[0],
      loans: [{ status: 'To be refinanced', lenderName: 'ANZ', balance: '350000' }] }] }
    const deal: any = {
      fact_find_data: stale,
      bc_data: { template: 'oo_purchase', purchasePrice: '650,000' },
    }
    expect(boxSecuritiesOf(deal).map((x: any) => x.address))
      .not.toContain('2/6-14 Mirrul Street, Glenfield Park NSW 2650')
  })

  it('still finds it on a scenario that pays something out', () => {
    const stale = { properties: [{ ...ff.properties[0],
      loans: [{ status: 'To be refinanced', lenderName: 'ANZ', balance: '350000' }] }] }
    const deal: any = {
      fact_find_data: stale,
      bc_data: { template: 'refinance_only', existingLoanBal: '350,000' },
    }
    expect(boxSecuritiesOf(deal).map((x: any) => x.address))
      .toContain('2/6-14 Mirrul Street, Glenfield Park NSW 2650')
  })

  it('knows which scenarios pay nothing out', () => {
    expect(refinancesNothing('oo_purchase')).toBe(true)
    expect(refinancesNothing('fhb')).toBe(true)
    expect(refinancesNothing('construction')).toBe(true)
    expect(refinancesNothing('refinance_only')).toBe(false)
    expect(refinancesNothing('bridging')).toBe(false)
    expect(refinancesNothing('top_up')).toBe(false)
    // Custom draws every box there is, so it is never told it has none.
    expect(refinancesNothing('custom')).toBe(false)
    expect(refinancesNothing('something_shipped_later')).toBe(false)
  })

  it('still reads the tick on a scenario that has securities', () => {
    const deal: any = {
      fact_find_data: ff,
      bc_data: { template: 'complex_refinance', securityIds: ['p-glenfield'] },
    }
    expect(boxSecuritiesOf(deal).map((x: any) => x.address))
      .toContain('2/6-14 Mirrul Street, Glenfield Park NSW 2650')
  })
})

describe('the purchase email says it once', () => {
  // 17 Aug 2026. The owner-occupied purchase branch wrote the lead-in itself
  // AND then called structureLead(), which returns word for word the same
  // sentence on a one-split deal. The client read it twice.
  //
  // Four other branches write that sentence by hand, and are right to: they
  // draw their cards one at a time and never call structureLead() at all. The
  // fault is a branch that does BOTH, so that is what is checked - the branch,
  // not the file. A blunt not.toContain() across the whole route failed on the
  // four innocent ones.
  it('does not write the lead-in by hand AND call structureLead', () => {
    const route = readFileSync('app/api/generate-email/route.ts', 'utf8')
    // The plain one, not the compare-options one above it.
    const start = route.indexOf("template === 'oo_purchase') {")
    expect(start).toBeGreaterThan(0)
    const branch = route.slice(start, route.indexOf('} else if', start + 10))
    expect(branch).toContain('structureLead(')
    expect(branch).not.toContain("p13('Here is a breakdown of the structure:')")
  })
})
