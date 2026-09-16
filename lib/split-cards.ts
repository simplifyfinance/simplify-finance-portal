// ONE CARD PER SPLIT, AND THE REPAYMENT THE BROKER ACTUALLY TYPED.
//
// Fabio, 16 Sep 2026, on Arvind Mane: "BC form states repayment 3445 when we
// generate html a number 2912 is coming across where the fuck is that number
// from also when I add a second split no details come across???"
//
// TWO FAULTS, BOTH IN THE CLIENT EMAIL.
//
// 1. THE REPAYMENT WAS NEVER READ. Every template called estimatedRepayment()
//    and worked the figure out again from the amount, the rate and the type -
//    560,000 x 6.24% / 12 = $2,912 - while the Repayment box on the BC held
//    $3,445. The portal was overwriting a number a human had typed with its own
//    arithmetic, silently, on every send. Fabio: "our typed repayments take over
//    never calculate repayments."
//
// 2. SPLITS AFTER THE FIRST WERE DROPPED. Most templates were hand-written
//    around `splits[0]` and nothing else, so adding a second split changed
//    nothing about the email and said nothing about being ignored. The same bug
//    was found and fixed for the family pledge template on 15 Sep - and only for
//    that template. Six others had it, and four more had fixed slots that break
//    on one split more than they were written for.
//
// Everything a split card says now comes from here, so no template can go back
// to inventing its own answer.

import { money, readMoney } from './money'
import { estimatedRepayment } from './email-figures'
import { showsOwnLoanAmount } from './email-amounts'
import { monthlyRepaymentIO, monthlyRepaymentPI } from './refinance-calculations'

const txt = (v: any) => String(v ?? '').trim()

export type Split = {
  label?: string
  amount?: any
  rate?: any
  type?: any
  repayment?: any
  // How many years the interest-only period runs for. Recorded on the BC split
  // beside the repayment type - see repaymentTypeLine below for why the loan
  // term on its own was actively misleading.
  ioYears?: any
  // What is owed on THIS property today. Fabio, 16 Sep 2026, on a refinance with
  // two splits: "each split is its own property and loan". The deal-level
  // existingLoanBal stays exactly what it was and everything else still reads it;
  // this is per split, optional, and only the split's own card uses it.
  existingBalance?: any
  [k: string]: any
}

export const isInterestOnly = (type: any) => /interest only|^io$/i.test(txt(type))

// THE REPAYMENT. Typed wins, always. Nothing here may overwrite it.
export function repaymentOf(split: Split | undefined, loanTerm: any): string {
  const typed = money(split?.repayment)
  if (typed) return typed
  // Nobody typed one. Working it out is the only way to show a figure at all,
  // and an empty box still means no row - see estimatedRepayment().
  return estimatedRepayment(split?.amount, split?.rate, loanTerm, split?.type)
}

// P&I TYPED AGAINST AN INTEREST ONLY SPLIT, OR THE OTHER WAY ROUND.
//
// Arvind's $3,445 is the P&I repayment for $560,000 at 6.24% over 30 years. The
// type on that split says Interest only, which is $2,912. One of the two is
// wrong and only the broker can say which.
//
// This fires ONLY when the typed figure lands on the other repayment type's
// arithmetic. A broker typing the lender's own number - which is neither - is
// not second-guessed, because that is the number they meant.
export type RepaymentMismatch = { typed: number; thisType: number; looksLike: string; thisLabel: string }

export function repaymentMismatch(split: Split | undefined, loanTerm: any): RepaymentMismatch | null {
  const typed = readMoney(split?.repayment)
  const principal = readMoney(split?.amount)
  const rate = readMoney(split?.rate)
  const years = readMoney(loanTerm)
  if (!typed || !principal || !rate || principal <= 0 || rate <= 0) return null

  const io = monthlyRepaymentIO(principal, rate)
  const pi = years && years > 0 ? monthlyRepaymentPI(principal, rate, years * 12) : null
  if (pi === null) return null

  const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(5, b * 0.01)
  const onIO = isInterestOnly(split?.type)
  const mine = onIO ? io : pi
  const other = onIO ? pi : io

  if (near(typed, mine)) return null
  if (!near(typed, other)) return null   // their own figure. Not ours to question.
  return {
    typed,
    thisType: Math.round(mine),
    looksLike: onIO ? 'principal and interest' : 'interest only',
    thisLabel: onIO ? 'interest only' : 'principal and interest',
  }
}

// THE SPLIT BALANCES AGAINST THE DEAL'S OWN. Advisory, like the deposit check in
// the funds strip - it names a disagreement and changes nothing.
export function balancesDisagree(splits: Split[], dealBalance: any): { parts: number; deal: number } | null {
  const filled = (splits || []).filter(s => readMoney(s?.existingBalance) !== null)
  if (filled.length === 0) return null
  const deal = readMoney(dealBalance)
  if (deal === null || deal <= 0) return null
  const parts = filled.reduce((t, s) => t + (readMoney(s.existingBalance) || 0), 0)
  return Math.abs(parts - deal) <= 1 ? null : { parts: Math.round(parts), deal: Math.round(deal) }
}

// THE CARD TITLE.
//
// One split: the template's own name, plus the broker's label where they have
// typed something of their own. "Refinanced Loan — 17 Dennington Lane Chelsea
// VIC". A deal left on the default label reads exactly as it did before.
//
// Two or more: "Split 1 — <label>", because now there is something to tell them
// apart from. Fabio chose this on 16 Sep: a single loan never says "Split 1".
export function cardTitle(split: Split | undefined, index: number, total: number, templateName: string): string {
  const label = txt(split?.label)
  if (total > 1) return label ? `Split ${index + 1} — ${label}` : `Split ${index + 1}`
  if (!label) return templateName
  // The broker left the default label alone: saying it twice is not information.
  if (label.toLowerCase() === templateName.toLowerCase()) return templateName
  return `${templateName} — ${label}`
}

// The line above the cards. It counts, so nobody has to keep it in step by hand.
const WORDS = ['', 'one part', 'two parts', 'three parts', 'four parts', 'five parts']
export function structureLead(total: number): string {
  if (total <= 1) return 'Here is a breakdown of the structure:'
  return `Your lending would be set up in ${WORDS[total] || `${total} parts`}:`
}

// THE ROWS INSIDE A CARD. Identical on every card, in this order, so two cards on
// one email cannot describe the same things differently - which is exactly what
// Fabio caught: "split 1 existing loan balance but 2 loan amount, consistency
// please, both should say existing loan balance."
export type Pair = { label: string; value: string }

// "INTEREST ONLY OVER 30 YEARS" WAS TELLING CLIENTS THE WRONG THING.
//
// That is what the email said, and it reads as thirty years of interest only. It
// never was: 30 is the loan term, and the interest-only period is a few years at
// the front of it. Fabio, 16 Sep 2026, after an audit of where the IO period is
// recorded - it was in Lending Options and nowhere else, so the BC, the one place
// a client first hears about interest only, could not say how long it lasted.
//
// Now: with the years recorded, it says both halves. Without them, it says
// "Interest only" and stops - because the loan term is not the answer to "how
// long", and printing it there was worse than saying nothing.
export function repaymentTypeLine(split: Split | undefined, loanTerm: any, withTerm?: boolean): string {
  const type = txt(split?.type)
  if (!type) return ''

  if (!isInterestOnly(type)) {
    return withTerm && txt(loanTerm) ? `${type} over ${txt(loanTerm)} years` : type
  }

  const io = readMoney(split?.ioYears)
  if (!io || io <= 0) return type

  const term = readMoney(loanTerm)
  const rest = term && term > io ? term - io : null
  // "for 3 years, then principal and interest for 27" - Fabio's wording, 16 Sep
  // 2026. The unit is said once; repeating it on the second half reads like a
  // form rather than a sentence.
  const years = (n: number) => `${n} ${n === 1 ? 'year' : 'years'}`
  return rest
    ? `Interest only for ${years(io)}, then principal and interest for ${rest}`
    : `Interest only for ${years(io)}`
}

export type SplitRowOptions = {
  showTerm?: boolean
  // "P&I over 30 years" on one line, the way the purchase templates already
  // write it, instead of a separate Loan term row.
  termWithType?: boolean
  // "New loan amount" on a refinance, plain "Loan amount" on a purchase.
  amountLabel?: string
  // The DEAL's existing balance, used only where the split carries none of its
  // own. A one-split refinance therefore reads exactly as it did before this
  // file existed, with no box for anybody to fill in.
  existingFallback?: any
}

export function splitRows(split: Split | undefined, loanTerm: any, opts?: SplitRowOptions): Pair[] {
  if (!split) return []
  const out: Pair[] = []
  const add = (label: string, value: string) => { if (value) out.push({ label, value }) }

  const existing = readMoney(split.existingBalance) !== null ? split.existingBalance : opts?.existingFallback
  add('Existing loan balance', money(existing))

  // THE SAME NUMBER UNDER A SECOND LABEL IS NOT INFORMATION.
  //
  // The BC copies the existing balance into split 1, so on a straight refinance
  // the new loan and the balance being paid out are the same figure. Fabio,
  // 2 Sep 2026: "all we need is equity release amount and existing loan amount."
  // It reappears the moment they differ - capitalised costs, LMI, or a broker
  // editing the split - because hiding it then would leave the client reading
  // their OLD balance as their new loan. See lib/email-amounts.ts.
  if (showsOwnLoanAmount(existing, split.amount) || readMoney(existing) === null) {
    add(opts?.amountLabel || 'Loan amount', money(split.amount))
  }

  add('Indicative rate', txt(split.rate) ? `${txt(split.rate)}% p.a.*` : '')
  add('Estimated repayments', repaymentOf(split, loanTerm))
  add('Repayment type', repaymentTypeLine(split, loanTerm, opts?.termWithType))
  if (opts?.showTerm) add('Loan term', txt(loanTerm) ? `${txt(loanTerm)} years` : '')
  return out
}

// Splits worth printing: anything with a figure or a name on it. An untouched
// blank row is not a part of the loan.
export function realSplits(splits: any): Split[] {
  return (Array.isArray(splits) ? splits : []).filter(
    (s: any) => readMoney(s?.amount) !== null || txt(s?.label))
}
