// THE DEAL, AS ONE BLOCK, IN TWO PLACES.
import { purchaseSuburbOf } from './duty-state'
import { money } from './money'
import { normalisePurpose } from './split-purpose'
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
import { lenderOnTheDeal, optionOnTheDeal, optionGap, lenderSourceOnTheDeal,
         splitsOnTheDeal } from './client-agreement'

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
  // WHICH HOUSE THIS SPLIT IS SECURED BY, and what the money was originally
  // for, in the broker's own words.
  //
  // 12 Oct 2026. Every compliance box reads splits through this shape, and this
  // shape dropped both - so the pack described six loans and three properties as
  // two unrelated facts and could not say which loan sat on which house. The
  // lending options tab has known it since this morning; it stopped here.
  //
  // fundsUsedFor is the "Original purpose of funds" box. It is the only reason
  // for a split's repayment type that anybody has actually written down, which
  // is why the wording reads it rather than inventing one. See lib/box-four.ts.
  securityId?: string
  fundsUsedFor?: string
  // HOW LONG THE INTEREST ONLY RUNS.
  //
  // Fabio, 27 Sep 2026, looking at the Loughlin-Walsh handover: "The handover
  // doesnt have any indication of IO term". Two of the three splits said "IO"
  // and stopped, so the credit assessor could not tell one year from ten.
  //
  // The number was already on the deal - it is the interest only years on the
  // recommended product - it was simply never carried onto a split. Nothing is
  // ever invented here: a deal with no IO years recorded anywhere leaves this
  // blank, and the handover prints "term not recorded" rather than a figure
  // nobody typed.
  ioYears?: string
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
  const lenderSplits: any[] = optionSplits(deal)

  // THE BORROWING CAPACITY OWNS THE STRUCTURE. ALWAYS.
  //
  // 12 Oct 2026, the Veljovic deal. This used to read the lending options'
  // list first and stop there. That list is a COPY of the BC's, taken once,
  // and nothing re-took it - so when the BC went from two splits to six, this
  // function went on reporting two.
  //
  // It is not a screen fault. The lending options tab rebuilds its own copy on
  // load, but a load never writes (see writeNow in LOForm - arrival is not an
  // edit, on purpose), so the DATABASE still held two. The broker notes PDF
  // reads the deal straight from the database and comes through here, which
  // means the compliance pack was built from two splits and $1,020,000 while
  // the deal was six splits and $2,720,000.
  //
  // So the structure is taken from the BC wherever the BC has one. How many
  // splits there are, what each is called, what it is worth and which house it
  // secures are the BC's answers. docs/the-chain.md, rule 1.
  //
  // ANYTHING THE LENDING OPTIONS ADDED BEYOND IT IS KEPT, not dropped - the
  // same rule mergeWithBc follows on the tab itself. Following is not deleting.
  const bcOwns = bcSplits.length > 0
  const base = bcOwns ? [...bcSplits, ...globals.slice(bcSplits.length)]
    : globals.length > 0 ? globals
    : lenderSplits
  if (base.length === 0) return []

  // Same split, seen from another list. Ids match when the per-lender copy was
  // seeded from the globals; position is the fallback for a BC list that never
  // had ids at all.
  const same = (list: any[], id: string, i: number) =>
    list.find((x: any) => txt(x?.id) && txt(x?.id) === id) || list[i] || {}

  const firstOf = (...vals: any[]) => vals.find(v => txt(v)) ?? ''
  const onlySplit = base.length === 1

  return base.map((s: any, i: number) => {
    // THE LENDING OPTIONS' OWN ROW FOR THIS POSITION.
    //
    // When the BC owns the list above, `s` is a BC split and carries none of
    // the answers that belong to this tab - the purpose, what the money does,
    // the rate. Those are read from here instead. Where the BC does not own the
    // list, this is the same object as `s`, so every chain below behaves as it
    // always did.
    const gs = globals[i] || {}
    // AND THE ID COMES FROM THE LENDING OPTIONS FIRST, which matters more than
    // it looks: compliance_data.splitDetail files the term, the product type
    // and the IO years under this id. BC splits have no id at all, so taking
    // the BC's would mint `s0`, `s1` ... and orphan all three on every deal
    // already written.
    const id = txt(gs?.id) || txt(s?.id) || `s${i}`
    const d = detail[id] || {}
    const ls = same(lenderSplits, id, i)
    const bs = same(bcSplits, id, i)

    // Label and amount follow the BC, because this list is a copy OF it.
    const amount = firstOf(s?.amount, gs?.amount, ls?.amount, bs?.amount,
      onlySplit && loanAmount(deal) > 0 ? String(loanAmount(deal)) : '')

    return {
      id,
      label: firstOf(s?.label, gs?.label, ls?.label, bs?.label) || `Split ${i + 1}`,
      amount: txt(amount),
      // Rate is only ever typed on the per-lender copy.
      rate: firstOf(ls?.rate, gs?.rate, s?.rate, bs?.rate),
      // The structure, so the BC has the last word where the lists disagree -
      // which house a loan sits on is not a lending options decision.
      securityId: firstOf(bs?.securityId, s?.securityId, gs?.securityId, ls?.securityId),
      fundsUsedFor: firstOf(gs?.fundsUsedFor, s?.fundsUsedFor, bs?.fundsUsedFor, gs?.funds, s?.funds),
      // ANSWERED HERE FIRST. 17 Sep 2026, Dylan Smyth and Megan Isherwood: an
      // investment PURCHASE, where the per-lender splits box does not exist -
      // it is drawn on refinances only. So the repayment type came from the BC
      // split and there was nowhere on the whole deal to change it, while the
      // product above had Interest Only ticked. Answering it on this panel now
      // wins over every other copy, on every scenario.
      repaymentType: firstOf(d?.repaymentType, ls?.repaymentType, gs?.repaymentType, gs?.type,
                             s?.repaymentType, s?.type, bs?.repaymentType, bs?.type),
      // BOTH SPELLINGS, AND THE BC's ANSWER WHERE THE LO HAS NONE.
      //
      // 9 Oct 2026. This was a cast, so 'owner_occupied' - what the BC's own
      // dropdown writes - read as blank. And the lending options list is
      // preferred over the BC the moment it exists, while initRefinanceSplits()
      // never copied this field across, so on a deal with an LO the answer was
      // gone twice over.
      //
      // The fall is the same one the repayment type above already makes: this
      // list's answer, then the BC split it came from.
      purpose: normalisePurpose(gs?.purpose) || normalisePurpose(s?.purpose) || normalisePurpose(bs?.purpose),
      funds: (txt(gs?.funds) as SplitFunds) || (txt(s?.funds) as SplitFunds) || '',
      // The BC holds one term for the whole deal; it prefills every split, and a
      // split that differs is changed here.
      termYears: txt(d?.termYears) || txt(gs?.termYears) || txt(s?.termYears) || txt(deal?.bc_data?.loanTerm),
      // The LO holds one product per lender, not per split. Same idea.
      productType: txt(d?.productType) || txt(gs?.productType) || txt(s?.productType) || recommendedProduct(deal),
      // Same three-step fall as the term above: this block's own answer, then
      // whatever the split carries, then the recommended product's IO years.
      ioYears: txt(d?.ioYears) || txt(gs?.ioYears) || txt(s?.ioYears) || txt(ls?.ioYears) || recommendedIoYears(deal),
    }
  })
}

// "IO" and "Fixed IO" are both interest only. "P&I" and "Fixed P&I" are not.
export function isInterestOnly(repaymentType: any): boolean {
  const t = txt(repaymentType).toUpperCase()
  return t.includes('IO') || t.includes('INTEREST ONLY')
}

// How a split's repayment type reads on a document: "P&I", or "IO · 5 yrs".
// An interest only split with no term recorded says so rather than going quiet,
// because "IO" on its own is the thing a credit assessor cannot act on.
export function repaymentLine(split: { repaymentType?: string; ioYears?: string } | null | undefined): string {
  const type = txt(split?.repaymentType)
  if (!type) return ''
  if (!isInterestOnly(type)) return type
  const years = txt(split?.ioYears)
  return years ? `${type} · ${years} yrs` : `${type} · term not recorded`
}

// THE RECOMMENDED PRODUCT'S INTEREST ONLY YEARS.
//
// A lending option carries four rate modules - variable P&I, variable IO, fixed
// P&I, fixed IO - and only the IO ones have an interest only period. Read from
// whichever IO module is actually ticked. Both ticked and disagreeing is left
// blank on purpose: there is no way to know which one a given split follows,
// and printing the wrong IO term on a submission is worse than printing none.
function recommendedIoYears(deal: any): string {
  const rec = optionOnTheDeal(deal?.lo_data || {})
  const years = ['variableIO', 'fixedIO']
    .map(k => (rec?.[k]?.enabled ? txt(rec[k]?.ioYears) : ''))
    .filter(Boolean)
  if (years.length === 0) return ''
  return years.every(y => y === years[0]) ? years[0] : ''
}

// The recommended lender's own splits, which is where the rate and the P&I/IO
// answer are typed. With no recommendation yet it uses option one - the way the
// LO's own splits box does, because option one is usually the recommendation and
// often the only one filled in. It never reaches past that: option two's rate
// under option one's name would be a wrong number, not a missing one.
function optionSplits(deal: any): any[] {
  return splitsOnTheDeal(deal?.lo_data || {})
}

function recommendedProduct(deal: any): string {
  return txt(optionOnTheDeal(deal?.lo_data || {})?.productName)
}

// WHEN THE TWO SPLIT LISTS DISAGREE, SAY SO. NEVER CORRECT IT QUIETLY.
//
// 9 Oct 2026. The lending options hold their own split list and splitsOf()
// prefers it - the COUNT comes from it, and so do the labels and the amounts.
// A list the BC keeps current can never drift; one a person built by hand, or
// one saved before any of this existed, can.
//
// THIS SHOULD NOW BE ALMOST SILENT. 12 Oct 2026: the lending options list
// follows the borrowing capacity on every load - see mergeWithBc in LOForm and
// docs/the-chain.md. Drift between the two can no longer build up on its own.
//
// What is left for this to catch is the one case the merge deliberately does not
// touch: a split added on the lending options that the borrowing capacity has no
// counterpart for. That is structure living somewhere it is not owned, and the
// client never agreed to it, so it is said out loud rather than absorbed.
//
// It reports and changes nothing, the same as loanAmountDisagrees does for the
// loan amount. Fabio, 12 Oct 2026: "hopefully these warning saying split dont
// match will be far and between and only show if there is a real error in
// place".
//
// ONLY THE TWO THAT MATTER. A different NUMBER of splits, or a different total.
// Those are the ones that make a document describe a different deal. A split
// renamed on the lending options is usually deliberate, and a line that fires
// on every second deal is a line nobody reads twice.
export type SplitsDisagreement = {
  bcCount: number; loCount: number; bcTotal: number; loTotal: number; lines: string[]
}

export function splitsDisagree(deal: any): SplitsDisagreement | null {
  const lo: any[] = deal?.lo_data?.refinanceSplits || []
  const bc: any[] = deal?.bc_data?.splits || []
  // Nothing to compare: one of the two has never been filled in.
  if (lo.length === 0 || bc.length === 0) return null

  const total = (list: any[]) => list.reduce((t, x) => t + num(x?.amount), 0)
  const bcTotal = total(bc), loTotal = total(lo)
  const lines: string[] = []

  if (lo.length !== bc.length) {
    lines.push(`the borrowing capacity has ${bc.length} split${bc.length === 1 ? '' : 's'}`
      + ` and the lending options have ${lo.length}`)
  }
  // Both sides need a figure before a difference means anything - a list nobody
  // has filled in yet is unfinished, not disagreeing.
  if (bcTotal > 0 && loTotal > 0 && Math.abs(bcTotal - loTotal) >= 1) {
    lines.push(`the borrowing capacity totals ${money(bcTotal)} and the lending options ${money(loTotal)}`)
  }

  return lines.length ? { bcCount: bc.length, loCount: lo.length, bcTotal, loTotal, lines } : null
}

// Writing one split's compliance-side detail, without disturbing the others.
export function withSplitDetail(complianceData: any, splitId: string,
                                patch: { termYears?: string; productType?: string; ioYears?: string }): any {
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
    // 17 Sep 2026. Until today this was never asked, because every split was
    // born holding "P&I" whether or not anybody meant it. Now that a split loan
    // starts blank, the blank has to be visible - and the credit notes wait for
    // it rather than describing a repayment type nobody chose.
    if (!s.repaymentType) out.push({ where: 'split', splitId: s.id, splitLabel: s.label, what: 'repayment type — P&I or interest only' })
    if (!s.productType) out.push({ where: 'split', splitId: s.id, splitLabel: s.label, what: 'product type' })
  }
  return out
}

// --- what is left, said as jobs rather than as gaps -------------------------
//
// 13 Oct 2026. stillNeeded() above returns one entry per EMPTY FIELD, and the
// strip printed them straight out in red. On the Veljovic deal that was a red
// box reading "14 things are needed", with six identical lines in it and "and 8
// more" hiding the rest. Fabio: "confused with meaning".
//
// Three faults, and only the third is cosmetic.
//
// ONE. Ten of the fourteen were the same untick. A split's product is not typed
// on the split - it is read off whichever lending option is marked as
// recommended (see recommendedProduct). With no option picked there is nothing
// to read, so every split reports it. Ten symptoms, one cause, and the box
// named none of them.
//
// TWO. It printed the split's LABEL. Labels repeat - three lines said "Existing
// Investment Home loan" and nothing told them apart. The split NUMBER is on the
// screen directly above, and is the only thing a person can act on.
//
// THREE. It was red. Fabio: "I dont like warnigns for the sake of warnigns
// unless it is needed meaning BC and LO are not mtching". A deal somebody is
// halfway through writing has blanks in it; that is the normal state of a deal,
// not a fault. Red belongs to splitsDisagree, which IS a fault, and it only
// reads as one when nothing else on the page is shouting alongside it.
export type LeftJob = { splits: number[]; what: string }
export type WhatIsLeft = { jobs: number; pickLender: boolean; ofSplits: number; lines: LeftJob[] }

// PLAIN WORDS, NOT THE NAMES OF BOXES. "product type" and "term" are what the
// fields are called in here. Neither tells somebody what to do, and neither is
// set where they would look.
const LEFT_WORDS: Record<string, string> = {
  product: 'set the product',
  purpose: 'say whether it is owner occupied or investment',
  repayment: 'say whether it is principal and interest or interest only',
  funds: 'say what the money does - funds the purchase, pays out debt, or releases equity',
  term: 'set the loan term',
}
const LEFT_ORDER = ['product', 'purpose', 'repayment', 'funds', 'term']

/** "Split 7", or "Splits 7, 8, 9 and 10". */
export function splitsNamed(ns: number[]): string {
  if (ns.length === 0) return ''
  if (ns.length === 1) return `Split ${ns[0]}`
  const all = ns.map(String)
  return `Splits ${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}`
}

export function whatIsLeft(deal: any): WhatIsLeft {
  const splits = splitsOf(deal)
  const askFunds = needsFundsRole(deal)
  const gaps: Record<string, number[]> = {}
  const add = (k: string, n: number) => { gaps[k] = [...(gaps[k] || []), n] }

  splits.forEach((s, i) => {
    const n = i + 1
    if (!s.purpose) add('purpose', n)
    if (askFunds && !s.funds) add('funds', n)
    if (!s.termYears) add('term', n)
    if (!s.repaymentType) add('repayment', n)
    if (!s.productType) add('product', n)
  })

  // THE ONE UNTICK THAT ANSWERS A WHOLE COLUMN. Only when it really is all of
  // them and really is the missing recommendation - a single split left blank
  // while the others are answered is that split's own gap, and is listed as one.
  const productGaps = gaps.product || []
  const pickLender = splits.length > 0
    && !recommendedProduct(deal)
    && productGaps.length === splits.length
  if (pickLender) delete gaps.product

  const lines = LEFT_ORDER
    .filter(k => (gaps[k] || []).length > 0)
    .map(k => ({ splits: gaps[k], what: LEFT_WORDS[k] }))

  // JOBS, NOT GAPS. Fourteen empty boxes was two things to go and do, and a
  // number that large on a deal in progress reads as a deal in trouble.
  return { jobs: (pickLender ? 1 : 0) + lines.length, pickLender, ofSplits: splits.length, lines }
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
  // purchaseSuburbOf, not the raw field: a suburb box holding "NSW" was never a
  // suburb, and "TBA - NSW" is not an address. See lib/duty-state.ts.
  const suburb = txt(deal?.bc_data?.suburb) || purchaseSuburbOf(deal?.bc_data)
  return suburb ? `TBA — ${suburb}` : 'TBA'
}

// --- the deal row -----------------------------------------------------------

export type DealRow = {
  lender: string
  // WHERE THAT NAME CAME FROM. The strip used to print "from the LO" under it,
  // which answers a question nobody was asking. What matters is whether you are
  // looking at the recommendation or at the client's decision, so it says which.
  lenderSource: string
  // Why the rate, product and term are blank on a deal whose clients went
  // elsewhere. Empty when there is nothing wrong. See lib/client-agreement.ts.
  optionGap: string
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
    // WHO THIS DEAL IS WITH, not who was recommended. The client's decision
    // is the answer wherever one was given. See lib/client-agreement.ts.
    lender: lenderOnTheDeal(lo),
    lenderSource: lenderSourceOnTheDeal(lo),
    optionGap: optionGap(lo),
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
