// WHICH WEEK THIS DEAL IS MEANT TO LODGE IN.
//
// Alan's November brief, item 1. Fabio, 10 Nov 2026: "Alan sets the week in
// conjunction with brokers" - so this is a management answer recorded once a
// week with the broker in front of him, not something each person sets on
// their own card.
//
// THE WEEK IS STORED AS A DATE, NEVER AS A LABEL. "This week" means nothing
// seven days later. What is kept is the Monday, and every label on every
// screen is worked out from it against today. The portal has paid for the
// other way round often enough - a word that was true when somebody typed it
// and silently false afterwards.
//
// AND THREE ANSWERS, NOT A DATE PICKER. Nobody is promising a Thursday.
// "Client" is a real answer with no week attached - without it every deal held
// up by somebody else sits in No week set looking like an oversight.
//
// THERE USED TO BE A FOURTH. Fabio, 17 Nov 2026: "'Later' makes no sense, it
// is either this week, next, or client." He is right. Later is not an answer,
// it is a way of not giving one - and a deal parked there is invisible until
// somebody goes looking. Deals already carrying it are routed back to No week
// set so they get a real answer.
//
// NOTHING IS CLEARED WHEN A DEAL LODGES. The week it was promised is what lets
// the list say "lodged Tuesday" or "slipped, eight days over". Throwing it
// away at the moment it becomes interesting is what a status column would do.

import { phaseOf, phaseSince } from './deal-phase'
import { bucketOf } from './a-stage-is-a-fact'

const txt = (v: any) => String(v ?? '').trim()

/** 'later' is no longer offered. It stays here so rows already carrying it
 *  still parse rather than throwing; nothing writes it any more. */
export type Plan = 'week' | 'later' | 'client'

export const PLAN_LABEL: Record<Plan, string> = {
  week: 'A week',
  later: 'Later',
  client: 'Not until the client moves',
}

/** The three buttons, in the order they are drawn. */
export const ANSWERS = [
  { key: 'this', label: 'This week' },
  { key: 'next', label: 'Next' },
  { key: 'client', label: 'Client' },
] as const

export type AnswerKey = typeof ANSWERS[number]['key']

// --- weeks -------------------------------------------------------------------

const DAY = 86_400_000

/** The Monday of whatever week a date falls in, as YYYY-MM-DD. */
export function mondayOf(d: Date = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  // getDay() is 0 for Sunday, so Sunday belongs to the week that started six
  // days ago rather than to the one about to start.
  const back = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - back)
  return ymd(x)
}

export function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function parse(s: any): Date | null {
  const t = txt(s)
  if (!/^\d{4}-\d{2}-\d{2}/.test(t)) return null
  const [y, m, d] = t.slice(0, 10).split('-').map(Number)
  const x = new Date(y, m - 1, d)
  return Number.isNaN(x.getTime()) ? null : x
}

/** Whole weeks from this week's Monday. 0 is this week, 1 next, -1 last. */
export function weeksFromNow(monday: any, now: Date = new Date()): number | null {
  const m = parse(monday)
  if (!m) return null
  const here = parse(mondayOf(now))!
  return Math.round((m.getTime() - here.getTime()) / (7 * DAY))
}

/** "This week — 10 to 14 Nov", "Next week — 17 to 21 Nov", "Two weeks ago". */
export function weekLabel(monday: any, now: Date = new Date()): string {
  const m = parse(monday)
  if (!m) return ''
  const n = weeksFromNow(monday, now)
  const fri = new Date(m.getTime() + 4 * DAY)
  const span = `${m.getDate()} to ${fri.getDate()} ${month(fri)}`
  if (n === 0) return `This week — ${span}`
  if (n === 1) return `Next week — ${span}`
  if (n === -1) return `Last week — ${span}`
  if (n !== null && n < -1) return `${-n} weeks ago — ${span}`
  return `${span}`
}

function month(d: Date): string {
  return d.toLocaleDateString('en-AU', { month: 'short' })
}

/** The Monday an answer means, or null where the answer carries no week. */
export function weekForAnswer(key: AnswerKey, now: Date = new Date()): string | null {
  if (key === 'this') return mondayOf(now)
  if (key === 'next') return ymd(new Date(parse(mondayOf(now))!.getTime() + 7 * DAY))
  return null
}

/** What a button press writes to the deal. */
export function patchForAnswer(key: AnswerKey, now: Date = new Date()): {
  lodgement_plan: Plan; lodgement_week: string | null
} {
  return {
    lodgement_plan: key === 'client' ? 'client' : 'week',
    lodgement_week: weekForAnswer(key, now),
  }
}

/** Which of the three buttons is lit for this deal. */
export function answerOf(deal: any, now: Date = new Date()): AnswerKey | null {
  const plan = txt(deal?.lodgement_plan)
  // A deal still carrying the old "later" lights nothing, because none of the
  // three is what somebody said. It shows on No week set waiting for an answer.
  if (plan === 'client') return 'client'
  if (plan !== 'week') return null
  const n = weeksFromNow(deal?.lodgement_week, now)
  if (n === 0) return 'this'
  if (n === 1) return 'next'
  return null
}

// --- where a deal stands ------------------------------------------------------

export function hasLodged(deal: any): boolean {
  return Boolean(txt(deal?.lodged_at))
}

export type Standing = 'lodged' | 'slipped' | 'to_go'

/**
 * SLIPPED IS THE ONLY RED ON THIS SCREEN.
 *
 * It did not lodge in the week somebody promised it would, so it is today's
 * problem. Everything else on the list is work in hand, and colouring that red
 * is how a screen teaches people to ignore its colours.
 */
export function standingOf(deal: any, now: Date = new Date()): Standing {
  if (hasLodged(deal)) return 'lodged'
  const n = weeksFromNow(deal?.lodgement_week, now)
  if (txt(deal?.lodgement_plan) === 'week' && n !== null && n < 0) return 'slipped'
  return 'to_go'
}

/** How far past the promised week, in days. 0 where it has not slipped. */
export function daysOver(deal: any, now: Date = new Date()): number {
  if (standingOf(deal, now) !== 'slipped') return 0
  const m = parse(deal?.lodgement_week)
  if (!m) return 0
  // From the Friday of the week it was due - a deal promised for last week is
  // not late on the Monday of it.
  const friday = new Date(m.getTime() + 4 * DAY)
  const today = parse(ymd(now))!
  return Math.max(0, Math.round((today.getTime() - friday.getTime()) / DAY))
}

// --- the three tabs -----------------------------------------------------------

export type Tab = 'this_week' | 'next_week' | 'no_week'

export const TAB_LABEL: Record<Tab, string> = {
  this_week: 'This week',
  next_week: 'Next week',
  no_week: 'No week set',
}

/** Only deals that could still lodge. A settled or lost deal is not pending. */
function stillComing(deal: any): boolean {
  if (txt(deal?.status) === 'lost') return false
  const bucket = bucketOf(phaseOf(deal))
  return bucket === 'pre_lodgement' || bucket === 'lodged'
}

/**
 * WHICH TAB A DEAL BELONGS ON, OR NONE.
 *
 * A deal that lodged this week stays on This week, because the week should
 * read as a result rather than emptying itself as it succeeds. One that
 * slipped from an earlier week is on This week too - it is this week's problem
 * now, and a tab it cannot be seen on is a deal nobody chases.
 */
export function tabOf(deal: any, now: Date = new Date()): Tab | null {
  if (!stillComing(deal)) return null
  const plan = txt(deal?.lodgement_plan)
  // No answer, or the retired "later", both mean nobody has said a week.
  if (!plan || plan === 'later') return hasLodged(deal) ? null : 'no_week'
  if (plan !== 'week') return null
  const n = weeksFromNow(deal?.lodgement_week, now)
  if (n === null) return hasLodged(deal) ? null : 'no_week'
  if (n === 0) return 'this_week'
  if (n === 1) return hasLodged(deal) ? null : 'next_week'
  if (n < 0) return hasLodged(deal) ? null : 'this_week'
  return null
}

/**
 * The list for one tab: what has to be chased first, then what is in hand,
 * then what is already done - and oldest first inside each.
 */
export function onTab(deals: any[], tab: Tab, now: Date = new Date()): any[] {
  const rank: Record<Standing, number> = { slipped: 0, to_go: 1, lodged: 2 }
  return (deals || [])
    .filter(d => tabOf(d, now) === tab)
    .slice()
    .sort((a, b) => {
      const r = rank[standingOf(a, now)] - rank[standingOf(b, now)]
      if (r !== 0) return r
      return txt(phaseSince(a) || a?.created_at).localeCompare(txt(phaseSince(b) || b?.created_at))
    })
}

/** How many are on each tab, for the three pills. */
export function tabCounts(deals: any[], now: Date = new Date()): Record<Tab, number> {
  const out: Record<Tab, number> = { this_week: 0, next_week: 0, no_week: 0 }
  for (const d of deals || []) {
    const t = tabOf(d, now)
    if (t) out[t] += 1
  }
  return out
}
