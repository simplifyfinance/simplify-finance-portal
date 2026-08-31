// Which settled loans are still inside their lender's clawback window.
//
// Kept out of the component so the money can be tested. The component's only job
// is to fetch the four lists and draw the result.
//
// The rows come from the commission statements, not the deals table. The screen
// used to read `deals` filtered on settled_at - the portal's own pipeline - and
// not one deal in it has ever been ticked as settled, so it was blank while the
// statements held 766 upfronts with real settlement dates. The settled book is
// in the statements.
//
// Because it reads the statements, the figure at risk is the upfront that was
// actually paid. The rate library is only asked how long each window is.

import { addMonthsToDate } from './commission'

export type UpfrontLine = {
  loan_ref: string | null
  client_name: string | null
  broker_key: string | null
  lender_id: string | null
  lender_raw: string | null
  settlement_date: string | null
  settlement_amount: number | null
  gross_ex_gst: number | null
}

export type ClawbackRow = {
  id: string; client: string; broker_key: string; lender: string; loanRef: string
  settled_on: string; ends_on: string; days_left: number
  amount: number | null; upfront: number
}

export type ClawbackUnknown = { client: string; lender: string; reason: string }

const DAY = 86400000
export function daysBetween(a: string, b: string): number {
  const x = Date.parse(a + 'T00:00:00Z'), y = Date.parse(b + 'T00:00:00Z')
  if (isNaN(x) || isNaN(y)) return 0
  return Math.round((y - x) / DAY)
}

export function buildClawback(input: {
  upfronts: UpfrontLine[]
  clawedBackRefs: (string | null)[]
  monthsByLender: Map<string, number>
  nameByLender: Map<string, string>
  today: string
}): { rows: ClawbackRow[]; unknown: ClawbackUnknown[] } {
  const { upfronts, monthsByLender, nameByLender, today } = input
  const clawedBack = new Set(input.clawedBackRefs.map(r => String(r || '').trim()).filter(Boolean))

  type Acc = {
    loanRef: string; client: string; broker_key: string; lenderId: string | null
    lenderRaw: string; settled: string; amount: number | null; upfront: number
  }
  const byLoan = new Map<string, Acc>()
  const noDate: Acc[] = []

  for (const x of upfronts) {
    const loanRef = String(x.loan_ref || '').trim()
    if (!loanRef) continue
    if (clawedBack.has(loanRef)) continue          // already taken back, not at risk of it again

    const settled = String(x.settlement_date || '').slice(0, 10)
    const acc: Acc = {
      loanRef,
      client: x.client_name || 'Client not named',
      broker_key: String(x.broker_key || ''),
      lenderId: x.lender_id ? String(x.lender_id) : null,
      lenderRaw: x.lender_raw || '',
      settled,
      amount: x.settlement_amount === null || x.settlement_amount === undefined
        ? null : Number(x.settlement_amount),
      upfront: Number(x.gross_ex_gst || 0),
    }
    if (!settled) { noDate.push(acc); continue }   // cannot be placed in a window

    // One loan, not one line. A loan can be paid across more than one line - a
    // split, or an increase - and the exposure is the sum of them.
    const prev = byLoan.get(loanRef)
    if (!prev) { byLoan.set(loanRef, acc); continue }
    prev.upfront += acc.upfront
    // The earliest settlement is the one the window runs from.
    if (acc.settled < prev.settled) { prev.settled = acc.settled; prev.amount = acc.amount }
  }

  const rows: ClawbackRow[] = []
  const unknown: ClawbackUnknown[] = []

  for (const a of byLoan.values()) {
    const lender = (a.lenderId && nameByLender.get(a.lenderId)) || a.lenderRaw || '—'

    // No lender on the line means the window cannot be looked up at all. That is
    // unknown, not safe, and it says so rather than quietly vanishing.
    if (!a.lenderId) {
      unknown.push({ client: a.client, lender,
        reason: 'The lender on the statement is not in the rate register, so its clawback period is unknown.' })
      continue
    }
    // A lender with no clawback period recorded genuinely has nothing to watch.
    const months = monthsByLender.get(a.lenderId)
    if (!months) continue

    const ends_on = addMonthsToDate(a.settled, months)
    if (!ends_on || today > ends_on) continue      // window already closed

    rows.push({
      id: a.loanRef, client: a.client, broker_key: a.broker_key, lender, loanRef: a.loanRef,
      settled_on: a.settled, ends_on, days_left: daysBetween(today, ends_on),
      amount: a.amount, upfront: a.upfront,
    })
  }

  for (const a of noDate) {
    unknown.push({
      client: a.client,
      lender: (a.lenderId && nameByLender.get(a.lenderId)) || a.lenderRaw || '—',
      reason: 'The statement carried no settlement date, so the window cannot be placed.',
    })
  }

  rows.sort((a, b) => a.days_left - b.days_left)
  return { rows, unknown }
}
