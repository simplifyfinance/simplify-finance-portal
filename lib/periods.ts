// Single source of truth for every period the pipeline reports on.
// Australian financial year: 1 July to 30 June. Quarters are aligned to it,
// so Q1 is Jul-Sep, not Jan-Mar. Both the Lodgements and Settlements views
// import from here so a date can never fall in one period on one screen and
// a different period on another.

export type PeriodKind = 'week' | 'month' | 'quarter' | 'fy' | 'custom'

export type Period = {
  kind: PeriodKind
  key: string
  label: string      // short, for the dropdown
  range: string      // human range, shown beside the label so a wrong period is obvious
  start: string      // inclusive, YYYY-MM-DD
  end: string        // inclusive, YYYY-MM-DD
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function utc(y: number, m: number, d: number): Date { return new Date(Date.UTC(y, m, d)) }
function ymd(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number): Date { return new Date(d.getTime() + n * 86400000) }
function parse(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return utc(y, m - 1, d)
}
function pretty(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

// Everything is judged in Sydney time. A settlement stamped 11pm on 30 June UTC
// is 1 July in Australia and belongs in the next financial year.
export function todayYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
}

// A timestamptz from the database reduced to the Australian calendar date.
export function toAuDate(ts?: string | null): string {
  if (!ts) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts          // already a plain date column
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
}

// The financial year a date belongs to, named by the year it ENDS in.
// 17 Aug 2026 -> 2027, i.e. FY27, running 1 Jul 2026 to 30 Jun 2027.
export function fyEndYear(dateYmd: string): number {
  const d = parse(dateYmd)
  return d.getUTCMonth() >= 6 ? d.getUTCFullYear() + 1 : d.getUTCFullYear()
}

function fyPeriod(endYear: number): Period {
  const start = utc(endYear - 1, 6, 1)
  const end = utc(endYear, 5, 30)
  return {
    kind: 'fy', key: `fy-${endYear}`,
    label: `FY${String(endYear).slice(2)}`,
    range: `${pretty(start)} - ${pretty(end)}`,
    start: ymd(start), end: ymd(end),
  }
}

function quarterPeriod(fyEnd: number, q: number): Period {
  const startMonthAbs = (fyEnd - 1) * 12 + 6 + (q - 1) * 3   // months since year 0, from 1 Jul
  const sy = Math.floor(startMonthAbs / 12), sm = startMonthAbs % 12
  const start = utc(sy, sm, 1)
  const end = utc(sy, sm + 3, 0)
  return {
    kind: 'quarter', key: `q-${fyEnd}-${q}`,
    label: `Q${q} FY${String(fyEnd).slice(2)}`,
    range: `${pretty(start)} - ${pretty(end)}`,
    start: ymd(start), end: ymd(end),
  }
}

function monthPeriod(y: number, m: number): Period {
  const start = utc(y, m, 1)
  const end = utc(y, m + 1, 0)
  return {
    kind: 'month', key: `m-${y}-${m + 1}`,
    label: `${MONTHS[m]} ${y}`,
    range: `${pretty(start)} - ${pretty(end)}`,
    start: ymd(start), end: ymd(end),
  }
}

// Weeks run Monday to Sunday.
function weekPeriodContaining(dateYmd: string): Period {
  const d = parse(dateYmd)
  const start = addDays(d, -((d.getUTCDay() + 6) % 7))
  const end = addDays(start, 6)
  return {
    kind: 'week', key: `w-${ymd(start)}`,
    label: `w/c ${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]}`,
    range: `${pretty(start)} - ${pretty(end)}`,
    start: ymd(start), end: ymd(end),
  }
}

// The most recent `count` periods of a kind, newest first, starting with the
// one that contains today.
export function listPeriods(kind: PeriodKind, count = 12, today = todayYmd()): Period[] {
  const t = parse(today)
  const out: Period[] = []
  if (kind === 'week') {
    let cur = weekPeriodContaining(today)
    for (let i = 0; i < count; i++) {
      out.push(cur)
      cur = weekPeriodContaining(ymd(addDays(parse(cur.start), -7)))
    }
  } else if (kind === 'month') {
    let y = t.getUTCFullYear(), m = t.getUTCMonth()
    for (let i = 0; i < count; i++) {
      out.push(monthPeriod(y, m))
      m -= 1
      if (m < 0) { m = 11; y -= 1 }
    }
  } else if (kind === 'quarter') {
    let fy = fyEndYear(today)
    let q = Math.floor(((t.getUTCMonth() + 6) % 12) / 3) + 1
    for (let i = 0; i < count; i++) {
      out.push(quarterPeriod(fy, q))
      q -= 1
      if (q < 1) { q = 4; fy -= 1 }
    }
  } else {
    let fy = fyEndYear(today)
    for (let i = 0; i < count; i++) out.push(fyPeriod(fy - i))
  }
  return out
}

// Any two dates. Used only where a person has picked them by hand, so it is
// never produced by listPeriods.
export function customPeriod(from: string, to: string): Period {
  const s = parse(from), e = parse(to)
  return {
    kind: 'custom', key: `c-${from}-${to}`,
    label: 'Custom range',
    range: `${pretty(s)} - ${pretty(e)}`,
    start: from.slice(0, 10), end: to.slice(0, 10),
  }
}

// The same calendar dates a year earlier. 29 February falls back to the 28th.
export function backOneYearYmd(dateYmd: string): string {
  const y = Number(dateYmd.slice(0, 4)) - 1
  const rest = dateYmd.slice(4)
  if (rest === '-02-29') return `${y}-02-28`
  return `${y}${rest}`
}

// The last day of the month a date sits in.
export function monthEndYmd(monthKey: string): string {
  const y = Number(monthKey.slice(0, 4)), m = Number(monthKey.slice(5, 7))
  const dim = utc(y, m, 0).getUTCDate()
  return `${monthKey}-${String(dim).padStart(2, '0')}`
}

export function inPeriod(dateYmd: string, p: Period): boolean {
  return !!dateYmd && dateYmd >= p.start && dateYmd <= p.end
}
