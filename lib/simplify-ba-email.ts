import { emailShell, shellButton, FONT } from './email-shell'
import { type Brand, DEFAULT_BRAND } from './brand'

// THE BUYERS AGENCY EMAIL.
//
// 9 Oct 2026, built from Fabio's John Halliday.docx. The first template in this
// folder that is not about lending at all - Simplify Buyers Agency introducing
// itself, and the proof it offers is a purchase outcome rather than a loan.
//
// EVERY WORD IS OUT OF THAT DOCUMENT, IN ITS ORDER.
//
// Fabio, after three drafts where I rewrote his wording without being asked:
// "DO NOT CHANGE A SINGLE WORD". So the copy below is the document, copied
// across character for character - its curly apostrophes, its em dash, its
// capitals, and its own order including House B before House A. The design
// here is the LAYOUT and nothing else. lib/the-ba-email-is-his.test.ts holds
// each line against the document so a later tidy-up cannot quietly reword it.
//
// AND THE NAMES ARE NOT INTERCHANGEABLE. The prose says "Simplify Buyers
// Agency"; only the heading says "THE SIMPLIFY BA DIFFERENCE". That is how he
// wrote it and it is not an inconsistency to fix.
//
// NOTHING IS CALCULATED PER CLIENT. Like the negative gearing and price
// opportunity emails, the argument rests on one real comparison and the only
// variables are who it is addressed to and who it comes from.
//
// WHY THE DISCLAIMER IS NOT THE ONE NEXT DOOR. The other templates disclaim tax
// and credit advice, because that is what they are near. This one makes
// PERFORMANCE claims - a portfolio that grew from $170.1m to $257.2m, and 12.3%
// a year - and performance claims need their own words.

export type SimplifyBaContext = {
  // Which trading name this goes out under. A buyers agency email should be
  // sent under the buyers agency brand; it falls back to the default so an
  // email built without one is still correctly identified rather than blank.
  brand?: Brand
  clientFirstName: string
  brokerName: string
  calendlyUrl: string
}

// THE ACCENT IS THE BRAND'S, NOT THIS FILE'S.
//
// A brand with its own accent colour uses it, so this email looks like whoever
// is sending it. GREEN is only the fallback, for a brand record that has not
// set one - chosen because the buyers agency reads green rather than the
// finance blue, and a buyers agency email in finance blue is the wrong firm.
const GREEN = '#15614A'
const GREEN_DARK = '#0E4435'
const GREEN_TINT = '#F0F7F3'
const GREEN_EDGE = '#CFE5DA'
const BORDER = '#E4E2DC'
const INK = '#1a1a1a'
const BODY = '#3d3d3a'
const GREY = '#6b6b66'
const FADED = '#8a8a84'   // House A - the higher price, deliberately receded

// PERFORMANCE CLAIMS CARRY THEIR OWN CAVEAT. The portfolio figures and the
// 12.3% are the whole argument of this email, so the caveat sits under them
// rather than being implied.
export const DISCLAIMER =
  'General information only. This email is not financial, tax, credit or investment advice and does ' +
  'not take account of your objectives, financial situation or needs. The portfolio figures and the ' +
  'growth rate describe past results across a client portfolio over a particular period; ' +
  'past performance is not a reliable indicator of future performance and your own result will ' +
  'differ. ' +
  'The two properties shown are a single example, and the prices are those achieved on those ' +
  'purchases rather than a valuation or a forecast. Rental yields vary and are not guaranteed. ' +
  'Please seek your own professional advice before acting.'

// --- his words, verbatim ---------------------------------------------------
//
// Named constants rather than inline strings, so the test file can hold the
// exact same values against the document without copying them a second time.
export const OPENING = [
  'At Simplify Buyers Agency, we believe successful property buying is about more than simply ' +
  'finding a property — it’s about making the right purchase, at the right price, at the right time.',
  'Leading our Buyers Agency, John Halliday brings more than 35 years of property experience across ' +
  'property investment, consulting and negotiation. His focus is simple: helping our clients buy ' +
  'strategically, avoid costly mistakes and make confident property decisions.',
  'And the results speak for themselves. John’s client portfolio has grown from $170.1 million in ' +
  'property acquired to a current assessed value of $257.2 million, with properties held for at ' +
  'least 12 months delivering average annualised capital growth of 12.3% p.a.',
]

export const DIFFERENCE_HEADING = 'THE SIMPLIFY BA DIFFERENCE'
export const DIFFERENCE_POINTS = ['Industry Knowledge', 'Market Timing', 'Professional Negotiation']
export const OUTCOME = '$85,000 BETTER PURCHASE OUTCOME'
export const IDENTICAL = 'IDENTICAL PROPERTIES  |  SAME LOCATION  |  PURCHASED JUST 12 WEEKS APART'
export const TIMING_HEADING = 'THE DIFFERENCE WAS MORE THAN JUST TIMING'

// HOUSE B FIRST. That is the order in the document, and it is the right one:
// the better outcome is the point of the comparison, so it leads rather than
// being the answer you reach after reading the worse one.
export const HOUSE_B = {
  name: 'House B',
  price: '$975,000',
  timing: 'Post Federal Budget announcement',
  difference: '$85,000 lower',
}
export const HOUSE_A = {
  name: 'House A',
  price: '$1,060,000',
  timing: 'Prior to Federal Budget announcement',
  difference: '—',
}

export const CLOSING = [
  'With two identical properties purchased just 10km from Melbourne CBD, the $85,000 difference ' +
  'demonstrates the value of combining industry knowledge, an understanding of market timing, and ' +
  'professional negotiation.',
  'Knowing when to buy, what a property is truly worth and how to negotiate effectively can create ' +
  'a significantly better purchase outcome.',
  'A brand-new investment property delivering a 4.8% rental yield, with the added benefits ' +
  'available through a new-property investment.',
]

export const SUBJECT = 'The $85,000 difference between two identical houses'
export const BOOK_LABEL = 'Book a 15-minute chat'

// --- the pieces ------------------------------------------------------------

const p = (t: string) =>
  `<p style="margin:0 0 15px;font-family:${FONT};font-size:15px;color:${BODY};line-height:1.65;"><span style="color:${BODY};">${t}</span></p>`

const heading = (t: string, colour: string) =>
  `<p style="margin:26px 0 9px;font-family:${FONT};font-size:11px;font-weight:bold;letter-spacing:1.3px;color:${colour};text-align:center;"><span style="color:${colour};">${t}</span></p>`

const timingHeading = (t: string) =>
  `<p style="margin:26px 0 14px;font-family:${FONT};font-size:14px;font-weight:bold;letter-spacing:.5px;color:${INK};"><span style="color:${INK};">${t}</span></p>`

// THE THREE CLAIMS. One table cell each so Word keeps them on one line, and the
// colour is on the cell rather than the text - Word paints a background from a
// bgcolor attribute and throws the CSS away. See lib/email-shell.ts.
function points(tint: string, edge: string, dark: string): string {
  const cell = (t: string, last: boolean) =>
    `<td align="center" bgcolor="${tint}" style="background-color:${tint};border:1px solid ${edge};padding:9px 8px;font-family:${FONT};font-size:12.5px;font-weight:600;color:${dark};${last ? '' : 'border-right-width:0;'}"><span style="color:${dark};">${t}</span></td>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 4px;"><tr>
${DIFFERENCE_POINTS.map((t, i) => cell(t, i === DIFFERENCE_POINTS.length - 1)).join('')}
</tr></table>`
}

// THE OUTCOME, AS ONE SOLID BAND. The loudest thing in the email, because it is
// the whole argument in six words.
const outcome = (accent: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;"><tr>
<td align="center" bgcolor="${accent}" style="background-color:${accent};border-radius:8px;padding:16px 14px;font-family:${FONT};font-size:19px;font-weight:bold;letter-spacing:.3px;color:#ffffff;"><span style="color:#ffffff;">${OUTCOME}</span></td>
</tr></table>`

const identical = () =>
  `<p style="margin:18px 0 9px;font-family:${FONT};font-size:11px;font-weight:bold;letter-spacing:.8px;color:${FADED};text-align:center;"><span style="color:${FADED};">${IDENTICAL}</span></p>`

// THE TWO HOUSES, AS CARDS. Their site lays every result out this way - the
// place, the price, and what it came to - so an email that argues the same
// point should not argue it in a different shape.
function cards(tint: string, edge: string, dark: string, accent: string): string {
  const card = (h: typeof HOUSE_B, win: boolean) => {
    const bg = win ? tint : '#ffffff'
    const line = win ? edge : BORDER
    const label = win ? accent : FADED
    const price = win ? dark : FADED
    const diff = win ? dark : FADED
    return `<td width="50%" valign="top" bgcolor="${bg}" style="background-color:${bg};border:1px solid ${line};border-radius:8px;padding:15px 12px;font-family:${FONT};">
<div style="font-size:11.5px;font-weight:bold;letter-spacing:.8px;color:${label};text-align:center;"><span style="color:${label};">${h.name.toUpperCase()}</span></div>
<div style="font-size:25px;font-weight:bold;color:${price};text-align:center;padding:8px 0 7px;"><span style="color:${price};">${h.price}</span></div>
<div style="font-size:11.5px;line-height:1.45;color:${GREY};text-align:center;"><span style="color:${GREY};">${h.timing}</span></div>
<div style="font-size:12px;font-weight:bold;color:${diff};text-align:center;border-top:1px solid ${line};margin-top:9px;padding-top:9px;"><span style="color:${diff};">${h.difference}</span></div>
</td>`
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${card(HOUSE_B, true)}<td width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>${card(HOUSE_A, false)}
</tr></table>`
}

function signature(brokerName: string, brandName: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;"><tr>
<td bgcolor="#ffffff" style="background-color:#ffffff;border-top:1px solid ${BORDER};padding:16px 0 0;font-family:${FONT};font-size:14px;color:${BODY};line-height:1.6;">
<span style="color:${BODY};">Kind regards,<br><span style="font-weight:600;color:${INK};">${brokerName}</span><br>${brandName}</span>
</td></tr></table>`
}

function plain(name: string, brokerName: string, brandName: string, calendlyUrl: string): string {
  return [
    `Hi ${name},`, '',
    ...OPENING.flatMap(t => [t, '']),
    DIFFERENCE_HEADING,
    DIFFERENCE_POINTS.join('  |  '), '',
    OUTCOME, '',
    IDENTICAL,
    `  ${HOUSE_B.name}  ${HOUSE_B.price}  ${HOUSE_B.timing}  ${HOUSE_B.difference}`,
    `  ${HOUSE_A.name}  ${HOUSE_A.price}  ${HOUSE_A.timing}  ${HOUSE_A.difference}`, '',
    TIMING_HEADING, '',
    ...CLOSING.flatMap(t => [t, '']),
    ...(calendlyUrl ? [`${BOOK_LABEL}: ${calendlyUrl}`, ''] : []),
    'Kind regards,', brokerName, brandName, '',
    DISCLAIMER,
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function buildSimplifyBaEmail(ctx: SimplifyBaContext): {
  subject: string
  html: string
  plainText: string
} {
  const brand = ctx.brand || DEFAULT_BRAND
  const name = String(ctx.clientFirstName || '').trim() || 'there'
  const accent = String(brand.accentColor || '').trim() || GREEN
  // The tinted pieces stay the green family unless the brand is on the default
  // accent, in which case they follow it. A brand that has set its own accent
  // gets that accent on the loud elements and the neutral tint behind the rest,
  // which reads correctly whatever colour it chose.
  const dark = accent === GREEN ? GREEN_DARK : accent
  const tint = GREEN_TINT
  const edge = GREEN_EDGE

  const body =
    p(`Hi ${name},`) +
    OPENING.map(p).join('') +
    heading(DIFFERENCE_HEADING, accent) +
    points(tint, edge, dark) +
    outcome(accent) +
    identical() +
    cards(tint, edge, dark, accent) +
    timingHeading(TIMING_HEADING) +
    CLOSING.map(p).join('') +
    (ctx.calendlyUrl ? shellButton(ctx.calendlyUrl, BOOK_LABEL, accent) : '') +
    signature(ctx.brokerName, brand.name)

  return {
    subject: SUBJECT,
    html: emailShell(body, DISCLAIMER, brand),
    plainText: plain(name, ctx.brokerName, brand.name, ctx.calendlyUrl),
  }
}
