// THE WAYS OF READING TWO YEARS, AND WHAT EACH ONE WRITES.
//
// 22 Nov 2026. Fabio: "show all 4 so WE not lender dictated which one WE will
// use and then find the lender to match it."
//
// That is the whole shape of this screen. The figure is not handed down by a
// lender's policy and then obeyed - the team looks at what the two years give
// under each reading, picks the one they want, and THEN goes looking for a
// lender who allows it. So nothing here is highlighted as correct and nothing
// is chosen by default.
//
// NONE OF THIS IS NEW MACHINERY. The portal has held these methods since
// before any of it was read off a document:
//
//     seAssessmentMethod   'Last 2 financial years' | 'One year in isolation'
//     seGrowthMethod       'average' | 'latest_lower' | 'previous_plus_growth'
//     seGrowthPercentOption '20' | '50' | 'Other'
//
// and lib/income-calculations.ts turns them into the figure that reaches the
// BC, the compliance notes, the handover and the lending options email. So
// this file does NOT calculate anybody's income. It shows what each of those
// settings would produce, and when one is pressed it writes those settings.
// The sum is still done in one place, where it always was.
//
// A COLUMN THAT DOES NOT APPLY IS NOT SHOWN. Four columns always on screen
// would mean two of them lying on most deals:
//
//   - Lower of the two only applies where the latest year FELL. Where it rose,
//     the lower figure is just last year's, which no lender forces on anybody.
//   - Previous plus growth only applies where the latest year ROSE. There is
//     no growth to allow on a year that went backwards.
//   - And where the latest year IS the lower one, "latest year" and "lower of
//     the two" are the same figure. Two columns with the same number in them
//     read as a fault. It is one column, named both ways.
//
// Whatever is left out is said out loud underneath - see leftOut().

const n = (v: any): number => {
  const x = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(x) ? x : 0
}

/** The seven boxes the portal already holds per year, in the order they are shown. */
export const LINES = [
  { key: 'salary',        label: 'Salary from the company', add: false },
  { key: 'netProfit',     label: 'Company net profit before tax', add: false },
  { key: 'depreciation',  label: 'Add back depreciation', add: true },
  { key: 'interest',      label: 'Add back interest paid', add: true },
  { key: 'superannuation', label: 'Add back superannuation', add: true },
  { key: 'oneOff',        label: 'Add back one-off expenses', add: true },
  { key: 'other',         label: 'Add back other', add: true },
] as const

export type LineKey = typeof LINES[number]['key']
export type Year = { fy: string } & Record<LineKey, number>

export type ColumnId = 'latest' | 'latest_is_lower' | 'average' | 'previous_plus_growth'

export type Column = {
  id: ColumnId
  /** "Average", "2024/25 on its own" */
  title: string
  /** The small line under the title. */
  under: string
  /** One short sentence under the button. */
  why: string
  /** The figure for each of the seven lines. */
  lines: Record<LineKey, number>
  total: number
  /** What pressing Use this writes. Exactly the fields that already exist. */
  writes: {
    seAssessmentMethod: string
    seGrowthMethod: string
    seGrowthPercentOption?: string
  }
}

const sum = (l: Record<LineKey, number>) => LINES.reduce((t, x) => t + n(l[x.key]), 0)
const linesOf = (y: Year) => Object.fromEntries(LINES.map(x => [x.key, n(y[x.key])])) as Record<LineKey, number>

const blend = (a: Year, b: Year, f: (x: number, y: number) => number) =>
  Object.fromEntries(LINES.map(x => [x.key, f(n(a[x.key]), n(b[x.key]))])) as Record<LineKey, number>

const grow = (y: Year, pct: number) =>
  Object.fromEntries(LINES.map(x => [x.key, n(y[x.key]) * (1 + pct / 100)])) as Record<LineKey, number>

/**
 * THE COLUMNS FOR THESE TWO YEARS.
 *
 * `earlier` is the portal's year 1 and `latest` is its year 2 - picking year 1
 * sets year 2 to the year after it, so year 2 is always the later one.
 *
 * ONE YEAR ONLY IS A REAL ANSWER. Plenty of deals have one set of financials,
 * and there is nothing to compare: one column, which is the method the portal
 * already calls "one year in isolation".
 */
export function columnsFor(
  earlier: Year | null, latest: Year | null, growthPercent: string | number = 20,
): Column[] {
  const pct = n(growthPercent)

  if (latest && !earlier) {
    const lines = linesOf(latest)
    return [{
      id: 'latest', title: `${latest.fy} on its own`, under: 'the only year given',
      why: 'The only year these documents cover.',
      lines, total: sum(lines),
      writes: { seAssessmentMethod: 'One year in isolation', seGrowthMethod: '' },
    }]
  }
  if (!latest || !earlier) return []

  const latestLines = linesOf(latest)
  const earlierLines = linesOf(earlier)
  const latestTotal = sum(latestLines)
  const earlierTotal = sum(earlierLines)
  const fell = latestTotal < earlierTotal

  const averageLines = blend(latest, earlier, (a, b) => (a + b) / 2)
  const average: Column = {
    id: 'average', title: 'Average', under: 'of the two',
    why: fell ? 'Only a handful allow an average on a falling year.' : 'Both years, halved.',
    lines: averageLines, total: sum(averageLines),
    writes: { seAssessmentMethod: 'Last 2 financial years', seGrowthMethod: 'average' },
  }

  // THE LATEST YEAR FELL. It is also the lower one, so it is ONE column with
  // both names on it, and it is the one most lenders will insist on.
  if (fell) {
    const drop = earlierTotal > 0
      ? Math.round(((earlierTotal - latestTotal) / earlierTotal) * 100) : 0
    return [{
      id: 'latest_is_lower',
      title: `${latest.fy} on its own`, under: 'the latest, and the lower',
      why: `Most lenders will insist. Income fell ${drop}%.`,
      lines: latestLines, total: latestTotal,
      writes: { seAssessmentMethod: 'Last 2 financial years', seGrowthMethod: 'latest_lower' },
    }, average]
  }

  // THE LATEST YEAR ROSE. Lower-of-the-two is not shown; growth is.
  const grown = grow(earlier, pct)
  const rise = earlierTotal > 0
    ? Math.round(((latestTotal - earlierTotal) / earlierTotal) * 100) : 0
  return [
    {
      id: 'latest', title: 'Latest year', under: 'on its own',
      why: `${latest.fy} on its own.`,
      lines: latestLines, total: latestTotal,
      writes: { seAssessmentMethod: 'One year in isolation', seGrowthMethod: '' },
    },
    average,
    {
      id: 'previous_plus_growth',
      title: `${earlier.fy} plus ${pct}%`, under: 'growth allowance',
      why: `Every line of ${earlier.fy}, grown. ${latest.fy} is ${rise}% up.`,
      lines: grown, total: sum(grown),
      writes: {
        seAssessmentMethod: 'Last 2 financial years',
        seGrowthMethod: 'previous_plus_growth',
        seGrowthPercentOption: String(pct),
      },
    },
  ]
}

/**
 * WHAT WAS LEFT OUT, AND WHY.
 *
 * Said under the table every time, so nobody wonders whether a policy was
 * forgotten. Empty where nothing was left out.
 */
export function leftOut(earlier: Year | null, latest: Year | null): string {
  if (!earlier || !latest) return ''
  const fell = sum(linesOf(latest)) < sum(linesOf(earlier))
  return fell
    ? 'Previous year plus growth — income fell, so there is no growth to allow. '
      + `And lower of the two is not a column of its own, because ${latest.fy} is both the latest year `
      + 'and the lower one.'
    : 'Lower of the two years. That only applies where the latest year has fallen, and '
      + `${latest.fy} is up on ${earlier.fy}.`
}

/** The years a column actually used, for the line under the locked figure. */
export function yearsBehind(c: Column, earlier: Year | null, latest: Year | null): string {
  if (!latest) return ''
  if (c.id === 'latest' || c.id === 'latest_is_lower') return latest.fy
  if (!earlier) return latest.fy
  if (c.id === 'previous_plus_growth') return earlier.fy
  return `${earlier.fy} and ${latest.fy}`
}
