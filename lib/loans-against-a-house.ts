// THE LOANS AGAINST ONE HOUSE. ONE ANSWER, EVERY SCENARIO.
//
// 12 Nov 2026, Karen Terry. Her Pindari house carries two loans, $565,000 and
// $192,000. Fabio: "there is a split missing from the HTML email." It was not
// missing. It was printed like this, underneath the loan term:
//
//     Loan term                        30 years
//     21 Pindari Drive South Penrith   $192,000
//
// A loan wearing the house's name, in the place where no money belongs, below a
// row that said "New loan amount $757,000" - which was not a loan amount at all
// but the two of them added together.
//
// THE ROOT CAUSE WAS TWO ANSWERS TO ONE QUESTION, AGAIN.
//
//   refinanceBoxes()  took splits[0], inlined it into the card's own rows, and
//                     appended splits.slice(1) as bare label rows at the foot
//   equityBoxes()     listed every split the same way under the property
//
// The same data, the same question - how do I show the loans against this house
// - and two different layouts, because each builder worked it out for itself. A
// house with two loans is ordinary on an equity release and rare on a straight
// refinance, so the weaker of the two was the one nobody ever looked at.
//
// This is the same shape as the Le-Vo security bug of 13 Nov. See
// lib/one-security-rule.test.ts. The guard is the same: one function, and every
// caller asks it.
//
// AND THE SECOND CAUSE, WHICH IS WORTH SAYING ON ITS OWN. The old card used the
// typed Label box to tell a reader that a row was a loan. Katie named both of
// Karen's splits after the house, which is a perfectly reasonable thing to
// type, and the row came out looking like a property. A LABEL BOX MUST NEVER
// DECIDE WHETHER A LOAN IS VISIBLE. This file numbers them itself.
import { money, moneyIf } from '@/lib/money'
import { row } from '@/lib/email-card'
import { repaymentOf, repaymentTypeLine } from '@/lib/split-cards'

const txt = (v: any) => String(v ?? '').trim()

function rowIf(label: string, value: string): string {
  return value ? row(label, value) : ''
}

// A heading inside the card, above one loan's rows. Full width, its colour
// carried on a span because Word drops a colour set on a cell - the same rule
// as every other piece of text in these emails. See lib/email-card.ts.
export function loanHeading(text: string): string {
  return `<tr><td colspan="2" style="font-size:11px;font-weight:700;color:#7a5c3a;`
    + `text-transform:uppercase;letter-spacing:0.4px;padding:11px 0 2px;`
    + `border-top:1px solid #DCCDB6"><span style="color:#7a5c3a;">${text}</span></td></tr>`
}

/**
 * IS THIS LABEL JUST THE HOUSE AGAIN?
 *
 * "21 Pindari Drive South Penrith" against a card headed "21 Pindari Drive
 * South Penrith NSW 2750" tells a client nothing they are not already reading
 * two lines above. A real name - "equity release", "renovation" - does, and is
 * kept.
 *
 * Compared loosely on purpose: one side carries the postcode and the state and
 * the other does not, and neither is wrong.
 */
export function namesTheHouse(label: any, property: any): boolean {
  const flat = (v: any) => txt(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const a = flat(label), b = flat(property)
  if (a.length < 8 || b.length < 8) return false
  return a === b || b.startsWith(a) || a.startsWith(b)
}

/** "Loan 2", or "Loan 2 — equity release" where somebody named it usefully. */
export function titleForLoan(index: number, split: any, property: any): string {
  const label = txt(split?.label)
  const useful = label && !namesTheHouse(label, property)
  return useful ? `Loan ${index + 1} — ${label}` : `Loan ${index + 1}`
}

/** The five rows every loan gets, in the same order, on every scenario. */
export function oneLoanRows(split: any, loanTerm: any, amountLabel = 'New loan amount'): string {
  return rowIf(amountLabel, moneyIf(split?.amount))
    + rowIf('Indicative rate', txt(split?.rate) ? `${txt(split.rate)}% p.a.*` : '')
    // THE TYPED BOX WINS over the portal's own arithmetic. Fabio, 16 Sep 2026:
    // "our typed repayments take over never calculate repayments."
    + rowIf('Estimated repayments', repaymentOf(split, loanTerm))
    + rowIf('Repayment type', repaymentTypeLine(split, loanTerm) || txt(split?.type))
    + rowIf('Loan term', txt(loanTerm) ? `${txt(loanTerm)} years` : '')
}

export type TotalLabels = {
  /** What the figure is called when the house carries exactly one loan. */
  one: string
  /** What it is called when it is a sum. Never "New loan amount". */
  many: string
}

/**
 * EVERY LOAN AGAINST ONE HOUSE, AND WHAT THEY COME TO.
 *
 * ONE LOAN LOOKS EXACTLY AS IT ALWAYS HAS. No numbering and no total line -
 * numbering a single loan would make every ordinary refinance, which is most of
 * them, look as though something had gone missing. This matters more than the
 * case it is being written for.
 *
 * MORE THAN ONE gets the total named as a total, then each loan under its own
 * heading with the same five rows. Nothing is squeezed onto one line and
 * nothing depends on what was typed in a Label box.
 */
export function loansAgainst(g: any, loanTerm: any, labels: TotalLabels): string {
  const splits = Array.isArray(g?.splits) ? g.splits : []
  const total = Number(g?.limit) > 0 ? g.limit : g?.drawn

  if (splits.length <= 1) {
    // NOT splits[0]. There is only one, so there is no position to read - and
    // scripts/check-split-position.sh is right to refuse the habit even here.
    // Reading a split by where it sits is what sent four deals out wrong in
    // October. See lib/one-answer-to-which-split-buys-it.test.ts.
    const [only = {}] = splits
    // The house's total and the only loan's amount are the same figure here, so
    // it is printed once, from the group, exactly as before.
    return rowIf(labels.one, moneyIf(total))
      + rowIf('Indicative rate', txt(only?.rate) ? `${txt(only.rate)}% p.a.*` : '')
      + rowIf('Estimated repayments', repaymentOf(only, loanTerm))
      + rowIf('Repayment type', repaymentTypeLine(only, loanTerm) || txt(only?.type))
      + rowIf('Loan term', txt(loanTerm) ? `${txt(loanTerm)} years` : '')
  }

  return rowIf(labels.many, moneyIf(total))
    + splits.map((sp: any, i: number) =>
        loanHeading(titleForLoan(i, sp, g?.property)) + oneLoanRows(sp, loanTerm)).join('')
}
