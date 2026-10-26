// ONE SECURITY CAN HAVE TWO LOANS ON IT.
//
// 26 Oct 2026. Fabio, looking at a client in the book: "see how the portal
// doesnt not think logically 2 loans against same secuitry and it is not
// caluclating overall LVR".
//
// He was looking at this, and it is as bad as it sounds:
//
//   25 Getting Crescent Campbell ACT 2612   NAB         $366,000    $1,600,000
//   25 Getting Cres, CAMPBELL ACT 2612      NAB Broker  $663,744    $1,700,000
//
// One house. Two loans. The export writes a row per LOAN, so the portal read
// it as two houses: it counted the value twice, worked the usable equity out
// twice, and told us there was $914,000 + $696,256 sitting in a property that
// actually has 80% of one value, less BOTH loans, in it.
//
// On that client it overstated the usable equity by about a million dollars,
// and the whole point of the book is to put that figure in an email to them.
//
// THE RULE, AND IT IS THE ONLY ONE HERE:
//   a security's equity is 80% of its value, less everything owed against it.
//
// NOTHING IS MERGED THAT IS NOT THE SAME ADDRESS. Matching is on the address
// written down, normalised for the things the export is inconsistent about -
// case, commas, and whether somebody typed Crescent or Cres. A unit number is
// part of the address and is never dropped: Unit 113, 26 Oliver St is not
// 26 Oliver St, and merging those two would be the same fault in the other
// direction.

const txt = (v: any) => String(v ?? '').trim()

export function readMoney(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

// What the export cannot keep straight. Long form in, short form out, so the
// two spellings of one street land on the same key.
const SHORTER: Record<string, string> = {
  street: 'st', road: 'rd', avenue: 'ave', av: 'ave', crescent: 'cres',
  drive: 'dr', court: 'ct', place: 'pl', parade: 'pde', terrace: 'tce',
  close: 'cl', highway: 'hwy', boulevard: 'blvd', boulevarde: 'blvd',
  lane: 'ln', circuit: 'cct', grove: 'gr', square: 'sq', esplanade: 'esp',
  unit: 'u', apartment: 'u', apt: 'u',
}

/**
 * The address, reduced to the parts that decide whether two rows are one
 * property. Case, punctuation and street-type spelling go; everything that
 * identifies the place - the number, the unit, the street, the suburb, the
 * postcode - stays.
 */
export function normaliseAddress(v: any): string {
  return txt(v)
    .toLowerCase()
    .replace(/[.,/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => SHORTER[w] || w)
    .join(' ')
}

export function sameSecurity(a: any, b: any): boolean {
  const x = normaliseAddress(a)
  return !!x && x === normaliseAddress(b)
}

export type LoanOnIt = {
  id: string
  lender: string
  balance: number | null
  asAt: string | null
}

export type Security = {
  /** The normalised address - what the grouping was done on. */
  key: string
  /** The longest spelling found, because it is usually the complete one. */
  address: string
  investor: boolean
  /** Every row that turned out to be this property. */
  rows: any[]
  loans: LoanOnIt[]
  /** What is owed against it, all loans together. Null where none is recorded. */
  owing: number | null
  value: number | null
  /** Set when the rows disagree about the value, so the screen can say so. */
  values: number[]
  lvr: number | null
  /** 80% of the value less everything owed. Null for a home, or unknowable. */
  usable: number | null
}

const valueOf = (p: any) => readMoney(p?.estimated_current_value ?? p?.original_value)
const owingOf = (p: any) => readMoney(p?.current_balance ?? p?.original_loan)

/**
 * TWO ROWS, TWO VALUES, ONE HOUSE. Which is right?
 *
 * The one somebody looked up most recently, where a date was recorded. Where
 * neither was dated the LOWER is used, deliberately: this figure goes into an
 * email telling somebody what they can borrow, and the cost of being wrong in
 * the generous direction is a conversation nobody wants to have twice. The
 * screen shows both so it can be corrected in a second.
 */
export function valueFor(rows: any[]): { value: number | null; values: number[] } {
  const values = rows.map(valueOf).filter((v): v is number => v !== null)
  if (!values.length) return { value: null, values: [] }
  const dated = rows
    .filter(r => txt(r?.valuation_date) && valueOf(r) !== null)
    .sort((a, b) => txt(b.valuation_date).localeCompare(txt(a.valuation_date)))
  const unique = [...new Set(values)].sort((a, b) => a - b)
  return { value: dated.length ? valueOf(dated[0]) : unique[0], values: unique }
}

export function securitiesOf(props: any[], lvr = 0.8): Security[] {
  const by = new Map<string, any[]>()
  for (const p of props || []) {
    const key = normaliseAddress(p?.address)
    // A row with no address cannot be grouped and cannot be matched against
    // anything. It keeps its own id so it is still on the screen.
    //
    // AND A HOME IS NEVER FOLDED IN WITH AN INVESTMENT. Where two rows share
    // an address but disagree about what the property is, the book is telling
    // us something we cannot resolve by guessing - so they stay apart and the
    // home stays uncounted, which is the safe direction. Two loans that agree
    // it is an investment are one security, which is the case this is for.
    const k = key ? `${key}|${p?.investor === false ? 'home' : 'inv'}` : `row:${txt(p?.id)}`
    by.set(k, [...(by.get(k) || []), p])
  }

  const out: Security[] = []
  for (const [key, rows] of by) {
    const ordered = [...rows].sort((a, b) => (a?.ordinal || 0) - (b?.ordinal || 0))
    // AN OWNER OCCUPIED LOAN MAKES THE WHOLE SECURITY A HOME. If any row on
    // this property says it is where they live, it is where they live, and
    // nothing on it is counted as releasable equity.
    const investor = ordered.every(r => r?.investor !== false)
    const { value, values } = valueFor(ordered)
    const loans: LoanOnIt[] = ordered.map(r => ({
      id: txt(r?.id),
      lender: txt(r?.lender_raw),
      balance: owingOf(r),
      asAt: txt(r?.balance_as_at) || null,
    }))
    const known = loans.map(l => l.balance).filter((b): b is number => b !== null)
    // A LOAN NOBODY RECORDED IS NOT A LOAN OF ZERO. If no row on the property
    // has a balance, what is owed is unknown - and 80% of the value would read
    // as money they can have.
    const owing = known.length ? known.reduce((t, b) => t + b, 0) : null
    // A FIGURE SOMEBODY RECORDED IS A DECISION, AND ONLY ON ITS OWN.
    //
    // usable_equity is kept per row, and on a property with one loan it is
    // whatever a person worked out and wrote down - nothing recalculates over
    // that. On a property with TWO rows those stored figures are per loan:
    // each one reads 80% of the whole value less its own loan, which is the
    // double count this file exists to undo. So they are used where there is
    // one row and ignored where there are several.
    const stored = ordered.length === 1 ? readMoney(ordered[0]?.usable_equity) : null

    // ROUNDED ONCE, AT THE END. Rounding the 80% and then subtracting a
    // balance with cents in it leaves cents in the answer, and a figure in a
    // client email reading $250,255.93 was arrived at by a machine, not by
    // somebody who thought about it.
    // A NEGATIVE IS A REAL ANSWER AND IS NOT HIDDEN.
    //
    // Owing more than 80% of the value means that property is dragging the
    // portfolio down, and a total that clamped each property at zero would
    // report equity the client does not have. The list has shown the negative
    // since the day it was built - see the test of the same name in
    // lib/the-review-row-says-what-it-is-worth.ts.
    const usable = !investor ? null
      : stored !== null ? stored
      : value === null || owing === null ? null
      : Math.round(value * lvr - owing)
    out.push({
      key: key.split('|')[0],
      address: ordered.map(r => txt(r?.address)).sort((a, b) => b.length - a.length)[0] || '',
      investor, rows: ordered, loans, owing, value, values,
      lvr: value !== null && value > 0 && owing !== null
        ? Math.round((owing / value) * 1000) / 10 : null,
      usable,
    })
  }
  return out.sort((a, b) => (a.rows[0]?.ordinal || 0) - (b.rows[0]?.ordinal || 0))
}

/**
 * THE WHOLE PORTFOLIO, ONCE EACH.
 *
 * The overall LVR is everything owed over everything it is secured by - the
 * figure Fabio asked for and the portal was not working out at all. The home
 * is in the LVR because the bank counts it; it is not in the usable equity
 * because its equity is not something we would release.
 */
export function bookTotals(securities: Security[]) {
  let owing = 0, value = 0, usable = 0
  let owingKnown = false, valueKnown = false
  for (const s of securities) {
    if (s.owing !== null) { owing += s.owing; owingKnown = true }
    if (s.value !== null) { value += s.value; valueKnown = true }
    if (s.usable !== null) usable += s.usable
  }
  return {
    owing: owingKnown ? owing : null,
    value: valueKnown ? value : null,
    usable,
    lvr: owingKnown && valueKnown && value > 0
      ? Math.round((owing / value) * 1000) / 10 : null,
    /** How many rows were folded into fewer securities. 0 when none were. */
    merged: securities.reduce((n, s) => n + Math.max(0, s.rows.length - 1), 0),
  }
}
