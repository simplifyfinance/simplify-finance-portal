import { describe, it, expect } from 'vitest'
import { seYearTotalFF, calculateSeAssessableIncome } from './income-calculations'

// EVERY FIGURE HERE IS TYPED WITH COMMAS, because that is what CurrencyInput
// stores. Number('180,000') is NaN, so this whole file used to return 0 for
// every self-employed applicant on every method, and the fact find printed that
// zero in a box labelled "Assessable income (calculated)".
const typed = (over: any = {}) => ({
  seAssessmentMethod: 'One year in isolation',
  seYear1FY: '2024/25', seYear1Salary: '120,000', seYear1NetProfit: '180,000',
  seYear1Depreciation: '12,000', seYear1Interest: '8,000',
  seYear1Super: '', seYear1OneOff: '', seYear1Other: '',
  seYear2FY: '2023/24', seYear2Salary: '110,000', seYear2NetProfit: '150,000',
  seYear2Depreciation: '', seYear2Interest: '', seYear2Super: '', seYear2OneOff: '', seYear2Other: '',
  seDirectorSalary: '150,000', seDirectorSalaryFrequency: 'Annually',
  seGrowthMethod: 'average', seGrowthPercentOption: '20', seGrowthPercentCustom: '',
  ...over,
})

describe('a year total, from figures typed the way the form stores them', () => {
  it('adds salary, net profit and every add-back', () => {
    // 120,000 + 180,000 + 12,000 + 8,000
    expect(seYearTotalFF(typed(), 1)).toBe(320_000)
  })

  it('is the same with or without the commas', () => {
    const bare = typed({ seYear1Salary: '120000', seYear1NetProfit: '180000',
                         seYear1Depreciation: '12000', seYear1Interest: '8000' })
    expect(seYearTotalFF(bare, 1)).toBe(seYearTotalFF(typed(), 1))
  })

  it('treats an empty add-back as nothing, not as a break', () => {
    expect(seYearTotalFF(typed({ seYear1Depreciation: '', seYear1Interest: '' }), 1)).toBe(300_000)
  })

  it('copes with a dollar sign somebody pasted in', () => {
    expect(seYearTotalFF(typed({ seYear1Salary: '$120,000' }), 1)).toBe(320_000)
  })

  it('is zero on an income with nothing filled in', () => {
    expect(seYearTotalFF({}, 1)).toBe(0)
  })
})

describe('the three assessment methods', () => {
  it('one year in isolation is year one', () => {
    expect(calculateSeAssessableIncome(typed())).toBe(320_000)
  })

  it("a director's salary is the salary, annualised", () => {
    const d = typed({ seAssessmentMethod: "Director's salary" })
    expect(calculateSeAssessableIncome(d)).toBe(150_000)
    expect(calculateSeAssessableIncome({ ...d, seDirectorSalary: '12,500', seDirectorSalaryFrequency: 'Monthly' })).toBe(150_000)
    expect(calculateSeAssessableIncome({ ...d, seDirectorSalary: '2,500', seDirectorSalaryFrequency: 'Fortnightly' })).toBe(65_000)
  })

  it('two years averages them', () => {
    // (320,000 + 260,000) / 2
    expect(calculateSeAssessableIncome(typed({ seAssessmentMethod: 'Last 2 financial years' }))).toBe(290_000)
  })

  it('takes the latest year when it is genuinely lower', () => {
    const d = typed({ seAssessmentMethod: 'Last 2 financial years', seGrowthMethod: 'latest_lower' })
    expect(calculateSeAssessableIncome(d)).toBe(260_000)
  })

  // A contradiction, not a number. The form shows "Latest year not lower" and
  // asks for a different method; returning a figure would bury that.
  it('refuses when the latest year is not lower', () => {
    const d = typed({ seAssessmentMethod: 'Last 2 financial years', seGrowthMethod: 'latest_lower',
                      seYear2Salary: '400,000', seYear2NetProfit: '200,000' })
    expect(Number.isNaN(calculateSeAssessableIncome(d))).toBe(true)
  })

  it('applies a growth percentage to the previous year', () => {
    const d = typed({ seAssessmentMethod: 'Last 2 financial years',
                      seGrowthMethod: 'previous_plus_growth', seGrowthPercentOption: '20' })
    expect(calculateSeAssessableIncome(d)).toBe(384_000)   // 320,000 + 20%
  })

  it('takes a custom growth percentage', () => {
    const d = typed({ seAssessmentMethod: 'Last 2 financial years',
                      seGrowthMethod: 'previous_plus_growth',
                      seGrowthPercentOption: 'Other', seGrowthPercentCustom: '35' })
    expect(calculateSeAssessableIncome(d)).toBe(432_000)   // 320,000 + 35%
  })
})

// The bug itself, kept as a test so it cannot come back.
describe('what Number() used to do to all of this', () => {
  it('never assesses a real income as zero', () => {
    for (const method of ['One year in isolation', "Director's salary", 'Last 2 financial years']) {
      const got = calculateSeAssessableIncome(typed({ seAssessmentMethod: method }))
      expect(got, `${method} assessed a $320,000 applicant at ${got}`).toBeGreaterThan(0)
    }
  })
})
