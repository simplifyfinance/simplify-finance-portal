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

// ---------------------------------------------------------------------------
// THE ADDRESS, CLEANED AND CHECKED BEFORE IT GOES ANYWHERE NEAR THE MAIL
// ---------------------------------------------------------------------------
//
// 27 Oct 2026. Fabio, on a final check-in that would not send: "It wont let me
// send this for some reason". Resend answered:
//
//   Invalid `bcc` field. The email address needs to follow the
//   `email@example.com` or `Name <email@example.com>` format.
//
// AND IT TOOK THE WHOLE EMAIL DOWN WITH IT. The BCC is a filing copy for our
// own system. The thing in the To field is a person waiting to hear from us.
// Refusing to write to the client because our filing copy is malformed is the
// wrong way round, and it is the part of this that is indefensible.
//
// TWO THINGS WRONG WITH THE ADDRESSES THEMSELVES, found in the data:
//
//   174 deals  a base32 address SalesTrekker generates, 74 characters before
//              the @. RFC 5321 allows 64. Outlook accepts it, which is why the
//              BC and the lending options file correctly - those open Outlook.
//              Resend checks, and refuses.
//   100 deals  "r01187p12". A SalesTrekker reference number with no @ in it at
//              all. Never an email address, so never sendable.
//
// cleanBcc strips whitespace and control characters - a code pasted out of
// SalesTrekker can arrive with a newline on the end, and Postgres trim() does
// not remove those, so one could sit in the column looking perfect.

export function cleanBcc(v: any): string {
  // Every kind of space, and anything below 0x20. A single stray newline is
  // enough for a mail API to refuse the address.
  return String(v ?? '').replace(/[\s\u00a0\u200b-\u200d\ufeff]/g, '')
}

export type BccProblem = 'none' | 'empty' | 'not-an-address' | 'too-long'

/**
 * CAN THIS BE HANDED TO A MAIL PROVIDER AT ALL?
 *
 * Not a full address validator - that is the provider's job and it will have
 * its own opinion. These are the two shapes that are definitely refused, and
 * both of them are sitting in the book right now.
 */
export function bccProblem(v: any): BccProblem {
  const a = cleanBcc(v)
  if (!a) return 'empty'
  const at = a.indexOf('@')
  if (at < 1 || at !== a.lastIndexOf('@') || at === a.length - 1) return 'not-an-address'
  if (!a.slice(at + 1).includes('.')) return 'not-an-address'
  // RFC 5321: 64 octets for the local part, 254 for the whole address.
  if (at > 64 || a.length > 254) return 'too-long'
  return 'none'
}

export function bccIsSendable(v: any): boolean {
  return bccProblem(v) === 'none'
}

/**
 * THE DEAL'S OWN BCC, OR NOTHING.
 *
 * `redirected` is a test deal, where the email is turned round to the sender
 * instead of the client. A test must never reach a real client's SalesTrekker
 * card, so it files nowhere - which is the same answer the subject line already
 * gives by marking itself as a test.
 *
 * AND AN UNSENDABLE ADDRESS IS NOTHING, RATHER THAN A REFUSED EMAIL. The
 * client hears from us either way. Whether it filed is said out loud by
 * bccGap() below, on the screen, before the send.
 */
export function bccForDeal(deal: any, opts: { redirected?: boolean } = {}): string[] {
  if (opts.redirected) return []
  const code = cleanBcc(deal?.salestrekker_bcc)
  return code && bccIsSendable(code) ? [code] : []
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
  const raw = deal?.salestrekker_bcc
  switch (bccProblem(raw)) {
    case 'none':
      return ''
    case 'empty':
      return 'No SalesTrekker BCC code is recorded on this deal, so this email will not file itself '
        + 'against the card. Add it under SalesTrekker & links.'
    case 'not-an-address':
      // "r01187p12" on 100 deals. Somebody recorded the reference number
      // rather than the filing address SalesTrekker generates from it.
      return `The SalesTrekker box on this deal holds "${txt(raw)}", which is a reference number `
        + 'rather than an email address, so this email will not file itself against the card. '
        + 'Paste the full BCC address from SalesTrekker under SalesTrekker & links. '
        + 'The client still gets the email.'
    case 'too-long':
      // The 74-character base32 address, on 174 deals. Outlook takes it; the
      // portal's mail provider will not.
      return 'The SalesTrekker address on this deal is longer than email addresses are allowed to be, '
        + 'so our mail provider refuses it and this email will not file itself against the card. '
        + 'The client still gets the email — forward your copy to SalesTrekker if the card needs it.'
  }
}
