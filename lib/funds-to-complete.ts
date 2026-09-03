// WHAT THE CLIENT ACTUALLY HAS TO FIND.
//
// The portal collected a purchase price, a deposit, stamp duty, LMI, the first
// home owner grant, sale proceeds and lender fees - and never added any of them
// up. LMI and the grant were display-only: typed into a box, shown once in an
// email, never part of a total anywhere.
//
// Fabio, 3 Sep 2026: "I think a funds to complete section is needed as it is not
// really understanding the numbers from LO and BC."
//
// THE RULE THIS FILE LIVES BY: a figure is either calculated from numbers we
// hold, or it is absent. There is no estimating, no "typically 5%", no filling a
// gap with a plausible number. Every line says where it came from, and anything
// missing is named as missing so a person can go and get it. A total built on a
// guess is worse than no total, because it looks like an answer.

export type FundsLine = {
  label: string
  amount: number
  // Money the client needs (a cost) or money that reduces it (a source).
  kind: 'cost' | 'source'
  from: string
}

export type FundsToComplete = {
  lines: FundsLine[]
  costs: number
  sources: number
  // Costs less sources. Positive is what they must contribute; negative means
  // there is money left over.
  shortfall: number
  // Named, so the notes can say "stamp duty has not been recorded" rather than
  // quietly pretending it is zero.
  missing: string[]
  // False when nothing meaningful was recorded. Nothing should be shown at all.
  usable: boolean
}

// Money is stored as comma-formatted strings all over this codebase, and
// Number("5,250,000") is NaN. Learned the hard way; see lib/money.ts.
function num(v: any): number {
  const n = Number(String(v ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const has = (v: any) => num(v) > 0

export function fundsToComplete(deal: any): FundsToComplete {
  const bc = deal?.bc_data || {}
  const lo = deal?.lo_data || {}
  const lines: FundsLine[] = []
  const missing: string[] = []

  const isPurchase = has(bc.purchasePrice) || has(bc.newPurchasePrice)
  const price = has(bc.purchasePrice) ? num(bc.purchasePrice) : num(bc.newPurchasePrice)

  // --- what it costs --------------------------------------------------------
  if (isPurchase) {
    lines.push({ label: 'Purchase price', amount: price, kind: 'cost', from: 'BC' })

    if (has(bc.stampDuty)) {
      lines.push({ label: 'Stamp duty', amount: num(bc.stampDuty), kind: 'cost', from: 'BC' })
    } else {
      // NOT assumed to be zero, and never estimated. On a purchase this is tens
      // of thousands of dollars and its absence changes the answer completely.
      missing.push('Stamp duty has not been recorded')
    }
  }

  if (has(bc.lmi)) {
    lines.push({ label: 'Lenders mortgage insurance', amount: num(bc.lmi), kind: 'cost', from: 'BC' })
  } else if (String(bc.lmiApplicable ?? '').toLowerCase().startsWith('y')) {
    // Marked as applying, but no figure typed. Saying so is the whole point.
    missing.push('LMI applies but no amount has been recorded')
  }

  // Lender fees, from the recommended product rather than typed again.
  const rec = (lo?.lenders || []).find((l: any) => l?.lenderName && l.lenderName === lo?.recommendedLender)
    || (lo?.lenders || [])[0]
  if (rec) {
    for (const [field, label] of [
      ['applicationFee', 'Application fee'],
      ['valuationFee', 'Valuation fee'],
      ['legalFee', rec.legalFeeLabel || 'Settlement fee'],
      ['rateLockFee', 'Rate lock fee'],
    ] as const) {
      if (has((rec as any)[field])) {
        lines.push({ label: String(label), amount: num((rec as any)[field]), kind: 'cost', from: 'the recommended product' })
      }
    }
  }

  // Debt being paid out is a cost whether or not there is also a purchase.
  // This used to be skipped on any deal with a purchase price, so an equity
  // release that also refinances $520,000 showed a six-figure "surplus" that
  // did not exist - the new lending was counted as money in, and the debt it
  // repaid was counted as nothing at all.
  const payout = refinancedDebt(deal)
  if (payout > 0) {
    lines.push({ label: 'Existing debt being refinanced', amount: payout, kind: 'cost', from: payoutFrom(deal) })
  }

  // --- where the money comes from ------------------------------------------
  if (has(bc.deposit)) {
    lines.push({
      label: bc.depositSource ? `Deposit — ${bc.depositSource}` : 'Deposit',
      amount: num(bc.deposit), kind: 'source', from: 'BC',
    })
  } else if (isPurchase) {
    missing.push('No deposit has been recorded')
  }

  if (has(bc.fhog)) lines.push({ label: 'First home owner grant', amount: num(bc.fhog), kind: 'source', from: 'BC' })
  if (has(bc.additionalSavings)) lines.push({ label: 'Additional savings', amount: num(bc.additionalSavings), kind: 'source', from: 'BC' })
  if (has(bc.netProceeds)) lines.push({ label: 'Net proceeds of sale', amount: num(bc.netProceeds), kind: 'source', from: 'BC' })

  // bc.equityRelease is deliberately NOT a source. Released equity is part of
  // the new lending - it is already inside the loan amount below, and counting
  // it again would inflate the money available by the size of the release. It is
  // the same dollars wearing two names.

  const loan = loanAmount(deal)
  if (loan > 0) lines.push({ label: 'Loan amount', amount: loan, kind: 'source', from: lo?.lenders?.length ? 'LO' : 'BC splits' })
  else missing.push('No loan amount has been recorded')

  const costs = lines.filter(l => l.kind === 'cost').reduce((s, l) => s + l.amount, 0)
  const sources = lines.filter(l => l.kind === 'source').reduce((s, l) => s + l.amount, 0)

  return {
    lines, costs, sources,
    shortfall: Math.round(costs - sources),
    missing,
    // One cost and one source at the very least, or there is nothing to say.
    usable: lines.some(l => l.kind === 'cost') && lines.some(l => l.kind === 'source'),
  }
}

// What is being paid out. The BC's own figure when somebody typed one,
// otherwise the balances of the property loans marked to be refinanced.
export function refinancedDebt(deal: any): number {
  const bc = deal?.bc_data || {}
  if (has(bc.existingLoanBal)) return num(bc.existingLoanBal)
  let total = 0
  for (const p of deal?.fact_find_data?.properties || []) {
    for (const l of p?.loans || []) {
      if (String(l?.status ?? '').trim() === 'To be refinanced') total += num(l?.balance)
    }
  }
  return total
}

function payoutFrom(deal: any): string {
  return has(deal?.bc_data?.existingLoanBal) ? 'BC' : 'the fact find, loans marked to be refinanced'
}

// The LO's figure when there is one, otherwise the BC's splits added up.
export function loanAmount(deal: any): number {
  const lo = deal?.lo_data || {}
  if (has(lo.loanAmount)) return num(lo.loanAmount)
  const splits = deal?.bc_data?.splits || []
  return splits.reduce((s: number, x: any) => s + num(x?.amount), 0)
}

// Loan against the security's value. Absent rather than wrong whenever it
// cannot be worked out honestly - an LVR is a number people act on.
export function lvrOf(deal: any): number | null {
  return securityValue(deal).lvr
}

export type SecurityValue = { total: number; count: number; lvr: number | null; why?: string }

// EVERY security, not just the one being bought. A deal that refinances a
// $620,000 investment property AND buys an $850,000 home has $1.47m of security
// behind $1.35m of lending - measured against the purchase alone it reads 158%,
// which is worse than saying nothing. Written the naive way first; the number it
// produced is what caught it.
export function securityValue(deal: any): SecurityValue {
  const bc = deal?.bc_data || {}
  const values: number[] = []

  const buying = has(bc.purchasePrice) ? num(bc.purchasePrice)
    : has(bc.newPurchasePrice) ? num(bc.newPurchasePrice) : 0
  if (buying > 0) values.push(buying)

  // A property already held is only security if its loan is part of this deal.
  for (const p of deal?.fact_find_data?.properties || []) {
    const involved = (p?.loans || []).some((l: any) =>
      ['To be refinanced', 'To be consolidated'].includes(String(l?.status ?? '').trim()))
    if (involved && has(p?.value)) values.push(num(p.value))
  }

  // The BC's own security value, for a refinance with no fact-find property.
  if (values.length === 0 && has(bc.propertyValue)) values.push(num(bc.propertyValue))

  const total = values.reduce((s, v) => s + v, 0)
  const loan = loanAmount(deal)

  if (total <= 0 || loan <= 0) {
    return { total, count: values.length, lvr: null,
      why: 'either the lending or the security value is not recorded' }
  }
  return { total, count: values.length, lvr: Math.round((loan / total) * 1000) / 10 }
}
