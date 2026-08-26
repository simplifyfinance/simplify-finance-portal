import { emailShell, shellButton, FONT } from './email-shell'

// The negative gearing email. No figures and nothing calculated — the argument
// is the same for every investor, so the only variable is who it is addressed
// to and who it comes from.
//
// The wording is Fabio's and is deliberately free of contractions. The two
// tinted blocks carry the single idea the email exists for and the point that
// supports it; both are the same blue, which he chose over an amber second box.

export type NegativeGearingContext = {
  clientFirstName: string      // "Sarah", or "Sarah and Andrew" for a couple
  brokerName: string
  calendlyUrl: string
}

const CYAN = '#2DBEFF'
const TINT = '#F4FAFE'
const INK = '#1a1a1a'
const BODY = '#3d3d3a'
const GREY = '#6b6b66'

// Tax content under a credit licence. It states plainly that this is not advice,
// that it does not consider the reader's circumstances, and that the treatment
// depends both on those circumstances and on the final form of the law — the
// last clause matters because the detail can move before July 2027.
const DISCLAIMER =
  'General information only. This email is not tax advice, credit advice or a recommendation, and ' +
  'does not take account of your objectives, financial situation or needs. Whether any loss can be ' +
  'carried forward, and how it may be applied, depends on your own circumstances and on the final ' +
  'form of the law. Please speak to your accountant or registered tax adviser before acting.'

const p = (t: string) =>
  `<p style="margin:0 0 14px;font-family:${FONT};font-size:14.5px;color:${BODY};line-height:1.7;">${t}</p>`

const em = (t: string) => `<span style="font-weight:600;color:${INK};">${t}</span>`

function keyBlock(line: string, payoff: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;"><tr>
<td width="3" bgcolor="${CYAN}" style="background-color:${CYAN};width:3px;font-size:0;line-height:0;">&nbsp;</td>
<td bgcolor="${TINT}" style="background-color:${TINT};padding:15px 17px;font-family:${FONT};">
<div style="font-size:18.5px;font-weight:600;line-height:1.4;color:${INK};">${line}</div>
<div style="font-size:15px;font-weight:600;color:#0B6F9E;padding-top:4px;">${payoff}</div>
</td></tr></table>`
}

function supportBlock(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;"><tr>
<td width="3" bgcolor="${CYAN}" style="background-color:${CYAN};width:3px;font-size:0;line-height:0;">&nbsp;</td>
<td bgcolor="${TINT}" style="background-color:${TINT};padding:13px 17px;font-family:${FONT};font-size:14px;color:${BODY};line-height:1.65;">${text}</td>
</tr></table>`
}

export function buildNegativeGearingEmail(ctx: NegativeGearingContext): {
  subject: string
  html: string
  plainText: string
} {
  const name = ctx.clientFirstName.trim() || 'there'

  const body =
    p(`Hi ${name},`) +
    p('There has been a lot of noise about the end of negative gearing on established residential ' +
      'property purchased after 12 May 2026.') +
    p('But there is one part I do not think investors are talking about enough.') +
    keyBlock('The tax losses are not lost.', 'They are deferred.') +
    p('The change does mean investors need to allow for more cash flow upfront. From 1 July 2027, ' +
      'an established property&rsquo;s loss can no longer be used to reduce the tax on your salary ' +
      'each year.') +
    p('But the loss itself does not simply disappear.') +
    supportBlock('It can be carried forward and potentially used to reduce tax when your residential ' +
      'property portfolio becomes positively geared, or against the capital gain when the property ' +
      'is eventually sold.') +
    p(`${em('The tax benefit has shifted from today to later.')} That is an important distinction.`) +
    p('For investors with a long-term strategy, established property is still very much worth ' +
      'considering &mdash; particularly if the current uncertainty creates better buying ' +
      'opportunities. It is simply a new way of looking at the numbers.') +
    p(em('The market has changed. Good investors adapt.')) +
    p('If you have put your next investment on hold because of negative gearing, let us look at the ' +
      'opportunities under the new rules.') +
    shellButton(ctx.calendlyUrl || '#', 'Book a 15-minute chat') +
    `<p style="margin:9px 0 0;font-family:${FONT};font-size:13.5px;color:${GREY};text-align:center;">Or simply reply to this email.</p>` +
    `<p style="margin:20px 0 0;font-family:${FONT};font-size:14px;color:${BODY};line-height:1.6;">` +
      `<span style="font-weight:600;color:${INK};">${ctx.brokerName}</span><br>Simplify Finance</p>`

  const plainText = [
    `Hi ${name},`, '',
    'There has been a lot of noise about the end of negative gearing on established residential property purchased after 12 May 2026.', '',
    'But there is one part I do not think investors are talking about enough.', '',
    'The tax losses are not lost. They are deferred.', '',
    'The change does mean investors need to allow for more cash flow upfront. From 1 July 2027, an established property’s loss can no longer be used to reduce the tax on your salary each year.', '',
    'But the loss itself does not simply disappear. It can be carried forward and potentially used to reduce tax when your residential property portfolio becomes positively geared, or against the capital gain when the property is eventually sold.', '',
    'The tax benefit has shifted from today to later. That is an important distinction.', '',
    'For investors with a long-term strategy, established property is still very much worth considering — particularly if the current uncertainty creates better buying opportunities. It is simply a new way of looking at the numbers.', '',
    'The market has changed. Good investors adapt.', '',
    'If you have put your next investment on hold because of negative gearing, let us look at the opportunities under the new rules.', '',
    ctx.calendlyUrl ? `Book a 15-minute chat: ${ctx.calendlyUrl}` : '',
    'Or simply reply to this email.', '',
    ctx.brokerName, 'Simplify Finance', '',
    DISCLAIMER,
  ].join('\n')

  return {
    // Curiosity rather than alarm: the argument of the email is that everyone
    // else is reacting and this is a considered take.
    subject: 'A different way to look at negative gearing',
    html: emailShell(body, DISCLAIMER),
    plainText,
  }
}

export { DISCLAIMER as NEGATIVE_GEARING_DISCLAIMER }
