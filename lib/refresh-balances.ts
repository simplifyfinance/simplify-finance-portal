// THE LIST STOPS LYING ABOUT WHAT PEOPLE OWE.
//
// 21 Oct 2026. Fabio, in plain English: the list says what a client owed when
// the spreadsheet was made. That can be years old, and a loan is paid down
// every month. So the equity figure is wrong, usually too low - you look at a
// client, see nothing there, and move on, when they have paid off another
// $80,000 and there is money in it.
//
// THE NUMBERS ON THE DAY THIS WAS WRITTEN. 760 investment properties on the
// list. Not one carried a current balance: every single figure was the
// spreadsheet's original_loan, which the schema calls history and never
// changes. 423 carry a loan reference, 241 of which meet a trail line.
//
// WHY THE REFERENCE AND NOT THE NAME. Matching on the client's name found 165
// reviews, 73 of which were names carrying more than one loan - so a coin toss
// on which balance belongs to which property. The loan reference is exact. A
// wrong balance on a client's email is worse than no balance, so this only
// ever fills in where a reference meets a reference, and leaves the rest alone.
//
// NOTHING HERE TOUCHES A DATABASE. Given the properties and the trail lines it
// says what would change; components/PortfolioReview.tsx shows that to a person
// and writes only what they agree to.

/** A property on the list, as much of it as this needs. */
export type Holding = {
  id: string
  review_id: string
  loan_ref: string | null
  original_loan: number | null
  current_balance: number | null
  balance_as_at: string | null
  investor: boolean
}

/** One month's trail line for one loan. */
export type TrailLine = {
  loan_ref: string | null
  balance: number | null
  period_month: string | null
  lender_raw?: string | null
}

export type Change = {
  id: string
  reviewId: string
  ref: string
  was: number | null
  now: number
  asAt: string
  lender: string
  /** Which way it moved, for the filters on the preview. */
  way: 'down' | 'up' | 'flat'
}

export type Plan = {
  fill: Change[]
  /** Has a reference, but no trail line carries it. The loan has left the book. */
  noMatch: number
  /** Came through the import with the reference column empty. */
  noRef: number
  /** Already carries a figure at least as new as the newest statement. */
  alreadyCurrent: number
  /** The newest statement month anywhere in the trail lines. */
  newest: string
  reviews: number
}

// A REFERENCE IS THE SAME REFERENCE IN ANY PUNCTUATION.
//
// The book's export and the aggregator's statement both write a loan number,
// and neither was typed with the other in mind: spaces, hyphens and case are
// decoration. Everything that is not a letter or a digit comes out, and what
// is left is compared in upper case.
export function normaliseRef(v: any): string {
  return String(v ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase()
}

const n = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null
  const x = Number(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(x) ? x : null
}

/** "2026-08-01" or "2026-08-01T00:00:00Z" both come back as "2026-08". */
export function monthOf(v: any): string {
  const s = String(v ?? '')
  return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : ''
}

/**
 * THE NEWEST LINE FOR EACH LOAN, AND ONLY THE NEWEST.
 *
 * A trail statement arrives every month, so one loan has one line per month it
 * has been paying. The balance on the oldest of them is as wrong as the
 * spreadsheet. Only the latest month is worth anything.
 */
export function newestByRef(lines: TrailLine[]): Map<string, { balance: number; month: string; lender: string }> {
  const out = new Map<string, { balance: number; month: string; lender: string }>()
  for (const l of lines || []) {
    const ref = normaliseRef(l?.loan_ref)
    const bal = n(l?.balance)
    const month = monthOf(l?.period_month)
    // A balance of zero is a loan that has been paid out, not a balance. It is
    // left out rather than written over a real figure with nothing.
    if (!ref || bal === null || bal <= 0 || !month) continue
    const had = out.get(ref)
    if (!had || month > had.month) {
      out.set(ref, { balance: bal, month, lender: String(l?.lender_raw ?? '').trim() })
    }
  }
  return out
}

/**
 * WHAT WOULD CHANGE, AND WHAT WOULD NOT.
 *
 * Owner occupied properties are skipped for the same reason they are not
 * counted anywhere else on this list: the equity conversation is about the
 * investments, and the home is shown for context only.
 */
export function planFor(holdings: Holding[], lines: TrailLine[]): Plan {
  const newestFor = newestByRef(lines)
  let newest = ''
  for (const v of newestFor.values()) if (v.month > newest) newest = v.month

  const fill: Change[] = []
  const reviews = new Set<string>()
  let noMatch = 0, noRef = 0, alreadyCurrent = 0

  for (const h of holdings || []) {
    if (!h?.investor) continue
    const ref = normaliseRef(h.loan_ref)
    if (!ref) { noRef++; continue }
    const found = newestFor.get(ref)
    if (!found) { noMatch++; continue }

    // PRESSING IT TWICE CHANGES NOTHING. A property already carrying a figure
    // from this month or later is left exactly as it is, so this is safe to run
    // after every statement import and does not churn rows that are already
    // right.
    const have = monthOf(h.balance_as_at)
    if (have && have >= found.month) { alreadyCurrent++; continue }

    const was = h.current_balance ?? h.original_loan
    // Nothing to say where the figure we hold is already the lender's figure.
    if (was !== null && Math.round(was) === Math.round(found.balance) && have) { alreadyCurrent++; continue }

    const diff = was === null ? 0 : found.balance - was
    fill.push({
      id: h.id,
      reviewId: h.review_id,
      ref,
      was,
      now: found.balance,
      asAt: found.month,
      lender: found.lender,
      // A thousand dollars either way on a mortgage is a month of principal,
      // not news. It is called flat so the preview can put it out of the way.
      way: Math.abs(diff) < 1000 ? 'flat' : diff < 0 ? 'down' : 'up',
    })
    reviews.add(h.review_id)
  }

  // Biggest movement first: the ones worth looking at before agreeing.
  fill.sort((a, b) => Math.abs((b.now - (b.was ?? b.now))) - Math.abs((a.now - (a.was ?? a.now))))

  return { fill, noMatch, noRef, alreadyCurrent, newest, reviews: reviews.size }
}

/** What goes to the database, and nothing else. original_loan is not in it. */
export function writeFor(c: Change): {
  id: string; current_balance: number; balance_as_at: string; lender_raw?: string
} {
  const row: any = {
    id: c.id,
    current_balance: c.now,
    // The statement month, as the first of that month - which is how
    // commission_lines holds it and what makes "as at" an honest sentence.
    balance_as_at: `${c.asAt}-01`,
  }
  // Only where the statement actually named one. A blank would wipe a lender
  // somebody recorded by hand.
  if (c.lender) row.lender_raw = c.lender
  return row
}

/** "August 2026", for a sentence rather than a column. */
export function monthName(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return ''
  const d = new Date(`${month}-01T00:00:00`)
  return isNaN(d.getTime()) ? ''
    : d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

/** "Aug 26", for the small line under a figure on the list. */
export function asAtShort(v: any): string {
  const m = monthOf(v)
  if (!m) return ''
  const d = new Date(`${m}-01T00:00:00`)
  return isNaN(d.getTime()) ? ''
    : d.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })
}
