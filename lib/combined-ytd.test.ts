import { describe, it, expect } from 'vitest'
import { assessCombined, annualFromRate } from './combined-ytd'
import { toFactFind } from './income-to-fact-find'

// WHEN A PAYSLIP GIVES ONE YEAR-TO-DATE FIGURE AND NOT A BREAKDOWN.
//
// 28 Oct 2026. Two real payslips, which is where this came from. The people are
// invented; the SHAPE of each document is exactly as it arrives, because that
// is the thing the first version got wrong.
//
//   The central bank one      prints "Annual Rate: 209,325.17" at the top, an
//                             earnings table of this fortnight's amounts, and a
//                             year to date box of four totals.
//   The health service one    prints "Weekly Base Rate $2643.73", an earnings
//                             table of hours per day across the fortnight, and
//                             a year to date box of four totals.
//
// Neither has a year to date against any earnings line. The reader refused both
// and told the broker to type it by hand, which made the feature useless on the
// normal case.

const d = (s: string) => new Date(`${s}T00:00:00`)

describe('THE BASE, AS A YEAR', () => {
  it('an annual rate is already a year', () => {
    expect(annualFromRate({ amount: 209325.17, basis: 'annual' })).toBe(209325)
  })

  it('a weekly rate is times 52', () => {
    // $2,643.73 a week.
    expect(annualFromRate({ amount: 2643.73, basis: 'weekly' })).toBe(137474)
  })

  it('a fortnight is times 26 and a month is times 12', () => {
    expect(annualFromRate({ amount: 8050.97, basis: 'fortnightly' })).toBe(209325)
    expect(annualFromRate({ amount: 12000, basis: 'monthly' })).toBe(144000)
  })

  it('A MONTH IS A TWELFTH OF A YEAR, NOT 4.33 WEEKS', () => {
    // The approximation is how a $12,000 month becomes $12,996 a year too much.
    expect(annualFromRate({ amount: 12000, basis: 'monthly' })).toBe(144000)
    expect(annualFromRate({ amount: 12000, basis: 'monthly' })).not.toBe(149760)
  })

  it('an hourly rate assumes a 38 hour week unless told otherwise', () => {
    expect(annualFromRate({ amount: 50, basis: 'hourly' })).toBe(98800)
    expect(annualFromRate({ amount: 50, basis: 'hourly', hoursPerWeek: 20 })).toBe(52000)
  })

  it('and nothing usable is null, not nought', () => {
    for (const bad of [null, undefined, { amount: 0, basis: 'annual' }, { amount: -5, basis: 'weekly' }]) {
      expect(annualFromRate(bad as any), JSON.stringify(bad)).toBeNull()
    }
  })
})

describe('THE CENTRAL BANK PAYSLIP — to 1 October, 93 days', () => {
  // Annual Rate 209,325.17 · Total Gross year to date 58,549.77.
  const a = assessCombined({
    ytdGross: 58549.77, annualBase: 209325, to: d('2026-10-01'), baseLabel: 'Salary',
  })

  it('counts 93 days from 1 July', () => {
    expect(a.coverage.days).toBe(93)
    expect(a.coverage.enough).toBe(true)
  })

  it('annualises the whole year to date', () => {
    // 58,549.77 ÷ 93 × 365.
    expect(a.annualisedTotal).toBe(229792)
  })

  it('AND TAKES THE BASE OFF IT, LEAVING ONE BUNDLED LINE', () => {
    expect(a.lines).toHaveLength(2)
    expect(a.lines[0].key).toBe('base')
    expect(a.lines[0].full).toBe(209325)
    expect(a.lines[1].label).toContain('Everything else')
    expect(a.lines[1].full).toBe(20467)
  })

  it('base is the same in both columns, the bundle is shaded', () => {
    expect(a.lines[0].shaded).toBe(209325)
    expect(a.lines[1].shaded).toBe(Math.round(20467 * 0.8))
  })

  it('and the totals are the two figures a credit team reads', () => {
    expect(a.totals.full).toBe(229792)
    expect(a.totals.shaded).toBe(225699)
    expect(a.totals.variable).toBe(a.totals.full - a.totals.shaded)
  })

  it('and it says in words what it did', () => {
    expect(a.words).toContain('$229,792 annualised, less $209,325 of base')
    expect(a.words).toContain('$20,467')
  })
})

describe('THE HEALTH SERVICE PAYSLIP — to 13 September, 75 days', () => {
  // Weekly Base Rate $2,643.73 · Gross year to date 50,257.70. A registrar with
  // a great deal of overtime and penalty time, which is exactly the file where
  // the 80% column earns its keep.
  const base = annualFromRate({ amount: 2643.73, basis: 'weekly' })!
  const a = assessCombined({ ytdGross: 50257.70, annualBase: base, to: d('2026-09-13'), baseLabel: 'Normal Hours' })

  it('counts 75 days', () => {
    expect(a.coverage.days).toBe(75)
  })

  it('annualises to $244,587', () => {
    expect(a.annualisedTotal).toBe(244587)
  })

  it('AND FINDS $107,113 THAT IS NOT BASE', () => {
    expect(a.lines[1].full).toBe(107113)
  })

  it('which is where the two columns pull apart', () => {
    expect(a.totals.full).toBe(244587)
    expect(a.totals.shaded).toBe(223164)
    // More than twenty thousand between them. That gap is the decision.
    expect(a.totals.variable).toBeGreaterThan(20000)
  })
})

describe('THE REMAINDER CAN COME OUT NEGATIVE, AND THAT MEANS SOMETHING', () => {
  // Says the year to date is running BELOW the contracted base - unpaid leave,
  // reduced hours, a late start, or not enough of the year yet.
  const a = assessCombined({ ytdGross: 20000, annualBase: 209325, to: d('2026-10-01') })

  it('never claims a negative line of income', () => {
    expect(a.lines.every(l => l.full >= 0)).toBe(true)
  })

  it('and never counts a bundle at all', () => {
    expect(a.lines).toHaveLength(1)
    expect(a.lines[0].key).toBe('base')
  })

  it('BUT IT SAYS SO RATHER THAN GOING QUIET', () => {
    // Silently showing the full base on somebody working half the hours is the
    // kind of plausible figure nobody questions.
    expect(a.baseAboveTotal).toBe(true)
    expect(a.words).toContain('BELOW the contracted base')
  })
})

describe('nothing is invented when the payslip is short of facts', () => {
  it('no base rate printed means it asks for one', () => {
    const a = assessCombined({ ytdGross: 58549.77, annualBase: 0, to: d('2026-10-01') })
    expect(a.lines).toHaveLength(0)
    expect(a.totals.full).toBe(0)
    expect(a.words).toContain('does not print a base rate')
  })

  it('no year to date leaves the base standing on its own', () => {
    // The contract is still a fact. It just cannot be topped up by anything.
    const a = assessCombined({ ytdGross: 0, annualBase: 209325, to: d('2026-10-01') })
    expect(a.totals.full).toBe(209325)
    expect(a.lines).toHaveLength(1)
  })

  it('and a period ending before the year started cannot divide by nought', () => {
    const a = assessCombined({
      ytdGross: 58549.77, annualBase: 209325, to: d('2026-07-01'), employmentStart: d('2026-08-01'),
    })
    expect(a.coverage.days).toBe(0)
    expect(Number.isFinite(a.totals.full)).toBe(true)
  })
})

describe('somebody who started partway through the year', () => {
  it('IS COUNTED FROM THEIR START DATE, SAME AS EVERYWHERE ELSE', () => {
    // The same rule as the line-by-line path, from the same function, so the
    // two cannot disagree about what a year is.
    const a = assessCombined({
      ytdGross: 30000, annualBase: 150000, to: d('2026-10-01'), employmentStart: d('2026-09-01'),
    })
    expect(a.coverage.days).toBe(31)
    expect(a.coverage.enough).toBe(false)
    expect(a.coverage.why).toContain('employment contract')
  })

  it('and the figures are still given, because an assessor wants to see them', () => {
    const a = assessCombined({
      ytdGross: 30000, annualBase: 150000, to: d('2026-10-01'), employmentStart: d('2026-09-01'),
    })
    expect(a.totals.full).toBeGreaterThan(0)
  })
})

describe('the rate can be changed and both columns follow', () => {
  it('at 50%', () => {
    const a = assessCombined({ ytdGross: 58549.77, annualBase: 209325, to: d('2026-10-01'), rate: 0.5 })
    expect(a.lines[1].shaded).toBe(Math.round(20467 * 0.5))
    expect(a.lines[0].shaded).toBe(209325)
  })

  it('and nonsense falls back to 80%', () => {
    for (const bad of [0, -1, 5, NaN]) {
      expect(assessCombined({ ytdGross: 58549.77, annualBase: 209325, to: d('2026-10-01'), rate: bad }).rate).toBe(0.8)
    }
  })
})

describe('AND IT FILLS THE SAME SIX BOXES AS EVERY OTHER PAYSLIP', () => {
  // The whole point of returning the same shape: the screen draws it the same
  // way and lib/income-to-fact-find.ts needs no idea this path exists.
  const a = assessCombined({ ytdGross: 58549.77, annualBase: 209325, to: d('2026-10-01') })

  it('base into Gross salary, the bundle into overtime', () => {
    const f = toFactFind(a, 'full')
    expect(f.grossSalary).toBe('209325')
    expect(f.overtimeNonEssentialAmount).toBe('20467')
    expect(f.commissionAmount).toBe('')
    expect(f.bonusAmount).toBe('')
  })

  it('and the 80% column shades only the bundle', () => {
    const f = toFactFind(a, 'shaded')
    expect(f.grossSalary).toBe('209325')
    expect(f.overtimeNonEssentialAmount).toBe('16374')
  })

  it('and the essential services switch still works on it', () => {
    const f = toFactFind(a, 'full', { essentialOvertime: true })
    expect(f.overtimeEssentialAmount).toBe('20467')
    expect(f.overtimeNonEssentialAmount).toBe('')
  })
})
