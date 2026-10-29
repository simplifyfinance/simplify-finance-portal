// TWO SCENARIOS ON ONE DEAL.
//
// Fabio, 1 Oct 2026: "custoemr with multiple scenarios... we are now having to
// clone deals and I want to fix that... some customer would like a investment
// purchase and a refinance euqity release sceanrio... once then when we sleect
// the correct scenatio on BC... THAT dictates LO complaince etc".
//
// WHY THE CHOSEN SCENARIO STAYS IN bc_data.
//
// Forty-six files read deal.bc_data - the compliance boxes, the lending
// options, the documents list, four PDF builders, the client emails, the board.
// Any design that asks those files which scenario they mean is a rewrite of the
// portal and forty-six chances to get it wrong.
//
// So bc_data IS the scenario in play. The other one is parked in bc_scenarios
// beside it, and switching is a SWAP: the live one goes into the list, the
// picked one comes out, in a single write. A scenario is in bc_data or it is in
// the list, never in both - so there is no pair of records free to disagree,
// which is the fault this codebase has paid for six times.
//
// THE TAB YOU ARE EDITING IS THE SCENARIO IN PLAY. That is only safe while
// nothing downstream exists, and it is exactly Fabio's own rule: "I rather we
// clone the deal and change if we have to switch after LO is sent." Once
// lending options have content the swap is not offered at all.
//
// TWO, NOT THREE. Fabio, 1 Oct 2026: "2 options max."

import { templateLabel } from './templates'
import { lenderOnTheDeal } from './client-agreement'

const txt = (v: any) => String(v ?? '').trim()

export const MAX_SCENARIOS = 2

// A parked scenario is a WHOLE bc_data, never a reduced copy of one.
//
// The alternative-scenario box in lib/alt-scenario.ts was built as a cut-down
// copy of the main scenario and by September had four separate faults - no
// repayment type, no interest-only period, a deposit that stopped recalculating
// - every one of them because a reduced copy never keeps up with the thing it
// was copied from. The same shape cannot fall behind.
export type ParkedScenario = {
  bc: any
  // Parked with it, or scenario two inherits scenario one's completed tick.
  completedAt: string | null
}

export function parkedOf(deal: any): ParkedScenario[] {
  const raw = deal?.bc_scenarios
  if (!Array.isArray(raw)) return []
  return raw
    .filter(x => x && typeof x === 'object' && x.bc && typeof x.bc === 'object')
    .slice(0, MAX_SCENARIOS - 1)
    .map(x => ({ bc: x.bc, completedAt: txt(x.completedAt) || null }))
}

export function scenarioCount(deal: any): number {
  return 1 + parkedOf(deal).length
}

export function canAdd(deal: any): boolean {
  return scenarioCount(deal) < MAX_SCENARIOS
}

// WHAT A SCENARIO IS CALLED. Its own name if somebody typed one, otherwise the
// scenario it is - which is what they would have typed anyway. The label lives
// inside the bc, so it travels with the scenario and has one home.
export function labelOf(bc: any): string {
  return txt(bc?.scenarioLabel) || templateLabel(bc?.template) || 'Scenario'
}

export type Tab = { label: string; live: boolean; parkedIndex: number }

// The live one first, because it is the one being worked on and the one
// everything downstream is built from.
export function tabsOf(deal: any): Tab[] {
  return [
    { label: labelOf(deal?.bc_data), live: true, parkedIndex: -1 },
    ...parkedOf(deal).map((p, i) => ({ label: labelOf(p.bc), live: false, parkedIndex: i })),
  ]
}

// --- is anything downstream built on this scenario yet? ----------------------

// WHEN THE SWAP STOPS BEING OFFERED.
//
// Erring towards frozen on purpose. A swap underneath a written set of lending
// options leaves the file describing a loan the clients are not taking, which is
// the same class of fault as a deal reading Macquarie after the clients chose
// ubank. Anything that looks like downstream work counts.
export function downstreamStarted(deal: any): boolean {
  const lo = deal?.lo_data || {}
  if (txt(lo.emailHtml)) return true
  if (Array.isArray(lo.lenders) && lo.lenders.some((l: any) => txt(l?.lenderName))) return true
  // THROUGH lenderOnTheDeal, NOT OFF recommendedLender.
  //
  // Reading that box directly is how the portal came to tell Lucy Ilbery and
  // Andrew Leigh they were with Macquarie after they had chosen ubank, and
  // lib/lender-on-the-deal.test.ts fails the build for it - correctly, even
  // here where the question is only "has anybody started". One reader, one
  // answer, no exceptions to argue about later.
  if (txt(lenderOnTheDeal(lo))) return true
  if (deal?.lo_client_proceeded) return true
  if (deal?.client_proceeded) return true
  if (txt(deal?.lodged_at) || txt(deal?.preapproval_at) || txt(deal?.formal_approval_at)) return true
  return txt(deal?.stage) !== '' && txt(deal?.stage) !== 'BC' && txt(deal?.stage) !== 'FactFind'
}

export function canSwap(deal: any): boolean {
  return parkedOf(deal).length > 0 && !downstreamStarted(deal)
}

// --- the writes --------------------------------------------------------------
//
// Every one of these returns the WHOLE set of columns to write, so a swap is one
// update and a scenario cannot be lost between two of them.

// THE OPENING PARAGRAPH, WHICH IS ABOUT THE CLIENTS AND NOT ABOUT THE
// STRUCTURE.
//
// brokerNotes is what the broker writes at the top of the client email. It is
// the same words whichever option they take, and typing it twice is how one
// copy ends up a version behind the other in front of a client.
//
// "IMPORTANT THINGS TO NOTE" IS NOT IN HERE, AND WAS FOR HALF A DAY.
//
// 29 Oct 2026. Fabio, once he saw why the box was empty: "each template has its
// own pre determined items, can we merge both together in html email when this
// is being generated." He is right and I had it backwards. That list is
// pre-filled per template - a Buy / sell warns about the sale price being an
// estimate and about capital gains tax, an equity release says none of that -
// so each scenario keeps its own, and the EMAIL puts both in front of the
// client. See lib/scenario-notes.ts.
const SHARED_NOTES = ['brokerNotes'] as const

/**
 * The scenario coming out, with the notes from the one going in.
 *
 * Only where there is something to carry. Every save writes both keys, so a
 * scenario nobody typed notes into holds an empty string, and letting that win
 * would empty the other scenario's boxes the first time somebody switched tabs.
 */
function withNotes(target: any, from: any): any {
  const out = { ...(target && typeof target === 'object' ? target : {}) }
  for (const key of SHARED_NOTES) {
    if (txt(from?.[key])) out[key] = from[key]
  }
  return out
}

export type ScenarioWrite = {
  bc_data: any
  bc_scenarios: ParkedScenario[]
  bc_completed_at: string | null
}

export function swapTo(deal: any, parkedIndex: number): ScenarioWrite | null {
  const parked = parkedOf(deal)
  const target = parked[parkedIndex]
  if (!target) return null
  const next = parked.slice()
  // The one coming out is replaced by the one going in, in its place - so the
  // tabs do not reorder under somebody's hand every time they switch.
  next[parkedIndex] = { bc: deal?.bc_data || {}, completedAt: txt(deal?.bc_completed_at) || null }
  // The notes come with you. See withNotes above.
  return { bc_data: withNotes(target.bc, deal?.bc_data), bc_scenarios: next,
           bc_completed_at: target.completedAt }
}

// A NEW SCENARIO IS BLANK, AND IT IS THE ONE YOU LAND ON.
//
// Blank rather than a copy of the first: these are two different shapes, which
// is the whole reason for having two, and a copy would have somebody editing an
// investment purchase into a refinance box by box.
export function addScenario(deal: any, label: string): ScenarioWrite | null {
  if (!canAdd(deal)) return null
  const parked = parkedOf(deal)
  return {
    // Blank of every figure, and not of the two note boxes - those are about
    // the clients, who have not changed. See withNotes above.
    bc_data: withNotes({ scenarioLabel: txt(label) || 'Second scenario' }, deal?.bc_data),
    bc_scenarios: [...parked, { bc: deal?.bc_data || {}, completedAt: txt(deal?.bc_completed_at) || null }],
    bc_completed_at: null,
  }
}

// Removing the one you are NOT on. Removing the live one would mean deciding
// which of the others becomes live, and on a deal with two there is only one
// answer - so it is the same thing said more simply: swap to it, then remove.
export function removeParked(deal: any, parkedIndex: number): ScenarioWrite | null {
  const parked = parkedOf(deal)
  if (!parked[parkedIndex]) return null
  return {
    bc_data: deal?.bc_data || {},
    bc_scenarios: parked.filter((_, i) => i !== parkedIndex),
    bc_completed_at: txt(deal?.bc_completed_at) || null,
  }
}

// DELETING A SCENARIO, WHICHEVER ONE YOU ARE LOOKING AT.
//
// 15 Oct 2026. Fabio: "if I remove the investment purchase scenario, it deletes
// everything within that scenario ... when I create a scenario and I type
// everything and then I add another scenario, I can delete the previous one."
//
// removeParked() below could only ever remove the one you were NOT on, through
// a grey link at the far right of the row. You cannot point at the scenario you
// mean and delete it, which is what anybody would try first.
//
// `index` is the tab's position as tabsOf() lists them: 0 is the live one,
// 1 upwards are the parked ones.
//
// DELETING THE LIVE SCENARIO PROMOTES THE OTHER ONE. It does not leave the deal
// with no scenario, and it does not quietly keep the one that was deleted - the
// remaining scenario becomes the one going ahead, which is the only answer that
// leaves the deal in a state somebody can carry on working.
export function removeScenario(deal: any, index: number): ScenarioWrite | null {
  const parked = parkedOf(deal)
  // The last scenario is the deal. There is nothing to fall back to.
  if (parked.length === 0) return null

  if (index === 0) {
    // THE ONE GOING AHEAD IS BEING DELETED. Refused once lending options or
    // anything after them exist, for the same reason a swap is: the file would
    // describe a loan the clients are not taking.
    if (downstreamStarted(deal)) return null
    const [promoted, ...rest] = parked
    return {
      // Deleting a structure does not delete what was written to the clients.
      bc_data: withNotes(promoted.bc, deal?.bc_data),
      bc_scenarios: rest,
      bc_completed_at: promoted.completedAt,
    }
  }

  const at = index - 1
  if (!parked[at]) return null
  return {
    bc_data: deal?.bc_data || {},
    bc_scenarios: parked.filter((_, i) => i !== at),
    bc_completed_at: txt(deal?.bc_completed_at) || null,
  }
}

/** Why a scenario cannot be deleted, in words, or empty when it can. */
export function whyNotDelete(deal: any, index: number): string {
  if (parkedOf(deal).length === 0) return 'A deal needs one scenario.'
  if (index === 0 && downstreamStarted(deal)) {
    return 'Lending options have been started on this one. Switch to the other scenario first.'
  }
  return ''
}

export function renameLive(deal: any, label: string): { bc_data: any } {
  return { bc_data: { ...(deal?.bc_data || {}), scenarioLabel: txt(label) } }
}

// --- what the client is shown, and what they pressed -------------------------

// The two options, in the order the client sees them: the one in play first.
export function optionsForClient(deal: any): { option: number; label: string; bc: any }[] {
  return [
    { option: 1, label: labelOf(deal?.bc_data), bc: deal?.bc_data || {} },
    ...parkedOf(deal).map((p, i) => ({ option: i + 2, label: labelOf(p.bc), bc: p.bc })),
  ]
}

export function hasTwoScenarios(deal: any): boolean {
  return scenarioCount(deal) === 2
}

// WHICH OPTION THE CLIENT PRESSED, OFF A URL THEY CONTROL.
//
// Anything that is not exactly "1" or "2" is nothing. The value reaches a
// database write and a rendered page from a link in an email, so it is checked
// into one of three known shapes before it is allowed to be either.
export function optionFromLink(raw: any): 1 | 2 | null {
  const v = txt(raw)
  return v === '1' ? 1 : v === '2' ? 2 : null
}
