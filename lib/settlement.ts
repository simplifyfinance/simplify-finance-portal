// One place for every settlement rule, so a threshold is changed here and nowhere
// else. The board, the needs-attention screen and any later reporting all read
// these - a rule that lives in two files is a rule that will disagree with itself.

export const ATTENTION = {
  staleBusinessDays: 10,   // no update in this many business days
  closeBusinessDays: 5,    // within this many business days of settling
  fundsToCompleteDays: 5,  // purchases: check funds with the solicitor this far out
}

export type SettlementState = 'confirmed' | 'awaiting' | 'at_risk' | 'pushed'

export const STATE_LABEL: Record<SettlementState, string> = {
  confirmed: 'Ready to settle',
  awaiting: 'Awaiting loan details',
  at_risk: 'At risk',
  pushed: 'Pushed to a later month',
}

export type SettlementStep = 'contracts_returned' | 'settlement_booked'

// Same field, different word depending on what the deal is. On a purchase these
// are contracts of sale; on a refinance they are the loan documents.
export function stepLabel(step: SettlementStep, transactionType?: string | null): string {
  if (step === 'settlement_booked') return 'Settlement booked'
  return transactionType === 'refinance' ? 'Loan docs returned' : 'Contracts returned'
}

export function isRefinance(d: any): boolean {
  return d?.transaction_type === 'refinance' || d?.transaction_type === 'equity_release'
}
export function isPurchase(d: any): boolean {
  return d?.transaction_type === 'purchase' || d?.transaction_type === 'construction'
}

// The date the board organises by. A confirmed date always wins over a tentative one.
export function settlementDate(d: any): string | null {
  return d?.confirmed_settlement_date || d?.expected_settlement_date || null
}

// A short label for what the deal is - "INV Refi", "OO Purchase" - built from the
// two fields rather than typed by anyone.
const USE_SHORT: Record<string, string> = { owner_occupied: 'OO', investment: 'INV', smsf: 'SMSF' }
const TXN_SHORT: Record<string, string> = {
  purchase: 'Purchase', refinance: 'Refi', equity_release: 'Equity release', construction: 'Construction',
}
export function purposeLabel(d: any): string {
  const parts = [USE_SHORT[d?.property_use || ''], TXN_SHORT[d?.transaction_type || '']].filter(Boolean)
  return parts.length ? parts.join(' ') : (d?.deal_type || '—')
}

export function businessDaysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + 'T00:00:00Z'), b = new Date(toIso + 'T00:00:00Z')
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0
  const back = b < a
  let [s, e] = back ? [b, a] : [a, b]
  let n = 0
  const cur = new Date(s)
  while (cur < e) {
    cur.setUTCDate(cur.getUTCDate() + 1)
    const day = cur.getUTCDay()
    if (day !== 0 && day !== 6) n += 1
  }
  return back ? -n : n
}

export type Attention = { level: 'stale' | 'close' | 'funds'; why: string }

// Why a deal needs attention, or null. Business days, matching how deal ageing
// already works, so a long weekend does not make everything look neglected.
export function attentionFor(d: any, today: string): Attention | null {
  if (d?.settled_at) return null
  const date = settlementDate(d)

  if (date && isPurchase(d) && !d.funds_to_complete_checked) {
    const out = businessDaysBetween(today, date)
    if (out >= 0 && out <= ATTENTION.fundsToCompleteDays) {
      return { level: 'funds', why: `Funds to complete not checked, settling in ${out} business day${out === 1 ? '' : 's'}` }
    }
  }
  if (date) {
    const out = businessDaysBetween(today, date)
    if (out >= 0 && out <= ATTENTION.closeBusinessDays) {
      return { level: 'close', why: out === 0 ? 'Settling today' : `Settling in ${out} business day${out === 1 ? '' : 's'}` }
    }
  }
  const last = (d?.settlement_updated_at || '').slice(0, 10)
  if (last) {
    const since = businessDaysBetween(last, today)
    if (since >= ATTENTION.staleBusinessDays) {
      return { level: 'stale', why: `No update in ${since} business days` }
    }
  } else if (date) {
    return { level: 'stale', why: 'Never updated by the settlement team' }
  }
  return null
}

export function monthOf(dateIso: string | null): string {
  return dateIso ? dateIso.slice(0, 7) : ''
}
export function addMonths(month: string, n: number): string {
  let y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7)) + n
  while (m > 12) { m -= 12; y += 1 }
  while (m < 1) { m += 12; y -= 1 }
  return `${y}-${String(m).padStart(2, '0')}`
}
export function monthLabel(month: string): string {
  const NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
}
