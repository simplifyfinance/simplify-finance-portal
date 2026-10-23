// THE DAY, DRAFTED BY THE PORTAL AND AGREED BY A PERSON.
//
// 22 Oct 2026. Fabio, on the email his credit team send every morning listing
// what they did yesterday and what they are doing today, which brokers then
// reply to with an order of priority:
//
//   "we ask for our credit team to send an email every morning with the tasks
//    that they have for the day... We have a portal, we have an ability to make
//    these a lot easier."
//
// Every name in that email is already on a deal, with a stage, an owner and a
// date. The email is a photograph of 8am; by 2pm it is wrong and nobody
// updates it.
//
// NOBODY TYPES A PLAN. The portal drafts it. The only thing a person does in
// the morning is agree with it, or change it and then agree. Fabio: "we have a
// summary ready for everything that they did the day before and a summary for
// what they do that day for them to mark them off to say, yep, this is what
// I'm doing, or they can change things."
//
// AND NOTHING BLOCKS. A locked screen gets worked around by lunchtime. What
// makes it stick is that not having done it is visible - to the other
// assessors, to the brokers, and to Fabio. See planBoard().
//
// CREDIT NEVER WAITS FOR A BROKER. Fabio: "let's say, for example, the broker
// is starting late or the broker is not there. So we need to account for all
// these things". Where no broker has said anything, the draft is ordered by
// how long each deal has been waiting - oldest first. That is a defensible
// day's work with nobody's input, and a broker arriving at 10:40 changes it
// from then on.
//
// This file is all arithmetic and no database on purpose, so the whole of it
// can be tested without one.

import { whoHasIt } from './who-has-it'
import { waitingIndex } from './deal-status'
import { toAuDate, todayYmd } from './periods'
import { ownerOf, stageWindow, type Stage } from './who-did-this-stage'
import { isWorkday } from './the-week'

export type PlanDeal = {
  id: string
  name: string
  /** 'BC' | 'LO' | 'Compliance' - which stage is waiting on this person. */
  stage: string
  /** When this deal last moved. The clock the draft orders by. */
  since: string | null
  /** Set by a broker, with their name and their reason. */
  priority?: { by: string; why: string; at: string } | null
}

export type Plan = {
  officerId: string
  officerName: string
  /** The deals, in the order they will be worked. */
  deals: PlanDeal[]
  /** Null until they have pressed "Yes - this is my day". */
  confirmedAt: string | null
}

const t = (v: any) => (v ? new Date(v).getTime() : 0)

// WHICH STAGE OF A DEAL IS SITTING WITH US, in the words the team uses. Read
// off the same ladder as everything else, never off deals.stage - that column
// only moves when a client presses Proceed. See lib/deal-status.ts.
export function stageWaitingOn(deal: any): string | null {
  if (!whoHasIt(deal) || whoHasIt(deal)!.holder !== 'us') return null
  const i = waitingIndex(deal)
  if (i === 0) return 'Fact Find'
  if (i === 1 || i === 2) return 'BC'
  if (i === 4 || i === 5) return 'LO'
  if (i === 7) return 'Compliance'
  return null
}

// IS CREDIT CARRYING THE STAGE THAT IS SITTING WITH US?
//
// 23 Oct 2026. A broker's own day must not list the deals credit is holding,
// or the same file is on two people's plans and counted twice. The answer is
// not "does this deal have a credit officer" - a deal can have had one on the
// BC and be back with the broker for the lending options. It is per stage,
// which is what lib/who-did-this-stage.ts was built for.
const STAGE_OF: Record<string, Stage> = { BC: 'bc', LO: 'lo', Compliance: 'compliance' }

export function creditHasIt(deal: any): { officerId: string; name: string } | null {
  const label = stageWaitingOn(deal)
  const stage = label ? STAGE_OF[label] : null
  if (!stage) return null
  const o = ownerOf(deal, stage)
  return o?.officerId ? { officerId: o.officerId, name: o.name } : null
}

// THE DRAFT. Priority deals first, in the order the brokers set them, then
// everything else oldest first.
//
// A deal with no `since` is treated as the oldest thing on the list rather
// than the newest: something we have no date for has been sitting there
// longer than anything we do have a date for.
export function draftDay(deals: PlanDeal[]): PlanDeal[] {
  const starred = deals.filter(d => d.priority)
  const rest = deals.filter(d => !d.priority)
  starred.sort((a, b) => t(a.priority!.at) - t(b.priority!.at))
  rest.sort((a, b) => (t(a.since) || 0) - (t(b.since) || 0))
  return [...starred, ...rest]
}

// WHAT FINISHED YESTERDAY, which is the half of the email nobody should ever
// type. A stage counts as finished by this person on this day if its
// completion stamp falls inside the day and the deal was theirs.
export type Finished = { id: string; name: string; what: string; days: number | null }

export function finishedOn(deals: any[], officerId: string, day: string): Finished[] {
  // A SYDNEY DAY, NOT THE MACHINE'S DAY.
  //
  // 23 Oct 2026, caught by the tests on Fabio's Mac after passing on a server
  // that runs in UTC. This compared milliseconds against midnight in whatever
  // zone the machine happened to be in. Two ways that is wrong at once: on
  // Vercel, which is UTC, "yesterday" ran from 11am Sydney to 11am Sydney, so
  // a stage finished at 4pm landed in the wrong day's list. And the answer
  // changed depending on who was looking.
  //
  // Same fault lib/rate-notice.ts had on 9 Oct, and for the same reason: the
  // business is in Australia and there is no reading of "yesterday" here that
  // means anything else. toAuDate() is the portal's one answer - see
  // lib/periods.ts.
  const inDay = (v: any) => !!v && toAuDate(v) === day
  const out: Finished[] = []

  for (const d of deals) {
    if (d?.assigned_credit_officer !== officerId) continue
    const held = d?.credit_assigned_at ? t(d.credit_assigned_at) : 0
    const span = (v: any) => held && t(v) > held
      ? Math.round(((t(v) - held) / 86_400_000) * 10) / 10 : null
    if (inDay(d?.bc_completed_at))
      out.push({ id: d.id, name: d.deal_name, what: 'BC', days: span(d.bc_completed_at) })
    if (inDay(d?.lo_completed_at))
      out.push({ id: d.id, name: d.deal_name, what: 'Lending options', days: span(d.lo_completed_at) })
    if (inDay(d?.compliance_completed_at))
      out.push({ id: d.id, name: d.deal_name, what: 'Compliance', days: span(d.compliance_completed_at) })
  }
  return out
}

// AND THE SAME LIST FOR EVERYBODY, NOT JUST ONE PERSON.
//
// 23 Oct 2026. The admin view asks what moved across the whole business, and
// a broker's asks what moved on their own files. Neither is about one credit
// assessor, which is all finishedOn() above can answer.
//
// The name beside each line is the stage's own owner - bc_owner_name and the
// two beside it - so a stage a broker did themselves says the broker, and a
// deal that passed through two people credits each of them with their own.
// The days are how long the stage had been open when they finished their part,
// measured from the moment the stage opened - the same clock the blue box on
// the deal runs on. Not from the day a credit officer was put on the deal,
// which is a different thing on any deal that changed hands.
export type FinishedBy = Finished & { who: string }

export function finishedAcross(deals: any[], day: string): FinishedBy[] {
  const inDay = (v: any) => !!v && toAuDate(v) === day
  const span = (from: any, to: any) => {
    const a = t(from), b = t(to)
    if (!a || !b || b < a) return null
    return Math.round(((b - a) / 86_400_000) * 10) / 10
  }
  const out: FinishedBy[] = []
  const stages: { stamp: string; what: string; name: string; stage: Stage }[] = [
    { stamp: 'bc_completed_at', what: 'BC', name: 'bc_owner_name', stage: 'bc' },
    { stamp: 'lo_completed_at', what: 'Lending options', name: 'lo_owner_name', stage: 'lo' },
    { stamp: 'compliance_completed_at', what: 'Compliance', name: 'compliance_owner_name', stage: 'compliance' },
  ]
  for (const d of deals) {
    for (const s of stages) {
      if (!inDay(d?.[s.stamp])) continue
      out.push({
        id: d.id, name: d.deal_name, what: s.what,
        days: span(stageWindow(d, s.stage).startedAt, d[s.stamp]),
        who: String(d?.[s.name] ?? '').trim(),
      })
    }
  }
  return out
}

// WHO HAS PLANNED, AND WHO HAS NOT. The whole enforcement mechanism, and it is
// one sentence per person. No locked screens.
export type BoardRow = { officerId: string; name: string; confirmedAt: string | null; count: number }

export function planBoard(plans: Plan[]): BoardRow[] {
  return plans
    .map(p => ({ officerId: p.officerId, name: p.officerName,
                 confirmedAt: p.confirmedAt, count: p.deals.length }))
    // Unplanned first, because that is the row somebody has to do something
    // about. Then by when they planned, earliest first.
    .sort((a, b) => {
      if (!a.confirmedAt && b.confirmedAt) return -1
      if (a.confirmedAt && !b.confirmedAt) return 1
      return t(a.confirmedAt) - t(b.confirmedAt)
    })
}

/** True once every assessor has agreed their day. What the brokers wait for. */
export function everybodyPlanned(plans: Plan[]): boolean {
  return plans.length > 0 && plans.every(p => !!p.confirmedAt)
}

// ---------------------------------------------------------------------------
// HALF PAST SEVEN
// ---------------------------------------------------------------------------
//
// 22 Oct 2026. Fabio: "every single day it will have it ready at X time... 8am
// I think is too late. So everything comes in at 7:30am."
//
// NO SCHEDULED JOB, DELIBERATELY. The draft is worked out from the queue
// whenever somebody asks for it, so it is always ready and there is no 7:30
// task that can fail quietly overnight and leave three people with a blank
// screen. What 7:30 actually is, is the moment the day starts counting: before
// it, nobody is late; after it, the clock is running.
export const DAY_STARTS = '07:30'

/** Minutes past 7:30 in Sydney. Negative before it. */
export function minutesIntoDay(now: Date, startsAt = DAY_STARTS): number {
  const [h, m] = startsAt.split(':').map(Number)
  // The clock on the wall in the office, never the clock on the machine. A
  // credit officer working from Manila and a server in UTC have to agree about
  // whether half past seven has happened.
  const hhmm = now.toLocaleTimeString('en-GB', {
    timeZone: 'Australia/Sydney', hour12: false, hour: '2-digit', minute: '2-digit',
  })
  const [nh, nm] = hhmm.split(':').map(Number)
  return (nh * 60 + nm) - (h * 60 + m)
}

/** Today, on the Sydney calendar. What a plan is filed against. */
export function planDay(): string { return todayYmd() }

/** The day before it, for the "yesterday you finished" list. */
export function dayBefore(day: string): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

// WHEN IT STOPS BEING A NUDGE AND STARTS BEING A FLAG. An hour is enough time
// to make a coffee and read yesterday; past 8:30 somebody is waiting on you.
export const NUDGE_AFTER = 0
export const FLAG_AFTER = 60

export type NotTold = {
  officerId: string
  name: string
  /** 'quiet' before 7:30, 'nudge' after it, 'flag' an hour later. */
  level: 'quiet' | 'nudge' | 'flag'
  /** What the person themselves reads. */
  mine: string
  /** What a broker reads about them. */
  theirs: string
  lateBy: number
}

// WHO HAS NOT TOLD THE BROKERS THEIR DAY.
//
// Fabio: "if each assessor has not communicated to the broker on their day, I
// like that. I like that it flags and say you haven't told your day to the
// brokers."
//
// The wording is his, and it is pointed on purpose. "Not planned yet" sounds
// like a tidiness problem. "You have not told the brokers your day" names the
// person who is waiting, which is the whole reason it matters.
export function notTold(plans: Plan[], now: Date, day: string = todayYmd()): NotTold[] {
  // NOBODY IS LATE ON A SATURDAY.
  //
  // 23 Oct 2026, Fabio: "there is weekends. So don't do that on the weekend.
  // So it's 7:30 Monday to Friday." Without this line, Saturday at 8:30 tells
  // four people they have not told the brokers their day and goes on counting
  // all weekend, so Monday's flag reads 48 hours for a day nobody worked.
  // NSW public holidays count as weekends - see lib/the-week.ts.
  if (!isWorkday(day)) return []
  const late = minutesIntoDay(now)
  const level: NotTold['level'] =
    late < NUDGE_AFTER ? 'quiet' : late < FLAG_AFTER ? 'nudge' : 'flag'

  return plans
    .filter(p => !p.confirmedAt)
    .map(p => ({
      officerId: p.officerId,
      name: p.officerName,
      level,
      lateBy: Math.max(0, late),
      mine: level === 'quiet'
        ? 'Your day is ready whenever you are.'
        : level === 'nudge'
          ? 'You have not told the brokers your day yet.'
          : `You have not told the brokers your day. They have been waiting ${hoursWord(late)}.`,
      theirs: level === 'quiet'
        ? `${p.officerName} has not started yet`
        : level === 'nudge'
          ? `${p.officerName} has not told you their day yet`
          : `${p.officerName} has not told you their day \u2014 ${hoursWord(late)}`,
    }))
}

function hoursWord(mins: number): string {
  if (mins < 90) return `${Math.max(1, Math.round(mins / 10) * 10)} minutes`
  const h = Math.round(mins / 60)
  return h === 1 ? 'an hour' : `${h} hours`
}
