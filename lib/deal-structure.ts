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

export type StructureSplit = {
  id: string
  label: string
  amount: string
  rate?: string
  repaymentType?: string
  purpose?: SplitPurpose
  // Recorded on the block itself - neither exists per split anywhere else.
  termYears?: string
  productType?: string
}

// The splits this deal actually has, from the LO's list, falling back to the
// BC's. Existing deals have no purpose on any split; they are unanswered, not
// wrong, and nothing is filled in on their behalf.
export function splitsOf(deal: any): StructureSplit[] {
  const lo = deal?.lo_data || {}
  const fromLo = (lo.refinanceSplits || []).filter((s: any) => has(s?.amount) || txt(s?.label))
  const source = fromLo.length > 0 ? fromLo : (deal?.bc_data?.splits || [])
  return source.map((s: any, i: number) => ({
    id: txt(s?.id) || `s${i}`,
    label: txt(s?.label) || `Split ${i + 1}`,
    amount: txt(s?.amount),
    rate: txt(s?.rate),
    repaymentType: txt(s?.repaymentType) || txt(s?.type),
    purpose: (txt(s?.purpose) as SplitPurpose) || '',
    termYears: txt(s?.termYears),
    productType: txt(s?.productType),
  }))
}

// --- what a person still has to answer --------------------------------------

export type Needed = { where: 'deal' | 'split'; splitId?: string; splitLabel?: string; what: string }

// Only the things that block the credit notes. Cashback is NOT here - "none" is
// a real answer and most deals have none, so an empty box is not a gap. Fabio,
// 3 Sep 2026: "cashback dont do one per split you only get one cashback or not".
export function stillNeeded(deal: any): Needed[] {
  const out: Needed[] = []
  for (const s of splitsOf(deal)) {
    if (!s.purpose) out.push({ where: 'split', splitId: s.id, splitLabel: s.label, what: 'purpose — owner occupied or investment' })
    if (!s.termYears) out.push({ where: 'split', splitId: s.id, splitLabel: s.label, what: 'term' })
    if (!s.productType) out.push({ where: 'split', splitId: s.id, splitLabel: s.label, what: 'product type' })
  }
  return out
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
