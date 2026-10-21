// WHAT CHANGED IN THE PORTAL, AND HOW WE DO THINGS NOW.
//
// 21 Oct 2026. Fabio, after a day of shipping: "create knowledge base of these
// updates/emails somewhere in the portal for the team".
//
// THE PROBLEM IT SOLVES. Every team email so far has existed in exactly one
// place - his Outlook sent items. Three weeks later a broker who cannot
// remember how a top up works has nowhere to look, and somebody hired next
// month has no record at all that any of it happened.
//
// ---------------------------------------------------------------------------
// WHY THE ENTRIES LIVE HERE AND NOT IN THE DATABASE
// ---------------------------------------------------------------------------
//
// An entry ships with the change it describes. There is never a version of the
// portal doing something that nobody wrote down, and no step between building a
// thing and explaining it. It also means no SQL to run and no credentials to
// handle, which is a standing rule.
//
// The cost is that fixing a typo needs a ship. Named here so the trade is
// visible rather than discovered.
//
// ---------------------------------------------------------------------------
// WHAT GOES IN, AND WHAT DOES NOT
// ---------------------------------------------------------------------------
//
// 240 ships went out in the 30 days to 21 Oct, 93 of which touched a client
// email, the borrowing capacity or the templates. A note per ship would bury
// the team in three a day and train them to ignore the lot.
//
// Fabio's scope, in his words: "this is only sections on updates new templates
// created process etc not all ships we build". So an entry is written when
// somebody asks for one - he types "knowledge base" - and never by a script
// watching commits. He is the only one who knows what the team needs told.

import { emailShell } from './email-shell'

export type Section = 'templates' | 'features' | 'process'

export const SECTIONS: { key: Section; label: string; blurb: string }[] = [
  { key: 'templates', label: 'Templates',
    blurb: 'New scenarios and client emails, and when to reach for them.' },
  { key: 'features', label: 'Features',
    blurb: 'New things the portal does, and what you have to fill in for them.' },
  { key: 'process', label: 'How we work',
    blurb: 'The way we do something has changed.' },
]

export type Entry = {
  /** Stable, lower case, hyphenated. It is the link somebody shares. */
  id: string
  section: Section
  title: string
  /** ISO date. The day it reached the team, not the day it was written. */
  on: string
  /** One or two sentences. What it is and why it exists. */
  lead: string
  /** The rest. A string is a paragraph; an array is a bullet list. */
  body: (string | string[])[]
}

// Newest first is the order they are WRITTEN in, not sorted into - see
// entriesFor(). Keeping the file in the order a person reads it means a diff
// shows one addition at the top rather than a reshuffle.
export const ENTRIES: Entry[] = [
  {
    id: 'top-up-templates',
    section: 'templates',
    title: 'Top up, and Top up + purchase',
    on: '2026-10-21',
    lead: 'Use these when we are increasing a loan with the lender it is already with. '
        + 'That is not a refinance, and until now we had no template that said so.',
    body: [
      'The rule that matters: the LVR counts the existing loan plus the increase. A $1,000,000 '
      + 'house owing $500,000, topped up by $300,000, is 80% — not 30%. The portal works it out, '
      + 'but check it, because the LMI sits on the back of it.',
      [
        'Increasing by is the new money on that property. It is linked to the split, so typing in '
        + 'one fills the other.',
        'A separate split / Added to the current loan changes the repayment, not just the layout. '
        + 'Added means one loan and the repayment is on all of it.',
        'Dollar for dollar is only for a loan actually moving to a new lender at the same balance. '
        + 'It changes the maths, not the wording.',
      ],
      'On Top up + purchase, fill in the New purchase panel. The property being bought gets its own '
      + 'security row, valued at the purchase price, with its own LVR.',
      'Lending options pre-selects the existing lender with the reason filled in. We still compare, '
      + 'but a top up stays where it is unless there is a reason to move.',
    ],
  },
  {
    id: 'repayment-analysis',
    section: 'features',
    title: 'Repayment analysis on refinance emails',
    on: '2026-10-21',
    lead: 'A tick box on Refinance only and Refinance + equity release. It shows the client what '
        + 'happens if they keep paying what they pay now after moving to a lower rate.',
    body: [
      'You fill in three things: years remaining, their current repayment, and the rate they are on '
      + 'today. The years remaining is their remaining term, not the original 30. Get that wrong and '
      + 'the whole block is wrong and still looks right, so take it off the statement.',
      [
        'Never on interest only. Nothing is paying the balance down, so there is nothing to save.',
        'On an equity release it covers the loan being refinanced only. The release is a separate '
        + 'split with its own repayment, and the email says so and gives the new total.',
        'It is on the lending options too, priced off whichever product you recommended.',
      ],
      'The numbers match the calculator on our website to the dollar, so a client who checks gets the '
      + 'same answer. Every email carrying the analysis also carries the calculator disclaimer.',
    ],
  },
  {
    id: 'refinance-saving-second-angle',
    section: 'templates',
    title: 'Refinance saving — the second angle',
    on: '2026-10-21',
    lead: 'The Refinance saving template in Templates now makes either of two cases.',
    body: [
      'A switch on the form: show the monthly saving, or show what happens if the client keeps paying '
      + 'what they pay now. It opens on the saving, so nothing changes unless you move it.',
      'The second one needs nothing extra — the same four figures you already type. There is an '
      + 'optional box for their real repayment if you have the statement in front of you.',
    ],
  },
  {
    id: 'the-loan-that-stays',
    section: 'features',
    title: 'On a top up, the loan that stays',
    on: '2026-10-21',
    lead: 'A top up leaves a loan where it is. The portal now carries that loan through the deal as '
        + 'itself, rather than folding it into the new money.',
    body: [
      'Tick "a separate split" and you get two rows against that property: what is already there, and '
      + 'the increase. The existing one keeps its own rate and its own interest only years. Changing '
      + 'the rate on the new money no longer drags the old loan with it.',
      [
        'The rate on the existing row is read off the fact find \u2014 the loan recorded against that '
        + 'property. Correct it there and the lending options pick it up.',
        'If the property carries two loans, or the one loan has no rate recorded, the box is left '
        + 'blank for you. Nothing is guessed.',
        'In lending options the existing lender is already named, on the rate the client is already '
        + 'paying, so the comparison starts from the truth.',
      ],
      'The position after settlement reads "increasing by $X to $Y, same lender" for that loan, '
      + 'instead of listing it as a new loan being taken out. It is not new, and a client reading '
      + 'that it is will ring you.',
    ],
  },
  {
    id: 'lmi-per-property',
    section: 'features',
    title: 'LMI is asked on the property now',
    on: '2026-10-21',
    lead: 'On a deal with more than one security, LMI is asked against each property rather than once '
        + 'for the whole deal.',
    body: [
      'A lender prices the premium on the security it takes, so that is where the question belongs. '
      + 'Tick a property as a security and the LMI question sits on that row: applicable or waived, '
      + 'the amount, and capitalised or paid at settlement.',
      'What the client sees does not change. The premiums add up into the one figure the emails, the '
      + 'loan rows and the compliance notes already use.',
      'If two properties record LMI and they are paid differently, the form says so. The money has to '
      + 'come from somewhere on settlement day, and half of it being inside the loan is a different deal.',
      'Single-security deals are untouched \u2014 the one set of boxes, where it has always been.',
    ],
  },
  {
    id: 'portfolio-review',
    section: 'process',
    title: 'The portfolio review list',
    on: '2026-10-21',
    lead: '656 past clients are now in Reports, under Portfolio review. These are people who may have '
        + 'usable equity and have not been spoken to.',
    body: [
      'Open one, pick which property the equity comes out of, type the numbers, preview, then copy and '
      + 'mark as sent. A chase is set for a week later automatically, so nothing goes quiet.',
      '267 of them have no loan recorded anywhere. Those say "loan unknown" rather than showing a '
      + 'figure, and they sort below the ones we actually know about. Do not treat them as full '
      + 'equity — we simply do not know.',
      'Nothing here writes to the Clients page. When one is worth doing, you make the deal card '
      + 'yourself and the review is marked as having become a deal.',
      'The wording of that email lives in Settings, under Portfolio review email. Change it there '
      + 'and every review sent after that uses the new words. The figures are always the client\u2019s own.',
    ],
  },
]

export function entriesFor(section: Section | 'all' = 'all', find = ''): Entry[] {
  const want = find.trim().toLowerCase()
  return ENTRIES.filter(e => {
    if (section !== 'all' && e.section !== section) return false
    if (!want) return true
    const hay = [e.title, e.lead, ...e.body.flat()].join(' ').toLowerCase()
    return hay.includes(want)
  })
}

export function sectionLabel(key: Section): string {
  return SECTIONS.find(s => s.key === key)?.label || key
}

/** "21 October 2026", the way a sentence says it. */
export function readableDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// THE SAME WORDS, AS AN EMAIL
// ---------------------------------------------------------------------------
//
// The page the team reads and the email they are sent are one entry. Written
// twice they drift, and the version in somebody's inbox is the one they act on.
//
// WORD PAINTS A BACKGROUND ONLY FROM bgcolor ON A td OR table, and drops colour
// set on a <p>, so every colour below sits on a span inside its paragraph.
// scripts/check-email-html.sh fails the ship otherwise.

// An internal note to the team is not a client document, so it carries no
// credit licence line - just what it is, so a forwarded copy cannot be read as
// advice to anybody outside the business.
const KB_DISCLAIMER =
  'An internal note for the Simplify Finance team about how the portal works. '
  + 'Not advice, and not for sending to clients.'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function entryEmailHtml(e: Entry, opts: { brokerName?: string } = {}): string {
  const para = (t: string) =>
    `<p style="margin:0 0 13px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6">`
    + `<span style="color:#3d3d3a;">${esc(t)}</span></p>`

  const bullets = (items: string[]) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 13px">`
    + items.map(i =>
        `<tr><td valign="top" style="padding:0 7px 7px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px">`
        + `<span style="color:#3d3d3a;">&bull;</span></td>`
        + `<td style="padding:0 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6">`
        + `<span style="color:#3d3d3a;">${esc(i)}</span></td></tr>`).join('')
    + `</table>`

  // THE SAME SHELL EVERY OTHER EMAIL USES.
  //
  // 21 Oct 2026. The first version of this built its own table with a charcoal
  // header band, and scripts/check-email-html.sh refused it twice over: a
  // background with no bgcolor attribute, and white text on a dark cell, which
  // Word paints black on charcoal. Both rules were written after a client
  // received exactly that. emailShell has answered all of it for weeks.
  const inner = ''
    + `<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1.5px">`
    + `<span style="color:#343333;font-weight:600;text-transform:uppercase;">Portal update</span></p>`
    + `<p style="margin:0 0 13px;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.35">`
    + `<span style="color:#1a1a1a;font-weight:bold;">${esc(e.title)}</span></p>`
    + para('Hi team,')
    + para(e.lead)
    + e.body.map(b => Array.isArray(b) ? bullets(b) : para(b)).join('')
    + para('It is all in the portal under Knowledge base if you need it again.')
    + `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6">`
    + `<span style="color:#3d3d3a;">${esc(opts.brokerName || 'Fabio De Castro')}</span><br>`
    + `<span style="color:#8a8a84;font-size:12px;">Director, Simplify Finance</span></p>`

  return emailShell(inner, KB_DISCLAIMER)
}

export function entryPlainText(e: Entry): string {
  const lines = ['Hi team,', '', e.lead, '']
  for (const b of e.body) {
    if (Array.isArray(b)) { for (const i of b) lines.push(`- ${i}`); lines.push('') }
    else { lines.push(b); lines.push('') }
  }
  lines.push('It is all in the portal under Knowledge base if you need it again.')
  return lines.join('\n')
}

/**
 * EVERY TEMPLATE THE TEAM CAN PICK SHOULD BE EXPLAINED SOMEWHERE.
 *
 * The one thing worth automating, because it is narrow enough to be right every
 * time. A new scenario in the picker that no entry mentions is a template
 * somebody will reach for with no idea what it does.
 *
 * It REPORTS - scripts/audit.sh prints it and never blocks. A scenario can
 * legitimately go in before anybody is told about it, and a gate that is
 * routinely overridden is worse than no gate.
 */
/**
 * THE SCENARIOS THAT WERE ALREADY THERE ON THE DAY THIS PAGE WAS BUILT.
 *
 * 21 Oct 2026. The check below is only worth having if it is right every time.
 * On day one it named twelve templates that have existed for months and have
 * never been written up - all true, all a backlog, and twelve lines every audit
 * is how somebody learns to scroll past the whole report.
 *
 * So the backlog is listed once, here, where it can be worked through. Delete a
 * name from this list and the audit asks for it. Add a NEW template without an
 * entry and the audit asks for that too, which is the whole point.
 */
export const WRITTEN_UP_LATER: string[] = [
  'OO purchase',
  'OO purchase \u2014 LVR comparison',
  'Investment purchase',
  'Equity release + purchase',
  'Buy / sell',
  'First home buyer',
  'Bridging loan',
  'Family pledge',
  'SMSF purchase',
  'Construction loan',
  'Debt recycling',
  'Complex refinance',
]

export function templatesWithNoEntry(labels: Record<string, string>): string[] {
  const hay = ENTRIES.map(e => [e.title, e.lead, ...e.body.flat()].join(' ').toLowerCase()).join(' ')
  const known = new Set(WRITTEN_UP_LATER.map(x => x.toLowerCase()))
  return Object.entries(labels)
    .filter(([key, label]) => key !== 'custom'
      && !known.has(String(label).toLowerCase())
      && !hay.includes(String(label).toLowerCase()))
    .map(([, label]) => label)
}
