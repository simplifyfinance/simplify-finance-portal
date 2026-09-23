import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  layout, allFields, duplicateFieldNames, offThePage, fieldName, wrap, widthOf,
  radioLineCount, PAGE, MARGIN, LABEL_COL, CONTENT_W, type Item,
} from './assessment-form'
import { assessmentItems, basisOf, maritalOf, previousOf, currentOf, expensesTotal, asNumber } from './assessment-content'

// FABIO'S PERSONAL ASSESSMENT FORM, REBUILT AS A FILLABLE PDF.
//
// 23 Sep 2026: "Like the data I don't like the look - I will drop my current
// version to inspire you." So the paper form is the target, not a new design.
//
// A PDF viewer will happily draw a box half off the page, put two boxes on one
// name, or paint a form widget over the label beside it, and say nothing about
// any of it. All three are checked here.

const CATS = [
  { key: 'groceries', label: 'Groceries' },
  { key: 'transport', label: 'Transport' },
  { key: 'rent', label: 'Rent' },
]

const ff = (o: any = {}) => ({
  applicants: [
    { id: 'a1', firstName: 'Alexis', lastName: 'Janes', dob: '15/04/1980',
      phoneMobile: '0431454157', emailPersonal: 'a@example.com',
      residencyStatus: 'Citizen', relationshipStatus: 'Married',
      addresses: [{ id: '1', address: '22/91 Smith Street', isCurrent: true, residentialStatus: 'mortgage on home', startDate: 'March 2013' }],
      employment: [{ id: '1', employerName: 'Dept of Communities', occupation: 'Court Reporter', employmentBasis: 'Full time', startDate: '2008' }],
      income: [{ id: '1', grossSalary: '129,048' }] },
    { id: 'a2', firstName: '', addresses: [], employment: [], income: [] },
  ],
  properties: [{ id: 'p1', address: '22/91 Smith St', ownershipType: 'Investment', value: '825,000',
    ownership: { a1: '100' },
    loans: [{ id: 'l', lenderName: 'Pepper Money', limitAmount: '566,000', interestRate: '7.21',
              rateType: 'Variable', repaymentType: 'Interest only', interestOnlyExpiryDate: '12.2026' }] }],
  liabilities: [{ id: '1', liabilityType: 'Credit card', lenderName: 'CBA', limitAmount: '1500', ownership: { a1: 'Yes' } }],
  assets: [{ id: '1', assetType: 'Super', value: '200,800', ownership: { a1: 'Yes' } }],
  dependants: 'n/a', loanPurpose: 'Refinance of Investment Properties', internalNotes: 'Directorship on credit file',
  ...o,
})

const build = (o: any = {}) => layout(assessmentItems({ factFind: ff(), expenseCategories: CATS, ...o }))

describe('the form says what your form says', () => {
  const titles = (items: Item[]) => items.filter(i => i.kind === 'band').map((b: any) => b.title)

  it('has the same sections in the same order', () => {
    expect(titles(assessmentItems({ factFind: ff(), expenseCategories: CATS }))).toEqual([
      'How can we help you?', 'Contact details', 'Personal details',
      'Financial position', 'Other assets', 'Other liabilities',
      'Monthly living expenses', 'Notes',
    ])
  })

  it('carries what the portal already holds', () => {
    const f = allFields(build())
    const v = (n: string) => f.find(x => x.name === n)?.value
    expect(v('a1_name')).toBe('Alexis Janes')
    expect(v('a1_dob')).toBe('15/04/1980')
    expect(v('a1_salary')).toBe('129,048')
    expect(v('p1_lender')).toBe('Pepper Money')
    expect(v('a1_cc1_limit')).toBe('1500')
    expect(v('a1_super')).toBe('200,800')
    expect(v('help_purpose')).toBe('Refinance of Investment Properties')
  })

  it('always shows both applicants, even on a single-applicant deal', () => {
    // The paper form always has two columns. A deal with one applicant gets an
    // empty second column to write in, not a missing one.
    const f = allFields(layout(assessmentItems({ factFind: ff({ applicants: [ff().applicants[0]] }), expenseCategories: CATS })))
    expect(f.some(x => x.name === 'a2_name')).toBe(true)
    expect(f.find(x => x.name === 'a2_name')?.value).toBe('')
  })

  it('runs the properties across the page, four to a band', () => {
    const many = ff({ properties: Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, address: `P${i}`, loans: [] })) })
    const f = allFields(layout(assessmentItems({ factFind: many, expenseCategories: CATS })))
    expect(f.some(x => x.name === 'p5_address')).toBe(true)
    expect(f.some(x => x.name === 'p8_address')).toBe(true)  // the band is filled out to four
  })
})

describe('living expenses are a copy of the portal, not the paper', () => {
  it('lists the portal categories it is given', () => {
    const f = allFields(build({ expenses: { groceries: { monthlyAmount: '800' } } }))
    expect(f.find(x => x.name === 'exp_groceries')?.value).toBe('800')
    expect(f.some(x => x.name === 'exp_transport')).toBe(true)
  })

  it('invents no category of its own', () => {
    // The paper form asked for fuel, tolls and coffee, which the portal does
    // not collect. Carrying them here meant two lists that could disagree.
    const names = allFields(build()).map(x => x.name).filter(n => n.startsWith('exp_'))
    expect(names.sort()).toEqual(['exp_groceries', 'exp_rent', 'exp_total', 'exp_transport'])
  })

  it('adds the declared amounts up', () => {
    expect(expensesTotal({ groceries: { monthlyAmount: '800' }, transport: { monthlyAmount: '160.50' } }, CATS))
      .toBe('960.50')
  })

  it('leaves the total blank when nothing was declared', () => {
    // A zero would read as "we checked and it is nought", which is a different
    // claim from "nobody has filled this in".
    expect(expensesTotal({}, CATS)).toBe('')
    expect(expensesTotal(null, CATS)).toBe('')
  })

  it('ignores a figure it cannot read rather than counting it as zero', () => {
    expect(asNumber('1,891.00')).toBe(1891)
    expect(asNumber('about 400')).toBe(null)
    expect(expensesTotal({ groceries: { monthlyAmount: 'lots' }, transport: { monthlyAmount: '100' } }, CATS)).toBe('100.00')
  })
})

describe('the things a viewer will never warn you about', () => {
  it('never gives two boxes the same name', () => {
    const big = ff({
      properties: Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, address: `P${i}`, loans: [{ id: 'l' }] })),
      liabilities: Array.from({ length: 9 }, (_, i) => ({ id: `${i}`, liabilityType: 'Credit card', ownership: { a1: 'Yes' } })),
    })
    expect(duplicateFieldNames(layout(assessmentItems({ factFind: big, expenseCategories: CATS })))).toEqual([])
  })

  it('never draws anything off the paper', () => {
    const big = ff({ properties: Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, address: 'A very long address indeed '.repeat(2), loans: [{ id: 'l' }] })) })
    expect(offThePage(layout(assessmentItems({ factFind: big, expenseCategories: CATS })))).toEqual([])
  })

  it('flattens the dots out of a field name', () => {
    // A DOT IS A FOLDER SEPARATOR IN A PDF, NOT A CHARACTER. "addr.current"
    // makes a box called `current` inside `addr`; "addr.current.since" then
    // needs `current` to be a folder and it is already a box. pdf-lib throws.
    expect(fieldName('a1.addr.current')).toBe('a1_addr_current')
    for (const f of allFields(build())) expect(f.name).not.toContain('.')
  })

  it('puts the dollar sign beside the box, never under it', () => {
    // A form widget is painted over the page, so a $ drawn underneath one
    // simply vanishes.
    const pages = build()
    const money = allFields(pages).find(f => f.name === 'a1_salary')!
    const dollars = pages.flatMap(p => p.texts).filter(t => t.text === '$')
    expect(dollars.some(d => d.x < money.x && money.x - d.x < 12)).toBe(true)
  })
})

describe('questions and choices fit where they are put', () => {
  it('wraps a long question inside the grey column', () => {
    const long = 'ARE YOU AWARE OF ANY FORESEEABLE CIRCUMSTANCES THAT WILL NEGATIVELY IMPACT YOUR FINANCIAL POSITION?'
    for (const line of wrap(long, 6.6, LABEL_COL - 12)) {
      expect(widthOf(line, 6.6)).toBeLessThanOrEqual(LABEL_COL - 12)
    }
  })

  it('knows when four choices will not fit on one line', () => {
    // Full Time / Part Time / Casual / Self Employed spilled into the next
    // applicant's boxes. They drop to a second line and the row grows.
    const halfCol = (CONTENT_W - LABEL_COL) / 2
    expect(radioLineCount(['Full Time', 'Part Time', 'Casual', 'Self Employed'], halfCol)).toBeGreaterThan(1)
    expect(radioLineCount(['Yes', 'No'], halfCol)).toBe(1)
  })

  it('leaves room on the first page for the masthead', () => {
    const pages = build()
    const top = Math.max(...pages[0].fills.map(f => f.y + f.h))
    expect(top).toBeLessThan(PAGE.h - MARGIN.top)
  })
})

describe('reading the fact find', () => {
  it('does not print the current employer as the previous one', () => {
    // A fact find with one job often leaves the "current" flag unset, so the
    // only entry counted as both, and the form printed it twice.
    const one = [{ id: '1', employerName: 'Acme' }]
    expect(currentOf(one)?.employerName).toBe('Acme')
    expect(previousOf(one)).toBeUndefined()
  })

  it('finds the previous one when there is one', () => {
    const two = [{ id: '1', employerName: 'Now', isCurrent: true }, { id: '2', employerName: 'Before' }]
    expect(previousOf(two)?.employerName).toBe('Before')
  })

  it('maps the portal wording onto the four words on the paper', () => {
    expect(basisOf({ employmentBasis: 'Full time' })).toBe('Full Time')
    expect(basisOf({ employmentBasis: 'Casual' })).toBe('Casual')
    expect(basisOf({ employmentType: 'Self employed' })).toBe('Self Employed')
  })

  it('leaves the radios blank rather than guessing', () => {
    // A wrong tick on a form that goes to a lender is worse than a blank one.
    expect(basisOf({ employmentBasis: 'Contract, 3 days' })).toBe('')
    expect(maritalOf({ relationshipStatus: 'Separated' })).toBe('')
    expect(maritalOf({ relationshipStatus: 'De Facto' })).toBe('De facto')
  })

  it('ticks the choice that was recorded', () => {
    const chosen = build().flatMap(p => p.radios).filter(r => r.chosen)
    expect(chosen.some(r => r.name === 'a1_marital' && r.option === 'Married')).toBe(true)
    expect(chosen.some(r => r.name === 'p1_use' && r.option === 'Investment')).toBe(true)
  })
})

describe('when the deal is empty', () => {
  it('still produces the whole form, blank', () => {
    const pages = layout(assessmentItems({ factFind: {}, expenseCategories: CATS }))
    expect(pages.length).toBeGreaterThan(0)
    expect(duplicateFieldNames(pages)).toEqual([])
    expect(offThePage(pages)).toEqual([])
    for (const f of allFields(pages)) expect(f.value).not.toMatch(/undefined|null|NaN/)
  })

  it('does not fall over on a fact find missing its lists', () => {
    const pages = layout(assessmentItems({ factFind: { applicants: null, properties: 'x', liabilities: 7, assets: undefined } as any, expenseCategories: CATS }))
    expect(offThePage(pages)).toEqual([])
  })
})

describe('the pdf itself', () => {
  const route = () => readFileSync(join(__dirname, '..', 'app', 'api', 'generate-assessment-pdf', 'route.ts'), 'utf8')

  it('pins the text size, after the box is on the page', () => {
    const s = route()
    expect(s).toContain('setFontSize(')
    expect(s.indexOf('addToPage')).toBeLessThan(s.indexOf('setFontSize'))
  })

  it('uses the real logo, not the words in a bold typeface', () => {
    // Fabio, 3 Sep 2026: "the logo on the broker submission note PDF is not
    // really the Simplify Finance logo."
    expect(route()).toContain('SIMPLIFY_LOGO_PNG')
  })

  it('takes the expense categories from the portal', () => {
    expect(route()).toContain('EXPENSE_CATEGORIES')
  })

  it('never fails the whole document over one tick', () => {
    const s = route()
    const bit = s.slice(s.indexOf('r.chosen'), s.indexOf('r.chosen') + 160)
    expect(bit).toMatch(/try|catch/)
  })
})

describe('it is reachable from a deal', () => {
  const header = () => readFileSync(join(__dirname, '..', 'app', '(app)', 'deals', '[id]', 'DealPageClient.tsx'), 'utf8')
  const button = () => readFileSync(join(__dirname, '..', 'components', 'AssessmentFormButton.tsx'), 'utf8')

  it('sits in the deal header', () => {
    expect(header()).toContain('<AssessmentFormButton')
  })

  it('sends the fact find, the expenses and the notes', () => {
    const s = button()
    expect(s).toContain('fact_find_data')
    expect(s).toContain('expensesFor(')
    expect(s).toContain('internal_notes')
  })

  it('says so on screen when it cannot be built', () => {
    // A PDF that silently does not arrive looks like a click that did nothing.
    const s = button()
    expect(s).toContain('setErr(')
    expect(s).toMatch(/\{err &&/)
  })
})
