// THE LOAN, AS IT ACTUALLY IS ONCE AN OFFER IS ACCEPTED.
//
// 21 Oct 2026. Belle, working a real deal: "Can we please add a bit to include
// the new rate - most cases that will change if the LVR position is different
// or rates go up or down."
//
// She was right and there was nothing to add it to. The offer accepted step
// held the price, the deposit, the duty and the loan AMOUNT, and nothing about
// the loan itself. So the offer accepted email - which quotes a rate to a
// client in writing - had to read the product the PRE-APPROVAL was built on.
//
// THE LENDING OPTION IS A STARTING POINT, NOT A YARDSTICK.
//
// Fabio, 21 Oct 2026: "NEVER care of LO says remeber the figures will almost
// always be diffeerent! we dont care we care how we move forward to updating
// details not the LO."
//
// So these read the deal's own answer where there is one and seed from the
// lending option where there is not. Nothing here compares the two, and
// nothing reports a difference: the figures moving is the normal case.
//
// THE REPRICING CHECK IS A DIFFERENT THING AND IS NOT HERE. It compares the
// old loan AMOUNT with the new one because that is the lender's own rule - see
// lib/offer-accepted-panel.ts. It has nothing to do with this file.

import { optionOnTheDeal } from './client-agreement'
import { splitsOf, isInterestOnly } from './deal-structure'
import { loanAmount } from './funds-to-complete'
import { minimumRepayment } from './repayment-analysis'

const txt = (v: any) => String(v ?? '').trim()
const n = (v: any): number => {
  const x = Number(String(v ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(x) && x > 0 ? x : 0
}

export const INTEREST_ONLY = 'Interest only'
export const PRINCIPAL_AND_INTEREST = 'Principal and interest'
export const REPAYMENT_TYPES = [INTEREST_ONLY, PRINCIPAL_AND_INTEREST] as const

export type LoanNow = {
  product: string
  /** Percent, as a number. 6.74 */
  rate: number
  termYears: number
  repaymentType: string
  /** Only on interest only. 0 means none recorded. */
  ioYears: number
}

// THE DROPDOWN ASKS TWO QUESTIONS' WORTH OF ANSWER AND ONLY WANTS ONE.
//
// A split's repayment type is one of P&I, IO, Fixed P&I, Fixed IO - see
// SPLIT_TYPES in lib/lo-splits.ts. Fixed or variable is part of the PRODUCT,
// which has its own box above. This one asks how the loan is repaid, so the
// four fold into two.
//
// Seeding 'Fixed IO' into a two-option dropdown would draw the first option
// while holding something else, which is the exact fault lib/lo-splits.ts was
// written to stop. isInterestOnly() is the portal's one rule for the question;
// it is not restated here.
function normaliseType(raw: any): string {
  const t = txt(raw)
  if (!t) return ''
  return isInterestOnly(t) ? INTEREST_ONLY : PRINCIPAL_AND_INTEREST
}

/**
 * WHAT THE LENDING OPTION WOULD HAVE SAID.
 *
 * Only ever used to fill the boxes in the first time somebody opens them, so
 * nobody retypes five things the portal already knows. After that the deal's
 * own answer wins, including where somebody has deliberately cleared one.
 */
export function seedFrom(deal: any): LoanNow {
  const option = optionOnTheDeal(deal?.lo_data || {}) || {}

  // THE DEAL STRUCTURE, NOT THE LENDER'S OWN SPLIT LIST.
  //
  // splitsOf() is the answer every compliance box already reads, and it has
  // four falls built into it that a second copy here would not: the borrowing
  // capacity owns the shape, the lending option supplies the rate,
  // compliance_data.splitDetail supplies the term and the interest only years,
  // and bc_data.loanTerm is the last word on a deal that never filled the rest.
  //
  // My first draft read the per-lender splits directly and asked them for a
  // term. They do not carry one - LenderSplit has no termYears at all - so the
  // box would have opened blank on every deal in the book. See lib/lo-splits.ts
  // for the shape and lib/deal-structure.ts for what splitsOf() settles.
  const first = (splitsOf(deal) || [])[0] || {}
  const type = normaliseType(first?.repaymentType)

  return {
    product: txt(option?.productName) || txt(first?.productType),
    rate: n(first?.rate),
    termYears: n(first?.termYears),
    repaymentType: type,
    ioYears: type === INTEREST_ONLY ? n(first?.ioYears) : 0,
  }
}

/** The answer. The deal's own where there is one, the lending option where not. */
export function loanNow(deal: any): LoanNow {
  const seed = seedFrom(deal)
  const type = normaliseType(deal?.offer_repayment_type) || seed.repaymentType
  return {
    product: txt(deal?.offer_product) || seed.product,
    rate: n(deal?.offer_rate) || seed.rate,
    termYears: n(deal?.offer_term_years) || seed.termYears,
    repaymentType: type,
    // A P&I loan has no interest only years, whatever is in the column from
    // before somebody changed the type.
    ioYears: type === INTEREST_ONLY ? (n(deal?.offer_io_years) || seed.ioYears) : 0,
  }
}

/**
 * THE MONTHLY REPAYMENT, WORKED OUT RATHER THAN STORED.
 *
 * Fabio, 21 Oct 2026: "we do repaymetns again always good to redo things to
 * ensure correct plus rates can chnge".
 *
 * AND NEVER ON AN ASSUMED TERM. His fear, in his words: "my fear is you always
 * using 30 years on your calculations". So a loan with no term recorded gets
 * no figure at all - the email leaves the line out rather than printing one
 * built on a number nobody typed.
 *
 * Interest only is the balance times the rate, over twelve. Principal and
 * interest goes through minimumRepayment, which is the same function behind
 * the repayment analysis and matches the calculator on our own website to the
 * dollar.
 */
export function monthlyRepayment(deal: any): number | null {
  const now = loanNow(deal)
  const balance = n(loanAmount(deal))
  if (balance <= 0 || now.rate <= 0) return null

  if (isInterestOnly(now.repaymentType)) {
    // The term does not enter an interest only repayment at all: nothing is
    // coming off the balance, so there is nothing for a term to spread.
    return Math.round((balance * (now.rate / 100)) / 12)
  }

  // THE TERM IS COMPULSORY HERE AND THERE IS NO DEFAULT.
  if (now.termYears <= 0) return null
  const monthly = minimumRepayment(balance, now.rate, now.termYears * 12)
  return Number.isFinite(monthly) && monthly > 0 ? Math.round(monthly) : null
}

/** "Interest only — 3 years", or "Principal and interest". */
export function repaymentWords(deal: any): string {
  const now = loanNow(deal)
  const type = txt(now.repaymentType)
  if (!type) return ''
  if (!isInterestOnly(type)) return type
  return now.ioYears > 0 ? `${type} — ${now.ioYears} ${now.ioYears === 1 ? 'year' : 'years'}` : type
}

/** "6.74%", or nothing. Never a bare number and never a zero. */
export function rateWords(deal: any): string {
  const r = loanNow(deal).rate
  if (r <= 0) return ''
  // Trailing zeros off: 6.74, 6.5, 7 - the way a person writes a rate.
  return `${String(Number(r.toFixed(3)))}%`
}

/** "30 years", or nothing. */
export function termWords(deal: any): string {
  const y = loanNow(deal).termYears
  return y > 0 ? `${y} ${y === 1 ? 'year' : 'years'}` : ''
}

/**
 * THE LOAN DETAILS BLOCK, FROM THE DEAL'S OWN ANSWER.
 *
 * The same shape loanDetails() hands back in lib/milestone-figures.ts, so the
 * emails that print it do not care which one they were given. A line with
 * nothing recorded is left out: six labels and three answers reads as a broken
 * email.
 */
export function loanDetailsNow(deal: any): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  const add = (label: string, value: string) => { if (txt(value)) out.push({ label, value }) }
  const now = loanNow(deal)
  add('Product', now.product)
  add('Interest rate', rateWords(deal))
  add('Repayments', repaymentWords(deal))
  add('Loan term', termWords(deal))
  const monthly = monthlyRepayment(deal)
  add('Monthly repayment', monthly === null ? '' : `$${monthly.toLocaleString('en-AU')}`)
  return out
}
