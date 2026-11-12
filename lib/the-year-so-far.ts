// THE FINANCIAL YEAR, BROKERS DOWN AND MONTHS ACROSS.
//
// Fabio, 17 Nov 2026, on the three views: the tiles answer "how did this week
// go", the list answers "who did what", and this one answers "how is the year
// going" - which is the only one of the three that needs twelve columns.
//
// A MONTH THAT HAS NOT HAPPENED IS A DASH, NOT A NOUGHT. December is not zero
// deals. It is December. A nought in a month nobody has lived through reads as
// a bad month, and a grid full of false noughts is a grid people stop reading.
//
// THE DAY IS READ IN SYDNEY. A lodgement is stored as Sydney midnight, which
// is 13:00 the day before in UTC - so slicing the stored string puts a deal
// lodged on 1 August into July. toAuDate() in lib/periods.ts is the one place
// that gets this right; everything here goes through it. This is the fault
// behind "we more than 1 deal this week", and it bites a month boundary
// exactly as hard as a week one.

import { toAuDate, todayYmd, fyEndYear } from './periods'
import { amountOf } from './deal-phase'
import type { Line2 } from './who-brought-us-this'

const txt = (v: any) => String(v ?? '').trim()

export type Month = {
  /** YYYY-MM. */
  key: string
  /** "Jul". */
  label: string
  /** True for a month the year has not reached yet. */
  future: boolean
}

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * THE TWELVE MONTHS OF A FINANCIAL YEAR, JULY FIRST.
 *
 * `today` is a Sydney YYYY-MM-DD. The month it falls in is NOT future - a
 * month half lived through is still a month with deals in it.
 */
export function monthsOfFY(today: string = todayYmd()): Month[] {
  const endYear = fyEndYear(today)
  const now = txt(today).slice(0, 7)
  const out: Month[] = []
  for (let i = 0; i < 12; i++) {
    // July (month 6) of endYear - 1, running round to June of endYear.
    const m = (6 + i) % 12
    const year = i < 6 ? endYear - 1 : endYear
    const key = `${year}-${pad(m + 1)}`
    out.push({ key, label: SHORT[m], future: key > now })
  }
  return out
}

/** The Sydney month a deal lodged in, or '' where it has not lodged. */
export function monthLodged(deal: any): string {
  const d = toAuDate(txt(deal?.lodged_at) || null)
  return d ? d.slice(0, 7) : ''
}

export type Row = {
  key: string
  name: string
  /** One per month, in the same order as monthsOfFY(). null where future. */
  cells: (number | null)[]
  total: number
  amount: number
}

/**
 * ONE ROW PER BROKER, PLUS A TOTAL ROW THE CALLER CAN DRAW DIFFERENTLY.
 *
 * Counts lodgements only. A settlement is a different event and mixing them in
 * one cell makes a number nobody can explain.
 */
export function gridFor(lines: Line2[], months: Month[]): Row[] {
  return (lines || []).map(line => {
    const cells: (number | null)[] = months.map(m => (m.future ? null : 0))
    let total = 0
    let amount = 0
    for (const d of line.lodged || []) {
      const i = months.findIndex(m => m.key === monthLodged(d))
      if (i < 0) continue
      // A deal lodged in a month marked future means the clock is wrong
      // somewhere. Count it rather than lose it, and let the cell show.
      cells[i] = (cells[i] ?? 0) + 1
      total += 1
      amount += amountOf(d) || 0
    }
    return { key: line.key, name: line.name, cells, total, amount }
  })
}

/** The column underneath all the brokers, month by month. */
export function totalRow(rows: Row[], months: Month[]): Row {
  const cells = months.map((m, i) => {
    if (m.future && rows.every(r => r.cells[i] === null)) return null
    return rows.reduce((t, r) => t + (r.cells[i] ?? 0), 0)
  })
  return {
    key: '__all__',
    name: 'The business',
    cells,
    total: rows.reduce((t, r) => t + r.total, 0),
    amount: rows.reduce((t, r) => t + r.amount, 0),
  }
}

/**
 * HOW DARK A CELL IS, 0 TO 3.
 *
 * One hue getting darker, never a rainbow and never red-to-green - a quiet
 * month is not a failure and should not be coloured like one. The shade is
 * only there so a row reads as a shape; the number is always written beside
 * it, so nobody has to decode a colour to get an answer.
 */
export function shadeOf(n: number | null, busiest: number): 0 | 1 | 2 | 3 {
  if (!n || n <= 0) return 0
  if (busiest <= 1) return 3
  const share = n / busiest
  if (share >= 0.75) return 3
  if (share >= 0.4) return 2
  return 1
}

/** The biggest single cell on the grid, which sets the darkest shade. */
export function busiestCell(rows: Row[]): number {
  let most = 0
  for (const r of rows) {
    for (const c of r.cells) if ((c ?? 0) > most) most = c ?? 0
  }
  return most
}
