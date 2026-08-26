import { emailShell, shellButton, FONT } from './email-shell'

// The price-versus-tax-refund email. Like the negative gearing one, nothing is
// calculated per client — the argument rests on a single real example, so the
// only variables are who it is addressed to and who it comes from.
//
// The example is the Irwin Ave comparison: the same house, ten kilometres from
// the Melbourne CBD, valued eight weeks apart either side of the Federal Budget
// announcement.

export type PriceOpportunityContext = {
  clientFirstName: string
  brokerName: string
  calendlyUrl: string
}

const CYAN = '#2DBEFF'
const TINT = '#F4FAFE'
const SAND = '#FAF8F4'
const BORDER = '#E4E2DC'
const INK = '#1a1a1a'
const BODY = '#3d3d3a'
const GREY = '#6b6b66'
const WAS = '#8a8a84'      // the earlier price, deliberately receded

const DISCLAIMER =
  'General information only. This email is not tax advice, credit advice or a recommendation, and ' +
  'does not take account of your objectives, financial situation or needs. The figures are an ' +
  'illustration based on a single example and assumed circumstances; your own position will differ. ' +
  'Whether any loss can be carried forward, and how it may be applied, depends on your circumstances ' +
  'and on the final form of the law. Please speak to your accountant or registered tax adviser ' +
  'before acting.'

const p = (t: string) =>
  `<p style="margin:0 0 15px;font-family:${FONT};font-size:15px;color:${BODY};line-height:1.65;">${t}</p>`

const punch = (t: string) =>
  `<p style="margin:0 0 15px;font-family:${FONT};font-size:16.5px;color:${INK};font-weight:600;line-height:1.5;">${t}</p>`

const b = (t: string) => `<span style="font-weight:600;color:${INK};">${t}</span>`

// The two valuations side by side, with the difference beneath as the verdict.
// Colour lives on every cell as a bgcolor attribute so Word paints it.
function comparison(): string {
  const cell = (when: string, price: string, faded: boolean) =>
    `<td width="50%" align="center" bgcolor="#ffffff" style="background-color:#ffffff;padding:18px 12px;font-family:${FONT};${faded ? `border-right:1px solid ${BORDER};` : ''}">
<div style="font-size:11.5px;color:${GREY};line-height:1.45;padding-bottom:6px;">${when}</div>
<div style="font-size:26px;font-weight:bold;color:${faded ? WAS : INK};line-height:1.1;">${price}</div>
</td>`

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;border:1px solid ${BORDER};border-radius:8px;">
<tr><td bgcolor="${SAND}" align="center" style="background-color:${SAND};border-bottom:1px solid ${BORDER};padding:10px 14px;font-family:${FONT};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#7a5c3a;font-weight:bold;">
The same house, eight weeks apart</td></tr>
<tr><td style="padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${cell('Two weeks before<br>the Federal Budget', '$1,060,000', true)}
${cell('Six weeks after<br>the Federal Budget', '$975,000', false)}
</tr></table>
</td></tr>
<tr><td bgcolor="${TINT}" align="center" style="background-color:${TINT};border-top:1px solid ${BORDER};padding:18px 14px;font-family:${FONT};">
<div style="font-size:38px;font-weight:bold;color:#0B6F9E;line-height:1;">$85,000</div>
<div style="font-size:13px;color:#0B6F9E;padding-top:5px;">The saving from buying after everyone else got nervous</div>
</td></tr></table>`
}

function keyBlock(line: string, payoff: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;"><tr>
<td width="3" bgcolor="${CYAN}" style="background-color:${CYAN};width:3px;font-size:0;line-height:0;">&nbsp;</td>
<td bgcolor="${TINT}" style="background-color:${TINT};padding:16px 18px;font-family:${FONT};">
<div style="font-size:19px;font-weight:bold;line-height:1.4;color:${INK};">${line}</div>
<div style="font-size:14.5px;font-weight:600;color:#0B6F9E;padding-top:5px;">${payoff}</div>
</td></tr></table>`
}

// The argument, written once. The email ends on a button; the page ends by
// pointing back at the email, because the action lives there. Everything above
// that last line is identical, so the two cannot drift apart.
function argument(name: string): string {
  return (
    p(`Hi ${name},`) +
    punch('Everyone is talking about what investors are losing. Almost nobody is doing the other ' +
          'half of the maths.') +
    p('Ten kilometres from the Melbourne CBD. The same house, different values, eight weeks apart.') +
    comparison() +
    punch('Now the number everyone is worried about losing.') +
    p(`On a $200,000 income, negative gearing on a property like this was worth somewhere around ` +
      `${b('$8,500 to $9,400 a year')}.`) +
    keyBlock('$85,000 off the price is nine to ten years of that benefit.',
             'Except you get it on the day you buy, not one year at a time.') +
    p('And the losses themselves are not gone. Under the new rules they are deferred &mdash; they ' +
      'build up and can potentially be used against future property income or when you sell.') +
    punch('So the question is not what you lost. It is what the right property costs while everyone ' +
          'else is waiting.') +
    p('Not every property has moved $85,000, and your circumstances will not be the same as this ' +
      'buyer&rsquo;s. But if you have put investing on hold because of a tax change, you may be ' +
      'reading the wrong number.')
  )
}

function signature(brokerName: string): string {
  return `<p style="margin:22px 0 0;font-family:${FONT};font-size:14px;color:${BODY};line-height:1.6;">` +
    `<span style="font-weight:600;color:${INK};">${brokerName}</span><br>Simplify Finance</p>`
}

function plain(name: string, brokerName: string, tail: string[]): string {
  return [
    `Hi ${name},`, '',
    'Everyone is talking about what investors are losing. Almost nobody is doing the other half of the maths.', '',
    'Ten kilometres from the Melbourne CBD. The same house, different values, eight weeks apart.', '',
    'Two weeks before the Federal Budget: $1,060,000',
    'Six weeks after the Federal Budget: $975,000',
    'Difference: $85,000 — the saving from buying after everyone else got nervous.', '',
    'Now the number everyone is worried about losing.', '',
    'On a $200,000 income, negative gearing on a property like this was worth somewhere around $8,500 to $9,400 a year.', '',
    '$85,000 off the price is nine to ten years of that benefit. Except you get it on the day you buy, not one year at a time.', '',
    'And the losses themselves are not gone. Under the new rules they are deferred — they build up and can potentially be used against future property income or when you sell.', '',
    'So the question is not what you lost. It is what the right property costs while everyone else is waiting.', '',
    'Not every property has moved $85,000, and your circumstances will not be the same as this buyer’s. But if you have put investing on hold because of a tax change, you may be reading the wrong number.', '',
    ...tail, '',
    brokerName, 'Simplify Finance', '',
    DISCLAIMER,
  ].join('\n')
}

export function buildPriceOpportunityEmail(ctx: PriceOpportunityContext): {
  subject: string
  html: string
  plainText: string
} {
  const name = ctx.clientFirstName.trim() || 'there'
  const body =
    argument(name) +
    punch('Let us run yours.') +
    shellButton(ctx.calendlyUrl || '#', 'Book a 15-minute chat') +
    `<p style="margin:10px 0 0;font-family:${FONT};font-size:13.5px;color:${GREY};text-align:center;">Or simply reply to this email.</p>` +
    signature(ctx.brokerName)

  return {
    subject: 'What if the tax change actually created an opportunity?',
    html: emailShell(body, DISCLAIMER),
    plainText: plain(name, ctx.brokerName, [
      'Let us run yours.',
      ctx.calendlyUrl ? `Book a 15-minute chat: ${ctx.calendlyUrl}` : '',
      'Or simply reply to this email.',
    ].filter(Boolean)),
  }
}

// The same argument as a page, reached from the negative gearing email. No
// button and no reply line — the action lives in the email that brought them
// here, so the page points back to it rather than dead-ending.
export function buildPriceOpportunityPage(ctx: {
  clientFirstName: string
  brokerName: string
}): { html: string; disclaimer: string } {
  const name = ctx.clientFirstName.trim() || 'there'
  const first = (ctx.brokerName || '').trim().split(/\s+/)[0] || 'me'
  const body =
    argument(name) +
    punch(`Reply to ${first === 'me' ? 'my' : first + '&rsquo;s'} email and let us run yours.`) +
    signature(ctx.brokerName)
  return { html: emailShell(body, DISCLAIMER), disclaimer: DISCLAIMER }
}
