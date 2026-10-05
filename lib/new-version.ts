// IS THE PORTAL ON SCREEN STILL THE ONE WE SHIPPED?
//
// 6 Oct 2026. Fabio ships four or five times a day. A tab left open keeps
// running the version it loaded, and there is nothing on the screen to say so -
// which is how he spent an afternoon on a dark mode button that was already
// fixed, and why the answer to every report became "did you hard refresh?".
//
// Nobody should have to be told to hard refresh. The portal asks whether the
// version it is running is still the current one, and when it is not, the
// sidebar says so. See docs/approved-looks/one-new-version.html, layout C.
//
// NOTHING HERE TOUCHES REACT, so the rules can be tested without a browser.

/** Stamped into the build by next.config.ts. 'dev' on a laptop. */
export const BUILD = process.env.NEXT_PUBLIC_BUILD_ID || 'dev'

/** Ask again on this cycle, and whenever the tab is looked at again. */
export const CHECK_MS = 5 * 60 * 1000

/** Where the question is asked. */
export const VERSION_URL = '/api/version'

// THE RULE, AND EVERY WAY IT MUST SAY NO.
//
// A wrong "yes" is worse than a missed "no": it tells somebody mid-deal to
// reload for nothing. So anything uncertain - a missing answer, a blank, a
// laptop build, a request that came back as the login page - is NOT a new
// version.
export function isNewer(mine: unknown, theirs: unknown): boolean {
  if (typeof mine !== 'string' || typeof theirs !== 'string') return false
  const a = mine.trim(), b = theirs.trim()
  if (!a || !b) return false
  if (a === 'dev' || b === 'dev') return false   // nothing is shipped on a laptop
  return a !== b
}
