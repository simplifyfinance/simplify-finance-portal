// THE QUESTIONS, AS THEY APPEAR IN A CLIENT EMAIL.
//
// 27 Oct 2026. One block, used by the borrowing capacity email and the lending
// options email, so there is never a version of this that only one of them got
// the fix for. The list inside it comes from lib/what-we-still-need.ts and is
// worked out fresh every time.
//
// WHERE IT SITS: under the figures, above "Important things to note". They
// opened the email to find out what they can borrow. Ask first and the
// questions are what stands between them and the answer, so they skim past.
//
// ITS OWN COLOUR, ON PURPOSE. It is not an important thing to note and it is
// not a document request - it is a short list of things only they can answer,
// and it has to look like neither of the two blocks it sits between.
//
// WHY THE MARKUP LOOKS LIKE 2004: same reason as lib/email-card.ts. Outlook on
// Windows renders mail through Word, which paints a background only from a
// bgcolor ATTRIBUTE and throws away a text colour set on a paragraph. Every
// piece of text here is wrapped in a span carrying its own colour, and
// scripts/check-email-html.sh fails the ship if that stops being true.
//
// AND THE BUTTON IS PALE WITH DARK TEXT, which looks backwards and is not. A
// dark cell in Word keeps the background and drops the pale text colour that
// made it readable, so it arrives black on purple. Dark cells hold artwork
// only. The same lesson is written on lib/email-buttons.ts, learned the same
// way.

export type BlockItem = {
  /** The sentence the client reads. */
  ask: string
  /** One line under it, or empty. */
  help: string
  /** "Asked 14 Oct · 14 days", or empty on a first ask. */
  asked: string
}

// QUOTES TOO, NOT JUST ANGLE BRACKETS.
//
// 27 Oct 2026, caught by the test two lines below it. The first version escaped
// & < > and left the quote alone, so a value ending up inside href="..." could
// close the attribute and add one of its own. The link is built by us and the
// questions are written by our own people, so nothing here was ever going to be
// hostile - but "the input is trusted" is the sentence that precedes every one
// of these, and an escaper that only half escapes is worse than none because it
// looks done.
const esc = (v: any) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function item(i: BlockItem): string {
  const help = i.help
    ? `<p style="font-size:12px;margin:4px 0 0;line-height:1.55">`
      + `<span style="color:#5A5349;">${esc(i.help)}</span></p>`
    : ''
  // THE DATE IS THE SECOND ASK SAYING SO. A chase that does not name the first
  // ask is just the same email twice, which is how a client learns to ignore
  // them.
  const asked = i.asked
    ? `<p style="font-size:11px;font-weight:600;margin:5px 0 0">`
      + `<span style="color:#6B4FA8;">${esc(i.asked)}</span></p>`
    : ''
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background:#FFFFFF;border-radius:6px;margin-bottom:6px"><tr>
    <td bgcolor="#FFFFFF" style="background:#FFFFFF;padding:10px 13px">
      <p style="font-size:12.5px;font-weight:600;margin:0;line-height:1.5"><span style="color:#17140F;">${esc(i.ask)}</span></p>
      ${help}
      ${asked}
    </td></tr></table>`
}

function button(url: string): string {
  if (!String(url || '').trim()) return ''
  return `<p style="font-size:12px;font-weight:600;margin:12px 0 8px;line-height:1.5">`
    + `<span style="color:#4D4841;">The quickest way is the button &mdash; it takes about a minute.</span></p>`
    + `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px"><tr>
      <td bgcolor="#C9B6F0" align="center" style="background:#C9B6F0;border-radius:6px;padding:11px 20px">
        <a href="${esc(url)}" style="color:#2E1C56;font-size:13px;font-weight:700;text-decoration:none;display:inline-block">Answer these now &nbsp;&rarr;</a>
      </td></tr></table>`
    + `<p style="font-size:11.5px;margin:6px 0 0;line-height:1.5">`
    + `<span style="color:#6F6A62;">Or just reply to this email and I will put it in for you.</span></p>`
}

/**
 * EMPTY WHERE THERE IS NOTHING TO ASK, AND THAT MATTERS.
 *
 * No heading, no "nothing outstanding", no empty box. The email reads exactly
 * as it does today for every client who has already told us everything - which
 * is most of them, and they should never know this exists.
 */
export function stillNeedBlock(opts: {
  heading: string
  lead: string
  items: BlockItem[]
  /** The signed answers link. Left out where one could not be built. */
  url?: string
}): string {
  const items = (opts.items || []).filter(i => String(i?.ask || '').trim())
  if (!items.length) return ''
  const lead = opts.lead
    ? `<p style="font-size:12px;margin:0 0 11px;line-height:1.6">`
      + `<span style="color:#4D4841;">${esc(opts.lead)}</span></p>`
    : ''
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px"><tr>
    <td width="4" bgcolor="#5B3A9E" style="background:#5B3A9E;width:4px;font-size:0;line-height:0">&nbsp;</td>
    <td bgcolor="#F3EFFB" style="background:#F3EFFB;padding:14px 16px">
      <p style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px"><span style="color:#4A2E85;">${esc(opts.heading)}</span></p>
      ${lead}
      ${items.map(item).join('')}
      ${button(String(opts.url || ''))}
    </td></tr></table>`
}
