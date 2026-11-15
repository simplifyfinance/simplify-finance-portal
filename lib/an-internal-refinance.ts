// A REFINANCE THAT NEVER LEAVES THE LENDER.
//
// 17 Nov 2026. The Deposit & equity box on an internal refinance read:
//
//   "This is a refinance of the existing debt dollar for dollar. No deposit or
//    contribution is required, as the new lending of $398,200 replaces the
//    existing balance of $57,200 being paid out. The clients have sufficient
//    equity in the security to proceed and are comfortable with the level of
//    exposure against the asset. The loan to value ratio is 56.9%."
//
// Sixty words, and one of the figures in them was wrong. Fabio's broker cut it
// to a sentence:
//
//   "Sufficient equity is held in the property to complete this internal
//    refinance application which will be evidenced by a lender valuation
//    report."
//
// He is right about why. Nothing is changing hands and nothing is moving: the
// loan stays with the lender it is already with, at a new number. There is no
// deposit to describe and no payout to describe, because nobody is being paid
// out - the lender is replacing its own loan.
//
// ---------------------------------------------------------------------------
// AND THE FIGURE THAT WAS WRONG
// ---------------------------------------------------------------------------
//
// $57,200 came off the "owes now" box on the borrowing capacity - one box per
// security, typed by hand, with the fact find's own figure sitting behind it as
// a grey placeholder. The fact find recorded $395,899.35 owing on that same
// house. Nothing compared the two, and the difference printed into a document
// that goes to a lender.
//
// Fabio: "Remove the inconsistency." So where the typed payout and the recorded
// balance disagree, the note does not assert either of them - it says nothing
// and the disagreement goes on the list above the note.
import { securitiesOf } from './box-security'
import { refinancedDebt } from './funds-to-complete'
import { readMoney } from './money'
import { dealRow } from './deal-structure'

const txt = (v: any) => String(v ?? '').trim()
const num = (v: any) => readMoney(v) ?? 0

/** Two lender names are the same lender. Spacing, case and "Bank of" noise. */
export function sameLenderName(a: any, b: any): boolean {
  const k = (v: any) => txt(v).toLowerCase().replace(/[^a-z0-9]/g, '')
  const x = k(a)
  const y = k(b)
  if (!x || !y) return false
  return x === y || x.startsWith(y) || y.startsWith(x)
}

/**
 * IS THIS LOAN STAYING WHERE IT IS?
 *
 * Every security being refinanced is already mortgaged to the lender the deal
 * is going to. One security with a different mortgagee on it, or one whose
 * mortgagee nobody recorded, and this is false - because then something IS
 * moving and the full paragraph is the honest one.
 */
export function isInternalRefinance(deal: any): boolean {
  const to = txt(dealRow(deal).lender)
  if (!to) return false
  const secured = securitiesOf(deal).filter(s => s.kind === 'existing')
  if (secured.length === 0) return false
  return secured.every(s => sameLenderName(s.mortgagee, to))
}

export const INTERNAL_REFINANCE =
  'Sufficient equity is held in the property to complete this internal refinance '
  + 'application which will be evidenced by a lender valuation report.'

/** What the fact find says is owing on the securities being refinanced. */
export function recordedOwing(deal: any): number {
  return securitiesOf(deal)
    .filter(s => s.kind === 'existing')
    .reduce((t, s) => t + num(s.owing), 0)
}

export type PayoutCheck = { typed: number; recorded: number; agree: boolean }

/**
 * THE TYPED PAYOUT AGAINST THE RECORDED BALANCE.
 *
 * A dollar of rounding is not a disagreement. Anything more is, and the note
 * then prints no payout figure at all rather than printing one of two numbers
 * that contradict each other on a document a lender reads.
 *
 * Either figure being zero means there is nothing to compare - a deal with no
 * recorded balances is a gap somewhere else, not a contradiction here.
 */
export function payoutAgrees(deal: any): PayoutCheck {
  const typed = refinancedDebt(deal)
  const recorded = recordedOwing(deal)
  const agree = typed <= 0 || recorded <= 0 || Math.abs(typed - recorded) <= 1
  return { typed, recorded, agree }
}
