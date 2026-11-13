// WORKING COUNTS AS BEING THERE.
//
// 13 Nov 2026, and this one cost somebody an afternoon.
//
// Katie signed in at 1:42pm. At 3:11pm she saved Jayver Varghese's compliance
// card - the database has the write, 200, her name on it. At 3:14pm the portal
// signed her out for being inactive for an hour.
//
// Her tab did not notice. It carried on talking to the database with no
// credentials, which answers an unknown caller with silence rather than an
// error, so the screen looked perfectly normal and every box on it was empty.
// She kept working into a form that could not read or write anything. Four
// hundred requests came back empty before anybody realised.
//
// Fabio: "we now just realized that you wasted my staff's hour and we need
// this fix once and forever."
//
// WHY THE OLD RULE WAS WRONG. On 21 Oct I built the heartbeat to be as strict
// as I could make it, because the fault being fixed that day was the opposite
// one - "I leave the portal open and it stays open overnight". So only a
// keydown or a pointerdown told the server anybody was there.
//
// That measures the wrong thing. The portal saves as you type, so the proof
// that somebody is at their desk is not a keystroke I happened to catch - it
// is THE PORTAL WRITING THEIR WORK TO THE DATABASE. A save cannot happen
// without a person. Nothing about a laptop left open overnight produces one.
//
// So a save now says "somebody is here", and the overnight case is untouched:
// a tab nobody is using saves nothing, presses nothing, and still times out.
import { TOUCH_EVERY_MS } from './two-factor'

// ---------------------------------------------------------------------------
// THE RULE, AS A FUNCTION OF ITS ARGUMENTS
// ---------------------------------------------------------------------------

/**
 * Has it been long enough to tell the server again?
 *
 * The server is told at most once every five minutes however hard somebody is
 * typing. A person hammering a keyboard and a person saving a form every
 * thirty seconds cost the same: one request per five minutes.
 */
export function shouldTell(lastToldAt: number, now: number): boolean {
  if (!Number.isFinite(lastToldAt) || lastToldAt <= 0) return true
  return now - lastToldAt >= TOUCH_EVERY_MS
}

/** Everything that means a real person is at the keyboard. */
export const SIGNS_OF_LIFE = ['keydown', 'pointerdown', 'touchstart', 'input'] as const

// ---------------------------------------------------------------------------
// TELLING THE SERVER
// ---------------------------------------------------------------------------
//
// One counter for the whole tab. The listener in components/StillHere.tsx and
// every checked write share it, so a person typing and saving does not send
// two heartbeats where one will do.

let lastTold = 0

/** For tests, and for a tab that has just signed in again. */
export function forgetLastTold(): void {
  lastTold = 0
}

/**
 * SOMEBODY IS HERE.
 *
 * Fire and forget. A failed heartbeat costs nothing - the next keystroke or
 * the next save sends another. It must never be awaited by a save path and it
 * must never be able to throw into one.
 */
export function someoneIsHere(now: number = Date.now()): void {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return
  // A HIDDEN TAB IS NOT SOMEBODY WORKING. A background tab that receives a key
  // event, or finishes a write queued before it was hidden, must not hold the
  // session open. Same rule the old listener had.
  if (typeof document !== 'undefined' && document.hidden) return
  if (!shouldTell(lastTold, now)) return
  lastTold = now
  try {
    fetch('/api/2fa/touch', { method: 'POST', keepalive: true }).catch(() => {})
  } catch {
    // A heartbeat that cannot be sent is not an error anybody should see.
  }
}
