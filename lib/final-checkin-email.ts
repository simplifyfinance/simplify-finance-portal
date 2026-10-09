import { emailShell } from './email-shell'
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
// as written.
//
// NO FIGURES, NO BLOCKS, NO CONDITIONS. Every other milestone email assembles
// rows out of the deal and names what is missing. There is nothing to get wrong
// here, which is also why it is always ready to send.
//
// MULTI BRAND LIKE THE REST. The header, the colours and the footer come off
// the Brand record, so this goes out correctly under whichever trading name the
// deal is on. See lib/brand.ts.

export type FinalCheckinContext = {
  brand?: Brand
  // "Lucy", or "Lucy and James". Built by clientFirstNames().
  clientNames: string
  senderName: string
  senderEmail: string
  senderPhone: string
  senderWeb: string
}

const FONT = 'Arial, Helvetica, sans-serif'
const BODY = '#3d3d3a'

const p = (t: string) =>
  `<p style="margin:0 0 15px;font-family:${FONT};font-size:15px;color:${BODY};line-height:1.65;"><span style="color:${BODY};">${t}</span></p>`

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

export const SUBJECT = 'Final Check-In – Borrowing Capacity Review'

export function buildFinalCheckinEmail(ctx: FinalCheckinContext): {
  subject: string; html: string; plainText: string
} {
  const brand = ctx.brand || DEFAULT_BRAND
  const hi = (ctx.clientNames || '').trim() || 'there'

  const body = p(`Hi ${hi},`) + LINES.map(p).join('') +
    signature(ctx.senderName, brand.name, ctx.senderEmail, ctx.senderPhone, ctx.senderWeb)

  return {
    subject: SUBJECT,
    // NO DISCLAIMER BLOCK. There is not a figure, a rate or a recommendation in
    // it - nothing to qualify. The brand's own footer still prints.
    html: emailShell(body, '', brand),
    plainText: plain([
      `Hi ${hi},`, '',
      ...LINES.flatMap(l => [l, '']),
      'Kind regards,', ctx.senderName, brand.name,
    ]),
  }
}
