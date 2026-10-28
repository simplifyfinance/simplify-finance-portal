import { coverageOf, daysCovered, financialYearEnd, type Assessment, type AssessedLine, type PayKind } from './annualise-income'

// WHEN A PAYSLIP GIVES ONE YEAR-TO-DATE FIGURE AND NOT A BREAKDOWN.
//
// 28 Oct 2026. The payslip reader was built on the rule that you annualise each
// line from its own year to date, which is what Macquarie's guideline says. Then
// Fabio dropped in two real payslips - the Reserve Bank of Australia and NSW
// Health - and neither prints it that way:
//
//   RBA           EARNINGS has Salary, allowances and a Current Pay amount each.
//                 YEAR TO DATE VALUES is four lines: Total Gross 58,549.77,
//                 Taxable Gross, Tax, Employer Superannuation.
//   NSW Health    EARNINGS AND ALLOWANCES has Normal Hours, ADO, two kinds of
//                 overtime, three penalties - hours per day across the
//                 fortnight, and one Amount each. YEAR TO DATE BALANCES is
//                 Gross 50,257.70, Taxable, Tax, Nett.
//
// Full detail for the fortnight; one combined gross for the year. So the reader
// refused both, and the feature was useless on the normal case. That was my
// mistake: I built it against the rule instead of against a payslip.
//
// WHAT BROKERS ACTUALLY DO, which is what Fabio described and what the industry
// calculators do. Home Loan Experts' own guide takes ONE total gross year to
// date "including overtime, bonuses and allowances" and then says to "deduct
// your base pay from this figure" to get the variable part. RyRo's annualises a
// single year-to-date figure over days elapsed since 1 July or the start date.
// Both are the method below.
//
//   Fabio, 28 Oct 2026: "what we normally would do is annualize the
//   year-to-date minus the base, and then everything else is bundled as
//   obviously non-base income."
//
// THREE FACTS, NOTHING INVENTED:
//
//   1. The base rate the payslip PRINTS. RBA: "Annual Rate: 209,325.17". NSW
//      Health: "Weekly Base Rate $2643.73". Neither is a guess - the employer
//      wrote it on the document.
//   2. The combined gross year to date.
//   3. The days from 1 July, or from the day they started, to the end of the
//      pay period.
//
// Annualise (2) over (3). Take (1) off it. What is left is everything that is
// not base - overtime, penalties, allowances, loadings - and it goes in one
// line, because the payslip genuinely does not say how it splits and guessing
// the split would be making numbers up.
//
// Base at 100% in both columns. The bundle shaded in the 80% one.

/** What the payslip said the base rate was, and what kind of rate it is. */
export type BaseRate = {
  amount: number
  basis: 'annual' | 'monthly' | 'fortnightly' | 'weekly' | 'hourly'
  /** Only for an hourly rate. Defaults to 38, the standard full-time week. */
  hoursPerWeek?: number
}

const WEEKS = 52
const PERIODS: Record<string, number> = { annual: 1, monthly: 12, fortnightly: 26, weekly: 52 }

/**
 * THE BASE, AS A YEAR.
 *
 * A weekly rate times 52, a fortnight times 26, a month times 12. Not "times
 * 4.33 weeks a month" - a monthly salary is a twelfth of a year by definition,
 * and the approximation is how a $12,000 month becomes $12,996.
 */
export function annualFromRate(rate: BaseRate | null | undefined): number | null {
  if (!rate || !Number.isFinite(rate.amount) || rate.amount <= 0) return null
  if (rate.basis === 'hourly') {
    const hours = Number.isFinite(rate.hoursPerWeek as number) && (rate.hoursPerWeek as number) > 0
      ? (rate.hoursPerWeek as number) : 38
    return Math.round(rate.amount * hours * WEEKS)
  }
  const per = PERIODS[rate.basis]
  return per ? Math.round(rate.amount * per) : null
}

export type CombinedAssessment = Assessment & {
  /** What annualising the whole year to date came to, before the base came off. */
  annualisedTotal: number
  /** True where the stated base is HIGHER than the annualised total. */
  baseAboveTotal: boolean
  /** One sentence for the screen about what was done and what it means. */
  words: string
  /**
   * THE MATHS, STEP BY STEP, IN THE ORDER IT WAS DONE.
   *
   * Fabio, 28 Oct 2026: "I want you to explain to credit how you got to that
   * figure and show the maths every time."
   *
   * Not a courtesy. A credit assessor handed two totals and no working has to
   * either take them on trust or redo them, and the second one is what actually
   * happens. These lines are the difference between a figure somebody can check
   * in ten seconds and one they have to argue with.
   */
  working: string[]
  /** Which of the two methods was used, for the screen to name. */
  method: 'combined'
}

/**
 * THE ASSESSMENT, FROM ONE COMBINED FIGURE.
 *
 * Returns the same shape as assess(), so the screen draws it the same way and
 * lib/income-to-fact-find.ts fills the six boxes from it unchanged.
 */
export function assessCombined(opts: {
  /** The one gross year-to-date figure off the payslip. */
  ytdGross: number
  /** The annual base, already worked out from the printed rate. */
  annualBase: number
  to: Date
  employmentStart?: Date | null
  kind?: PayKind
  rate?: number
  /** What the payslip called its base line, e.g. "Salary" or "Normal Hours". */
  baseLabel?: string
}): CombinedAssessment {
  const coverage = coverageOf(opts)
  const rate = typeof opts.rate === 'number' && opts.rate > 0 && opts.rate <= 1 ? opts.rate : 0.8
  const yearDays = daysCovered(coverage.fyStart, financialYearEnd(opts.to))

  const ytd = Number.isFinite(opts.ytdGross) && opts.ytdGross > 0 ? opts.ytdGross : 0
  const base = Number.isFinite(opts.annualBase) && opts.annualBase > 0 ? Math.round(opts.annualBase) : 0

  const annualisedTotal = coverage.days > 0 ? Math.round((ytd / coverage.days) * yearDays) : 0

  // THE REMAINDER CAN COME OUT NEGATIVE, AND THAT MEANS SOMETHING.
  //
  // It says the year to date is running BELOW the contracted base - unpaid
  // leave, a late start, reduced hours, or simply not enough of the year yet.
  // Claiming a negative line of income would be nonsense and claiming nought
  // silently would hide it, so the bundle is nought and the screen is told to
  // say why.
  const baseAboveTotal = base > 0 && annualisedTotal > 0 && annualisedTotal < base

  // NO BASE MEANS NO ANSWER, NOT "ALL OF IT IS VARIABLE".
  //
  // Caught by the test below. Without this, a payslip printing no base rate
  // put the WHOLE annualised figure in the non-base line - so a $229,792
  // income came out at $183,834 in the 80% column, shading a salary that
  // nobody shades. Wrong by forty-six thousand dollars, on a screen whose
  // entire purpose is to be checkable.
  //
  // The base is the one fact this method cannot do without. When the payslip
  // does not print it, the honest answer is to ask.
  const other = base > 0 ? Math.max(0, annualisedTotal - base) : 0

  const lines: AssessedLine[] = []
  if (base > 0) {
    lines.push({
      key: 'base',
      label: opts.baseLabel ? `Base salary — ${opts.baseLabel}` : 'Base salary',
      // The payslip does not say what the base alone has earned this year, and
      // working it back from the annual rate would be inventing a figure.
      ytd: 0,
      annualised: base, full: base, shaded: base,
      oneOff: false, notIncome: false, refused: null,
    })
  }
  if (other > 0) {
    lines.push({
      key: 'overtime',
      label: 'Everything else — overtime, penalties, allowances',
      ytd: 0,
      annualised: other, full: other, shaded: Math.round(other * rate),
      oneOff: false, notIncome: false, refused: null,
    })
  }

  const full = lines.reduce((t, l) => t + l.full, 0)
  const shaded = lines.reduce((t, l) => t + l.shaded, 0)

  return {
    coverage, lines, rate,
    totals: { full, shaded, variable: full - shaded },
    annualisedTotal,
    baseAboveTotal,
    method: 'combined',
    words: wordsFor({ annualisedTotal, base, other, days: coverage.days, yearDays, baseAboveTotal, hasBase: base > 0 }),
    working: workingOut({
      ytd, base, other, annualisedTotal, rate, full, shaded,
      days: coverage.days, yearDays, to: opts.to, baseAboveTotal,
    }),
  }
}

const auDate = (x: Date) =>
  x.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

const exact = (n: number): string =>
  '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * EVERY STEP, WITH THE NUMBERS IN IT.
 *
 * The year to date keeps its cents, because that is what is printed on the
 * payslip and a credit assessor checking this will have the payslip open. The
 * annual figures are whole dollars, because a cent in a yearly income is noise.
 */
function workingOut(o: {
  ytd: number; base: number; other: number; annualisedTotal: number
  rate: number; full: number; shaded: number
  days: number; yearDays: number; to: Date; baseAboveTotal: boolean
}): string[] {
  if (o.days <= 0 || o.base <= 0) return []
  const pct = Math.round(o.rate * 100)
  const out = [
    `Year to date ${exact(o.ytd)} to ${auDate(o.to)} — ${o.days} days of the financial year.`,
    `${exact(o.ytd)} ÷ ${o.days} days × ${o.yearDays} = ${money(o.annualisedTotal)} for a full year.`,
    `Base, as the payslip states it: ${money(o.base)} a year.`,
  ]
  if (o.baseAboveTotal) {
    out.push(`${money(o.annualisedTotal)} − ${money(o.base)} is less than nothing, so no non-base income is counted.`)
    out.push(`Full column ${money(o.full)}. At ${pct}% ${money(o.shaded)}. Base is never shaded, so they are the same.`)
    return out
  }
  out.push(`${money(o.annualisedTotal)} − ${money(o.base)} = ${money(o.other)} that is not base.`)
  out.push(`The payslip does not say how that ${money(o.other)} splits between overtime, penalties and allowances, so it stays as one line.`)
  out.push(`Full column: ${money(o.base)} + ${money(o.other)} = ${money(o.full)}.`)
  out.push(`At ${pct}%: ${money(o.base)} + (${money(o.other)} × ${pct}% = ${money(Math.round(o.other * o.rate))}) = ${money(o.shaded)}.`)
  out.push(`Base is never shaded, so the ${money(o.full - o.shaded)} between the two columns is exactly the variable part of this income.`)
  return out
}

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-AU')
}

function wordsFor(o: {
  annualisedTotal: number; base: number; other: number
  days: number; yearDays: number; baseAboveTotal: boolean; hasBase: boolean
}): string {
  if (!o.hasBase) {
    return 'This payslip does not print a base rate, so there is nothing to take off the total.'
      + ' Enter the base salary and the rest will follow.'
  }
  if (o.days <= 0) return 'The pay period ends before the financial year started, so there is nothing to annualise.'
  const sum = `${money(o.annualisedTotal)} annualised, less ${money(o.base)} of base`
  if (o.baseAboveTotal) {
    return `${sum}. The year to date is running BELOW the contracted base — unpaid leave, reduced hours,`
      + ' or simply not enough of the year yet. Nothing is counted as non-base income.'
  }
  return `${sum} leaves ${money(o.other)} of overtime, penalties and allowances.`
    + ' The payslip does not say how that splits, so it is one line.'
}
