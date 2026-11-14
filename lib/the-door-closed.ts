// THE MOMENT THE PORTAL STOPS KNOWING WHO YOU ARE.
//
// 13 Nov 2026. When a session runs out the middleware DELETES the browser's
// credentials - deliberately, because a laptop on a train has to be signed out
// properly - and redirects the page to the sign-in screen.
//
// It only redirects the page somebody is looking at. Katie's tab was not
// navigating anywhere; it was talking straight to the database in the
// background. Her credentials were taken away underneath her and the tab
// carried on.
//
// AND THE DATABASE ANSWERS AN UNKNOWN CALLER WITH SILENCE, NOT AN ERROR. Row
// level security returns no rows. Not a 401, not a message - nothing. Every box
// on her screen was empty and nothing said why. She worked into a dead form for
// an hour. Four hundred requests.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE DOES NOT TOUCH A SINGLE REQUEST
// ---------------------------------------------------------------------------
//
// The first version of this wrapped the fetch that every database call goes
// through, so it could watch each one leave. It broke the portal: sixty-eight
// browser tests failed, no deal card would load at all, and Fabio lost a ship
// to it minutes before a meeting.
//
// So nothing here sits between the portal and its data. There are three ways to
// find out, and all three are things the portal already does:
//
//   1. THE HEARTBEAT WE ALREADY SEND. components/StillHere.tsx posts to
//      /api/2fa/touch when somebody types, at most once every five minutes. The
//      middleware already answers 401 on that route when the session is gone.
//      Reading the answer to a request we were making anyway costs nothing.
//
//   2. THE COOKIE, ONCE A MINUTE. Asking the browser whether it still holds a
//      session is local - no network, nothing to break - and it works when
//      nobody is typing.
//
//   3. COMING BACK TO THE TAB. Somebody returning from lunch finds out when
//      they look, not when they type.
//
// Any one of them is enough. Together they catch it within a minute, which is
// the difference between redoing nothing and redoing an afternoon.

export type Listener = () => void

const listeners = new Set<Listener>()
let closed = false

/** How often the cookie is looked at when nobody is typing. */
export const LOOK_EVERY_MS = 60_000

/**
 * WHAT THE HEARTBEAT'S ANSWER MEANS.
 *
 * 401 is the middleware saying "you are signed out" in its own words, and it is
 * the only status that means it. Anything else - a network failure, a 500, a
 * rate limit - is not evidence of anything. Wifi drops and servers hiccup, and
 * locking somebody's screen for that would be a worse fault than the one being
 * fixed.
 */
export function heartbeatSaysOut(status: any): boolean {
  return Number(status) === 401
}

/**
 * WHAT THE BROWSER'S OWN COOKIE SAYS.
 *
 * No session at all is the plain case. An expired one is the same thing a
 * moment later. ANYTHING WE CANNOT READ IS NOT TREATED AS SIGNED OUT - the
 * version of this file that broke the portal counted "I could not tell" as
 * "nobody is there", and locked every screen in the business.
 */
export function cookieSaysOut(session: any, now: number = Date.now()): boolean {
  if (session === undefined || session === null) return true
  if (typeof session !== 'object') return false
  const until = Number((session as any).expires_at)
  if (!Number.isFinite(until) || until <= 0) return false
  return until * 1000 <= now
}

/** Everybody is told once, and only once. */
export function theDoorHasClosed(): void {
  if (closed) return
  closed = true
  // THE WORK COMES FIRST. Every listener here writes somebody's unsaved typing
  // to their own browser before anything draws, because the screen is about to
  // promise them their work is safe and that has to be true already.
  for (const fn of listeners) { try { fn() } catch { /* one failure is not all */ } }
}

export function theDoorClosed(): boolean { return closed }

export function onDoorClosed(fn: Listener): () => void {
  listeners.add(fn)
  if (closed) { try { fn() } catch { /* nothing useful to do here */ } }
  return () => { listeners.delete(fn) }
}

/** Tests, and a tab that has signed in again. */
export function openTheDoorAgain(): void {
  closed = false
  listeners.clear()
}
