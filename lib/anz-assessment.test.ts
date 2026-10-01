import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  isAnz, lenderFor, showAnzAssessmentButton, assessmentSubject, assessmentMailto,
  ANZ_ASSESSMENT_TO,
} from './anz-assessment'

// THE EMAIL TO ANZ'S ASSESSMENT TEAM.
//
// Fabio, 1 Oct 2026: "it opens an email subject line is the loan id and it goes
// to assessmentmail@anz.com". ANZ only for now.

const anzDeal = {
  lender_reference: 'ANZ-99123456',
  lo_data: { recommendedLender: 'ANZ' },
}

describe('only on an ANZ deal', () => {
  it('shows on one', () => {
    expect(isAnz('ANZ')).toBe(true)
    expect(isAnz('anz')).toBe(true)
    expect(showAnzAssessmentButton(anzDeal)).toBe(true)
  })

  // A NEAR MISS WOULD EMAIL ANZ ABOUT SOMEBODY ELSE'S APPLICATION. Same rule
  // lib/lender-id.ts holds to: an exact name or nothing.
  it('and on nothing else, however close the name', () => {
    for (const name of ['', 'ANZ Bank New Zealand', 'Banz', 'Macquarie', 'ubank']) {
      expect(isAnz(name), `${name} matched ANZ`).toBe(false)
    }
    expect(showAnzAssessmentButton({ lo_data: { recommendedLender: 'Macquarie' } })).toBe(false)
    expect(showAnzAssessmentButton({})).toBe(false)
  })

  // THE LENDER THE DEAL IS ON, NOT THE ONE RECOMMENDED. The fault that had
  // Lucy Ilbery's deal reading Macquarie after the clients chose ubank.
  it('follows the client\'s own choice where they made one', () => {
    const chose = { lo_data: { recommendedLender: 'Macquarie',
                               clientAgreedLender: 'No', clientChosenLender: 'ANZ' } }
    expect(lenderFor(chose)).toBe('ANZ')
    expect(showAnzAssessmentButton(chose)).toBe(true)

    const away = { lo_data: { recommendedLender: 'ANZ',
                              clientAgreedLender: 'No', clientChosenLender: 'Macquarie' } }
    expect(showAnzAssessmentButton(away)).toBe(false)
  })
})

describe('what the email opens as', () => {
  it('goes to the assessment team with the reference in the subject', () => {
    expect(ANZ_ASSESSMENT_TO).toBe('assessmentmail@anz.com')
    expect(assessmentSubject(anzDeal)).toBe('ANZ-99123456')
    expect(assessmentMailto(anzDeal)).toBe('mailto:assessmentmail@anz.com?subject=ANZ-99123456')
  })

  // AN EMPTY SUBJECT, NEVER AN INVENTED ONE. An assessor searching for a
  // reference finds nothing either way, and a wrong subject is the one they
  // would act on.
  it('leaves the subject out when nobody has recorded the reference', () => {
    expect(assessmentMailto({ lo_data: { recommendedLender: 'ANZ' } }))
      .toBe('mailto:assessmentmail@anz.com')
  })

  it('and escapes a reference with spaces in it', () => {
    expect(assessmentMailto({ ...anzDeal, lender_reference: 'APP 123 456' }))
      .toBe('mailto:assessmentmail@anz.com?subject=APP%20123%20456')
  })
})

describe('where it sits', () => {
  const page = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')

  // ABOVE THE TABS AND OUTSIDE THE LOCK. Writing to an assessor is what you do
  // while a deal sits with the lender, which is exactly when the tabs below are
  // read only. Same reason the documents and the client emails live up there.
  it('above the tabs, outside the lock', () => {
    expect(page).toContain('<AnzAssessmentEmail')
    const button = page.indexOf('<AnzAssessmentEmail')
    const lock = page.indexOf('<TabLock')
    expect(button).toBeGreaterThan(-1)
    expect(lock).toBeGreaterThan(-1)
    expect(button, 'the ANZ button is inside the lock').toBeLessThan(lock)
  })
})

describe('the box the team has to fill in', () => {
  const panel = readFileSync('app/(app)/deals/[id]/DealSettlement.tsx', 'utf8')

  // A COMMENT EXPLAINING A RULE IS NOT A BREACH OF IT. The note above the label
  // quotes the old wording to say why it changed, and the first version of this
  // test read its own explanation as the bug. Same trap the email HTML gate was
  // caught by twice. Comments out, then check.
  const rendered = panel.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '')

  // IT IS CALLED WHAT THE TEAM CALLS IT. The column is lender_reference and the
  // label used to read "reference for this application" - the same thing in
  // words nobody here uses, so nobody could find the box.
  it('is labelled Application ID on screen', () => {
    expect(rendered).toContain('Application ID')
    expect(rendered).not.toContain('reference for this application')
  })

  // And the column keeps its name. Renaming that means migrating live data to
  // fix a word nobody outside the code sees.
  it('while the column it writes to is untouched', () => {
    expect(panel).toContain('patch.lender_reference = lenderRef.trim()')
  })
})
