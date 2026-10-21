// THE PORTFOLIO REVIEW, AS A SET OF FUNCTIONS.
//
// 15 Oct 2026. Ten years of clients, most of whom have never been near this
// portal, who may be sitting on equity they could use. Fabio works the numbers
// himself; the portal holds the list, remembers where each one got to, and
// stops the same person being emailed twice.
//
// Everything here is a function of its arguments. No database, no fetch, no
// clock of its own - `today` is always passed in, because a list that says
// "due today" has to be testable on a day that is not today.

import { readMoney } from './money'

// ---------------------------------------------------------------------------
// WHERE A REVIEW CAN BE
// ---------------------------------------------------------------------------
//
// The same six the database enforces in docs/portfolio-review-schema.sql. Kept
// in step by lib/portfolio-review.test.ts, which fails if they drift - the
// stage list living in two places that are free to disagree is the mistake
// this codebase keeps writing notes about.

export const STAGES = [
  { key: 'not_reviewed',      label: 'Not reviewed',     blurb: 'On the list. Nobody has looked yet.' },
  { key: 'valuation_checked', label: 'Valuation checked', blurb: 'Current values found.' },
  { key: 'numbers_done',      label: 'Numbers done',      blurb: 'The figures are in. Ready to email.' },
  { key: 'template_sent',     label: 'Template sent',     blurb: 'The email has gone.' },
  { key: 'client_responded',  label: 'Client responded',  blurb: 'They answered.' },
  { key: 'closed',            label: 'Closed',            blurb: 'Finished. See the outcome.' },
] as const

export type Stage = typeof STAGES[number]['key']

export const OUTCOMES = [
  { key: 'converted',    label: 'Became a deal' },
  { key: 'not_suitable', label: 'Not suitable now' },
  { key: 'declined',     label: 'They declined' },
  { key: 'no_response',  label: 'Never heard back' },
] as const

export type Outcome = typeof OUTCOMES[number]['key']

export function stageLabel(key: any): string {
  return STAGES.find(s => s.key === String(key ?? ''))?.label || 'Not reviewed'
}

export function outcomeLabel(key: any): string {
  return OUTCOMES.find(o => o.key === String(key ?? ''))?.label || ''
}

/** How far through the work a review is, 0 to 1. Drives nothing but the eye. */
export function stageIndex(key: any): number {
  const i = STAGES.findIndex(s => s.key === String(key ?? ''))
  return i < 0 ? 0 : i
}

// ---------------------------------------------------------------------------
// THE MONEY
// ---------------------------------------------------------------------------
//
// Entered as money with commas, stored as numeric, added up here. readMoney
// handles both, because '$650,000' reaches these functions from a form field
// and 650000 reaches them from the database, and a function that only survives
// one of those is a bug waiting for a Tuesday.
//
// EVERY ONE OF THESE RETURNS null RATHER THAN 0 WHEN IT CANNOT ANSWER.
// Zero is a claim - it says the deposit is nothing. Null says we do not know,
// and the screen prints nothing instead of a figure nobody can stand behind.

export function totalCost(price: any, duty: any): number | null {
  const p = readMoney(price)
  if (p === null) return null
  return p + (readMoney(duty) ?? 0)
}

export function depositNeeded(price: any, duty: any, loan: any): number | null {
  const total = totalCost(price, duty)
  const l = readMoney(loan)
  if (total === null || l === null) return null
  return total - l
}

/**
 * Equity release plus their savings must equal the deposit.
 *
 * Returns what to say, never a boolean, because "it does not add up" is useless
 * on its own - the person needs to know by how much and in which direction.
 */
export type Contribution =
  | { kind: 'unknown' }
  | { kind: 'adds-up'; deposit: number }
  | { kind: 'short'; by: number; deposit: number }
  | { kind: 'over'; by: number; deposit: number }

export function contributionCheck(
  price: any, duty: any, loan: any, equityRelease: any, savings: any,
): Contribution {
  const deposit = depositNeeded(price, duty, loan)
  const e = readMoney(equityRelease)
  const s = readMoney(savings)
  if (deposit === null || (e === null && s === null)) return { kind: 'unknown' }
  const put = (e ?? 0) + (s ?? 0)
  // Rounded to the dollar. Cents here are a rounding artefact of a stamp duty
  // calculator, not a real shortfall, and a warning nobody can clear is a
  // warning everybody learns to ignore.
  const gap = Math.round(put - deposit)
  if (gap === 0) return { kind: 'adds-up', deposit }
  return gap < 0
    ? { kind: 'short', by: -gap, deposit }
    : { kind: 'over', by: gap, deposit }
}

/**
 * What can come out of a property at a given LVR.
 *
 * OWNER OCCUPIED PROPERTIES RETURN null, NOT A FIGURE. You need the whole
 * portfolio on screen to have the conversation, but counting the home's equity
 * would inflate the number and the email would be wrong. Deliberately not a
 * flag the caller can forget - the function refuses.
 */
export function usableEquity(
  estimatedValue: any, currentBalance: any, investor = true, lvr = 0.8,
): number | null {
  if (!investor) return null
  const v = readMoney(estimatedValue)
  const b = readMoney(currentBalance)
  if (v === null || b === null) return null
  const out = Math.round(v * lvr) - b
  // A property already past the LVR has nothing to release. Showing a negative
  // would read as a figure you could use.
  return out > 0 ? out : 0
}

/**
 * IS THERE A LOAN RECORDED ON THIS PROPERTY AT ALL?
 *
 * 21 Oct 2026. 267 of the 656 on the book came across with a value and no
 * loan. Nothing in the export says whether that means "paid off" or "the CRM
 * never had it", and the difference is the whole figure: at 80% of a $900,000
 * house it is $720,000 of equity or it is unknown.
 *
 * The list was reading a missing loan as zero, so every one of those 267 showed
 * as fully unencumbered and sorted above the 389 who really do have a loan and
 * really might have equity. Fabio, asked which way to go: "loan unknown".
 *
 * So it is said rather than guessed. The row stays on the list - it is still a
 * client worth ringing - and where the figure would have been it says what we
 * actually know.
 */
export function loanIsUnknown(p: any): boolean {
  const current = readMoney(p?.current_balance ?? p?.currentBalance)
  const original = readMoney(p?.original_loan ?? p?.originalLoan)
  // A recorded zero IS an answer: somebody wrote down that it is paid off.
  // Only nothing at all is unknown.
  return current === null && original === null
}

/**
 * What the Usable at 80% column says for one property.
 *
 * null means "nothing to show here" - an owner occupied home, or no value.
 * 'unknown' means we have a value and no loan, so the figure cannot be worked
 * out and must not be invented.
 */
export function usableForTheList(p: any, lvr = 0.8): number | null | 'unknown' {
  if (p?.investor === false) return null
  const stored = readMoney(p?.usable_equity)
  if (stored !== null) return stored
  if (loanIsUnknown(p)) return 'unknown'
  const value = readMoney(p?.estimated_current_value ?? p?.original_value)
  if (value === null || value <= 0) return null
  const loan = readMoney(p?.current_balance ?? p?.original_loan) ?? 0
  return Math.round(value * lvr - loan)
}

export function totalUsableEquity(rows: any[], lvr = 0.8): number {
  return (rows || []).reduce<number>((t, r) => {
    const one = usableEquity(r?.estimated_current_value ?? r?.estimatedValue,
                             r?.current_balance ?? r?.currentBalance,
                             r?.investor !== false, lvr)
    return t + (one ?? 0)
  }, 0)
}

// ---------------------------------------------------------------------------
// WHEN SOMETHING IS DUE
// ---------------------------------------------------------------------------

export type Due = 'overdue' | 'today' | 'this-week' | 'later' | 'none'

const DAY = 86400000

/** The calendar day a Date falls on WHERE THE PERSON IS, never in UTC. */
function localDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * The calendar day a stored date means, read from its digits.
 *
 * NOTHING HERE IS HANDED TO new Date(string), AND THAT IS THE WHOLE POINT.
 *
 * Two mistakes, both already paid for:
 *
 *   new Date('2026-10-19')           is parsed as UTC
 *   new Date('2026-10-19T00:00:00')  is parsed as local
 *
 * One character apart, a day apart in Australia, and which one you get also
 * depends on the engine - this test suite passed under one Node and failed
 * under another on the same file, same timezone, 15 Oct 2026. A date out of
 * the database is three numbers. Reading them as three numbers is the only
 * version with no opinion in it.
 */
function dayFromText(v: any): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? '').trim())
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const out = new Date(y, mo - 1, d)
  // 31 February rolls forward silently, so it is caught rather than answered.
  return out.getMonth() === mo - 1 && out.getDate() === d ? out.getTime() : null
}

/** Whole days from today to the date. Negative is in the past. */
export function daysUntil(date: any, today: Date): number | null {
  const then = dayFromText(date)
  if (then === null) return null
  // Rounded, because a daylight saving change between the two days leaves an
  // hour over and 23/24 of a day is still one day.
  return Math.round((then - localDay(today)) / DAY)
}

export function dueState(date: any, today: Date): Due {
  const n = daysUntil(date, today)
  if (n === null) return 'none'
  if (n < 0) return 'overdue'
  if (n === 0) return 'today'
  if (n <= 7) return 'this-week'
  return 'later'
}

/** The words a person would use. Never a bare date on the near ones. */
export function whenDue(date: any, today: Date): string {
  const n = daysUntil(date, today)
  if (n === null) return ''
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  if (n < 0) return `${-n} days late`
  if (n <= 14) return `in ${n} days`
  const day = dayFromText(date)
  if (day === null) return ''
  return new Date(day).toLocaleDateString('en-AU',
    { day: 'numeric', month: 'short', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// THE MONDAY NUMBERS
// ---------------------------------------------------------------------------
//
// The strip across the top of the list. Five figures, each one a thing somebody
// would actually act on.
//
// AN OPTED-OUT CLIENT IS COUNTED NOWHERE. They asked not to hear from us, and a
// list that still counts them as "to chase" is how that promise gets broken.

export type Counts = {
  onTheList: number
  reviewed: number
  awaitingReply: number
  toChase: number
  becameDeals: number
}

export function countsFor(rows: any[], today: Date): Counts {
  const live = (rows || []).filter(r => !r?.opted_out)
  return {
    onTheList: live.length,
    reviewed: live.filter(r => stageIndex(r?.status) >= stageIndex('numbers_done')).length,
    awaitingReply: live.filter(r => r?.status === 'template_sent').length,
    toChase: live.filter(r => {
      if (r?.status === 'closed') return false
      const d = dueState(r?.due_on, today)
      return d === 'overdue' || d === 'today'
    }).length,
    becameDeals: live.filter(r => r?.outcome === 'converted').length,
  }
}

/**
 * The order the list is worked in.
 *
 * Overdue first, then today, then everything else by the day it falls due. A
 * review with no date at all goes last rather than first - it is not urgent,
 * it is unscheduled, and those two look identical if you sort nulls to the top.
 */
export function sortForTheList(rows: any[], today: Date): any[] {
  const rank = (r: any) => {
    if (r?.opted_out) return 4
    const d = dueState(r?.due_on, today)
    if (d === 'overdue') return 0
    if (d === 'today') return 1
    if (d === 'none') return 3
    return 2
  }
  return [...(rows || [])].sort((a, b) => {
    const ra = rank(a), rb = rank(b)
    if (ra !== rb) return ra - rb
    const da = daysUntil(a?.due_on, today)
    const db = daysUntil(b?.due_on, today)
    if (da !== null && db !== null && da !== db) return da - db
    return String(a?.last_name || '').localeCompare(String(b?.last_name || ''))
  })
}

/** "Daniel and Rachel", the way the email greets a joint pair. */
export function greetingName(first: any, last: any, second?: any): string {
  const a = String(first ?? '').trim()
  const b = String(second ?? '').trim()
  if (a && b) return `${a} and ${b}`
  return a || String(last ?? '').trim()
}

export function fullName(r: any): string {
  return [String(r?.first_name ?? '').trim(), String(r?.last_name ?? '').trim()]
    .filter(Boolean).join(' ')
}

// ---------------------------------------------------------------------------
// WHO MAY BE EMAILED
// ---------------------------------------------------------------------------
//
// One function, so that the list, the button and the send route cannot each
// have their own opinion. The send route is the one that matters; the other two
// exist so nobody is offered a button that is going to refuse them.

export type CanSend =
  | { ok: true }
  | { ok: false; why: string }

export function canSendTheEmail(review: any, client: any): CanSend {
  if (client?.portfolio_review_opt_out || review?.opted_out) {
    return { ok: false, why: 'They asked not to receive these.' }
  }
  if (!String(client?.email ?? review?.email ?? '').includes('@')) {
    return { ok: false, why: 'There is no email address on file.' }
  }
  if (stageIndex(review?.status) < stageIndex('numbers_done')) {
    return { ok: false, why: 'The figures are not done yet.' }
  }
  const c = contributionCheck(review?.purchase_price, review?.stamp_duty,
                              review?.loan_amount, review?.equity_release,
                              review?.savings_contribution)
  if (c.kind === 'unknown') return { ok: false, why: 'The figures are not complete.' }
  // SHORT OR OVER DOES NOT STOP THE SEND, it warns. Fabio may have a reason the
  // deposit does not tie out to the dollar, and a portal that refuses to let a
  // broker send his own email is a portal he stops using.
  if (!review?.equity_property_id) {
    return { ok: false, why: 'Say which property the equity comes from.' }
  }
  return { ok: true }
}
