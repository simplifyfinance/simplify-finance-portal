import { describe, it, expect } from 'vitest'
import { boxSix, incomeLines, liabilityLine, assetLine } from './box-power'
import { DEAL } from './box-fixture'

const deal = (over: any = {}) => ({ ...JSON.parse(JSON.stringify(DEAL)), id: 'deal-1', ...over })
const ff = (over: any) => { const d = deal(); d.fact_find_data = { ...d.fact_find_data, ...over }; return d }

const LIABS = [
  { id: 'l1', liabilityType: 'Credit card', lenderName: 'ANZ', limitAmount: '15,000', balance: '4,200', status: 'To be closed' },
  { id: 'l2', liabilityType: 'Car loan', lenderName: 'Toyota Finance', balance: '22,000', status: 'Remain open' },
]

// TWO THINGS ARE NEVER IN THIS BOX.
//
// Fabio, 3 Sep 2026, on maximum capacity and debt-to-income: "it's never gonna
// be present, so I don't want that to be part of the compliance notes." Not
// stated, not estimated, and its absence not noted either.
describe('what it must never say', () => {
  const everyShape = () => [deal(), ff({ liabilities: LIABS }), ff({ assets: [] }), ff({ applicants: [] })]

  it('never mentions maximum borrowing capacity', () => {
    for (const d of everyShape()) {
      expect(boxSix(d).text).not.toMatch(/maximum borrowing|borrowing capacity|maximum loan|capacity of/i)
    }
  })

  // THE RULE CHANGED, ON PURPOSE, AND THIS RECORDS WHY.
  //
  // The first version of this test banned the words "debt to income" outright,
  // from the 3 Sep rule. On 10 Sep Fabio drew the line in a better place: the
  // box may say the lender's DTI PARAMETERS are met - which follows from the
  // product having serviced on their calculator - but must never quote a ratio,
  // because ours is built from gross income and recorded balances and every
  // lender shades those differently.
  it('never quotes a ratio, only that the parameters are met', () => {
    for (const d of everyShape()) {
      const t = boxSix(d).text
      expect(t).not.toMatch(/\bDTI\b/i)
      expect(t).not.toMatch(/debt to income (of|is|ratio|at)\b/i)
      expect(t).not.toMatch(/\d+(\.\d+)?\s*(times|x)\b/)
    }
  })

  it('does not even note that they are missing', () => {
    for (const d of everyShape()) {
      expect(boxSix(d).text).not.toMatch(/NOT RECORDED — (the )?(maximum|borrowing capacity|debt)/i)
    }
  })

  it('never mentions living expenses', () => {
    // Fabio, 10 Sep 2026: "that will be changed from time to time."
    for (const d of everyShape()) {
      expect(boxSix(d).text).not.toMatch(/living expense|\bHEM\b|monthly expenses/i)
    }
  })

  it('never uses a word that is a judgement rather than a fact', () => {
    // An assessor asks what "robust" is measured against and there is no answer.
    for (const d of everyShape()) {
      expect(boxSix(d).text).not.toMatch(/\brobust|\bstrong\b|comfortabl|excellent|well within|ample|healthy/i)
    }
  })

})

// Fabio, 10 Sep 2026: "we would NEVER suggest a lender that doesn't service ...
// deal services as per lender calculator, fits its parameters in DTI and surplus
// funding including all buffers." True by construction, so it is stated plainly.
describe('servicing, as a fact about the process', () => {
  it('says it once, in one sentence', () => {
    const t = boxSix(deal()).text
    expect(t).toContain("The recommended product services on ING's own calculator, which applies their assessment rate and buffers, so the deal sits within their debt to income parameters and returns a surplus.")
  })

  it('does not name the calculator or the buffers twice', () => {
    // The first draft was two sentences and the second repeated both.
    const t = boxSix(deal()).text
    expect((t.match(/calculator/gi) || []).length).toBe(1)
    expect((t.match(/buffer/gi) || []).length).toBe(1)
  })

  it('says the parameters are met without ever quoting the ratio', () => {
    const t = boxSix(deal()).text
    expect(t).toContain('debt to income parameters')
    expect(t).not.toMatch(/\d+(\.\d+)?\s*(times|x)\b/)
  })

  it('shouts instead when no lender has been recommended', () => {
    const d = deal(); d.lo_data = { ...d.lo_data, recommendedLender: '' }
    const r = boxSix(d)
    expect(r.text).toMatch(/\*\* NOT RECORDED — which lender was recommended, so servicing cannot be stated\. \*\*/)
    expect(r.gaps.map(g => g.what)).toContain('Recommended lender')
    expect(r.text).not.toMatch(/services on/)
  })
})

describe('how the loan is put together', () => {
  it('states the term in words and the repayment type', () => {
    expect(boxSix(deal()).text)
      .toContain('The loan has been structured over a thirty year term on principal and interest, as recorded on the deal structure.')
  })

  it('names both when the deal has interest only and principal and interest', () => {
    const d = deal()
    d.lo_data = { ...d.lo_data, refinanceSplits: [
      { id: 'a', label: 'Split 1', amount: '900,000', repaymentType: 'P&I' },
      { id: 'b', label: 'Split 2', amount: '800,000', repaymentType: 'IO' }] }
    d.compliance_data = { ...d.compliance_data, splitDetail: {
      a: { termYears: '30' }, b: { termYears: '30' } } }
    expect(boxSix(d).text).toContain('with interest only and principal and interest components')
  })

  it('says nothing rather than inventing a term', () => {
    const d = deal()
    d.bc_data = { ...d.bc_data, loanTerm: '' }
    d.compliance_data = { ...d.compliance_data, splitDetail: {} }
    d.lo_data = { ...d.lo_data, refinanceSplits: [{ id: 'a', label: 'S', amount: '1,700,000' }] }
    expect(boxSix(d).text).not.toMatch(/year term/)
  })
})

// Fabio, 3 Sep 2026: "we marked Natasha as not employed so why asking that
// questions missing employment???"
describe('not working is a fact, not a gap', () => {
  it('states it plainly and does not shout', () => {
    const t = boxSix(deal()).text
    expect(t).toContain('Rachel is not currently working, recorded as domestic duties.')
    expect(t).not.toMatch(/NOT RECORDED — the income for Rachel/)
  })

  it('does not raise a gap for somebody who is not working', () => {
    expect(boxSix(deal()).gaps.map(g => g.what)).not.toContain('Income for Rachel')
  })

  it('says it without the occupation when none is recorded', () => {
    const d = deal()
    d.fact_find_data.applicants[0].employment = [{ isCurrent: true, employmentType: 'Not working', occupation: '' }]
    expect(boxSix(d).text).toContain('Rachel is not currently working.')
  })
})

describe('what each applicant earns', () => {
  it('names the occupation and the figure', () => {
    expect(boxSix(deal()).text).toContain('Daniel is employed as an investment manager and earns $446,429 a year.')
  })

  it('gives the occupation its article', () => {
    expect(boxSix(deal()).text).toContain('as an investment manager')
  })

  it('says self-employed when that is what is recorded', () => {
    const d = deal()
    d.fact_find_data.applicants[1].employment = [{ isCurrent: true, employmentType: 'Self-employed', occupation: 'Builder' }]
    expect(boxSix(d).text).toContain('Daniel is self-employed as a builder')
  })

  it('shouts when somebody is working and no income is recorded', () => {
    const d = deal()
    d.fact_find_data.applicants[1].income = []
    const r = boxSix(d)
    expect(r.text).toMatch(/\*\* NOT RECORDED — the income for Daniel\. \*\*/)
    expect(r.gaps.map(g => g.what)).toContain('Income for Daniel')
  })

  it('covers every applicant on the deal', () => {
    const t = boxSix(deal()).text
    expect(t).toContain('Rachel')
    expect(t).toContain('Daniel')
  })
})

describe('what they owe', () => {
  it('says so plainly when nothing is recorded', () => {
    expect(liabilityLine(deal())).toBe('No liabilities are recorded on the fact find.')
  })

  it('separates what remains from what is being cleared', () => {
    const t = boxSix(ff({ liabilities: LIABS })).text
    expect(t).toContain('The clients hold a car loan with Toyota Finance of $22,000, which will remain.')
    expect(t).toContain('A credit card with ANZ of $4,200 is being cleared as part of this loan.')
  })

  it('starts the cleared sentence with a capital', () => {
    const t = boxSix(ff({ liabilities: LIABS })).text
    expect(t).not.toMatch(/\. a credit card/)
  })

  it('uses the plural when more than one is being cleared', () => {
    const two = [LIABS[0], { ...LIABS[1], status: 'To be closed' }]
    expect(liabilityLine(ff({ liabilities: two }))).toMatch(/are being cleared/)
  })

  it('does not invent a balance it does not have', () => {
    const t = liabilityLine(ff({ liabilities: [{ id: 'x', liabilityType: 'Credit card', lenderName: 'ANZ', balance: '', status: 'Remain open' }] }))
    expect(t).toContain('a credit card with ANZ')
    expect(t).not.toMatch(/\$0/)
  })
})

describe('what they hold', () => {
  it('groups by kind rather than listing seven rows', () => {
    const t = assetLine(deal())
    expect(t).toContain('$3,400,000')
    expect(t).toContain('$2,170,000 in bank accounts')
    expect(t).toContain('$750,000 in superannuation')
  })

  it('puts the asset kinds into words a sentence can carry', () => {
    const t = assetLine(deal())
    expect(t).not.toMatch(/in bank account\b|in super\b|in vehicle\b/)
  })

  it('is silent when nothing is recorded', () => {
    expect(assetLine(ff({ assets: [] }))).toBe('')
  })

  it('ignores an asset with no value rather than counting it as nil', () => {
    const t = assetLine(ff({ assets: [{ assetType: 'Shares', value: '' }, { assetType: 'Shares', value: '1,000' }] }))
    expect(t).toContain('$1,000 in shares')
  })
})

describe('the rest of the position', () => {
  it('writes the dependants as a word', () => {
    expect(boxSix(deal()).text).toContain('There are two dependants.')
  })

  it('uses the singular for one', () => {
    expect(boxSix(ff({ dependants: '1' })).text).toContain('There is one dependant.')
  })

  it('says nothing when there are none', () => {
    expect(boxSix(ff({ dependants: '0' })).text).not.toMatch(/dependant/)
  })

  it('states the LVR from the deal structure block', () => {
    expect(boxSix(deal()).text).toMatch(/loan to value ratio of 32\.4%/)
  })

  it('shouts rather than quoting an LVR it cannot work out', () => {
    const d = deal()
    d.bc_data = { ...d.bc_data, purchasePrice: '', newPurchasePrice: '', propertyValue: '', splits: [] }
    d.lo_data = { ...d.lo_data, loanAmount: '' }
    const r = boxSix(d)
    expect(r.text).toMatch(/\*\* NOT RECORDED — the loan to value ratio/)
    expect(r.gaps.map(g => g.what)).toContain('Loan to value ratio')
  })
})

describe('it reads like a person wrote it', () => {
  it('leaves no raw key, placeholder or double punctuation', () => {
    for (const d of [deal(), ff({ liabilities: LIABS }), ff({ assets: [] })]) {
      const t = boxSix(d).text
      expect(t).not.toMatch(/undefined|NaN|\[object|assetType|employmentType|liabilityType/)
      expect(t).not.toMatch(/ {2}|\.\.|,,| ,/)
    }
  })

  it('stays short', () => {
    const n = boxSix(deal()).text.split(/\s+/).length
    expect(n).toBeGreaterThan(20)
    expect(n).toBeLessThan(180)
  })

  it('is the same words every time for one deal', () => {
    expect(new Set(Array.from({ length: 20 }, () => boxSix(deal()).text)).size).toBe(1)
  })
})
