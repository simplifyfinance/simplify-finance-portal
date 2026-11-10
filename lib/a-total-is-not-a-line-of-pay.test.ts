// A TOTAL IS NOT A LINE OF PAY, AND IT DOUBLED SOMEBODY'S INCOME.
//
// 10 Nov 2026. Kellie King's payslip, pay period 15 to 28 August 2026. The
// screen offered $136,090 a year, with a button under it that writes the
// figure onto the fact find. She earns about $63,000.
//
// The payslip prints a line called "Taxable" - what is left of gross after the
// tax free kilometres and the salary sacrifice come out. It is a subtotal of
// the lines above it. The portal read it as a line of pay, annualised it to
// $73,154 and added it on top of her Normal Pay, counting her own earnings
// twice.
//
// It got through because the not-income rule looks for the word "tax" on its
// own, and "taxable" does not match it. The line fell through as unrecognised,
// and an unrecognised line is counted on purpose so an oddly named allowance
// is not dropped.
//
// Fabio: "where did it get 39K". That was the second fault in the same box.
import { describe, it, expect } from 'vitest'
import { isTotal } from './payslip-lines'
import { assess, type PayLine } from './annualise-income'

// Her payslip, as the portal read it, with "Taxable" still on it.
const WITH_THE_TOTAL: PayLine[] = [
  { key: 'base',      label: 'Normal Pay Hourly',    ytd: 9978.21 },
  // Unrecognised, so 'other' - which is why the screen shaded it to 80%.
  { key: 'other',     label: 'Kilometers Taxable',   ytd: 181.20 },
  { key: 'other',     label: 'Kilometers Tax Free',  ytd: 1648.92, notIncome: true },
  { key: 'allowance', label: 'Laundry per Week',     ytd: 13.73 },
  { key: 'other',     label: 'SalSac -HESTA Super',  ytd: 250.00, notIncome: true },
  { key: 'other',     label: 'Taxable',              ytd: 11824.84 },
  { key: 'other',     label: 'Tax',                  ytd: 1966.00, notIncome: true },
  { key: 'other',     label: 'Net Pay',              ytd: 11648.89, notIncome: true },
  // The payslip prints the salary sacrifice twice - once as a deduction and
  // once under Superannuation. Both were being counted.
  { key: 'other',     label: 'SalSac - HESTA Super', ytd: 250.00, notIncome: true },
  { key: 'other',     label: 'SG -HESTA Super',      ytd: 1425.90, notIncome: true },
]

const TO = new Date('2026-08-28T00:00:00')
const run = (lines: PayLine[]) => assess({ lines, to: TO })

describe('the total never reaches the lines', () => {
  it('knows Taxable is a total, like Gross', () => {
    for (const label of ['Taxable', 'taxable income', 'Taxable Earnings', 'Total Taxable']) {
      expect(isTotal(label), label).toBe(true)
    }
  })

  // THE HALF THAT MATTERS AS MUCH. A taxable allowance is money somebody is
  // paid, and dropping it would understate them - which is the mistake in the
  // other direction. So the match is the whole label, never a prefix.
  it('and a line that merely has the word in it is not', () => {
    for (const label of ['Kilometers Taxable', 'Taxable Allowance', 'Taxable Car Allowance']) {
      expect(isTotal(label), label).toBe(false)
    }
  })
})

describe('Kellie King, 28 August 2026', () => {
  // 1 July to 28 August inclusive.
  it('counts 59 days of the year', () => {
    expect(run(WITH_THE_TOTAL).coverage.days).toBe(59)
  })

  // What the screen showed her broker.
  it('is what produced the $136,090 and the $121,235', () => {
    expect(run(WITH_THE_TOTAL).totals.full).toBe(136090)
    expect(run(WITH_THE_TOTAL).totals.shaded).toBe(121235)
  })

  // And what it is once the subtotal never becomes a line - which is what
  // isTotal() now does at read time, in app/api/read-payslip/route.ts.
  it('comes down to her actual pay once the total is left out', () => {
    const real = WITH_THE_TOTAL.filter(l => !isTotal(l.label))
    const a = run(real)
    expect(a.totals.full).toBe(62936)
    expect(a.totals.shaded).toBe(62712)
    // $73,154 of income that does not exist.
    expect(run(WITH_THE_TOTAL).totals.full - a.totals.full).toBe(73154)
  })
})

describe('year to date means earned', () => {
  // Fabio: "where did it get 39K". It added every line on the payslip - the
  // pay, and then the tax, the net pay, the salary sacrifice and both super
  // lines on top. $39,187.69, which is not a figure about anything.
  it('leaves out the money handed back', () => {
    const a = run(WITH_THE_TOTAL)
    // The sum of every line was $39,188. It is the earned ones only now, and
    // the test states it as a rule rather than as a number somebody could
    // quietly re-bless.
    const earned = a.lines.filter(l => !l.notIncome).reduce((t, l) => t + l.ytd, 0)
    const all = a.lines.reduce((t, l) => t + l.ytd, 0)
    expect(all).toBeGreaterThan(earned)
    expect(a.working[0]).toContain('$' + earned.toLocaleString('en-AU'))
    expect(a.working[0]).not.toContain('$' + all.toLocaleString('en-AU'))
  })

  it('adds up only what was earned', () => {
    const real = WITH_THE_TOTAL.filter(l => !isTotal(l.label))
    // 9,978.21 + 181.20 + 13.73
    expect(run(real).working[0]).toContain('$10,173')
    expect(run(real).working[0]).toContain('earned')
  })

  // The excluded lines are still shown and still explained. Leaving them off
  // the screen would be a different kind of wrong: a reader could not tell
  // whether the portal had seen the whole payslip.
  it('still says what each one was and why it is out', () => {
    const working = run(WITH_THE_TOTAL).working.join('\n')
    for (const label of ['Tax', 'Net Pay', 'SG -HESTA Super']) {
      expect(working, `${label} is no longer explained`).toContain(label)
    }
    expect(working).toContain('money handed back, not money earned')
  })
})
