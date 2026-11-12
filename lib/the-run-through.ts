// THE MONDAY MEETING, WITHOUT THE SPREADSHEET.
//
// 12 Nov 2026. Fabio, on what Today is actually for from an admin seat:
//
//   "We have a meeting every Monday, and then we check in on Wednesday and we
//    check in on Friday... we go and say, hey, which deals are coming this
//    week? Which ones can we lodge this week? And then every broker goes, yep,
//    I think I can get these ones done this week... Right now is an Excel
//    spreadsheet. I want that gone."
//
// And on what the week is for:
//
//   "we're trying to do 10 to 12 deals a week. How are we tracking?"
//
// So this file answers two questions and nothing else. What are we lodging
// this week, broker by broker. And are we going to make twelve.
//
// THE ANSWERS ARE ALREADY THERE. This week, Next, Client - see
// lib/lodging-when.ts, which the Due to lodge panel has been writing since
// Alan's item 1. What was missing was the SHAPE of a meeting: a list you can
// go down one broker at a time, the ones nobody has answered on at the top,
// and a number that says whether the week is on.
//
// TWO TABS MORE THAN THE OLD PANEL. Waiting on the client, and Lodged. Both
// existed as answers and neither could be looked at, so a deal parked with a
// client vanished from the screen - which is the same as not having asked.

import { answerOf, hasLodged, tabOf, weeksFromNow, type AnswerKey } from './lodging-when'
import { phaseOf } from './deal-phase'
import { whoHasIt } from './who-has-it'

const txt = (v: any) => String(v ?? '').trim()
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0)

export type Seat = 'this_week' | 'next_week' | 'client' | 'lodged' | 'nobody'

export const SEAT_LABEL: Record<Seat, string> = {
  nobody: 'Nobody has said',
  this_week: 'This week',
  next_week: 'Next week',
  client: 'Waiting on the client',
  lodged: 'Lodged',
}

/** The meeting runs down this list in this order. */
export const SEATS: Seat[] = ['nobody', 'this_week', 'next_week', 'client', 'lodged']

/**
 * WHERE A DEAL SITS IN THE MEETING.
 *
 * Lodged wins over everything: once it is in, what somebody predicted in a
 * meeting three weeks ago is history rather than a plan.
 */
/**
 * COULD THIS ACTUALLY LODGE THIS WEEK?
 *
 * 12 Nov 2026. Fabio, after the first version put sixty-four deals in front of
 * a Monday meeting:
 *
 *   "compliance issued, lending options, and BC with the client. In this
 *    order, starts a compliance issue and then lending options and then BC...
 *    anything that is sitting on fact find, anything that is sitting on
 *    fucking lodged, doesn't matter."
 *
 * THREE KINDS OF DEAL, AND ONLY THREE.
 *
 *   Compliance issued        the pack has gone out; this is the closest thing
 *                            to a lodgement there is
 *   Lending options          a bank is being chosen
 *   BC sitting with a client we have done our part and they are deciding
 *
 * A borrowing capacity still to be WRITTEN is work, not a lodgement candidate.
 * It belongs on a credit assessor's day and on the Deals page; putting it here
 * is what turned a meeting into a list nobody reads.
 *
 * Anything else is still reachable by name - that is what the search beside
 * each broker is for. This decides what is on screen before anybody types.
 */
export function couldLodge(deal: any): boolean {
  const p = phaseOf(deal)
  if (p === 'compliance_sent' || p === 'lo') return true
  if (p === 'bc') return whoHasIt(deal)?.holder === 'client'
  return false
}

/**
 * THE ORDER THE MEETING WORKS IN.
 *
 * Compliance issued first, because it is nearest to lodging. Then lending
 * options. Then the BCs a client is sitting on.
 */
export function lodgeRank(deal: any): number {
  const p = phaseOf(deal)
  return p === 'compliance_sent' ? 0 : p === 'lo' ? 1 : 2
}

export function seatOf(deal: any, now: Date = new Date()): Seat | null {
  if (txt(deal?.status) === 'lost' || txt(deal?.settled_at)) return null
  // LODGED IS NOT A CANDIDATE, IT IS A RESULT. It stays on its own tab and in
  // the week's count, and it is never in the three the meeting works through.
  if (hasLodged(deal)) {
    // Only this week's lodgements belong on the meeting screen. Last month's
    // are on Lodged and settled, which is the page for counting.
    return thisWeek(deal, now) ? 'lodged' : null
  }
  if (!couldLodge(deal)) return null
  if (answerOf(deal, now) === 'client') return 'client'
  const tab = tabOf(deal, now)
  if (tab === 'this_week') return 'this_week'
  if (tab === 'next_week') return 'next_week'
  if (tab === 'no_week') return 'nobody'
  return null
}

function thisWeek(deal: any, now: Date): boolean {
  const at = txt(deal?.lodged_at)
  if (!at) return false
  const d = new Date(at)
  if (!Number.isFinite(d.getTime())) return false
  const monday = new Date(now)
  const day = (monday.getDay() + 6) % 7
  monday.setDate(monday.getDate() - day)
  monday.setHours(0, 0, 0, 0)
  return d.getTime() >= monday.getTime()
}

export function seatCounts(deals: any[], now: Date = new Date()): Record<Seat, number> {
  const out: Record<Seat, number> = {
    nobody: 0, this_week: 0, next_week: 0, client: 0, lodged: 0,
  }
  for (const d of deals || []) {
    const s = seatOf(d, now)
    if (s) out[s] += 1
  }
  return out
}

// --- are we going to make twelve ---------------------------------------------

export type WeekSoFar = {
  /** Already in. */
  lodged: number
  /** Brokers said yes to these in the meeting. */
  promised: number
  /** The two added up - what the week is on track for. */
  onTrack: number
  /** The bottom of the target. */
  floor: number
  /** The top of it. */
  ceiling: number
  /** How many short of the TOP, never below zero. */
  short: number
  /** True once the week is at or past the bottom of the target. */
  made: boolean
  /** What the strip says underneath. */
  words: string
}

export const TARGET = { floor: 10, ceiling: 12 }

/**
 * THE TARGET, AS SOMEBODY TYPED IT.
 *
 * 12 Nov 2026. Fabio: "it's okay to edit that number. So if we want to target,
 * let's say we start wanting to lodge 15, 20... Doesn't need to be overthink
 * this because it's just the target week for the bar."
 *
 * So: two whole numbers, in order, within reach of a mortgage business. A
 * ceiling under the floor is somebody typing, not a decision, and the bar
 * reading "on track for 11, 4 short of 15" when the floor says 15 and the
 * ceiling says 3 is worse than useless.
 */
export function readTarget(raw: any): { floor: number; ceiling: number } {
  const n = (v: any, fallback: number) => {
    const x = Math.round(Number(v))
    return Number.isFinite(x) && x >= 1 && x <= 999 ? x : fallback
  }
  const floor = n(raw?.floor, TARGET.floor)
  const ceiling = n(raw?.ceiling, TARGET.ceiling)
  return ceiling < floor ? { floor, ceiling: floor } : { floor, ceiling }
}

/**
 * THE ONE LINE THAT MATTERS ON A MONDAY.
 *
 * Lodged plus promised, against ten to twelve. Promised is a broker saying
 * "yes, this week" in the meeting - which is a real number because somebody
 * put their name to it, and a soft one because weeks are weeks. Both are shown
 * rather than added into one figure that pretends to be certain.
 */
export function weekSoFar(
  deals: any[], now: Date = new Date(), target = TARGET,
): WeekSoFar {
  const c = seatCounts(deals, now)
  const lodged = c.lodged
  const promised = c.this_week
  const onTrack = lodged + promised
  const short = Math.max(0, target.ceiling - onTrack)
  return {
    lodged, promised, onTrack,
    floor: target.floor, ceiling: target.ceiling, short,
    made: onTrack >= target.floor,
    words: onTrack >= target.ceiling
      ? `at the top of ${target.floor}–${target.ceiling}`
      : onTrack >= target.floor
        ? `inside ${target.floor}–${target.ceiling}`
        : short === 1 ? 'one short of the target'
        : `${target.floor - onTrack} short of ${target.floor}`,
  }
}

// --- the run-through itself ---------------------------------------------------

export type BrokerRun = {
  key: string
  name: string
  /** Everything of theirs that could lodge, whatever seat it is on - what the
    * search beside their name looks through. */
  all: any[]
  /** The group this broker sits under - see lib/which-team.ts. */
  team: string
  deals: any[]
  /** How many on this seat still have no answer. */
  toDecide: number
  total: number
}

/**
 * HOW LONG NOBODY HAS ANSWERED, in days.
 *
 * The number that makes a meeting worth having: a deal three weeks old that
 * nobody has said a word about is the one that slips every Monday without
 * anybody noticing it slipped.
 */
export function unansweredDays(deal: any, now: Date = new Date()): number | null {
  if (answerOf(deal, now)) return null
  const since = txt(deal?.compliance_sent_at) || txt(deal?.lo_proceeded_at)
    || txt(deal?.created_at)
  if (!since) return null
  const t = new Date(since).getTime()
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000))
}

/**
 * WAS THIS PROMISED AT AN EARLIER MEETING?
 *
 * 12 Nov 2026. Fabio: "if I tick the box that says next week, so guess what?
 * On next week's summary that starts on Monday... you're going to bring the
 * ones that we clicked from next week and then bring it back and highlight it
 * for this week."
 *
 * The rolling itself already happens and always did: the answer stores the
 * MONDAY it is for, not the word, so a deal marked next week on the 16th
 * carries the 23rd and is simply this week's deal when the 23rd arrives. See
 * weeksFromNow() in lib/lodging-when.ts.
 *
 * What was missing is the highlight. In the room there is a real difference
 * between a deal somebody just said yes to and one that has been promised
 * before - and the second is the one to ask about twice.
 *
 *   carried   promised at an earlier meeting, due now
 *   slipped   promised for a week that has already been and gone
 */
export type Carried = 'carried' | 'slipped' | null

export function carriedOver(deal: any, now: Date = new Date()): Carried {
  if (hasLodged(deal)) return null
  // READ THE WEEK THAT WAS STORED, not the word answerOf gives back: a week
  // that has already gone is no longer "this", which is exactly the case this
  // function exists to catch.
  if (txt(deal?.lodgement_plan) !== 'week') return null
  const n = weeksFromNow(deal?.lodgement_week, now)
  if (n === null) return null
  if (n < 0) return 'slipped'
  if (n !== 0) return null
  // Answered before this Monday, for this Monday: carried in from a meeting
  // that has already happened.
  const said = txt(deal?.lodgement_week_at)
  if (!said) return null
  const monday = new Date(now)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  return new Date(said).getTime() < monday.getTime() ? 'carried' : null
}

export const CARRIED_WORDS: Record<'carried' | 'slipped', string> = {
  carried: 'promised last week',
  slipped: 'slipped — was due already',
}

/** Loud enough to stop the meeting. Three weeks with nobody saying anything. */
export const SLIPPING_DAYS = 21

export function isSlipping(deal: any, now: Date = new Date()): boolean {
  const d = unansweredDays(deal, now)
  return d !== null && d >= SLIPPING_DAYS
}

/**
 * THE LIST, BROKER BY BROKER, for one seat.
 *
 * `teamOf` says which group a broker sits under, so the Simplify Finance
 * brokers and the Simplify Finance Brokers group are two sections rather than
 * one long list. Brokers with nothing on this seat are left out - an empty
 * name in a meeting is a line somebody reads out for no reason.
 *
 * Inside a broker: the ones nobody has answered on first, oldest first, then
 * the rest oldest first. The meeting works down from the worst.
 */
export function runThrough(
  deals: any[], seat: Seat,
  names: (key: string) => string,
  teamOf: (key: string) => string,
  now: Date = new Date(),
  /**
   * EVERY BROKER WHO SHOULD APPEAR WHETHER THEY HAVE ANYTHING OR NOT.
   *
   * 12 Nov 2026. Fabio, on the three who run the business between them:
   * "Kylie is the broker, but later on. So have her there, but just leave it
   * blank because she will be part of that."
   *
   * A name with nothing under it is the meeting asking the question anyway,
   * which is the point of going round the table. A broker left off the screen
   * is a broker nobody asks.
   */
  always: string[] = [],
): BrokerRun[] {
  const by = new Map<string, any[]>()
  // Everything of each broker's that could lodge, on any seat - the search
  // beside their name reaches all of it, not just the tab on screen.
  const everything = new Map<string, any[]>()
  for (const d of deals || []) {
    if (!seatOf(d, now)) continue
    const key = txt(d?.assigned_broker).toLowerCase()
    if (key) everything.set(key, [...(everything.get(key) || []), d])
  }
  for (const k of always) {
    const key = txt(k).toLowerCase()
    if (key) by.set(key, [])
  }
  for (const d of deals || []) {
    if (seatOf(d, now) !== seat) continue
    const key = txt(d?.assigned_broker).toLowerCase()
    if (!key) continue
    by.set(key, [...(by.get(key) || []), d])
  }
  const out: BrokerRun[] = []
  for (const [key, list] of by) {
    list.sort((a, b) => {
      // Lending options before a BC sitting with a client - the first is far
      // closer to lodging than the second.
      const r = lodgeRank(a) - lodgeRank(b)
      if (r !== 0) return r
      const sa = isSlipping(a, now) ? 0 : 1
      const sb = isSlipping(b, now) ? 0 : 1
      if (sa !== sb) return sa - sb
      // Chronological, oldest first, inside each.
      return (unansweredDays(b, now) ?? -1) - (unansweredDays(a, now) ?? -1)
    })
    out.push({
      key, name: names(key), team: teamOf(key), deals: list, all: everything.get(key) || [],
      toDecide: list.filter(d => !answerOf(d, now)).length,
      total: list.length,
    })
  }
  // Most to decide first - the meeting spends its time where the answers are
  // missing, not in alphabetical order. A broker with nothing goes last, where
  // the table can see the name and move on.
  return out.sort((a, b) =>
    (b.total > 0 ? 1 : 0) - (a.total > 0 ? 1 : 0)
    || b.toDecide - a.toDecide || b.total - a.total
    || a.name.localeCompare(b.name))
}

/**
 * TEN AT A TIME, AND A SEARCH BESIDE EACH BROKER FOR THE REST.
 *
 * 12 Nov 2026. Fabio, on sixty-four deals with no answer on them: "how are we
 * sitting down as a team on a meeting on a Monday and then we start from
 * scratch... why don't you just highlight the first ten, make sure you can
 * scroll up and down, make sure we can search."
 *
 * "Give me 10, don't go more than 10, as in I can see a view and I can scroll
 * up and down to see if there is more."
 *
 * The ten are compliance-issued first, then lending options, oldest first
 * inside each. Anything else is reached by name.
 */
export const SHOW_AT_ONCE = 10

export function matches(deal: any, look: any): boolean {
  const q = txt(look).toLowerCase()
  if (q.length < 2) return true
  const hay = [
    deal?.deal_name,
    deal?.clients?.first_name, deal?.clients?.last_name,
    deal?.lender,
  ].map(txt).join(' ').toLowerCase()
  return hay.includes(q)
}

/** What one broker's section is worth, for the line beside their name. */
export function worthOf(deals: any[]): number {
  return (deals || []).reduce((n, d) => n + num(d?.loan_amount ?? d?.amount), 0)
}

/**
 * WHICH SECTION A DEAL BELONGS IN - AND IT IS THE SPLIT, NOT THE BROKER.
 *
 * 12 Nov 2026. Fabio, correcting me on exactly this:
 *
 *   "there are splits that we do 50-50 between Keanen and us and Justin and
 *    us. That sits on our admin load, not theirs. The only ones that sit on
 *    theirs are the ones that they get paid 80-20."
 *
 * So the question is not whose name is on the deal. Justin writes both kinds.
 * The 80/20 arrangements are his own book, which we do not push - he is self
 * employed. The 50/50 ones are deals WE are carrying with him, and they count
 * against the ten to twelve that Mark, Fabio and Kylie are measured on.
 *
 * Reading it off the deal's own split means a deal moves section when the
 * arrangement changes, and nobody has to remember which column to look in.
 *
 * `theirShare` is what that broker takes on the deal's split - see
 * lib/who-gets-paid-on-this.ts. 80 or more is their book. Anything else,
 * including no split at all, is ours.
 */
export const THEIR_BOOK_FROM = 80

export function theirOwnBook(theirShare: number | null | undefined): boolean {
  const n = Number(theirShare)
  return Number.isFinite(n) && n >= THEIR_BOOK_FROM
}

/** Only the brokers in one group, for the section at the bottom. */
export function inTeam(runs: BrokerRun[], team: string): BrokerRun[] {
  const want = txt(team).toLowerCase()
  return runs.filter(r => txt(r.team).toLowerCase() === want)
}

/** Everyone who is not in that group - the main run-through. */
export function notInTeam(runs: BrokerRun[], team: string): BrokerRun[] {
  const want = txt(team).toLowerCase()
  return runs.filter(r => txt(r.team).toLowerCase() !== want)
}

/**
 * THE TWO SECTIONS, SPLIT BY THE SPLIT.
 *
 * `shareFor(deal)` gives the writing broker's own upfront share on that deal,
 * or null where there is no split. Everything at 80 or above goes to their
 * section; everything else stays on ours, whoever wrote it.
 */
export function bySection(
  deals: any[], shareFor: (deal: any) => number | null,
): { ours: any[]; theirs: any[] } {
  const ours: any[] = []
  const theirs: any[] = []
  for (const d of deals || []) {
    (theirOwnBook(shareFor(d)) ? theirs : ours).push(d)
  }
  return { ours, theirs }
}

export type { AnswerKey }
