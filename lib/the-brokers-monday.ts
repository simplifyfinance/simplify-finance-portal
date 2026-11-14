// THE BROKER'S OWN MONDAY.
//
// 12 Nov 2026. Fabio, on the broker screen: "New deal card must work,
// clickable client names, and That is my week raises a red mark for admin."
//
// And on why the page exists at all - mocked and approved the same day:
//
//   "The Monday ask is the whole point. His four answers are exactly what
//    fills your Simplify Finance Brokers section on the admin page - same
//    three buttons, same three answers, written to the same place. Nobody
//    types anything twice."
//
// THIS IS THE ONLY SCREEN IN THE PORTAL THAT ASKS A SELF-EMPLOYED BROKER FOR
// ANYTHING. Keanen and Justin are not managed. They are not on the target,
// there is no league table, and nothing here is red at them. It asks once on a
// Monday and then gets out of the way.
//
// NOTHING IS WORKED OUT TWICE. Which deals can lodge, and what each answer
// means, are lib/the-run-through.ts - the same rules the Monday meeting runs
// on. If the two ever disagreed, a broker would answer about a deal that never
// reached the meeting, which is worse than not asking.
import { couldLodge, seatOf, lodgeRank, type Seat } from './the-run-through'
import { phaseOf, type Phase } from './deal-phase'

const txt = (v: any) => String(v ?? '').trim()

/** Monday, in the office's week. */
export function isMonday(now: Date = new Date()): boolean {
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Australia/Sydney', weekday: 'short',
  }).format(now)
  return day === 'Mon'
}

/**
 * THE DEALS HE IS BEING ASKED ABOUT.
 *
 * His own, and only the ones that could actually lodge - compliance issued,
 * lending options, or a BC sitting with the client. Asking him about a fact
 * find is asking him to guess.
 *
 * Closest to lodging first, because the top of the list is the part anybody
 * reads properly.
 */
export function askAbout(deals: any[], brokerKey: any, sameBroker: (a: any, b: any) => boolean): any[] {
  const key = txt(brokerKey)
  if (!key) return []
  return (deals || [])
    .filter(d => sameBroker(d?.assigned_broker, key))
    .filter(couldLodge)
    .sort((a, b) => lodgeRank(a) - lodgeRank(b))
}

export type Progress = { answered: number; toGo: number; all: number }

/**
 * HOW FAR THROUGH HE IS. Shown as "4 answered · 2 to go" rather than a bar,
 * because six is a number you can hold in your head.
 */
export function progress(deals: any[], now: Date = new Date()): Progress {
  const all = (deals || []).length
  const answered = (deals || []).filter(d => {
    const seat = seatOf(d, now)
    return seat !== null && seat !== 'nobody'
  }).length
  return { answered, toGo: Math.max(0, all - answered), all }
}

/** Every one of them has had an answer. The button has done its job. */
export function allAnswered(deals: any[], now: Date = new Date()): boolean {
  const p = progress(deals, now)
  return p.all > 0 && p.toGo === 0
}

/**
 * WHAT THE BUTTON SAYS.
 *
 * It is never "you have not finished". He is not being chased, and a
 * self-employed broker reading a nag on a Monday morning closes the tab.
 */
export function buttonWords(deals: any[], now: Date = new Date()): string {
  return allAnswered(deals, now) ? 'That is my week' : 'That is my week'
}

export function progressWords(p: Progress): string {
  if (p.all === 0) return ''
  if (p.toGo === 0) return `all ${p.all} answered`
  return `${p.answered} answered · ${p.toGo} to go`
}

// ---------------------------------------------------------------------------
// WHERE MY DEALS ARE
// ---------------------------------------------------------------------------
//
// The thing a self-employed broker cannot see today and rings up to ask: which
// of our credit team is holding each of his files, and how long they have had
// it. It is not a count for its own sake - every line answers "who do I chase".

/**
 * THE FIVE STAGES A BROKER THINKS IN.
 *
 * NOT A SECOND IDEA OF WHAT STAGE A DEAL IS IN. phaseOf() in lib/deal-phase.ts
 * is the portal's answer - it reads the deal's own record, honours a stage set
 * by hand, and has thirteen phases because the back half of a loan has that
 * many. This folds those thirteen into the five a broker asks about, and folds
 * nothing else.
 *
 * 14 Nov 2026: I wrote my own ladder here first, reading lodged_at and
 * compliance_sent_at directly. That is the fault I spent the day fixing - two
 * files each deciding the same thing, and the weaker one eventually disagrees.
 */
export type StageName =
  | 'Fact find' | 'Borrowing capacity' | 'Lending options' | 'Compliance'
  | 'Lodged, waiting on the bank'

export const STAGE_ORDER: StageName[] = [
  'Fact find', 'Borrowing capacity', 'Lending options', 'Compliance',
  'Lodged, waiting on the bank',
]

const FOLD: Partial<Record<Phase, StageName>> = {
  fact_find: 'Fact find',
  bc: 'Borrowing capacity',
  lo: 'Lending options',
  compliance: 'Compliance',
  compliance_sent: 'Compliance',
  // Everything from lodgement on is one line to a broker: it is with the bank
  // and the job is chasing it. The detail is on the deal card.
  lodged: 'Lodged, waiting on the bank',
  outstanding: 'Lodged, waiting on the bank',
  preapproved: 'Lodged, waiting on the bank',
  offer_accepted: 'Lodged, waiting on the bank',
  formal: 'Lodged, waiting on the bank',
  contracts_returned: 'Lodged, waiting on the bank',
  settlement_booked: 'Lodged, waiting on the bank',
  // settled and lost are not here. A finished deal is not somewhere you can
  // chase it, and a broker's morning is about the live book.
}

/** Which of the five a deal sits in, or null if it is finished or lost. */
export function stageOf(deal: any): StageName | null {
  if (!deal) return null
  return FOLD[phaseOf(deal)] || null
}

export type StageRow = {
  stage: StageName
  count: number
  /** The deals in it, so pressing the row can show them without another query. */
  deals: any[]
}

export function byStage(deals: any[]): StageRow[] {
  const bucket = new Map<StageName, any[]>()
  for (const s of STAGE_ORDER) bucket.set(s, [])
  for (const d of deals || []) {
    const s = stageOf(d)
    if (s) bucket.get(s)!.push(d)
  }
  return STAGE_ORDER
    .map(stage => ({ stage, count: bucket.get(stage)!.length, deals: bucket.get(stage)! }))
    .filter(r => r.count > 0)
}

export function whoHasIt(deal: any, officerName: (id: any) => string): string {
  if (stageOf(deal) === 'Lodged, waiting on the bank') return 'With the lender'
  const held = deal?.compliance_owner_officer || deal?.assigned_credit_officer
  const name = officerName(held)
  if (name) return `${name} has it`
  return 'With you'
}

/** The line under a stage heading: what is actually happening in it. */
export function stageNote(row: StageRow, officerName: (id: any) => string): string {
  const withUs = row.deals.filter(d =>
    !!(d?.compliance_owner_officer || d?.assigned_credit_officer)).length
  const withThem = row.count - withUs
  if (row.stage === 'Lodged, waiting on the bank') return 'with the lender'
  if (withUs === 0) return withThem === 1 ? 'with you' : 'with you'
  if (withThem === 0) return withUs === 1 ? 'with our credit team' : 'all with our credit team'
  return `${withUs} with credit, ${withThem} with you`
}

export type { Seat }
