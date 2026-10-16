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
import { monthlyRepaymentIO } from './refinance-calculations'

const txt = (v: any) => String(v ?? '').trim()

// WHAT IT COSTS A MONTH.
//
// The maths has been in this codebase, tested, since the refinance calculator
// was built. The email simply never called it and printed the word
// "[calculated]" instead, on every scenario, to every client.
//
// An amount, a rate and - for principal and interest - a term. Anything missing
// and there is no repayment to show, so the row does not appear at all.
// INTEREST ONLY IS THE ONLY REPAYMENT THIS PORTAL WORKS OUT.
//
// 16 Oct 2026. Fabio: "I was very specific that only IO repayments are to be
// calculated, why are you calculating P&I repayments?"
//
// He was specific, twice. On 16 Sep: "our typed repayments take over never
// calculate repayments" - which is why the client email reads the box first and
// lib/split-cards.ts opens with the story of the $2,912 that overwrote a typed
// $3,445. On 15 Oct, asked for repayments in the lender options: "if I select
// IO calculate IO repayments there as well." IO. Not both.
//
// I wired two new callers to this function the same week - the BC's repayment
// prefill and the lending options' lender splits - and neither of them asked
// about the type, because this function did not make them. So changing a split
// to P&I wrote the portal's own arithmetic into a box a broker types in. The
// exact fault of 16 Sep, rebuilt in the form instead of the email.
//
// WHY IO IS DIFFERENT, AND IT IS NOT A HALF-MEASURE. Interest only is balance x
// rate / 12. There is one answer and no assumption in it. A P&I repayment
// depends on the term, whether the IO period comes first, how the lender
// amortises and what it does with fees - so the portal's figure and the
// lender's disagree, and a broker then has to work out which of the two
// numbers in front of him is real.
//
// A P&I SPLIT WITH NOTHING TYPED PRINTS NO REPAYMENT ROW. The same rule every
// other missing figure on this page follows - see the note at the top of this
// file. lib/bc-ready.ts is where an empty box gets named before anybody sends.
//
// `years` is no longer read. It stays in the signature because every caller
// passes it and the day a lender's own amortisation lands here it is what that
// will need. monthlyRepaymentPI is still exported and still used - by
// repaymentMismatch in lib/split-cards.ts, which WARNS when a typed figure
// matches the other type's arithmetic and never writes anything.
export function estimatedRepayment(amount: any, rate: any, years: any, type: any): string {
  const principal = readMoney(amount)
  const r = readMoney(rate)
  if (principal === null || principal <= 0 || r === null || r <= 0) return ''

  if (!/interest only|^io$/i.test(txt(type))) return ''
  return money(Math.round(monthlyRepaymentIO(principal, r)))
}
