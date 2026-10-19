// THE PORTFOLIO REVIEW EMAIL.
//
// 19 Oct 2026. Fabio's own opportunity template, which he has been sending by
// hand for years, built from the figures on a review. His words throughout -
// where this file and his version differ, his version is right and this one is
// a bug.
//
// Table-based layout, inline styles, no flexbox, no grid, no border-radius
// circles. Outlook on Windows renders through Word, which paints a background
// only from a bgcolor attribute - scripts/check-email-html.sh fails the ship if
// that slips. Max width 600px, web-safe font stack.
//
// NO INTEREST RATE ANYWHERE IN IT, and that is deliberate rather than an
// oversight. Every surface in this portal that quotes a rate to a client
// carries the RBA notice - see lib/rate-notice-everywhere.test.ts - and this
// email has no lender attached to it yet. "All rates and fees are subject to
// change" is Fabio's own line and does the job here.
//
// ---------------------------------------------------------------------------
// WHERE THE WORDS LIVE
// ---------------------------------------------------------------------------
//
// Fabio, 19 Oct 2026: "use your wording for now so we set up the rules THEN I
// WILL CHANGE THE WORDING."
//
// So none of the prose below is final and none of it is hard to change. Every
// paragraph a person might want to rewrite comes in through `copy`, which the
// settings row holds as one jsonb column. The defaults here are what goes out
// until somebody edits them, and editing them needs no ship.
//
// A FIGURE IS NEVER IN THE EDITABLE TEXT. The numbers block is built from the
// review, in code, so no amount of rewriting can put a wrong dollar figure in
// front of a client.

import { emailShell, FONT } from './email-shell'
import { type Brand, DEFAULT_BRAND } from './brand'
import { money } from './money'

const INK = '#1a1a1a'
const BODY = '#3d3d3a'
const GREY = '#6b6b66'
const RULE = '#E4E2DC'
const CYAN = '#2DBEFF'

export type ReviewCopy = {
  opening?: string
  rework?: string
  standAlone?: string
  whyNowIntro?: string
  whyNowFundamentals?: string
  whyNowLead?: string
  whyNowBullets?: string[]
  gearingBuffer?: string
  gearingLosses?: string
  gearingBullets?: string[]
  strategy?: string
  ctaLabel?: string
  pleaseNote?: string
  unsubscribe?: string
}

// FABIO'S WORDS, 19 OCT 2026, AS AGREED LINE BY LINE.
//
// The gearing section went through four drafts. The one that stuck says what
// happens to the losses rather than when the rules start - "its oncufsing as
// all properties from now on (exept brand new) are under the new rule". No
// date is quoted in it for that reason.
export const DEFAULT_COPY: Required<ReviewCopy> = {
  opening: 'At Simplify Finance, we take a long term, holistic and personalised approach to your wealth.',
  rework: 'We took the liberty of reworking your numbers using the information we have on file from '
    + 'when we last spoke, and there is a promising opportunity for you to continue growing your '
    + 'wealth through another investment property.',
  standAlone: 'A second loan will be set up against your current property, so all properties are stand alone.',
  whyNowIntro: 'Yes, interest rates have risen. Yes, the negative gearing rules have changed. And yes, '
    + 'confidence has taken a hit.',
  whyNowFundamentals: 'But the fundamentals haven’t changed: people still need homes, and good '
    + 'properties in growth areas are still in demand. What has changed is sentiment. In our '
    + 'experience, that’s when our clients have bought best.',
  whyNowLead: 'Right now:',
  whyNowBullets: [
    'Less competition means real negotiating power. We’ve recently secured properties for clients below the asking price.',
    'We’re focusing on lower price points in areas with strong growth drivers.',
    'Your current property has likely grown significantly over the years. That equity can work for you.',
  ],
  gearingBuffer: 'We plan for it. We structure a little extra equity as a cash-flow buffer, so any '
    + 'shortfall on the new property is covered by the buffer rather than paid out of your pocket '
    + 'while the market settles.',
  gearingLosses: 'And your deductions don’t disappear. You won’t be able to offset losses '
    + 'against your wages or other personal income — but the losses aren’t lost. They’re '
    + 'quarantined and carried forward, and you can use them against:',
  gearingBullets: [
    'rental income from your other properties, and',
    'any future capital gain when you sell a rental property.',
  ],
  strategy: 'We’ll run your numbers properly, stress-test them at higher rates, and work with your '
    + 'accountant so your whole team is on the same page.',
  ctaLabel: 'BOOK MY PORTFOLIO REVIEW',
  pleaseNote: 'Please note: All rates and fees are subject to change. Our analysis relies on the data '
    + 'from your previous file, so we need to verify your current figures.',
  unsubscribe: 'Prefer not to hear from us about your portfolio? Reply to this email and we will not '
    + 'contact you about it again.',
}

export const DEFAULT_DISCLAIMER =
  'The equity and purchase figures above are estimates based on information we hold. They are not an '
  + 'approval or offer of credit and are subject to lender assessment, valuation and serviceability. '
  + 'This email is general information only and doesn’t consider your objectives, financial '
  + 'situation or needs. We are not tax advisers; please speak with your accountant about how the tax '
  + 'rules apply to you.'

export type ReviewEmailInput = {
  greeting: string
  equityAddress: string
  purchasePrice: any
  stampDuty: any
  loanAmount: any
  loanNote: string
  equityRelease: any
  savings: any
  /** Structured on purpose, on top of the deposit. Printed only when there is one. */
  buffer?: any
  brokerName: string
  brokerTitle?: string
  calendlyUrl: string
  brand?: Brand
  copy?: ReviewCopy
}

// NO COLOUR ON THE <p> ITSELF. Word keeps a colour on a run and drops one on a
// paragraph, so every one of these arrived black - scripts/check-email-html.sh
// fails the ship for exactly this. The colour lives on the span inside.
const p = (html: string, margin = '0 0 13px') =>
  `<p style="font-family:${FONT};font-size:14px;line-height:1.62;margin:${margin};">${html}</p>`

const esc = (v: any) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// A HEADING, NOT A BAND. Word keeps a background painted from an attribute and
// throws away the text colour that made it readable, so nothing pale sits on
// anything dark anywhere in these emails - see lib/email-shell.ts.
const section = (label: string) =>
  `<p style="font-family:${FONT};font-size:12.5px;font-weight:bold;letter-spacing:1.1px;`
  + `margin:22px 0 10px;padding-top:16px;border-top:1px solid ${RULE};">`
  + `<span style="color:${INK};">${esc(label)}</span></p>`

const bullets = (items: string[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 13px;">`
  + items.map(t => `<tr>
<td width="16" valign="top" style="width:16px;font-family:${FONT};font-size:14px;line-height:1.6;color:${BODY};"><span style="color:${BODY};">&bull;</span></td>
<td valign="top" style="font-family:${FONT};font-size:14px;line-height:1.6;color:${BODY};padding-bottom:7px;"><span style="color:${BODY};">${esc(t)}</span></td>
</tr>`).join('')
  + `</table>`

// ONE LINE OF THE NUMBERS BLOCK.
//
// Fabio, 19 Oct 2026: "why are you changing the purchase number need the same
// way". It is a plain line with the bracket inline, exactly as he writes it by
// hand - not a right-aligned table, not a caption underneath.
const figure = (label: string, amount: string, bracket = '', after = '') =>
  p(`<span style="color:${BODY};">${esc(label)}: <b style="color:${INK};">${esc(amount)}</b>`
    + (bracket ? ` (${esc(bracket)})` : '') + (after ? ` ${esc(after)}` : '') + `</span>`, '0 0 4px')

export function reviewEmailSubject(): string {
  return 'Simplify Finance — New Opportunity Identified!'
}

export function reviewEmailHtml(input: ReviewEmailInput): string {
  const c = { ...DEFAULT_COPY, ...(input.copy || {}) }
  const brand = input.brand || DEFAULT_BRAND

  const price = money(input.purchasePrice)
  const duty = money(input.stampDuty)
  const loan = money(input.loanAmount)
  const equity = money(input.equityRelease)
  const savings = money(input.savings)

  // WORKED OUT HERE, NOT TYPED. The total and the deposit are the two figures a
  // person would get wrong at midnight, and they are the two the whole email
  // rests on.
  const n = (v: any) => Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0
  const total = money(n(input.purchasePrice) + n(input.stampDuty))
  const deposit = money(n(input.purchasePrice) + n(input.stampDuty) - n(input.loanAmount))

  let body = ''
  body += p(`<span style="color:${BODY};">Hi ${esc(input.greeting)},</span>`)
  body += p(`<span style="color:${BODY};">${esc(c.opening)}</span>`)
  body += p(`<span style="color:${BODY};">${esc(c.rework)}</span>`)

  // THE ONE SENTENCE THE WHOLE EMAIL IS FOR. The deposit named here is their
  // OWN MONEY - the savings - because the equity is not cash out of their
  // pocket, which is the entire point being made.
  body += p(`<b style="color:${INK};">We believe you could continue and grow your wealth by purchasing `
    + `a new investment property with only a ${esc(savings)} deposit.</b>`, '0 0 13px')

  body += p(`<span style="color:${BODY};">We would use equity in your <b style="color:${INK};">`
    + `${esc(input.equityAddress)}</b> property to help fund the deposit plus Stamp Duty costs.</span>`)
  body += p(`<span style="color:${BODY};">${esc(c.standAlone)}</span>`)
  body += p(`<span style="color:${BODY};">Provided you are OK to use equity we could look at a purchase `
    + `price of <b style="color:${INK};">${esc(price)}</b>.</span>`)

  body += p(`<b style="color:${INK};">Your numbers would be:</b>`, '0 0 8px')
  body += figure('Purchase Price', price)
  body += figure('Stamp Duty', duty)
  body += figure('Total Cost', total, 'plus solicitor’s fees and incidentals')
  body += figure('Loan Amount', loan, input.loanNote)
  body += figure('Deposit Needed', deposit,
    `coming from equity release of ${equity} and personal savings of ${savings}`,
    'plus solicitor’s fees and incidentals')

  // THE BUFFER IS ONLY MENTIONED WHERE THERE IS ONE.
  //
  // "We structure a little extra equity as a cash-flow buffer" is a promise the
  // email makes further down, and a client who reads that and then finds the
  // equity release exactly equals the deposit has been told two things that do
  // not agree. So the figure is named here when it exists, and the sentence
  // below stands on its own when it does not.
  if (n(input.buffer) > 0) {
    body += figure('Cash-flow buffer', money(input.buffer),
      'extra equity released and set aside, not spent at settlement')
  }
  body = body + '<div style="height:3px;line-height:3px;">&nbsp;</div>'

  body += section('WHY NOW?')
  body += p(`<span style="color:${BODY};">${esc(c.whyNowIntro)}</span>`)
  body += p(`<span style="color:${BODY};">${esc(c.whyNowFundamentals)}</span>`)
  body += p(`<span style="color:${BODY};">${esc(c.whyNowLead)}</span>`, '0 0 8px')
  body += bullets(c.whyNowBullets)

  body += section('WHAT ABOUT NEGATIVE GEARING?')
  body += p(`<span style="color:${BODY};">${esc(c.gearingBuffer)}</span>`)
  body += p(`<span style="color:${BODY};">${esc(c.gearingLosses)}</span>`, '0 0 8px')
  body += bullets(c.gearingBullets)

  body += section('LET’S BUILD YOUR STRATEGY')
  body += p(`<span style="color:${BODY};">${esc(c.strategy)}</span>`)

  if (String(input.calendlyUrl || '').trim()) {
    body += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 0;"><tr>
<td bgcolor="${CYAN}" align="center" style="background-color:${CYAN};border-radius:6px;padding:13px 16px;">
<a href="${esc(input.calendlyUrl)}" style="color:#343333;font-family:${FONT};font-size:14.5px;font-weight:bold;text-decoration:none;display:block;letter-spacing:0.4px;">${esc(c.ctaLabel)}</a>
</td></tr></table>`
  }

  body += `<p style="font-family:${FONT};font-size:13px;line-height:1.6;margin:20px 0 0;">
<span style="color:${BODY};"><b style="color:${INK};">${esc(input.brokerName)}</b><br>
<span style="font-size:12px;color:${GREY};">${esc(input.brokerTitle || brand.name)}</span></span></p>`

  body += `<p style="font-family:${FONT};font-size:11.5px;line-height:1.55;margin:20px 0 0;padding-top:14px;border-top:1px solid ${RULE};font-weight:bold;">
<span style="color:${GREY};">&#10071; ${esc(c.pleaseNote)}</span></p>`

  body += `<p style="font-family:${FONT};font-size:10.5px;line-height:1.55;margin:12px 0 0;">
<span style="color:${GREY};">${esc(c.unsubscribe)}</span></p>`

  return emailShell(body, DEFAULT_DISCLAIMER, brand)
}
