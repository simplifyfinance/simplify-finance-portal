import { describe, it, expect } from 'vitest'
import { selfEmployedFacts, selfEmployedParagraph, selfEmployedParagraphsFor } from './self-employed-facts'

const base = {
  incomeType: 'Self-employed',
  seBusinessName: 'Fogolin Consulting Pty Ltd',
  seYear1FY: '2023/24', seYear1NetProfit: '180,000', seYear1Salary: '60,000',
  seYear1Depreciation: '12,000', seYear1Interest: '8,000',
  seYear2FY: '2024/25', seYear2NetProfit: '210,000', seYear2Salary: '60,000',
  seYear2Depreciation: '14,000', seYear2Super: '25,000',
  seDirectorProfitable: 'Yes',
}
const company = { selfEmployedStructure: 'Company', employerName: 'Fogolin Consulting Pty Ltd' }
const para = (inc: any, emp: any = company) => selfEmployedParagraph('Ricardo Fogolin', selfEmployedFacts(inc, emp))

describe('the average of two years', () => {
  const inc = { ...base, seAssessmentMethod: 'Last 2 financial years', seGrowthMethod: 'average' }

  it('quotes both years, because both are used', () => {
    const p = para(inc)
    expect(p).toContain('$284,500 per annum')
    expect(p).toContain('the average of the last two financial years')
    expect(p).toContain('FY2023/24 of $260,000')
    expect(p).toContain('FY2024/25 of $309,000')
  })

  it('shows what each year was made of', () => {
    expect(para(inc)).toContain('net profit $180,000 and salary $60,000, plus add-backs of $12,000 depreciation, $8,000 interest')
  })
})

// Fabio, 8 Sep 2026: "do not say the word lower."
describe('the latest financial year', () => {
  const inc = { ...base, seAssessmentMethod: 'Last 2 financial years', seGrowthMethod: 'latest_lower',
                seYear2NetProfit: '120,000', seYear2Depreciation: '', seYear2Super: '' }

  it('never uses the word lower', () => {
    expect(para(inc).toLowerCase()).not.toContain('lower')
  })

  it('says it is the latest year as per the tax returns', () => {
    expect(para(inc)).toContain('being the latest financial year as per the tax returns provided')
    expect(para(inc)).toContain('$180,000 per annum')
  })

  it('does not quote the year it did not use', () => {
    expect(para(inc)).toContain('FY2024/25')
    expect(para(inc)).not.toContain('FY2023/24')
  })
})

describe('the previous year plus growth', () => {
  const inc = { ...base, seAssessmentMethod: 'Last 2 financial years',
                seGrowthMethod: 'previous_plus_growth', seGrowthPercentOption: '20' }

  it('says it in Fabio\'s words', () => {
    const p = para(inc)
    expect(p).toContain('The business is growing and performing well year on year.')
    expect(p).toContain('a conservative figure of the previous financial year plus 20% growth, as per lender policy')
    expect(p).toContain('$312,000 per annum')
  })

  it('does not quote the year it did not use', () => {
    expect(para(inc)).toContain('FY2023/24')
    expect(para(inc)).not.toContain('FY2024/25')
  })

  // The one claim in the whole paragraph, so it has to be earned.
  it('does not claim growth on a business that shrank', () => {
    const shrinking = { ...inc, seYear2NetProfit: '20,000', seYear2Salary: '', seYear2Depreciation: '', seYear2Super: '' }
    expect(para(shrinking)).not.toContain('growing and performing well')
    // The method itself is still described.
    expect(para(shrinking)).toContain('plus 20% growth')
  })
})

describe('the other methods', () => {
  it('one year in isolation', () => {
    const p = para({ ...base, seAssessmentMethod: 'One year in isolation' })
    expect(p).toContain('being one financial year in isolation')
    expect(p).toContain('One year of tax returns')
  })

  it("a director's salary", () => {
    const p = para({ seBusinessName: 'Fogolin Consulting Pty Ltd', seAssessmentMethod: "Director's salary",
                     seDirectorSalary: '180,000', seDirectorProfitable: 'Yes' })
    expect(p).toContain("being the director's salary of $180,000")
    expect(p).toContain('Payslips and an ATO income statement')
  })
})

describe('what it refuses to say', () => {
  // The whole reason this exists: nothing typed in is not zero.
  it('never reports an empty income as a figure', () => {
    const empty = { seBusinessName: 'Fogolin Consulting Pty Ltd', seAssessmentMethod: 'Last 2 financial years', seGrowthMethod: 'average' }
    const f = selfEmployedFacts(empty, company)
    expect(f.hasFigures).toBe(false)
    expect(f.assessed).toBeNull()
    const p = selfEmployedParagraph('Ricardo Fogolin', f)
    expect(p).toContain('no income figures have been recorded')
    expect(p).toContain('must be completed before the file is assessed')
    expect(p).not.toContain('$0')
  })

  it('says a business is not profitable when that is the answer', () => {
    const p = para({ ...base, seAssessmentMethod: 'One year in isolation', seDirectorProfitable: 'No' })
    expect(p).toContain('not currently profitable, which has been taken into account')
  })

  it('says nothing about profitability when nobody answered', () => {
    const p = para({ ...base, seAssessmentMethod: 'One year in isolation', seDirectorProfitable: '' })
    expect(p).not.toContain('profitable')
  })
})

describe('a whole deal', () => {
  it('writes one paragraph per self-employed income and ignores the PAYG ones', () => {
    const deal = { fact_find_data: { applicants: [
      { firstName: 'Ricardo', lastName: 'Fogolin',
        employment: [{ id: 'e1', selfEmployedStructure: 'Company', employmentType: 'Self-employed' }],
        income: [{ ...base, employmentId: 'e1', seAssessmentMethod: 'One year in isolation' },
                 { incomeType: 'PAYG', grossSalary: '90,000', grossSalaryFrequency: 'Annually' }] },
      { firstName: 'Joanne', lastName: 'Saliba', employment: [], income: [] },
    ] } }
    const out = selfEmployedParagraphsFor(deal)
    expect(out).toHaveLength(1)
    expect(out[0]).toContain('Ricardo Fogolin is self-employed')
    expect(out[0]).toContain('a company structure')
  })

  it('has nothing to say on a deal with no self-employed income', () => {
    expect(selfEmployedParagraphsFor({ fact_find_data: { applicants: [{ income: [{ incomeType: 'PAYG', grossSalary: '90,000' }] }] } })).toEqual([])
    expect(selfEmployedParagraphsFor({})).toEqual([])
  })
})
