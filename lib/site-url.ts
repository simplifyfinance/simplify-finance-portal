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

// THE PORTAL'S OWN ADDRESS, and the fallback if the setting ever goes missing.
//
// 14 Nov 2026. one.simplifyfinance.com.au went live: a CNAME at Crazy Domains
// to the project's own Vercel target, and NEXT_PUBLIC_SITE_URL set in Vercel.
//
// Until tonight this line read simplify-finance-portal.vercel.app, and the
// comment at the top of this file - written on 2 Oct - described exactly what
// was about to happen: NEXT_PUBLIC_SITE_URL had never been set, so all 59
// places that build a link had been quietly using this fallback. Every client
// link the portal has ever sent points at a hosting address.
//
// IT IS A REAL ADDRESS NOW, NOT A HOSTING ONE. If the Vercel setting is ever
// deleted, mistyped, or missing on a new environment, links fall back to
// somewhere that is still ours and still works, instead of somewhere that
// looks like a developer's test site. lib/site-url.test.ts fails the ship if
// a vercel.app address is ever written here again - which is the only way the
// old silence could come back.
export const DEFAULT_SITE_URL = 'https://one.simplifyfinance.com.au'

export function siteUrl(): string {
  const set = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim()
  // A trailing slash would turn every link into a double slash. Said here once
  // rather than remembered at 34 call sites.
  return (set || DEFAULT_SITE_URL).replace(/\/+$/, '')
}
