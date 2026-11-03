import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { answersFrom, answersAsText } from './the-answers-are-in-the-form'

// THE ANSWERS ARE IN THE FORM, NOT ON THE PAGE.
//
// 3 Nov 2026. Fabio, relaying his team: "information not carrying into ONE
// when Fact Find is uploaded. Team is manually updating as the workaround."
//
// The Simplify fact find is a fillable PDF. Everything a client types goes
// into the form layer and the page underneath stays blank. The Cardey fact
// find has 236 boxes and 47 filled: both dates of birth, the address,
// residency, the employer, the NAB, FLEXI and Latitude cards, the car loan,
// the $1.2M property, uBank, the 50/50 ownership.
//
// Ask that file for its text - which is what reading a PDF normally means -
// and not one of those values comes back. Not "Elizabeth", not "KALINGA", not
// "NAB". Only the printed questions.
//
// So the importer was reading the questions and never the answers, and could
// only see an answer at all as pixels in a picture of the page. That is why a
// couple of obvious things at the top came through and three pages of detail
// did not. Nothing was broken. It was looking in the wrong layer.

describe('AN EMPTY BOX IS NOT AN ANSWER', () => {
  it('189 of the 236 on that fact find are blank, and they are left out', () => {
    expect(answersFrom([
      { name: 'Mobile', value: '+61455783960' },
      { name: 'Mobile_2', value: '' },
      { name: 'Email', value: '   ' },
      { name: 'Nothing', value: null },
    ])).toEqual([{ field: 'Mobile', value: '+61455783960' }])
  })

  it('and a box with no name is nobody’s answer', () => {
    expect(answersFrom([{ name: '', value: 'orphan' }])).toEqual([])
  })

  it('and typed spaces are trimmed, because every value on that form has them', () => {
    expect(answersFrom([{ name: 'Applicant 1', value: 'Elizabeth Cardey ' }]))
      .toEqual([{ field: 'Applicant 1', value: 'Elizabeth Cardey' }])
  })
})

describe('A TICKED BOX ANSWERS WITH ITS OWN NAME', () => {
  it('said plainly, not as the editor stored it', () => {
    expect(answersFrom([{ name: 'Applicant 1_2', value: '/Married', ticked: true }]))
      .toEqual([{ field: 'Applicant 1_2', value: 'Married' }])
  })

  it('AND THE NUMBER THAT KEEPS IT UNIQUE ON THE PAGE COMES OFF', () => {
    // "Married_2" in a list of answers reads like a mistake and invites the
    // reader to discount it.
    expect(answersFrom([{ name: 'Applicant 2 status', value: 'Married_2', ticked: true }]))
      .toEqual([{ field: 'Applicant 2 status', value: 'Married' }])
  })

  it('AND A TYPED ANSWER KEEPS ITS NUMBER', () => {
    // The whole reason the strip is only for ticked boxes. "Unit 2" is not
    // "Unit", and a client who typed one would have it quietly changed.
    expect(answersFrom([{ name: 'Address', value: 'Unit_2', ticked: false }]))
      .toEqual([{ field: 'Address', value: 'Unit_2' }])
  })

  it('and an unticked box is nothing at all', () => {
    expect(answersFrom([{ name: 'Single', value: '/Off', ticked: true }])).toEqual([])
    expect(answersFrom([{ name: 'Single', value: 'Off', ticked: true }])).toEqual([])
  })
})

describe('AND WHAT GOES IN FRONT OF THE MODEL', () => {
  it('one line per answer, in the order the form puts them', () => {
    // The field names on this form are whatever a PDF editor left behind -
    // 'undefined_4', 'Since_2', 'fill_62 2' - so the ORDER is most of what
    // says which question an answer belongs to.
    expect(answersAsText([
      { field: 'CURRENT RESIDENTIAL ADDRESS', value: '13 KALINGA ROAD, OCEAN GROVE VIC 3226' },
      { field: 'Since', value: '01/10/2014' },
    ])).toBe('CURRENT RESIDENTIAL ADDRESS: 13 KALINGA ROAD, OCEAN GROVE VIC 3226\nSince: 01/10/2014')
  })

  it('AND A FACT FIND WITH NO FORM LAYER SAYS NOTHING RATHER THAN NOTHING-SHAPED', () => {
    // A scan still goes through as a picture, exactly as it always did.
    expect(answersAsText([])).toBe('')
  })
})

describe('AND THE ROUTE USES IT', () => {
  const ROUTE = readFileSync('app/api/extract-fact-find/route.ts', 'utf8')

  it('the typed answers are read and sent', () => {
    expect(ROUTE).toContain('readPdfFormAnswers(pdfBase64)')
    expect(ROUTE).toContain('ANSWERS TYPED INTO THE FORM')
  })

  it('AND THE PICTURE IS STILL SENT TOO', () => {
    // The field names say nothing on their own about which question an answer
    // belongs to. The pages are what give them meaning.
    expect(ROUTE).toContain("type: 'document'")
  })

  it('AND A LONG FACT FIND FITS IN THE ANSWER', () => {
    // 4,000 tokens was not enough for two applicants with a page of
    // liabilities - and past the cap the whole upload failed, so the fact find
    // most worth importing was the one most likely to come back with nothing.
    expect(ROUTE).toContain('max_tokens: 16000')
  })

  it('AND A CUT-OFF ANSWER SAYS SO INSTEAD OF LOOKING BROKEN', () => {
    expect(ROUTE).toContain("response.stop_reason === 'max_tokens'")
    expect(ROUTE).toContain('Nothing has been changed on the deal')
  })
})

describe('AND THE REVIEW BOX KEEPS WHAT IT WAS GIVEN', () => {
  const FF = readFileSync('app/(app)/deals/[id]/FactFindForm.tsx', 'utf8')

  it('a stray click on the backdrop no longer throws the extraction away', () => {
    expect(FF).not.toContain('z-50" onClick={() => setShowExtractReview(false)}')
  })

  it('and it says how many answers came off the form', () => {
    expect(FF).toContain('typed answers read straight out of the form')
  })

  it('AND SAYS WHEN NONE DID, WHICH IS A DIFFERENT THING FROM A BLANK FORM', () => {
    expect(FF).toContain('it is a scan or a flattened PDF')
  })
})
