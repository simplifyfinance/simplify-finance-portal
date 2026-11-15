// WHAT WE HAVE LODGED THIS MONTH, IN DOLLARS.
//
// 17 Nov 2026. Fabio, on the week's bar: "we always focus on a weekly basis how
// many deals are we lodging, because we can control that. Okay, but it's also
// good to know how are we tracking against our target, which is a dollar
// figure."
//
// TWO DIFFERENT MEASURES ON PURPOSE. The week counts DEALS, because a broker
// can decide to lodge one more this week. The month counts DOLLARS, because
// that is what the business is actually aiming at and what the targets in
// Settings are written in. Mixing them - a dollar target with a deal count
// under it - is how a bar stops meaning anything.
//
// THE TARGET IS NOT STORED HERE. It is the row already kept in Settings under
// Targets, by month, metric 'lodged'. The settlements screen and the pipeline
// read the same table, so three screens cannot disagree about what we are
// aiming at.
import { amountOf } from './deal-phase'

const txt = (v: any) => String(v ?? '').trim()

const NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
               'July', 'August', 'September', 'October', 'November', 'December']

/** '2026-11-17' or a timestamp -> '2026-11'. Empty where there is no date. */
export function monthOf(v: any): string {
  const raw = txt(v)
  return /^\d{4}-\d{2}/.test(raw) ? raw.slice(0, 7) : ''
}

/** '2026-11' -> 'November'. Empty where it is not a month. */
export function monthName(month: string): string {
  const m = Number(txt(month).slice(5, 7))
  return m >= 1 && m <= 12 ? NAMES[m - 1] : ''
}

/** The first of that month, as the targets table stores it. */
export function monthRowKey(month: string): string {
  return /^\d{4}-\d{2}$/.test(txt(month)) ? `${month}-01` : ''
}

/**
 * EVERYTHING LODGED IN THE MONTH, ADDED UP.
 *
 * amountOf is the same figure every other report uses, so this and a deal row
 * can never disagree.
 *
 * A DEAL THAT HAS SINCE SETTLED STILL COUNTS. It was lodged in the month
 * whatever happened to it afterwards, and a figure that shrank as deals
 * progressed would be the strangest bar in the portal.
 */
export function monthLodged(deals: any[], month: string): number {
  if (!monthOf(`${month}-01`)) return 0
  return (deals || [])
    .filter(d => monthOf(d?.lodged_at) === month)
    .reduce((t, d) => t + (amountOf(d) || 0), 0)
}

/** The lodged target for that month across the whole business, or null. */
export function lodgedTarget(rows: any[], month: string): number | null {
  const key = monthRowKey(month)
  if (!key) return null
  const row = (rows || []).find(r =>
    txt(r?.metric) === 'lodged'
    && txt(r?.month).slice(0, 10) === key
    // The whole business, not one broker's share.
    && !txt(r?.broker_key))
  const n = Number(row?.amount)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** "$8.4m" / "$420k". Same shape the rest of the portal uses. */
export function money(n: number | null): string {
  if (n === null || n === undefined) return '-'
  const a = Math.abs(n)
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'm'
  if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'k'
  return '$' + Math.round(n)
}
