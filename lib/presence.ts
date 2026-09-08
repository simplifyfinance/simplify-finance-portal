// WHO ELSE IS IN THIS DEAL CARD.
//
// A name and a tab, drawn as a small circle in the deal header. It locks
// nothing, refuses nothing and warns about nothing - with live editing on, two
// people in one deal is a normal way to work rather than a hazard, and the only
// question worth answering is "who else is here right now".
//
// WHAT THE FIRST VERSION GOT WRONG (8 Sep 2026)
//
// It kept a row per person PER DEAL and deleted the old one when somebody moved
// on. Twenty two rows had built up: Ellie on eight deals at once, one row four
// and a half days old. The deletes were not landing and nobody noticed, because
// each browser then filtered the list using ITS OWN clock - so whether a ghost
// showed depended on whose laptop you were looking at.
//
// Fabio: "we had to ask her to physically log out of the portal for this to
// work."
//
// Both halves now live in the database. One row per person, so changing deal
// card overwrites it and a leftover cannot exist; and one clock deciding who
// has gone, so the answer is the same on every screen. See
// docs/deal-presence-v2.sql. This file is only the words and the arithmetic.

export type Presence = {
  userId: string
  name: string
  tab: string
  // How long since their last real heartbeat, measured by the DATABASE. Never
  // by a browser - see above.
  secondsAgo: number
}

// Often enough that somebody appears while you are still reading the screen.
export const HEARTBEAT_MS = 15_000

// Matches the interval in presence_others(). Kept here so the browser can be
// defensive about a row that arrives on the edge of it, never so the browser
// can make the decision itself.
export const GONE_AFTER_SECONDS = 60

// A TAB LEFT OPEN IS NOT A PERSON.
//
// The heartbeat used to fire for as long as the page existed, so somebody who
// opened a deal and wandered off to Outlook stayed "in the deal" until they
// logged out. Beating stops when the tab is hidden, and stops after this much
// quiet even when it is not - so presence means "here now" rather than "opened
// this at some point today".
export const IDLE_AFTER_MS = 120_000

const txt = (v: any) => String(v ?? '').trim()

// The server has already filtered by its own clock. This is a belt and braces
// pass for a row that was fresh when the query ran and is not by the time it is
// drawn - never the primary decision.
export function stillHere(rows: Presence[] | null | undefined, meId: string): Presence[] {
  return (rows || [])
    .filter(r => txt(r?.userId) && txt(r.userId) !== txt(meId))
    .filter(r => Number.isFinite(r?.secondsAgo) && r.secondsAgo < GONE_AFTER_SECONDS)
    .sort((a, b) => a.secondsAgo - b.secondsAgo)
}

// Two letters for the circle. "Katie Amos" is KA, "Ellie" is E.
export function initials(name: string): string {
  const parts = txt(name).split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

// What hovering over the circle says. A fact, not an instruction.
export function chipTitle(p: Presence): string {
  const who = txt(p.name) || 'Somebody else'
  const where = txt(p.tab)
  return where ? `${who} — ${where}` : `${who} is in this deal`
}

// Whoever else is on the tab this person is looking at. The forms use it to
// know they are not alone; nothing is shown to the person because of it.
export function sameTabNames(others: Presence[], myTab: string): string {
  const here = others.filter(o => txt(o.tab) === txt(myTab))
  return here.length === 0 ? '' : names(here)
}

export function names(rows: Presence[]): string {
  const list = [...new Set(rows.map(r => txt(r.name)).filter(Boolean))]
  if (list.length === 0) return 'Somebody else'
  if (list.length === 1) return list[0]
  return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]
}
