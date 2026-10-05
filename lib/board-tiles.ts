// THE FOUR NUMBERS ACROSS THE TOP OF THE BOARD.
//
// 2 Oct 2026. The old four were "Your deals", "BC ready for review", "LO ready
// for review" and "In application". Two of them were amber, which came out the
// same olive as the chase red to a red-green colourblind reader, and two of them
// were the same idea split in half.
//
// The new four answer the four questions somebody actually opens the board
// with: what is on fire, what is waiting for me, what is out of my hands, and
// how much is there altogether.
//
// EVERY RULE IS WRITTEN HERE AND NOWHERE ELSE. The tile and the board have to
// agree, and the only way they can be made to agree is to ask the same function.
// The old "Compliance completed" box counted one way while the list counted
// another, so a headline of nine opened an empty screen. That is the failure
// this file exists to prevent, and lib/board-tiles.test.ts holds it shut.

import { ageGroupOf } from './deal-age'
import { phaseOf, isFinished, type Phase } from './deal-phase'
import type { ThresholdMap } from './board-settings'

export type TileKey = 'chase' | 'review' | 'waiting' | 'all'
export const TILE_KEYS: TileKey[] = ['chase', 'review', 'waiting', 'all']

export const TILE_LABEL: Record<TileKey, string> = {
  chase:   'Needs you today',
  review:  'Ready for your review',
  waiting: 'Waiting on someone',
  all:     'All live deals',
}

// --------------------------------------------------------------- needs you
//
// EXACTLY THE DEALS ALREADY WEARING A RED CHIP. Not "and also these" - the same
// single question the card asks and the column header counts, asked once more.
// Fabio chose this deliberately over a wider net: a tile that disagrees with the
// cards underneath it is worse than no tile.
export function needsChasing(deal: any, thresholds?: ThresholdMap): boolean {
  return ageGroupOf(deal, thresholds) === 'nudge'
}

// ------------------------------------------------------------- ready for you
//
// The two old tiles, unchanged in their maths and joined in their display. BC
// and LO are still counted separately because the split is still shown beside
// the number - what has gone is the idea that they are two different errands.
export function readyStageFor(deal: any): 'BC' | 'LO' | null {
  if (deal?.lo_completed_at && !deal?.compliance_completed_at) return 'LO'
  if (deal?.bc_completed_at && !deal?.lo_completed_at && !deal?.compliance_completed_at) return 'BC'
  return null
}

export function readyForReview(deal: any): boolean {
  return readyStageFor(deal) !== null
}

// -------------------------------------------------------- waiting on someone
//
// THE BALL IS OUT OF THIS OFFICE. Purple means not ours right now, and that is
// a different thing from late - a file sitting with a lender for two days is not
// a problem, it is simply not ours to move.
//
// WHAT IS DELIBERATELY ABSENT, because both look like waiting and are not:
//
//   preapproved   the client is house-hunting. Nobody is holding anything up.
//   outstanding   conditions - payslips, a contract. That is the CLIENT, and a
//                 client who has gone quiet is ours to chase, not somebody
//                 else's to deliver. Fabio, 2 Oct: waiting means "sitting with a
//                 lender or a third party", not waiting on the client.
//
// If a stage ever needs moving in or out of this list, it is moved HERE, once,
// and the tile and any filter built on it move together.
export const WAITING_PHASES: Phase[] = [
  'compliance_sent',      // with compliance or support
  'lodged',               // with the lender, being assessed
  'offer_accepted',       // with the lender, on its way to formal
  'formal',               // with the solicitor and the lender
  'contracts_returned',   // with the solicitor
  'settlement_booked',    // with the lender, waiting on a date
]

export function waitingOnSomeone(deal: any): boolean {
  return WAITING_PHASES.includes(phaseOf(deal) as Phase)
}

// --------------------------------------------------------------- the counts
//
// LIVE DEALS ONLY, every one of them. A settled deal is not waiting on anybody
// and a lost one is not needing chasing, and counting them would put a number on
// screen that no amount of pressing the tile could ever show.

export function isLive(deal: any): boolean {
  return !isFinished(deal)
}

export function matchesTile(deal: any, key: TileKey, thresholds?: ThresholdMap): boolean {
  if (!isLive(deal)) return false
  if (key === 'all') return true
  if (key === 'chase') return needsChasing(deal, thresholds)
  if (key === 'review') return readyForReview(deal)
  return waitingOnSomeone(deal)
}

// WHAT COLOUR THE CARD ITSELF WEARS.
//
// 6 Oct 2026, docs/approved-looks/one-card-marking.html - "the stripe is gone,
// colour all the way round". The card is marked with the tone of the tile that
// counts it, which is why this lives here beside the counting rather than in
// the page: a card and the tile above it cannot disagree if they are the same
// three questions.
//
// ONE DEAL CAN BE TWO THINGS AT ONCE - behind on a stage AND waiting on a
// valuation. The order is the order of the tiles, and the order you would want
// to be told: what is late first, then what is sitting with you, then what is
// sitting with somebody else.
export type CardTone = 'chase' | 'review' | 'waiting' | null

export function cardTone(deal: any, thresholds?: ThresholdMap): CardTone {
  if (!isLive(deal)) return null
  if (needsChasing(deal, thresholds)) return 'chase'
  if (readyForReview(deal)) return 'review'
  if (waitingOnSomeone(deal)) return 'waiting'
  return null
}

export type TileCounts = {
  chase: number
  review: number
  /** The split shown beside "Ready for your review". */
  bc: number
  lo: number
  waiting: number
  all: number
}

export function tileCounts(deals: any[], thresholds?: ThresholdMap): TileCounts {
  const live = (deals || []).filter(isLive)
  let chase = 0, bc = 0, lo = 0, waiting = 0
  for (const d of live) {
    if (needsChasing(d, thresholds)) chase++
    const stage = readyStageFor(d)
    if (stage === 'BC') bc++
    else if (stage === 'LO') lo++
    if (waitingOnSomeone(d)) waiting++
  }
  return { chase, review: bc + lo, bc, lo, waiting, all: live.length }
}

// The line under "Ready for your review": "BC 17 · LO 3". Empty when there is
// nothing to split, so the tile does not carry "BC 0 · LO 0" around.
export function reviewSplit(c: TileCounts): string {
  return c.review === 0 ? '' : `BC ${c.bc} · LO ${c.lo}`
}

// The line under "All live deals": what is NOT being counted, so the number
// never looks like it has lost deals rather than excluded them.
export function closedLine(totalInBook: number, live: number): string {
  const closed = totalInBook - live
  return closed > 0 ? `${closed} settled or lost` : 'none closed'
}
