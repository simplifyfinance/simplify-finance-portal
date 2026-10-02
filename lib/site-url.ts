// WHERE THIS PORTAL LIVES. ONE ANSWER, AND NOTHING ELSE IN HERE.
//
// 2 Oct 2026. Counted before writing this: the address was typed out longhand
// in 34 places across 14 files. siteUrl() already existed and was meant to be
// the single answer - but 21 of the 34 were in the email builder, which wrote
// the address out by hand instead of asking.
//
// Today those two agree, so nothing is broken and nobody has noticed. The day a
// real domain is pointed at this portal, every client email would still send
// people to a vercel.app link, and the first anybody would hear of it is a
// client asking why the page looks untrustworthy.
//
// That is the same fault as every bug we fixed in September: one fact with more
// than one home, free to drift apart the moment one of them changes.
//
// THIS FILE IMPORTS NOTHING, ON PURPOSE. The login screen is a browser
// component and needs the address for the password reset link. siteUrl() used
// to live in lib/ready-link.ts, which imports node's crypto to sign tokens -
// importing that into the browser drags the signing code in with it. So the
// address lives alone, and ready-link re-exports it for everything that already
// asked it.
//
// NEXT_PUBLIC_ is deliberate: Next.js only hands a variable to the browser when
// it carries that prefix, and the login screen is the browser.

// The address this portal is served from today. Kept as the fallback rather
// than deleted, so that a missing setting means "carry on as before" instead of
// sending clients to an empty string.
export const DEFAULT_SITE_URL = 'https://simplify-finance-portal.vercel.app'

export function siteUrl(): string {
  const set = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim()
  // A trailing slash would turn every link into a double slash. Said here once
  // rather than remembered at 34 call sites.
  return (set || DEFAULT_SITE_URL).replace(/\/+$/, '')
}
