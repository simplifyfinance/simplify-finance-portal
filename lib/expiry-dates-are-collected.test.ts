import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// THE TWO DATES THAT RING THE CLIENT FOR YOU.
//
// Every other field on a client's profile tells you WHO to call. These two tell
// you WHEN: the day a fixed rate ends, and the day an interest-only period ends.
// A book without them can be searched but never acted on.
//
// The interest-only date has been collected since the fact find was written. The
// fixed rate expiry never was - the form recorded that a loan was fixed and not
// when it stops being fixed, so a fixed loan could be found and never chased.
//
// 22 Sep 2026, Fabio: "agree go on fact find now fixed rate expiry and
// interest-only expiry, as dates."

const ff = readFileSync('app/(app)/deals/[id]/FactFindForm.tsx', 'utf8')

describe('a loan against a property records when its terms run out', () => {
  it('the fixed rate expiry is part of a loan', () => {
    expect(ff, 'PropertyLoan has no fixed rate expiry').toMatch(/fixedRateExpiryDate: string/)
    expect(ff, 'a new loan does not start with the field').toMatch(/fixedRateExpiryDate: ''/)
  })

  it('it can be typed in, and only on a fixed loan', () => {
    expect(ff, 'there is no box to type it into')
      .toContain("updatePropertyLoan(prop.id, loan.id, 'fixedRateExpiryDate', e.target.value)")
    // On a variable loan there is no such date, and an empty box invites
    // somebody to invent one.
    expect(ff, 'the box is shown on variable loans too')
      .toContain("loan.rateType === 'Fixed' &&")
  })

  it('both dates are named on screen', () => {
    // A date input cannot show a placeholder, so without a label these are two
    // unexplained boxes. The interest-only one was exactly that for months.
    expect(ff).toContain('Fixed rate expires')
    expect(ff).toContain('Interest only expires')
  })
})

describe('the documents that print a loan print both dates', () => {
  it('the handover shows the fixed rate expiry', () => {
    const src = readFileSync('lib/handover-view.ts', 'utf8')
    expect(src, 'the handover prints the interest-only date and not the fixed one')
      .toContain("['Fixed rate expires', dateAU(l.fixedRateExpiryDate)]")
  })

  // 24 Sep 2026: the fact find PDF became a fillable form and its rows moved to
  // lib/factfind-form-content.ts. Same two dates, one box each.
  it('the fact find form shows both expiry dates, each in its own box', () => {
    const src = readFileSync('lib/factfind-form-content.ts', 'utf8')
    expect(src).toContain("'fixed rate expires'")
    expect(src).toContain('fixedRateExpiryDate')
    expect(src).toContain("'interest only expires'")
    expect(src).toContain('interestOnlyExpiryDate')
  })
})
