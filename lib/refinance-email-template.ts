/**
 * Refinance campaign email templates.
 *
 * Table-based layout with inline styles only. No flexbox, no grid,
 * no border-radius circles — those fail in Outlook, Gmail and Apple Mail.
 * Max width 600px. Web-safe font stack.
 *
 * Output is copied to the clipboard and pasted into the broker's own
 * mail client, so it must survive a paste into Outlook and Gmail.
 */

import {
  calculateRefinance,
  formatCurrency,
  formatMonthsAsYearsMonths,
  type RefinanceInput,
  type RefinanceResult,
} from './refinance-calculations';

export interface EmailContext {
  clientFirstName: string;
  brokerName: string;
  calendlyUrl: string;
  proceedUrl: string;
}

// Simplify Finance. The charcoal header and cyan action button are the same
// pair the borrowing-capacity email uses, so a client who receives both sees
// one firm rather than two.
const NAVY = '#343333';        // header and footer bar
const NAVY_LIGHT = '#9E9E9E';  // tagline on the charcoal
const CYAN = '#2DBEFF';        // the one action colour
const GREEN = '#1E7A4A';
const GREEN_BG = '#F1F7F3';
const GREEN_DARK = '#12563A';
const AMBER_BG = '#FDF6E7';
const AMBER_DARK = '#7A5F17';
const BORDER = '#E4E2DC';
const GREY = '#6b6b66';
const BODY = '#3d3d3a';
const INK = '#1a1a1a';
const FOOTER_BG = '#343333';   // footer matches the header
const FOOTER_INK = '#B5B5B5';  // legible on charcoal, no rgba
const SAND = '#F2E8DB';
const LOGO_URL =
  'https://simplify-finance-portal.vercel.app/logo-charcoal.png';
const FONT =
  "-apple-system, 'Segoe UI', Arial, Helvetica, sans-serif";

const DISCLAIMER =
  'Figures shown are estimates only and are provided as a guide. They assume the ' +
  'balance, rate and remaining term shown are accurate, that repayments are made on ' +
  'schedule, and that the rate does not change over the period. They exclude fees, ' +
  'charges and any lender-specific conditions. This is general information, not credit ' +
  'assistance or a recommendation, and is not an offer of finance. Any refinance is ' +
  'subject to lender assessment and approval. Mortgage Specialists Pty Ltd, ACL 387025.';

const IO_TAX_NOTE =
  'Interest on investment loans is generally deductible, so your after-tax position ' +
  'will differ from the figures above. Worth a quick word with your accountant.';

function button(label: string, url: string, filled: boolean): string {
  const bg = filled ? CYAN : '#ffffff';
  const fg = filled ? '#ffffff' : NAVY;
  const border = `1px solid ${filled ? CYAN : NAVY}`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 10px 0;"><tr><td align="center" bgcolor="${bg}" style="background-color:${bg};border:${border};border-radius:6px;padding:13px 16px;"><a href="${url}" style="color:${fg};font-family:${FONT};font-size:15px;font-weight:bold;text-decoration:none;display:block;">${label}</a></td></tr></table>`;
}

function statCell(label: string, value: string): string {
  return `<td width="50%" valign="top" style="padding:0 4px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${SAND}" style="background-color:${SAND};border-radius:6px;"><tr><td align="center" style="padding:12px 8px;font-family:${FONT};"><div style="font-size:12px;color:#7a5c3a;"><span style="color:#7a5c3a;">${label}</span></div><div style="font-size:18px;color:#5C4326;padding-top:3px;"><span style="color:#5C4326;">${value}</span></div></td></tr></table></td>`;
}

function comparisonBlock(
  r: RefinanceResult,
  input: RefinanceInput,
  savingLabel: string,
): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid ${BORDER};border-radius:6px;margin:0 0 14px 0;">
<tr><td style="padding:14px 14px 10px 14px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td width="45%" valign="top" style="font-family:${FONT};">
<div style="font-size:12px;color:${GREY};"><span style="color:${GREY};">Your rate now</span></div>
<div style="font-size:21px;color:${INK};padding-top:3px;"><span style="color:${INK};">${input.currentRate.toFixed(2)}%</span></div>
<div style="font-size:12px;color:${GREY};padding-top:3px;"><span style="color:${GREY};">${formatCurrency(r.currentRepayment)}/mo</span></div>
</td>
<td width="10%" align="center" valign="middle" style="font-family:${FONT};font-size:18px;color:#B4B2A9;">&rarr;</td>
<td width="45%" valign="top" align="right" style="font-family:${FONT};">
<div style="font-size:12px;color:${GREEN};"><span style="color:${GREEN};">Your new rate</span></div>
<div style="font-size:21px;color:${GREEN};padding-top:3px;"><span style="color:${GREEN};">${input.newRate.toFixed(2)}%</span></div>
<div style="font-size:12px;color:${GREEN};padding-top:3px;"><span style="color:${GREEN};">${formatCurrency(r.newRepayment)}/mo</span></div>
</td>
</tr>
</table>
</td></tr>
<tr><td style="border-top:1px solid ${BORDER};padding:12px 14px 14px 14px;font-family:${FONT};" align="center">
<div style="font-size:12px;color:${GREY};"><span style="color:${GREY};">${savingLabel}</span></div>
<div style="font-size:30px;color:${GREEN};padding:3px 0;"><span style="color:${GREEN};">${formatCurrency(r.monthlySaving)}</span></div>
<div style="font-size:13px;color:${BODY};"><span style="color:${BODY};">every month</span></div>
</td></tr>
</table>`;
}

function shell(inner: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f5f5f3" style="background-color:#f5f5f3;">
<tr><td align="center" bgcolor="#f5f5f3" style="background-color:#f5f5f3;padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" bgcolor="#ffffff" style="width:600px;max-width:600px;background-color:#ffffff;">
<tr><td bgcolor="${NAVY}" align="center" style="background-color:${NAVY};padding:26px 20px;font-family:${FONT};">
<img src="${LOGO_URL}" alt="Simplify Finance" height="72" style="height:72px;display:block;margin:0 auto 8px;border:0;" />
<div style="color:${NAVY_LIGHT};font-size:10px;letter-spacing:2px;text-transform:uppercase;"><span style="color:${NAVY_LIGHT};">Finance, Simplified.</span></div>
</td></tr>
<tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:24px 20px;">${inner}</td></tr>
<tr><td bgcolor="${FOOTER_BG}" style="background-color:${FOOTER_BG};padding:14px 20px;font-family:${FONT};">
<div style="font-size:10px;color:${FOOTER_INK};line-height:1.6;"><span style="color:${FOOTER_INK};">${DISCLAIMER}</span></div>
</td></tr>
</table>
</td></tr></table>`;
}

function signOff(ctx: EmailContext): string {
  return `<p style="margin:0;font-family:${FONT};font-size:14px;color:${BODY};line-height:1.6;"><span style="color:${BODY};">Any questions, just hit reply.</span></p>
<p style="margin:12px 0 0 0;font-family:${FONT};font-size:14px;color:${INK};line-height:1.5;">${ctx.brokerName}<br><span style="color:${GREY};font-size:13px;">Simplify Finance</span></p>`;
}

function cashbackBlock(r: RefinanceResult, cashback: number): string {
  if (cashback <= 0) return '';
  const tail =
    r.netCashPosition >= 0
      ? " &mdash; which covers the switching costs, so it doesn't cost you anything to move."
      : ' towards your switching costs.';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${AMBER_BG}" style="background-color:${AMBER_BG};border-radius:6px;margin:0 0 14px 0;"><tr><td style="padding:12px 14px;font-family:${FONT};font-size:14px;color:${AMBER_DARK};line-height:1.5;"><span style="color:${AMBER_DARK};"><strong>Plus a ${formatCurrency(cashback)} cashback</strong>${tail}</span></td></tr></table>`;
}

export function buildRefinanceEmail(
  input: RefinanceInput,
  ctx: EmailContext,
): { subject: string; html: string; plainText: string } {
  const r = calculateRefinance(input);
  const isIO = input.repaymentType === 'IO';
  const name = ctx.clientFirstName.trim() || 'there';

  const intro = isIO
    ? `Rates have moved. I've had a look at the loan on your investment property, and there's room to bring your holding costs down.`
    : `Rates have moved, and I've had a look at your loan. Based on what we have on file, here's what a refinance could look like for you.`;

  const periodLabel = isIO
    ? `Over ${Math.round(input.remainingYears)} yrs IO left`
    : `Over ${Math.round(input.remainingYears)} yrs`;

  let closingLine = '';
  if (isIO) {
    closingLine = `<p style="margin:0 0 14px 0;font-family:${FONT};font-size:14px;color:${BODY};line-height:1.6;"><span style="color:${BODY};">That's <strong>${formatCurrency(r.annualSaving)} a year</strong> improvement in your holding costs &mdash; money that can sit in your offset, cover the next round of maintenance, or go toward a deposit on the next one.</span></p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${FOOTER_BG}" style="background-color:${FOOTER_BG};margin:0 0 16px 0;"><tr><td style="padding:11px 13px;border-left:3px solid #B4B2A9;font-family:${FONT};font-size:13px;color:#5F5E5A;line-height:1.5;"><span style="color:#5F5E5A;">${IO_TAX_NOTE}</span></td></tr></table>`;
  } else if (r.monthsSavedIfRepaymentsHeld && r.monthsSavedIfRepaymentsHeld > 0) {
    closingLine = `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:14px;color:${BODY};line-height:1.6;"><span style="color:${BODY};">If you kept your repayments the same instead of dropping them, you'd be mortgage-free <strong>${formatMonthsAsYearsMonths(r.monthsSavedIfRepaymentsHeld)}</strong> sooner.</span></p>`;
  }

  const inner = `<p style="margin:0 0 10px 0;font-family:${FONT};font-size:15px;color:${INK};line-height:1.6;"><span style="color:${INK};">Hi ${name},</span></p>
<p style="margin:0 0 14px 0;font-family:${FONT};font-size:14px;color:${BODY};line-height:1.6;"><span style="color:${BODY};">${intro}</span></p>
${comparisonBlock(r, input, isIO ? 'Back into your cashflow' : "You'd save")}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 14px 0;"><tr>
${statCell('Per year', formatCurrency(r.annualSaving))}
${statCell(periodLabel, formatCurrency(r.periodSaving))}
</tr></table>
${cashbackBlock(r, input.cashback)}
${closingLine}
${button('Book a 15-minute chat', ctx.calendlyUrl, true)}
${button('Get started now', ctx.proceedUrl, false)}
<div style="height:6px;line-height:6px;">&nbsp;</div>
${signOff(ctx)}`;

  const subject = isIO
    ? `${name}, about ${formatCurrency(r.monthlySaving)}/month back in your cashflow`
    : `${name}, you could be saving ${formatCurrency(r.monthlySaving)} a month`;

  const plainText = [
    `Hi ${name},`,
    '',
    intro,
    '',
    `Your rate now: ${input.currentRate.toFixed(2)}% (${formatCurrency(r.currentRepayment)}/mo)`,
    `Your new rate: ${input.newRate.toFixed(2)}% (${formatCurrency(r.newRepayment)}/mo)`,
    `Saving: ${formatCurrency(r.monthlySaving)} per month, ${formatCurrency(r.annualSaving)} per year`,
    '',
    `Book a chat: ${ctx.calendlyUrl}`,
    `Get started: ${ctx.proceedUrl}`,
    '',
    ctx.brokerName,
    'Simplify Finance',
    '',
    DISCLAIMER,
  ].join('\n');

  return { subject, html: shell(inner), plainText };
}

/**
 * Builds the mailto: link that opens the broker's mail client with the
 * recipient, BCC and subject already filled.
 *
 * The BCC is the SalesTrekker email-capture address — BCC'ing it means the
 * sent email lands against the record in SalesTrekker automatically, with no
 * second step for the broker.
 *
 * mailto cannot carry an HTML body. The body is copied to the clipboard
 * separately and pasted in. This is a limitation of the mailto spec, not a
 * gap in the implementation.
 */
export function buildMailtoUrl(opts: {
  to: string;
  bcc?: string;
  subject: string;
}): string {
  // encodeURIComponent, not URLSearchParams: the latter encodes spaces as
  // '+', which Outlook renders literally in the subject line.
  const parts: string[] = [];
  if (opts.bcc && opts.bcc.trim()) {
    parts.push(`bcc=${encodeURIComponent(opts.bcc.trim())}`);
  }
  parts.push(`subject=${encodeURIComponent(opts.subject)}`);
  return `mailto:${encodeURIComponent(opts.to.trim())}?${parts.join('&')}`;
}

/**
 * SMS follow-up text. Kept under 320 characters (two segments).
 * Sending and tracking happens in SalesTrekker, not here — this just
 * produces the wording.
 */
export function buildRefinanceSms(
  input: RefinanceInput,
  ctx: EmailContext,
): string {
  const r = calculateRefinance(input);
  const name = ctx.clientFirstName.trim() || 'there';
  return (
    `Hi ${name}, ${ctx.brokerName} from Simplify Finance. ` +
    `Tried calling — I emailed you about your home loan, looks like about ` +
    `${formatCurrency(r.monthlySaving)}/month we could save you. ` +
    `Worth a quick chat? ${ctx.calendlyUrl} ` +
    `Reply STOP to opt out.`
  );
}
