// THE SETTLEMENT MONTH, FOR WHOEVER IS MANAGING IT.
//
// 17 Nov 2026, built from the November tab of the Settlement Pipeline
// spreadsheet. Fabio: "we need to have the same mentality as today we need to
// be seaparing simplify fiannce broekrs figures... from simplify finance."
//
// THREE NUMBERS, NOT ONE.
//
// The spreadsheet adds a column and gives you a single total, so a month that
// is a quarter settled and half hopeful looks the same as one that is nearly
// done. These are three different promises:
//
//   SETTLED   money in. settled_at in the month.
//   BOOKED    a CONFIRMED date in the month. Every party has accepted it.
//   EXPECTED  an expected date only. Nobody has confirmed anything.
//
// WHAT IS DELIBERATELY NOT IN THE TOTAL. The settlements screen already keeps
// pre-formal refinances as a forecast and leaves them out of the target - the
// same thing the spreadsheet does by hand under "do not include on
// projections". They are counted here too, separately, so somebody can see what
// is behind the month without it flattering the number.
//
// NOTHING IS INVENTED. Every figure is a column on a deal: settled_at,
// confirmed_settlement_date, expected_settlement_date, and the amount every
// other report uses. A deal with no date at all belongs to no month and is not
// quietly adopted into this one.
import { amountOf } from './deal-phase'
// THE SAME isRefinance THE SETTLEMENTS SCREEN USES - there are two in this
// portal and they do not agree. lib/settlement.ts reads the deal's
// transaction_type, which is what the forecast group on that screen is built
// from; lib/document-rules.ts reads the scenario. Using the other one here
// would have put different deals in the forecast than the screen does.
import { isRefinance } from './settlement'
import { businessOfDeal, NOT_SAID, NOT_SAID_NAME } from './which-business'
import { monthOf, monthRowKey } from './the-month-so-far'

const txt = (v: any) => String(v ?? '').trim()

export type MonthSlice = {
  settled: number
  booked: number
  expected: number
  /** Pre-formal refinances. Shown, never added to the total. */
  forecast: number
  settledCount: number
  bookedCount: number
  expectedCount: number
  forecastCount: number
  /** settled + booked + expected. What the month is on track for. */
  onTrack: number
  /** The row from Settings, Targets. Null where nobody has set one. */
  target: number | null
}

export const EMPTY: MonthSlice = {
  settled: 0, booked: 0, expected: 0, forecast: 0,
  settledCount: 0, bookedCount: 0, expectedCount: 0, forecastCount: 0,
  onTrack: 0, target: null,
}

type Where = 'settled' | 'booked' | 'expected' | 'forecast' | null

/**
 * WHICH BUCKET ONE DEAL IS IN, OR NONE.
 *
 * Asked in the order the money is certain. A settled deal is settled whatever
 * else is recorded against it.
 */
export function bucketOf(deal: any, month: string): Where {
  if (monthOf(deal?.settled_at) === month) return 'settled'
  if (txt(deal?.settled_at)) return null

  // PRE-FORMAL REFINANCES ARE THE FORECAST, and only refinances: a purchase
  // that has not been approved has a contract date somebody else controls.
  if (!txt(deal?.formal_approval_at)) {
    const dated = monthOf(deal?.expected_settlement_date) === month
      || monthOf(deal?.confirmed_settlement_date) === month
    return dated && isRefinance(deal) ? 'forecast' : null
  }

  if (monthOf(deal?.confirmed_settlement_date) === month) return 'booked'
  if (monthOf(deal?.expected_settlement_date) === month) return 'expected'
  return null
}

/** One business's month, or the whole book where business is left out. */
export function sliceFor(
  deals: any[], month: string, targets: any[], business?: string, brokerRows?: any[],
): MonthSlice {
  const out: MonthSlice = { ...EMPTY }
  for (const d of deals || []) {
    if (business !== undefined) {
      if (businessOfDeal(d, brokerRows || []) !== business) continue
    }
    const where = bucketOf(d, month)
    if (!where) continue
    const amt = amountOf(d) || 0
    out[where] += amt
    out[(where + 'Count') as 'settledCount'] += 1
  }
  out.onTrack = out.settled + out.booked + out.expected
  out.target = settledTarget(targets, month, business, brokerRows)
  return out
}

/**
 * THE TARGET, FROM THE ROW SETTINGS ALREADY KEEPS.
 *
 * Stored per month and per BROKER, so a business target is the sum of its
 * brokers' rows. That needs nothing new - but it is only a real target where
 * somebody has actually set one, so a business whose brokers have no rows gets
 * null rather than a zero that would read as "aiming at nothing".
 */
export function settledTarget(
  targets: any[], month: string, business?: string, brokerRows?: any[],
): number | null {
  const key = monthRowKey(month)
  if (!key) return null
  const rows = (targets || []).filter(r =>
    txt(r?.metric) === 'settled' && txt(r?.month).slice(0, 10) === key)

  // The whole book: the business-wide row, which is the one with no broker.
  if (business === undefined) {
    const all = rows.find(r => !txt(r?.broker_key))
    const n = Number(all?.amount)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  // One business: its brokers' rows added up.
  let total = 0
  for (const r of rows) {
    const bk = txt(r?.broker_key)
    if (!bk) continue
    if (businessOfDeal({ assigned_broker: bk }, brokerRows || []) !== business) continue
    const n = Number(r?.amount)
    if (Number.isFinite(n)) total += n
  }
  return total > 0 ? total : null
}

export type BusinessMonth = { id: string; name: string; slice: MonthSlice }

/** Each business that has anything this month, biggest first. */
export function businessMonths(
  deals: any[], month: string, targets: any[], brokerRows: any[], brands: any[],
): BusinessMonth[] {
  const ids = new Set<string>()
  for (const d of deals || []) {
    if (!bucketOf(d, month)) continue
    ids.add(businessOfDeal(d, brokerRows || []))
  }
  const nameOf = (id: string) => id === NOT_SAID
    ? NOT_SAID_NAME
    : txt((brands || []).find((b: any) => txt(b?.id) === id)?.name) || id

  return [...ids]
    .map(id => ({ id, name: nameOf(id), slice: sliceFor(deals, month, targets, id, brokerRows) }))
    .sort((a, b) => b.slice.onTrack - a.slice.onTrack)
}

/** "101%" against the target, or null where nobody has set one. */
export function againstTarget(s: MonthSlice): number | null {
  return s.target && s.target > 0 ? Math.round((s.onTrack / s.target) * 100) : null
}
