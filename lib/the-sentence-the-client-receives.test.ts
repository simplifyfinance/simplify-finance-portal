import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { incomeEvidenceSentence, evidenceWords, LOW_DOC_BAS, LOW_DOC_LETTER } from './low-doc'
import { incomeBreakdownFor } from './income-calculations'

// THE SENTENCE A LOW DOC CLIENT ACTUALLY RECEIVED.
//
// 30 Oct 2026. Fabio: "on low doc we added BAS and accountant's letter, the BC
// HTML is still showing income as per tax returns."
//
// The words were converted twice. incomeBreakdownFor() puts the EVIDENCE on the
// line - "BAS" - and the email handed that back to a function expecting the
// METHOD. "BAS" is not a method, so it fell through to the fall-back and a
// client who gave us no tax returns was told their income rests on them.
//
// The test that covered it passed the whole time, because it called the
// sentence with a method, which is the one thing the caller never has.

const ROUTE = readFileSync('app/api/generate-email/route.ts', 'utf8')
const FORM = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

const applicant = (method: string) => ({
  firstName: 'Dean',
  income: [{ incomeType: 'Self-employed', employmentId: 'e0', seAssessmentMethod: method }],
})

describe('END TO END, THE WAY THE EMAIL DOES IT', () => {
  const line = (method: string) => incomeBreakdownFor(applicant(method), 'Dean')[0]

  it('a BAS client is told BAS', () => {
    expect(incomeEvidenceSentence(line(LOW_DOC_BAS).evidence)).toBe('Income as per BAS provided')
  })

  it("and an accountant's letter client is told the letter", () => {
    expect(incomeEvidenceSentence(line(LOW_DOC_LETTER).evidence))
      .toBe("Income as per accountant's letter provided")
  })

  it('and a full doc client is told what they have always been told', () => {
    expect(incomeEvidenceSentence(line('Last 2 financial years').evidence))
      .toBe('Income as per tax returns provided')
  })

  it('AND A METHOD NOBODY CHOSE DOES NOT NAME A DOCUMENT WE DO NOT HOLD', () => {
    expect(incomeEvidenceSentence(line('').evidence)).toBe('Income as per tax returns provided')
    expect(incomeEvidenceSentence(undefined)).toBe('Income as per tax returns provided')
  })

  it('and the figure is still never sent', () => {
    expect(line(LOW_DOC_BAS).amount).toBe(null)
  })

  it('and the email passes the evidence, not the method', () => {
    expect(ROUTE).toContain('incomeEvidenceSentence(entry.evidence)')
  })

  it('and the method is turned into words once, on the line', () => {
    expect(evidenceWords(LOW_DOC_BAS)).toBe('BAS')
    expect(incomeBreakdownFor(applicant(LOW_DOC_BAS), 'Dean')[0].evidence).toBe('BAS')
  })
})

describe('AND THE SPLIT NUMBERS STOP SKIPPING ONE', () => {
  // Fabio: "why does it go 1, 2 and then 4? Small but annoying." Split 3 is the
  // loan buying the house, hidden here because the New purchase panel edits it.
  it('the hidden card leaves a strip that says what it is', () => {
    expect(FORM).toContain('edited in the New purchase panel below')
  })

  it('and it keeps the number it had', () => {
    const at = FORM.indexOf('edited in the New purchase panel below')
    expect(FORM.slice(at - 700, at)).toContain('{i + 1}')
  })

  it('AND NOTHING ON IT IS EDITABLE', () => {
    const at = FORM.indexOf('edited in the New purchase panel below')
    const strip = FORM.slice(at - 700, at + 200)
    expect(strip).not.toContain('<input')
    expect(strip).not.toContain('updateSplit')
  })

  it('and the visible cards are not renumbered behind the email', () => {
    // The client email numbers across the whole list. Renumbering here makes
    // the same loan Split 3 on one and Split 4 on the other.
    expect(FORM).toContain('`Split ${i + 1}`')
  })
})
