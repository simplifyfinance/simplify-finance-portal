// The loan splits shown under each lender option on a Lending Options document.
//
// The LO holds two lists: the global splits that define the deal structure, and
// a per-lender copy that the broker can adjust because a lender may want the
// money carved up differently. The per-lender copy was only ever created when a
// lender was ADDED - and the first lender option is not added, it is there from
// the moment the LO is created, with an empty list.
//
// So option 1 - which is usually the recommended lender - showed "No splits
// loaded" and no equity release row, while options 2 and 3 were fine. On
// Clementine's refinance on 2 Sep 2026: Bank of Melbourne 0 splits, Macquarie 2,
// ubank 2. Nobody would read that as a bug in the first option; it reads as
// something you forgot to fill in.
//
// Falling back to the global splits is what the label on the box already
// promises - "pre-filled - editable per lender" - and it repairs every LO
// already saved without touching the database.

import { norm } from './lender-id'

export type GlobalSplit = { id: string; label: string; amount: string; securityId?: string
  // THE LOAN THAT IS ALREADY THERE, ON A TOP UP, AND WHAT IT COSTS TODAY.
  //
  // 20 Oct 2026. The existing loan appears as a split so every lender can be
  // priced against the whole position - that is how we compare staying and
  // topping up against moving the lot, and it is deliberate. But under the
  // lender the loan is ALREADY with, that split is not being repriced: the
  // facility stays, at the rate it is on, and only the increase is new money.
  //
  // Left blank, somebody had to remember to type the current rate there. Miss
  // it and the client is quoted a repayment on the whole balance at a rate that
  // is not theirs - on the recommended option, which is the one they read.
  staying?: boolean
  existingRate?: string
  existingLender?: string }
// A figure out of a split, however it was typed.
const money = (v: any): number => Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0

export type LenderSplit = {
  id: string; label: string; amount: string
  // WHICH HOUSE THIS SPLIT IS AGAINST, carried from the global split it was
  // seeded from. 12 Oct 2026: every lender is priced against the same structure,
  // so the comparison can group each lender's splits under the same properties
  // in the same order. The property is not a lender's decision - it is the
  // deal's - which is why it rides along rather than being asked again here.
  securityId?: string
  lvr: string; rate: string; repayment: string; repaymentType: string
  // HOW LONG THE INTEREST ONLY PERIOD RUNS, on this split, with this lender.
  // It lived on the rate module, which is per lender - so a deal with a home
  // loan on P&I and an investment split on IO had one box for a question with
  // two answers. 17 Sep 2026.
  ioYears?: string
}

// WHAT REPAYMENT TYPE A NEW SPLIT STARTS AS.
//
// 17 Sep 2026, Dylan Smyth and Megan Isherwood: Interest Only ticked on the
// product, and the deal structure said P&I. Nobody typed P&I - this function
// used to stamp it on every split the moment a lender option was created, and
// ticking a rate module never touched it. So the compliance write-up, which
// reads the ticks, said Interest Only while the deal structure, the client email
// and the handover PDF, which read the split, said P&I. One record, one screen,
// two answers.
//
// The product already knows. One rate module ticked means one repayment type and
// the split can start as that. More than one means a split loan, and which
// portion is which is not something to guess at - so it starts BLANK and shows
// on the list of what is still needed. A figure nobody typed does not go on a
// regulated record; that rule has cost us enough already.
//
// The strings are the four the Type dropdown offers, not prose. They have to
// match or the dropdown shows the first option while holding something else.
export type RateModuleHolder = {
  variablePI?: { enabled?: boolean } | null
  variableIO?: { enabled?: boolean } | null
  fixedPI?: { enabled?: boolean } | null
  fixedIO?: { enabled?: boolean } | null
} | null | undefined

export const SPLIT_TYPES = ['P&I', 'IO', 'Fixed P&I', 'Fixed IO'] as const
export type SplitType = typeof SPLIT_TYPES[number] | ''

const MODULE_TYPE: [keyof NonNullable<RateModuleHolder>, SplitType][] = [
  ['variablePI', 'P&I'], ['variableIO', 'IO'],
  ['fixedPI', 'Fixed P&I'], ['fixedIO', 'Fixed IO'],
]

// The repayment types this product actually offers, in dropdown order.
export function typesOffered(lender: RateModuleHolder): SplitType[] {
  return MODULE_TYPE.filter(([k]) => (lender as any)?.[k]?.enabled === true).map(([, t]) => t)
}

// What a split should start as: the one type, or nothing at all.
export function seedType(lender: RateModuleHolder): SplitType {
  const offered = typesOffered(lender)
  return offered.length === 1 ? offered[0] : ''
}

// The one rate module that is ticked, or nothing. With two ticked there is no
// single answer to carry onto a split, and a guess is worse than a blank.
function soleModule(lender: RateModuleHolder): any {
  const on = MODULE_TYPE.filter(([k]) => (lender as any)?.[k]?.enabled === true)
  return on.length === 1 ? (lender as any)[on[0][0]] : null
}

// A split whose type is not one this product offers. Only ever a warning - the
// portal points, a person decides, exactly as the BC repayment mismatch does.
// Silent while nothing is ticked and while the split has no type: neither is a
// disagreement, it is a question nobody has answered yet.
export function typeContradictsProduct(split: { repaymentType?: string } | null | undefined,
                                        lender: RateModuleHolder): boolean {
  const typed = String(split?.repaymentType ?? '').trim()
  if (!typed) return false
  const offered = typesOffered(lender)
  if (offered.length === 0) return false
  return !offered.some(t => t.toLowerCase() === typed.toLowerCase())
}

/**
 * The rate a seeded split starts on, which is blank for every split but one.
 *
 * A split tagged `staying` under the lender that loan is already with keeps the
 * rate it is on. Under any OTHER lender it is blank, because there that loan
 * would be moving and the new lender has to price it.
 *
 * NO FUZZY MATCH, for the reason lib/lender-id.ts gives: a near miss would put
 * one bank's rate under another bank's name on a client's email. Exact after
 * normalising, or nothing.
 */
function heldRate(s: GlobalSplit, lenderName: any): string {
  if (!s?.staying) return ''
  const mine = norm(s.existingLender)
  const asked = norm(lenderName)
  if (!mine || !asked || mine !== asked) return ''
  return String(s.existingRate ?? '').trim()
}

export function seedFromGlobal(globals: GlobalSplit[] | undefined | null,
                               lender?: RateModuleHolder): LenderSplit[] {
  const type = seedType(lender)
  const lenderName = (lender as any)?.lenderName
  // The interest only period comes across with the type when there is exactly
  // one module to read it from. The RATE does not: a module's rate belongs to
  // the money priced under it, and the repayment figure is for the whole loan -
  // copying either onto each split would put a figure nobody typed on a row.
  const io = String(soleModule(lender)?.ioYears ?? '').trim()
  return (globals || []).map(s => ({
    id: s.id, label: s.label, amount: s.amount, securityId: s.securityId || '',
    lvr: '', rate: heldRate(s, lenderName), repayment: '', repaymentType: type, ioYears: io,
  }))
}

// What to show under this lender: its own splits once it has any, otherwise the
// deal's. A lender that has been edited keeps its edits - the fallback only
// covers the never-filled case, so pressing "Sync from top" is still the way to
// throw away an override.
export function resolveLenderSplits(
  lender: ({ lenderSplits?: LenderSplit[] | null } & RateModuleHolder) | null | undefined,
  globals: GlobalSplit[] | undefined | null,
): LenderSplit[] {
  const own = lender?.lenderSplits
  if (own && own.length > 0) {
    // A LENDER PRICED BEFORE TODAY HAS NO PROPERTY ON ITS SPLITS.
    //
    // Its own rates, repayments and types are its own and are never touched.
    // The house each split is against is not the lender's answer - it is the
    // deal's - so it is filled in from the global split of the same id, which
    // is where it has always come from. A split that already carries one keeps
    // it, and one whose global is gone is left alone rather than guessed at.
    // AND THE LIST ITSELF IS HANDED BACK UNTOUCHED WHEN THERE IS NOTHING TO
    // FILL IN. Not a copy that happens to be equal - the same array. Callers
    // rely on "its own splits are left completely alone" meaning exactly that.
    const g = globals || []

    // ONE LOAN IS STILL ONE LOAN, AND IT IS THE BC'S TOTAL.
    //
    // 13 Oct 2026. Combining into one loan is a real decision - some lenders
    // you present as a single facility rather than six - so it stays. What it
    // must not be is a FROZEN number: the row used to keep whatever the splits
    // added up to on the day it was pressed, so a BC that moved afterwards left
    // this lender quoting an old total.
    //
    // Fabio, asked whether he ever shows a lender a different amount on
    // purpose: "That would be very rare". So it is added up every time.
    if (own.length === 1 && own[0].label === 'One loan' && g.length > 1) {
      const total = g.reduce((t, x) => t + money(x.amount), 0)
      const amount = total > 0 ? total.toLocaleString('en-AU') : ''
      if (own[0].amount === amount) return own
      return [{ ...own[0], amount }]
    }

    // OTHERWISE THE AMOUNT AND THE LABEL FOLLOW THE BC, AND THE PRICING DOES NOT.
    //
    // The last place a split amount could disagree with the borrowing capacity.
    // Each lender kept its own copy, taken once, and nothing re-took it - the
    // same fault that held the lending options at two splits while the BC went
    // to six, one level further down.
    //
    // The rate, the repayment, the repayment type and the IO years are this
    // lender's answers about this lender's product and are never touched.
    const at = (sp: LenderSplit, i: number) =>
      g.find(x => x.id && x.id === sp.id) || g[i]

    // AND THE LIST ITSELF IS HANDED BACK UNTOUCHED WHEN THERE IS NOTHING TO
    // CHANGE. Not a copy that happens to be equal - the same array. Callers
    // rely on "its own splits are left completely alone" meaning exactly that.
    const needs = own.some((sp, i) => {
      const x = at(sp, i)
      if (!x) return false
      return (x.amount || '') !== (sp.amount || '')
        || (x.label || '') !== (sp.label || '')
        || (!sp.securityId && !!(x.securityId || ''))
    })
    if (!needs) return own

    return own.map((sp, i) => {
      const x = at(sp, i)
      if (!x) return sp
      return {
        ...sp,
        label: x.label || sp.label,
        amount: x.amount || '',
        securityId: sp.securityId || x.securityId || '',
      }
    })
  }
  // Seeded from THIS lender's ticks, not from a fixed P&I - see seedFromGlobal.
  return seedFromGlobal(globals, lender as RateModuleHolder)
}

// --- the totals under each lender ------------------------------------------
//
// LVR is not a property of a split. Fabio, 2 Sep 2026: "dont calcualte LVR per
// split the LVR is alsways a sum of all splits /property value". The per-split
// LVR box invited three different answers to a question that has one, and
// nothing checked them against each other.
//
// It is calculated per LENDER, because a lender may lend a different total, and
// it is calculated rather than typed so the form and the email cannot disagree.

export function amountOf(v: any): number {
  return parseFloat(String(v ?? '').replace(/[^0-9.]/g, '')) || 0
}

export function lenderTotal(splits: LenderSplit[] | undefined | null): number {
  return (splits || []).reduce((sum, s) => sum + amountOf(s?.amount), 0)
}

// Rounded UP to one decimal, the way every other LVR in the portal is, so a hair
// over 80 reads as over 80 rather than being rounded down into "no LMI".
// Zero when there is no value to divide by - the caller leaves the line out
// rather than printing "LVR 0%".
export function lenderLvr(splits: LenderSplit[] | undefined | null, propertyValue: any): number {
  const value = amountOf(propertyValue)
  if (value <= 0) return 0
  return Math.ceil((lenderTotal(splits) / value) * 1000) / 10
}

// Fold a lender's splits into a single loan.
//
// Some lenders will not carve a refinance up the way the deal is structured -
// ubank on Clementine's file wanted one loan of $696,000 where the others took
// $666,000 plus a $30,000 equity access. There was no way to say that: the
// per-lender rows had no delete, so the only option was zeroing a split and
// leaving a $0 line in the client's email.
//
// The amounts add up, because that much is arithmetic. The rate and type carry
// over ONLY if every split already agreed on them - picking the first one when
// they differ would be inventing a rate. The repayment is always cleared: a
// merged loan has a new repayment and the old one is now wrong.
export function combineIntoOneLoan(splits: LenderSplit[] | undefined | null): LenderSplit[] {
  const rows = splits || []
  if (rows.length === 0) return []
  const allSame = (get: (s: LenderSplit) => string) => {
    const first = get(rows[0]) || ''
    return rows.every(s => (get(s) || '') === first) ? first : ''
  }
  const total = lenderTotal(rows)
  return [{
    id: rows[0].id,
    label: 'One loan',
    amount: total > 0 ? total.toLocaleString('en-AU') : '',
    lvr: '',
    rate: allSame(s => s.rate),
    repayment: '',
    repaymentType: allSame(s => s.repaymentType) || 'P&I',
  }]
}

// What the client is taking on top of what they already owe.
//
// The "Your numbers would be" block on a refinance printed "Loan Amount:
// $666,000" and "Existing Loan Balance: $666,000" - the same figure twice, with
// the $30,000 equity release nowhere. Fabio, 2 Sep 2026: "did you forget that we
// also need this section to have the euqity release same as BC".
//
// It is the total being borrowed less the loan being paid out, which is what new
// money means. Zero when there is none, so a plain refinance does not sprout an
// "Equity release: $0" line - and never negative: a client borrowing LESS than
// they owe is contributing cash, which is a different sentence and not one this
// block is trying to write.
// GONE, 16 OCT 2026, AND NOT TO BE WRITTEN AGAIN.
//
// It was `total lending - the one existing loan balance`. That held while a
// deal had one property and one balance box. Once a deal could be secured by
// several houses, that box held ONE of them - so on the Avard deal, a straight
// refinance of two properties releasing nothing:
//
//   lending  129,000 + 240,000 = 369,000
//   balance                      237,392   <- one house
//   printed to the client        131,608   of "Equity Release"
//
// Fabio: "LO is not only wrong showing equity, it is creating its own
// breakdown, when I said 10000 times LO doesn't create structure, BC holds
// that." The lending options email now reads balanceTotal() and releaseTotal()
// off the borrowing capacity - figures a person typed - and prints nothing
// where nothing was typed. See lib/complex-refinance.ts.
//
// The 2 Sep complaint this was built for is still answered: the release shows,
// because the BC records one. It is read rather than inferred.
