import { emailShell, shellButton, FONT } from './email-shell'
import { type Brand, DEFAULT_BRAND } from './brand'

// THE REFERRAL PARTNER EMAIL.
//
// The first template addressed to somebody who is not a client. It goes to an
// accountant about the clients they look after, so it says "your clients"
// throughout and never "you" - the reader is not the borrower.
//
// The wording is Fabio's, pasted whole on 10 Sep 2026 and used verbatim. The
// only words here that are not his are the greeting and the sign-off. Anything
// that reads oddly in the sent email is a wording question for him, not
// something to smooth over here.
//
// Nothing is calculated and nothing varies by reader: the argument is the same
// for every accountant, so the only variables are who it is addressed to, who
// it comes from, and the brand it wears.

export type ReferralPartnerContext = {
  brand?: Brand
  // The form calls this clientFirstName for every template. Here it is the
  // referrer - the accountant - not a borrower.
  clientFirstName: string
  brokerName: string
  calendlyUrl: string
}

const CYAN = '#2DBEFF'
const TINT = '#F4FAFE'
const INK = '#1a1a1a'
const BODY = '#3d3d3a'
const GREY = '#6b6b66'

// The asterisks in the body point here. It is the small print at the foot of
// the white body, dark on light, for the reason set out in email-shell.ts.
const DISCLAIMER =
  'Eligibility, fees, loan terms and product features are subject to lender policy, assessment ' +
  'criteria and individual borrower circumstances.'

const p = (t: string) =>
  `<p style="margin:0 0 14px;font-family:${FONT};font-size:14.5px;color:${BODY};line-height:1.7;"><span style="color:${BODY};">${t}</span></p>`

// A section heading. The other templates have none - they are one argument each
// - but this one is a briefing with three parts, and unbroken it is a wall.
const h = (t: string) =>
  `<p style="margin:24px 0 10px;font-family:${FONT};font-size:16.5px;font-weight:600;color:${INK};line-height:1.4;"><span style="color:${INK};">${t}</span></p>`

// BULLETS AS A TABLE, NOT A <ul>.
//
// Outlook on Windows renders through Word, which gives a <ul> its own margins
// and its own bullet glyph and ignores most of what is asked of it. A two-cell
// row per point is the shape that survives: the marker is a cell, so it cannot
// be restyled out, and the text wraps under itself rather than under the dot.
const bullets = (items: string[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px;">` +
  items.map(t =>
    `<tr><td width="18" valign="top" style="padding:0 0 9px;font-family:${FONT};font-size:14.5px;color:${CYAN};line-height:1.7;">&bull;</td>` +
    `<td style="padding:0 0 9px;font-family:${FONT};font-size:14.5px;color:${BODY};line-height:1.7;"><span style="color:${BODY};">${t}</span></td></tr>`
  ).join('') +
  `</table>`

// The tinted block the other templates use for their one key idea.
const keyBlock = (line: string, payoff?: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 12px;"><tr>
<td width="3" bgcolor="${CYAN}" style="background-color:${CYAN};width:3px;font-size:0;line-height:0;">&nbsp;</td>
<td bgcolor="${TINT}" style="background-color:${TINT};padding:15px 17px;font-family:${FONT};">
<div style="font-size:18.5px;font-weight:600;line-height:1.4;color:${INK};"><span style="color:${INK};">${line}</span></div>` +
  (payoff ? `<div style="font-size:15px;font-weight:600;color:#0B6F9E;padding-top:4px;"><span style="color:#0B6F9E;">${payoff}</span></div>` : '') +
  `</td></tr></table>`

const CAN_ASSIST = [
  'Refinancing private lending into longer-term loan structures, including terms of up to 30 years*',
  'Consolidating ATO debt and unsecured liabilities into a structured lending facility',
  'Lending solutions for company and trust structures',
  'Access to selected products with no risk fee*',
  'Access to selected products with no valuation fees*',
  'Alternative Income Verification &mdash; Accountant&rsquo;s Declaration or BAS only',
]

const OUR_FOCUS = [
  'Reducing repayment pressure',
  'Consolidating multiple liabilities',
  'Creating greater certainty and long-term stability',
  'Establishing a clear pathway beyond short-term lending',
]

const WHO_TO_REFER = [
  'A client currently in private lending who needs an exit strategy',
  'A business owner carrying ATO or unsecured debt',
  'A borrower operating through a company or trust structure',
  'A client who no longer meets traditional bank servicing requirements',
  'A self-employed or complex-income borrower who needs greater flexibility',
]

// The plain text alternative strips the markup back to words. `&mdash;` and
// `&rsquo;` are for the HTML only - a text email showing "&mdash;" is worse
// than one showing a hyphen.
const plain = (s: string) =>
  s.replace(/&mdash;/g, '—').replace(/&rsquo;/g, '’').replace(/&nbsp;/g, ' ')

export function buildReferralPartnerEmail(ctx: ReferralPartnerContext): {
  subject: string
  html: string
  plainText: string
} {
  const brand = ctx.brand || DEFAULT_BRAND
  const name = ctx.clientFirstName.trim() || 'there'

  const body =
    p(`Hi ${name},`) +
    p('Many customers find themselves caught in short-term private lending, managing outstanding ATO ' +
      'debt or carrying multiple unsecured liabilities &mdash; often without a clear strategy to ' +
      'transition into a more sustainable financial position.') +
    p('At Simplify Finance, we help your clients explore structured lending solutions designed to ' +
      'consolidate debt, reduce short-term pressure and create a clearer pathway forward.') +

    keyBlock('Did you know?', 'Simplify Finance can assist with scenarios including:') +
    bullets(CAN_ASSIST) +

    h('Why it matters') +
    p('Private and short-term lending can provide an important solution when a client needs it most. ' +
      'However, without a clear exit strategy, higher repayments and shorter loan terms can place ' +
      'increasing pressure on cash flow.') +
    p('Our focus is on helping clients transition from short-term debt into a more sustainable ' +
      'structure by:') +
    bullets(OUR_FOCUS) +

    h('Who should you refer?') +
    p('This may be worth a conversation if you have:') +
    bullets(WHO_TO_REFER) +

    h('Have a scenario that needs a different approach?') +
    p('Send it through to Simplify Finance. We&rsquo;ll review the client&rsquo;s position, explore ' +
      'the available options and work with you to determine whether there is a more sustainable ' +
      'pathway forward.') +

    keyBlock('Simplify the debt. Strengthen the structure. Create a pathway forward.') +

    shellButton(ctx.calendlyUrl || '#', 'Book a 15-minute chat', brand.accentColor) +
    `<p style="margin:9px 0 0;font-family:${FONT};font-size:13.5px;color:${GREY};text-align:center;"><span style="color:${GREY};">Or simply reply to this email.</span></p>` +
    `<p style="margin:20px 0 0;font-family:${FONT};font-size:14px;color:${BODY};line-height:1.6;"><span style="color:${BODY};">` +
      `<span style="font-weight:600;color:${INK};">${ctx.brokerName}</span><br>${brand.name}</span></p>`

  const plainText = plain([
    `Hi ${name},`, '',
    'Many customers find themselves caught in short-term private lending, managing outstanding ATO debt or carrying multiple unsecured liabilities — often without a clear strategy to transition into a more sustainable financial position.', '',
    'At Simplify Finance, we help your clients explore structured lending solutions designed to consolidate debt, reduce short-term pressure and create a clearer pathway forward.', '',
    'DID YOU KNOW?',
    'Simplify Finance can assist with scenarios including:',
    ...CAN_ASSIST.map(t => `- ${t}`), '',
    'WHY IT MATTERS',
    'Private and short-term lending can provide an important solution when a client needs it most. However, without a clear exit strategy, higher repayments and shorter loan terms can place increasing pressure on cash flow.', '',
    'Our focus is on helping clients transition from short-term debt into a more sustainable structure by:',
    ...OUR_FOCUS.map(t => `- ${t}`), '',
    'WHO SHOULD YOU REFER?',
    'This may be worth a conversation if you have:',
    ...WHO_TO_REFER.map(t => `- ${t}`), '',
    'HAVE A SCENARIO THAT NEEDS A DIFFERENT APPROACH?',
    'Send it through to Simplify Finance. We’ll review the client’s position, explore the available options and work with you to determine whether there is a more sustainable pathway forward.', '',
    'Simplify the debt. Strengthen the structure. Create a pathway forward.', '',
    ctx.calendlyUrl ? `Book a 15-minute chat: ${ctx.calendlyUrl}` : '',
    'Or simply reply to this email.', '',
    ctx.brokerName, brand.name, '',
    `*${DISCLAIMER}`,
  ].join('\n'))

  return {
    // Fabio, 10 Sep 2026, given verbatim.
    subject: 'Restructure Debt. Restore Control. Build for the Long Term.',
    html: emailShell(body, `*${DISCLAIMER}`, brand),
    plainText,
  }
}

export { DISCLAIMER as REFERRAL_PARTNER_DISCLAIMER }
