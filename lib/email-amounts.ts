// When a figure in a client email is the same figure said twice.
//
// On a refinance + equity release the BC form COPIES the existing loan balance
// into split 1 and the equity release amount into split 2 - see
// handleExistingLoanBalChange and handleEquityReleaseChange in BCForm. The email
// then printed both, so the client read $500,000 under "Existing loan balance"
// and $500,000 again under "Loan amount" directly beneath it, then $200,000
// twice more in the next card.
//
// Fabio, 2 Sep 2026: "all we need os equity release amount and exisitng loan
// amount".
//
// This lives in lib rather than in the route so it can be tested. The route
// builds the HTML; this decides whether there is anything to say.

export function moneyCents(v: any): number {
  return Math.round((parseFloat(String(v ?? '').replace(/[^0-9.]/g, '')) || 0) * 100)
}

// Is a split's loan amount worth printing next to the headline figure it was
// copied from?
//
// No when they agree - that is the same number under a second label. No when
// there is no amount at all - an empty row says nothing.
//
// YES when they differ, and that case matters: a broker can edit a split amount
// directly, and capitalised costs or LMI make the new loan bigger than the
// balance being paid out. Dropping the row then would leave the client reading
// their OLD balance as if it were their new loan - a worse bug than the one this
// is fixing.
export function showsOwnLoanAmount(headline: any, splitAmount: any): boolean {
  const s = moneyCents(splitAmount)
  if (s === 0) return false
  return s !== moneyCents(headline)
}
