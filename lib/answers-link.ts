import { signPayload, verifyPayload, siteUrl } from './ready-link'

// THE LINK A CLIENT OPENS TO ANSWER WHAT IS STILL MISSING.
//
// 27 Oct 2026. The questions in the BC and the lending options emails can be
// answered by replying - and a reply never ticks anything off by itself,
// because somebody has to type it into the fact find first. This link is the
// other way: what they type lands on the fact find and the question closes.
//
// SIGNED, NOT STORED, like the Ready and Opportunity links beside it. The deal
// it belongs to and the day it dies are inside the link, so there is no column
// to keep in step, no row to go stale, and no token table to look up. Change
// one character and the signature stops matching.
//
// FOUR WEEKS. Fabio, 27 Oct 2026: "Link expires in 4 weeks." Long enough that a
// client who leaves it a fortnight is fine, short enough that a forwarded link
// does not sit live in somebody's inbox for a year. The date is checked here
// rather than on the page, so there is one answer to "is this still good".
//
// WHAT IT CANNOT DO, said plainly: a signed link cannot be cancelled early.
// Anybody holding it can see what we already have for that client until it runs
// out. That is true of Ready and Opportunity today and has been since they
// shipped. If a link ever has to be killed on demand, that is the day this
// grows a stored token - not before.
export type AnswersPayload = {
  dealId: string
  /** The day it was sent, so the page can say which email it came from. */
  sentOn: string
  /** ISO. Checked on every open. */
  expiresOn: string
}

export const LINK_LIVES_FOR_DAYS = 28

export function expiresFrom(issued: Date): string {
  const d = new Date(issued.getTime())
  d.setDate(d.getDate() + LINK_LIVES_FOR_DAYS)
  return d.toISOString()
}

export function signAnswers(dealId: string, issued = new Date()): string {
  return signPayload({
    dealId: String(dealId || ''),
    sentOn: issued.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
    expiresOn: expiresFrom(issued),
  } satisfies AnswersPayload)
}

/**
 * NULL WHERE IT IS FORGED, AND NULL WHERE IT HAS RUN OUT.
 *
 * The page cannot tell those two apart and should not try - it says the link
 * has expired and offers to have a new one sent, because that is the only one
 * of the two a real client will ever see.
 */
export function verifyAnswers(token: string, today = new Date()): AnswersPayload | null {
  const p = verifyPayload<AnswersPayload>(token)
  if (!p || !p.dealId) return null
  const until = new Date(String(p.expiresOn || ''))
  if (isNaN(until.getTime()) || until.getTime() <= today.getTime()) return null
  return p
}

/** True where the token parses but the day has passed - for the wording only. */
export function hasExpired(token: string, today = new Date()): boolean {
  const p = verifyPayload<AnswersPayload>(token)
  if (!p) return false
  const until = new Date(String(p.expiresOn || ''))
  return !isNaN(until.getTime()) && until.getTime() <= today.getTime()
}

export function answersUrl(token: string): string {
  return `${siteUrl()}/answers/${token}`
}

export { siteUrl }
