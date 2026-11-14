// HE PRESSED IT, SO IT IS WRITTEN DOWN.
//
// 14 Nov 2026. Fabio, on the broker screen, 12 Nov: "That is my week raises a
// red mark for admin."
//
// It never could. The pill at the bottom of components/BrokerWeek.tsx was a
// <span> - text styled to look exactly like a solid dark button. No onClick,
// no write, nothing recorded. A broker pressed it, believed he had told the
// office, and the office had no way to know he had ever opened the page.
//
// Fabio, 14 Nov, when I showed him: "Why would I leave a button fake?"
//
// THE SAME FAULT AS THE PUSH WITH NO MARK. A thing that looks like it did
// something and leaves nothing behind. See CLAUDE.md, "A step that can fail
// silently is the worst kind".
//
// ---------------------------------------------------------------------------
// WHAT IS STORED, AND WHY THERE
// ---------------------------------------------------------------------------
//
// One column: user_profiles.week_done_at. Not on the brokers table.
//
// A self-employed broker already writes to his own user_profiles row every
// time he changes the theme or folds a board column - see lib/use-theme-choice.ts
// and lib/use-column-folds.ts. So that row is somewhere he is already allowed
// to write. The brokers table is only ever written by admin screens
// (components/BrokerProfiles.tsx), and a policy that quietly refuses him would
// return no rows and no error, which is the failure this whole file exists to
// stop.
//
// ---------------------------------------------------------------------------
// THE WEEK IS SYDNEY'S WEEK
// ---------------------------------------------------------------------------
//
// mondayOf() in lib/lodging-when.ts asks the machine - getDay(), getDate().
// Today every caller of it is a browser in the office, so it is right. It is
// still not something to build a new rule on: the same question asked from the
// server at 10am Sydney on a Monday is answered with LAST Monday, because the
// server is on UTC and it is still Sunday night there.
//
// So this file resolves the week in Australia/Sydney and never asks the
// machine. See CLAUDE.md, "The clock is Sydney's".
import { OFFICE, nowInSydney } from './same-date-everywhere'

const DAY = 86_400_000

/** The office's calendar day for a moment in time, as yyyy-mm-dd. */
export function dayInSydney(value: any): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const at = new Date(raw)
  if (!Number.isFinite(at.getTime())) return null
  // en-CA spells a date yyyy-mm-dd, which is the one spelling that sorts and
  // compares as a plain string.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: OFFICE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(at)
}

/**
 * THE MONDAY OF THE WEEK WE ARE IN, in the office's week.
 *
 * Sunday belongs to the week that started six days ago, not to the one about
 * to start - a broker answering on a Sunday night is answering about the week
 * that is ending.
 */
export function mondayInSydney(now: Date = new Date()): string {
  const today = dayInSydney(now)
  if (!today) return ''
  const [y, m, d] = today.split('-').map(Number)
  const noon = Date.UTC(y, m - 1, d)
  const back = (new Date(noon).getUTCDay() + 6) % 7
  return new Date(noon - back * DAY).toISOString().slice(0, 10)
}

/**
 * HAS HE BEEN THROUGH IT THIS WEEK?
 *
 * The column holds the last time he pressed it, ever. It counts for this week
 * only if that moment falls on or after this week's Monday - so the mark
 * clears itself every Monday morning without anything having to reset it.
 */
export function wentThrough(row: any, now: Date = new Date()): boolean {
  const day = dayInSydney(row?.week_done_at)
  if (!day) return false
  const monday = mondayInSydney(now)
  return !!monday && day >= monday
}

/** "8:42 am", in the office's clock, or '' if he has not pressed it. */
export function wentThroughAt(row: any, now: Date = new Date()): string {
  if (!wentThrough(row, now)) return ''
  const at = new Date(String(row?.week_done_at))
  return Number.isFinite(at.getTime()) ? nowInSydney(at) : ''
}

/** What the press writes. One field, so it can never clear anything else. */
export function donePatch(at: Date = new Date()): { week_done_at: string } {
  return { week_done_at: at.toISOString() }
}

// ---------------------------------------------------------------------------
// WHAT EACH SIDE SHOWS
// ---------------------------------------------------------------------------

export type WeekMark = { done: boolean; words: string }

/**
 * THE MARK ON THE ADMIN RUN-THROUGH, and only there.
 *
 * NOTHING ON THE BROKER'S OWN SCREEN EVER GOES RED. Keanen and Justin are not
 * managed, they are not on the target and there is no league table - see the
 * header of lib/the-brokers-monday.ts. The mark exists so the people running
 * the Monday meeting can tell a broker with nothing coming apart from a broker
 * who has not looked. Those two are the same silence, and acting on the wrong
 * one is how you insult somebody who did their job.
 */
export function weekMark(row: any, now: Date = new Date()): WeekMark {
  const at = wentThroughAt(row, now)
  if (at) return { done: true, words: `Went through it · ${at}` }
  return { done: false, words: 'Has not been through it' }
}

/** What the broker's own button says. Never a nag, in either state. */
export function buttonWords(row: any, now: Date = new Date()): string {
  return wentThrough(row, now) ? 'Told the team' : 'That is my week'
}

/** The line beside his button once he has pressed it. */
export function toldAtWords(row: any, now: Date = new Date()): string {
  const at = wentThroughAt(row, now)
  return at ? at : ''
}
