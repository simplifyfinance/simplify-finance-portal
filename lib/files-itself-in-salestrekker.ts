// EVERY CLIENT EMAIL FILES ITSELF AGAINST THE DEAL.
//
// 22 Oct 2026, Fabio: "the BCC function ... I want that ALWAYS bcced to every
// email tempalte or otherwsie communicated out of the portal as this updates
// Salestrekket automatically".
//
// WHAT THE AUDIT FOUND. Two of eleven. The borrowing capacity and the lending
// options carried the code because they are the two oldest emails here and
// somebody wired them by hand. Everything built since - the pre-approval, the
// extension, the formal approval, the offer accepted, the final check-in, the
// next steps - went to the client and filed nowhere.
//
// It was not forgetfulness on each route. Each one writes its own fetch to
// Resend and there was no shared answer to "what should this BCC". So this file
// is that answer, and lib/every-client-email-files-itself.test.ts is the guard
// that keeps new ones from being written without it.
//
// INTERNAL NOTIFICATIONS ARE NOT IN SCOPE, by his decision the same day: "no
// internal notifications just emails to clients". A card should hold what the
// client was told, not "Alan, your team is above average workload".

const txt = (v: any) => String(v ?? '').trim()

/**
 * THE DEAL'S OWN BCC, OR NOTHING.
 *
 * `redirected` is a test deal, where the email is turned round to the sender
 * instead of the client. A test must never reach a real client's SalesTrekker
 * card, so it files nowhere - which is the same answer the subject line already
 * gives by marking itself as a test.
 */
export function bccForDeal(deal: any, opts: { redirected?: boolean } = {}): string[] {
  if (opts.redirected) return []
  const code = txt(deal?.salestrekker_bcc)
  return code ? [code] : []
}

/**
 * WHY THIS EMAIL WILL NOT FILE ITSELF, in a sentence for the send screen.
 *
 * A deal with no code sends perfectly and files nowhere, and nothing says so -
 * which is the quiet version of the fault above. Empty when there is nothing
 * wrong, so it sits with the other problems the screen already lists.
 */
export function bccGap(deal: any, opts: { redirected?: boolean } = {}): string {
  if (opts.redirected) return ''
  if (txt(deal?.salestrekker_bcc)) return ''
  return 'No SalesTrekker BCC code is recorded on this deal, so this email will not file itself '
    + 'against the card. Add it under SalesTrekker & links.'
}
