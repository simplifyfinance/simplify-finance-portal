import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { downstreamStarted, canSwap } from './bc-scenarios'

// TWO DOORS CALLED "SCENARIO", AND ONLY ONE OF THEM WAS LOCKED.
//
// 9 Oct 2026. Fabio: "the system works well if we go with one scenario all the
// way to compliance, however, if we do one scenario on BC and LO and then
// change the scesrio back it is really causing issues".
//
// The portal has two ways to change the scenario.
//
//   THE SWAP, between the two parked scenarios. Guarded since it was built:
//   once the lending options have been started the tab is disabled and says
//   "To change it now, clone the deal."
//
//   "CHANGE SCENARIO", on the BC template. No check of any kind. It asked one
//   question - would this throw away splits somebody typed - and nothing else.
//   With a written LO, an email out with the client and compliance finished,
//   the chips were right there and changing one warned nobody.
//
// Both doors lead to the same room. One rule, read from one function, now
// covers both - and the wording is word for word the same, because two
// sentences for one rule is how they drift apart.

const bc = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

describe('both ways of changing the scenario ask the same question', () => {
  it('the template chips are frozen once downstream work exists', () => {
    expect(bc, 'the BC template no longer asks whether anything downstream has\n'
      + 'started, so the scenario can be changed under a finished LO')
      .toContain('const frozen = downstreamStarted(deal)')
  })

  it('and the function refuses too, not only the buttons', () => {
    // A hidden control is a courtesy. This is a rule, so it is checked where
    // the change would actually happen.
    const fn = bc.slice(bc.indexOf('function selectTemplate('), bc.indexOf('function applyTemplate('))
    expect(fn, 'selectTemplate will still change the scenario if anything calls it')
      .toContain('if (frozen) return')
  })

  it('in the same words as the swap, from the same source', () => {
    // Two sentences for one rule is how they drift apart. Both say this.
    const said = bc.match(/To change it now, clone the deal/g) || []
    expect(said.length, 'the two doors no longer say the same thing')
      .toBeGreaterThanOrEqual(2)
  })

  it('and the rule itself is unchanged', () => {
    // Nothing above is allowed to quietly loosen what counts as "started".
    const started = { lo_data: { lenders: [{ lenderName: 'ORDE Financial' }] } }
    expect(downstreamStarted(started)).toBe(true)
    expect(downstreamStarted({ lodged_at: '2026-10-01' })).toBe(true)
    expect(downstreamStarted({ client_proceeded: true })).toBe(true)
    expect(downstreamStarted({ bc_data: { template: 'refinance_only' } })).toBe(false)

    // And the swap still refuses on the same deals.
    expect(canSwap({ ...started, bc_scenarios: [{ bc: { template: 'x' } }] })).toBe(false)
    expect(canSwap({ bc_scenarios: [{ bc: { template: 'x' } }] })).toBe(true)
  })
})
