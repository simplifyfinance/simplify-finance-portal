// WHAT WE LODGED AND SETTLED, AND WHO BROUGHT IT.
//
// 11 Nov 2026. Fabio: "right now we have a manual process that we go to a
// Teams channel, and every time we lodge a deal, we write there that the deal
// is lodged, and then that's how it gets counted."
//
// Nothing here is typed. Every figure comes off the two dates the board
// already writes - the day somebody pressed Mark as lodged, and the day it
// settled - so this and the deal board cannot disagree about what happened.
// That is the whole point: a Teams channel is a second record, and a second
// record is one that drifts.
//
// TWO BREAKDOWNS, BECAUSE THE BUSINESS IS RUN OFF BOTH. Who brought it answers
// the referral question - "Justin sent us three this week" - and who the
// broker is answers the management one. A deal appears in both, once each.
//
// AND THE TERMS COME OFF THE DEAL, NOT OFF THE SPLIT. A split renegotiated
// next year must not change what a settled deal says was agreed at the time -
// see the rule at the top of lib/who-shares-this-deal.ts. So the grouping key
// is the split's id and the words beside it are the deal's own copy.

import { splitOn, linesInWords, type Line } from './who-shares-this-deal'
import { amountOf } from './deal-phase'

const txt = (v: any) => String(v ?? '').trim()

export type Event = 'lodged' | 'settled'

const COLUMN: Record<Event, string> = {
  lodged: 'lodged_at',
  settled: 'settled_at',
}

export type Span = { from: string; to: string }

function day(v: any): string {
  const t = txt(v)
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : ''
}

/** A real deal that actually did the thing, inside the span. */
export function happened(deals: any[], event: Event, span: Span): any[] {
  const col = COLUMN[event]
  return (deals || []).filter(d => {
    if (txt(d?.status) === 'lost') return false
    const at = day(d?.[col])
    return at !== '' && at >= span.from && at <= span.to
  })
}

export type Line2 = {
  key: string
  name: string
  /** "Justin Cornock 50%, Simplify Finance 50%", off the deal's own copy. */
  terms: string
  lodged: any[]
  settled: any[]
  lodgedAmount: number
  settledAmount: number
}

function money(deals: any[]): number {
  return (deals || []).reduce((t, d) => t + (amountOf(d) || 0), 0)
}

// WHOSE DEAL IT IS, FOR GROUPING.
//
// The id, because two referrers can share a name and one referrer can be
// renamed. "Ours" is a real answer somebody gave - see `none` in splitOn() -
// and it is deliberately not the same as nobody having answered at all.
export const OURS = 'ours'
export const UNANSWERED = 'unanswered'

export function referralKey(deal: any): string {
  const s = splitOn(deal)
  if (!s) return UNANSWERED
  if (s.none) return OURS
  return s.id || OURS
}

export function referralName(deal: any): string {
  const s = splitOn(deal)
  if (!s) return 'Nobody has said'
  if (s.none) return 'Ours, no split'
  return s.name || 'Unnamed split'
}

export function termsWords(deal: any): string {
  const s = splitOn(deal)
  if (!s || s.none) return ''
  const lines = (s.lines || []).filter((l: Line) => txt(l.who))
  if (!lines.length) return ''
  // linesInWords, not shareWords. shareWords is the SHARE alone - "50%" - and a
  // referral line that reads "50%, 50%" names nobody, which is the one thing
  // this column exists to do.
  return linesInWords(lines)
}

function group(
  deals: any[], span: Span, keyOf: (d: any) => string, nameOf: (d: any) => string,
  termsOf: (d: any) => string,
): Line2[] {
  const lodged = happened(deals, 'lodged', span)
  const settled = happened(deals, 'settled', span)
  const rows = new Map<string, Line2>()
  const take = (d: any, which: Event) => {
    const key = keyOf(d)
    if (!rows.has(key)) {
      rows.set(key, {
        key, name: nameOf(d), terms: termsOf(d),
        lodged: [], settled: [], lodgedAmount: 0, settledAmount: 0,
      })
    }
    rows.get(key)![which].push(d)
  }
  for (const d of lodged) take(d, 'lodged')
  for (const d of settled) take(d, 'settled')
  for (const r of rows.values()) {
    r.lodgedAmount = money(r.lodged)
    r.settledAmount = money(r.settled)
  }
  // Most lodged first, then most settled, then by name - so the row somebody
  // is looking for is at the top on the week they are looking for it.
  return [...rows.values()].sort((a, b) =>
    b.lodged.length - a.lodged.length
    || b.settled.length - a.settled.length
    || a.name.localeCompare(b.name))
}

/** Who brought it: the commission split chosen on the fact find. */
export function byReferral(deals: any[], span: Span): Line2[] {
  return group(deals, span, referralKey, referralName, termsWords)
}

/** Whose deal it is: the broker on the card. */
export function byBroker(deals: any[], span: Span, names?: Record<string, string>): Line2[] {
  const nameOf = (d: any) => {
    const k = txt(d?.assigned_broker).toLowerCase()
    return names?.[k] || txt(d?.assigned_broker) || 'Nobody'
  }
  return group(deals, span, d => txt(d?.assigned_broker).toLowerCase() || 'nobody', nameOf, () => '')
}

export type Totals = {
  lodged: number; settled: number; lodgedAmount: number; settledAmount: number
}

export function totals(deals: any[], span: Span): Totals {
  const lodged = happened(deals, 'lodged', span)
  const settled = happened(deals, 'settled', span)
  return {
    lodged: lodged.length,
    settled: settled.length,
    lodgedAmount: money(lodged),
    settledAmount: money(settled),
  }
}

// --- one referral partner's week ---------------------------------------------

export type ForReferrer = {
  key: string
  name: string
  lodged: any[]
  settled: any[]
  /** Since 1 July, which is the line that manages the relationship. */
  yearLodged: number
  yearSettled: number
}

/**
 * EVERYTHING ONE PARTNER NEEDS TO BE TOLD, OR NULL.
 *
 * Null where they had nothing. A Friday email saying "nothing this week" is
 * how a weekly email stops being opened, so there is deliberately no empty
 * version of this.
 */
export function forReferrer(
  deals: any[], splitId: string, span: Span, year: Span,
): ForReferrer | null {
  const mine = (deals || []).filter(d => referralKey(d) === txt(splitId))
  if (!mine.length) return null
  const lodged = happened(mine, 'lodged', span)
  const settled = happened(mine, 'settled', span)
  if (!lodged.length && !settled.length) return null
  return {
    key: txt(splitId),
    name: referralName(lodged[0] || settled[0]),
    lodged, settled,
    yearLodged: happened(mine, 'lodged', year).length,
    yearSettled: happened(mine, 'settled', year).length,
  }
}

/** The day of the week a deal did the thing, for the email's list. */
export function dayWords(deal: any, event: Event): string {
  const d = new Date(txt(deal?.[COLUMN[event]]))
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-AU', { weekday: 'long' })
}

export function lenderOf(deal: any): string {
  return txt(deal?.settled_lender) || txt(deal?.lodged_lender) || txt(deal?.lender)
    || txt((deal as any)?.lenders?.name)
}
