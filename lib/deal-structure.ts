// THE DEAL, AS ONE BLOCK, IN TWO PLACES.
//
// Replaces the "FROM BC" strip on the Lending options tab and the "DEAL SUMMARY"
// strip on Compliance. One component, one record - edit the approval type on the
// LO and it has already changed on Compliance, because there is no second copy
// to drift.
//
// Fabio, 3 Sep 2026, on why this matters more than it looks: "the reason I need
// this to be spot on is because I want the ai credit notes to use this
// information for their notes".
//
// WHAT IS AUTOMATIC AND WHAT IS NOT
//
// Everything that exists somewhere already is read, never retyped: lender,
// property value, LVR, purchase price, stamp duty, deposit, and each split's
// amount, rate and repayment type. Four things have never existed anywhere in
// the portal and a person has to answer them - see stillNeeded(). They are not
// guessed, and the credit notes will not be written until they are answered.

import { fundsToComplete, loanAmount, securityValue, refinancedDebt, fundsApply } from './funds-to-complete'

const txt = (v: any) => String(v ?? '').trim()
const num = (v: any) => {
  const n = Number(String(v ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const has = (v: any) => num(v) > 0

// --- purpose, per split -----------------------------------------------------
//
// The whole reason for this work. Whether a deal was owner occupied or
// investment used to be decided by asking whether the SCENARIO'S NAME contained
// the word "investment" - so a refinance releasing equity for an investment was
// filed owner occupied, and a deal that is genuinely both could not be
// represented at all.
//
// It belongs on the split because that is the unit that has a purpose. It lives
// on the LO's own split list rather than the per-lender copy: $180,000 of equity
// access is for investment whichever bank funds it.

export type SplitPurpose = 'OO' | 'INV' | ''

export const PURPOSE_LABEL: Record<string, string> = {
  OO: 'Owner occupied',
  INV: 'Investment',
}

const INV_WORDS = /invest|equity (access|release)|cash ?out/i
const OO_WORDS = /owner.?occup|\bOO\b|home loan|end debt|principal place/i

const PAYOUT_WORDS = /refinanc|existing loan|pay ?out|discharg/i
const EQUITY_WORDS = /equity (access|release)|cash ?out/i
const PURCHASE_WORDS = /purchase|new loan|end debt/i

// A suggestion, like suggestPurpose - offered, never applied.
export function suggestFunds(label: string): SplitFunds {
  const l = txt(label)
  if (!l) return ''
  if (EQUITY_WORDS.test(l)) return 'equity'
  if (PAYOUT_WORDS.test(l)) return 'payout'
  if (PURCHASE_WORDS.test(l)) return 'purchase'
  return ''
}

// A SUGGESTION, never a default. Shown under the empty dropdown so somebody can
// agree in one click - but the field stays unset until they do, because the
// label is a guess and this answer ends up in a regulated document.
export function suggestPurpose(label: string): SplitPurpose {
  const l = txt(label)
  if (!l) return ''
  if (INV_WORDS.test(l)) return 'INV'
  if (OO_WORDS.test(l)) return 'OO'
  return ''
}

// WHAT THIS PART OF THE MONEY DOES - which is a different question from what it
// is FOR. A split can be for investment (purpose) and still be paying out an old
// debt rather than funding a purchase (this).
//
// It exists for one reason: on a deal that both refinances and buys, funds to
// complete must count only the money that reaches the purchase. Counting the
// whole loan reported "$625,000 over" on a deal whose real answer was $75,000.
export type SplitFunds = 'purchase' | 'payout' | 'equity' | ''

export const FUNDS_LABEL: Record<string, string> = {
  purchase: 'Funds the purchase',
  payout: 'Pays out existing debt',
  equity: 'Releases equity',
}

export type StructureSplit = {
  id: string
  label: string
  amount: string
  rate?: string
  repaymentType?: string
  purpose?: SplitPurpose
  // Only asked on a deal that both refinances and buys - see needsFundsRole().
  // Everywhere else the answer is obvious and nobody is made to type it.
  funds?: SplitFunds
  // Recorded on the block itself - neither exists per split anywhere else.
  termYears?: string
  productType?: string
}

// WHO OWNS WHAT, AND WHY IT IS SPLIT THIS WAY.
//
// The LO form owns lo_data and autosaves the whole blob. A second component
// writing into the same blob would have its changes overwritten the next time
// somebody typed on the LO - so the deal structure block does not touch it.
//
//   Lending options owns: label, amount, purpose, funds
//   Compliance owns:      term, product type, and the deal-level fields
//
// The compliance half is filed under the split's id in
// compliance_data.splitDetail, and merged back here. A split that is deleted
// leaves its detail behind harmlessly; a key nothing matches is ignored.
// WHERE THE MONEY ACTUALLY LIVES.
//
// The LO keeps a split list in three places and none of them holds everything:
//
//   lo_data.refinanceSplits        the deal structure - label and amount
//   lo_data.lenders[].lenderSplits the per-lender copy - amount, RATE, P&I/IO
//   bc_data.splits                 what the BC started with
//
// The first version read one list and stopped. On Chapman's purchase that meant
// a row reading "Split 1 - Owner-occupied loan" with a dash for the amount, the
// rate and the repayment type, while the Scenario box six inches below it said
// $1,700,000. Fabio, 3 Sep 2026: "loan amount is on scenario so why set on lo".
//
// So each field is taken from the first list that has it, matched by id and
// falling back to position. And a deal with exactly ONE split whose amount was
// never typed into the split list takes the deal's loan amount, because with one
// split those are the same number by definition. Two blank splits get nothing -
// there is no way to know how the money divides, and inventing a division here
// would put a made-up figure in a credit note.
export function splitsOf(deal: any): StructureSplit[] {
  const lo = deal?.lo_data || {}
  const detail = deal?.compliance_data?.splitDetail || {}

  const globals: any[] = lo.refinanceSplits || []
  const bcSplits: any[] = deal?.bc_data?.splits || []
  const lenderSplits: any[] = recommendedLenderSplits(deal)

  const base = globals.length > 0 ? globals
    : lenderSplits.length > 0 ? lenderSplits
    : bcSplits
  if (base.length === 0) return []

  // Same split, seen from another list. Ids match when the per-lender copy was
  // seeded from the globals; position is the fallback for a BC list that never
  // had ids at all.
  const same = (list: any[], id: string, i: number) =>
    list.find((x: any) => txt(x?.id) && txt(x?.id) === id) || list[i] || {}

  const firstOf = (...vals: any[]) => vals.find(v => txt(v)) ?? ''
  const onlySplit = base.length === 1

  return base.map((s: any, i: number) => {
    const id = txt(s?.id) || `s${i}`
    const d = detail[id] || {}
    const ls = same(lenderSplits, id, i)
    const bs = same(bcSplits, id, i)

    const amount = firstOf(s?.amount, ls?.amount, bs?.amount,
      onlySplit && loanAmount(deal) > 0 ? String(loanAmount(deal)) : '')

    return {
      id,
      label: firstOf(s?.label, ls?.label, bs?.label) || `Split ${i + 1}`,
      amount: txt(amount),
      // Rate and repayment type are only ever typed on the per-lender copy.
      rate: firstOf(ls?.rate, s?.rate, bs?.rate),
      repaymentType: firstOf(ls?.repaymentType, s?.repaymentType, s?.type, bs?.repaymentType, bs?.type),
      purpose: (txt(s?.purpose) as SplitPurpose) || '',
      funds: (txt(s?.funds) as SplitFunds) || '',
      // The BC holds one term for the whole deal; it prefills every split, and a
      // split that differs is changed here.
      termYears: txt(d?.termYears) || txt(s?.termYears) || txt(deal?.bc_data?.loanTerm),
      // The LO holds one product per lender, not per split. Same idea.
      productType: txt(d?.productType) || txt(s?.productType) || recommendedProduct(deal),
    }
  })
}

// The recommended lender's own splits, which is where the rate and the P&I/IO
// answer are typed. With no recommendation yet it uses option one - the way the
// LO's own splits box does, because option one is usually the recommendation and
// often the only one filled in. It never reaches past that: option two's rate
// under option one's name would be a wrong number, not a missing one.
function recommendedLenderSplits(deal: any): any[] {
  const lo = deal?.lo_data || {}
  const list = lo.lenders || []
  const rec = list.find((l: any) => l?.lenderName && l.lenderName === lo.recommendedLender) || list[0]
  return (rec?.lenderSplits || []).length > 0 ? rec.lenderSplits : []
}

function recommendedProduct(deal: any): string {
  const lo = deal?.lo_data || {}
  const rec = (lo.lenders || []).find((l: any) => l?.lenderName && l.lenderName === lo.recommendedLender)
    || (lo.lenders || [])[0]
  return txt(rec?.productName)
}

// Writing one split's compliance-side detail, without disturbing the others.
export function withSplitDetail(complianceData: any, splitId: string,
                                patch: { termYears?: string; productType?: string }): any {
  const cd = complianceData && typeof complianceData === 'object' ? complianceData : {}
  const detail = cd.splitDetail && typeof cd.splitDetail === 'object' ? cd.splitDetail : {}
  return {
    ...cd,
    splitDetail: { ...detail, [splitId]: { ...(detail[splitId] || {}), ...patch } },
  }
}

// --- what a person still has to answer --------------------------------------

export type Needed = { where: 'deal' | 'split'; splitId?: string; splitLabel?: string; what: string }

// A deal that BOTH refinances and buys. The only shape where "what does this
// split do" has to be asked, because everywhere else it is obvious: on a pure
// purchase every split funds the purchase, and on a pure refinance there is no
// completion to fund at all.
export function isMixed(deal: any): boolean {
  const bc = deal?.bc_data || {}
  const buying = has(bc.purchasePrice) || has(bc.newPurchasePrice)
  return buying && refinancedDebt(deal) > 0
}

export function needsFundsRole(deal: any): boolean {
  return isMixed(deal)
}

// Only the things that block the credit notes. Cashback is NOT here - "none" is
// a real answer and most deals have none, so an empty box is not a gap. Fabio,
// 3 Sep 2026: "cashback dont do one per split you only get one cashback or not".
export function stillNeeded(deal: any): Needed[] {
  const out: Needed[] = []
  const askFunds = needsFundsRole(deal)
  for (const s of splitsOf(deal)) {
    if (!s.purpose) out.push({ where: 'split', splitId: s.id, splitLabel: s.label, what: 'purpose — owner occupied or investment' })
    if (askFunds && !s.funds) {
      out.push({ where: 'split', splitId: s.id, splitLabel: s.label, what: 'what it does — funds the purchase, pays out debt, or releases equity' })
    }
    if (!s.termYears) out.push({ where: 'split', splitId: s.id, splitLabel: s.label, what: 'term' })
    if (!s.productType) out.push({ where: 'split', splitId: s.id, splitLabel: s.label, what: 'product type' })
  }
  return out
}

// The lending that actually reaches the purchase. On a plain purchase that is
// all of it; on a mixed deal it is only the splits somebody marked as funding
// the purchase. Null when the deal is mixed and not every split has been
// answered - a partial sum here is worse than none, because it looks finished.
export function purchaseLending(deal: any): number | null {
  if (!isMixed(deal)) return loanAmount(deal)
  const splits = splitsOf(deal)
  if (splits.length === 0) return null
  if (splits.some(s => !s.funds)) return null
  return splits.filter(s => s.funds === 'purchase').reduce((t, s) => t + num(s.amount), 0)
}

// The credit notes read this block. Written from a blank purpose they would
// either say nothing useful about that money or start guessing, so they wait.
export function canGenerateNotes(deal: any): boolean {
  return stillNeeded(deal).length === 0
}

// --- the security address ---------------------------------------------------
//
// Never existed anywhere. On a pre-approval there IS no address yet, so it fills
// itself from the BC's suburb rather than sitting empty and looking unfinished.
// Fabio, 3 Sep 2026: "security address (prepopulate to TBA and suburb from BC if
// I tick pre-approval)".
export function defaultSecurityAddress(deal: any, preApproval: boolean): string {
  if (!preApproval) return ''
  const suburb = txt(deal?.bc_data?.suburb) || txt(deal?.bc_data?.newPurchaseSuburb)
  return suburb ? `TBA — ${suburb}` : 'TBA'
}

// --- the deal row -----------------------------------------------------------

export type DealRow = {
  lender: string
  preApproval: boolean
  securityAddress: string
  propertyValue: number
  securityCount: number
  lvr: number | null
  lvrWhy?: string
  existingLoan: number
  cashback: string
  totalLending: number
  // Owner occupied / investment / both, added up from the splits themselves.
  ooTotal: number
  invTotal: number
  unsetTotal: number
}

export function dealRow(deal: any): DealRow {
  const lo = deal?.lo_data || {}
  const cd = deal?.compliance_data || {}
  const sec = securityValue(deal)
  const splits = splitsOf(deal)

  const sum = (p: SplitPurpose) => splits.filter(s => (s.purpose || '') === p)
    .reduce((t, s) => t + num(s.amount), 0)

  return {
    lender: txt(lo.recommendedLender),
    preApproval: !!cd.preApproval,
    // Whatever was typed, else the TBA fill on a pre-approval.
    securityAddress: txt(cd.securityAddress) || defaultSecurityAddress(deal, !!cd.preApproval),
    propertyValue: sec.total,
    securityCount: sec.count,
    lvr: sec.lvr,
    lvrWhy: sec.why,
    // Shown only on a refinance, where funds to complete does not apply.
    existingLoan: fundsApply(deal) ? 0 : refinancedDebt(deal),
    cashback: txt(cd.cashback),
    totalLending: loanAmount(deal),
    ooTotal: sum('OO'),
    invTotal: sum('INV'),
    unsetTotal: sum(''),
  }
}

// Owner occupied, investment or both — added up from the splits rather than
// guessed from the scenario's name.
export function purposeSummary(deal: any): string {
  const r = dealRow(deal)
  if (r.ooTotal > 0 && r.invTotal > 0) return 'Owner occupied & investment'
  if (r.invTotal > 0) return 'Investment'
  if (r.ooTotal > 0) return 'Owner occupied'
  return ''
}

export { fundsToComplete, fundsApply }
