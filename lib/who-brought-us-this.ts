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
import { toAuDate } from './periods'
import { OFFICE } from './same-date-everywhere'

const txt = (v: any) => String(v ?? '').trim()

export type Event = 'lodged' | 'settled'

const COLUMN: Record<Event, string> = {
  lodged: 'lodged_at',
  settled: 'settled_at',
}

export type Span = { from: string; to: string }

// THE SYDNEY DAY, NOT THE UTC ONE.
//
// 12 Nov 2026. Fabio: "we more than 1 deal this week." There were three, and
// the report showed one.
//
// A lodgement is recorded as a DATE and stored as Sydney midnight, which is
// 13:00 the day before in UTC. So slicing the first ten characters off the
// stored string gives yesterday - for every lodgement, not just the morning
// ones. Two of Mark's lodged on Monday 9 November were stored as 8 November
// and fell out of the week entirely.
//
// This codebase has paid for this twice already: lib/rate-notice.ts on 9 Oct
// and the day's plan on the dashboard. toAuDate() in lib/periods.ts is the
// answer and it was sitting there the whole time.
function day(v: any): string {
  return toAuDate(txt(v) || null)
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

// WHAT TO CALL A DEAL NOBODY REFERRED.
//
// Fabio, 12 Nov 2026: "'Ours, no split' is stupid. Simplify 100% makes more
// sense." He is right. "Ours" names nobody, and "no split" describes a missing
// record rather than what actually happened - which is that the whole
// commission stayed in the business.
//
// `ourName` is a parameter and not a constant because a second business is
// coming. See lib/which-business.ts.
export const OUR_NAME = 'Simplify Finance'

export function referralName(deal: any, ourName: string = OUR_NAME): string {
  const s = splitOn(deal)
  if (!s) return 'Nobody has said'
  if (s.none) return `${ourName} 100%`
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
  // Sydney's weekday. Stored as Sydney midnight, a lodgement reads as the
  // day before anywhere else - which is how "lodged Tuesday" became Monday.
  return d.toLocaleDateString('en-AU', { timeZone: OFFICE, weekday: 'long' })
}

export function lenderOf(deal: any): string {
  // THERE IS ONE LENDER COLUMN AND THERE ALWAYS HAS BEEN.
  //
  // This read settled_lender, then lodged_lender, then lender. The first two
  // do not exist - see docs/deals-columns.txt - so the chain fell through to
  // the third every single time, while reading as though the portal tracked
  // which bank a deal lodged with separately from the one it settled with.
  // It does not. Five screens were written on that belief.
  return txt(deal?.lender)
    || txt((deal as any)?.lenders?.name)
}

// --- one broker's own referral breakdown --------------------------------------

/**
 * WHO BROUGHT THIS BROKER'S WORK.
 *
 * 12 Nov 2026. Fabio: "admin need to per broker number of deals / name of the
 * clients / dollar amount and within the broker the breakdown on referral
 * splits."
 *
 * So the referral lives twice on purpose: on the row, because you want to know
 * which deal came from where, and summed underneath, because "two of Mark's
 * four were Justin's" is the sentence that manages the relationship. The same
 * figures, read the two ways a person reads them.
 */
export function referralInside(line: { lodged: any[]; settled: any[] }): Line2[] {
  const rows = new Map<string, Line2>()
  const take = (d: any, which: Event) => {
    const key = referralKey(d)
    if (!rows.has(key)) {
      rows.set(key, {
        key, name: referralName(d), terms: termsWords(d),
        lodged: [], settled: [], lodgedAmount: 0, settledAmount: 0,
      })
    }
    rows.get(key)![which].push(d)
  }
  for (const d of line?.lodged || []) take(d, 'lodged')
  for (const d of line?.settled || []) take(d, 'settled')
  for (const r of rows.values()) {
    r.lodgedAmount = money(r.lodged)
    r.settledAmount = money(r.settled)
  }
  // UNANSWERED LAST. It is a thing to go and fix rather than a referral, and
  // putting it at the top of somebody's week reads like an accusation.
  return [...rows.values()].sort((a, b) => {
    const rank = (x: Line2) => (x.key === UNANSWERED ? 1 : 0)
    return rank(a) - rank(b)
      || (b.lodged.length + b.settled.length) - (a.lodged.length + a.settled.length)
      || a.name.localeCompare(b.name)
  })
}

/** Every deal in one broker's week, lodged then settled, for the table. */
export function dealsInside(line: { lodged: any[]; settled: any[] }): Array<{
  deal: any; what: Event
}> {
  return [
    ...(line?.lodged || []).map(deal => ({ deal, what: 'lodged' as Event })),
    ...(line?.settled || []).map(deal => ({ deal, what: 'settled' as Event })),
  ]
}
