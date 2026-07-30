export function seYearTotalFF(inc: any, year: 1 | 2): number {
  const p = year === 1 ? 'seYear1' : 'seYear2'
  return (Number(inc[`${p}Salary`]) || 0) + (Number(inc[`${p}NetProfit`]) || 0) +
    (Number(inc[`${p}Depreciation`]) || 0) + (Number(inc[`${p}Interest`]) || 0) +
    (Number(inc[`${p}Super`]) || 0) + (Number(inc[`${p}OneOff`]) || 0) + (Number(inc[`${p}Other`]) || 0)
}

export function calculateSeAssessableIncome(inc: any): number {
  const year1 = seYearTotalFF(inc, 1)
  if (inc.seAssessmentMethod === 'One year in isolation') return year1
  if (inc.seAssessmentMethod === "Director's salary") {
    const freq = inc.seDirectorSalaryFrequency
    const salary = Number(inc.seDirectorSalary) || 0
    const mult = freq === 'Weekly' ? 52 : freq === 'Fortnightly' ? 26 : freq === 'Monthly' ? 12 : 1
    return salary * mult
  }
  const year2 = seYearTotalFF(inc, 2)
  if (inc.seGrowthMethod === 'latest_lower') {
    if (year2 < year1) return year2
    return NaN
  }
  if (inc.seGrowthMethod === 'previous_plus_growth') {
    const pct = inc.seGrowthPercentOption === 'Other' ? (Number(inc.seGrowthPercentCustom) || 0) : (Number(inc.seGrowthPercentOption) || 0)
    return year1 * (1 + pct / 100)
  }
  return (year1 + year2) / 2
}
