// A STAGE CHANGE IS A FACT, AND FACTS ARE KEPT.
//
// 17 Aug 2026. Alan's reporting pack asks for stage history: "every stage
// change is stored with a timestamp and the user who made it, and never
// overwritten." It is the thing his whole Phase 1 reads, and the settlements
// workflow needs the same record for its own chase times - so it is built once
// for both.
//
// WHAT WAS THERE ALREADY. Every milestone carries its own dated column on the
// deal, and lib/deal-phase.ts turns those into which column a deal is in. What
// they could not answer: who moved it, when it LEFT a stage, and whether a
// deal had been there before.
//
// THE DATES ARE STILL THE FAST READ. A board drawing two hundred cards is not
// going to join a history table to find out which column each one is in. The
// columns answer "where is it now"; this answers "how did it get here".
//
// WHO IS CAUGHT BY A TRIGGER, NOT BY A FUNCTION CALL. Those dates are written
// from at least six screens. Adding a call to each means the seventh forgets,
// and a history with a hole in it is worse than no history - you cannot tell a
// quiet month from a missed write. See docs/deal-stage-events.sql.

import { PHASE_ORDER, PHASE_LABEL, type Phase } from './deal-phase'

const txt = (v: any) => String(v ?? '').trim()

// --- which column means which stage -----------------------------------------

// ONE DIRECTION ONLY. deal-phase.ts maps a phase to the columns that prove it;
// this is the same list read the other way, so a column added there is a
// column known here. Written out rather than derived because the derivation
// would have to reach into a map of arrays, and a reader of this file should
// be able to see the answer.
export const COLUMN_PHASE: Record<string, Phase> = {
  proceeded_at: 'lo',
  lo_proceeded_at: 'compliance',
  compliance_sent_at: 'compliance_sent',
  lodged_at: 'lodged',
  outstanding_at: 'outstanding',
  preapproval_at: 'preapproved',
  offer_accepted_at: 'offer_accepted',
  formal_approval_at: 'formal',
  contracts_returned_at: 'contracts_returned',
  settlement_booked_at: 'settlement_booked',
  settled_at: 'settled',
}

export function phaseOfColumn(column: unknown): Phase | null {
  return COLUMN_PHASE[txt(column)] || null
}

// --- the five buckets Alan reports on ----------------------------------------

export type Bucket = 'pre_lodgement' | 'lodged' | 'approved' | 'settled' | 'lost'

export const BUCKET_LABEL: Record<Bucket, string> = {
  pre_lodgement: 'Pre-lodgement',
  lodged: 'Lodged',
  approved: 'Approved',
  settled: 'Settled',
  lost: 'Lost',
}

// HELD HERE, ON PURPOSE, AND NOWHERE ELSE.
//
// The pack: "Map every portal stage to one of five reporting buckets held in
// config, so stages can be renamed or added without breaking reports." This is
// that config. A stage renamed on the board changes one line here and every
// report follows; a stage ADDED and not listed here falls to pre-lodgement and
// bucketsAreComplete() fails the build until somebody says where it belongs.
//
// A preapproval is an approval. It is a live opportunity rather than a
// milestone passed - Fabio, 1 Sep 2026 - but for counting purposes the lender
// has said yes to something, and Alan's conversion rates read it that way.
export const PHASE_BUCKET: Record<Phase, Bucket> = {
  fact_find: 'pre_lodgement',
  bc: 'pre_lodgement',
  lo: 'pre_lodgement',
  compliance: 'pre_lodgement',
  compliance_sent: 'pre_lodgement',
  lodged: 'lodged',
  outstanding: 'lodged',
  preapproved: 'approved',
  offer_accepted: 'approved',
  formal: 'approved',
  contracts_returned: 'approved',
  settlement_booked: 'approved',
  settled: 'settled',
  lost: 'lost',
}

export function bucketOf(phase: unknown): Bucket {
  return PHASE_BUCKET[txt(phase) as Phase] || 'pre_lodgement'
}

/** Every phase has a bucket. A test fails the ship if one is ever added without. */
export function bucketsAreComplete(): boolean {
  return PHASE_ORDER.every(p => Object.prototype.hasOwnProperty.call(PHASE_BUCKET, p))
}

// --- the events ---------------------------------------------------------------

export type StageEventRow = {
  deal_id?: string
  column_name: string
  entered_at: string
  changed_by?: string | null
}

export type StageEvent = {
  phase: Phase
  label: string
  bucket: Bucket
  enteredAt: string
  /** When the deal moved on. Null while it is still here. */
  exitedAt: string | null
  /** Whole days between the two, or to now where it has not moved. */
  days: number
  changedBy: string | null
}

/**
 * The history of one deal, in order, with the gaps worked out.
 *
 * Rows that name a column this build does not know are dropped rather than
 * drawn as a blank stage - a column removed from the portal is not a stage
 * with no name, it is not a stage.
 */
export function historyOf(rows: StageEventRow[], now: Date = new Date()): StageEvent[] {
  const kept = (rows || [])
    .map(r => ({ r, phase: phaseOfColumn(r?.column_name), at: txt(r?.entered_at) }))
    .filter(x => x.phase && x.at)
    .sort((a, b) => a.at.localeCompare(b.at))

  // A STAGE REACHED TWICE IS TWO ROWS AND ONE STAY. A deal moved back and
  // forward has the same phase in here more than once; what a reader wants is
  // the time it spent there each time, not a merged total that hides the move.
  return kept.map((x, i) => {
    const next = kept[i + 1]
    const exited = next ? next.at : null
    return {
      phase: x.phase as Phase,
      label: PHASE_LABEL[x.phase as Phase] || txt(x.phase),
      bucket: bucketOf(x.phase),
      enteredAt: x.at,
      exitedAt: exited,
      days: wholeDays(x.at, exited || now.toISOString()),
      changedBy: x.r?.changed_by || null,
    }
  })
}

function wholeDays(from: string, to: string): number {
  const a = new Date(from).getTime(), b = new Date(to).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.floor((b - a) / 86_400_000))
}

/** The last event, which is where the deal is now. */
export function nowAt(history: StageEvent[]): StageEvent | null {
  return history.length ? history[history.length - 1] : null
}

/** How long it has sat where it is. The number the chase reads. */
export function daysHere(history: StageEvent[]): number {
  return nowAt(history)?.days ?? 0
}

/** When a deal first reached a phase, or null. Reached twice counts the first. */
export function firstReached(history: StageEvent[], phase: Phase): string | null {
  return history.find(e => e.phase === phase)?.enteredAt || null
}

/**
 * Time spent in a bucket, across every visit.
 *
 * What Alan's turnaround measures read: lodged to approved is the time in the
 * Lodged bucket however many times the lender came back with conditions.
 */
export function daysInBucket(history: StageEvent[], bucket: Bucket): number {
  return history.filter(e => e.bucket === bucket).reduce((t, e) => t + e.days, 0)
}

/** Did this deal ever go backwards? Two rows of the same phase says so. */
export function wentBackwards(history: StageEvent[]): boolean {
  const seen = new Set<Phase>()
  for (const e of history) {
    if (seen.has(e.phase)) return true
    seen.add(e.phase)
  }
  return false
}

// --- the history a deal already has -------------------------------------------

/**
 * The same history, read off the deal's own dated columns.
 *
 * Every deal in the book has one of these from the day the table is created,
 * without a backfill job and without waiting for the trigger to see a change.
 * The user is null on all of it, which is honest: nobody recorded who moved
 * those deals, and writing a guess in would be worse than a blank.
 */
export function historyFromColumns(deal: any, now: Date = new Date()): StageEvent[] {
  const rows: StageEventRow[] = Object.keys(COLUMN_PHASE)
    .map(col => ({ column_name: col, entered_at: txt(deal?.[col]), changed_by: null }))
    .filter(r => r.entered_at)
  return historyOf(rows, now)
}

/**
 * Both, with the recorded rows winning.
 *
 * A deal carries dates from before the trigger existed AND rows written since.
 * Where both describe the same stage, the recorded row is the one with a user
 * on it, so it is the one kept.
 */
export function mergedHistory(deal: any, rows: StageEventRow[], now: Date = new Date()): StageEvent[] {
  const recorded = new Set((rows || []).map(r => txt(r?.column_name)).filter(Boolean))
  const fromColumns: StageEventRow[] = Object.keys(COLUMN_PHASE)
    .filter(col => !recorded.has(col))
    .map(col => ({ column_name: col, entered_at: txt(deal?.[col]), changed_by: null }))
    .filter(r => r.entered_at)
  return historyOf([...(rows || []), ...fromColumns], now)
}
