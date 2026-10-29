import { describe, it, expect } from 'vitest'
import { swapTo, addScenario, removeScenario, parkedOf } from './bc-scenarios'

// THE NOTES FOLLOW THE BROKER BETWEEN THE TWO SCENARIOS.
//
// 29 Oct 2026. Fabio, on a deal with a Buy / sell beside an Equity release +
// purchase: "the broker summary notes and important things to notes, those 2
// boxes are dependent to each scenario. If I press generate email while sitting
// on scenario 1 the box shows; when I press scenario 2 the 2 boxes are empty...
// whatever I put in there gets carried across between scenario 1 and 2."
//
// Two separate boxes, still. What travels is what he typed in them.
//
// Invented clients. The shapes are real.

const OPENING = 'In both scenarios we have assumed the car loan is paid out.'
const CAVEATS = 'This is your estimated borrowing capacity as of today.\nThe sale figure is an estimate.'

const deal = (live: any = {}, parked: any = {}) => ({
  bc_data: { template: 'buy_sell', brokerNotes: OPENING, templateNotes: CAVEATS, ...live },
  bc_scenarios: [{ bc: { template: 'investment_equity', ...parked }, completedAt: null }],
  bc_completed_at: null,
})

describe('SWITCHING TABS', () => {
  it('takes the opening paragraph with it', () => {
    expect(swapTo(deal(), 0)?.bc_data.brokerNotes).toBe(OPENING)
  })

  it('and the important things to note', () => {
    expect(swapTo(deal(), 0)?.bc_data.templateNotes).toBe(CAVEATS)
  })

  it('AND NOTHING ELSE. The figures are the whole reason there are two.', () => {
    const w = swapTo(deal(), 0)
    expect(w?.bc_data.template, 'the structure is the scenario').toBe('investment_equity')
    expect(w?.bc_data.purchasePrice).toBeUndefined()
  })

  it('and the one parked behind keeps everything it had', () => {
    // A parked scenario is a WHOLE bc_data. Nothing is stripped out of it.
    const w = swapTo(deal({ purchasePrice: '2,050,000' }), 0)
    expect(w?.bc_scenarios[0].bc.purchasePrice).toBe('2,050,000')
    expect(w?.bc_scenarios[0].bc.brokerNotes).toBe(OPENING)
  })
})

describe('AN EMPTY BOX DOES NOT WIPE A FULL ONE', () => {
  // Every save writes both keys, so a scenario nobody typed notes into holds
  // "". Letting that win would empty the other scenario's boxes the first time
  // anybody switched tabs - losing the work, silently, by looking at it.
  it('a blank live scenario leaves the other one alone', () => {
    const d = deal({ brokerNotes: '', templateNotes: '' }, { brokerNotes: OPENING })
    expect(swapTo(d, 0)?.bc_data.brokerNotes).toBe(OPENING)
  })

  it('and a missing one does too', () => {
    const d: any = deal({}, { brokerNotes: 'theirs' })
    delete d.bc_data.brokerNotes
    expect(swapTo(d, 0)?.bc_data.brokerNotes).toBe('theirs')
  })

  it('but what is typed wins over what is there', () => {
    expect(swapTo(deal({}, { brokerNotes: 'older words' }), 0)?.bc_data.brokerNotes).toBe(OPENING)
  })
})

describe('A NEW SCENARIO IS BLANK OF FIGURES, NOT OF THE NOTES', () => {
  const made = addScenario({ bc_data: { template: 'buy_sell', purchasePrice: '2,050,000',
                                        brokerNotes: OPENING, templateNotes: CAVEATS } },
                           'Equity release + purchase')

  it('because the clients have not changed', () => {
    expect(made?.bc_data.brokerNotes).toBe(OPENING)
    expect(made?.bc_data.templateNotes).toBe(CAVEATS)
  })

  it('and it is still blank of everything that is the scenario', () => {
    expect(made?.bc_data.purchasePrice).toBeUndefined()
    expect(made?.bc_data.template).toBeUndefined()
    expect(made?.bc_data.scenarioLabel).toBe('Equity release + purchase')
  })

  it('and the first one is parked whole', () => {
    expect(made?.bc_scenarios[0].bc.purchasePrice).toBe('2,050,000')
  })
})

describe('AND DELETING A STRUCTURE DOES NOT DELETE WHAT WAS WRITTEN TO THE CLIENT', () => {
  it('the promoted scenario keeps the notes', () => {
    const w = removeScenario(deal(), 0)
    expect(w?.bc_data.brokerNotes).toBe(OPENING)
    expect(w?.bc_data.template).toBe('investment_equity')
  })

  it('and deleting the parked one changes nothing about the live one', () => {
    const w = removeScenario(deal(), 1)
    expect(w?.bc_data.brokerNotes).toBe(OPENING)
    expect(parkedOf({ bc_scenarios: w?.bc_scenarios })).toEqual([])
  })
})
