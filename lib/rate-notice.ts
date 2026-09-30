// THE LINE THAT GOES ON A QUOTE WHEN THE RBA HAS MOVED AND THE BANKS HAVE NOT.
//
// Fabio, 30 Sep 2026: "The RBA recently increased rates so over the next 2-3
// weeks some banks go up at different tiems etc so I want to put a disclaimer in
// ALL temppaltes that go out... but then I need to be able to take it off once
// we go yhotugh and then again after another RBA decsion".
//
// ONE NOTICE, WRITTEN ONCE. Typed into Settings, read by every client email that
// quotes a rate. Nothing is written into a template, so it cannot end up on
// three of them and missing from the fourth - which is exactly what happens when
// four people paste a paragraph into four files.
//
// OFF PER LENDER, ON THE DAY THAT BANK'S INCREASE STARTS.
//
// The first version of this had somebody TICK each bank off once it announced.
// Fabio, 30 Sep 2026: "if I say for exmaple Macquarie bank decion 30 septemebt
// and rate will increase on the 21st of October I need the disclaiumer to go out
// on all Macquaire emails until the 21st of October AFTER THAT date the
// disclaimer disapear".
//
// He is right and the tick was wrong. A bank does not announce and leave you
// guessing - it names the day. That day is knowable weeks ahead, so the honest
// record is the DATE, not a box somebody has to remember to tick on the morning
// it happens. Nobody should have to be at their desk on 21 October for a client
// email to be correct.
//
// So a lender carries two things: which DECISION it has announced for, and the
// DATE that announcement takes effect. Its emails carry the notice right up to
// that date and stop on it, by themselves.
//
// WHICH DECISION, NOT JUST A DATE - and that is what makes the next one free.
// The notice names the decision it is about; a lender's announcement names the
// decision it answers. Change the decision date in Settings and every lender's
// announcement stops matching on its own, so every bank starts carrying the new
// notice with nothing to clear. A "reset all the lenders" button is a button
// somebody forgets to press, and forgetting it leaves seven banks silently
// exempt from a warning about a rise none of them has made.

const txt = (v: any) => String(v ?? '').trim()

const DAY = 86_400_000

function asDate(v: any): Date | null {
  const s = txt(v)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

// COMPARED BY DAY, NEVER BY THE CLOCK. An increase effective 21 October is in
// force all day on the 21st, including at nine in the morning - so a notice that
// waited for the exact hour would be wrong for most of the day it stops.
function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export type RateNotice = {
  // Whether it is going out at all. Off is the resting state: no RBA move, no
  // notice, nothing on any email.
  on: boolean
  // Fabio's words, editable, never built in - so the next one can be a cut, a
  // hold, or a different figure without anybody touching the code.
  text: string
  // WHAT "RECENT" MEANS, and what a lender's tick is measured against. An empty
  // one is treated as no notice at all: a warning about an unnamed decision
  // cannot be switched off lender by lender, so it must not be switchable on.
  decisionDate: string
  // Three weeks, by Fabio's own answer. After this the dashboard asks daily.
  reviewBy: string
}

export const NO_NOTICE: RateNotice = { on: false, text: '', decisionDate: '', reviewBy: '' }

// HOW LONG A NOTICE IS MEANT TO LAST, from the decision to the review.
export const REVIEW_DAYS = 21

// --- reading it back ---------------------------------------------------------

// CHECKED INTO SHAPE, NOT TRUSTED. This is stored JSON that goes onto client
// email, and the safe direction is always "no notice": a missing warning is a
// gap, a warning with half a sentence in it is a Simplify Finance email that
// reads like a mistake.
export function readNotice(raw: any): RateNotice {
  if (!raw || typeof raw !== 'object') return NO_NOTICE
  const text = txt(raw.text)
  const decisionDate = txt(raw.decisionDate)
  return {
    // ON NEEDS ALL THREE. There is nothing to say without words, and nothing to
    // switch off lender by lender without a decision to switch off against.
    on: raw.on === true && !!text && !!decisionDate,
    text, decisionDate,
    reviewBy: txt(raw.reviewBy),
  }
}

// --- who is still carrying it ------------------------------------------------

export type LenderLike = {
  id?: string
  name?: string
  // WHICH DECISION this lender's announcement answers. Matches the notice's own
  // decisionDate while it is current; anything else is last month's news.
  rate_notice_for?: string | null
  // THE DAY THIS BANK'S CHANGE TAKES EFFECT, as they announced it. The notice
  // runs on their emails up to this date and stops on it.
  rate_notice_from?: string | null
  rate_notice_by?: string | null
  rate_notice_at?: string | null
}

// WHAT THIS LENDER HAS ANNOUNCED FOR THE DECISION IN HAND, or empty.
//
// Empty covers both "they have said nothing" and "what is recorded is about an
// older decision" - and both mean the same thing: as far as this portal knows,
// their quoted rate has not moved.
export function announcedFrom(lender: LenderLike | null | undefined, notice: RateNotice): string {
  if (!notice.decisionDate) return ''
  if (txt(lender?.rate_notice_for) !== notice.decisionDate) return ''
  return txt(lender?.rate_notice_from)
}

// HAS THIS BANK'S CHANGE ACTUALLY STARTED YET.
//
// The day itself counts as started: a rate that takes effect on 21 October is
// the rate being quoted on 21 October, so the notice is already wrong that
// morning.
export function hasTakenEffect(lender: LenderLike | null | undefined, notice: RateNotice,
                               now = new Date()): boolean {
  const from = asDate(announcedFrom(lender, notice))
  if (!from) return false
  return startOfDay(now).getTime() >= startOfDay(from).getTime()
}

// The old name, kept as the question the rest of the portal actually asks:
// is this lender done with this decision?
export function passedOn(lender: LenderLike | null | undefined, notice: RateNotice,
                         now = new Date()): boolean {
  return hasTakenEffect(lender, notice, now)
}

// THE LINE FOR THIS DEAL'S EMAIL, OR NOTHING AT ALL.
//
// The one function every email asks. Empty means no notice on this email, for
// whichever of the three reasons - it is off, this bank has passed it on, or
// there are no words.
export function noticeFor(lender: LenderLike | null | undefined, notice: RateNotice,
                          now = new Date()): string {
  if (!notice.on) return ''
  if (hasTakenEffect(lender, notice, now)) return ''
  return notice.text
}

// SEVERAL LENDERS ON ONE EMAIL, which is what the lending options email is.
//
// Two of the three options may have passed the increase on and the third not,
// so a flat "the rates above do not include it" would be wrong about two thirds
// of the page. The notice appears while ANY quoted lender is still to move, and
// where only SOME are, a second line names them.
//
// That second line is generated rather than typed, which is a thing to be
// careful about on a client email - so it is the only sentence this file writes
// that Fabio did not, and it says nothing but a list of names.
export function noticeForMany(lenders: LenderLike[] | null | undefined, notice: RateNotice,
                              now = new Date()): {
  text: string
  appliesTo: string[]
} {
  const none = { text: '', appliesTo: [] as string[] }
  if (!notice.on) return none
  const named = (lenders || []).filter(l => txt(l?.name))
  // No lender named on this email at all - a borrowing capacity, before there is
  // a bank. Nobody has passed anything on, so the notice stands as written.
  if (named.length === 0) return { text: notice.text, appliesTo: [] }
  const waiting = named.filter(l => !hasTakenEffect(l, notice, now))
  if (waiting.length === 0) return none
  // All of them are waiting: his words are already true of the whole page.
  if (waiting.length === named.length) return { text: notice.text, appliesTo: [] }
  return { text: notice.text, appliesTo: waiting.map(l => txt(l.name)) }
}

// "This applies to the rates quoted for ANZ and Macquarie Bank." Empty when it
// applies to everything on the page, because then it needs no saying.
export function appliesToLine(names: string[]): string {
  if (!names || names.length === 0) return ''
  return `This applies to the rate${names.length === 1 ? '' : 's'} quoted for ${list(names)}.`
}

// Everybody still showing it, by name, in the order they are listed. The nag
// names them rather than counting them - "five lenders" sends somebody looking,
// "ANZ, Macquarie, ubank, Pepper and ING" does not.
export function stillCarrying(lenders: LenderLike[] | null | undefined, notice: RateNotice,
                              now = new Date()): string[] {
  if (!notice.on) return []
  return (lenders || [])
    .filter(l => txt(l?.name) && !hasTakenEffect(l, notice, now))
    .map(l => txt(l.name))
}

// THE ONES THAT HAVE SAID NOTHING AT ALL, which is a different list and the one
// worth chasing. A bank with a date recorded is handled: its notice comes off by
// itself on the day. A bank with no date is a phone call somebody has to make.
export function notAnnounced(lenders: LenderLike[] | null | undefined, notice: RateNotice): string[] {
  if (!notice.on) return []
  return (lenders || [])
    .filter(l => txt(l?.name) && !announcedFrom(l, notice))
    .map(l => txt(l.name))
}

export type ComingUp = { name: string; from: string }

// WHOSE RATES NEED LOADING, AND WHEN.
//
// This is what makes an automatic switch-off safe. The notice comes off
// Macquarie's emails on 21 October whether or not anybody has loaded Macquarie's
// new rates - so the portal says, days beforehand, that the date is coming and
// the rates have to be in by then. Without this the notice would vanish on the
// morning nobody was watching and leave a stale rate quoted with no caveat at
// all, which is worse than either.
export function comingUp(lenders: LenderLike[] | null | undefined, notice: RateNotice,
                         now = new Date(), withinDays = 3): ComingUp[] {
  if (!notice.on) return []
  const today = startOfDay(now).getTime()
  return (lenders || [])
    .map(l => ({ name: txt(l?.name), from: announcedFrom(l, notice) }))
    .filter(x => x.name && x.from)
    .filter(x => {
      const d = asDate(x.from)
      if (!d) return false
      const days = Math.round((startOfDay(d).getTime() - today) / DAY)
      return days >= 0 && days <= withinDays
    })
    .sort((a, b) => a.from.localeCompare(b.from))
}

// EVERY LENDER HAS PASSED IT ON, so there is nothing left to warn anybody about
// and the notice has finished its job. The screen offers to switch it off; it
// does not switch itself off, for the same reason it does not expire on a timer.
export function allPassedOn(lenders: LenderLike[] | null | undefined, notice: RateNotice,
                            now = new Date()): boolean {
  if (!notice.on) return false
  const named = (lenders || []).filter(l => txt(l?.name))
  return named.length > 0 && named.every(l => hasTakenEffect(l, notice, now))
}

// --- not letting it be forgotten ---------------------------------------------

export function daysOn(notice: RateNotice, now = new Date()): number {
  const from = asDate(notice.decisionDate)
  if (!from) return 0
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / DAY))
}

// PAST ITS REVIEW DATE. The failure this whole design guards against is not
// forgetting to turn it on - it is a disclaimer still going out in February
// saying "the recent increase of 0.25%" after two more decisions. That is worse
// than no disclaimer, because it is wrong rather than missing.
export function isOverdue(notice: RateNotice, now = new Date()): boolean {
  if (!notice.on) return false
  const by = asDate(notice.reviewBy)
  if (!by) return false
  return now.getTime() > by.getTime()
}

// THE SENTENCE ON THE DASHBOARD. Empty when there is nothing to say.
//
// It names the lenders rather than counting them, and says what the emails are
// currently claiming - because "review the rate notice" is a chore and "this is
// still telling clients ANZ has not passed on the 30 September increase" is a
// decision somebody can make on the spot.
export function nagLine(notice: RateNotice, lenders: LenderLike[] | null | undefined,
                        now = new Date()): string {
  if (!isOverdue(notice, now)) return ''
  const silent = notAnnounced(lenders, notice)
  const days = daysOn(notice, now)
  const opener = `The rate notice has been on for ${days} day${days === 1 ? '' : 's'}.`

  // A BANK WITH A DATE IS NOT A PROBLEM - its notice comes off by itself on the
  // day. The ones worth naming are the ones that have told us nothing, because
  // their clients are still being warned and nobody knows when that stops.
  if (silent.length === 0) {
    return `${opener} Every lender has a date recorded, so it is finishing by itself. ` +
      `Turn it off once the last one has been through.`
  }
  return `${opener} ${list(silent)} ${silent.length === 1 ? 'has' : 'have'} still not told us when ` +
    `the ${niceDate(notice.decisionDate)} decision takes effect, so their clients are still being ` +
    `warned with no end date. Chase ${silent.length === 1 ? 'them' : 'those'}, or turn the notice off.`
}

// THE LINE THAT KEEPS THE AUTOMATIC SWITCH-OFF HONEST.
//
// Empty unless a bank's date is within a few days. Named separately from the
// nag because it is not a telling-off - it is a job with a deadline on it.
export function loadTheseRatesLine(lenders: LenderLike[] | null | undefined, notice: RateNotice,
                                   now = new Date(), withinDays = 3): string {
  const soon = comingUp(lenders, notice, now, withinDays)
  if (soon.length === 0) return ''
  const bits = soon.map(x => `${x.name} on ${niceDate(x.from)}`)
  return `${list(bits)} ${soon.length === 1 ? 'takes' : 'take'} effect shortly. ` +
    `Their new rates need to be loaded by then \u2014 the notice comes off their emails on the day, ` +
    `whether the rates are in or not.`
}

function list(names: string[]): string {
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

export function niceDate(v: any): string {
  const d = asDate(v)
  if (!d) return ''
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

// The review date a new notice gets, three weeks on. Fabio, 30 Sep 2026: "3
// weeks is perfect".
export function defaultReviewBy(decisionDate: any): string {
  const d = asDate(decisionDate)
  if (!d) return ''
  return new Date(d.getTime() + REVIEW_DAYS * DAY).toISOString().slice(0, 10)
}

// STARTING THE NEXT ONE, TWO MONTHS FROM NOW.
//
// Fabio, 30 Sep 2026: "think abaout how we do that agin in 2 months tiems".
//
// This is the whole answer, and it is one field. Change the decision date.
//
// Every lender's recorded date is STAMPED WITH THE DECISION IT ANSWERED. The
// moment the notice is about a different decision, not one of those stamps
// matches - so announcedFrom() returns nothing for all of them, every bank goes
// back to carrying the notice, and the dates they gave you for the last one
// cannot leak into this one.
//
// NOTHING IS WRITTEN TO ANY LENDER TO DO THIS. No loop over the panel, no reset
// button, nothing to half-finish if somebody closes the tab. Seven banks exempt
// from a warning because a clear-down was interrupted is precisely the failure
// this shape makes impossible.
export function forNextDecision(prev: RateNotice, decisionDate: string, text?: string): RateNotice {
  const date = txt(decisionDate)
  return {
    on: true,
    text: txt(text ?? prev.text),
    decisionDate: date,
    reviewBy: defaultReviewBy(date),
  }
}

// WHAT CHANGING THE DATE WILL DO, said before it is done.
//
// Shown on the button, because "every bank starts warning clients again" is a
// consequence somebody should read rather than discover.
export function nextDecisionWarning(lenders: LenderLike[] | null | undefined,
                                    notice: RateNotice, now = new Date()): string {
  const named = (lenders || []).filter(l => txt(l?.name))
  if (named.length === 0) return ''
  const settled = named.filter(l => announcedFrom(l, notice)).length
  return `All ${named.length} lenders go back to carrying the notice` +
    (settled > 0
      ? `, and the ${settled} date${settled === 1 ? '' : 's'} recorded against the ` +
        `${niceDate(notice.decisionDate)} decision stop applying.`
      : '.')
}
