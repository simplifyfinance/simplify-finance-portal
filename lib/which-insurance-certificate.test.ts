// Belle, 14 Nov 2026: "lenders will generally only require either building
// insurance or strata, depending on the property type."
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { certificateFor, certificateWhy, STRATA_SUBTYPES } from './which-insurance-certificate'

describe('which certificate', () => {
  it('a house needs building insurance', () => {
    expect(certificateFor('House')).toBe('building')
  })

  it('a unit or a townhouse needs the strata certificate', () => {
    expect(certificateFor('Unit')).toBe('strata')
    expect(certificateFor('Townhouse')).toBe('strata')
  })

  // Fabio, 3 Sep 2026, on land: "nothing at all, ever".
  it('land needs nothing, because there is no building', () => {
    expect(certificateFor('Land')).toBe('none')
  })

  // THE SAFE DIRECTION TO BE WRONG IN. A property type added to the pick list
  // next year asks for a certificate until somebody decides it should not.
  it('anything else asks for building insurance rather than skipping it', () => {
    expect(certificateFor('Commercial')).toBe('building')
    expect(certificateFor('Rural')).toBe('building')
    expect(certificateFor('Houseboat')).toBe('building')
  })

  it('and an unrecorded property type says it is unknown, not that it is fine', () => {
    expect(certificateFor('')).toBe('unknown')
    expect(certificateFor(null)).toBe('unknown')
  })

  it('says why, in English', () => {
    expect(certificateWhy('Unit')).toContain('body corporate insures the building')
    expect(certificateWhy('House')).toBe('The security is a house, not strata')
    expect(certificateWhy('')).toContain('to be safe')
  })
})

// TWO COPIES OF THIS RULE IS HOW A CLIENT GETS ASKED FOR INSURANCE THEY DO NOT
// NEED. document-rules.ts has asked since September; it now asks from here.
describe('one list, not two', () => {
  it('document-rules uses this list rather than its own', () => {
    const rules = readFileSync('lib/document-rules.ts', 'utf8')
    expect(rules).toContain("import { STRATA_SUBTYPES } from './which-insurance-certificate'")
    expect(rules).toContain('const STRATA = STRATA_SUBTYPES')
    expect(rules, 'a second hand-written list would drift')
      .not.toContain("const STRATA = ['Unit', 'Townhouse']")
  })

  it('and the list is what it always was', () => {
    expect(STRATA_SUBTYPES).toEqual(['Unit', 'Townhouse'])
  })
})
