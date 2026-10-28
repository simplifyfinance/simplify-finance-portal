import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { loanPurpose, purposeWasChosen, sameAsPropertyLabel, LOAN_PURPOSES } from './loan-purpose'
import { factFindFormItems } from './factfind-form-content'
import { factFindSections } from './handover-view'

// NOTHING IS BORN WITH AN ANSWER NOBODY GAVE.
//
// 28 Oct 2026. The documents were fixed first - they now ignore the values a
// record is created with, which fixed every deal already in the book. This is
// the other half, and it is the one that stops the fault coming back:
//
//   Fabio: "I want everything new to stop guessing... when I press that button,
//   there is no guessing. The data comes from the boxes that are on the fact
//   find and the compliance."
//
// A record created from today carries nothing anybody did not type. So there is
// nothing for the NEXT reader to mistake for an answer - an export, a new
// report, a lender integration, a field we have not written yet.
//
// Every name and figure is invented.

const FORM = readFileSync(join(__dirname, '..', 'app', '(app)', 'deals', '[id]', 'FactFindForm.tsx'), 'utf8')

/** The default-record builders, as they appear in the form. */
function defaults(name: string): string {
  const at = FORM.indexOf(`const ${name} = (`)
  expect(at, `${name} is not in the fact find any more`).toBeGreaterThan(-1)
  const open = FORM.indexOf('({', at)
  let depth = 0, i = open + 1
  for (; i < FORM.length; i++) {
    if (FORM[i] === '{') depth++
    else if (FORM[i] === '}' && --depth === 0) break
  }
  return FORM.slice(open, i)
}

describe('A NEW RECORD CARRIES NO ANSWER NOBODY GAVE', () => {
  // Each of these printed on a document as though somebody had chosen it.
  const BANNED: Array<[string, string[]]> = [
    ['defaultEmployment', ['Full time', "employmentType: 'PAYG'"]],
    ['defaultIncome', ['Last 2 financial years', "seGrowthMethod: 'average'", "'2023/24'", "'2024/25'", "seDirectorProfitable: 'Yes'"]],
    ['defaultAsset', ["assetType: 'Savings'"]],
    ['defaultPropertyLoan', ["mortgageType: 'Owner occupied'", "repaymentType: 'Interest only'", "rateType: 'Variable'", "'30'", "status: 'Ongoing'"]],
    ['defaultProperty', ["ownershipType: 'Owner occupied'", "futureUse: 'Ongoing'", "zoning: 'Residential'", 'Fully detached house']],
    ['defaultLiability', ["liabilityType: 'Credit card'", "status: 'Remain open'"]],
  ]

  for (const [name, banned] of BANNED) {
    it(`${name} starts empty`, () => {
      const body = defaults(name)
      for (const guess of banned) {
        expect(body.includes(guess), `${name} is still born carrying ${guess}`).toBe(false)
      }
    })
  }

  it('AND THE BUILDERS ARE STILL THERE AT ALL', () => {
    // A test that cannot find what it is checking passes for ever. If somebody
    // renames these, this fails rather than going quiet.
    for (const [name] of BANNED) expect(defaults(name).length).toBeGreaterThan(40)
  })

  it('but a frequency is still set, because an amount needs one', () => {
    // Deliberately kept. A frequency with no amount beside it prints nothing
    // and is read by nothing; blanking them breaks the maths that reads the
    // pair together.
    expect(defaults('defaultIncome')).toContain("grossSalaryFrequency: 'Annually'")
    expect(defaults('defaultPropertyLoan')).toContain("repaymentFrequency: 'Monthly'")
  })

  it('and the first job is still the primary one, which is structure', () => {
    expect(defaults('defaultEmployment')).toContain("employmentPriority: 'Primary'")
  })
})

describe('WHAT A LOAN IS FOR, PER LOAN', () => {
  // The credit team: "unable to select between INV/OO for each loan which would
  // be ideal." Two loans on one property can be for two different things.
  const investment = { ownershipType: 'Investment' }
  const home = { ownershipType: 'Owner occupied' }

  it('AN OLD LOAN’S "OWNER OCCUPIED" IS NOT A CHOICE', () => {
    // Every loan recorded before 28 Oct 2026 carries mortgageType: 'Owner
    // occupied' because that is what it was born with. Reading it as an answer
    // would send every one of those investment loans straight back to wrong -
    // which is the fault the whole day was spent on.
    expect(loanPurpose(investment, { mortgageType: 'Owner occupied' })).toBe('Investment')
  })

  it('a loan nobody has been asked about follows its property', () => {
    // True of every loan already in the book, so nothing changes on an
    // existing deal until somebody picks.
    expect(loanPurpose(investment, { purpose: '' })).toBe('Investment')
    expect(loanPurpose(home, {})).toBe('Owner occupied')
  })

  it('AND THE LOAN’S OWN ANSWER BEATS THE PROPERTY', () => {
    expect(loanPurpose(investment, { purpose: 'Owner occupied' })).toBe('Owner occupied')
    expect(loanPurpose(home, { purpose: 'Investment' })).toBe('Investment')
  })

  it('two loans on one property can disagree', () => {
    const a = { purpose: 'Investment' }
    const b = { purpose: 'Owner occupied' }
    expect(loanPurpose(investment, a)).not.toBe(loanPurpose(investment, b))
  })

  it('and nobody having said anything anywhere is blank, not a guess', () => {
    expect(loanPurpose({}, {})).toBe('')
  })

  it('it can tell a choice from a silence', () => {
    expect(purposeWasChosen({ purpose: 'Investment' })).toBe(true)
    expect(purposeWasChosen({ purpose: '' })).toBe(false)
    expect(purposeWasChosen({})).toBe(false)
  })

  it('and the blank option on screen says what blank means', () => {
    expect(sameAsPropertyLabel(investment)).toBe('Same as the property (Investment)')
    expect(sameAsPropertyLabel({})).toBe('Same as the property')
  })

  it('the box offers both, and is on the form', () => {
    expect([...LOAN_PURPOSES]).toEqual(['Owner occupied', 'Investment'])
    expect(FORM).toContain('aria-label="Loan purpose"')
    expect(FORM).toContain('sameAsPropertyLabel(prop)')
  })
})

describe('AND EVERY DOCUMENT SAYS THE SAME THING ABOUT IT', () => {
  // Four documents, one function. The fault was never one document being
  // wrong - it was each of them deciding for itself.
  const deal = (loans: any[]) => ({
    fact_find_data: {
      applicants: [{ id: 'a1', firstName: 'Nadia', lastName: 'Okonkwo', addresses: [], employment: [], income: [] }],
      assets: [], liabilities: [],
      properties: [{
        id: 'p1', address: '59 Invented Parade, Nowhere NSW 2000',
        ownershipType: 'Investment', value: '1300000', ownership: { a1: '100' }, loans,
      }],
    },
    bc_data: { template: 'refinance_equity', suburb: 'Nowhere' },
    lo_data: {}, compliance_data: {},
  })

  const sheetOf = (d: any) => JSON.stringify(factFindFormItems({
    factFind: d.fact_find_data, bc: d.bc_data, lo: d.lo_data,
    loanAmount: 893800, lvr: 68.8, toConfirm: [],
  } as any))
  const pageOf = (d: any) => JSON.stringify(factFindSections(d))

  it('an untouched loan on an investment property reads Investment everywhere', () => {
    const d = deal([{ id: 'l1', lenderName: 'Pepper Money', mortgageType: 'Owner occupied', purpose: '', balance: '444600' }])
    for (const [what, text] of [['the sheet', sheetOf(d)], ['the copy page', pageOf(d)]] as const) {
      expect(text.includes('Owner occupied'), `${what} still says Owner occupied`).toBe(false)
      expect(text.includes('Investment'), `${what} lost the purpose`).toBe(true)
    }
  })

  it('AND A LOAN SOMEBODY HAS OVERRIDDEN READS THEIR ANSWER EVERYWHERE', () => {
    const d = deal([{ id: 'l1', lenderName: 'Pepper Money', mortgageType: 'Owner occupied', purpose: 'Owner occupied', balance: '444600' }])
    for (const [what, text] of [['the sheet', sheetOf(d)], ['the copy page', pageOf(d)]] as const) {
      expect(text.includes('Owner occupied'), `${what} ignored the choice somebody made`).toBe(true)
    }
  })

  it('and the documents do not work it out for themselves', () => {
    // A second opinion about this anywhere is how the original fault happened.
    const SHEET = readFileSync(join(__dirname, 'factfind-form-content.ts'), 'utf8')
    const PAGE = readFileSync(join(__dirname, 'handover-view.ts'), 'utf8')
    for (const [what, src] of [['the sheet', SHEET], ['the copy page', PAGE]] as const) {
      expect(src.includes("from './loan-purpose'"), `${what} does not use the shared answer`).toBe(true)
      expect(src.includes('l.mortgageType'), `${what} reads the old box directly`).toBe(false)
      expect(src.includes('l.purpose'), `${what} reads the new box directly`).toBe(false)
    }
  })
})
