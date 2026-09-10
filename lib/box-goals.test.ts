import { describe, it, expect } from 'vitest'
import { boxTwo, boxThree, outlook, retirementPicture } from './box-goals'
import { DEAL } from './box-fixture'

const deal = (over: any = {}) => ({ ...JSON.parse(JSON.stringify(DEAL)), id: 'deal-1', ...over })
const RACHEL = 'Rachel Fielding'
const DANIEL = 'Daniel Fielding'

// Both applicants answered, so the file is not perpetually shouting about the
// one whose risk row predates the applicants fix.
const answered = (d: any, over: any = {}) => {
  d.compliance_data.risks[DANIEL] = { adverseChanges: 'No', circumstancesImpact: 'No', ...over }
  d.compliance_data.risks[RACHEL] = { ...d.compliance_data.risks[RACHEL], adverseChanges: 'No', circumstancesImpact: 'No' }
  return d
}

const lender = (over: any = {}) => ({
  lenderName: 'ING', productName: 'Orange Advantage', offsetAccount: 'Yes', annualFee: '$299/yr',
  variablePI: { enabled: true, rate: '5.99' }, variableIO: { enabled: false },
  fixedPI: { enabled: false }, fixedIO: { enabled: false }, ...over,
})

describe('box two — the client’s own words come first', () => {
  it('shouts when nobody has asked them', () => {
    const r = boxTwo(deal())
    expect(r.text).toMatch(/\*\* NOT RECORDED/)
    expect(r.gaps.map(g => g.what)).toContain("The clients' goals for the next two years")
  })

  it('quotes them when they are there, and stops shouting about it', () => {
    const d = deal()
    d.fact_find_data.goals2Years = 'Settle in and take the kids to Italy in 2028.'
    const r = boxTwo(d)
    expect(r.text).toContain('"Settle in and take the kids to Italy in 2028."')
    expect(r.gaps.map(g => g.what)).not.toContain("The clients' goals for the next two years")
  })

  it('does not double a full stop the client already wrote', () => {
    const d = deal()
    d.fact_find_data.goals2Years = 'Travel.'
    expect(boxTwo(d).text).not.toContain('.".')
  })
})

describe('box two — what the repayment type is for', () => {
  it('says the debt reduces from day one on principal and interest', () => {
    expect(boxTwo(deal()).text).toMatch(/debt|principal/i)
    expect(boxTwo(deal()).text).not.toMatch(/interest only/i)
  })

  it('says cash flow is the point on interest only', () => {
    const d = deal()
    d.lo_data.lenders = [lender({ variablePI: { enabled: false }, variableIO: { enabled: true, ioYears: '5' } })]
    expect(boxTwo(d).text).toMatch(/cash flow/i)
  })
})

describe('box two — the dates that fall inside the window', () => {
  it('warns when a fixed period ends inside two years', () => {
    const d = deal()
    d.lo_data.lenders = [lender({ variablePI: { enabled: false }, fixedPI: { enabled: true, fixedYears: '2' } })]
    expect(boxTwo(d).text).toMatch(/aware the rate will change/i)
  })

  it('says nothing about it when the fixed period runs past two years', () => {
    const d = deal()
    d.lo_data.lenders = [lender({ variablePI: { enabled: false }, fixedPI: { enabled: true, fixedYears: '5' } })]
    expect(boxTwo(d).text).not.toMatch(/aware the rate will change/i)
  })

  it('promises a budget when interest only ends inside two years', () => {
    const d = deal()
    d.lo_data.lenders = [lender({ variablePI: { enabled: false }, variableIO: { enabled: true, ioYears: '2' } })]
    expect(boxTwo(d).text).toMatch(/budget together/i)
  })

  it('says nothing about a budget when the interest only period is longer', () => {
    const d = deal()
    d.lo_data.lenders = [lender({ variablePI: { enabled: false }, variableIO: { enabled: true, ioYears: '5' } })]
    expect(boxTwo(d).text).not.toMatch(/budget together/i)
  })

  it('names a property that is being sold', () => {
    expect(boxTwo(deal()).text).toMatch(/recorded as being sold, so that sale falls inside this period/)
  })

  it('names a property changing use after settlement', () => {
    const d = deal()
    d.fact_find_data.properties[0].futureUse = 'Will become investment'
    expect(boxTwo(d).text).toMatch(/change of use inside this period/)
  })

  it('says a pre-approval’s immediate objective is finding a property', () => {
    expect(boxTwo(deal()).text).toMatch(/pre-approval/i)
  })

  it('says nothing about a pre-approval when it is not one', () => {
    const d = deal()
    d.compliance_data.preApproval = false
    expect(boxTwo(d).text).not.toMatch(/pre-approval/i)
  })

  it('covers a bridging period', () => {
    const d = deal()
    d.bc_data.bridgingPeriod = '6 months'
    expect(boxTwo(d).text).toMatch(/bridging period of 6 months/i)
  })
})

describe('box two — "nothing is expected to change" is reported, never asserted', () => {
  it('says it only when both questions are answered no for everybody', () => {
    const r = boxTwo(answered(deal()))
    expect(r.text).toMatch(/no foreseeable personal or financial circumstances|should adversely affect|no foreseeable personal/i)
    expect(r.gaps.map(g => g.what)).not.toContain('Changes in circumstances not answered')
  })

  it('refuses to say it when an applicant has not been asked', () => {
    // The real Chapman shape: risk answers for one of two applicants.
    const r = boxTwo(deal())
    expect(r.text).not.toMatch(/no foreseeable personal/i)
    expect(r.text).toMatch(/\*\* NOT RECORDED — the questions on changes to their circumstances/)
    expect(r.gaps.map(g => g.what)).toContain('Changes in circumstances not answered')
  })

  it('reports a declared change instead of the reassuring line', () => {
    const d = answered(deal(), { adverseChanges: 'Yes', circumstancesImpact: 'No' })
    const r = boxTwo(d)
    expect(r.text).toMatch(/\*\* FLAGGED — Daniel has declared adverse changes/)
    expect(r.text).not.toMatch(/no foreseeable personal/i)
    expect(r.gaps.map(g => g.what)).toContain('A change in circumstances has been declared')
  })

  it('outlook is only clear when every answer is there and every answer is no', () => {
    expect(outlook(answered(deal())).clear).toBe(true)
    expect(outlook(deal()).clear).toBe(false)
    expect(outlook(answered(deal(), { circumstancesImpact: 'Yes' })).clear).toBe(false)
  })
})

describe('box three — retirement, only when it lands in the period', () => {
  // Fabio, 10 Sep 2026: "only talk about retirement strategy if it falls within
  // the period 2 or 2-10 years."
  const retiringIn = (years: number, over: any = {}) => {
    const d = deal()
    const born = new Date(); born.setFullYear(born.getFullYear() - 50)
    d.fact_find_data.applicants[0].dob = born.toISOString().slice(0, 10)
    d.compliance_data.risks[RACHEL] = { ...d.compliance_data.risks[RACHEL], retirementAge: String(50 + years), ...over }
    return d
  }

  it('works out the age at the end of the term from the date of birth', () => {
    const { term, people } = retirementPicture(deal())
    expect(term).toBe(30)
    const rachel = people.find(p => p.who === 'Rachel')!
    expect(rachel.ageNow).toBe(47)
    expect(rachel.ageAtEnd).toBe(77)
    expect(rachel.retiresAt).toBe(75)
    expect(rachel.yearsAway).toBe(28)
  })

  it('says nothing when retirement is twenty-eight years away', () => {
    // Chapman as it really is. It is not a two-to-ten year objective.
    expect(boxThree(deal()).text).not.toMatch(/retire|EXIT STRATEGY/i)
    expect(boxTwo(deal()).text).not.toMatch(/retire|EXIT STRATEGY/i)
  })

  it('box three takes it when it falls between two and ten years', () => {
    const t = boxThree(retiringIn(5)).text
    expect(t).toMatch(/intends to retire at 55, which falls inside this period/)
    expect(t).toMatch(/\*\* EXIT STRATEGY/)
  })

  it('box two takes it when it falls inside two years, and box three does not', () => {
    const d = retiringIn(1)
    expect(boxTwo(d).text).toMatch(/intends to retire at 51, which falls inside this period/)
    expect(boxThree(d).text).not.toMatch(/intends to retire/)
  })

  it('does not shout an exit strategy when the loan finishes first', () => {
    const d = retiringIn(5)
    d.bc_data.loanTerm = '3'
    d.compliance_data.splitDetail = {}
    expect(boxThree(d).text).not.toMatch(/EXIT STRATEGY/)
  })

  it('keeps a missing retirement age in the gaps, out of the prose', () => {
    const r = boxThree(deal())
    expect(r.gaps.map(g => g.what)).toContain('Retirement age for Daniel')
    expect(r.text).not.toMatch(/no retirement age/i)
  })

  it('gives their intended repayment method when it is recorded', () => {
    expect(boxThree(retiringIn(5)).text).toMatch(/intends to repay the loan by downsizing home/i)
  })
})

describe('box three — the rest of the period', () => {
  it('says principal and interest keeps reducing the overall debt position', () => {
    expect(boxThree(deal()).text).toMatch(/overall debt position/i)
  })

  it('says nothing of the sort on an interest only loan', () => {
    const d = deal()
    d.lo_data.lenders = [lender({ variablePI: { enabled: false }, variableIO: { enabled: true, ioYears: '5' } })]
    expect(boxThree(d).text).not.toMatch(/overall debt position/i)
  })

  it('mentions dependants and does not invent their ages', () => {
    const t = boxThree(deal()).text
    expect(t).toMatch(/two dependants|Two dependants/)
    expect(t).toMatch(/ages are not recorded|No ages have been recorded/)
  })

  it('says nothing about dependants when there are none', () => {
    const d = deal()
    d.fact_find_data.dependants = '0'
    d.bc_data.dependants = '0'
    expect(boxThree(d).text).not.toMatch(/dependant/i)
  })
})

describe('both boxes read like a person wrote them', () => {
  const texts = () => [boxTwo(deal()).text, boxThree(deal()).text]

  it('never leaves a raw database key, a placeholder or a stray dollar sign', () => {
    for (const t of texts()) {
      expect(t).not.toMatch(/oo_purchase|investment_equity|undefined|NaN|\[calculated\]|\$XXX/)
      expect(t).not.toMatch(/ {2}|\.\.|,,| ,/)
    }
  })

  it('is the same words every time for one deal, and varies across deals', () => {
    expect(new Set(Array.from({ length: 20 }, () => boxTwo(deal()).text)).size).toBe(1)
    expect(new Set(Array.from({ length: 20 }, () => boxThree(deal()).text)).size).toBe(1)
    const across = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(id => boxTwo(deal({ id })).text))
    expect(across.size).toBeGreaterThan(1)
  })
})
