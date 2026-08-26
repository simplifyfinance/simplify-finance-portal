import { emailShell, shellButton, FONT } from './email-shell'

// New property rebate.
//
// The selling idea is not the rebate on its own — it is that new stock keeps the
// negative gearing treatment established property has just lost, and the rebate
// comes on top of that. Two reasons, not one.
//
// No address, no lot, no estate anywhere: the rebate is a field and the project
// documents are a link, so the same template carries to the next project.

export type RebateContext = {
  clientFirstName: string
  brokerName: string
  calendlyUrl: string
  rebate?: string          // "15,000" — typed per project
  documentsUrl?: string    // where the brochure and siting plan live
}

const CYAN = '#2DBEFF'
const TINT = '#F4FAFE'
const SAND = '#FAF8F4'
const BORDER = '#E4E2DC'
const INK = '#1a1a1a'
const BODY = '#3d3d3a'
const GREY = '#6b6b66'
const GREEN = '#1E7A4A'

const DISCLAIMER =
  'General information only. This email is not credit advice, tax advice, financial product advice or ' +
  'a recommendation, and does not take account of your objectives, financial situation or needs. The ' +
  'treatment of any property loss depends on your own circumstances and on the final form of the law. ' +
  'Any rebate is subject to the developer&rsquo;s terms and to contract, and prices, inclusions and ' +
  'availability are set by the developer and may change. Please seek your own legal and tax advice ' +
  'before entering into any contract.'

const p = (t: string) =>
  `<p style="margin:0 0 15px;font-family:${FONT};font-size:15px;color:${BODY};line-height:1.65;">${t}</p>`
const punch = (t: string) =>
  `<p style="margin:0 0 15px;font-family:${FONT};font-size:16.5px;color:${INK};font-weight:600;line-height:1.5;">${t}</p>`

function keyBlock(line: string, payoff: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;"><tr>
<td width="3" bgcolor="${CYAN}" style="background-color:${CYAN};width:3px;font-size:0;line-height:0;">&nbsp;</td>
<td bgcolor="${TINT}" style="background-color:${TINT};padding:16px 18px;font-family:${FONT};">
<div style="font-size:19px;font-weight:bold;line-height:1.4;color:${INK};">${line}</div>
<div style="font-size:14.5px;font-weight:600;color:#0B6F9E;padding-top:5px;">${payoff}</div>
</td></tr></table>`
}

// The rebate, given the weight of the one number in the email.
function rebateBlock(amount: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;border:1px solid ${BORDER};border-radius:8px;">
<tr><td bgcolor="${SAND}" align="center" style="background-color:${SAND};border-bottom:1px solid ${BORDER};padding:10px 14px;font-family:${FONT};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#7a5c3a;font-weight:bold;">On this project</td></tr>
<tr><td bgcolor="${TINT}" align="center" style="background-color:${TINT};padding:20px 14px 18px;font-family:${FONT};">
<div style="font-size:42px;font-weight:bold;color:#0B6F9E;line-height:1;">$${amount}</div>
<div style="font-size:13px;color:#0B6F9E;padding-top:6px;">Back to you, not kept as a fee</div>
</td></tr></table>`
}

function bothBlock(amount: string): string {
  const row = (text: string, last: boolean) =>
    `<tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:14px 16px;font-family:${FONT};${last ? '' : `border-bottom:1px solid #EFEDE8;`}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="30" valign="top" style="width:30px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="20" height="20" bgcolor="${GREEN}" align="center" valign="middle" style="width:20px;height:20px;background-color:${GREEN};border-radius:10px;color:#ffffff;font-size:12px;">&#10003;</td>
</tr></table></td>
<td valign="top" style="font-size:14.5px;color:${BODY};line-height:1.55;">${text}</td>
</tr></table></td></tr>`

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;border:1px solid ${BORDER};border-radius:8px;">
<tr><td bgcolor="${SAND}" align="center" style="background-color:${SAND};border-bottom:1px solid ${BORDER};padding:10px 14px;font-family:${FONT};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#7a5c3a;font-weight:bold;">So on the right new build you get both</td></tr>
${row(`<b style="color:${INK};">The annual tax benefit</b> that established property has just lost`, false)}
${row(`<b style="color:${INK};">$${amount} in your hand</b>, on top of it`, true)}
</table>`
}

function twoUses(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr>
<td width="3" bgcolor="${CYAN}" style="background-color:${CYAN};width:3px;font-size:0;line-height:0;">&nbsp;</td>
<td bgcolor="${TINT}" style="background-color:${TINT};padding:15px 17px;font-family:${FONT};">
<div style="font-size:14.5px;font-weight:600;color:${INK};">Holding the asset comfortably</div>
<div style="font-size:14px;color:${BODY};line-height:1.6;padding:3px 0 13px;">It covers the gap between the rent and the repayments through the first year, which is the part that catches people out.</div>
<div style="font-size:14.5px;font-weight:600;color:${INK};">Or paying down their own home loan</div>
<div style="font-size:14px;color:${BODY};line-height:1.6;padding-top:3px;">Interest on your own home is generally not deductible, so many people put every spare dollar there first. Worth a word with your accountant about which suits you.</div>
</td></tr></table>`
}

export function buildRebateEmail(ctx: RebateContext): {
  subject: string
  html: string
  plainText: string
} {
  const name = ctx.clientFirstName.trim() || 'there'
  const amount = (ctx.rebate || '').replace(/[^0-9.,]/g, '').trim()
  const hasAmount = !!amount

  const body =
    p(`Hi ${name},`) +
    punch('One thing has been lost in all the noise about negative gearing.') +
    keyBlock('New property keeps the negative gearing treatment.',
             'Established property is what changed.') +
    p('So if the annual tax benefit was part of your plan, it has not disappeared. It has moved to ' +
      'new stock.') +
    punch('And the timing is doing something interesting.') +
    p('Developers are holding completed and near-completed stock, and several are now offering ' +
      'rebates to move it. This is not a tired listing being discounted &mdash; it is a working ' +
      'project the developer wants finished, and finished quickly.') +
    punch('When we believe in a project, we pass that rebate straight back to you.') +
    (hasAmount ? rebateBlock(amount) + bothBlock(amount) : '') +
    punch('What clients are doing with the rebate.') +
    twoUses() +
    p('Fixed price. Registered land. Fixed site costs. The number you are quoted is the number you ' +
      'pay.') +
    punch('Most investors are sitting still right now. That is exactly when the good stock starts ' +
          'carrying rebates.') +
    p('Have a look at the project, and if it is worth a conversation we will run the numbers against ' +
      'your own position.') +
    (ctx.documentsUrl ? shellButton(ctx.documentsUrl, 'See the property details') : '') +
    shellButton(ctx.calendlyUrl || '#', 'Book a 15-minute chat',
                ctx.documentsUrl ? '#ffffff' : '#2DBEFF') +
    `<p style="margin:10px 0 0;font-family:${FONT};font-size:13.5px;color:${GREY};text-align:center;">Or simply reply to this email.</p>` +
    `<p style="margin:22px 0 0;font-family:${FONT};font-size:14px;color:${BODY};line-height:1.6;">` +
      `<span style="font-weight:600;color:${INK};">${ctx.brokerName}</span><br>Simplify Finance</p>`

  const plainText = [
    `Hi ${name},`, '',
    'One thing has been lost in all the noise about negative gearing.', '',
    'New property keeps the negative gearing treatment. Established property is what changed.', '',
    'So if the annual tax benefit was part of your plan, it has not disappeared. It has moved to new stock.', '',
    'Developers are holding completed and near-completed stock, and several are now offering rebates to move it. This is not a tired listing being discounted — it is a working project the developer wants finished, and finished quickly.', '',
    'When we believe in a project, we pass that rebate straight back to you.', '',
    hasAmount ? `On this project: $${amount}, back to you, not kept as a fee.` : '',
    hasAmount ? `So on the right new build you get both the annual tax benefit that established property has just lost, and $${amount} in your hand on top of it.` : '', '',
    'What clients are doing with the rebate: holding the asset comfortably through the first year, or paying down their own home loan — interest on your own home is generally not deductible, so many people put every spare dollar there first. Worth a word with your accountant about which suits you.', '',
    'Fixed price. Registered land. Fixed site costs. The number you are quoted is the number you pay.', '',
    'Most investors are sitting still right now. That is exactly when the good stock starts carrying rebates.', '',
    ctx.documentsUrl ? `See the property details: ${ctx.documentsUrl}` : '',
    ctx.calendlyUrl ? `Book a 15-minute chat: ${ctx.calendlyUrl}` : '',
    'Or simply reply to this email.', '',
    ctx.brokerName, 'Simplify Finance', '',
    DISCLAIMER.replace(/&rsquo;/g, '’'),
  ].filter(l => l !== '').join('\n')

  return {
    subject: 'New property still negatively gears — and right now it comes with cash back',
    html: emailShell(body, DISCLAIMER),
    plainText,
  }
}
