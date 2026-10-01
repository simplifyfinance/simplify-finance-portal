import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  MAX_SCENARIOS, parkedOf, scenarioCount, canAdd, labelOf, tabsOf,
  downstreamStarted, canSwap, swapTo, addScenario, removeParked, renameLive,
  optionsForClient, hasTwoScenarios, optionFromLink,
} from './bc-scenarios'

const purchase = { template: 'investment_purchase', purchasePrice: '950,000', splits: [{ amount: '760,000' }] }
const refi = { template: 'refinance_equity', existingLoanBal: '640,000', splits: [{ amount: '640,000' }] }

const deal = {
  stage: 'BC',
  bc_data: purchase,
  bc_completed_at: '2026-10-01T00:00:00Z',
  bc_scenarios: [{ bc: refi, completedAt: null }],
}

describe('two scenarios, never more', () => {
  it('counts the live one and the parked one', () => {
    expect(MAX_SCENARIOS).toBe(2)
    expect(scenarioCount(deal)).toBe(2)
    expect(hasTwoScenarios(deal)).toBe(true)
    expect(canAdd(deal)).toBe(false)
  })

  it('and a deal with one is exactly what it is today', () => {
    const one = { bc_data: purchase }
    expect(scenarioCount(one)).toBe(1)
    expect(canAdd(one)).toBe(true)
    expect(parkedOf(one)).toEqual([])
    expect(hasTwoScenarios(one)).toBe(false)
  })

  // Fabio, 1 Oct 2026: "2 options max". A third in the column is ignored rather
  // than rendered, so nothing downstream can be handed one.
  it('ignores anything past the second', () => {
    const three = { ...deal, bc_scenarios: [{ bc: refi }, { bc: purchase }, { bc: refi }] }
    expect(parkedOf(three)).toHaveLength(1)
    expect(scenarioCount(three)).toBe(2)
  })

  it('and ignores junk in the column rather than crashing on it', () => {
    for (const junk of [null, 'nope', 42, [{}], [{ bc: 'not an object' }], [1, 2]]) {
      expect(parkedOf({ bc_data: purchase, bc_scenarios: junk })).toEqual([])
    }
  })
})

describe('what each one is called', () => {
  it('its own name, or the scenario it is', () => {
    expect(labelOf(purchase)).toBe('Investment purchase')
    expect(labelOf({ ...purchase, scenarioLabel: 'Ryde unit' })).toBe('Ryde unit')
    expect(labelOf({})).toBe('Scenario')
  })

  it('live one first', () => {
    expect(tabsOf(deal)).toEqual([
      { label: 'Investment purchase', live: true, parkedIndex: -1 },
      { label: 'Refinance + equity release', live: false, parkedIndex: 0 },
    ])
  })

  it('and renaming touches nothing else', () => {
    const out = renameLive(deal, 'Ryde unit')
    expect(out.bc_data.scenarioLabel).toBe('Ryde unit')
    expect(out.bc_data.purchasePrice).toBe('950,000')
  })
})

describe('the swap', () => {
  it('puts the live one where the picked one was, and brings the picked one out', () => {
    const w = swapTo(deal, 0)!
    expect(w.bc_data).toEqual(refi)
    expect(w.bc_scenarios).toEqual([{ bc: purchase, completedAt: '2026-10-01T00:00:00Z' }])
    // Parked with it, or scenario two inherits scenario one's tick.
    expect(w.bc_completed_at).toBe(null)
  })

  // A SCENARIO IS IN ONE PLACE OR THE OTHER, NEVER BOTH. Two copies free to
  // disagree is the fault this codebase has paid for six times.
  it('never leaves a scenario in two places at once', () => {
    const w = swapTo(deal, 0)!
    expect(w.bc_scenarios.some(p => p.bc === w.bc_data)).toBe(false)
    expect(w.bc_scenarios).toHaveLength(1)
  })

  it('and swapping back returns exactly what you started with', () => {
    const once = swapTo(deal, 0)!
    const back = swapTo({ ...deal, ...once }, 0)!
    expect(back.bc_data).toEqual(purchase)
    expect(back.bc_completed_at).toBe('2026-10-01T00:00:00Z')
    expect(back.bc_scenarios).toEqual([{ bc: refi, completedAt: null }])
  })

  it('refuses an index that is not there', () => {
    expect(swapTo(deal, 1)).toBe(null)
    expect(swapTo(deal, -1)).toBe(null)
    expect(swapTo({ bc_data: purchase }, 0)).toBe(null)
  })
})

describe('once anything downstream exists, you clone instead', () => {
  it('is free while the deal is still on the BC', () => {
    expect(downstreamStarted(deal)).toBe(false)
    expect(canSwap(deal)).toBe(true)
  })

  // Fabio, 1 Oct 2026: "I rather we clone the deal and change if we have to
  // switch after LO is sent." Erring towards frozen: a swap underneath written
  // lending options leaves the file describing a loan nobody is taking.
  it('and stops the moment anything is built on it', () => {
    const started = [
      { lo_data: { emailHtml: '<p>sent</p>' } },
      { lo_data: { lenders: [{ lenderName: 'Macquarie' }] } },
      { lo_data: { recommendedLender: 'ANZ' } },
      { lo_client_proceeded: true },
      { client_proceeded: true },
      { lodged_at: '2026-09-28' },
      { preapproval_at: '2026-09-28' },
      { formal_approval_at: '2026-09-28' },
      { stage: 'LO' },
      { stage: 'Compliance' },
    ]
    for (const extra of started) {
      const d = { ...deal, ...extra }
      expect(downstreamStarted(d), JSON.stringify(extra)).toBe(true)
      expect(canSwap(d), JSON.stringify(extra)).toBe(false)
    }
  })

  it('and an empty lender row is not downstream work', () => {
    expect(downstreamStarted({ ...deal, lo_data: { lenders: [{ lenderName: '' }] } })).toBe(false)
  })

  it('nothing to swap to on a one-scenario deal', () => {
    expect(canSwap({ bc_data: purchase, stage: 'BC' })).toBe(false)
  })
})

describe('adding and removing', () => {
  it('parks the current one and lands you on a blank second', () => {
    const w = addScenario({ bc_data: purchase, bc_completed_at: 'x' }, 'Refinance')!
    expect(w.bc_data).toEqual({ scenarioLabel: 'Refinance' })
    expect(w.bc_scenarios).toEqual([{ bc: purchase, completedAt: 'x' }])
    expect(w.bc_completed_at).toBe(null)
  })

  // Blank, never a copy. Two different shapes is the whole reason for having
  // two, and a copy means editing a purchase into a refinance box by box.
  it('blank, not a copy of the first', () => {
    const w = addScenario({ bc_data: purchase }, 'Second')!
    expect(w.bc_data.purchasePrice).toBeUndefined()
    expect(w.bc_data.template).toBeUndefined()
  })

  it('and refuses a third', () => {
    expect(addScenario(deal, 'Third')).toBe(null)
  })

  it('removes the parked one and leaves the live one alone', () => {
    const w = removeParked(deal, 0)!
    expect(w.bc_data).toEqual(purchase)
    expect(w.bc_scenarios).toEqual([])
    expect(w.bc_completed_at).toBe('2026-10-01T00:00:00Z')
    expect(removeParked(deal, 1)).toBe(null)
  })
})

describe('what the client is offered', () => {
  it('numbers them, live one first', () => {
    expect(optionsForClient(deal).map(o => [o.option, o.label]))
      .toEqual([[1, 'Investment purchase'], [2, 'Refinance + equity release']])
  })

  // THE VALUE COMES OFF A LINK IN AN EMAIL, WHICH ANYBODY CAN EDIT. It reaches
  // a database write and a rendered page, so it is one of three known shapes
  // before it is allowed to be either.
  it('and only ever reads 1 or 2 back off the link', () => {
    expect(optionFromLink('1')).toBe(1)
    expect(optionFromLink('2')).toBe(2)
    for (const bad of ['3', '0', '-1', '1.0', ' 1x', 'one', '', null, undefined,
                       '1; drop table deals', '<script>', { a: 1 }, ['3'], 3]) {
      expect(optionFromLink(bad), String(bad)).toBe(null)
    }
  })

  // A number is accepted because a caller inside the portal may already have
  // parsed one. It still has to BE one or two - the check is on the value, not
  // on how it was spelled, which is what makes it safe either way.
  it('on the value, not on how it was spelled', () => {
    expect(optionFromLink(1)).toBe(1)
    expect(optionFromLink(2)).toBe(2)
    expect(optionFromLink(1.5)).toBe(null)
  })
})

describe('the two-option email', () => {
  const route = readFileSync('app/api/generate-email/route.ts', 'utf8')
  const form = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
  const branch = route.slice(route.indexOf('if (d.secondScenario'),
                             route.indexOf("} else if (template === 'refinance_equity' && d.compareOptions)"))

  it('is reached before any single-scenario template', () => {
    expect(route.indexOf('if (d.secondScenario'))
      .toBeLessThan(route.indexOf("template === 'refinance_equity'"))
  })

  // BUILT FROM THE SHARED ROWS. Two templates' bespoke prose run together reads
  // as two emails stapled: twice the preamble, twice the sign-off. The figures
  // come from the same files every other scenario uses, so the glance and the
  // cards cannot disagree with each other or with a single-scenario email.
  it('uses the shared purchase block and split cards, not its own arithmetic', () => {
    expect(branch).toContain('purchaseBlock(')
    expect(branch).toContain('splitCards(')
    expect(branch).toContain('repaymentOf(')
  })

  // The first version added the deposit and the duty and put $227,800 in the
  // glance against the card's $190,000. The deposit box is already price minus
  // loan plus duty - lib/purchase-rows.ts says so and prints it unchanged.
  it('and takes "what you contribute" from the one box that already holds it', () => {
    expect(branch).toContain('const find = readMoney(bc?.deposit) || 0')
    expect(branch).not.toContain("readMoney(bc?.stampDuty) || 0)")
  })

  it('carries one proceed link per option', () => {
    expect(branch).toContain('?from=BC&opt=${n}')
    expect(branch).toContain('ctasTwo(')
  })

  it('and the form sends the second scenario only when there is one', () => {
    expect(form).toContain('secondScenario: parkedOf(deal)[0]?.bc || null')
  })
})
