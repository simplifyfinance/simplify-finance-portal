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
export function seatOf(deal: any, now: Date = new Date()): Seat | null {
  if (txt(deal?.status) === 'lost' || txt(deal?.settled_at)) return null
  if (hasLodged(deal)) {
    // Only this week's lodgements belong on the meeting screen. Last month's
    // are on Lodged and settled, which is the page for counting.
    return thisWeek(deal, now) ? 'lodged' : null
  }
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
): BrokerRun[] {
  const by = new Map<string, any[]>()
  for (const d of deals || []) {
    if (seatOf(d, now) !== seat) continue
    const key = txt(d?.assigned_broker).toLowerCase()
    if (!key) continue
    by.set(key, [...(by.get(key) || []), d])
  }
  const out: BrokerRun[] = []
  for (const [key, list] of by) {
    list.sort((a, b) => {
      const sa = isSlipping(a, now) ? 0 : 1
      const sb = isSlipping(b, now) ? 0 : 1
      if (sa !== sb) return sa - sb
      return (unansweredDays(b, now) ?? -1) - (unansweredDays(a, now) ?? -1)
    })
    out.push({
      key, name: names(key), team: teamOf(key), deals: list,
      toDecide: list.filter(d => !answerOf(d, now)).length,
      total: list.length,
    })
  }
  // Most to decide first - the meeting spends its time where the answers are
  // missing, not in alphabetical order.
  return out.sort((a, b) => b.toDecide - a.toDecide || b.total - a.total)
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
