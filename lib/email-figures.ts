// THE FIGURES THE CLIENT EMAIL COULD NOT WORK OUT, AND PRINTED A GUESS FOR.
//
// Three things went out to Alexis Janes on 7 Sep 2026, in an email that
// otherwise looked finished:
//
//   Against [Property Address]         the BC's suburb box was empty
//   Existing loan balance              an empty row
//   Estimated repayments [calculated]  a figure nothing ever worked out,
//                                      because there is no box to type one in
//
// The first two are answered by leaving the line out and telling the broker,
// before he sends, which of his boxes are empty - see lib/bc-ready.ts. They are
// HIS boxes and the portal does not fill them in for him.
//
// The third is different: the repayment is arithmetic on figures he has already
// typed. That belongs here.

import { readMoney, money } from './money'
import { monthlyRepaymentPI, monthlyRepaymentIO } from './refinance-calculations'

const txt = (v: any) => String(v ?? '').trim()

// WHAT IT COSTS A MONTH.
//
// The maths has been in this codebase, tested, since the refinance calculator
// was built. The email simply never called it and printed the word
// "[calculated]" instead, on every scenario, to every client.
//
// An amount, a rate and - for principal and interest - a term. Anything missing
// and there is no repayment to show, so the row does not appear at all.
export function estimatedRepayment(amount: any, rate: any, years: any, type: any): string {
  const principal = readMoney(amount)
  const r = readMoney(rate)
  if (principal === null || principal <= 0 || r === null || r <= 0) return ''

  const interestOnly = /interest only|^io$/i.test(txt(type))
  if (interestOnly) return money(Math.round(monthlyRepaymentIO(principal, r)))

  const term = readMoney(years)
  if (term === null || term <= 0) return ''
  // monthlyRepaymentPI counts in MONTHS. The loan term on a BC is in years, and
  // handing it 30 instead of 360 produces a repayment roughly eleven times too
  // big - the kind of number a client would ring about.
  return money(Math.round(monthlyRepaymentPI(principal, r, term * 12)))
}
