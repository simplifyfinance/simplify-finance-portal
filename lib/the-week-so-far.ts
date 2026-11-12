// THE WEEK, BOTH WAYS.
//
// Alan asked for a weekly activity snapshot. Fabio, 10 Nov 2026, asked which
// one he meant and answered it himself: "I want both what we got done and what
// we have sitting."
//
// They are two different questions and a single row of numbers cannot answer
// both. "Did we keep up this week" counts EVENTS - deals that crossed a line
// between Monday and this morning. "What is stuck" counts DEALS - the ones
// standing in each state right now. A quiet week makes the first small and
// does nothing at all to the second.
//
// A DEAL LODGED ON TUESDAY IS IN BOTH, and that is correct rather than a
// double count. The screen says so out loud, because a number a reader cannot
// reconcile is a number they stop trusting.
//
// THE LONGEST WAITING IS THE POINT. Fourteen with the bank is a fact. One of
// them sitting eleven days is a thing to do something about, so each line
// carries its oldest and that is the part that goes red.
//
// APPROVED-NOT-SETTLED IS DELIBERATELY ABSENT. Fabio: "let's add settlements
// when we finish building the settlement process." A half answer there would
// be worse than none.

import { phaseOf, phaseSince } from './deal-phase'
import { bucketOf } from './a-stage-is-a-fact'
import { toAuDate } from './periods'
import { mondayOf, ymd, tabOf } from './lodging-when'

const txt = (v: any) => String(v ?? '').trim()
const DAY = 86_400_000

// THE SYDNEY DAY, NOT THE UTC ONE.
//
// 12 Nov 2026. Fabio: "we more than 1 deal this week." There were three, and
// the report showed one.
//
// A lodgement is recorded as a DATE and stored as Sydney midnight, which is
// 13:00 the day before in UTC. So slicing the first ten characters off the
// stored string gives yesterday - for every lodgement, not just the morning
// ones. Two of Mark's lodged on Monday 9 November were stored as 8 November
// and fell out of the week entirely.
//
// This codebase has paid for this twice already: lib/rate-notice.ts on 9 Oct
// and the day's plan on the dashboard. toAuDate() in lib/periods.ts is the
// answer and it was sitting there the whole time.
function day(v: any): string {
  return toAuDate(txt(v) || null)
}

function isReal(deal: any): boolean {
  return txt(deal?.status) !== 'lost'
}

// WHAT CROSSED A LINE, AND WHICH COLUMN PROVES IT.
//
// Three events, read off the deal's own milestone dates rather than from a
// second table - so this screen and the board cannot disagree about whether
// something lodged. Approved means FORMALLY approved: a pre-approval is an
// approval for Alan's reporting buckets, but counting both here would count
// one deal twice in a week that had both.
export const EVENTS = [
  { key: 'lodged',   column: 'lodged_at',          words: 'lodged' },
  { key: 'approved', column: 'formal_approval_at', words: 'approved' },
  { key: 'settled',  column: 'settled_at',         words: 'settled' },
] as const

export type EventKey = typeof EVENTS[number]['key']

export type DoneLine = { key: EventKey; words: string; count: number; lastWeek: number }

function between(deals: any[], column: string, from: string, to: string): number {
  return (deals || []).filter(d => {
    if (!isReal(d)) return false
    const at = day(d?.[column])
    return at !== '' && at >= from && at <= to
  }).length
}

/** Monday to today, and the same stretch of last week beside it. */
export function doneThisWeek(deals: any[], now: Date = new Date()): DoneLine[] {
  const from = mondayOf(now)
  const to = ymd(now)
  const wasFrom = ymd(new Date(new Date(from).getTime() - 7 * DAY))
  const wasTo = ymd(new Date(now.getTime() - 7 * DAY))
  return EVENTS.map(e => ({
    key: e.key,
    words: e.words,
    count: between(deals, e.column, from, to),
    // THE SAME STRETCH, NOT THE WHOLE OF LAST WEEK. On a Tuesday, comparing
    // two days against five would make every week look like a collapse.
    lastWeek: between(deals, e.column, wasFrom, wasTo),
  }))
}

// --- what is standing there ---------------------------------------------------

export type SittingLine = {
  key: 'pre_lodgement' | 'lodged' | 'no_week'
  words: string
  count: number
  /** Days the one waiting longest has been there. Null where the pile is empty. */
  longest: number | null
  /** The day it stops being work in hand. See the note on red in the component. */
  longAt: number
}

function daysSince(s: any, now: Date): number | null {
  const t = txt(s)
  if (!t) return null
  const at = new Date(t).getTime()
  if (!Number.isFinite(at)) return null
  return Math.max(0, Math.floor((now.getTime() - at) / DAY))
}

function pile(
  deals: any[], now: Date, key: SittingLine['key'], words: string, longAt: number,
  keep: (d: any) => boolean, since: (d: any) => any,
): SittingLine {
  const mine = (deals || []).filter(d => isReal(d) && keep(d))
  const ages = mine.map(d => daysSince(since(d), now)).filter((n): n is number => n !== null)
  return {
    key, words, longAt,
    count: mine.length,
    longest: ages.length ? Math.max(...ages) : null,
  }
}

/**
 * The three piles, as of this morning.
 *
 * SETTLED AND LOST ARE NOT HERE. They are finished, and counting a finished
 * deal as "sitting" makes a pile that grows for ever and means nothing.
 */
export function sittingNow(deals: any[], now: Date = new Date()): SittingLine[] {
  return [
    pile(deals, now, 'pre_lodgement', 'pre-lodgement', 10,
      d => bucketOf(phaseOf(d)) === 'pre_lodgement',
      d => phaseSince(d) || d?.created_at),
    pile(deals, now, 'lodged', 'lodged, with the bank', 10,
      d => bucketOf(phaseOf(d)) === 'lodged',
      d => d?.lodged_at || phaseSince(d)),
    // THE ROW THAT SENDS YOU TO THE LIST BELOW. Deals nobody has committed to a
    // week is something sitting in the plainest sense, and it is the number a
    // report would never think to show.
    pile(deals, now, 'no_week', 'with no week set', 14,
      d => tabOf(d, now) === 'no_week',
      d => phaseSince(d) || d?.created_at),
  ]
}
