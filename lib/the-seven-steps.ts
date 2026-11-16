// THE SEVEN STEPS FROM FORMAL APPROVAL TO SETTLED.
//
// 17 Nov 2026. The deal board has had four settlement columns since September -
// Formal approval, Contracts returned, Settlement booked, Settled - and two of
// them have never held a deal. Twelve deals sit in Formal approval and then
// reappear in Settled with nothing in between, and forty-four days in one column
// tells a broker nothing about where that file actually is.
//
// THE DATES WERE ALWAYS WRITABLE. stepPatch() in lib/settlement.ts has written
// contracts_returned_at and settlement_booked_at since 2 September, wired to
// buttons on the settlements board and on the deal panel. Nobody presses them,
// because two buttons buried on a panel are not a process. These seven steps are
// the process, and two of the moves write those dates as a side effect of the
// work rather than as a thing to remember.
//
// ---------------------------------------------------------------------------
// WHERE EVERY NUMBER IN HERE CAME FROM
// ---------------------------------------------------------------------------
//
// Fabio's spec of 6 November, then answered by the two people who do the job:
//
//   JULIAN KOK, settlements manager: "I am happy with those timeframes.
//   Anything in Pending Booking or Settlement Booked shouldn't have any
//   outstandings, just waiting on lenders/solicitors to book."
//
//   BELLE: "I suggest with Pending booking we can put a follow up trigger like
//   5days? Cos though pending booking has no Outstanding required from clients
//   but its sits here because the lender or solicitor hasn't confirmed a
//   settlement date."
//
// They are both right about different things. Nothing is outstanding from the
// CLIENT, which is Julian's point; something is outstanding from a LENDER, which
// is Belle's, and the deal nobody has chased for a fortnight because a solicitor
// went quiet is the deal that pushes. Fabio took Belle's five days. They agree
// on Settlement Booked: once the date is accepted there is nothing to chase.
//
// AND EVERY ONE OF THESE NUMBERS IS A GUESS UNTIL THEY HAVE RUN A MONTH ON IT.
// Fabio: "let's build a whole section in settings that these all can be changed
// as we see fit. Again, this is going to be a test and trial and error." So the
// defaults live here and Settings overrides them - see lib/settlement-settings.ts.
import { isWorkday } from './the-week'

export const STEPS = [
  'formal', 'contracts_issued', 'contracts_reviewing', 'outstandings',
  'pending_booking', 'settlement_booked', 'settled',
] as const
export type Step = typeof STEPS[number]

export const STEP_LABEL: Record<Step, string> = {
  formal: 'Formal',
  contracts_issued: 'Contracts issued',
  contracts_reviewing: 'Contracts reviewing',
  outstandings: 'Outstandings',
  pending_booking: 'Pending booking',
  settlement_booked: 'Settlement booked',
  settled: 'Settled',
}

/** What the step means, in the words the team used for it. */
export const STEP_MEANS: Record<Step, string> = {
  formal: 'Approved. Handover from the broker and credit.',
  contracts_issued: 'Loan documents are out to the client.',
  contracts_reviewing: 'Documents are back and being checked.',
  outstandings: 'Waiting on something before we can book.',
  pending_booking: 'Clear to book. Waiting on the lender or solicitor to confirm a date.',
  settlement_booked: 'Date confirmed. All parties accepted.',
  settled: 'Done.',
}

/**
 * HOW LONG A STEP MAY SIT, IN BUSINESS DAYS. null means never chased.
 *
 * Settlement Booked and Settled are off the clock by definition - the first
 * because the date is accepted and we are waiting for a day to arrive, the
 * second because it is finished.
 */
/**
 * WHY THIS DEAL IS ON THE LIST, IN ONE LINE.
 *
 * 18 Nov 2026. The box was called "Settlements stuck" and Fabio: "what does
 * settlement stuck means? I hate that word, and I want to know what defines a
 * deal to be there."
 *
 * Nothing about it is a judgement. A clock passed a number somebody set in
 * Settings, so the row says which step, how long it has sat, and the number it
 * went past - and nobody has to ask again.
 */
export function pastChaseWords(step: Step, days: number, limit: number | null): string {
  const d = Math.max(0, Math.round(days))
  const label = STEP_LABEL[step]
  const n = `${d} business day${d === 1 ? '' : 's'}`
  return limit === null || limit === undefined
    ? `${label} · ${n}`
    : `${label} · ${n}, chase at ${limit}`
}

export const DEFAULT_CHASE: Record<Step, number | null> = {
  formal: 2,
  contracts_issued: 2,
  contracts_reviewing: 3,
  outstandings: 2,
  pending_booking: 5,
  settlement_booked: null,
  settled: null,
}

/**
 * WHICH BOARD COLUMN EACH STEP SHOWS IN.
 *
 * No new columns. The steps are finer than the board needs: Contracts Issued
 * leaves the card in Formal approval, and three of them leave it in Contracts
 * returned. Coarse on the board for the whole business, fine in the deal for
 * the team working it, one driving the other so they cannot disagree.
 */
export const BOARD_COLUMN: Record<Step, string> = {
  formal: 'formal',
  contracts_issued: 'formal',
  contracts_reviewing: 'contracts_returned',
  outstandings: 'contracts_returned',
  pending_booking: 'contracts_returned',
  settlement_booked: 'settlement_booked',
  settled: 'settled',
}

const txt = (v: any) => String(v ?? '').trim()

export function isStep(v: any): v is Step {
  return (STEPS as readonly string[]).includes(txt(v))
}

/**
 * WHICH STEP A DEAL IS ON.
 *
 * Nothing is read from the old columns here. A deal that has never been moved
 * has no step, and the panel offers Formal rather than guessing one from a date
 * somebody set for another reason.
 */
export function stepOf(deal: any): Step | null {
  const s = txt(deal?.settlement_stage)
  return isStep(s) ? s : null
}

export function stepIndex(step: Step): number {
  return (STEPS as readonly string[]).indexOf(step)
}

/** Has this deal reached that step, or gone past it? */
export function reached(deal: any, step: Step): boolean {
  const on = stepOf(deal)
  return on !== null && stepIndex(on) >= stepIndex(step)
}

const ymd = (v: any): string => {
  const raw = txt(v)
  if (!raw) return ''
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const d = new Date(raw)
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

const nextDay = (day: string): string => {
  const d = new Date(day + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * BUSINESS DAYS ON THE NEW SOUTH WALES CALENDAR, PUBLIC HOLIDAYS INCLUDED.
 *
 * Fabio's standing rule for the whole portal, and the reason this does not use
 * the plain weekday count in lib/settlement.ts: a four day Easter weekend would
 * otherwise make every file in the book look neglected on the Tuesday.
 *
 * Counts the days AFTER `from` up to and including `to`, so a step entered this
 * morning is nought days old and cannot already be late.
 */
export function workdaysBetween(from: any, to: any): number {
  const a = ymd(from)
  const b = ymd(to)
  if (!a || !b || b <= a) return 0
  let n = 0
  let cur = nextDay(a)
  // A deal cannot sit on a step for ten years. The guard is against a date
  // typed as 1025 rather than 2025, which would otherwise count forever.
  for (let guard = 0; cur <= b && guard < 4000; guard++) {
    if (isWorkday(cur)) n += 1
    cur = nextDay(cur)
  }
  return n
}

/** How long this deal has been on its step. */
export function daysOnStep(deal: any, today: Date = new Date()): number {
  return workdaysBetween(deal?.settlement_stage_at, today.toISOString())
}

/**
 * IS IT PAST ITS CHASE TIME?
 *
 * A step with no chase time never is. A deal that has never been moved never is
 * either - there is nothing to be late against, and chasing somebody for not
 * having started a process that did not exist yesterday is how a new screen
 * loses people in its first week.
 */
export function isOverdue(deal: any, chase: Record<Step, number | null>, today: Date = new Date()): boolean {
  const step = stepOf(deal)
  if (!step) return false
  if (txt(deal?.settled_at)) return false
  const days = chase[step]
  if (days === null || days === undefined) return false
  return daysOnStep(deal, today) >= days
}

/**
 * WHAT MOVING TO A STEP WRITES.
 *
 * The step and its clock, and - on the two moves the board cares about - the
 * date behind a board column. Those two dates are the whole reason Contracts
 * returned and Settlement booked have been empty since September.
 *
 * NOTHING IS EVER UNWRITTEN. Moving backwards from Settlement booked to
 * Outstandings leaves settlement_booked_at alone, because it is a record that
 * the settlement WAS booked, not a claim that it still is. The step says where
 * the file is now; the dates say what has happened to it.
 */
export function movePatch(deal: any, to: Step, now: Date = new Date()): Record<string, any> {
  const at = now.toISOString()
  const patch: Record<string, any> = { settlement_stage: to, settlement_stage_at: at }

  if (to === 'contracts_reviewing' && !txt(deal?.contracts_returned_at)) {
    patch.contracts_returned_at = at
  }
  if (to === 'settlement_booked' && !txt(deal?.settlement_booked_at)) {
    patch.settlement_booked_at = at
  }
  // The settlements board reads this enum for its chip. Kept as the furthest of
  // the two, exactly as stepPatch() has always kept it.
  const returned = !!patch.contracts_returned_at || !!txt(deal?.contracts_returned_at)
  const booked = !!patch.settlement_booked_at || !!txt(deal?.settlement_booked_at)
  if (booked) patch.settlement_step = 'settlement_booked'
  else if (returned) patch.settlement_step = 'contracts_returned'

  // SETTLED IS MARKED IN ONE PLACE AND READ EVERYWHERE. The stage ladder on the
  // deal already writes settled_at with a snapshot of the loan as it settled -
  // see DealSettlement.tsx - and commission is calculated from that snapshot.
  // This must never write it, or a deal could be settled with no snapshot.
  return patch
}

/**
 * A DEAL CANNOT BE BOOKED WITH NO DATE ON IT.
 *
 * The one thing in this whole process that refuses, and it refuses because the
 * step MEANS the date is confirmed. Everything else warns and carries on.
 */
export function cannotMoveBecause(deal: any, to: Step): string {
  if (to !== 'settlement_booked') return ''
  const date = txt(deal?.confirmed_settlement_date) || txt(deal?.expected_settlement_date)
  return date ? '' : 'Settlement booked needs a settlement date on the deal first.'
}
