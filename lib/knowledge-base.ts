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

// ---------------------------------------------------------------------------
// WHAT AN ENTRY IS MADE OF
// ---------------------------------------------------------------------------
//
// 21 Oct 2026. The first version was paragraphs and bullets, which was enough
// for a four line note about a tick box. The lending options guide is six
// numbered steps with two watch-outs and a worked table, and flattened into
// bullets it became forty lines nobody would read.
//
// So four shapes, no more. A paragraph, a bullet list, a numbered step, a
// callout, and a small table. Every one of them has to survive Word, which is
// why the table carries no colour except a bgcolor on the row that wins.
export type Step = { step: string; body: (string | string[])[] }
export type Call = { title: string; call: string; watch?: boolean }
export type Figure = { figure: string; head: string[]; rows: string[][]; win?: number }
export type Block = string | string[] | Step | Call | Figure

const isObj = (b: Block): b is Step | Call | Figure =>
  typeof b === 'object' && b !== null && !Array.isArray(b)
export const isBullets = (b: Block): b is string[] => Array.isArray(b)
export const isStep = (b: Block): b is Step => isObj(b) && 'step' in b
export const isCall = (b: Block): b is Call => isObj(b) && 'call' in b
export const isFigure = (b: Block): b is Figure => isObj(b) && 'figure' in b

/** Steps number themselves, so a callout can sit between two of them. */
export function stepNumber(body: Block[], at: number): number {
  let n = 0
  for (let i = 0; i <= at && i < body.length; i++) if (isStep(body[i])) n++
  return n
}

export type Entry = {
  /** Stable, lower case, hyphenated. It is the link somebody shares. */
  id: string
  section: Section
  title: string
  /** ISO date. The day it reached the team, not the day it was written. */
  on: string
  /** One or two sentences. What it is and why it exists. */
  lead: string
  body: Block[]
}

/** Every word in an entry, for searching and for measuring how long it is. */
export function searchText(e: Entry): string {
  const out: string[] = [e.title, e.lead]
  const eat = (b: Block) => {
    if (isBullets(b)) out.push(...b)
    else if (isStep(b)) { out.push(b.step); for (const x of b.body) eat(x) }
    else if (isCall(b)) out.push(b.title, b.call)
    else if (isFigure(b)) out.push(b.figure, ...b.head, ...b.rows.flat())
    else out.push(b)
  }
  e.body.forEach(eat)
  return out.join(' ')
}

// HOW LONG IS TOO LONG TO OPEN BY ITSELF.
//
// Six guides the length of the lending options one, all open, is a page nobody
// scrolls. Over this, an entry shows its lead and its first two blocks behind a
// fade with a button. Under it, nothing changes and nothing is hidden.
export const LONG_WORDS = 320
export const PREVIEW_BLOCKS = 2

export function wordCount(e: Entry): number {
  const t = searchText(e).trim()
  return t ? t.split(/\s+/).length : 0
}
export function isLong(e: Entry): boolean { return wordCount(e) > LONG_WORDS }
/** 220 words a minute, rounded, never less than one. */
export function readingMinutes(e: Entry): number {
  return Math.max(1, Math.round(wordCount(e) / 220))
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
    lead: 'Two new scenarios on the borrowing capacity. Use them whenever we are increasing a loan '
        + 'with the lender it is already with. That is not a refinance, and until now we had no '
        + 'template that said so.',
    body: [
      [
        'Top up — increasing an existing loan. Nothing is bought, nothing is discharged.',
        'Top up + purchase — the same, and the increase funds the deposit on a new property.',
      ],
      {
        title: 'The one rule that matters',
        watch: true,
        call: 'The LVR counts the existing loan plus the increase. A $1,000,000 house owing $500,000, '
            + 'topped up by $300,000, is 80% — not 30%. The portal does this for you, but check it, '
            + 'because the LMI sits on the back of it.',
      },
      {
        figure: 'Each property on the deal gets its own row and its own LVR',
        head: ['', 'Owes now', 'Increasing by', 'New limit', 'LVR'],
        rows: [['The house', '$500,000', '$300,000', '$800,000', '80%']],
      },
      'Three controls on the securities block.',
      [
        'Increasing by — the new money on that property. It is linked to the split, so typing in one '
        + 'fills the other.',
        'A separate split / Added to the current loan — this changes the repayment. Added means one '
        + 'loan of $800,000 and the repayment is on all of it. Separate means two lines and the '
        + 'repayment on each.',
        'Dollar for dollar — tick this only when that loan is actually moving to a new lender at the '
        + 'same balance. It changes the maths, not just the wording: no increase, no cash released, '
        + 'and it stops that lender being recommended.',
      ],
      'What happens downstream.',
      [
        'Lending options — the existing lender is pre-selected as the recommendation, with the reason '
        + 'filled in. We still compare, but a top up stays where it is unless there is a reason to move.',
        'Compliance — the pack now says the loan is increasing and staying with its current lender. It '
        + 'will not call it a refinance and will not show a discharge.',
        'LMI — asked on any property whose own LVR goes over 80%, right on that row.',
      ],
      'On Top up + purchase, fill in the New purchase panel. The property being bought gets its own '
      + 'security row, valued at the purchase price, with its own LVR.',
    ],
  },
  {
    id: 'repayment-analysis',
    section: 'features',
    title: 'The repayment analysis',
    on: '2026-10-21',
    lead: 'On a refinance the client’s repayment drops and the saving quietly disappears into the week. '
        + 'There is now a tick box on the BC — Include a repayment analysis in the client email — that '
        + 'shows them what happens if they keep paying what they pay now.',
    body: [
      {
        figure: '$600,000 with 25 years to run, moving from 6.14% to 5.59%',
        head: ['', 'Repayment', 'Finishes', 'Interest'],
        rows: [
          ['Stay as you are', '$3,917', '25 years 1 month', '$575,326'],
          ['Take the lower repayment', '$3,717', '25 years', '$515,054'],
          ['Keep paying $3,917', '$3,917', '22 years 6 months', '$453,699'],
        ],
        win: 2,
      },
      'Same money out each month, $121,627 saved and the loan gone 2 years 7 months early.',
      'You fill in three things — years remaining, their current repayment, and the rate they are on. '
      + 'The years remaining is their remaining term, not the original 30. Get that wrong and the whole '
      + 'block is wrong and still looks right, so take it off the statement.',
      [
        'It is on Refinance only and Refinance + equity release. On an equity release it covers the '
        + 'loan being refinanced only — the release is a separate split with its own repayment, and '
        + 'the email says so and gives the new total.',
        'Never on interest only. Nothing is paying the balance down, so there is nothing to save. The '
        + 'tick box greys out and tells you why.',
        'It is on the lending options too, priced off whichever product you have recommended. Star a '
        + 'different lender and the saving follows it. Nothing is re-typed.',
      ],
      {
        title: 'Why the first row is not a round 25 years',
        call: 'The term you type is what staying put costs if they pay the exact minimum. Round the '
            + 'repayment down by thirty cents and there is a stub month on the end. The table shows '
            + 'when staying put really finishes, so the years saved and the two rows agree.',
      },
      'The numbers match our website. The calculator at simplifyfinance.com.au gives the same answers '
      + 'to the dollar, so a client who checks our email against it gets the same result. Every email '
      + 'carrying the analysis also carries the calculator disclaimer.',
      'If you want to send just this to someone, without the full borrowing capacity around it, use '
      + 'Refinance saving under Templates and switch it to the second angle. There is no separate '
      + 'scenario on the BC for it.',
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
      'Tick a separate split and you get two rows against that property: what is already there, and '
      + 'the increase. The existing one keeps its own rate and its own interest only years. Changing '
      + 'the rate on the new money no longer drags the old loan with it.',
      [
        'The rate on the existing row is read off the fact find — the loan recorded against that '
        + 'property. Correct it there and the lending options pick it up.',
        'If the property carries two loans, or the one loan has no rate recorded, the box is left '
        + 'blank for you. Nothing is guessed.',
        'In lending options the existing lender is already named, on the rate the client is already '
        + 'paying, so the comparison starts from the truth.',
      ],
      'The position after settlement reads increasing by $X to $Y, same lender for that loan, instead '
      + 'of listing it as a new loan being taken out. It is not new, and a client reading that it is '
      + 'will ring you.',
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
      + 'loan rows and the compliance notes already use. Single-security deals are untouched — the one '
      + 'set of boxes, where it has always been.',
      {
        title: 'Two properties, two different answers',
        watch: true,
        call: 'If two properties record LMI and they are paid differently — one capitalised, one at '
            + 'settlement — the form says so. The money has to come from somewhere on settlement day, '
            + 'and half of it being inside the loan is a different deal.',
      },
    ],
  },
  {
    id: 'lending-options-step-by-step',
    section: 'process',
    title: 'Lending options, step by step',
    on: '2026-10-19',
    lead: 'What you press, what the client gets, what they press, and what lands back in your inbox. '
        + 'Read it once and you will know where every deal is at a glance.',
    body: [
      {
        title: 'What changed',
        call: 'The lending options email used to end with one button saying I am ready to proceed. It '
            + 'never named the bank, so when a client pressed it the portal recorded that they had '
            + 'agreed — but not what they had agreed to. It now names the lender, and there are two '
            + 'buttons: the client can say yes, or ask to talk first.',
      },
      {
        step: 'You pick the recommendation',
        body: [
          'On the Lending options tab, next to the option you are recommending, press Set as '
          + 'recommended. Or use the Our recommendation dropdown further down.',
          'This is the step everything else hangs off. The bank you pick here is the bank printed on '
          + 'the button in the client’s email, the bank named on their landing page, and the bank '
          + 'recorded against their confirmation. Get this one right and the rest is automatic.',
        ],
      },
      {
        title: 'Watch out',
        watch: true,
        call: 'If you have two options from the same bank — say Bankwest Simple and Bankwest Package — '
            + 'and you have not set one as recommended, the portal will not guess. The client’s email '
            + 'falls back to the old single unnamed button, and nothing about a lender is recorded. '
            + 'Always set the recommendation on the exact product.',
      },
      {
        step: 'You generate and send the email',
        body: [
          'At the bottom of the form, press Generate LO email. Then go to the Preview tab and press '
          + 'Send to client — that copies the email, and you paste it into Outlook.',
          'Credit team: you will not see Send to client. You press Done — send to broker for review '
          + 'instead. Only the broker sends it.',
        ],
      },
      {
        step: 'What the client sees at the bottom of that email',
        body: [
          'Everything above this point in the email is exactly as it has always been — their figures, '
          + 'your recommendation note, the comparison table. Only the ending changed.',
          'It reads: happy to go ahead with St George? Press the first button below. If you would '
          + 'rather talk it through, press the second one and we will call you. Then two buttons — '
          + 'Proceed with the lender you recommended, and I’d rather talk it through first — and the '
          + 'line offering to book a time.',
        ],
      },
      {
        step: 'Where each button takes them',
        body: [
          'Two buttons, two different landing pages. There is no second button to press on either '
          + 'page. The client has already answered; the page just tells them what has happened.',
          [
            'Proceed — the deal moves to Compliance, exactly as it did before, and the lender is '
            + 'recorded as the one the client themselves confirmed, with the date and time. Documents '
            + 'are requested and the credit officer is allocated, same as always.',
            'I’d rather talk it through — nothing. The deal stays on Lending options. No stage change, '
            + 'no credit officer, no documents requested, no card moved. It raises a flag on the deal '
            + 'and emails you.',
          ],
          'That is deliberate. A client picking a different bank off a web page with nobody on the '
          + 'phone is not advice and is not a structure. You ring them, and then you record what they '
          + 'decided.',
        ],
      },
      {
        step: 'The email that lands in your inbox',
        body: [
          'Goes to the assigned broker, copied to info@simplifyfinance.com.au. Same list as always. Do '
          + 'not rely on spotting the flag in the portal — the email is the thing that tells you.',
          [
            'If they confirmed — the subject says they confirmed the lender and have moved to '
            + 'Compliance. The body says whether the document request went out, and links to the deal.',
            'If they asked to talk — the subject starts ACTION NEEDED. The body says nothing has '
            + 'moved, nothing has been submitted, no lender has been recorded, and to call them and '
            + 'then record the decision on the lending options tab.',
          ],
        ],
      },
      {
        step: 'What you do back in the portal',
        body: [
          'Open the deal, go to Lending options, and look at The client’s decision at the bottom. It '
          + 'is the same box it has always been. What changed is what it tells you before you answer it.',
          'You still press Yes or No. The green line is evidence, not the answer. The portal will not '
          + 'tick a compliance box on your behalf because a web page loaded — that answer has to come '
          + 'from a person. Where the client confirmed it themselves, Yes is one press and you are done.',
          'Pressing No works exactly as it always has: pick the bank they chose from the dropdown, and '
          + 'type why. That reason goes into the compliance notes.',
        ],
      },
      'Three other things will come up.',
      [
        'I pressed that by mistake — there is a quiet line at the bottom of the confirmation page for '
        + 'exactly this. If they press it you get an email headed ACTION NEEDED. The deal is not '
        + 'pulled back automatically: it has already moved to Compliance and it stays there until you '
        + 'decide otherwise. Ring them first.',
        'The client rings you instead of pressing anything — nothing changes for you. Use Client '
        + 'agreed, move to Compliance above the tabs, exactly as you do now, and answer the box '
        + 'yourself. That is recorded as recorded by the office rather than confirmed by the client, '
        + 'which is the truth about it.',
        'Every deal already sent, and every deal already proceeded — untouched. Emails already sitting '
        + 'in a client’s inbox still work exactly as they did, with the old single button. Deals where '
        + 'a client has already pressed it have no lender recorded against their confirmation, and we '
        + 'are not inventing one.',
      ],
      {
        title: 'Can anyone get into the portal through that page?',
        call: 'No, and it is a fair question. The client’s page is a dead end. It is the only page in '
            + 'the portal that opens without a login, and it has no menu, no sidebar, no search and no '
            + 'link back into the portal — typing any other address lands you on the sign-in screen. '
            + 'It reads five things: the client’s first name, whether they have already proceeded, the '
            + 'lender recorded, and whether they asked for a call. No fact find, no income, no '
            + 'figures, no notes, no fees, no other lenders, no other deals. The link is unguessable '
            + 'and it only ever opens that one deal. The thing worth telling a client who asks is the '
            + 'plain version: that link is personal to them, and anyone they forward it to can press '
            + 'the button on their behalf.',
      },
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
      '267 of them have no loan recorded anywhere. Those say loan unknown rather than showing a '
      + 'figure, and they sort below the ones we actually know about. Do not treat them as full '
      + 'equity — we simply do not know.',
      'Nothing here writes to the Clients page. When one is worth doing, you make the deal card '
      + 'yourself and the review is marked as having become a deal.',
      'The wording of that email lives in Settings, under Portfolio review email. Change it there and '
      + 'every review sent after that uses the new words. The figures are always the client’s own.',
    ],
  },
]

export function entriesFor(section: Section | 'all' = 'all', find = ''): Entry[] {
  const want = find.trim().toLowerCase()
  return ENTRIES.filter(e => {
    if (section !== 'all' && e.section !== section) return false
    if (!want) return true
    // Through searchText, so a word inside a step or a callout is found. A
    // flat() over the body would stringify the objects and match nothing.
    return searchText(e).toLowerCase().includes(want)
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

  // A NUMBERED STEP. The number is plain bold text in its own narrow cell, not
  // a white digit on a dark circle - Word paints pale text on a dark cell black
  // and scripts/check-email-html.sh refuses it before it can happen.
  const step = (n: number, title: string, inner: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px">`
    + `<tr><td width="22" valign="top" style="padding:0 8px 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px">`
    + `<span style="color:#1a1a1a;font-weight:bold;">${n}.</span></td>`
    + `<td style="padding:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">`
    + `<span style="color:#1a1a1a;font-weight:bold;">${esc(title)}</span></td></tr>`
    + `<tr><td>&nbsp;</td><td>${inner}</td></tr></table>`

  // A CALLOUT. The background is a bgcolor attribute, which is the only way
  // Word paints one, and the text on it is dark on pale either way round.
  const call = (c: Call) => {
    const bg = c.watch ? '#FDEDED' : '#EAF7FE'
    const edge = c.watch ? '#F5C9C9' : '#BFE4F7'
    const ink = c.watch ? '#7A2020' : '#0B5F7D'
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 13px">`
      + `<tr><td bgcolor="${bg}" style="padding:11px 13px;border:1px solid ${edge};`
      + `font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6">`
      + `<span style="color:${ink};font-weight:bold;">${esc(c.title)}</span><br>`
      + `<span style="color:${ink};">${esc(c.call)}</span></td></tr></table>`
  }

  // A SMALL TABLE. One pale row to mark the one that wins, and nothing else.
  const figure = (f: Figure) => {
    const th = (t: string, right: boolean) =>
      `<td align="${right ? 'right' : 'left'}" style="padding:0 0 5px;font-family:Arial,Helvetica,sans-serif;font-size:9.5px;letter-spacing:.5px">`
      + `<span style="color:#6b6b66;font-weight:bold;text-transform:uppercase;">${esc(t) || '&nbsp;'}</span></td>`
    const td = (t: string, right: boolean, win: boolean) =>
      `<td align="${right ? 'right' : 'left'}"${win ? ' bgcolor="#EAFAF4"' : ''} `
      + `style="padding:7px 0;border-top:1px solid #F0EEE9;font-family:Arial,Helvetica,sans-serif;font-size:12.5px">`
      + `<span style="color:${right ? '#1a1a1a' : '#3d3d3a'};${right ? 'font-weight:bold;' : ''}">${esc(t) || '&nbsp;'}</span></td>`
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 13px">`
      + `<tr><td colspan="${f.head.length}" style="padding:0 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.6px">`
      + `<span style="color:#8a8a84;text-transform:uppercase;">${esc(f.figure)}</span></td></tr>`
      + `<tr>${f.head.map((h, i) => th(h, i > 0)).join('')}</tr>`
      + f.rows.map((r, ri) =>
          `<tr>${r.map((c, ci) => td(c, ci > 0, f.win === ri)).join('')}</tr>`).join('')
      + `</table>`
  }

  const blockHtml = (b: Block, n: number): string => {
    if (isBullets(b)) return bullets(b)
    if (isCall(b)) return call(b)
    if (isFigure(b)) return figure(b)
    if (isStep(b)) return step(n, b.step, b.body.map(x => blockHtml(x, 0)).join(''))
    return para(b)
  }

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
    + e.body.map((b, i) => blockHtml(b, stepNumber(e.body, i))).join('')
    + para('It is all in the portal under Knowledge base if you need it again.')
    + `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6">`
    + `<span style="color:#3d3d3a;">${esc(opts.brokerName || 'Fabio De Castro')}</span><br>`
    + `<span style="color:#8a8a84;font-size:12px;">Director, Simplify Finance</span></p>`

  return emailShell(inner, KB_DISCLAIMER)
}

export function entryPlainText(e: Entry): string {
  const lines = ['Hi team,', '', e.lead, '']
  const put = (b: Block, n: number) => {
    if (isBullets(b)) { for (const i of b) lines.push(`- ${i}`); lines.push('') }
    else if (isCall(b)) { lines.push(`${b.title}: ${b.call}`); lines.push('') }
    else if (isFigure(b)) {
      lines.push(b.figure)
      for (const r of b.rows) lines.push(r.filter(Boolean).join('  |  '))
      lines.push('')
    }
    else if (isStep(b)) {
      lines.push(`${n}. ${b.step}`)
      for (const x of b.body) put(x, 0)
    }
    else { lines.push(b); lines.push('') }
  }
  e.body.forEach((b, i) => put(b, stepNumber(e.body, i)))
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
  const hay = ENTRIES.map(e => searchText(e).toLowerCase()).join(' ')
  const known = new Set(WRITTEN_UP_LATER.map(x => x.toLowerCase()))
  return Object.entries(labels)
    .filter(([key, label]) => key !== 'custom'
      && !known.has(String(label).toLowerCase())
      && !hay.includes(String(label).toLowerCase()))
    .map(([, label]) => label)
}
