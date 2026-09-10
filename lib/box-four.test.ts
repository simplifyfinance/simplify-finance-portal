import { describe, it, expect } from 'vitest'
import { boxFour, retirementStrategy, creditHistorySentences, REPAYMENT_METHOD_WORDS } from './box-four'
import { DEAL } from './box-fixture'
import { readFileSync } from 'fs'

const deal = (over: any = {}) => ({ ...JSON.parse(JSON.stringify(DEAL)), id: 'deal-1', ...over })
const RACHEL = 'Rachel Fielding'
const DANIEL = 'Daniel Fielding'
const CLEAN = { problemsMeetingCommitments: 'No', officerInLiquidation: 'No', unsatisfiedJudgements: 'No',
                simultaneousApplications: 'No', declaredBankrupt: 'No' }

const lender = (over: any = {}) => ({
  lenderName: 'ING', productName: 'Orange Advantage', offsetAccount: 'Yes', annualFee: '$299/yr',
  applicationFee: '$0', valuationFee: '$0', legalFee: '350', approvalDays: '1-2 business days',
  variablePI: { enabled: true, rate: '5.99' }, variableIO: { enabled: false },
  fixedPI: { enabled: false }, fixedIO: { enabled: false }, ...over,
})

describe('it never invents, which is what this box did', () => {
  it('never calculates a repayment of its own', () => {
    // The Chapman note worked out "$10,180 per month" against a recorded
    // $10,182. Nothing here does arithmetic on a repayment.
    expect(boxFour(deal()).text).not.toMatch(/10,180|per month/)
  })

  it('never judges how financially literate somebody is', () => {
    expect(boxFour(deal()).text).not.toMatch(/literacy|literate|assumed to have|sophisticat/i)
  })

  it('never says "typically", which is the tell for a fact nobody recorded', () => {
    expect(boxFour(deal()).text).not.toMatch(/typically|usually|generally|it is expected that/i)
  })

  it('does not mention living expenses', () => {
    // Fabio, 10 Sep 2026: "that will be changed from time to time".
    // \b matters: "HEM" without it matches the "hem" inside "them".
    expect(boxFour(deal()).text).not.toMatch(/living expense|\bHEM\b|monthly expenses/i)
  })

  it('leaves out applicant education entirely', () => {
    const t = boxFour(deal()).text
    expect(t).not.toMatch(/APPLICANT EDUCATION|educat/i)
    expect(t).toContain('ANALYSIS')
    expect(t).toContain('ASSESSMENT')
  })
})

describe('the retirement strategy is on every file', () => {
  it('states the age and the method together', () => {
    expect(boxFour(deal()).text).toMatch(/Rachel has given a retirement age of 75 and intends to repay the loan by downsizing the home/)
  })

  it('appears even when retirement is decades away', () => {
    // Unlike boxes 2 and 3, which only speak when it lands in their window.
    expect(boxFour(deal()).text).toMatch(/retirement age of 75/)
  })

  it('shouts when the loan outlives the retirement age', () => {
    const r = boxFour(deal())
    expect(r.text).toMatch(/\*\* EXIT STRATEGY/)
    expect(r.gaps.map(g => g.what)).toContain('Rachel retires before the loan ends — exit strategy required')
  })

  it('says the term finishes in time when it does', () => {
    const d = deal()
    d.bc_data.loanTerm = '20'
    d.compliance_data.splitDetail = {}
    const t = boxFour(d).text
    expect(t).not.toMatch(/EXIT STRATEGY/)
    expect(t).toMatch(/runs to age 67, within that/)
  })

  it('has words for every method the form actually offers', () => {
    // The list lives in ComplianceForm.tsx. If somebody adds an option there and
    // not here, this box would print a retirement age and no strategy - so the
    // two lists are compared rather than assumed to match.
    const form = readFileSync(new URL('../app/(app)/deals/[id]/ComplianceForm.tsx', import.meta.url), 'utf8')
    const list = form.slice(form.indexOf('const REPAYMENT_METHODS = ['))
    const offered = [...list.slice(0, list.indexOf(']')).matchAll(/'([^']+)'/g)].map(m => m[1])
    expect(offered.length).toBe(8)
    for (const o of offered) expect(Object.keys(REPAYMENT_METHOD_WORDS)).toContain(o)
  })

  it('has words for every method on the dropdown', () => {
    // Nine were offered; "Other" was removed on 10 Sep 2026 because nobody had
    // ever picked it and it told an assessor nothing.
    expect(Object.keys(REPAYMENT_METHOD_WORDS)).toHaveLength(8)
    expect(Object.keys(REPAYMENT_METHOD_WORDS)).not.toContain('Other')
    for (const words of Object.values(REPAYMENT_METHOD_WORDS)) expect(words).toMatch(/^intends to/)
  })

  it('shouts when a retirement age is missing', () => {
    const r = retirementStrategy(deal(), 1)
    expect(r.parts.join(' ')).toMatch(/no retirement age has been recorded for Daniel/)
    expect(r.gaps.map(g => g.what)).toContain('Retirement age for Daniel')
  })

  it('shouts when the age is there but the method is not', () => {
    const d = deal()
    d.compliance_data.risks[RACHEL] = { ...d.compliance_data.risks[RACHEL], repaymentMethod: '' }
    const r = retirementStrategy(d, 1)
    expect(r.parts.join(' ')).toMatch(/how Rachel intends to repay the loan has not been recorded/)
    expect(r.gaps.map(g => g.what)).toContain('Repayment method for Rachel')
  })
})

describe('credit history reads the five answers as recorded', () => {
  it('states a clean history, bankruptcy first', () => {
    const t = creditHistorySentences(deal()).parts.join(' ')
    expect(t).toMatch(/Rachel has confirmed that they have never been declared bankrupt, have no unsatisfied judgements/)
  })

  it('reports an adverse answer instead of burying it', () => {
    const d = deal()
    d.compliance_data.risks[RACHEL] = { ...CLEAN, unsatisfiedJudgements: 'Yes' }
    const r = creditHistorySentences(d)
    expect(r.parts.join(' ')).toMatch(/Rachel has an unsatisfied judgement recorded. This must be addressed with the lender/)
    expect(r.gaps.map(g => g.what)).toContain('Rachel has disclosed an adverse credit answer')
  })

  it('treats a discharged bankruptcy as a disclosure, not as clean', () => {
    const d = deal()
    d.compliance_data.risks[RACHEL] = { ...CLEAN, declaredBankrupt: 'Yes discharged' }
    expect(creditHistorySentences(d).parts.join(' ')).toMatch(/has been declared bankrupt, since discharged/)
  })

  it('names an applicant with no answers at all', () => {
    const r = creditHistorySentences(deal())
    expect(r.parts.join(' ')).toMatch(/no credit history answers have been recorded for Daniel/)
    expect(r.gaps.map(g => g.what)).toContain('Credit history for Daniel')
  })

  it('is quiet once both applicants are answered', () => {
    const d = deal()
    d.compliance_data.risks[DANIEL] = { ...CLEAN }
    const r = creditHistorySentences(d)
    expect(r.parts.join(' ')).not.toMatch(/NOT RECORDED/)
    expect(r.gaps).toHaveLength(0)
  })
})

describe('the assessment says what the deal is', () => {
  const t = () => boxFour(deal()).text

  it('states serviceability against the lender’s own calculator', () => {
    expect(t()).toMatch(/ING's own calculator|calculator, which appl|calculator, which already carries/)
    expect(t()).toMatch(/buffer/)
  })

  it('names the fees from the lender’s record, not "any applicable fees"', () => {
    expect(t()).toMatch(/an application fee of \$0/)
    expect(t()).toMatch(/an annual fee of \$299/)
    expect(t()).toMatch(/a legal fee of \$350/)
    expect(t()).toMatch(/Government charges are payable at settlement/)
  })

  it('says what the clients asked for, and what they did not want', () => {
    expect(t()).toMatch(/recorded .*as important to them/)
    expect(t()).toMatch(/did not want .* or /)
  })

  it('explains break costs only when something is fixed', () => {
    expect(t()).not.toMatch(/break cost, which is calculated by the lender/)
    const d = deal()
    d.lo_data.lenders = [lender({ variablePI: { enabled: false }, fixedPI: { enabled: true, fixedYears: '3' } }), d.lo_data.lenders[1]]
    expect(boxFour(d).text).toMatch(/break cost, which is calculated by the lender at the time/)
  })

  it('names who was compared', () => {
    expect(t()).toMatch(/ING was recommended after comparing them against CBA/)
  })

  it('shouts when there is only one lender to compare', () => {
    const d = deal()
    d.lo_data.lenders = [lender()]
    const r = boxFour(d)
    expect(r.text).toMatch(/\*\* ONLY ONE LENDER RECORDED/)
    expect(r.gaps.map(g => g.what)).toContain('Only one lender option recorded')
  })

  it('always states best interests and conflicts', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const t2 = boxFour(deal({ id })).text
      expect(t2).toMatch(/best interests/i)
      expect(t2).toMatch(/conflicts of interest/i)
    }
  })
})

describe('the client’s agreement', () => {
  it('shouts when it has not been captured', () => {
    const r = boxFour(deal())
    expect(r.text).toMatch(/\*\* NOT RECORDED — the clients' agreement to the recommendation/)
    expect(r.gaps.map(g => g.what)).toContain("The clients' agreement to the recommendation")
  })

  it('states it plainly when they agreed', () => {
    const d = deal()
    d.compliance_data.clientAgreedLender = 'Yes'
    expect(boxFour(d).text).toMatch(/agreed with the recommendation and proceeded/)
  })

  it('names the lender they chose instead, and their reason', () => {
    const d = deal()
    d.compliance_data.clientAgreedLender = 'No'
    d.compliance_data.clientChosenLender = 'CBA'
    d.compliance_data.clientChosenLenderReason = 'Existing relationship'
    const t = boxFour(d).text
    expect(t).toMatch(/did not proceed with the original recommendation and chose CBA/)
    expect(t).toContain('"Existing relationship"')
  })
})

describe('it reads like a person wrote it', () => {
  const t = () => boxFour(deal()).text

  it('never calls one named person "their"', () => {
    expect(t()).not.toMatch(/(Rachel|Daniel)[^.]*\btheir\b/)
  })

  it('writes the term and small counts as words', () => {
    expect(t()).toContain('thirty year term')
    expect(t()).toContain('two dependants')
  })

  it('gives an occupation its article', () => {
    expect(t()).toContain('as an investment manager')
  })

  it('never leaves a raw key, a placeholder or a stray dollar sign', () => {
    expect(t()).not.toMatch(/oo_purchase|investment_equity|undefined|NaN|\[calculated\]|\$XXX/)
    expect(t()).not.toMatch(/ {2}|\.\.|,,| ,/)
  })

  it('lands near five hundred words rather than seven', () => {
    const words = t().split(/\s+/).length
    expect(words).toBeGreaterThan(350)
    expect(words).toBeLessThan(700)
  })

  it('is the same words every time for one deal, and varies across deals', () => {
    expect(new Set(Array.from({ length: 20 }, () => boxFour(deal()).text)).size).toBe(1)
    expect(new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(id => boxFour(deal({ id })).text)).size).toBeGreaterThan(1)
  })
})
