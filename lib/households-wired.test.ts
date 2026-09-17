import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// THE WIRING, not the rules. lib/households.test.ts holds the rules; this checks
// the two screens actually ask them, because a rule nothing calls is a comment.

const ff = readFileSync('app/(app)/deals/[id]/FactFindForm.tsx', 'utf8')
const comp = readFileSync('app/(app)/deals/[id]/ComplianceForm.tsx', 'utf8')

describe('the Fact Find', () => {
  it('offers a household against an applicant', () => {
    expect(ff).toMatch(/updateApplicant\('household'/)
  })

  it('only where there is somebody else and they are not a partner', () => {
    expect(ff).toMatch(/d\.applicants\.length > 1 && !applicant\.relatedToApplicantId/)
  })

  it('asks dependants per household once there is more than one', () => {
    expect(ff).toMatch(/isOneHousehold\(d\) \?/)
    expect(ff).toMatch(/setDependants\(prev, h\.id, e\.target\.value\)/)
  })

  it('still writes the deal total, which nineteen other files read', () => {
    // setDependants returns both, and both are spread in.
    expect(ff).toMatch(/\.\.\.setDependants\(/)
  })

  it('suggests a second household rather than waiting to be asked', () => {
    expect(ff).toMatch(/suggestSecondHousehold\(d\)/)
    expect(ff).toMatch(/They live together/)
  })
})

describe('Compliance living expenses', () => {
  it('reads the household being looked at, not one fixed record', () => {
    expect(comp).toMatch(/const shownExpenses = useMemo\(\(\) => expensesFor\(d, household\)/)
    expect(comp, 'a row is still reading d.expenses directly')
      .not.toMatch(/const entry = d\.expenses\?\.\[cat\.key\]/)
  })

  it('every write goes through the one door', () => {
    for (const fn of ['updateExpense', 'setExpenseHem', 'updateExpenseSplit']) {
      const body = comp.split(`function ${fn}(`)[1]?.split('\n  }')[0] || ''
      expect(body, `${fn} writes expenses without going through patchExpenses`)
        .toMatch(/patchExpenses\(/)
    }
  })

  it('shows one tab per household, and none for a single household', () => {
    expect(comp).toMatch(/\{!oneHousehold && \(/)
    expect(comp).toMatch(/Household \{h\.id\}/)
  })

  it('every tab carries its own count of what is unanswered', () => {
    expect(comp, 'a tab could hide red dots without saying so')
      .toMatch(/to answer/)
  })

  it('shows every household at once, whichever tab is open', () => {
    expect(comp).toMatch(/Every household/)
    expect(comp).toMatch(/the whole application/)
  })

  it('only the people in that household get a percentage column', () => {
    expect(comp).toMatch(/peopleHere\.map\(name =>/)
  })
})
