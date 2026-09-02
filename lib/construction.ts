// The maths behind a construction scenario, in one place.
//
// Every figure on the construction email read splits[0] and stopped. A land +
// construction deal has TWO splits, so on a $1,000,000 land / $1,000,000 build
// with $800,000 lent against each, the client was told:
//
//   Loan amount       $800,000     - half of what is being lent
//   Deposit required  $1,240,000   - should be $440,000
//   LVR               40%          - should be 80%
//   Indicative rate   6.14% P&I    - the land split; the construction split's
//                                    6.39% interest only was nowhere in the email
//
// Fabio, 2 Sep 2026: "construction loan dopist needed is ignoring that we are
// also fuding construction under a loan so in this instance for exmaple should
// be 440K". His figure is the arithmetic below, which is how I know the rule:
// $2,040,000 total cost less $1,600,000 of total lending.

import { splitsTotal } from './deal-phase'

export type Split = { label?: string; amount?: string; rate?: string; type?: string; repayment?: string }

export function num(v: any): number {
  return parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')) || 0
}

// Land, the build contract, and the duty on the land. What the project costs.
export function totalCost(d: { landValue?: any; constructionCost?: any; stampDuty?: any }): number {
  return num(d.landValue) + num(d.constructionCost) + num(d.stampDuty)
}

// Every split, not the first one. This is the whole bug.
export function totalLending(splits: Split[] | undefined | null): number {
  return splitsTotal(splits) ?? 0
}

// The cash the client has to find. Never negative - a project lent more than it
// costs is a data entry error, and "-$40,000 to contribute" helps nobody.
export function fundsToContribute(d: any, splits: Split[] | undefined | null): number {
  return Math.max(0, Math.round(totalCost(d) - totalLending(splits)))
}

// Against the "as if complete" valuation - what the property is worth once it is
// built, which is the security the lender ends up holding. Fabio picked this
// basis on 2 Sep 2026 over the lower-of-cost-or-valuation alternative.
//
// Rounded UP to one decimal, the same way every other LVR in the portal is, so a
// hair over 80 shows as over 80 rather than being rounded into "no LMI".
export function constructionLvr(asIfCompleteValue: any, splits: Split[] | undefined | null): number {
  const value = num(asIfCompleteValue)
  if (value <= 0) return 0
  return Math.ceil((totalLending(splits) / value) * 1000) / 10
}

// What the client pays each month while the house is going up.
//
// The team types a repayment against each split and this adds them. Not
// calculated: Fabio, 2 Sep 2026, "dont calcualte repoayments alwasy once
// completed by the team". An indicative rate times a balance is a guess wearing
// a decimal point; the person writing the deal knows the real figure.
//
// Zero when nothing has been typed, so the row can be left out entirely rather
// than mailing a client "$0 / month".
export function repaymentDuringConstruction(splits: Split[] | undefined | null): number {
  return (splits || []).reduce((sum, s) => sum + num(s?.repayment), 0)
}

// Why that figure is the ceiling and not the starting point. It sits inside the
// card directly under the repayment row, because a caveat a paragraph away from
// the number it qualifies is a caveat nobody reads.
export const DRAWDOWN_NOTE =
  'Repayments during construction are interest only on the amount drawn so far, ' +
  'so they start well below the figure above and increase with each progress payment. ' +
  'The figure shown is at full drawdown.'
