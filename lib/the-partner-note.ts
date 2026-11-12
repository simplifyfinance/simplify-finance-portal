// THE NOTE THAT GOES TO A REFERRAL PARTNER.
//
// Fabio, 12 Nov 2026, on the version that sent four emails on a Friday timer:
// "the whole thing of the Friday email is shit."
//
// He was right, and the fault was the automation. A management report on a
// timer is fine. An email to a referral partner is a RELATIONSHIP, and the
// portal was writing it, choosing the week, and sending it under a no-reply
// address with nothing but a preview between him and the send.
//
// SO: THE PORTAL BRINGS THE FACTS AND HE BRINGS THE WORDS.
//
// One partner at a time, chosen on purpose. A first draft he can rewrite
// entirely. Ticked periods rather than a fixed week. And it does not send -
// it hands him the HTML, he pastes it into whichever mailbox he wants it to
// come from, which settles who it is from without the portal pretending.
//
// THE BANNER IS THE ONLY BRAND DECISION, AND IT IS NOT A LICENCE QUESTION.
// Fabio: "stop overthinking about the credit licence number, this is just
// going to the referral partner." So there is no ACL, no trading name and no
// address in here. A logo, a note, the numbers, and his name.
//
// NOTHING ABOUT COMMISSION APPEARS ANYWHERE. Not the split, not the terms,
// not a percentage. That is between him and them.

import { happened, referralKey, type Event, type Span } from './who-brought-us-this'
import { amountOf } from './deal-phase'
import { toAuDate, todayYmd, fyEndYear } from './periods'

const txt = (v: any) => String(v ?? '').trim()

// --- the periods he can tick ---------------------------------------------

export type PeriodKey = 'week' | 'month' | 'quarter' | 'fy'

export type Period = { key: PeriodKey; label: string; from: string; to: string }

const pad = (n: number) => String(n).padStart(2, '0')

/** The Monday of a Sydney day, as YYYY-MM-DD. */
function mondayOf(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  const back = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - back)
  return d.toISOString().slice(0, 10)
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December']

/**
 * THE FOUR PERIODS, ALWAYS IN THE SAME ORDER.
 *
 * `today` is a Sydney YYYY-MM-DD, because every one of these boundaries is a
 * Sydney one and slicing a UTC timestamp puts a Monday lodgement in the week
 * before. That fault cost a week's report in November.
 */
export function periodsFor(today: string = todayYmd()): Period[] {
  const d = txt(today).slice(0, 10)
  const year = Number(d.slice(0, 4))
  const month = Number(d.slice(5, 7))
  const qStart = month - ((month - 1) % 3)
  const fyEnd = fyEndYear(d)
  return [
    { key: 'week', label: 'This week', from: mondayOf(d), to: d },
    { key: 'month', label: `${MONTHS[month - 1]} so far`, from: `${year}-${pad(month)}-01`, to: d },
    { key: 'quarter', label: 'This quarter', from: `${year}-${pad(qStart)}-01`, to: d },
    { key: 'fy', label: `FY${String(fyEnd).slice(2)} so far`, from: `${fyEnd - 1}-07-01`, to: d },
  ]
}

// --- what is theirs -------------------------------------------------------

/** Only this partner's deals. Matched on the split the fact find recorded. */
export function dealsOf(deals: any[], partnerId: any, event: Event, span: Span): any[] {
  const want = txt(partnerId)
  if (!want) return []
  return happened(deals, event, span).filter(d => referralKey(d) === want)
}

export type Score = {
  lodged: number; settled: number; lodgedAmount: number; settledAmount: number
}

export function scoreOf(deals: any[], partnerId: any, span: Span): Score {
  const lodged = dealsOf(deals, partnerId, 'lodged', span)
  const settled = dealsOf(deals, partnerId, 'settled', span)
  const money = (rows: any[]) => rows.reduce((t, d) => t + (amountOf(d) || 0), 0)
  return {
    lodged: lodged.length, settled: settled.length,
    lodgedAmount: money(lodged), settledAmount: money(settled),
  }
}

// --- the first draft ------------------------------------------------------

/**
 * A SENTENCE TO EDIT, NOT A BLANK BOX.
 *
 * Where he has saved a note for this partner that is what comes up. Otherwise
 * it says what happened in the first ticked period, which is the sentence
 * anybody would write anyway, and he changes it or does not.
 */
export function draftNote(firstName: any, score: Score, saved?: any): string {
  const hi = `Hi ${txt(firstName) || 'there'},`
  const keep = txt(saved)
  if (keep) return `${hi}\n\n${keep}`

  const bits: string[] = []
  if (score.lodged) bits.push(`${inWords(score.lodged)} lodged`)
  if (score.settled) bits.push(`${inWords(score.settled)} settled`)
  const said = bits.join(' and ')
  const what = bits.length
    ? `${said.charAt(0).toUpperCase()}${said.slice(1)} this week `
      + `— thanks again for the introductions.`
    : 'Nothing of yours moved this week, but everything is in hand.'
  return `${hi}\n\n${what} Shout if you need anything, or if you have somebody `
    + `else I should talk to.`
}

const SMALL = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
function inWords(n: number): string {
  return n >= 0 && n < SMALL.length ? SMALL[n] : String(n)
}

// --- the email ------------------------------------------------------------

export type Brand = {
  id?: any
  name?: any
  headerColor?: any
  accentColor?: any
}

export type Line = { name: string; day: string; lender: string; amount: number }

export type Built = {
  subject: string
  html: string
  text: string
}

const esc = (v: any) => txt(v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const dollars = (n: number) =>
  '$' + Math.round(n || 0).toLocaleString('en-AU')

/** "Wednesday", in Sydney. */
export function dayOf(deal: any, event: Event): string {
  const raw = event === 'settled' ? deal?.settled_at : deal?.lodged_at
  const d = toAuDate(txt(raw) || null)
  if (!d) return ''
  return new Date(`${d}T00:00:00Z`).toLocaleDateString('en-AU',
    { weekday: 'long', timeZone: 'UTC' })
}

export function lineFor(deal: any, event: Event): Line {
  return {
    name: txt(deal?.deal_name) || 'A client',
    day: dayOf(deal, event),
    lender: txt(deal?.lender),
    amount: amountOf(deal) || 0,
  }
}

export function partnerSubject(brandName: any): string {
  const b = txt(brandName)
  return b ? `Your clients this week — ${b}` : 'Your clients this week'
}

// OUTLOOK ON WINDOWS RENDERS WITH WORD, AND WORD HAS TWO HABITS.
//
// It repaints a colour set on a block element - a <div> or a <p> - back to
// black, so every coloured word here sits in a <span>. And it ignores a CSS
// background without the old bgcolor attribute beside it, so every filled cell
// carries both.
//
// scripts/check-email-html.sh enforces exactly this and it caught the first
// version of this file. The rules are not guesses.

function ink(colour: string, style: string, body: string): string {
  return `<span style="color:${colour};${style}">${body}</span>`
}

function scoreCard(n: number, word: string, amount: number, bg: string, edge: string,
                   tone: string, deep: string): string {
  return `<td width="50%" style="padding:0 5px;vertical-align:top">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"`
    + ` bgcolor="${bg}" style="background:${bg};border:1px solid ${edge};border-radius:10px"><tr>`
    + `<td style="padding:16px 16px 14px">`
    + `<div>${ink(tone, 'font:800 38px/1 Helvetica,Arial,sans-serif;letter-spacing:-1.5px', String(n))}</div>`
    + `<div style="padding-top:7px">${ink(tone,
        'font:700 12px/1 Helvetica,Arial,sans-serif;letter-spacing:.09em;text-transform:uppercase',
        esc(word))}</div>`
    + `<div style="padding-top:5px">${ink(deep,
        'font:700 15px/1 Helvetica,Arial,sans-serif', n ? dollars(amount) : '&mdash;')}</div>`
    + `</td></tr></table></td>`
}

function dealRows(lines: Line[]): string {
  return lines.map(l => `<tr><td style="padding:13px 0;border-bottom:1px solid #EDE8E0">`
    + `<div>${ink('#17140F', 'font:700 15px/1.2 Helvetica,Arial,sans-serif', esc(l.name))}</div>`
    + `<div style="padding-top:3px">${ink('#7A746B',
        'font:400 12.5px/1.3 Helvetica,Arial,sans-serif',
        esc([l.day, l.lender].filter(Boolean).join(' · ')))}</div></td>`
    + `<td align="right" style="padding:13px 0;border-bottom:1px solid #EDE8E0;white-space:nowrap">`
    + `${ink('#17140F', 'font:800 16px/1 Helvetica,Arial,sans-serif', dollars(l.amount))}</td></tr>`)
    .join('')
}

function heading(words: string): string {
  return `<p style="margin:26px 0 0;padding-bottom:9px;border-bottom:2px solid #EDE8E0">`
    + ink('#8C867D',
        'font:800 11px/1 Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase',
        esc(words))
    + `</p>`
}

/**
 * THE WHOLE EMAIL, AS HTML HE CAN PASTE.
 *
 * Tables and inline styles only - no stylesheet, no web font, no background
 * image. It has to survive being copied out of a browser and pasted into
 * somebody's mail client, which is a rougher trip than being sent.
 */
export function buildPartnerNote(input: {
  brand: Brand
  note: string
  /** The period whose DEALS are listed. */
  main: { label: string; lodged: Line[]; settled: Line[] }
  /** The rest, as scoreboards only. */
  also: Array<{ label: string; score: Score }>
  from: { name: string; brandName?: string }
}): Built {
  const head = txt(input.brand?.headerColor) || '#343333'
  const accent = txt(input.brand?.accentColor) || '#2DBEFF'
  const brandName = txt(input.brand?.name) || 'Simplify Finance'
  const main = input.main
  const low = main.label.toLowerCase()

  const score: Score = {
    lodged: main.lodged.length,
    settled: main.settled.length,
    lodgedAmount: main.lodged.reduce((t, l) => t + l.amount, 0),
    settledAmount: main.settled.reduce((t, l) => t + l.amount, 0),
  }

  const body = esc(input.note).split(/\n{2,}/).map((para, i) => {
    const html = para.replace(/\n/g, '<br>')
    return i === 0
      ? `<p style="margin:0 0 10px">${ink('#17140F',
          'font:700 17px/1.4 Helvetica,Arial,sans-serif', html)}</p>`
      : `<p style="margin:0 0 16px">${ink('#2E2C29',
          'font:400 15px/1.6 Helvetica,Arial,sans-serif', html)}</p>`
  }).join('')

  const scores = `<p style="margin:0 0 10px">${ink(head,
      'font:800 11px/1 Helvetica,Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase',
      esc(main.label))}</p>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"`
    + ` style="margin:0 -5px 6px"><tr>`
    + scoreCard(score.lodged, 'Lodged', score.lodgedAmount,
        '#EAF7FE', '#BFE4F7', '#107EA8', '#0B5F80')
    + scoreCard(score.settled, 'Settled', score.settledAmount,
        score.settled ? '#EAFAF4' : '#F4F2EE', score.settled ? '#B4E7D5' : '#E3DED6',
        score.settled ? '#137A55' : '#A09A91', score.settled ? '#0E5C42' : '#A09A91')
    + `</tr></table>`

  const lodgedPart = main.lodged.length
    ? heading(`Lodged ${low}`)
      + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">`
      + dealRows(main.lodged) + `</table>`
    : ''

  // NOTHING SETTLED IS A SENTENCE, NOT A HOLE. The pair of headings keeps the
  // same shape every week so a partner learns where to look.
  const settledPart = heading(`Settled ${low}`)
    + (main.settled.length
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">`
        + dealRows(main.settled) + `</table>`
      : `<p style="margin:14px 0 0">${ink('#7A746B',
          'font:400 13.5px/1.4 Helvetica,Arial,sans-serif',
          `Nothing settled ${esc(low)}.`)}</p>`)

  // THE OTHER PERIODS, AS BARS. Fabio, 12 Nov 2026: "why would you make
  // November so far so tiny and hard to see?" Because I had buried it in grey
  // text at the bottom. It is a bar with a number on it now.
  const bars = (input.also || []).map(a =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"`
    + ` bgcolor="${head}" style="background:${head};border-radius:10px;margin-top:26px"><tr>`
    + `<td style="padding:16px 18px">${ink('#9A948C',
        'font:800 11px/1 Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase',
        esc(a.label))}</td>`
    + `<td align="right" style="padding:16px 14px 16px 0">`
    + `<div>${ink(accent, 'font:800 30px/1 Helvetica,Arial,sans-serif;letter-spacing:-1px',
        String(a.score.lodged))}</div>`
    + `<div style="padding-top:3px">${ink('#9A948C',
        'font:600 12px/1 Helvetica,Arial,sans-serif',
        `lodged &middot; ${dollars(a.score.lodgedAmount)}`)}</div></td>`
    + `<td align="right" style="padding:16px 18px 16px 0">`
    + `<div>${ink('#6FE8BC', 'font:800 30px/1 Helvetica,Arial,sans-serif;letter-spacing:-1px',
        String(a.score.settled))}</div>`
    + `<div style="padding-top:3px">${ink('#9A948C',
        'font:600 12px/1 Helvetica,Arial,sans-serif',
        `settled &middot; ${dollars(a.score.settledAmount)}`)}</div></td>`
    + `</tr></table>`).join('')

  const word1 = esc(brandName.split(' ')[0])
  const rest1 = esc(brandName.split(' ').slice(1).join(' ').toUpperCase())

  const html =
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"`
    + ` bgcolor="#ffffff" style="width:600px;max-width:100%;background:#ffffff;`
    + `border-collapse:collapse">`
    + `<tr><td bgcolor="${head}" style="background:${head};padding:26px 30px">`
    + `<div>${ink('#ffffff', 'font:800 26px/1 Helvetica,Arial,sans-serif;letter-spacing:-.8px',
        word1)}${ink(accent, 'font:800 26px/1 Helvetica,Arial,sans-serif', '.')}</div>`
    + (rest1 ? `<div style="padding-top:6px">${ink('#9A948C',
        'font:600 11px/1 Helvetica,Arial,sans-serif;letter-spacing:.22em', rest1)}</div>` : '')
    + `</td></tr>`
    + `<tr><td bgcolor="${accent}" style="background:${accent};height:4px;line-height:4px;`
    + `font-size:0">&nbsp;</td></tr>`
    + `<tr><td style="padding:28px 30px 8px">`
    + body + scores + lodgedPart + settledPart + bars
    + `<p style="margin:24px 0 16px">${ink('#2E2C29',
        'font:400 15px/1.6 Helvetica,Arial,sans-serif', 'Cheers')}</p>`
    + `</td></tr>`
    + `<tr><td style="padding:20px 30px 26px;border-top:1px solid #EDE8E0">`
    + `<div>${ink('#17140F', 'font:700 15px/1.2 Helvetica,Arial,sans-serif',
        esc(input.from?.name))}</div>`
    + `<div style="padding-top:2px">${ink('#6F6A62',
        'font:400 13px/1.3 Helvetica,Arial,sans-serif',
        esc(input.from?.brandName || brandName))}</div>`
    + `</td></tr></table>`

  const money = (l: Line) =>
    `  ${l.name} — ${[l.day, l.lender].filter(Boolean).join(', ')} — ${dollars(l.amount)}`

  const plain = [
    input.note,
    '',
    `${main.label}: ${score.lodged} lodged, ${score.settled} settled`,
    ...(main.lodged.length ? ['', `Lodged ${low}:`, ...main.lodged.map(money)] : []),
    ...(main.settled.length ? ['', `Settled ${low}:`, ...main.settled.map(money)] : []),
    ...(input.also || []).map(a =>
      `\n${a.label}: ${a.score.lodged} lodged (${dollars(a.score.lodgedAmount)}), `
      + `${a.score.settled} settled (${dollars(a.score.settledAmount)})`),
    '',
    'Cheers',
    txt(input.from?.name),
  ].join('\n')

  return { subject: partnerSubject(brandName), html, text: plain }
}
