import { emailShell, shellButton, FONT } from './email-shell'
import { type Brand, DEFAULT_BRAND } from './brand'
import { signature, plain } from './milestone-email-parts'

// THE FINAL CHECK-IN.
//
// 9 Oct 2026. Fabio's own SalesTrekker template, "Lead - BC done - final check
// in email". The borrowing capacity went out, the client went quiet, and this
// closes the file without closing the door.
//
// HIS WORDS, NOT A REWRITE. The whole value of this email is its tone - it has
// to let somebody off the hook and still leave them able to come back without
// feeling they have to apologise. That was already right; it is carried across
// as written. Three layouts were mocked and he picked this one, which moves
// nothing and changes no wording.
//
// THE SECOND PARAGRAPH IS LIFTED OUT. It is the sentence doing the emotional
// work - the one that says you have done nothing wrong - and in a flat run of
// four it is the easiest to skim past. It sits in its own tinted panel so it is
// what the eye lands on.
//
// AND THERE IS A WAY BACK IN. "We can simply pick things back up from where we
// left off" was a figure of speech with nothing behind it; the broker's own
// Calendly link turns it into one click. A broker with no link on file simply
// gets no button - never a dead one, and never somebody else's calendar.
//
// NO FIGURES, NO BLOCKS, NO CONDITIONS. Every other milestone email assembles
// rows out of the deal and names what is missing. There is nothing to get wrong
// here, which is also why it is always ready to send.
//
// MULTI BRAND LIKE THE REST. The header, the colours and the footer come off
// the Brand record, so this goes out correctly under whichever trading name the
// broker is sending as. See lib/brand.ts.

export type FinalCheckinContext = {
  brand?: Brand
  // "Lucy", or "Lucy and James". Built by clientFirstNames().
  clientNames: string
  senderName: string
  senderEmail: string
  senderPhone: string
  senderWeb: string
  // The chosen broker's own booking link. Blank is a legitimate state and means
  // no button rather than a broken one - see the note above.
  calendlyUrl?: string
}

const BODY = '#3d3d3a'
const PANEL = '#F5FBFE'
const ACCENT = '#2DBEFF'

const p = (t: string) =>
  `<p style="margin:0 0 15px;font-family:${FONT};font-size:15px;color:${BODY};line-height:1.65;"><span style="color:${BODY};">${t}</span></p>`

// THE LIFTED PARAGRAPH.
//
// A table, not a div with a border-left. Outlook on Windows renders through
// Word, which throws away CSS borders and paints a background only from a
// bgcolor attribute - so the rule is its own cell and every coloured cell
// carries the attribute. Same rule the rest of the shell follows;
// scripts/check-email-html.sh fails the ship if it slips.
const pulled = (t: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 15px;"><tr>
<td bgcolor="${ACCENT}" width="3" style="background-color:${ACCENT};width:3px;font-size:0;line-height:0;">&nbsp;</td>
<td bgcolor="${PANEL}" style="background-color:${PANEL};padding:13px 16px;font-family:${FONT};">
<span style="font-size:15px;color:${BODY};line-height:1.65;">${t}</span>
</td></tr></table>`

// THE FOUR PARAGRAPHS, IN HIS ORDER.
const LINES = [
  'I just wanted to do one final check-in regarding the borrowing capacity assessment we prepared for you.',
  'I completely understand that things can get busy and plans can change, so if the timing is not quite ' +
  'right at the moment, there is absolutely no problem.',
  'I will close off your file for now, but please know that if your plans pick back up or you would like ' +
  'to revisit your options down the track, I would be more than happy to help. We can simply pick things ' +
  'back up from where we left off.',
  'Wishing you all the best in the meantime, and please feel free to reach out anytime if I can assist.',
]

// Which of the four is lifted. Named rather than an index in the middle of the
// builder, so moving it is a decision somebody makes on purpose.
const LIFTED = 1

export const BOOK_LABEL = 'Book a time that suits you'

// 9 Oct 2026, Fabio: "One last check-in on your borrowing capacity ius the
// subject line". Lower case and in his voice - it reads like a person wrote it
// rather than a system announcing a stage, which is the whole point of this one.
export const SUBJECT = 'One last check-in on your borrowing capacity'

export function buildFinalCheckinEmail(ctx: FinalCheckinContext): {
  subject: string; html: string; plainText: string
} {
  const brand = ctx.brand || DEFAULT_BRAND
  const hi = (ctx.clientNames || '').trim() || 'there'
  const book = String(ctx.calendlyUrl || '').trim()

  const body = p(`Hi ${hi},`)
    + LINES.map((l, i) => (i === LIFTED ? pulled(l) : p(l))).join('')
    + (book ? shellButton(book, BOOK_LABEL, ACCENT) : '')
    + signature(ctx.senderName, brand.name, ctx.senderEmail, ctx.senderPhone, ctx.senderWeb)

  return {
    subject: SUBJECT,
    // NO DISCLAIMER BLOCK. There is not a figure, a rate or a recommendation in
    // it - nothing to qualify. The brand's own footer still prints.
    html: emailShell(body, '', brand),
    plainText: plain([
      `Hi ${hi},`, '',
      ...LINES.flatMap(l => [l, '']),
      ...(book ? [`${BOOK_LABEL}: ${book}`, ''] : []),
      'Kind regards,', ctx.senderName, brand.name,
    ]),
  }
}
