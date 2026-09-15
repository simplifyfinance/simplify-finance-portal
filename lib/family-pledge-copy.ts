// THE FAMILY PLEDGE WORDING, IN ONE PLACE.
//
// Pure copy, no imports, so it can be tested without loading the email route
// and everything it drags in. Same reason as lib/next-steps-copy.ts.
//
// EVERY WORD HERE IS FABIO'S, including the punctuation and "your parent's".
// This goes to a client explaining what their parents are signing, and it is
// not mine to tidy up. Changing any of it is a decision, and the test beside
// this file fails if anybody does it by accident.
//
// 15 Sep 2026. Recovered from an old email he sent by hand, after the portal's
// family pledge template turned out never to have had it.

export const PLEDGE_PROS = [
  'No need for Lenders Mortgage Insurance, saving you money',
  'Helps you purchase a property sooner',
  "This new loan will not impact your parent's current interest rates or loan repayments with their bank",
  'Parents are not required to make any repayments on your loan (they are only providing a security guarantee)',
]

export const PLEDGE_CONS = [
  'If your parents choose to provide a guarantee, they will be signing a legal contract to repay the guaranteed amount. If you cannot meet repayments terms on your mortgage, the bank will seek to recover the debt from you first before seeking further action from guarantors.',
  'If your parents decide to borrow extra funds against their property, the guaranteed amount will reduce the equity they can access.',
  'If your parents decide to sell that particular property (while they still have a guarantee) we need the guarantee to be moved to another security.',
]

// Loan 2 is always the guaranteed one. Fabio, 15 Sep 2026, asked whether a deal
// could ever have three splits: "we can never have 3 splits". So this is stated
// rather than worked out.
export const PLEDGE_LOAN_1 = 'This loan is in your name, and you are responsible to make repayments.'
export const PLEDGE_LOAN_2 = "This loan is in your name, and you are responsible to make repayments, however, this amount will be guaranteed by your parent's property."

// Who the guarantee comes from. The BC offers these and lets anything else be
// typed; the email drops the answer into a sentence, so "Your parents" reads as
// "using your parents' property as security" and a name reads as "using John
// and Mary Smith's property as security".
export const GUARANTORS = ['Your parents', 'Your mother', 'Your father', 'Your parents-in-law']

export function guarantorPhrase(guarantor: string): string {
  const who = String(guarantor || '').trim()
  // Nothing chosen yet. The sentence still has to read properly, and "your
  // parents" is true of every one of these.
  if (!who) return "your parents'"
  // "Your parents" is the client's own word for them, so it stays lower case
  // mid-sentence. A name does not.
  const said = /^your\b/i.test(who) ? who.charAt(0).toLowerCase() + who.slice(1) : who
  // parents' - mother's - Smith's.
  return said.endsWith('s') ? `${said}'` : `${said}'s`
}
