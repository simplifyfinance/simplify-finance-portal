// The one shell every template email wears: charcoal header with the logo,
// white body, charcoal footer carrying the disclaimer and the licence.
//
// It lives here so a second template cannot drift from the first, and so the
// ACL number exists in one place rather than one place per template.
//
// Every coloured area carries a bgcolor attribute as well as the CSS. Outlook
// on Windows renders through Word, which paints a background only from the
// attribute — scripts/check-email-html.sh fails the ship if that slips.

const CHARCOAL = '#343333'
const FOOTER_INK = '#B5B5B5'
const LOGO_URL = 'https://simplify-finance-portal.vercel.app/logo-charcoal.png'
export const FONT = "-apple-system, 'Segoe UI', Arial, Helvetica, sans-serif"

const LEGAL =
  '&copy; 2026 Simplify Finance | Mortgage Specialists Pty Ltd | St Leonards, Sydney | ' +
  'Australian Credit Licence 387025'

export function emailShell(inner: string, disclaimer: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f5f3" style="background-color:#f5f5f3;">
<tr><td align="center" bgcolor="#f5f5f3" style="background-color:#f5f5f3;padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" align="center" style="width:600px;max-width:600px;background-color:#ffffff;">
<tr><td bgcolor="${CHARCOAL}" align="center" style="background-color:${CHARCOAL};padding:26px 20px;font-family:${FONT};">
<img src="${LOGO_URL}" alt="Simplify Finance" height="72" style="height:72px;display:block;margin:0 auto 8px;border:0;" />
<div style="color:#9E9E9E;font-size:10px;letter-spacing:2px;text-transform:uppercase;"><span style="color:#9E9E9E;">Finance, Simplified.</span></div>
</td></tr>
<tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:26px 22px;font-family:${FONT};">${inner}</td></tr>
<tr><td bgcolor="${CHARCOAL}" style="background-color:${CHARCOAL};padding:14px 20px;font-family:${FONT};">
<div style="font-size:10px;color:${FOOTER_INK};line-height:1.6;"><span style="color:${FOOTER_INK};">${disclaimer}</span></div>
<div style="font-size:10px;color:#9E9E9E;line-height:1.6;padding-top:6px;"><span style="color:#9E9E9E;">${LEGAL}</span></div>
</td></tr>
</table>
</td></tr></table>`
}

// One action, so the colour sits on the cell — Word will not paint an inline link.
export function shellButton(href: string, label: string, bg = '#2DBEFF'): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;"><tr>
<td bgcolor="${bg}" align="center" style="background-color:${bg};border-radius:6px;padding:13px 16px;">
<a href="${href}" style="color:#ffffff;font-family:${FONT};font-size:15px;font-weight:bold;text-decoration:none;display:block;">${label}</a>
</td></tr></table>`
}

// Spaces must be encoded as %20, not +. Outlook renders a + literally in the
// subject line, which is the second of the two bugs found building the first
// template — do not swap this for URLSearchParams.
export function mailtoUrl(opts: { to: string; bcc?: string; subject: string }): string {
  const parts: string[] = [`subject=${encodeURIComponent(opts.subject)}`]
  if (opts.bcc && opts.bcc.trim()) parts.push(`bcc=${encodeURIComponent(opts.bcc.trim())}`)
  return `mailto:${encodeURIComponent(opts.to)}?${parts.join('&')}`
}
