import { describe, it, expect } from 'vitest'
import { creditHistoryFacts, creditHistoryBlock, CREDIT_QUESTIONS } from './credit-history-facts'

const clean = { problemsMeetingCommitments: 'No', officerInLiquidation: 'No',
                unsatisfiedJudgements: 'No', simultaneousApplications: 'No', declaredBankrupt: 'No' }
const ONE = [{ name: 'Rachel Fielding' }]
const TWO = [{ name: 'Rachel Fielding' }, { name: 'Daniel Fielding' }]

describe('it asks the five questions the Risks tab actually asks', () => {
  it('names them, in the order they appear on screen', () => {
    expect(CREDIT_QUESTIONS.map(q => q.key)).toEqual([
      'problemsMeetingCommitments', 'officerInLiquidation', 'unsatisfiedJudgements',
      'simultaneousApplications', 'declaredBankrupt'])
  })

  it('does not ask the two nothing records', () => {
    // creditImpairment and creditEnquiries are printed by the handover and the
    // compliance PDF, and written by no form in the portal.
    expect(CREDIT_QUESTIONS.map(q => q.key)).not.toContain('creditImpairment')
    expect(CREDIT_QUESTIONS.map(q => q.key)).not.toContain('creditEnquiries')
  })
})

describe('a clean history has to be earned', () => {
  it('is clear when every question is answered No for everybody', () => {
    const h = creditHistoryFacts({ 'Rachel Fielding': clean, 'Daniel Fielding': clean }, TWO)
    expect(h.allClear).toBe(true)
    expect(creditHistoryBlock(h)).toMatch(/a clean history may be stated/)
  })

  it('is not clear when one applicant is unanswered', () => {
    const h = creditHistoryFacts({ 'Rachel Fielding': clean }, TWO)
    expect(h.allClear).toBe(false)
    expect(creditHistoryBlock(h)).toMatch(/do not call the history clean/)
    expect(h.lines[1]).toMatch(/not answered/)
  })

  it('is not clear when one question is unanswered', () => {
    const partial = { ...clean } as any; delete partial.declaredBankrupt
    expect(creditHistoryFacts({ 'Rachel Fielding': partial }, ONE).allClear).toBe(false)
  })

  it('is not clear on a Yes', () => {
    const h = creditHistoryFacts({ 'Rachel Fielding': { ...clean, unsatisfiedJudgements: 'Yes' } }, ONE)
    expect(h.allClear).toBe(false)
    expect(h.lines[0]).toContain('Unsatisfied judgements in court: Yes')
  })

  it('is not clear on a discharged bankruptcy, which is a Yes', () => {
    const h = creditHistoryFacts({ 'Rachel Fielding': { ...clean, declaredBankrupt: 'Yes discharged' } }, ONE)
    expect(h.allClear).toBe(false)
    expect(h.lines[0]).toContain('Ever declared bankrupt: Yes discharged')
  })
})

describe('silence is reported as silence', () => {
  it('says nothing is recorded rather than inferring a clean file', () => {
    const b = creditHistoryBlock(creditHistoryFacts({}, TWO))
    expect(b).toMatch(/WHAT IS RECORDED: nothing/)
    expect(b).toMatch(/Do not describe the history as clean/)
  })

  it('forbids the topics the portal does not ask about', () => {
    const b = creditHistoryBlock(creditHistoryFacts({ 'Rachel Fielding': clean }, ONE))
    expect(b).toMatch(/Do not mention defaults, credit enquiries, credit impairment or a credit score/)
  })

  it('handles a deal with no applicants without throwing', () => {
    expect(creditHistoryFacts(null, null).anythingAnswered).toBe(false)
  })
})
