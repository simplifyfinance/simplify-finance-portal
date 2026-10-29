import { shortDate, daysSince } from './what-we-still-need'
import { stillOut, allRowsOf, isLate } from './documents-outstanding'
import { progressOf } from './document-progress'

// THE DOCUMENTS A CLIENT STILL OWES US, AS A BLOCK OF EMAIL.
//
// 28 Oct 2026. The tick shipped this morning finally lets somebody record that
// a document arrived. This is the other half: until the client is told what is
// still missing, the tick only makes the hole visible to us.
//
// Fabio: "whatever is left unticked appears in a block at the bottom of the
// lending options email and the email that goes out when they agree to
// proceed."
//
// IT IS THE QUESTIONS BLOCK'S TWIN, ON PURPOSE. Same rail, same purple, same
// white cards, same "Asked 14 Oct · 14 days" line. They sit one under the other
// and a client reads them as one thought: here is what we are waiting on. See
// lib/still-need-block.ts, which this is deliberately shaped after.
//
// AND IT HAS NO BUTTON, WHICH IS THE POINT.
//
// The questions block has one because there is somewhere to send them - the
// signed answers page, which writes onto the fact find. There is nowhere in
// this portal to upload a document. The client uploads to SalesTrekker, which
// is not ours. Fabio, on an earlier draft that had an Upload button: "how are
// we uploading documents? We never had a button where we can upload documents.
// We've never done this." He was right, and a button that goes nowhere is worse
// than no button.
//
// So the instruction is a BAND instead: full width, the same pale purple, and
// impossible to skim past. Pale with dark text, like every other button this
// portal sends - Word keeps a dark cell's background and throws away the pale
// text that made it readable, which is written on lib/email-buttons.ts in blood.
//
// WHY THE MARKUP LOOKS LIKE 2004: Outlook on Windows renders mail through Word,
// which paints a background only from a bgcolor ATTRIBUTE and drops a text
// colour set on a paragraph. Every piece of text here is wrapped in a span
// carrying its own colour, and scripts/check-email-html.sh fails the ship if
// that stops being true.

export type DocBlockItem = {
  /** What the client has to send. */
  name: string
  /** One line under it, or empty. */
  detail: string
  /** "Asked 14 Oct · 14 days", or empty. */
  asked: string
}

const esc = (v: any) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/**
 * THE HEADING COUNTS THEM, because "some documents" is a sentence nobody acts
 * on and "3 documents" is one they can check against their own pile.
 */
export function documentsHeading(n: number): string {
  if (n <= 0) return ''
  return n === 1 ? '1 document still to send us' : `${n} documents still to send us`
}

/**
 * THE LEAD, IN FABIO'S WORDS.
 *
 * 28 Oct 2026, on an earlier draft that read "We cannot submit to a lender
 * until they are in": "the client wording is too firm. I don't like it. So just
 * say something like, these are essential for us to continue your application."
 *
 * It does not sharpen with age. The row turns red in the portal after a
 * fortnight and the compliance email says so; what a client reads is the same
 * sentence on day two and on day forty, because an email that gets firmer on
 * its own, with nobody reading it first, will eventually get firm at somebody
 * who had a very good reason.
 */
export const DOCUMENTS_LEAD = 'These are essential for us to continue your application.'

export const DOCUMENTS_HOW =
  'Please send these through the client portal you were invited to, '
  + 'or just reply to this email with them attached.'

/** "Asked 14 Oct · 14 days" for one document. Empty where it was never asked. */
export function docAskedLine(requestedAt: any, today = new Date()): string {
  const at = String(requestedAt ?? '').trim()
  if (!at) return ''
  const days = daysSince(at, today)
  return `Asked ${shortDate(at)}${days === null ? '' : ` · ${days} ${days === 1 ? 'day' : 'days'}`}`
}

function item(i: DocBlockItem): string {
  const detail = i.detail
    ? `<p style="font-size:12px;margin:4px 0 0;line-height:1.55">`
      + `<span style="color:#5A5349;">${esc(i.detail)}</span></p>`
    : ''
  // THE DATE IS THE SECOND ASK SAYING SO. A chase that does not name the first
  // ask is just the same email twice, which is how a client learns to ignore
  // them. Same device as the questions block.
  const asked = i.asked
    ? `<p style="font-size:11px;font-weight:600;margin:5px 0 0">`
      + `<span style="color:#6B4FA8;">${esc(i.asked)}</span></p>`
    : ''
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background:#FFFFFF;border-radius:6px;margin-bottom:6px"><tr>
    <td bgcolor="#FFFFFF" style="background:#FFFFFF;padding:10px 13px">
      <p style="font-size:12.5px;font-weight:600;margin:0;line-height:1.5"><span style="color:#17140F;">${esc(i.name)}</span></p>
      ${detail}
      ${asked}
    </td></tr></table>`
}

/**
 * EMPTY WHERE THERE IS NOTHING OUTSTANDING, AND THAT MATTERS.
 *
 * No heading, no "nothing outstanding", no empty box. The email reads exactly
 * as it does today for every client who has sent us everything - which is most
 * of them, and they should never know this exists.
 */
export function documentsBlock(opts: {
  items: DocBlockItem[]
  heading?: string
  lead?: string
  how?: string
}): string {
  const items = (opts.items || []).filter(i => String(i?.name || '').trim())
  if (!items.length) return ''
  const heading = opts.heading || documentsHeading(items.length)
  const lead = opts.lead ?? DOCUMENTS_LEAD
  const how = opts.how ?? DOCUMENTS_HOW
  const leadHtml = lead
    ? `<p style="font-size:12px;margin:0 0 11px;line-height:1.6">`
      + `<span style="color:#4D4841;">${esc(lead)}</span></p>`
    : ''
  // THE BAND. Full width so the sentence has room, pale so Word cannot eat the
  // text, and not a link because there is nowhere of ours to send them.
  const band = how
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#C9B6F0" style="background:#C9B6F0;border-radius:7px;margin-top:10px"><tr>
        <td bgcolor="#C9B6F0" style="background:#C9B6F0;padding:12px 15px">
          <p style="font-size:12.5px;font-weight:700;margin:0;line-height:1.5"><span style="color:#2E1C56;">${esc(how)}</span></p>
        </td></tr></table>`
    : ''
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px"><tr>
    <td width="4" bgcolor="#5B3A9E" style="background:#5B3A9E;width:4px;font-size:0;line-height:0">&nbsp;</td>
    <td bgcolor="#F3EFFB" style="background:#F3EFFB;padding:14px 16px">
      <p style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px"><span style="color:#4A2E85;">${esc(heading)}</span></p>
      ${leadHtml}
      ${items.map(item).join('')}
      ${band}
    </td></tr></table>`
}

/** The rows, for anything that wants them rather than the HTML. */
export function documentItemsFor(deal: any, today = new Date()): DocBlockItem[] {
  return stillOut(allRowsOf(deal, progressOf(deal))).map(r => ({
    name: String(r.label || ''),
    detail: String(r.detail || ''),
    asked: docAskedLine(r.requestedAt, today),
  }))
}

/**
 * THE SAME LIST, FOR THE PEOPLE DOING THE CHASING RATHER THAN THE CLIENT.
 *
 * One extra fact: whether it has been waiting the full fortnight. The client's
 * copy never carries that - their wording does not sharpen on a timer - but the
 * team's does, because fourteen days and seven days are two different phone
 * calls and nobody can tell them apart unless we say so.
 */
export function documentChaseFor(deal: any, today = new Date()):
  Array<{ name: string; asked: string; late: boolean }> {
  return stillOut(allRowsOf(deal, progressOf(deal))).map(r => ({
    name: String(r.label || ''),
    asked: docAskedLine(r.requestedAt, today),
    late: isLate(r, today),
  }))
}
