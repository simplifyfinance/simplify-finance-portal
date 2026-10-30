import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { isLowDoc, evidenceWords, incomeEvidenceSentence, lowDocMethodWords,
         LOW_DOC_BAS, LOW_DOC_LETTER, LOW_DOC_METHODS } from './low-doc'
import { calculateSeAssessableIncome, incomeBreakdownFor } from './income-calculations'
import { selfEmployedFacts } from './self-employed-facts'

// LOW DOC.
//
// 29 Oct 2026. Two more ways to assess a self-employed client. The figure is
// typed by somebody who has read the evidence; nothing here works anything out.
//
// WHY THERE IS NO BAS CALCULATOR IN THIS REPO. Fabio asked for one, sent three
// lender spreadsheets, and then withdrew it: "each lender has their own risk
// appetite or how much income you can declare after the BAS is calculated. So
// don't do that." The spreadsheets agree - every one of them opens with "What
// income is your client declaring?" and ends in Pass or Refer to BDM. The BAS
// maths produces a ceiling to test a declared figure against. It never produced
// the figure, and a calculator here would have put a number on a fact find that
// no lender ever asked for.
//
// THE RULE THESE TESTS PROTECT: the client is told what the figure rests on and
// never the figure. That held for self-employed before low doc existed and it
// does not bend for it.

const FORM = readFileSync(
  join(__dirname, '..', 'app', '(app)', 'deals', '[id]', 'FactFindForm.tsx'), 'utf8')

const lowDoc = (method: string, amount: string) => ({
  incomeType: 'Self-employed', seAssessmentMethod: method, seLowDocIncome: amount,
})

describe('WHICH METHODS ARE LOW DOC', () => {
  it('the two, and only the two', () => {
    expect(isLowDoc(LOW_DOC_BAS)).toBe(true)
    expect(isLowDoc(LOW_DOC_LETTER)).toBe(true)
    expect(LOW_DOC_METHODS).toHaveLength(2)
  })

  it('and none of the three that read tax returns', () => {
    for (const m of ['Last 2 financial years', 'One year in isolation', "Director's salary", '', null]) {
      expect(isLowDoc(m as any), String(m)).toBe(false)
    }
  })

  it('AND THE FORM OFFERS EXACTLY THESE STRINGS', () => {
    // isLowDoc matches on the text. A renamed option is a method that silently
    // stops being low doc, keeps printing "tax returns" to a client who never
    // provided any, and nothing anywhere complains.
    expect(FORM).toContain(`<option value="${LOW_DOC_BAS}">`)
    expect(FORM).toContain(`<option value="${LOW_DOC_LETTER}">`)
  })
})

describe('WHAT THE CLIENT IS TOLD', () => {
  it('names the evidence, by method', () => {
    expect(evidenceWords(LOW_DOC_BAS)).toBe('BAS')
    expect(evidenceWords(LOW_DOC_LETTER)).toBe("accountant's letter")
    expect(evidenceWords('Last 2 financial years')).toBe('tax returns')
  })

  it('and an unanswered method says tax returns rather than nothing', () => {
    // The general word, not a document we do not hold and not a blank.
    expect(evidenceWords('')).toBe('tax returns')
    expect(evidenceWords(undefined)).toBe('tax returns')
  })

  it('the whole sentence, written once', () => {
    // THE EVIDENCE, NOT THE METHOD - which is what the line carries and what
    // the email has. 30 Oct 2026: this test called it with a method, the email
    // called it with the words, and the words matched nothing.
    expect(incomeEvidenceSentence(evidenceWords(LOW_DOC_BAS))).toBe('Income as per BAS provided')
    expect(incomeEvidenceSentence(evidenceWords(LOW_DOC_LETTER)))
      .toBe("Income as per accountant's letter provided")
    expect(incomeEvidenceSentence(evidenceWords('One year in isolation')))
      .toBe('Income as per tax returns provided')
    expect(incomeEvidenceSentence(''), 'nothing recorded still reads as it always did')
      .toBe('Income as per tax returns provided')
  })

  it('AND NEVER THE FIGURE', () => {
    // Older than low doc and not bent by it.
    const lines = incomeBreakdownFor(
      { income: [lowDoc(LOW_DOC_BAS, '186000')] }, 'Dean')
    expect(lines).toHaveLength(1)
    expect(lines[0].amount).toBeNull()
    expect(lines[0].evidence).toBe('BAS')
    expect(JSON.stringify(lines)).not.toContain('186000')
  })
})

describe('THE FIGURE ITSELF', () => {
  it('is the one that was typed, untouched', () => {
    expect(calculateSeAssessableIncome(lowDoc(LOW_DOC_BAS, '186000'))).toBe(186000)
    expect(calculateSeAssessableIncome(lowDoc(LOW_DOC_LETTER, '242,500'))).toBe(242500)
  })

  it('AND NOTHING IS WORKED OUT FROM IT', () => {
    // No annualising, no shading, no BAS maths. What is typed is what is used.
    const inc: any = lowDoc(LOW_DOC_BAS, '100000')
    inc.seYear1NetProfit = '999999'
    inc.seGrowthMethod = 'previous_plus_growth'
    inc.seGrowthPercentOption = '20'
    expect(calculateSeAssessableIncome(inc)).toBe(100000)
  })

  it('and nothing typed is nothing, not zero', () => {
    const facts = selfEmployedFacts(lowDoc(LOW_DOC_BAS, ''), {})
    expect(facts.hasFigures).toBe(false)
    expect(facts.assessed).toBeNull()
  })

  it('and a figure typed is a figure recorded', () => {
    const facts = selfEmployedFacts(lowDoc(LOW_DOC_LETTER, '186000'), {})
    expect(facts.hasFigures).toBe(true)
    expect(facts.assessed).toBe(186000)
  })
})

describe('WHAT COMPLIANCE READS', () => {
  it('says what the figure rests on', () => {
    expect(lowDocMethodWords(LOW_DOC_BAS)).toContain('declared by the client')
    expect(lowDocMethodWords(LOW_DOC_BAS)).toContain('BAS')
    expect(lowDocMethodWords(LOW_DOC_LETTER)).toContain("accountant's letter")
  })

  it('and it reaches the facts a document is built from', () => {
    const facts = selfEmployedFacts(lowDoc(LOW_DOC_BAS, '186000'), {})
    expect(facts.methodWords).toContain('BAS')
    expect(facts.methodWords).not.toContain('tax returns')
  })

  it('AND THERE ARE NO FINANCIAL YEARS UNDER A LOW DOC ASSESSMENT', () => {
    // There are none. An empty pair of years printed under one invites an
    // assessor to ask where they went.
    expect(selfEmployedFacts(lowDoc(LOW_DOC_BAS, '186000'), {}).years).toEqual([])
  })

  it('and a full-doc assessment is word for word what it was', () => {
    const full = { incomeType: 'Self-employed', seAssessmentMethod: 'Last 2 financial years',
                   seYear1FY: '24/25', seYear1NetProfit: '120000',
                   seYear2FY: '25/26', seYear2NetProfit: '140000' }
    const facts = selfEmployedFacts(full, {})
    expect(facts.methodWords).toBe('the average of the last two financial years')
    expect(facts.assessed).toBe(130000)
  })
})

describe('THE FORM', () => {
  it('gives low doc one field and no years', () => {
    expect(FORM).toContain('Income declared')
    expect(FORM).toContain('seLowDocIncome')
    expect(FORM).toContain('isLowDoc(inc.seAssessmentMethod)')
  })

  it('AND NOTHING IS BORN HOLDING A DECLARED INCOME', () => {
    expect(FORM).toContain("seLowDocIncome: ''")
  })

  it('and the form does not word the client sentence for itself', () => {
    // One file writes it. See lib/low-doc.ts.
    expect(FORM).not.toContain('Income as per')
  })
})
