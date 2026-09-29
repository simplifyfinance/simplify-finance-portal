// THE PIECES A MILESTONE EMAIL IS BUILT FROM.
//
// One copy, shared by the formal approval and the pre-approval, so the two
// cannot drift into looking like different companies wrote them.
//
// EVERYTHING HERE IS WORD-SAFE, and that is not a style preference. Outlook on
// Windows renders mail through Word, which:
//
//   * paints a background only from a bgcolor ATTRIBUTE on a <td> or <table> -
//     CSS background on a div, a link or a bare cell shows nothing, and rgba()
//     is not understood at all;
//   * keeps a text colour set on a RUN and throws away one set on a paragraph,
//     which is how Kylie's disclaimer arrived black on charcoal.
//
// So every coloured area is a table cell carrying both the attribute and the
// CSS, and every piece of live text is wrapped in a <span> that repeats its own
// colour. scripts/check-email-html.sh fails the ship if either slips.
//
// And no lists. <ul> and <ol> indent differently in every mail program and
// collapse in a few; a two-column table with the marker in the left cell is the
// one thing that looks the same everywhere.

import { FONT } from './email-shell'

export const INK = '#1a1a1a'
export const BODY = '#3d3d3a'
export const MUTED = '#8a8a84'
export const GREEN = '#1a7a52'
export const RULE = '#EFEAE0'
export const SAND = '#FAF8F4'
export const AMBER_EDGE = '#E8C98A'

export const p = (t: string) =>
  `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;color:${BODY};line-height:1.62;"><span style="color:${BODY};">${t}</span></p>`

// The one line the whole email exists to deliver.
export const hero = (t: string) =>
  `<p style="margin:0 0 14px;font-family:${FONT};font-size:17px;font-weight:bold;color:${GREEN};line-height:1.4;"><span style="color:${GREEN};">${t}</span></p>`

// A section heading. A rule under it rather than a coloured band, because a band
// needs light text on dark and Word will not keep the light text.
export const heading = (t: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 10px;"><tr>
<td bgcolor="#ffffff" style="background-color:#ffffff;border-bottom:1px solid ${RULE};padding:0 0 7px;font-family:${FONT};font-size:11px;font-weight:bold;letter-spacing:.09em;text-transform:uppercase;color:${MUTED};"><span style="color:${MUTED};">${t}</span></td>
</tr></table>`

// THE MONEY. Label left, figure right, the total ruled off above and below and
// the loan amount the one thing in colour.
export function moneyTable(rows: { label: string; value: string; note?: boolean }[]): string {
  const cells = rows.map(r => {
    if (r.note) {
      return `<tr><td colspan="2" bgcolor="#ffffff" style="background-color:#ffffff;padding:2px 0 8px;font-family:${FONT};font-size:12.5px;color:${MUTED};line-height:1.5;"><span style="color:${MUTED};">${r.value}</span></td></tr>`
    }
    const total = r.label.startsWith('Total cost')
    const loan = r.label === 'Loan amount'
    const colour = loan ? GREEN : INK
    const weight = total || loan ? 'bold' : 'normal'
    const size = loan ? '16px' : '15px'
    const edge = total
      ? `border-top:1px solid #E2DDD3;border-bottom:1px solid #E2DDD3;padding:9px 0;`
      : 'padding:6px 0;'
    return `<tr>
<td bgcolor="#ffffff" align="left" style="background-color:#ffffff;${edge}font-family:${FONT};font-size:${size};font-weight:${weight};color:${BODY};line-height:1.45;"><span style="color:${BODY};">${r.label}</span></td>
<td bgcolor="#ffffff" align="right" style="background-color:#ffffff;${edge}font-family:${FONT};font-size:${size};font-weight:bold;color:${colour};line-height:1.45;"><span style="color:${colour};">${r.value}</span></td>
</tr>`
  }).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}</table>`
}

// Product, rate, term and the rest. Two columns of label-over-value, which
// survives a narrow screen better than a four-column grid.
export function detailTable(items: { label: string; value: string }[]): string {
  if (items.length === 0) return ''
  const pairs: string[] = []
  for (let i = 0; i < items.length; i += 2) {
    const cell = (it?: { label: string; value: string }) => it
      ? `<td bgcolor="#ffffff" width="50%" valign="top" style="background-color:#ffffff;padding:6px 12px 6px 0;font-family:${FONT};">
<div style="font-size:12px;color:${MUTED};line-height:1.4;"><span style="color:${MUTED};">${it.label}</span></div>
<div style="font-size:15px;font-weight:bold;color:${INK};line-height:1.4;"><span style="color:${INK};">${it.value}</span></div></td>`
      : `<td bgcolor="#ffffff" width="50%" style="background-color:#ffffff;">&nbsp;</td>`
    pairs.push(`<tr>${cell(items[i])}${cell(items[i + 1])}</tr>`)
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${pairs.join('')}</table>`
}

// A NUMBERED OR TICKED LIST, as a table. The marker sits in its own narrow cell
// so a wrapped second line lines up under the first instead of under the tick.
export function markedList(items: string[], marker: 'number' | 'tick'): string {
  if (items.length === 0) return ''
  const rows = items.map((t, i) => {
    const m = marker === 'number' ? `${i + 1}.` : '&#10003;'
    const colour = marker === 'number' ? MUTED : GREEN
    return `<tr>
<td bgcolor="#ffffff" width="22" valign="top" style="background-color:#ffffff;padding:0 8px 12px 0;font-family:${FONT};font-size:15px;font-weight:bold;color:${colour};line-height:1.62;"><span style="color:${colour};">${m}</span></td>
<td bgcolor="#ffffff" valign="top" style="background-color:#ffffff;padding:0 0 12px;font-family:${FONT};font-size:15px;color:${BODY};line-height:1.62;"><span style="color:${BODY};">${t}</span></td>
</tr>`
  }).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`
}

// A note the client should not skim past. Sand rather than yellow, because a
// warning colour on a congratulations email reads as bad news.
export const noteBox = (t: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;"><tr>
<td bgcolor="${SAND}" style="background-color:${SAND};border-left:3px solid ${AMBER_EDGE};padding:11px 14px;font-family:${FONT};font-size:14px;color:${BODY};line-height:1.55;"><span style="color:${BODY};">${t}</span></td>
</tr></table>`

// WHO SENT IT. Fabio, 29 Sep 2026, choosing between the two: "B match send and
// sognature" - so the name at the foot is the name in the From line, always.
export function signature(name: string, brandName: string, email: string,
                          phone: string, web: string): string {
  const line = (t: string, colour = BODY) =>
    `<div style="font-family:${FONT};font-size:14px;color:${colour};line-height:1.65;"><span style="color:${colour};">${t}</span></div>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;"><tr>
<td bgcolor="#ffffff" style="background-color:#ffffff;border-top:1px solid ${RULE};padding:15px 0 0;">
${line(`<b style="color:${INK};">${name}</b>`, INK)}
${line(brandName)}
${email ? line(`E ${email}`, MUTED) : ''}
${phone ? line(`M ${phone}`, MUTED) : ''}
${web ? line(`W ${web}`, MUTED) : ''}
</td></tr></table>`
}

// The same content as plain text, for the tiny number of clients that ask for
// it and for anything that indexes a message body. Never a second wording -
// built from the same pieces the HTML was.
export function plain(lines: (string | string[])[]): string {
  const out: string[] = []
  for (const l of lines) {
    if (Array.isArray(l)) { out.push(...l.map(x => `  - ${strip(x)}`)); out.push('') }
    else if (l) { out.push(strip(l)); out.push('') }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function strip(html: string): string {
  return String(html ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&rsquo;/g, '’')
    .replace(/&amp;/g, '&').replace(/&#10003;/g, '')
    .replace(/\s+/g, ' ').trim()
}
