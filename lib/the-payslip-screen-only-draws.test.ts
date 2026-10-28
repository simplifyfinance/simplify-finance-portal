import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// THE PAYSLIP SCREEN DRAWS AND ASKS. IT DOES NOT DECIDE.
//
// 28 Oct 2026. Three tested files hold everything this feature knows:
//
//   lib/annualise-income.ts    the arithmetic and the three-month rule
//   lib/payslip-lines.ts       what each line on a payslip means
//   lib/income-to-fact-find.ts which of the six boxes each figure lands in
//
// A rule that drifts into components/PayslipIncome.tsx is a rule nothing can
// test, nothing downstream can share, and nobody finds again. That is exactly
// how self-employed income sat at $0 for five weeks - see
// no-duplicate-logic.test.ts - and every figure on this screen ends up on a
// lender's servicing sheet.
//
// This is not a style rule. The screen is the one place a number can be changed
// without a single test going red.

const ROOT = join(__dirname, '..')
const SCREEN = readFileSync(join(ROOT, 'components', 'PayslipIncome.tsx'), 'utf8')
const ROUTE = readFileSync(join(ROOT, 'app', 'api', 'read-payslip', 'route.ts'), 'utf8')

describe('the screen keeps its rules in lib', () => {
  it('finds the file at all', () => {
    // A test that silently reads nothing passes for ever and protects nothing.
    expect(SCREEN.length).toBeGreaterThan(2000)
  })

  it('gets the arithmetic from lib/annualise-income', () => {
    expect(SCREEN).toContain("from '@/lib/annualise-income'")
    expect(SCREEN).toContain('assess(')
  })

  it('gets the six boxes from lib/income-to-fact-find', () => {
    expect(SCREEN).toContain("from '@/lib/income-to-fact-find'")
    expect(SCREEN).toContain('toFactFind(')
    expect(SCREEN).toContain('unsettled(')
  })

  it('AND DOES NOT ANNUALISE ANYTHING ITSELF', () => {
    // 365, 366, or a days-in-the-year division appearing here means a second
    // copy of the sum exists, and the two will disagree the first time one of
    // them is fixed.
    expect(SCREEN).not.toMatch(/\b36[56]\b/)
    expect(SCREEN).not.toMatch(/yearDays\s*[*/]/)
  })

  it('and does not hold its own idea of what is shaded', () => {
    // NEVER_SHADED lives in lib/annualise-income.ts and nowhere else. A screen
    // that decides base is unshaded is a screen that can be wrong on its own.
    expect(SCREEN).not.toContain('NEVER_SHADED')
    expect(SCREEN).not.toMatch(/\*\s*rate\b/)
    expect(SCREEN).not.toMatch(/\*\s*0\.8\b/)
  })

  it('and does not classify a payslip line by its name', () => {
    // That is lib/payslip-lines.ts, which has a hundred labels under test. A
    // regex on a label here would be a second opinion nobody knows about.
    expect(SCREEN).not.toMatch(/\.toLowerCase\(\)[\s\S]{0,80}(includes|test)\(['"`](bonus|overtime|commission|allowance|reimburse)/i)
  })
})

describe('the screen never writes to the book', () => {
  it('because the form saves, through the guarded path, the way it always did', () => {
    // A box that saves itself around saveGuarded is how work disappeared in
    // September - see scripts/check-typed-fields.sh. This one hands its figures
    // back to the form and touches nothing.
    expect(SCREEN).not.toContain('supabase')
    expect(SCREEN).not.toContain("from('deals')")
    expect(SCREEN).not.toContain('fact_find_data')
  })

  it('and it hands the figures back rather than applying them', () => {
    expect(SCREEN).toContain('onUse(')
  })
})

describe('the reader and the screen agree about the shape', () => {
  it('both take it from lib/payslip-lines, not from each other', () => {
    // A type exported from a route is a type nothing else can sensibly import,
    // and these two have to agree about every field or the screen quietly shows
    // nothing at all.
    expect(SCREEN).toContain("from '@/lib/payslip-lines'")
    expect(ROUTE).toContain("from '@/lib/payslip-lines'")
    expect(ROUTE).not.toMatch(/export type ReadPayslip\s*=/)
  })
})

describe('ONE HUNDRED AND EIGHTY, AND NO THIRD THING TO DECIDE', () => {
  // Fabio, 28 Oct 2026: "EVERY time we annualise income outside of base income
  // you give my credit team 2 options 80% and 100% SO WE CAN DECIDE you dont
  // need per lender breakdown I was very clear."
  //
  // An earlier version of this screen had a box you could type a percentage
  // into, and I had started talking about per-lender tables and a number in
  // Settings. Both are a third thing to decide on a screen whose whole job is
  // to leave the deciding to a person with a lender in front of them.

  it('there is no control for the percentage', () => {
    expect(SCREEN).not.toMatch(/type="number"/)
    expect(SCREEN).not.toMatch(/ratePct|setRate\b/)
  })

  it('and the heading and the button both say 80, plainly', () => {
    expect(SCREEN).toContain('At 80%')
    expect(SCREEN).toContain('Put the 80% column on the fact find')
  })

  it('and it reads no setting for it', () => {
    expect(SCREEN).not.toContain("from('settings')")
    expect(SCREEN).not.toMatch(/lender_rules|perLender/)
  })
})

describe('the two things the screen must never quietly do', () => {
  it('IT NEVER PICKS A COLUMN', () => {
    // Which figure to use is a credit decision made once a lender is in view,
    // and no lender is known while a fact find is being filled in. Two buttons,
    // both pressed by a person.
    expect(SCREEN).toContain("press('full')")
    expect(SCREEN).toContain("press('shaded')")
    expect(SCREEN).not.toMatch(/useEffect\([\s\S]{0,200}press\(/)
  })

  it('and it never writes a line nobody has placed', () => {
    // There is no box on the fact find for "Site Uplift 7B". The buttons are
    // shut until a person says what it is.
    expect(SCREEN).toMatch(/disabled=\{waiting\.length > 0\}/)
  })
})
