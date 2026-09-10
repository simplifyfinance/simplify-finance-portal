import { describe, it, expect } from 'vitest'
import { boxOne, variantOf, structureOf, flexibilityPassage, lendersLine, andList } from './box-one'
import { DEAL } from './box-fixture'

const chapman = (over: any = {}) => ({ ...JSON.parse(JSON.stringify(DEAL)), id: 'deal-1', ...over })

const lender = (over: any = {}) => ({
  lenderName: 'ING', productName: 'Orange Advantage', offsetAccount: 'Yes', annualFee: '$299/yr',
  variablePI: { enabled: true, rate: '5.99' }, variableIO: { enabled: false },
  fixedPI: { enabled: false }, fixedIO: { enabled: false }, ...over,
})

describe('the variation is the deal’s, never the moment’s', () => {
  it('is the same every time for one deal', () => {
    const runs = new Set(Array.from({ length: 50 }, () => boxOne(chapman()).text))
    expect(runs.size).toBe(1)
  })

  it('differs across deals', () => {
    const seen = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(id => variantOf(id)))
    expect(seen.size).toBeGreaterThan(1)
  })

  it('is always one of the three, even with no id', () => {
    expect([1, 2, 3]).toContain(variantOf(undefined))
    expect([1, 2, 3]).toContain(variantOf(''))
  })
})

describe('the product decides, not the questionnaire', () => {
  it('mentions redraw on a variable loan', () => {
    for (const v of [1, 2, 3] as const)
      expect(flexibilityPassage(structureOf(chapman()), 'they', v)).toMatch(/redraw|draw it back|drawn back/i)
  })

  it('never mentions redraw on a fixed-only loan', () => {
    const d = chapman()
    d.lo_data.lenders = [lender({ variablePI: { enabled: false }, fixedPI: { enabled: true, fixedYears: '3' } })]
    for (const v of [1, 2, 3] as const)
      expect(flexibilityPassage(structureOf(d), 'they', v)).not.toMatch(/redraw/i)
  })

  it('mentions the offset when the product has one, whatever the client ticked', () => {
    const d = chapman()
    d.compliance_data.productReqs.offsetAccount = 'Do not want'
    // Variant 1 says "the offset sits alongside", 2 and 3 say "offset account" -
    // all three mention it, which is the point.
    expect(boxOne(d).text).toMatch(/offset/i)
  })

  it('never mentions an offset the product does not have', () => {
    const d = chapman()
    d.lo_data.lenders = [lender({ offsetAccount: 'No' })]
    d.compliance_data.productReqs.offsetAccount = 'Important'
    const t = boxOne(d).text
    // Three wordings, three ways of saying it is absent.
    expect(t).toMatch(/does not include an offset|no offset account|without an offset account/i)
    expect(t).not.toMatch(/The offset account works|offset sits alongside/i)
  })

  it('never mentions fixed on an all-variable loan, however important they said it was', () => {
    const d = chapman()
    d.compliance_data.productReqs.fixedAndVariable = 'Important'
    d.compliance_data.productReqs.fixedRate = 'Important'
    expect(boxOne(d).text).not.toMatch(/\bfixed\b/i)
  })
})

describe('no offset — the fee claim has to trace to a field', () => {
  const noOffset = (annualFee: string) => {
    const d = chapman()
    d.lo_data.lenders = [lender({ offsetAccount: 'No', annualFee })]
    return boxOne(d).text
  }

  it('claims no ongoing fee only when the product records a nil fee', () => {
    expect(noOffset('$0')).toMatch(/no ongoing annual fee/i)
    expect(noOffset('nil')).toMatch(/no ongoing annual fee/i)
  })

  it('says nothing about fees when a fee is charged', () => {
    expect(noOffset('$395/yr')).not.toMatch(/no ongoing annual fee/i)
  })

  it('says nothing about fees when no fee has been recorded at all', () => {
    expect(noOffset('')).not.toMatch(/no ongoing annual fee/i)
  })

  it('still leans on redraw', () => {
    expect(noOffset('$0')).toMatch(/redraw/i)
  })
})

describe('first home buyer — only on the first home buyer scenario', () => {
  it('is silent on an OO purchase, even though they own a property', () => {
    expect(boxOne(chapman()).text).not.toMatch(/first home buyer/i)
  })

  it('is silent when no property is recorded — owning nothing proves nothing', () => {
    const d = chapman()
    d.fact_find_data.properties = []
    expect(boxOne(d).text).not.toMatch(/first home buyer/i)
  })

  it('says it on the fhb scenario', () => {
    const d = chapman()
    d.bc_data.template = 'fhb'
    expect(boxOne(d).text).toMatch(/first home buyers/i)
  })
})

describe('gaps are shouted, not smoothed over', () => {
  it('shouts a missing purpose and lists it', () => {
    const r = boxOne(chapman())
    expect(r.text).toMatch(/\*\* NOT RECORDED — .*(reason|purpose|want the loan for)/i)
    expect(r.gaps.map(g => g.what)).toContain("The clients' own reason for the loan")
  })

  it('quotes the clients’ own words when they are there, and stops shouting', () => {
    const d = chapman()
    d.fact_find_data.loanPurpose = 'We want to upgrade the family home.'
    const r = boxOne(d)
    expect(r.text).toContain('"We want to upgrade the family home."')
    expect(r.gaps.map(g => g.what)).not.toContain("The clients' own reason for the loan")
  })

  it('shouts that the sale proceeds are unrecorded', () => {
    const r = boxOne(chapman())
    expect(r.text).toMatch(/\*\* NOT RECORDED — .*(net|sale)/i)
    expect(r.gaps.map(g => g.what)).toContain('Expected net proceeds of the sale')
  })

  it('shouts when only one lender is on the file', () => {
    const d = chapman()
    d.lo_data.lenders = [lender()]
    const r = boxOne(d)
    expect(r.text).toMatch(/\*\* ONLY ONE LENDER RECORDED/)
    expect(r.gaps.map(g => g.what)).toContain('Only one lender option recorded')
  })

  it('the shout survives being copied as plain text', () => {
    // No colour, no markup - the marker is the words themselves.
    expect(boxOne(chapman()).text).toContain('** NOT RECORDED')
  })
})

describe('the closing line', () => {
  it('names the recommendation and everyone it was weighed against', () => {
    for (const v of [1, 2, 3] as const) {
      const t = lendersLine(chapman(), v).text
      expect(t).toContain('ING')
      expect(t).toContain('CBA')
    }
  })

  it('reads naturally with three lenders', () => {
    const d = chapman()
    d.lo_data.lenders.push(lender({ lenderName: 'NAB', productName: 'Choice' }))
    expect(lendersLine(d, 1).text).toContain('CBA and NAB')
  })

  it('keeps the broker’s reason as its own sentence, never spliced with a comma', () => {
    const t = lendersLine(chapman(), 2).text
    expect(t).not.toMatch(/,\s+They offer/)
    expect(t).toContain('. They offer')
  })

  it('shouts when no lender has been marked as recommended', () => {
    const d = chapman()
    d.lo_data.recommendedLender = ''
    d.lo_data.lenders = []
    expect(lendersLine(d, 1).text).toMatch(/\*\* NO RECOMMENDED LENDER RECORDED/)
  })
})

describe('it reads like a person wrote it', () => {
  const t = () => boxOne(chapman()).text

  it('writes small counts and the term as words', () => {
    expect(t()).toContain('two dependants')
    expect(t()).toContain('thirty year term')
  })

  it('gives an occupation its article', () => {
    expect(t()).toContain('as an investment manager')
  })

  it('leads with the applicant who earns', () => {
    expect(t()).toMatch(/Daniel is employed[^.]*; Rachel is not working/)
  })

  it('never leaves a raw database key in the prose', () => {
    expect(t()).not.toMatch(/oo_purchase|lo_purchase|investment_equity|refinance_only/)
  })

  it('never prints an empty dollar sign or a bare placeholder', () => {
    expect(t()).not.toMatch(/\$\s|\$XXX|\[calculated\]|undefined|NaN|\$,/)
  })
})

describe('the money is read, never guessed', () => {
  it('names the property being sold, which nothing used to pass on', () => {
    expect(boxOne(chapman()).text).toContain('recorded as being sold')
  })

  it('states the savings left over when the cash actually covers it', () => {
    const d = chapman()
    d.fact_find_data.properties = []
    d.fact_find_data.assets = [{ assetType: 'Bank account', value: '4,500,000' }]
    expect(boxOne(d).text).toMatch(/leaving \$658,500 of recorded savings held after settlement/)
  })

  it('reads comma-formatted money rather than turning it into NaN', () => {
    expect(boxOne(chapman()).text).toContain('$1,700,000')
  })
})

describe('andList', () => {
  it('joins the way a person speaks', () => {
    expect(andList(['A'])).toBe('A')
    expect(andList(['A', 'B'])).toBe('A and B')
    expect(andList(['A', 'B', 'C'])).toBe('A, B and C')
    expect(andList(['A', '', 'C'])).toBe('A and C')
    expect(andList([])).toBe('')
  })
})

describe('punctuation, because it is read by people', () => {
  const withPurpose = (p: string) => {
    const d = chapman(); d.fact_find_data.loanPurpose = p; return boxOne(d).text
  }
  it('does not double up a full stop the client already wrote', () => {
    expect(withPurpose('We want to upgrade the family home.')).toContain('home."')
    expect(withPurpose('We want to upgrade the family home.')).not.toContain('.".')
  })
  it('adds one when they did not', () => {
    expect(withPurpose('Upgrade the family home')).toContain('home."')
  })
  it('never leaves a double space or a stranded comma', () => {
    const t = boxOne(chapman()).text
    expect(t).not.toMatch(/ {2}| ,|,,|\.\./)
  })
})
