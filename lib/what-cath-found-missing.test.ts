import { describe, it, expect } from 'vitest'
import { legalName, dependantsLine, fullName } from './fact-find'
import { factFindFormItems } from './factfind-form-content'
import { assessmentItems } from './assessment-content'

// THREE FIELDS TYPED HUNDREDS OF TIMES AND PRINTED NOWHERE.
//
// 26 Nov 2026. Cath, working her way through a compliance file by hand:
//
//   "I noticed a few fields in ONE that don't seem to carry over to the
//    generated Fact Find form... Even when the Credit Managers complete these
//    fields in ONE, the information doesn't appear in the generated Fact Find."
//
// She was right about every one of them, and the database said how right:
//
//   middle name      typed on 185 of 311 deals   shown on nothing, ever
//   citizenship      typed on 208 of 311 deals   on the assessment form only
//   dependant ages   typed on  62 deals          shown on nothing, ever
//
// WORSE THAN MISSING, IN ONE PLACE. The Personal Assessment Form carried a row
// labelled "Ages of dependants" that printed the COUNT. Three dependants read
// as though they were all aged three. A wrong answer on a form a client signs
// is not the same kind of fault as a blank one.
//
// This file exists because nobody found these by testing. They were found by a
// person reading a document, which is the slowest and most expensive way there
// is, and the fields had been dropped for months before anybody looked.

const FF = {
  dependants: '3',
  dependantAges: ['4', '7', '11'],
  applicants: [{
    id: 'a1', title: 'Mrs', firstName: 'Sarah', middleName: 'Anne', lastName: 'Mitchell',
    dob: '1984-03-02', gender: 'Female', residencyStatus: 'Permanent resident',
    phoneMobile: '0400 000 000', emailPersonal: 'sarah@example.com',
  }],
}

const textOf = (items: any[]) => JSON.stringify(items)

describe('the name on a form is the whole legal name', () => {
  it('legalName carries the middle name', () => {
    expect(legalName(FF.applicants[0])).toBe('Sarah Anne Mitchell')
  })

  it('and a missing middle name changes nothing', () => {
    expect(legalName({ firstName: 'Sarah', lastName: 'Mitchell' })).toBe('Sarah Mitchell')
    expect(legalName({ firstName: 'Sarah', middleName: '  ', lastName: 'Mitchell' }))
      .toBe('Sarah Mitchell')
  })

  // THE DELIBERATE HALF. fullName() is used in about twenty places and most of
  // them are sentences - the compliance narrative, the chase list, handover
  // headings. A middle name belongs in an identity box, not in prose, and
  // widening fullName() would have put it in all twenty.
  it('but the name used in SENTENCES is left alone on purpose', () => {
    expect(fullName(FF.applicants[0])).toBe('Sarah Mitchell')
  })
})

describe('how many dependants, and how old', () => {
  it('prints both', () => {
    expect(dependantsLine(FF)).toBe('3 - aged 4, 7, 11')
  })

  it('still prints the count when no ages were typed', () => {
    expect(dependantsLine({ dependants: '2' })).toBe('2')
    expect(dependantsLine({ dependants: '2', dependantAges: [] })).toBe('2')
  })

  // A count of 3 with two ages typed is a QUESTION somebody should be asked.
  // This does not tidy it away by dropping one of them.
  it('and shows a count and its ages disagreeing rather than hiding it', () => {
    expect(dependantsLine({ dependants: '3', dependantAges: ['4', '7'] }))
      .toBe('3 - aged 4, 7')
  })

  it('nothing at all stays nothing - no empty row on the document', () => {
    expect(dependantsLine({})).toBe('')
    expect(dependantsLine(undefined)).toBe('')
  })
})

describe('THE GENERATED FACT FIND NOW CARRIES ALL THREE', () => {
  const items = factFindFormItems({
    factFind: FF, bc: {}, lo: {}, loanAmount: null, lvr: null, toConfirm: [],
  })
  const out = textOf(items)

  it('the middle name', () => {
    expect(out).toContain('Sarah Anne Mitchell')
  })

  it('citizenship, which had no row on this document at all', () => {
    expect(out).toContain('Citizenship')
    expect(out).toContain('Permanent resident')
  })

  it('and the ages, not just the count', () => {
    expect(out).toContain('3 - aged 4, 7, 11')
  })
})

describe('AND SO DOES THE PERSONAL ASSESSMENT FORM', () => {
  const out = textOf(assessmentItems({
    factFind: FF, bc: {}, lo: {}, loanAmount: null, lvr: null, toConfirm: [],
  } as any))

  it('the middle name is in the name box', () => {
    expect(out).toContain('Sarah Anne Mitchell')
  })

  it('and the row labelled "Ages of dependants" prints ages', () => {
    // It printed the count. For months. On a form a client signs.
    expect(out).toContain('Ages of dependants')
    expect(out).toContain('3 - aged 4, 7, 11')
  })
})
