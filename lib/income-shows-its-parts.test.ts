// WHAT THE EMAIL SAYS ABOUT SOMEBODY'S PAY.
//
// Fabio, 24 Sep 2026: "bonus and commisisons section not carriying to html -
// assuming overtime and overtime essetial too WIRE FOR ALL TEMAPLSTES"
//
// The first two tests were written BEFORE anything changed, to establish what
// the email did rather than reason about it: the money was always in the total,
// the words were never in the email.

import { describe, it, expect } from 'vitest'
import { annualIncomeOf, incomeBreakdownFor } from './income-calculations'

const felicity = {
  income: [{
    incomeType: 'PAYG',
    grossSalary: '135,000', grossSalaryFrequency: 'Annually',
    bonusAmount: '16,000', bonusFrequency: 'Annually',
    overtimeEssentialAmount: '', overtimeEssentialFrequency: 'Annually',
    overtimeNonEssentialAmount: '', overtimeNonEssentialFrequency: 'Annually',
    commissionAmount: '', commissionFrequency: 'Annually',
    allowanceAmount: '', allowanceFrequency: 'Annually',
  }],
}

describe('the money was never lost', () => {
  it('counts the bonus in the total, as it always did', () => {
    expect(annualIncomeOf(felicity.income[0])).toBe(151000)
  })
})

describe('and now the email says where it came from', () => {
  it('names the salary and the bonus, and they still add to the same total', () => {
    const out = incomeBreakdownFor(felicity, 'Felicity')
    expect(out).toEqual([
      { label: 'Felicity — Gross salary', amount: 135000 },
      { label: 'Felicity — Bonus', amount: 16000 },
    ])
    expect(out.reduce((t, l) => t + (l.amount || 0), 0)).toBe(151000)
  })

  it('names all four extras, each annualised from its own frequency', () => {
    const out = incomeBreakdownFor({
      income: [{
        incomeType: 'PAYG',
        grossSalary: '100,000', grossSalaryFrequency: 'Annually',
        bonusAmount: '10,000', bonusFrequency: 'Annually',
        commissionAmount: '500', commissionFrequency: 'Monthly',
        overtimeEssentialAmount: '200', overtimeEssentialFrequency: 'Weekly',
        overtimeNonEssentialAmount: '100', overtimeNonEssentialFrequency: 'Weekly',
        allowanceAmount: '3,000', allowanceFrequency: 'Annually',
      }],
    }, 'Timothy')

    expect(out).toEqual([
      { label: 'Timothy — Gross salary',           amount: 100000 },
      { label: 'Timothy — Bonus',                  amount: 10000 },
      { label: 'Timothy — Overtime essential',     amount: 10400 },
      { label: 'Timothy — Overtime non-essential', amount: 5200 },
      { label: 'Timothy — Commission',             amount: 6000 },
      { label: 'Timothy — Allowance',              amount: 3000 },
    ])
  })

  it('commas in a figure are a number, not a NaN', () => {
    const out = incomeBreakdownFor(felicity, 'Felicity')
    expect(out.every(l => Number.isFinite(l.amount))).toBe(true)
  })
})

describe('what does NOT change', () => {
  it('a salary and nothing else reads exactly as it did yesterday', () => {
    expect(incomeBreakdownFor({
      income: [{ incomeType: 'PAYG', grossSalary: '90,000', grossSalaryFrequency: 'Annually' }],
    }, 'Megan')).toEqual([{ label: 'Megan — PAYG income', amount: 90000 }])
  })

  it('an empty income entry still prints its line rather than vanishing', () => {
    expect(incomeBreakdownFor({
      income: [{ incomeType: 'PAYG', grossSalary: '', bonusAmount: '' }],
    }, 'Megan')).toEqual([{ label: 'Megan — PAYG income', amount: 0 }])
  })

  it('self-employed still says income as per tax returns, with no figure invented', () => {
    expect(incomeBreakdownFor({
      income: [{ incomeType: 'Self-employed', seBusinessName: 'Acme Pty Ltd' }],
    }, 'Dylan')).toEqual([{ label: 'Dylan — Self-employed income', amount: null }])
  })

  it('other income keeps its own name', () => {
    expect(incomeBreakdownFor({
      income: [{ incomeType: 'Other taxable', otherIncomeType: 'Rental', otherIncomeAmount: '24,000' }],
    }, 'Dylan')).toEqual([{ label: 'Dylan — Rental', amount: 24000 }])
  })

  it('an income type nobody chose is not printed', () => {
    expect(incomeBreakdownFor({ income: [{ incomeType: '' }] }, 'Dylan')).toEqual([])
    expect(incomeBreakdownFor({}, 'Dylan')).toEqual([])
    expect(incomeBreakdownFor(null, 'Dylan')).toEqual([])
  })

  it('a zero bonus is not a line - a field left at nought is not news', () => {
    const out = incomeBreakdownFor({
      income: [{
        incomeType: 'PAYG',
        grossSalary: '90,000', grossSalaryFrequency: 'Annually',
        bonusAmount: '0', bonusFrequency: 'Annually',
      }],
    }, 'Megan')
    expect(out).toEqual([{ label: 'Megan — PAYG income', amount: 90000 }])
  })
})

describe('every template, not just the one Fabio was looking at', () => {
  // BCForm builds ONE incomeBreakdown and hands it to /api/generate-email, which
  // has ONE buildChecklist. There is no per-template income path to miss. This
  // test fails the day somebody adds one.
  it('BCForm builds the breakdown in exactly one place, from the shared function', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync(new URL('../app/(app)/deals/[id]/BCForm.tsx', import.meta.url), 'utf8')
    expect(src).toContain('incomeBreakdownFor')
    // The old local copy must be gone, or two versions of the truth exist again.
    expect(src).not.toContain('function buildIncomeBreakdown')
    expect(src.match(/incomeBreakdown:/g) || []).toHaveLength(1)
  })

  it('the email route reads that breakdown and nothing else for income', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync(new URL('../app/api/generate-email/route.ts', import.meta.url), 'utf8')
    expect(src.match(/d\.incomeBreakdown/g) || []).toHaveLength(1)
  })
})
