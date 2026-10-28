import { isWorkday, holidayName } from './the-week'

// HOW MANY COMPLIANCE PACKS EACH PERSON HAS HAD.
//
// 28 Oct 2026. Fabio: "we would like on the workload tab on the left-hand side
// for us to start measuring how many deals person number one and person number
// two are having in that particular month, in that particular day, in that
// particular quarter, in that particular year."
//
// COUNTED FROM THE DEALS, LIKE EVERYTHING ELSE IN THIS FEATURE. The allocation
// on the next push, the owner on the deal card and these numbers all read the
// same three columns, so there is no tally anywhere that can drift from the
// others. Reassign a deal and it moves here too - this counts where a pack
// ENDED UP, not where it was first sent, which is what somebody looking at a
// workload page is actually asking.
//
// THE FINANCIAL YEAR, NOT THE CALENDAR ONE. Quarter and year mean 1 July to 30
// June here, because that is the year this business reports in and the one the
// rest of the portal already uses. The screen says so rather than leaving it to
// be assumed.
//
// Pure. No database, no clock of its own - it is handed the rows and the day.

export type PackRow = {
  userId?: string | null
  name?: string | null
  /** ISO timestamp. */
  at?: string | null
}

export type PersonCount = {
  id: string
  name: string
  today: number
  month: number
  quarter: number
  year: number
}

export type DayRow = {
  /** YYYY-MM-DD. */
  day: string
  counts: Record<string, number>
  total: number
}

const txt = (v: any) => String(v ?? '').trim()

/**
 * The calendar day an instant falls on in Sydney.
 *
 * NOT the first ten characters of the timestamp. A pack sent at 9am on a
 * Sydney Monday is 10pm Sunday in UTC, and slicing the string would file a
 * whole morning's work under the day before - quietly, and only ever on the
 * deals that matter, which are the early ones.
 */
export function sydneyDay(at: any): string {
  const s = txt(at)
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
}

/** 1 July of the financial year this day falls in, as YYYY-MM-DD. */
export function financialYearStartDay(day: string): string {
  const [y, m] = txt(day).split('-').map(Number)
  if (!y || !m) return ''
  return `${m >= 7 ? y : y - 1}-07-01`
}

/** The first day of the financial-year quarter this day falls in. */
export function quarterStartDay(day: string): string {
  const [y, m] = txt(day).split('-').map(Number)
  if (!y || !m) return ''
  // July–Sep, Oct–Dec, Jan–Mar, Apr–Jun.
  const starts = [7, 10, 1, 4]
  const idx = m >= 7 ? Math.floor((m - 7) / 3) : Math.floor((m - 1) / 3) + 2
  const startMonth = starts[idx]
  const year = startMonth >= 7 ? (m >= 7 ? y : y - 1) : y
  return `${year}-${String(startMonth).padStart(2, '0')}-01`
}

/** The first day of the calendar month this day falls in. */
export function monthStartDay(day: string): string {
  return txt(day).slice(0, 8) + '01'
}

/**
 * ONE PERSON'S NUMBERS.
 *
 * `people` is the pair from Settings, in order, so the page can show them even
 * on a day when neither has had anything. Anybody else who turns up in the rows
 * - somebody a deal was reassigned to - is added after them, because a workload
 * page that hides work somebody did is worse than one with an extra row.
 */
export function countPacks(
  rows: PackRow[], people: Array<{ id: string; name: string }>, today: string,
): PersonCount[] {
  const monthFrom = monthStartDay(today)
  const quarterFrom = quarterStartDay(today)
  const yearFrom = financialYearStartDay(today)

  const order: string[] = []
  const names = new Map<string, string>()
  for (const p of people) {
    if (!txt(p?.id)) continue
    order.push(p.id)
    names.set(p.id, txt(p.name))
  }

  const blank = () => ({ today: 0, month: 0, quarter: 0, year: 0 })
  const tally = new Map<string, ReturnType<typeof blank>>()
  for (const id of order) tally.set(id, blank())

  for (const r of rows || []) {
    const id = txt(r?.userId)
    const day = sydneyDay(r?.at)
    if (!id || !day) continue
    if (!tally.has(id)) { tally.set(id, blank()); order.push(id) }
    if (!names.get(id) && txt(r?.name)) names.set(id, txt(r.name))
    const t = tally.get(id)!
    if (day === today) t.today += 1
    if (day >= monthFrom) t.month += 1
    if (day >= quarterFrom) t.quarter += 1
    if (day >= yearFrom) t.year += 1
  }

  return order.map(id => ({ id, name: names.get(id) || 'Somebody', ...tally.get(id)! }))
}

/**
 * EVERY WORKING DAY OF THIS MONTH, NEWEST FIRST.
 *
 * Weekends and NSW public holidays are not rows. Nothing is allocated against
 * them, so a line of noughts would only invite somebody to wonder what went
 * wrong that day.
 *
 * A day where a pack genuinely did go out on a weekend still appears, because
 * it happened and hiding it would lose work.
 */
export function daysOfMonth(rows: PackRow[], today: string): DayRow[] {
  const from = monthStartDay(today)
  const byDay = new Map<string, Record<string, number>>()

  for (const r of rows || []) {
    const id = txt(r?.userId)
    const day = sydneyDay(r?.at)
    if (!id || !day || day < from || day > today) continue
    const at = byDay.get(day) || {}
    at[id] = (at[id] || 0) + 1
    byDay.set(day, at)
  }

  const out: DayRow[] = []
  const [y, m] = today.split('-').map(Number)
  const lastDay = Number(today.slice(8, 10))
  for (let d = 1; d <= lastDay; d++) {
    const day = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const counts = byDay.get(day)
    if (!isWorkday(day) && !counts) continue
    const total = Object.values(counts || {}).reduce((a, b) => a + b, 0)
    out.push({ day, counts: counts || {}, total })
  }
  return out.reverse()
}

/** Why a day with no row is missing, for a tooltip. '' on a working day. */
export function whyNoRow(day: string): string {
  if (isWorkday(day)) return ''
  return holidayName(day) || 'Weekend'
}
