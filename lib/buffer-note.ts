// THE BUFFER IN THE LOAN AMOUNT, AND WHO IS TOLD ABOUT IT.
//
// "We have included a small buffer in the loan amount to cover your final
// repayment and any discharge fees..." - the sentence that explains why the new
// loan is a little larger than the balance being paid out.
//
// WHY THIS FILE EXISTS. The paragraph lived inside the lending options email
// and was switched off by one condition: the email template is not
// "LO Purchase". That is a label on an EMAIL deciding whether a client is told
// about their own loan amount - and when a refinance got stuck on the purchase
// template, the paragraph silently stopped going out. Nobody could have seen
// it: nothing is printed to say a paragraph was left out.
//
// Fabio, 12 Oct 2026: "why did that disaper form email templates", then "make
// sure it adds to all refinance tmeplates", then "lets make sure this doesnt
// happen again where we work on somthing and it doesnt ship".
//
// SO THE RULE IS NAMED, NOT INFERRED. Four scenarios, listed. Not "anything
// that is not a purchase", which is what it was and which is why debt
// recycling, buy and sell and bridging were all getting it.
//
// THOSE THREE ARE COMING OFF ON FABIO'S CALL, 12 Oct 2026. They print it today.
// This is a change to what goes out, not a tidy-up, and it is deliberate.
//
// AND THE SHIP WATCHES IT NOW. lib/the-buffer-note-goes-out.test.ts builds the
// client email for every scenario and fails if one on this list has lost the
// paragraph - the same shape as the RBA rate notice guard. A fifteenth template
// added next year and forgotten stops the ship instead of quietly shorting a
// client's settlement.

/** The scenarios where an existing loan is paid out and a buffer is added. */
export const BUFFERED_TEMPLATES = [
  'refinance_only',
  'refinance_equity',
  'investment_equity',
  'complex_refinance',
] as const

const txt = (v: unknown) => String(v ?? '').trim()

/** Does this scenario's client email carry the buffer note? */
export function hasBufferNote(template: unknown): boolean {
  return (BUFFERED_TEMPLATES as readonly string[]).includes(txt(template))
}

export const BUFFER_HEADING = 'About the loan amount'

export const BUFFER_TEXT =
  'We have included a small buffer in the loan amount to cover your final repayment and any ' +
  'discharge fees, so there is no shortfall at settlement. Any funds not required are credited ' +
  'back into your loan, so you are not charged interest on money you did not use.'

/**
 * The panel, for a client email.
 *
 * Every coloured area carries a bgcolor attribute as well as the CSS: Outlook
 * on Windows renders through Word, which paints a background only from the
 * attribute. scripts/check-email-html.sh fails the ship if that slips. See
 * lib/email-shell.ts.
 */
export function bufferNoteBlock(template: unknown): string {
  if (!hasBufferNote(template)) return ''
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px"><tr>
    <td width="4" bgcolor="#2DBEFF" style="background:#2DBEFF;width:4px;font-size:0;line-height:0">&nbsp;</td>
    <td bgcolor="#EEF6FD" style="background:#EEF6FD;padding:13px 15px">
      <p style="font-size:10px;font-weight:600;color:#0369a1;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 7px"><span style="color:#0369a1;">${BUFFER_HEADING}</span></p>
      <p style="font-size:12.5px;color:#334155;margin:0;line-height:1.65"><span style="color:#334155;">${BUFFER_TEXT}</span></p>
    </td></tr></table>`
}
