// WHAT A PAYSLIP SAYS THIS PERSON EARNS IN A YEAR.
//
// 28 Oct 2026. Fabio: "we're going to load the customer's payslips... we're
// going to annualise the income, and we're going to give our assessment of how
// much income we need to use for that particular person."
//
// NO SCREEN AND NO READING OF A PDF IN HERE. This is the arithmetic and the
// judgement, on its own, because that is where every error that matters lives.
// A payslip reader that mis-reads a figure produces an obviously wrong number
// somebody argues with. A correct figure annualised the wrong way produces a
// plausible one nobody questions, and every one of the ways it goes wrong goes
// UPWARDS - which is the direction that gets a loan approved and then defaults.
//
// THE FOUR THINGS THAT GO WRONG, AND WHAT IS DONE ABOUT EACH:
//
//   1. A ONE-OFF INSIDE THE YEAR TO DATE. A $13,500 bonus paid in August,
//      spread across 104 days and multiplied out, claims $49,500. Marked as a
//      one-off it is taken at what was actually paid - see oneOff below.
//   2. THEY STARTED PARTWAY THROUGH THE YEAR. Dividing four months of pay by a
//      full year because the financial year began in July understates by a
//      third. Counting starts at the LATER of 1 July and their start date.
//   3. NOT ENOUGH YEAR TO DATE TO MEAN ANYTHING. Six weeks containing one quiet
//      fortnight reads as a pay cut. Three months before anything is
//      annualised, six on a casual or a contractor - and that is not our rule,
//      it is Macquarie's own broker guideline. WHAT TO ASK FOR THEN DEPENDS ON
//      WHY IT IS SHORT: early in the year, last year's income statement fills
//      it; three months into a new job, that statement is about a different
//      employer and only the contract settles it.
//   4. TWO EMPLOYERS IN ONE FIGURE. Nothing here adds them. One assessment per
//      job; the caller runs it twice.
//
// AND IT NEVER SAYS WHICH NUMBER TO USE. It gives two - the full one and the
// shaded one - because which applies is a credit decision made once a lender is
// known, and no lender is known when a fact find is being filled in. Fabio:
// "lets show 100% and than 80% shading next to it as this will cover all
// lenders and that is a credit decision later on so keep it simple."

// THE AUSTRALIAN FINANCIAL YEAR: 1 July to 30 June.
const FY_FIRST_MONTH = 6   // zero-based: June is 5, July is 6

// How much year to date a lender wants before an annualised figure means
// anything. Macquarie: two payslips with at least three months for overtime,
// commission and allowances; six months on a casual or a PAYG contractor.
export const MONTHS_NEEDED: Record<PayKind, number> = {
  permanent: 3,
  casual: 6,
  contract: 6,
}

export type PayKind = 'permanent' | 'casual' | 'contract'

/**
 * WHICH LINES GET SHADED AND WHICH DO NOT.
 *
 * Base and allowances are contracted and paid every period, so no lender
 * shades them - which is why both columns show the same figure for those and
 * the gap between the two totals is exactly the variable part of somebody's
 * income. Overtime, commission and bonus are the volatile ones.
 */
export type LineKey = 'base' | 'allowance' | 'overtime' | 'commission' | 'bonus' | 'other'

const NEVER_SHADED: LineKey[] = ['base', 'allowance']

export type PayLine = {
  key: LineKey
  label: string
  /** What this line has earned since the year started, off the payslip. */
  ytd: number | null
  /**
   * PAID ONCE RATHER THAN EVERY PERIOD. A bonus, back pay, a leave payout.
   * Taken at what was actually paid and never multiplied out - see fault 1.
   */
  oneOff?: boolean
  /** Money paid back, not money earned. Out of both columns entirely. */
  notIncome?: boolean
}

export type AssessedLine = {
  key: LineKey
  label: string
  ytd: number
  /** What annualising it gives. Equal to ytd on a one-off, which is the point. */
  annualised: number
  full: number
  shaded: number
  oneOff: boolean
  notIncome: boolean
  /** What annualising it WOULD have claimed, where that was refused. */
  refused: number | null
}

export type Coverage = {
  /** 1 July of the year this payslip falls in. */
  fyStart: Date
  /** The later of 1 July and the day they started. See fault 2. */
  countsFrom: Date
  /** The end of the pay period on the latest payslip - never the pay date. */
  to: Date
  /** Days covered, counting both ends. */
  days: number
  /** The length of this financial year. 366 where it holds a 29 February. */
  yearDays: number
  enough: boolean
  monthsNeeded: number
  /** The day the year to date becomes long enough to annualise. */
  enoughOn: Date
  why: string
}

export type Assessment = {
  coverage: Coverage
  lines: AssessedLine[]
  totals: { full: number; shaded: number; variable: number }
  /** The rate used on the shaded column, as a fraction. 0.8 by default. */
  rate: number
}

const num = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

const day = 86_400_000
const round = (n: number) => Math.round(n)

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addMonths(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth() + n, d.getDate())
  // 31 Jan plus one month is 3 March in JavaScript. Pulled back to the last day
  // of the month a person would have meant.
  if (out.getDate() !== d.getDate()) out.setDate(0)
  return out
}

/** 1 July of the financial year the given day falls in. */
export function financialYearStart(on: Date): Date {
  const y = on.getMonth() >= FY_FIRST_MONTH ? on.getFullYear() : on.getFullYear() - 1
  return new Date(y, FY_FIRST_MONTH, 1)
}

/** 30 June. Used only to measure the year's length - 365 or 366. */
export function financialYearEnd(on: Date): Date {
  const s = financialYearStart(on)
  return new Date(s.getFullYear() + 1, FY_FIRST_MONTH - 1, 30)
}

/** Both ends counted: 1 July to 1 July is one day, not nought. */
export function daysCovered(from: Date, to: Date): number {
  const a = atMidnight(from).getTime(), b = atMidnight(to).getTime()
  return b < a ? 0 : Math.round((b - a) / day) + 1
}

function words(days: number): string {
  if (days >= 365) return 'a full year'
  const months = Math.floor(days / 30.44)
  if (months >= 2) return `${months} months`
  const weeks = Math.floor(days / 7)
  return weeks >= 2 ? `${weeks} weeks` : `${days} ${days === 1 ? 'day' : 'days'}`
}

const au = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * HOW MUCH OF THE YEAR THIS PAYSLIP ACCOUNTS FOR, AND WHETHER IT IS ENOUGH.
 *
 * `to` is the END OF THE PAY PERIOD, not the day they were paid. A payslip paid
 * on 14 October for the fortnight to 12 October accounts for the year up to the
 * twelfth, and taking the pay date would claim two days nobody has worked yet.
 */
export function coverageOf(opts: {
  to: Date
  employmentStart?: Date | null
  kind?: PayKind
}): Coverage {
  const to = atMidnight(opts.to)
  const fyStart = financialYearStart(to)
  const started = opts.employmentStart ? atMidnight(opts.employmentStart) : null
  // See fault 2. The later of the two, always.
  const countsFrom = started && started > fyStart ? started : fyStart
  const kind: PayKind = opts.kind || 'permanent'
  const monthsNeeded = MONTHS_NEEDED[kind]
  const enoughOn = addMonths(countsFrom, monthsNeeded)
  const days = daysCovered(countsFrom, to)
  const yearDays = daysCovered(fyStart, financialYearEnd(to))
  const enough = to >= enoughOn

  const started_late = Boolean(started && started > fyStart)

  // WHAT TO ASK FOR DEPENDS ON WHY IT IS SHORT, and the first version of this
  // got it wrong.
  //
  // Somebody three months into a NEW JOB has no last year's income statement
  // for it - last year was a different employer at a different salary, and
  // asking for it sends the client looking for a document that answers nothing.
  // What settles a new job is the contract or a letter from the employer
  // stating the salary, which is Macquarie's own fallback for base income.
  //
  // Somebody in the SAME JOB who is simply early in the financial year does
  // have last year's figures, and that is exactly what fills the gap.
  const askFor = started_late
    ? ' Ask for the employment contract or a letter from the employer stating the salary'
      + ' — last year’s income statement is about a different job and will not settle this one.'
    : ' Ask for last year’s income statement, the PAYG summary, or the June payslip,'
      + ' which carries the whole of last year’s year to date.'

  const why = enough
    ? `${words(days)} of the financial year`
      + (started_late ? `, counted from the day they started on ${au(countsFrom)}` : '')
      + `. Past the ${monthsNeeded} months a lender wants.`
    : `Only ${words(days)}`
      + (started_late ? ` since they started on ${au(countsFrom)}` : ' of the financial year')
      + `. A lender wants ${monthsNeeded} months before this can be annualised`
      + ` — that is ${au(enoughOn)}.`
      + askFor

  return { fyStart, countsFrom, to, days, yearDays, enough, monthsNeeded, enoughOn, why }
}

/**
 * THE WHOLE ASSESSMENT.
 *
 * Returns the figures even where the coverage is too short, because a credit
 * assessor looking at a six-week year to date still wants to see what it says -
 * they simply must not be handed it as an answer. coverage.enough is the thing
 * a screen reads to decide whether to put a red box around all of it.
 */
export function assess(opts: {
  lines: PayLine[]
  to: Date
  employmentStart?: Date | null
  kind?: PayKind
  /** The shaded column, as a fraction. 0.8, and the screen never offers another. */
  rate?: number
}): Assessment {
  const coverage = coverageOf(opts)
  const rate = typeof opts.rate === 'number' && opts.rate > 0 && opts.rate <= 1 ? opts.rate : 0.8
  const { days, yearDays } = coverage

  const lines: AssessedLine[] = []
  for (const l of opts.lines || []) {
    const ytd = num(l?.ytd)
    if (ytd === null) continue
    const key = l.key
    const notIncome = Boolean(l.notIncome)
    const oneOff = Boolean(l.oneOff)

    // A year with no days in it cannot be annualised. Said as nought rather
    // than as a division by zero somewhere further down.
    const wouldBe = days > 0 ? round((ytd / days) * yearDays) : 0
    const annualised = notIncome ? 0 : oneOff ? round(ytd) : wouldBe

    const full = notIncome ? 0 : annualised
    const shaded = notIncome ? 0
      : NEVER_SHADED.includes(key) ? annualised
      : round(annualised * rate)

    lines.push({
      key, label: String(l.label || ''), ytd: round(ytd),
      annualised, full, shaded, oneOff, notIncome,
      // What annualising it would have claimed, kept so a screen can show the
      // refused figure struck through. That is the line that teaches somebody
      // why a one-off is treated differently.
      refused: notIncome ? wouldBe : oneOff && wouldBe !== annualised ? wouldBe : null,
    })
  }

  const sum = (pick: (l: AssessedLine) => number) => lines.reduce((t, l) => t + pick(l), 0)
  const full = sum(l => l.full)
  const shaded = sum(l => l.shaded)
  return {
    coverage, lines, rate,
    // THE GAP IS THE VARIABLE PART OF SOMEBODY'S INCOME, and it is worth saying
    // on its own. Base and allowances sit the same in both columns, so the
    // difference between the totals is exactly what is at risk.
    totals: { full, shaded, variable: full - shaded },
  }
}

/**
 * THE LOWER OF THE TWO, WHERE LAST YEAR IS KNOWN.
 *
 * Macquarie's rule where a year to date is short or missing: use the lower of
 * the annualised year to date and the most recent finished financial year.
 * Offered rather than applied - a screen shows both and a person chooses, the
 * same as everything else here.
 */
export function lowerOf(annualised: number, lastFinancialYear: number | null): number {
  const last = num(lastFinancialYear)
  if (last === null) return annualised
  return Math.min(annualised, last)
}
