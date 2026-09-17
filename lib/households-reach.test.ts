import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { preflight } from './preflight'
import { EXPENSE_CATEGORIES } from './handover-view'

// EVERYTHING THAT PRINTS OR CHECKS LIVING EXPENSES HAS TO KNOW ABOUT HOUSEHOLDS.
//
// 17 Sep 2026. The screen was done and two things still read household one and
// called it the household: the compliance PDF the credit team reads, and the
// check that warns before a handover goes out. The second is the worse of the
// two - a safety net with a hole in it is trusted.

const deal = (homes: 1 | 2) => ({
  fact_find_data: {
    applicants: homes === 2
      ? [{ firstName: 'Emma', lastName: 'Byrnes' },
         { firstName: 'Joshua', lastName: 'Byrnes', household: '2' }]
      : [{ firstName: 'Emma', lastName: 'Byrnes' }],
  },
})

// Household 1 has answered; household 2 has not.
const compliance = {
  applicants: [{ name: 'Emma Byrnes' }, { name: 'Joshua Byrnes' }],
  expenses: { healthInsurance: { monthlyAmount: '200', hem: 'in', splits: {}, comment: '' },
              primaryResidenceBodyCorp: { monthlyAmount: '0', hem: 'in', splits: {}, comment: '' } },
  expensesByHousehold: {
    '2': { healthInsurance: { monthlyAmount: '150', splits: {}, comment: '' } },
  },
}

const hem = (d: any, c: any) =>
  preflight(d, c, EXPENSE_CATEGORIES).filter(f => f.kind === 'hem')

describe('the check before a handover goes out', () => {
  it('says nothing when the one household has answered', () => {
    expect(hem(deal(1), compliance)).toEqual([])
  })

  it('CATCHES a second household nobody has answered', () => {
    const found = hem(deal(2), compliance)
    expect(found.length, 'household 2 could go to the lender unanswered').toBeGreaterThan(0)
  })

  it('names the household and who is in it', () => {
    const [f] = hem(deal(2), compliance)
    expect(f.issue).toContain('Household 2')
    expect(f.issue).toContain('Joshua Byrnes')
  })

  it('does not name a household on an ordinary deal', () => {
    const one = { ...compliance, expenses: { healthInsurance: { monthlyAmount: '200', splits: {}, comment: '' } } }
    const [f] = hem(deal(1), one)
    expect(f.issue).not.toMatch(/Household/)
  })
})

describe('the compliance PDF', () => {
  const src = readFileSync('app/api/generate-compliance-pdf/route.tsx', 'utf8')

  it('prints a block per household rather than one fixed record', () => {
    expect(src).toMatch(/households\.map\(h => \{/)
    expect(src, 'the PDF is still reading one expenses record').not.toMatch(/const expenses = c\.expenses \|\| \{\}/)
  })

  it('names who lives in each household on the heading', () => {
    expect(src).toMatch(/Living expenses .* Household \$\{h\.id\}/)
    expect(src).toMatch(/dependant/)
  })

  it('adds them up on a block of their own, never inside a household', () => {
    expect(src).toMatch(/Every household together/)
    expect(src).toMatch(/not one household/)
  })

  it('still says just "Living expenses" on an ordinary deal', () => {
    expect(src).toMatch(/: 'Living expenses'/)
    expect(src).toMatch(/: 'household monthly'/)
  })
})
