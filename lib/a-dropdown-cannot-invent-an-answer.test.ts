import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// A DROPDOWN CANNOT INVENT AN ANSWER.
//
// 28 Oct 2026. Ellie Morella: "When I add a liability, it automatically selects
// Credit Card. However, the fields for credit limit, balance, etc. don't
// appear. I have to select Other first, then change it back."
//
// THE BROWSER RULE BEHIND IT. A <select> whose value matches none of its
// options displays THE FIRST ONE. It does not go blank, it does not warn, and
// React does not re-render anything - the DOM simply shows a lie. So once
// defaultLiability() correctly carried liabilityType: '' (the "nothing is born
// with an answer" change of the same week), every new liability SHOWED "Credit
// card" while the record held nothing. The fields underneath are gated on
// === 'Credit card', so none of them drew.
//
// EIGHT DROPDOWNS HAD IT, NOT ONE. Ellie found the only one where the symptom
// is visible - the others quietly showed a confident wrong answer. The worst
// was a property's ownership type, displaying "Owner occupied" on every new
// property: the exact fault the credit team raised on a live file, fixed in the
// documents and still sitting on the screen.
//
// THIS TEST IS THE RULE, not a list of the eight. Empty a default tomorrow and
// forget the blank option, and the ship stops here.

const FORM = readFileSync(join(__dirname, '..', 'app', '(app)', 'deals', '[id]', 'FactFindForm.tsx'), 'utf8')

/** Every field a default* factory sets to the empty string. */
function fieldsDefaultedBlank(src: string): Set<string> {
  const out = new Set<string>()
  const factories = src.match(/const default[A-Za-z]+ = \([^)]*\)[^=]*=> \(\{[\s\S]*?\n\}\)/g) || []
  for (const f of factories) {
    for (const m of f.matchAll(/([A-Za-z][A-Za-z0-9_]*): ''/g)) out.add(m[1])
  }
  return out
}

/** Every <select> in the file, with the field it is bound to and its options. */
function selects(src: string): { field: string; tag: string }[] {
  const out: { field: string; tag: string }[] = []
  for (const m of src.matchAll(/<select\b[\s\S]*?<\/select>/g)) {
    const tag = m[0]
    const v = /value=\{([^}]+)\}/.exec(tag)
    if (!v) continue
    const field = v[1].trim().split('.').pop()!.replace(/[^A-Za-z0-9_]/g, '')
    out.push({ field, tag })
  }
  return out
}

const hasBlank = (tag: string) => /<option value=""/.test(tag)

const BLANK = fieldsDefaultedBlank(FORM)
const SELECTS = selects(FORM)

describe('THE RULE', () => {
  it('finds the form, the defaults and the dropdowns', () => {
    // A regex that quietly matches nothing would make every test below pass.
    expect(FORM.length).toBeGreaterThan(10_000)
    expect(BLANK.size).toBeGreaterThan(5)
    expect(SELECTS.length).toBeGreaterThan(10)
  })

  it('EVERY DROPDOWN BOUND TO A BLANK DEFAULT OFFERS A BLANK OPTION', () => {
    // The whole fault, written once. Without the blank option the control has
    // nothing to show for "nobody has said", so it shows its first entry and
    // the screen states something the record does not.
    const liars = SELECTS
      .filter(s => BLANK.has(s.field) && !hasBlank(s.tag))
      .map(s => s.field)
    expect([...new Set(liars)],
      'these dropdowns will display their first option while the record is empty').toEqual([])
  })
})

describe('THE ONES THAT WERE CAUGHT', () => {
  const tagFor = (field: string) => SELECTS.find(s => s.field === field)?.tag || ''

  it('the liability type, which is the one Ellie reported', () => {
    const tag = tagFor('liabilityType')
    expect(tag).toContain('<option value=""')
    // And the blank comes FIRST, or the browser shows whatever does.
    expect(tag.indexOf('<option value=""')).toBeLessThan(tag.indexOf('Credit card'))
  })

  it('AND THE PROPERTY OWNERSHIP TYPE, WHICH IS THE NADER FAULT', () => {
    // The documents stopped printing "Owner occupied" for a property nobody had
    // classified. The screen went on showing it, for the same reason, for
    // another seven weeks.
    const tag = tagFor('ownershipType')
    expect(tag).toContain('<option value=""')
    expect(tag.indexOf('<option value=""')).toBeLessThan(tag.indexOf('Owner occupied'))
  })

  it('and the other six', () => {
    for (const f of ['employmentBasis', 'zoning', 'repaymentType', 'rateType',
                     'seDirectorProfitable', 'seYear2FY']) {
      expect(tagFor(f), `${f} has no blank option`).toContain('<option value=""')
    }
  })
})

describe('AND THE DEFAULTS STAY EMPTY', () => {
  // The fix is NOT to put the guess back. 28 Oct 2026, Fabio: "I want
  // everything new to stop guessing... when I press that button, there is no
  // guessing." A blank option is how a form says "nobody has said" out loud.
  it('nothing is born holding one of these answers', () => {
    for (const [field, guess] of [
      ['liabilityType', 'Credit card'],
      ['ownershipType', 'Owner occupied'],
      ['employmentBasis', 'Full time'],
      ['rateType', 'Variable'],
      ['repaymentType', 'Interest only'],
    ] as const) {
      expect(FORM, `a default now carries ${guess}`).not.toContain(`${field}: '${guess}'`)
    }
  })

  it('and the frequencies, which are a real default and not a guess', () => {
    // A repayment IS monthly far more often than not, and the figure beside it
    // is meaningless without one. These were never the fault.
    expect(FORM).toContain("repaymentFrequency: 'Monthly'")
    expect(FORM).toContain("grossSalaryFrequency: 'Annually'")
  })
})
