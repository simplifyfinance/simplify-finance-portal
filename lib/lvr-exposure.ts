// LVR EXPOSURE, ON THE WHOLE BOOK.
//
// 21 Oct 2026. The report read clients.position_properties, which held 33
// properties across the entire portal - the handful of clients who have been
// through a full fact find here. Thirty rows looks like a report, so nobody
// noticed it was showing about four percent of the lending.
//
// The portfolio review holds 760. Same question, twenty times the answer.
//
// WHAT THIS DOES NOT FIX. The loan side can be the lender's own figure, from
// the trail statement, dated. The value side cannot: nothing in a statement
// says what a house is worth. So every row carries where its two numbers came
// from, because a 53% LVR against a settlement value from 2016 is not 53% and
// the screen has to say so rather than letting somebody read it as current.
//
// Nothing here touches a database. app/(app)/reports/page.tsx reads the rows
// and hands them over.

export type Holding = {
  review_id: string
  address: string | null
  investor: boolean
  original_value: number | null
  original_loan: number | null
  current_balance: number | null
  balance_as_at: string | null
  estimated_current_value: number | null
  valuation_date: string | null
}

export type Named = { review_id: string; first_name: string | null; last_name: string | null }

/** Where a figure came from, so nobody reads an old one as current. */
export type Source =
  | { kind: 'lender'; on: string }       // the trail statement, that month
  | { kind: 'estimate'; on: string }     // somebody looked it up, that day
  | { kind: 'book-loan' }                // the spreadsheet, undated
  | { kind: 'settlement' }               // what it was worth when the loan started

export type Band = 'hot' | 'warm' | 'cool'

export type Row = {
  reviewId: string
  client: string
  address: string
  investor: boolean
  value: number
  valueFrom: Source
  loan: number
  loanFrom: Source
  lvr: number
  band: Band
  /** The loan is the lender's own, dated. Anything else is history. */
  current: boolean
}

// WHAT THE TILES ARE ALLOWED TO CLAIM.
//
// 21 Oct 2026, within an hour of shipping this. The first version counted
// every row: 359 at 80% or over, in red, across the top of the screen. It read
// as a risk finding and it was nothing of the sort.
//
// A purchase with a 10% deposit IS 90% LVR on the day it settles. 308 of those
// 359 were settlement-day figures, correct and meaningless. Another 39 were
// over 100% because the value is the land and the loan is land plus build on a
// construction deal.
//
// So exposure is counted ONLY where the loan is today's figure. Where it is
// not, the row still shows - it is the only thing we hold - but it is history
// and it is not counted, coloured or sorted as though somebody should act on
// it.
export type Totals = {
  /** Rows carrying the lender's own balance. The only ones that mean anything. */
  current: number
  /** Of the current ones. */
  over80: number
  /** Of the current ones. */
  between: number
  /** Still on what the book said when it was exported. */
  stillOnBook: number
  /** Every row, because a sum is not a claim about risk. */
  lending: number
}

// WHERE THE LINE IS.
//
// 80 is the one that matters - it is where LMI starts and where a lender's
// pricing changes. 70 is the second look: not a problem, but the ones that
// will cross 80 if a value softens.
export const HOT = 80
export const WARM = 70

export function bandFor(lvr: number): Band {
  if (lvr >= HOT) return 'hot'
  if (lvr >= WARM) return 'warm'
  return 'cool'
}

const n = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null
  const x = Number(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(x) ? x : null
}

/**
 * THE VALUE, AND WHICH ONE IT IS.
 *
 * An estimate somebody looked up beats what the property was worth on the day
 * the loan settled. Neither is a valuation and the row says which it is.
 */
export function valueOf(h: Holding): { amount: number | null; from: Source } {
  const est = n(h.estimated_current_value)
  if (est !== null && est > 0) {
    return { amount: est, from: { kind: 'estimate', on: String(h.valuation_date || '') } }
  }
  return { amount: n(h.original_value), from: { kind: 'settlement' } }
}

/**
 * THE LOAN, AND WHICH ONE IT IS.
 *
 * A dated balance is the lender's own, off the trail statement. Undated, it is
 * the book's figure from the day it was exported, and the fallback is the
 * book's original loan - which is history and never changes.
 */
export function loanOf(h: Holding): { amount: number | null; from: Source } {
  const cur = n(h.current_balance)
  if (cur !== null && cur > 0) {
    const on = String(h.balance_as_at || '')
    return { amount: cur, from: on ? { kind: 'lender', on } : { kind: 'book-loan' } }
  }
  return { amount: n(h.original_loan), from: { kind: 'book-loan' } }
}

/**
 * EVERY PROPERTY WE CAN WORK AN LVR ON, WORST FIRST.
 *
 * A property with no value, or no loan, is left out rather than shown at zero.
 * The old report did the same thing silently; the screen says how many it left
 * out, because "nothing to show" and "we do not know" look identical.
 */
export function exposure(holdings: Holding[], names: Named[]): Row[] {
  const nameFor = new Map<string, string>()
  for (const r of names || []) {
    const full = `${r.first_name || ''} ${r.last_name || ''}`.trim()
    nameFor.set(r.review_id, full || 'Name not recorded')
  }

  const out: Row[] = []
  for (const h of holdings || []) {
    const v = valueOf(h)
    const l = loanOf(h)
    if (v.amount === null || v.amount <= 0) continue
    if (l.amount === null || l.amount <= 0) continue
    const lvr = Math.round((l.amount / v.amount) * 1000) / 10
    out.push({
      reviewId: h.review_id,
      client: nameFor.get(h.review_id) || 'Name not recorded',
      address: String(h.address || 'Address not set'),
      investor: !!h.investor,
      value: v.amount, valueFrom: v.from,
      loan: l.amount, loanFrom: l.from,
      lvr, band: bandFor(lvr),
      current: l.from.kind === 'lender',
    })
  }
  // TODAY'S FIGURES FIRST, worst first within each. A settlement LVR from 2016
  // sorted above a real one would put the thing nobody can act on at the top.
  return out.sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1
    return b.lvr - a.lvr
  })
}

export function totalsFor(rows: Row[]): Totals {
  const live = rows.filter(r => r.current)
  return {
    current: live.length,
    over80: live.filter(r => r.band === 'hot').length,
    between: live.filter(r => r.band === 'warm').length,
    stillOnBook: rows.length - live.length,
    lending: rows.reduce((t, r) => t + r.loan, 0),
  }
}

/** "Aug 26" from a date, for the small line under a figure. */
export function shortDate(v: any): string {
  const s = String(v ?? '')
  if (!/^\d{4}-\d{2}/.test(s)) return ''
  const d = new Date(`${s.slice(0, 7)}-01T00:00:00`)
  return isNaN(d.getTime()) ? ''
    : d.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })
}

/** The grey line under a figure. Short, and it never pretends to a date it has not got. */
export function sourceLine(s: Source): string {
  if (s.kind === 'lender') {
    const when = shortDate(s.on)
    return when ? `lender · ${when}` : 'lender'
  }
  if (s.kind === 'estimate') {
    const when = shortDate(s.on)
    return when ? `estimate · ${when}` : 'estimate'
  }
  if (s.kind === 'settlement') return 'book · at settlement'
  return 'book · at settlement'
}
