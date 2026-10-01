// THE EMAIL TO ANZ'S ASSESSMENT TEAM.
//
// Fabio, 1 Oct 2026: "it opens an email subject line is the loan id and it goes
// to assessmentmail@anz.com". ANZ only for now.
//
// IT OPENS AN EMAIL, IT DOES NOT SEND ONE. The portal sends client emails and
// records them on the deal, because those are ours and they are a record. This
// one is a broker writing to their assessor with whatever that conversation
// needs that day - attachments, a question, a chase. A mailto hands it to
// Outlook, already addressed and titled, and gets out of the way.

import { norm } from './lender-id'
import { lenderOnTheDeal } from './client-agreement'

const txt = (v: any) => String(v ?? '').trim()

export const ANZ_ASSESSMENT_TO = 'assessmentmail@anz.com'

// EXACT, NEVER FUZZY. The same rule lib/lender-id.ts holds to: a near miss here
// would put the button on a deal with another bank, and the email would go to
// ANZ about somebody else's application.
export function isAnz(lenderName: any): boolean {
  return norm(lenderName) === 'anz'
}

// The lender this deal is actually on - the client's own choice where they
// made one, not the recommendation. See lenderOnTheDeal().
export function lenderFor(deal: any): string {
  return lenderOnTheDeal(deal?.lo_data || {})
}

export function showAnzAssessmentButton(deal: any): boolean {
  return isAnz(lenderFor(deal))
}

// WHAT GOES IN THE SUBJECT: THE APPLICATION ID.
//
// The number ANZ give when the application goes in, recorded on the Settlement
// panel. Stored in the column lender_reference, the name it had before anybody
// called it the Application ID on screen.
//
// Not the Loan ID, despite the words: the Loan ID in this portal is the account
// number the bank issues AFTER settlement, for matching the RCTI - see
// lib/loan-id.ts - so it is empty at every moment this button is any use.
export function assessmentSubject(deal: any): string {
  return txt(deal?.lender_reference)
}

// A subject nobody can build is left EMPTY rather than filled with the deal
// name. An assessor searching their inbox for a reference finds nothing either
// way, and a wrong subject is the one they would act on.
export function assessmentMailto(deal: any): string {
  const subject = assessmentSubject(deal)
  return `mailto:${ANZ_ASSESSMENT_TO}` + (subject ? `?subject=${encodeURIComponent(subject)}` : '')
}
