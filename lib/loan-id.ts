// The Loan ID: the number the bank issues, that appears on the RCTI, and that
// proves a deal was actually paid.
//
// It is NOT captured at lodgement. Fabio, 1 Sep 2026: "once contracts are issued
// and loan settles our team contacts the bank and manually input the Loan ID.
// That figure will then match on RCTI to confirm deal has been paid."
//
// One per split, because each split is its own loan account with its own number
// and its own line on the statement. A deal with no splits recorded is one loan,
// so it gets one box.
//
// Where it lives: on the split it belongs to, inside deals.settled_splits. Not a
// separate list keyed by position - that drifts the first time somebody edits a
// split - and not the snapshot table, which is a record of what the amounts were
// rather than somewhere to keep working data.

const num = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null
  const x = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(x) && x !== 0 ? x : null
}

// A loan ID is whatever the bank calls it. They are not all digits - some carry
// hyphens, some letters - so nothing is validated beyond stripping the spaces
// somebody pasted in. A wrong Loan ID is worse than a missing one, and a format
// rule we invented would reject a real number.
export function cleanLoanId(v: any): string {
  return String(v ?? '').trim().replace(/\s+/g, '')
}

// Two loan IDs are the same if they are the same characters, ignoring case and
// the punctuation a statement might print differently.
export function sameLoanId(a: any, b: any): boolean {
  const norm = (v: any) => cleanLoanId(v).toUpperCase().replace(/[^A-Z0-9]/g, '')
  const x = norm(a), y = norm(b)
  return x.length > 0 && x === y
}

export type LoanIdRow = {
  index: number
  label: string          // what to call it on screen
  amount: number | null
  loanId: string
}

// One row per box to draw. A settled deal with splits gets one per split; a
// settled deal without gets a single row for the whole loan.
export function loanIdRows(deal: any): LoanIdRow[] {
  const splits = Array.isArray(deal?.settled_splits) ? deal.settled_splits : []
  const real = splits.filter((s: any) => s && (num(s.amount) !== null || String(s.label || '').trim()))
  if (real.length === 0) {
    return [{
      index: 0,
      label: 'Loan',
      amount: num(deal?.settled_total) ?? num(deal?.loan_amount),
      loanId: cleanLoanId(deal?.settled_splits?.[0]?.loanId),
    }]
  }
  return real.map((s: any, i: number) => ({
    index: i,
    label: String(s.label || '').trim() || `Split ${i + 1}`,
    amount: num(s.amount),
    loanId: cleanLoanId(s.loanId),
  }))
}

// What to write back to deals.settled_splits. Where a deal had no splits, the
// one loan becomes a single entry carrying the settled total - which is true,
// and keeps every Loan ID beside the amount it was issued against.
export function applyLoanIds(deal: any, values: string[]): any[] {
  const splits = Array.isArray(deal?.settled_splits) ? deal.settled_splits : []
  const real = splits.filter((s: any) => s && (num(s.amount) !== null || String(s.label || '').trim()))
  if (real.length === 0) {
    const one = { ...(splits[0] || {}) }
    one.amount = one.amount ?? (num(deal?.settled_total) ?? num(deal?.loan_amount) ?? null)
    one.loanId = cleanLoanId(values[0])
    return [one]
  }
  let n = -1
  return splits.map((s: any) => {
    if (!s || !(num(s.amount) !== null || String(s.label || '').trim())) return s
    n += 1
    return { ...s, loanId: cleanLoanId(values[n]) }
  })
}

// How long after settlement the portal stays quiet about a missing Loan ID.
//
// Fabio: "Payment only occurs 30 days after settlement on average so we have
// time for the input to be made by the time RCTI comes." Flagging on day three
// would be noise, and a warning people see every day is a warning they stop
// seeing. It goes amber only when the statement is close.
export const QUIET_DAYS = 25

export type LoanIdTone = 'not_settled' | 'complete' | 'quiet' | 'amber'

export type LoanIdStatus = {
  tone: LoanIdTone
  rows: LoanIdRow[]
  missing: number
  total: number
  days: number | null    // calendar days since settlement
  label: string
}

function daysSince(iso: any, now: Date): number | null {
  if (!iso) return null
  const t = new Date(iso)
  if (isNaN(t.getTime())) return null
  const a = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.max(0, Math.round((b - a) / 86400000))
}

export function loanIdStatus(deal: any, now: Date = new Date()): LoanIdStatus {
  const rows = loanIdRows(deal)
  const missing = rows.filter(r => !r.loanId).length
  const days = daysSince(deal?.settled_at, now)

  if (!deal?.settled_at) {
    // Nothing to ask for. The bank has not issued anything yet.
    return { tone: 'not_settled', rows, missing, total: rows.length, days, label: '' }
  }
  if (missing === 0) {
    return { tone: 'complete', rows, missing, total: rows.length, days, label: 'Loan ID recorded' }
  }
  const part = rows.length > 1 ? `${missing} of ${rows.length} Loan IDs` : 'Loan ID'
  const tone: LoanIdTone = (days ?? 0) >= QUIET_DAYS ? 'amber' : 'quiet'
  return {
    tone,
    rows,
    missing,
    total: rows.length,
    days,
    label: tone === 'amber' ? `${part} needed - RCTI is due` : `${part} needed`,
  }
}
