import { describe, it, expect } from 'vitest'
import { evidenceWords, incomeEvidenceSentence, DIRECTORS_SALARY } from './low-doc'
import { incomeBreakdownFor } from './income-calculations'

// A DIRECTOR'S SALARY IS NOT READ OFF A TAX RETURN.
//
// 3 Nov 2026. Fabio sent a BC email with two self-employed lines on it:
//
//   Mai — Self-employed income: Income as per tax returns provided
//   Mai — Self-employed income: Income as per tax returns provided
//
// Word for word identical, and both wrong. On the fact find they are two
// different companies - KAKA Enterprises and Asteria Holdings - each assessed
// on the director's salary, with the salary typed in and annualised on screen.
//
// TWO FAULTS, ONE SENTENCE.
//
// The evidence. A director's salary is a salary the company pays. The portal
// already says so everywhere else: the compliance note for this very method
// reads "Payslips and an ATO income statement have been obtained to verify
// this position". The client's email was the one place still naming a document
// nobody had looked at.
//
// And the business. The fact find knows which company each line is for - the
// income is linked to an employer and the form prints its name above the
// assessment method - and the email threw it away, so a client was sent the
// same sentence twice with nothing to tell the two apart.

const twoCompanies = {
  employment: [
    { id: 'e1', employerName: 'KAKA ENTERPRISES PTY LTD' },
    { id: 'e2', employerName: 'ASTERIA HOLDINGS PTY LTD' },
  ],
  income: [
    { incomeType: 'Self-employed', employmentId: 'e1', seAssessmentMethod: DIRECTORS_SALARY },
    { incomeType: 'Self-employed', employmentId: 'e2', seAssessmentMethod: 'Last 2 financial years' },
  ],
}

describe('WHAT THE FIGURE RESTS ON', () => {
  it("a director's salary rests on payslips", () => {
    expect(evidenceWords(DIRECTORS_SALARY)).toBe('payslips')
    expect(incomeEvidenceSentence(evidenceWords(DIRECTORS_SALARY)))
      .toBe('Income as per payslips provided')
  })

  it('and every other full doc method still rests on tax returns', () => {
    expect(evidenceWords('Last 2 financial years')).toBe('tax returns')
    expect(evidenceWords('One year in isolation')).toBe('tax returns')
    expect(evidenceWords('')).toBe('tax returns')
    expect(evidenceWords(undefined)).toBe('tax returns')
  })

  it('AND LOW DOC IS UNTOUCHED', () => {
    // 29 Oct 2026, and it still holds.
    expect(evidenceWords('Low doc — BAS')).toBe('BAS')
    expect(evidenceWords("Low doc — accountant's letter")).toBe("accountant's letter")
  })
})

describe('AND WHICH BUSINESS IT IS', () => {
  const lines = incomeBreakdownFor(twoCompanies, 'Mai')

  it('the two lines can be told apart', () => {
    expect(lines).toHaveLength(2)
    expect(lines[0].label).toBe('Mai — Self-employed income — KAKA ENTERPRISES PTY LTD')
    expect(lines[1].label).toBe('Mai — Self-employed income — ASTERIA HOLDINGS PTY LTD')
  })

  it('AND EACH SAYS WHAT ITS OWN FIGURE RESTS ON', () => {
    expect(incomeEvidenceSentence(lines[0].evidence)).toBe('Income as per payslips provided')
    expect(incomeEvidenceSentence(lines[1].evidence)).toBe('Income as per tax returns provided')
  })

  it('AND THE FIGURE IS STILL NEVER SENT', () => {
    // Older than any of this and it does not bend: the sentence names the
    // evidence, never the amount.
    for (const l of lines) expect(l.amount).toBe(null)
  })

  it('and an income linked to nothing reads as it always did', () => {
    // Naming a business we have not been given would be worse than not naming
    // one at all.
    const unlinked = incomeBreakdownFor(
      { employment: [], income: [{ incomeType: 'Self-employed', seAssessmentMethod: DIRECTORS_SALARY }] },
      'Mai')
    expect(unlinked[0].label).toBe('Mai — Self-employed income')
  })

  it('and a link to an employer with no name does not leave a dangling dash', () => {
    const blank = incomeBreakdownFor(
      { employment: [{ id: 'e1', employerName: '  ' }],
        income: [{ incomeType: 'Self-employed', employmentId: 'e1' }] },
      'Mai')
    expect(blank[0].label).toBe('Mai — Self-employed income')
  })

  it('AND A PAYG LINE IS NOT TOUCHED BY ANY OF THIS', () => {
    const payg = incomeBreakdownFor(
      { employment: [{ id: 'e1', employerName: 'Someone Pty Ltd' }],
        income: [{ incomeType: 'PAYG', employmentId: 'e1',
                   grossSalary: '120000', grossSalaryFrequency: 'Annually' }] },
      'Mai')
    expect(payg[0].label).toBe('Mai — PAYG income')
    expect(payg[0].amount).toBe(120000)
  })
})
