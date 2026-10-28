// WHAT A PAYSLIP SAYS THIS PERSON EARNS IN A YEAR.
//
// 28 Oct 2026. Fabio: "we're going to scan those payslips. We're going to
// annualise the income, and we're going to give our assessment of how much
// income we need to use for that particular person."
//
// THE FIGURES ARE THE DANGEROUS PART, WHICH IS WHY THIS EXISTS BEFORE A SCREEN
// DOES. A mis-read figure produces an obviously wrong number somebody argues
// with. A correct figure annualised the wrong way produces a plausible one
// nobody questions - and every way it goes wrong goes UPWARDS.
//
// Every name and figure here is invented.
import { describe, it, expect } from 'vitest'
import {
  assess, coverageOf, financialYearStart, financialYearEnd, daysCovered,
  addMonths, lowerOf, MONTHS_NEEDED, type PayLine,
} from './annualise-income'

const d = (s: string) => new Date(`${s}T00:00:00`)

// THE DAY AS THIS MACHINE SEES IT, NOT AS GREENWICH DOES.
//
// toISOString() was the obvious thing here and it is a trap. Every date in
// annualise-income.ts is a LOCAL midnight - that is what atMidnight() makes,
// and it is why the maths holds wherever it runs. Printing one as a UTC string
// in Melbourne turns 1 July into 30 June, so these tests would have passed on
// the Vercel box and failed on this Mac, eight minutes into a ship.
const iso = (x: Date) =>
  `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`

// Priya, three and a half months into the financial year, on a fortnightly pay.
const PRIYA: PayLine[] = [
  { key: 'base', label: 'Base salary', ytd: 29903 },
  { key: 'allowance', label: 'Car allowance', ytd: 1851 },
  { key: 'overtime', label: 'Overtime', ytd: 5184 },
  { key: 'commission', label: 'Commission', ytd: 9071 },
  { key: 'bonus', label: 'Annual bonus', ytd: 13500, oneOff: true },
  { key: 'other', label: 'Reimbursement — travel', ytd: 412, notIncome: true },
]
const TO = d('2026-10-12')
const line = (a: ReturnType<typeof assess>, key: string) => a.lines.find(l => l.key === key)!

describe('the Australian financial year', () => {
  it('starts on 1 July', () => {
    expect(iso(financialYearStart(d('2026-10-12')))).toBe('2026-07-01')
    expect(iso(financialYearEnd(d('2026-10-12')))).toBe('2027-06-30')
  })

  it('and a day in March belongs to the year that began the PREVIOUS July', () => {
    // The single easiest thing to get wrong, and it halves or doubles
    // everything downstream of it.
    expect(iso(financialYearStart(d('2026-03-12')))).toBe('2025-07-01')
  })

  it('1 July itself is in the new year, 30 June is in the old one', () => {
    expect(financialYearStart(d('2026-07-01')).getFullYear()).toBe(2026)
    expect(financialYearStart(d('2026-06-30')).getFullYear()).toBe(2025)
  })

  it('and a year with a 29 February is 366 days long', () => {
    // Dividing by a flat 365 in a leap year overstates by a day's pay. Small,
    // but it is free to be right.
    expect(daysCovered(d('2027-07-01'), d('2028-06-30'))).toBe(366)
    expect(daysCovered(d('2026-07-01'), d('2027-06-30'))).toBe(365)
  })

  it('both ends are counted', () => {
    expect(daysCovered(d('2026-07-01'), d('2026-07-01'))).toBe(1)
    expect(daysCovered(d('2026-07-01'), d('2026-10-12'))).toBe(104)
  })

  it('and a date before the start is nought, not a negative', () => {
    expect(daysCovered(d('2026-10-12'), d('2026-07-01'))).toBe(0)
  })
})

describe('adding months the way a person means it', () => {
  it('1 July plus three is 1 October', () => {
    expect(iso(addMonths(d('2026-07-01'), 3))).toBe('2026-10-01')
  })

  it('and 31 January plus one is the END OF FEBRUARY, not the third of March', () => {
    // JavaScript rolls it forward. A rule that says "three months from the 31st"
    // would quietly become "three months and three days".
    expect(iso(addMonths(d('2027-01-31'), 1))).toBe('2027-02-28')
  })
})

describe('is there enough year to date to mean anything', () => {
  it('three months for a permanent employee, six for casual and contract', () => {
    // Not our rule. Macquarie's broker guidelines ask for two payslips with at
    // least three months before overtime, commission or allowances count, and
    // six months on a casual or a PAYG contractor.
    expect(MONTHS_NEEDED.permanent).toBe(3)
    expect(MONTHS_NEEDED.casual).toBe(6)
    expect(MONTHS_NEEDED.contract).toBe(6)
  })

  it('1 October is the day it becomes enough', () => {
    expect(coverageOf({ to: d('2026-09-30') }).enough).toBe(false)
    expect(coverageOf({ to: d('2026-10-01') }).enough).toBe(true)
  })

  it('SIX WEEKS IS NOT ENOUGH, and it says what to ask for', () => {
    // Six weeks containing one quiet fortnight reads as a pay cut.
    const c = coverageOf({ to: d('2026-08-10') })
    expect(c.enough).toBe(false)
    expect(c.days).toBe(41)
    expect(c.why).toContain('1 October 2026')
    expect(c.why).toContain('last year’s income statement')
    expect(c.why).toContain('June payslip')
  })

  it('a casual is not enough at three months and is at six', () => {
    expect(coverageOf({ to: d('2026-11-15'), kind: 'casual' }).enough).toBe(false)
    expect(coverageOf({ to: d('2027-01-02'), kind: 'casual' }).enough).toBe(true)
  })
})

describe('somebody who started partway through the year', () => {
  const started = { to: d('2026-10-12'), employmentStart: d('2026-09-01') }

  it('IS COUNTED FROM THEIR START DATE, NOT FROM 1 JULY', () => {
    // Dividing six weeks of pay by fourteen weeks of year understates them by
    // more than half.
    const c = coverageOf(started)
    expect(iso(c.countsFrom)).toBe('2026-09-01')
    expect(c.days).toBe(42)
  })

  it('and their three months runs from the day they started', () => {
    expect(iso(coverageOf(started).enoughOn)).toBe('2026-12-01')
    expect(coverageOf(started).enough).toBe(false)
  })

  it('A NEW STARTER IS ASKED FOR THE CONTRACT, NOT LAST YEAR’S STATEMENT', () => {
    // My own first version asked a three-month new starter for last year's
    // income statement. That statement is about a different employer at a
    // different salary and answers nothing - it just sends the client looking.
    const c = coverageOf(started)
    expect(c.why).toContain('employment contract')
    expect(c.why).not.toContain('June payslip')
  })

  it('but somebody early in the year IS asked for last year', () => {
    expect(coverageOf({ to: d('2026-08-10') }).why).toContain('June payslip')
  })

  it('a start date before this financial year changes nothing', () => {
    const c = coverageOf({ to: TO, employmentStart: d('2024-03-01') })
    expect(iso(c.countsFrom)).toBe('2026-07-01')
    expect(c.days).toBe(104)
  })
})

describe('the assessment', () => {
  const a = assess({ lines: PRIYA, to: TO })

  it('annualises on days of the year, not on pay periods', () => {
    // $29,903 over 104 days of a 365 day year.
    expect(line(a, 'base').full).toBe(104948)
  })

  it('base and allowances are the same in both columns', () => {
    // Nobody shades them, which is what makes the gap between the totals mean
    // something.
    expect(line(a, 'base').shaded).toBe(line(a, 'base').full)
    expect(line(a, 'allowance').shaded).toBe(line(a, 'allowance').full)
  })

  it('and overtime, commission and bonus are shaded', () => {
    expect(line(a, 'overtime').shaded).toBe(Math.round(line(a, 'overtime').full * 0.8))
    expect(line(a, 'commission').shaded).toBe(Math.round(line(a, 'commission').full * 0.8))
    expect(line(a, 'bonus').shaded).toBe(Math.round(line(a, 'bonus').full * 0.8))
  })

  it('THE GAP BETWEEN THE TWO TOTALS IS THE VARIABLE PART OF THE INCOME', () => {
    expect(a.totals.variable).toBe(a.totals.full - a.totals.shaded)
    expect(a.totals.full).toBe(174974)
    expect(a.totals.shaded).toBe(162268)
  })

  it('the rate can be changed, and both columns follow', () => {
    const half = assess({ lines: PRIYA, to: TO, rate: 0.5 })
    expect(line(half, 'overtime').shaded).toBe(Math.round(line(half, 'overtime').full * 0.5))
    expect(line(half, 'base').shaded).toBe(line(half, 'base').full)
  })

  it('and nonsense for a rate falls back to 80%, rather than wiping the column', () => {
    for (const rate of [0, -1, 5, NaN]) {
      expect(assess({ lines: PRIYA, to: TO, rate }).rate).toBe(0.8)
    }
  })
})

describe('A ONE-OFF IS NEVER MULTIPLIED OUT', () => {
  // The single biggest way an annualised figure goes wrong, and it goes wrong
  // upwards. A $13,500 bonus paid in August, spread over 104 days and
  // multiplied by 365, claims $47,380.
  const a = assess({ lines: PRIYA, to: TO })
  const bonus = line(a, 'bonus')

  it('it is taken at what was actually paid', () => {
    expect(bonus.annualised).toBe(13500)
    expect(bonus.full).toBe(13500)
  })

  it('and what annualising WOULD have claimed is kept, so it can be shown', () => {
    expect(bonus.refused).toBe(47380)
  })

  it('a one-off is still shaded, because it is still variable', () => {
    expect(bonus.shaded).toBe(10800)
  })

  it('and the same figure NOT marked as a one-off is annualised', () => {
    const asRegular = assess({
      lines: [{ key: 'bonus', label: 'Bonus', ytd: 13500 }], to: TO,
    })
    expect(line(asRegular, 'bonus').full).toBe(47380)
    expect(line(asRegular, 'bonus').refused).toBeNull()
  })
})

describe('money paid back is not money earned', () => {
  const a = assess({ lines: PRIYA, to: TO })
  const r = line(a, 'other')

  it('a reimbursement is out of both columns', () => {
    expect(r.full).toBe(0)
    expect(r.shaded).toBe(0)
  })

  it('and it still says what it would have claimed', () => {
    expect(r.refused).toBe(1446)
  })
})

describe('nothing is invented', () => {
  it('a line with no figure is left out entirely', () => {
    const a = assess({ lines: [{ key: 'base', label: 'Base', ytd: null }], to: TO })
    expect(a.lines).toHaveLength(0)
    expect(a.totals.full).toBe(0)
  })

  it('a figure typed with a dollar sign and commas still reads', () => {
    const a = assess({ lines: [{ key: 'base', label: 'Base', ytd: '$29,903' as any }], to: TO })
    expect(line(a, 'base').ytd).toBe(29903)
  })

  it('and a figure that is not a number is left out rather than read as nought', () => {
    const a = assess({ lines: [{ key: 'base', label: 'Base', ytd: 'about sixty' as any }], to: TO })
    expect(a.lines).toHaveLength(0)
  })

  it('no lines at all is nought, not a crash', () => {
    const a = assess({ lines: [], to: TO })
    expect(a.totals).toEqual({ full: 0, shaded: 0, variable: 0 })
  })

  it('and a payslip dated before the year started cannot divide by nought', () => {
    const a = assess({ lines: PRIYA, to: d('2026-07-01'), employmentStart: d('2026-08-01') })
    expect(a.coverage.days).toBe(0)
    expect(a.totals.full).toBe(13500)   // the one-off only; nothing can be annualised
    expect(Number.isFinite(a.totals.shaded)).toBe(true)
  })
})

describe('the figures are still given when the coverage is short', () => {
  it('because an assessor wants to see what six weeks says', () => {
    // They simply must not be handed it as an answer. coverage.enough is what
    // a screen reads to decide whether to put a red box around all of it.
    const a = assess({ lines: PRIYA, to: d('2026-08-10') })
    expect(a.coverage.enough).toBe(false)
    expect(a.totals.full).toBeGreaterThan(0)
  })
})

describe('the lower of the two, where last year is known', () => {
  // Macquarie's rule where a year to date is short or missing. Offered rather
  // than applied - a screen shows both and a person chooses.
  it('takes last year where it is lower', () => {
    expect(lowerOf(174974, 150000)).toBe(150000)
  })

  it('and the annualised figure where THAT is lower', () => {
    expect(lowerOf(140000, 150000)).toBe(140000)
  })

  it('with no last year, there is nothing to compare and it stands', () => {
    expect(lowerOf(174974, null)).toBe(174974)
  })
})
