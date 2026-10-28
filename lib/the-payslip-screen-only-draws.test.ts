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

describe('TWO METHODS, ONE SHAPE OUT', () => {
  // 28 Oct 2026. The reader was built on the rule that each line carries its
  // own year to date. Two real payslips - a central bank and a state health
  // service - print full detail for the fortnight and ONE combined gross for
  // the year. The first version refused both, which made the feature useless
  // on the normal case.
  //
  // Fabio: "if each line has a year to date, you're going to do it one way. If
  // each line doesn't... you're going to annualize the income, exclude the base
  // salary, and then mark everything as non-base. But you're still going to
  // show, if I shade it for 80%, that's the income."

  it('the screen picks the method and lib does both', () => {
    expect(SCREEN).toContain("from '@/lib/combined-ytd'")
    expect(SCREEN).toContain('assessCombined({')
    expect(SCREEN).toContain('assess({')
  })

  it('AND IT STILL DOES NO ARITHMETIC OF ITS OWN', () => {
    // Turning a rate into a year is maths. Even the annual case goes through
    // lib, or a stray rounding appears in one path and not the other.
    expect(SCREEN).toContain('annualFromRate({')
    expect(SCREEN).not.toMatch(/\*\s*52\b|\*\s*26\b|\*\s*12\b/)
    // Rounding for DISPLAY is fine and unavoidable - $104,948.07 on a screen
    // is noise. Rounding anywhere else is a calculation, and calculations
    // belong in lib where they are tested. So: exactly one, in the formatter.
    const rounds = SCREEN.split('\n').filter(l => l.includes('Math.round'))
    expect(rounds, `Math.round outside the money formatter:\n${rounds.join('\n')}`).toHaveLength(1)
    expect(rounds[0]).toContain("const money =")
  })

  it('the base is always on screen and always editable', () => {
    // It is the one fact the combined method cannot do without. A figure a
    // credit assessor cannot see is a figure they cannot check.
    expect(SCREEN).toContain('aria-label="Base rate"')
    expect(SCREEN).toContain('aria-label="Base rate period"')
  })

  it('and it says so plainly when the payslip prints no base rate', () => {
    // 28 Oct 2026. Shortened with the rest of that box - the explanation was
    // right and nobody needed four lines of it on every file.
    expect(SCREEN).toContain('No base rate printed')
  })

  it('A COMBINED PAYSLIP IS NO LONGER A DEAD END', () => {
    // It used to say "ask for a payslip that shows year to date per line, or
    // type the six boxes by hand" and stop.
    expect(SCREEN).not.toMatch(/Ask for a payslip that shows year to date per line/)
    expect(SCREEN).toContain('One year to date, base taken off')
  })
})

describe('THE MATHS IS SHOWN EVERY TIME', () => {
  // Fabio: "I want you to explain to credit how you got to that figure and
  // show the maths every time."
  it('the working is drawn, on both methods', () => {
    expect(SCREEN).toContain('a.working.map')
  })

  // 28 Oct 2026. Fabio, seeing it on a real payslip: "its a mess so much
  // information". Eight steps in the middle of the screen on every file is
  // what made it one. It is folded, not gone.
  it('AND IT IS FOLDED, NOT REMOVED', () => {
    expect(SCREEN).toContain('Show the working')
    expect(SCREEN).toContain('Hide the working')
    expect(SCREEN).toContain('showWorking')
  })

  it('and a column of noughts is not printed where no figure exists', () => {
    // On the combined method the payslip never gave a year to date per line,
    // so that column read $0 on every row - which says the opposite of true.
    expect(SCREEN).toMatch(/\{!noBreakdown && <th[\s\S]{0,120}Year to date/)
  })

  it('and the screen does not write the explanation itself', () => {
    // It comes from the same function that did the sum, so it cannot describe
    // a calculation the portal did not do.
    expect(SCREEN).not.toMatch(/÷[\s\S]{0,40}× 365/)
  })

  it('and it names which method produced the figures', () => {
    expect(SCREEN).toContain('A year to date on every line')
  })
})

describe('THE WORKING SURVIVES LOOKING AWAY', () => {
  // 28 Oct 2026. Fabio: "it's not saving the figure. So if I drop payslip, it
  // calculates... every time I change the pages and I go back, it disappears."
  //
  // And, asked whether it should only save once somebody commits the figures:
  // "Even if I don't press the button... I still need the calculations to sit
  // there. I don't want this to be like, oh, you have to force people to do
  // things. The calculations are always there."

  it('it starts from what was read last time', () => {
    expect(SCREEN).toContain('saved?.slips')
    expect(SCREEN).toContain('saved?.baseTyped')
    expect(SCREEN).toContain('saved?.essential')
    expect(SCREEN).toContain('saved?.overrides')
  })

  it('AND IT SAVES ON READING, NOT ON PRESSING A BUTTON', () => {
    // The whole point. Nobody is forced to commit figures to keep their work.
    expect(SCREEN).toMatch(/useEffect\([\s\S]{0,600}onRead\(\{/)
  })

  it('and what it saves is the reading, never the totals', () => {
    // A stored total is a second answer that cannot be corrected: fix a
    // rounding next month and every figure already in a record keeps the old
    // one, with nothing on screen to say which is which.
    expect(SCREEN).toMatch(/onRead\(\{ slips, baseTyped, basisTyped, essential, overrides/)
    expect(SCREEN).not.toMatch(/onRead\(\{[^}]*totals/)
  })

  it('and the drop zone asks for one payslip, not two', () => {
    // Fabio: "just say, please drop the latest payslip available. No need to
    // upload more than one." The latest year to date already covers the
    // earlier, so a second one adds nothing to the maths.
    expect(SCREEN).toContain('Drop the latest payslip')
    expect(SCREEN).toContain('No need to upload more than one')
  })

  it('and it still says the payslip is not kept', () => {
    expect(SCREEN).toContain('not stored')
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
