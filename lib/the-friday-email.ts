// THE FRIDAY EMAIL.
//
// 11 Nov 2026. Fabio: "I want the ability to automate an email that is sent to
// us every Friday that Alan and I can then forward to Justin to say, hey, this
// week we had these many deals lodged and these many deals settled that were
// your referrals. This allows us to manage the referral relationship."
//
// WRITTEN TO THE REFERRER, SENT TO US. So forwarding is one press with nothing
// to rewrite, and nothing reaches a referral partner that neither of them has
// read. A partner can be switched to direct one at a time, and the default is
// not direct.
//
// AND NOTHING AT ALL IN A QUIET WEEK. There is deliberately no empty version
// of this email. A Friday message saying "nothing this week" is how a weekly
// message stops being opened, and then the one that matters is missed too.
//
// THE YEAR LINE IS THE ONE THAT MANAGES THE RELATIONSHIP. Three this week is a
// number. Eleven since July is a conversation about what next year looks like.

import { money } from './money'
import { dayWords, lenderOf, type ForReferrer, type Line2, type Totals } from './who-brought-us-this'

const txt = (v: any) => String(v ?? '').trim()

export type Mode = 'off' | 'to_us' | 'direct'

export function modeOf(v: any): Mode {
  const t = txt(v)
  return t === 'direct' ? 'direct' : t === 'to_us' ? 'to_us' : 'off'
}

export const MODE_LABEL: Record<Mode, string> = {
  off: 'Not on the weekly',
  to_us: 'To us, to forward',
  direct: 'Straight to them',
}

function amount(deal: any): string {
  return money(deal?.settled_total ?? deal?.lodged_total ?? deal?.loan_amount) || ''
}

function line(deal: any, event: 'lodged' | 'settled'): string {
  const bits = [
    txt(deal?.deal_name) || 'a deal',
    lenderOf(deal),
    amount(deal),
    dayWords(deal, event),
  ].filter(Boolean)
  return bits.join(' — ')
}

export function referrerSubject(r: ForReferrer, weekEnding: string): string {
  const bits: string[] = []
  if (r.lodged.length) bits.push(`${r.lodged.length} lodged`)
  if (r.settled.length) bits.push(`${r.settled.length} settled`)
  return `${r.name} — week to ${weekEnding}: ${bits.join(', ')}`
}

export function referrerBody(r: ForReferrer, firstName?: string): string {
  const out: string[] = [`Hi ${txt(firstName) || txt(r.name).split(/[\s,]+/)[0] || 'there'},`, '']
  out.push('A quick update on the deals you sent us this week.', '')
  if (r.lodged.length) {
    out.push(`Lodged — ${r.lodged.length}`)
    for (const d of r.lodged) out.push(`- ${line(d, 'lodged')}`)
    out.push('')
  }
  if (r.settled.length) {
    out.push(`Settled — ${r.settled.length}`)
    for (const d of r.settled) out.push(`- ${line(d, 'settled')}`)
    out.push('')
  }
  // SINCE 1 JULY, not "all time" - a financial year is the unit everybody in
  // this business already thinks in.
  out.push(`That takes you to ${r.yearLodged} lodged and ${r.yearSettled} settled since 1 July.`, '')
  out.push('Thanks as always — anything you want chased, just reply.')
  return out.join('\n')
}

/** What goes at the top when it is coming to us to forward, never to them. */
export const FORWARD_NOTE =
  'Ready to forward. Everything below this line is written to them.'

// --- the management one -------------------------------------------------------

export function managementSubject(t: Totals, weekEnding: string): string {
  return `Week to ${weekEnding}: ${t.lodged} lodged, ${t.settled} settled`
}

export function managementBody(
  t: Totals, referral: Line2[], brokers: Line2[], ahead: { next: number; noWeek: number },
  weekEnding: string,
): string {
  const out: string[] = [
    `Week to ${weekEnding}.`,
    '',
    `Lodged: ${t.lodged}${t.lodgedAmount ? ' — ' + money(t.lodgedAmount) : ''}`,
    `Settled: ${t.settled}${t.settledAmount ? ' — ' + money(t.settledAmount) : ''}`,
    '',
  ]
  if (referral.length) {
    out.push('WHO BROUGHT IT')
    for (const r of referral) {
      out.push(`- ${r.name}${r.terms ? ' (' + r.terms + ')' : ''}: `
        + `${r.lodged.length} lodged, ${r.settled.length} settled`)
    }
    out.push('')
  }
  if (brokers.length) {
    out.push('BY BROKER')
    for (const b of brokers) {
      out.push(`- ${b.name}: ${b.lodged.length} lodged, ${b.settled.length} settled`)
    }
    out.push('')
  }
  // THE FORWARD LINE. A week's result on its own is half the picture.
  out.push(`Due to lodge next week: ${ahead.next}`)
  out.push(`Still with no week set: ${ahead.noWeek}`)
  out.push('')
  out.push('Every figure comes off the day each deal was marked lodged and the day it settled.')
  return out.join('\n')
}

/** Friday of the week a date falls in, written out. */
export function weekEndingWords(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // Monday is 1, so Friday is four days after the week's Monday.
  const back = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - back + 4)
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
}
