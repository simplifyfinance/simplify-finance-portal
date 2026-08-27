// The one shell every template email wears: charcoal header with the logo,
// white body, charcoal footer carrying the disclaimer and the licence.
//
// It lives here so a second template cannot drift from the first, and so the
// ACL number exists in one place rather than one place per template.
//
// Every coloured area carries a bgcolor attribute as well as the CSS. Outlook
// on Windows renders through Word, which paints a background only from the
// attribute — scripts/check-email-html.sh fails the ship if that slips.
//
// Nothing pale sits on anything dark. Word will paint a background from an
// attribute but throws away the text colour that made the text readable on it,
// so Kylie's disclaimer arrived black on charcoal. The rule now is that every
// piece of live text in these emails is dark on light: the disclaimer sits at
// the foot of the white body under a hairline, and the only thing left inside
// the charcoal band is the logo, which is artwork and cannot be recoloured.

const CHARCOAL = '#343333'
const TAGLINE_INK = '#8A8279'
const SMALL_INK = '#8a8a84'
const LEGAL_INK = '#9e9e98'
const HAIRLINE = '#E4E2DC'
const LOGO_URL = 'https://simplify-finance-portal.vercel.app/logo-charcoal.png'
export const FONT = "-apple-system, 'Segoe UI', Arial, Helvetica, sans-serif"

const LEGAL =
  '&copy; 2026 Simplify Finance | Mortgage Specialists Pty Ltd | St Leonards, Sydney | ' +
  'Australian Credit Licence 387025'

// The disclaimer, as the email's own last paragraph rather than a band beneath
// it. Dark on white, so it reads whether or not the colour survives the trip.
function smallPrint(disclaimer: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 0;"><tr>
<td bgcolor="#ffffff" style="background-color:#ffffff;border-top:1px solid ${HAIRLINE};padding:12px 0 0;font-family:${FONT};">
<div style="font-size:10px;line-height:1.65;color:${SMALL_INK};"><span style="color:${SMALL_INK};">${disclaimer}</span></div>
<div style="font-size:10px;line-height:1.65;color:${LEGAL_INK};padding-top:6px;"><span style="color:${LEGAL_INK};">${LEGAL}</span></div>
</td></tr></table>`
}

export function emailShell(inner: string, disclaimer: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f5f3" style="background-color:#f5f5f3;">
<tr><td align="center" bgcolor="#f5f5f3" style="background-color:#f5f5f3;padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" align="center" style="width:600px;max-width:600px;background-color:#ffffff;">
<tr><td bgcolor="${CHARCOAL}" align="center" style="background-color:${CHARCOAL};padding:26px 20px;font-family:${FONT};">
<img src="${LOGO_URL}" alt="Simplify Finance" height="72" style="height:72px;display:block;margin:0 auto;border:0;" />
</td></tr>
<tr><td bgcolor="#ffffff" align="center" style="background-color:#ffffff;padding:14px 20px 0;font-family:${FONT};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${TAGLINE_INK};"><span style="color:${TAGLINE_INK};">Finance, Simplified.</span></td></tr>
<tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:20px 22px 26px;font-family:${FONT};">${inner}${smallPrint(disclaimer)}</td></tr>
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
