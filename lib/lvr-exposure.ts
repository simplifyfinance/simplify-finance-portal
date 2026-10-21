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
}

export type Totals = {
  properties: number
  over80: number
  between: number
  onLenderFigure: number
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
    })
  }
  return out.sort((a, b) => b.lvr - a.lvr)
}

export function totalsFor(rows: Row[]): Totals {
  return {
    properties: rows.length,
    over80: rows.filter(r => r.band === 'hot').length,
    between: rows.filter(r => r.band === 'warm').length,
    onLenderFigure: rows.filter(r => r.loanFrom.kind === 'lender').length,
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
  return 'book figure'
}
