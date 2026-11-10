// A LIST OF YEARS THAT DOES NOT NEED A SHIP EVERY JULY.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fyLabel, lastEndedFY, financialYears, nextFY } from './financial-years'

const on = (y: number, m: number, d: number) => new Date(y, m - 1, d)

describe('naming a financial year', () => {
  it('names it by the year it ends in', () => {
    expect(fyLabel(2026)).toBe('2025/26')
    expect(fyLabel(2030)).toBe('2029/30')
  })

  // 2000/01, not 2000/1.
  it('keeps the two digits', () => {
    expect(fyLabel(2001)).toBe('2000/01')
  })
})

describe('which one has finished', () => {
  it('turns over on 1 July, not on 1 January', () => {
    expect(lastEndedFY(on(2026, 6, 30))).toBe(2025)
    expect(lastEndedFY(on(2026, 7, 1))).toBe(2026)
    expect(lastEndedFY(on(2027, 3, 31))).toBe(2026)
    expect(lastEndedFY(on(2027, 7, 1))).toBe(2027)
  })
})

describe('the list the form offers', () => {
  // The day Fabio asked for it.
  it('offers 2025/26 in November 2026, without anybody adding it', () => {
    expect(financialYears(on(2026, 11, 10))).toEqual(
      ['2021/22', '2022/23', '2023/24', '2024/25', '2025/26'])
  })

  // The whole point. Nobody ships anything next July.
  it('has moved on by itself a year later', () => {
    expect(financialYears(on(2027, 7, 1))).toEqual(
      ['2022/23', '2023/24', '2024/25', '2025/26', '2026/27'])
  })

  it('never offers a year that has not finished', () => {
    expect(financialYears(on(2026, 11, 10))).not.toContain('2026/27')
  })

  // A deal from 2022 would otherwise show an empty box, and saving the form
  // would then make that true.
  it('keeps whatever the record already holds', () => {
    const list = financialYears(on(2026, 11, 10), 5, ['2019/20'])
    expect(list[0]).toBe('2019/20')
    expect(list).toContain('2025/26')
  })

  it('ignores an answer that is not a financial year', () => {
    expect(financialYears(on(2026, 11, 10), 5, ['', null, 'last year']))
      .toEqual(['2021/22', '2022/23', '2023/24', '2024/25', '2025/26'])
  })
})

describe('the year after', () => {
  it('fills in year 2 from year 1', () => {
    expect(nextFY('2023/24')).toBe('2024/25')
    expect(nextFY('2029/30')).toBe('2030/31')
  })

  it('leaves anything else alone rather than inventing NaN/aN', () => {
    expect(nextFY('')).toBe('')
    expect(nextFY('not a year')).toBe('not a year')
  })
})

describe('and the form reads it rather than keeping a copy', () => {
  // THE GUARD. Four <option> tags typed into the form is exactly what went
  // wrong. A new one fails here rather than next July when somebody cannot
  // record a tax return.
  const FORM = readFileSync('app/(app)/deals/[id]/FactFindForm.tsx', 'utf8')

  it('types no financial year into the fact find', () => {
    expect(FORM).not.toMatch(/<option>\s*\d{4}\/\d{2}\s*<\/option>/)
  })

  it('builds both boxes from this file', () => {
    expect(FORM).toContain("from '@/lib/financial-years'")
    expect(FORM).toContain('financialYears(')
  })
})
