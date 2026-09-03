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
  // SHOWN, BUT NOT ADDED UP. LMI and the risk fee are capitalised onto the loan
  // - the client does not find that money at settlement, the loan carries it. So
  // it belongs on the strip where somebody can see it, and nowhere near the
  // arithmetic. Fabio, 3 Sep 2026: "add LMI ... it doesnt impact funds to
  // complete as LMI and risk fee is capitalised on the loans".
  capitalised: FundsLine[]
  toFind: number
  // False when the deal is mixed and the split roles are unanswered. The lines
  // are still worth showing; the total is not, because it would be wrong.
  workable: boolean
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

// A pure refinance has no funds to complete - there is no settlement to fund.
// A deal that BOTH refinances and buys does: the purchase still has to settle.
export function fundsApply(deal: any): boolean {
  const bc = deal?.bc_data || {}
  return isConstruction(deal) || has(bc.purchasePrice) || has(bc.newPurchasePrice)
}

// A deal that both refinances and buys.
function mixed(deal: any): boolean {
  const bc = deal?.bc_data || {}
  return (has(bc.purchasePrice) || has(bc.newPurchasePrice)) && refinancedDebt(deal) > 0
}

// THE LENDING THAT ACTUALLY REACHES THE PURCHASE.
//
// Counting the whole loan reported "$625,000 over" on a deal whose real answer
// was $75,000, because most of that lending paid out an old mortgage and
// released equity - money the purchase never sees. On a mixed deal only the
// splits somebody marked as funding the purchase are counted.
//
// Null means "cannot be worked out yet": the deal is mixed and at least one
// split has not been answered. A partial sum would look finished and be wrong.
//
// This reads splits directly rather than through deal-structure's splitsOf(),
// which imports from this file. One narrow duplication beats a circular import,
// and all it needs here is an amount and a role.
function purchaseLoan(deal: any): number | null {
  if (!mixed(deal)) return loanAmount(deal)
  const lo = deal?.lo_data || {}
  const fromLo = (lo.refinanceSplits || []).filter((s: any) => has(s?.amount) || txt(s?.label))
  const splits: any[] = fromLo.length > 0 ? fromLo : (deal?.bc_data?.splits || [])
  if (splits.length === 0) return null
  if (splits.some((s: any) => !txt(s?.funds))) return null
  return splits.filter((s: any) => txt(s.funds) === 'purchase')
    .reduce((t: number, s: any) => t + num(s?.amount), 0)
}

export function fundsToComplete(deal: any): FundsToComplete {
  const bc = deal?.bc_data || {}
  if (!fundsApply(deal)) return { lines: [], capitalised: [], toFind: 0, workable: false, missing: [], applies: false }

  const lines: FundsLine[] = []
  const capitalised: FundsLine[] = []
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

  const loan = purchaseLoan(deal)
  if (loan === null) {
    // Mixed deal, unanswered splits. Nothing is guessed and no total is offered.
    missing.push('This deal both refinances and buys. Say what each split does — funds the purchase, pays out existing debt, or releases equity — and the funds to complete can be worked out.')
  } else if (loan > 0) {
    lines.push({ label: mixed(deal) ? 'Loan funding the purchase' : 'Loan', amount: loan, kind: 'source' })
  } else {
    missing.push('No loan amount has been recorded')
  }

  // Capitalised onto the loan, so it changes what is borrowed and never what is
  // found at settlement. Listed so nobody wonders where it went.
  if (has(bc.lmi)) {
    capitalised.push({ label: 'LMI', amount: num(bc.lmi), kind: 'cost' })
  } else if (txt(bc.lmiApplicable).toLowerCase().startsWith('y')) {
    missing.push('LMI applies but no amount has been recorded')
  }

  const costs = lines.filter(l => l.kind === 'cost').reduce((s, l) => s + l.amount, 0)
  const sources = lines.filter(l => l.kind === 'source').reduce((s, l) => s + l.amount, 0)

  // Never negative. A purchase where the loan and deposit exceed the price and
  // duty needs nothing found; "minus $4,000" reads like a refund.
  // No answer at all while the split roles are unanswered - see purchaseLoan().
  const known = loan !== null
  return {
    lines, capitalised,
    toFind: known ? Math.max(0, Math.round(costs - sources)) : 0,
    workable: known,
    missing, applies: true,
  }
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

// Scenarios where the client is buying and nothing is being refinanced. On these
// an existing loan balance is the mortgage on the home they already own and are
// keeping - see refinancedDebt.
const PURCHASE_ONLY_TEMPLATES = new Set([
  'oo_purchase', 'oo_lvr_compare', 'investment_purchase', 'fhb', 'smsf',
  'construction', 'family_pledge',
])

// What is being paid out on a refinance. Not part of funds to complete - it goes
// in the deal row instead, because it should not vanish just because there is no
// completion to fund.
//
// The BC's existing loan balance is NOT proof of a refinance. Chapman's OO
// purchase carries $1,279,283.98 in that box - the loan on the home they are
// selling out of - and reading it as refinanced debt made a plain purchase look
// like a deal that both refinances and buys, which withheld the funds to
// complete total and demanded an answer to "what does this split do" that the
// deal does not have. On a purchase-only scenario the fact find's "To be
// refinanced" flag is the only authority, because that flag is somebody saying
// so rather than a number left in a box.
export function refinancedDebt(deal: any): number {
  const bc = deal?.bc_data || {}
  let flagged = 0
  for (const p of deal?.fact_find_data?.properties || []) {
    for (const l of p?.loans || []) {
      if (txt(l?.status) === 'To be refinanced') flagged += num(l?.balance)
    }
  }
  // Unchanged for every scenario that does refinance: the BC's figure wins,
  // because it is the payout the deal was priced on.
  if (!PURCHASE_ONLY_TEMPLATES.has(txt(bc.template)) && has(bc.existingLoanBal)) {
    return num(bc.existingLoanBal)
  }
  return flagged
}
