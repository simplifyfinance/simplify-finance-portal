// SELF-EMPLOYED ASSESSABLE INCOME.
//
// Every figure here arrives from a CurrencyInput, which stores money the way the
// rest of this codebase does - comma formatted, as a string: "180,000". This
// file used to read them with Number().
//
//   Number('180,000')  ->  NaN     ->  || 0  ->  0
//
// So a self-employed applicant with $320,000 of assessable income assessed at
// ZERO, on all three methods, silently, for every figure over $999 - which is
// every figure anybody has ever typed here. The "Assessable income
// (calculated)" box on the fact find said $0 and looked like an answer.
//
// readMoney() is the one way this codebase reads stored money. See lib/money.ts,
// and the guard in lib/email-money.test.ts that keeps Number() away from it.
import { readMoney } from './money'

// Zero when the box is empty, which is what an add-back nobody typed means.
const n = (v: any): number => readMoney(v) ?? 0

const PER_YEAR: Record<string, number> = { Weekly: 52, Fortnightly: 26, Monthly: 12, Annually: 1 }

export function seYearTotalFF(inc: any, year: 1 | 2): number {
  const p = year === 1 ? 'seYear1' : 'seYear2'
  return n(inc?.[`${p}Salary`]) + n(inc?.[`${p}NetProfit`]) +
    n(inc?.[`${p}Depreciation`]) + n(inc?.[`${p}Interest`]) +
    n(inc?.[`${p}Super`]) + n(inc?.[`${p}OneOff`]) + n(inc?.[`${p}Other`])
}

export function calculateSeAssessableIncome(inc: any): number {
  const year1 = seYearTotalFF(inc, 1)
  if (inc?.seAssessmentMethod === 'One year in isolation') return year1

  if (inc?.seAssessmentMethod === "Director's salary") {
    return n(inc?.seDirectorSalary) * (PER_YEAR[inc?.seDirectorSalaryFrequency] ?? 1)
  }

  const year2 = seYearTotalFF(inc, 2)

  // NaN on purpose, and the form catches it: "latest year because lower than
  // previous" is not a method you can apply when the latest year is higher. It
  // is a contradiction, not a number, and returning one would hide it.
  if (inc?.seGrowthMethod === 'latest_lower') return year2 < year1 ? year2 : NaN

  if (inc?.seGrowthMethod === 'previous_plus_growth') {
    const pct = inc?.seGrowthPercentOption === 'Other'
      ? n(inc?.seGrowthPercentCustom)
      : n(inc?.seGrowthPercentOption)
    return year1 * (1 + pct / 100)
  }

  return (year1 + year2) / 2
}

// --- one income entry, over a year ------------------------------------------
//
// The BC kept its own copy of everything above, with the same Number() fault in
// it - which is how the bug survived being found: fixing one file would have
// left the other quietly reporting zero. There is one copy now.

export function annualise(amount: any, frequency: any): number {
  return n(amount) * (PER_YEAR[String(frequency || 'Annually')] ?? 1)
}

export function annualIncomeOf(inc: any): number {
  if (inc?.incomeType === 'PAYG') {
    return annualise(inc.grossSalary, inc.grossSalaryFrequency)
      + annualise(inc.bonusAmount, inc.bonusFrequency)
      + annualise(inc.overtimeEssentialAmount, inc.overtimeEssentialFrequency)
      + annualise(inc.overtimeNonEssentialAmount, inc.overtimeNonEssentialFrequency)
      + annualise(inc.commissionAmount, inc.commissionFrequency)
      + annualise(inc.allowanceAmount, inc.allowanceFrequency)
  }
  if (inc?.incomeType === 'Self-employed') {
    const assessed = calculateSeAssessableIncome(inc)
    // "Latest year because lower" when it is not lower is a contradiction, and
    // calculateSeAssessableIncome says so with NaN so the form can show it. A
    // TOTAL cannot carry a NaN - one unanswerable entry would wipe out every
    // other income on the deal - so here it counts as nothing until somebody
    // picks a method that works.
    return Number.isNaN(assessed) ? 0 : assessed
  }
  if (inc?.incomeType === 'Other taxable' || inc?.incomeType === 'Other non-taxable') {
    return n(inc.otherIncomeAmount)
  }
  return 0
}

export function annualIncomeOfApplicant(applicant: any): number {
  return Math.round((applicant?.income || []).reduce((t: number, inc: any) => t + annualIncomeOf(inc), 0))
}
