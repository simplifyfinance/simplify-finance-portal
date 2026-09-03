// WHAT THE CLIENT HAS TO FIND.
//
// Deliberately, aggressively simple. Fabio, 3 Sep 2026: "it is VERY simple
// Purchase Price, Stamp Duty, and deposit as we have the loan value correct? no
// legal fees etc AND no funds to complete if a refinance - remember construction
// will have funds to complete."
//
// The first version of this added lender fees, LMI, the first home owner grant,
// sale proceeds and the debt being refinanced. Every one of those was a way to
// be wrong, and two of them WERE wrong - a released-equity line double counted
// the same dollars, and a purchase-plus-refinance produced a six-figure surplus
// that did not exist. Cutting them out removed the bugs with them.
//
// Purchase:      price + stamp duty  −  deposit  −  loan
// Construction:  land + build + stamp duty  −  deposit  −  loan
// Refinance:     nothing at all. There is no completion to fund.

export type FundsLine = { label: string; amount: number; kind: 'cost' | 'source' }

export type FundsToComplete = {
  lines: FundsLine[]
  toFind: number
  // Named, so the strip can say "stamp duty has not been recorded" rather than
  // treating a blank as zero and quoting a total that is short by $45,000.
  missing: string[]
  // False on a refinance, and on anything with nothing recorded yet. Nothing is
  // drawn at all.
  applies: boolean
}

function num(v: any): number {
  // Money is stored comma-formatted all over this codebase and
  // Number("5,250,000") is NaN.
  const n = Number(String(v ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const has = (v: any) => num(v) > 0
const txt = (v: any) => String(v ?? '').trim()

export function isConstruction(deal: any): boolean {
  return txt(deal?.bc_data?.template) === 'construction'
    || has(deal?.bc_data?.constructionCost)
}

// A refinance has no funds to complete, and ANY refinance component is enough to
// switch it off. Fabio, 3 Sep 2026: "no funds to complete if a refinance".
//
// This is not tidiness. The sum is price + duty − deposit − loan, and on a deal
// that also refinances, the loan contains money that never touches the purchase:
// $1,350,000 of lending against an $850,000 purchase reported "$625,000 over",
// which is nonsense. The simple sum is only true of a simple purchase, so that
// is the only place it is shown. Anything else would need the fees, payouts and
// per-split apportionment that were deliberately cut out.
export function fundsApply(deal: any): boolean {
  const bc = deal?.bc_data || {}
  if (refinancedDebt(deal) > 0) return false
  return isConstruction(deal) || has(bc.purchasePrice) || has(bc.newPurchasePrice)
}

export function fundsToComplete(deal: any): FundsToComplete {
  const bc = deal?.bc_data || {}
  if (!fundsApply(deal)) return { lines: [], toFind: 0, missing: [], applies: false }

  const lines: FundsLine[] = []
  const missing: string[] = []

  if (isConstruction(deal)) {
    if (has(bc.landValue)) lines.push({ label: 'Land value', amount: num(bc.landValue), kind: 'cost' })
    else missing.push('Land value has not been recorded')
    if (has(bc.constructionCost)) lines.push({ label: 'Construction cost', amount: num(bc.constructionCost), kind: 'cost' })
    else missing.push('Construction cost has not been recorded')
  } else {
    const price = has(bc.purchasePrice) ? num(bc.purchasePrice) : num(bc.newPurchasePrice)
    lines.push({ label: 'Purchase price', amount: price, kind: 'cost' })
  }

  // NEVER treated as zero. On a purchase this is tens of thousands of dollars,
  // and a total that quietly leaves it out looks exactly like a correct one.
  if (has(bc.stampDuty)) lines.push({ label: 'Stamp duty', amount: num(bc.stampDuty), kind: 'cost' })
  else missing.push('Stamp duty has not been recorded')

  if (has(bc.deposit)) lines.push({ label: 'Deposit', amount: num(bc.deposit), kind: 'source' })
  else missing.push('No deposit has been recorded')

  const loan = loanAmount(deal)
  if (loan > 0) lines.push({ label: 'Loan', amount: loan, kind: 'source' })
  else missing.push('No loan amount has been recorded')

  const costs = lines.filter(l => l.kind === 'cost').reduce((s, l) => s + l.amount, 0)
  const sources = lines.filter(l => l.kind === 'source').reduce((s, l) => s + l.amount, 0)

  // Never negative. A purchase where the loan and deposit exceed the price and
  // duty needs nothing found; "minus $4,000" reads like a refund.
  return { lines, toFind: Math.max(0, Math.round(costs - sources)), missing, applies: true }
}

// The LO's figure when there is one, otherwise the BC's splits added up.
export function loanAmount(deal: any): number {
  const lo = deal?.lo_data || {}
  if (has(lo.loanAmount)) return num(lo.loanAmount)
  const splits = deal?.bc_data?.splits || []
  return splits.reduce((s: number, x: any) => s + num(x?.amount), 0)
}

export type SecurityValue = { total: number; count: number; lvr: number | null; why?: string }

// EVERY security, not just the one being bought. Written the naive way first -
// total lending against the purchase price alone - and it produced an LVR of
// 158.8% on a deal that also refinanced a $620,000 investment property. An LVR
// is a number people act on, so it is absent rather than wrong.
export function securityValue(deal: any): SecurityValue {
  const bc = deal?.bc_data || {}
  const values: number[] = []

  const buying = has(bc.purchasePrice) ? num(bc.purchasePrice)
    : has(bc.newPurchasePrice) ? num(bc.newPurchasePrice) : 0
  if (buying > 0) values.push(buying)

  for (const p of deal?.fact_find_data?.properties || []) {
    const involved = (p?.loans || []).some((l: any) =>
      ['To be refinanced', 'To be consolidated'].includes(txt(l?.status)))
    if (involved && has(p?.value)) values.push(num(p.value))
  }

  if (values.length === 0 && has(bc.propertyValue)) values.push(num(bc.propertyValue))

  const total = values.reduce((s, v) => s + v, 0)
  const loan = loanAmount(deal)
  if (total <= 0 || loan <= 0) {
    return { total, count: values.length, lvr: null,
      why: 'either the lending or the security value is not recorded' }
  }
  return { total, count: values.length, lvr: Math.round((loan / total) * 1000) / 10 }
}

export function lvrOf(deal: any): number | null {
  return securityValue(deal).lvr
}

// What is being paid out on a refinance. Not part of funds to complete - it goes
// in the deal row instead, because it should not vanish just because there is no
// completion to fund.
export function refinancedDebt(deal: any): number {
  const bc = deal?.bc_data || {}
  if (has(bc.existingLoanBal)) return num(bc.existingLoanBal)
  let total = 0
  for (const p of deal?.fact_find_data?.properties || []) {
    for (const l of p?.loans || []) {
      if (txt(l?.status) === 'To be refinanced') total += num(l?.balance)
    }
  }
  return total
}
