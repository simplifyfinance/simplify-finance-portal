// ASKING FOR THE REVIEW, UNTIL THE REVIEWS PROJECT EXISTS.
//
// 17 Nov 2026. Fabio first took the review out of the settlements build, then
// put it back: "why don't we just, as part of the emails, say there's a
// settlement email here that we ask for Google reviews just for the time being
// ... At least we're asking for reviews still while we're building the portal."
//
// He is right. The portal that knows who has already left a review is its own
// project, and until it exists the choice is between asking everybody once and
// asking nobody. Asking everybody once is plainly better, and it is what the
// settled email already does today.
//
// SO THIS IS DELIBERATELY DUMBER THAN THE RULE.
//
// The rule, pinned in Fabio's words on 16 Nov, is: ask at formal approval, and
// ask again at settlement ONLY where they did not leave one. That needs
// tracking. This asks once, in the settled email, of everybody. When reviews
// are tracked, this is the function that becomes conditional - see
// docs/backlog.md.
//
// ONE ASK, IN ONE EMAIL. Not the formal email as well. Two asks to someone who
// has already left a review is the exact thing the rule exists to prevent, and
// without tracking the only way to honour the spirit of it is to ask less.
const txt = (v: any) => String(v ?? '').trim()

/**
 * WHERE THE REVIEW GOES.
 *
 * Google's own write-a-review form for the Simplify Finance listing, by place
 * id. Fabio gave this on 17 Nov 2026 to replace the rebrand.ly shortener that
 * is in the settled email today.
 *
 * THE DIRECT LINK AND NOT THE SHORTENER, for three reasons. It opens the review
 * box itself rather than the listing, so there is one less click between a happy
 * client and a review. It cannot expire or be re-pointed outside the portal. And
 * it does not depend on a third party staying up - a dead shortener in a
 * settlement email is a broken link in the one email people actually read.
 *
 * It is a constant and not a setting on purpose: a review link changes about
 * never, and a setting nobody opens is a place for a broken link to hide. If
 * this is ever wrong, it is wrong in exactly one place.
 *
 * NOBODY EVER SEES IT. It is never printed in the body - see reviewButton.
 */
export const REVIEW_URL =
  'https://search.google.com/local/writereview?placeid=ChIJ3cU0iGlVDWsRfQR5lfAlpDs'

/**
 * THE BUTTON.
 *
 * Fabio: "make it a button so it's not that ridiculous link." The settled email
 * today shows the raw shortener in the body, which reads like something you
 * would not click in an email about your mortgage.
 *
 * Built by the same four rules lib/email-buttons.ts learned the hard way, and
 * for the same reasons:
 *
 *   1. the colour is on the <td> as a bgcolor ATTRIBUTE. Word paints a cell
 *      background from the attribute and throws away a CSS one on an anchor,
 *      which is how buttons arrived in Outlook on Windows as bare blue text.
 *   2. the text colour is on the ANCHOR. Word keeps a colour on a run and drops
 *      one on a paragraph.
 *   3. charcoal on the blue, not white. White on #2DBEFF is 2.1 to 1 and arrives
 *      looking like a pale wash; #343333 is 5.95 to 1 and reads as a solid thing.
 *   4. a line above it telling them to press it. A button with an instruction
 *      beside it gets pressed; one on its own gets scrolled past.
 */
export function reviewButton(url: string = REVIEW_URL): string {
  const href = txt(url)
  // NO BUTTON WITHOUT A LINK. An empty href renders as a button that does
  // nothing, which is worse than no button - see lib/email-buttons.ts on the
  // proceed button that quietly went to the booking page.
  if (!href) return ''
  return `<p style="font-size:13px;font-weight:600;margin:0 0 10px;line-height:1.5">`
    + `<span style="color:#343333;">If we have done right by you, a short Google review helps us more than you would think.</span></p>`
    + `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px"><tr>`
    + `<td bgcolor="#2DBEFF" align="center" style="background:#2DBEFF;border-radius:6px;padding:12px 22px">`
    + `<a href="${href}" style="color:#343333;font-size:14px;font-weight:700;text-decoration:none;display:inline-block">Leave us a review &nbsp;&rarr;</a>`
    + `</td></tr></table>`
}

/** The same ask in the plain text version of the email. */
export function reviewText(url: string = REVIEW_URL): string {
  const href = txt(url)
  if (!href) return ''
  return 'If we have done right by you, a short Google review helps us more than you would think: ' + href
}
