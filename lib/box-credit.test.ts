import { describe, it, expect } from 'vitest'
import { boxEight, allClear } from './box-credit'
import { DEAL } from './box-fixture'
import { CREDIT_QUESTIONS } from './credit-history-facts'

const RACHEL = 'Rachel Fielding'
const DANIEL = 'Daniel Fielding'
const CLEAN = { problemsMeetingCommitments: 'No', officerInLiquidation: 'No', unsatisfiedJudgements: 'No',
                simultaneousApplications: 'No', declaredBankrupt: 'No' }

const deal = (over: any = {}) => ({ ...JSON.parse(JSON.stringify(DEAL)), id: 'deal-1', ...over })

// Both applicants answered clean, which is the ordinary case.
const both = () => {
  const d = deal()
  d.compliance_data.risks = { [RACHEL]: { ...CLEAN }, [DANIEL]: { ...CLEAN } }
  return d
}

// WE DO NOT PULL CREDIT REPORTS.
//
// Fabio, 10 Sep 2026: "stop asking me if we did a credit check. We don't do
// Equifax. Don't mention that." These are the tests that keep it out - including
// the polite hedges, which are the same claim wearing a hat.
describe('it never implies a credit report was obtained', () => {
  const everyShape = () => {
    const adverse = both(); adverse.compliance_data.risks[RACHEL].declaredBankrupt = 'Yes discharged'
    const partial = both(); partial.compliance_data.risks[DANIEL].unsatisfiedJudgements = ''
    const missing = deal(); missing.compliance_data.risks = { [RACHEL]: { ...CLEAN } }
    return [both(), adverse, partial, missing, deal()]
  }

  it('never names a bureau or a report', () => {
    for (const d of everyShape()) {
      expect(boxEight(d).text).not.toMatch(/equifax|experian|illion|veda|credit report|credit file|credit check|credit score|bureau/i)
    }
  })

  it('never says "subject to" or "pending" a check', () => {
    for (const d of everyShape()) {
      expect(boxEight(d).text).not.toMatch(/subject to a credit|pending a credit|once a credit|upon obtaining/i)
    }
  })

  it('never hedges the declarations as unverified', () => {
    // "declarations rather than a verified credit report" is the same claim with
    // a hedge on it, and it was in the old model prompt.
    for (const d of everyShape()) {
      expect(boxEight(d).text).not.toMatch(/unverified|rather than a verified|should be verified|to be confirmed by the credit team/i)
    }
  })

  it('never mentions the four things the portal does not ask about', () => {
    for (const d of everyShape()) {
      expect(boxEight(d).text).not.toMatch(/\bdefaults?\b|credit enquir|credit impairment|payment history/i)
    }
  })
})

describe('the conclusion, when it is earned', () => {
  it('states plainly that we have no concerns', () => {
    // Fabio: "build rules to assume that there is no issues with your credit
    // history as far as we're concerned or something along those lines."
    const t = boxEight(both()).text
    expect(t).toMatch(/no (credit history )?concerns|nothing in the credit history/i)
    expect(t).toMatch(/answers recorded/)
  })

  it('withholds it when one answer is adverse', () => {
    const d = both()
    d.compliance_data.risks[RACHEL].unsatisfiedJudgements = 'Yes'
    const t = boxEight(d).text
    expect(t).toMatch(/has an unsatisfied judgement recorded/)
    expect(t).not.toMatch(/no concerns|no credit history concerns|cause for concern/i)
  })

  it('withholds it when a discharged bankruptcy is disclosed', () => {
    const d = both()
    d.compliance_data.risks[RACHEL].declaredBankrupt = 'Yes discharged'
    const t = boxEight(d).text
    expect(t).toMatch(/has been declared bankrupt, since discharged/)
    expect(t).not.toMatch(/no concerns|cause for concern/i)
    expect(allClear(d)).toBe(false)
  })

  it('withholds it when one question is left blank', () => {
    const d = both()
    d.compliance_data.risks[DANIEL].simultaneousApplications = ''
    const t = boxEight(d).text
    expect(t).toMatch(/\*\* NOT RECORDED —/)
    expect(t).not.toMatch(/no concerns|cause for concern/i)
    expect(allClear(d)).toBe(false)
  })

  it('withholds it when an applicant has no answers at all', () => {
    const d = deal()
    d.compliance_data.risks = { [RACHEL]: { ...CLEAN } }
    const t = boxEight(d).text
    expect(t).toMatch(/no credit history answers have been recorded for Daniel/)
    expect(t).not.toMatch(/no concerns|cause for concern/i)
  })
})

describe('what it says about each applicant', () => {
  it('leads a clean history on bankruptcy, not on mobile payments', () => {
    expect(boxEight(both()).text)
      .toMatch(/have each confirmed that they have never been declared bankrupt, have no unsatisfied judgements/)
  })

  it('says it once for a couple rather than twice, word for word', () => {
    // Forty words, twice in a row, identical, is what a machine writes.
    const t = boxEight(both()).text
    expect(t).toContain('Rachel and Daniel have each confirmed')
    expect((t.match(/never been declared bankrupt/g) || []).length).toBe(1)
  })

  it('uses the singular for a single applicant', () => {
    const d = deal()
    d.fact_find_data = { ...d.fact_find_data,
      applicants: [(d.fact_find_data.applicants || [])[0]].filter(Boolean) }
    d.compliance_data.risks = { [RACHEL]: { ...CLEAN } }
    expect(boxEight(d).text).toMatch(/^Rachel has confirmed that they /)
  })

  it('covers both applicants, which is the fault found on Natacha', () => {
    const t = boxEight(both()).text
    expect(t).toContain('Rachel')
    expect(t).toContain('Daniel')
  })

  it('hands an adverse answer to the lender rather than burying it', () => {
    const d = both()
    d.compliance_data.risks[DANIEL].problemsMeetingCommitments = 'Yes'
    const t = boxEight(d).text
    expect(t).toMatch(/Daniel has had difficulty meeting fixed commitments\. This must be addressed with the lender\./)
    expect(boxEight(d).gaps.map(g => g.what)).toContain('Daniel has disclosed an adverse credit answer')
  })

  it('names the questions still to answer', () => {
    const d = both()
    d.compliance_data.risks[RACHEL].officerInLiquidation = ''
    const r = boxEight(d)
    expect(r.text).toMatch(/officer or shareholder of a company where a liquidator was appointed not answered for Rachel/i)
    expect(r.gaps.map(g => g.what)).toContain('Credit history not complete for Rachel')
  })

  it('says so when there is nobody on the deal', () => {
    const d = deal()
    d.fact_find_data = { ...d.fact_find_data, applicants: [] }
    d.bc_data = { ...d.bc_data, firstName: '', lastName: '', joint: '' }
    d.compliance_data.risks = {}
    const r = boxEight(d)
    // applicantsOf() hands back a placeholder rather than an empty list, so
    // without this the note read "recorded for Applicant."
    expect(r.text).toMatch(/\*\* NOT RECORDED — nobody has been recorded as an applicant on this deal/)
    expect(r.text).not.toMatch(/for Applicant\b/)
    expect(r.gaps.map(g => g.what)).toContain('Applicants')
  })
})

describe('allClear is strict, because the conclusion depends on it', () => {
  it('is true only when every applicant answered every question No', () => {
    expect(allClear(both())).toBe(true)
  })

  it('is false when any single answer is missing', () => {
    for (const q of CREDIT_QUESTIONS) {
      const d = both()
      d.compliance_data.risks[RACHEL][q.key] = ''
      expect(allClear(d), q.key).toBe(false)
    }
  })

  it('is false when any single answer is Yes', () => {
    for (const q of CREDIT_QUESTIONS) {
      const d = both()
      d.compliance_data.risks[RACHEL][q.key] = 'Yes'
      expect(allClear(d), q.key).toBe(false)
    }
  })

  it('is false when the risks record is empty, not true by default', () => {
    const d = deal()
    d.compliance_data.risks = {}
    expect(allClear(d)).toBe(false)
  })
})

describe('it reads like a person wrote it', () => {
  it('is short — this box is a few sentences', () => {
    const n = boxEight(both()).text.split(/\s+/).length
    expect(n).toBeGreaterThan(15)
    expect(n).toBeLessThan(140)
  })

  it('leaves no raw key or placeholder', () => {
    const t = boxEight(both()).text
    expect(t).not.toMatch(/declaredBankrupt|problemsMeeting|officerInLiquidation|undefined|NaN|\[object/)
    expect(t).not.toMatch(/ {2}|\.\.|,,| ,/)
  })

  it('is the same words every time for one deal, and varies across deals', () => {
    expect(new Set(Array.from({ length: 20 }, () => boxEight(both()).text)).size).toBe(1)
    const across = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => {
      const d = both(); d.id = id; return boxEight(d).text
    })
    expect(new Set(across).size).toBeGreaterThan(1)
  })

  it('never calls one named person "their" in the conclusion', () => {
    expect(boxEight(both()).text).not.toMatch(/(Rachel|Daniel)[^.]*\btheir own\b/)
  })
})
