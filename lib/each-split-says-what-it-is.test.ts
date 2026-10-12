import { describe, it, expect } from 'vitest'
import { boxFour } from './box-four'
import { boxNine } from './box-security'
import { boxOne } from './box-one'
import { readFileSync } from 'fs'
import { lendingBySplit, howItRepays, reasonFor } from './lending-by-split'
import { DEAL } from './box-fixture'

// THE COMPLIANCE PACK SAID TWO DIFFERENT THINGS ABOUT THE SAME LOAN.
//
// 12 Oct 2026, read off a six-split refinance. Two sentences apart in box four:
//
//   "...recommended, on rates of 6.34% and 6.59% with principal and interest
//    repayments over a thirty year term."
//   "Interest only repayments for the first 5 years keep the commitment as low
//    as possible..."
//
// Three splits were principal and interest and three were interest only. The
// first sentence took the FIRST split's type and stated it as the whole deal's.
//
// NOT A MULTIPLE-SECURITIES FAULT. Any deal mixing P&I and interest only
// produced it, which is most split deals this office writes.
//
// Fabio: "the wording should say we are refinancing multiple securities and
// each loan split has its specific characteristics and needs with principal and
// interest repayment and interest [only] because..."

const prop = (id: string, address: string, value: string, owing: string) => ({
  id, address, value, ownershipType: 'Investment', propertySubtype: 'Unit',
  zoning: 'Residential', futureUse: 'Ongoing', valuationMethod: 'Applicant estimate',
  loans: [{ id: `l${id}`, lenderName: 'ANZ', balance: owing, status: 'To be refinanced' }],
})

const split = (over: any) => ({
  id: over.id, label: over.label, amount: over.amount, purpose: 'investment',
  rate: over.rate || '6.34', repaymentType: over.repaymentType || 'P&I',
  ...over,
})

const SIX = [
  split({ id: 'a1', label: 'Existing Investment Home loan', amount: '1,020,000', securityId: 'p1', fundsUsedFor: 'purchase the investment property' }),
  split({ id: 'a2', label: 'Investment equity loan split', amount: '740,000', securityId: 'p1', rate: '6.59', repaymentType: 'Interest only', ioYears: '5', fundsUsedFor: 'release equity for further investment' }),
  split({ id: 'b1', label: 'Existing Investment Home loan', amount: '447,000', securityId: 'p2', fundsUsedFor: 'purchase the investment property' }),
  split({ id: 'b2', label: 'Investment equity loan split', amount: '33,000', securityId: 'p2', rate: '6.59', repaymentType: 'Interest only', ioYears: '5', fundsUsedFor: 'release equity for further investment' }),
]

const deal = (splits: any[], props: any[]) => {
  const d = JSON.parse(JSON.stringify(DEAL))
  d.fact_find_data = { ...d.fact_find_data, properties: props }
  d.bc_data = { ...d.bc_data, template: 'complex_refinance', purchasePrice: '', deposit: '',
    stampDuty: '', propertyValue: '', splits,
    securityIds: props.map(p => p.id), securityLimits: {} }
  d.lo_data = { ...d.lo_data, refinanceSplits: splits }
  d.compliance_data = { ...d.compliance_data, preApproval: false, securityAddress: '' }
  return d
}

const TWO_HOUSES = [prop('p1', '16 Sample Street, Paddington', '2,200,000', '1,760,000'),
                    prop('p2', '7/22 Sample Road, Hawks Nest', '600,000', '480,000')]

const text = (d: any) => boxFour(d).text.replace(/\s+/g, ' ')

describe('the pack no longer claims one repayment type for a mixed deal', () => {
  const t = () => text(deal(SIX, TWO_HOUSES))

  it('the recommendation sentence states the rates and the term, and stops there', () => {
    expect(t()).toContain('has been recommended, on rates of 6.34% and 6.59% over a thirty year term.')
  })

  it('it does not say the whole loan is principal and interest', () => {
    expect(t()).not.toContain('with principal and interest repayments over')
  })

  it('it says outright that the splits differ', () => {
    expect(t()).toContain('The lending is not on one repayment type')
  })
})

describe('each split says what it is and why', () => {
  const t = () => text(deal(SIX, TWO_HOUSES))

  it('names the amount, the rate and how it repays', () => {
    expect(t()).toContain('Existing Investment Home loan, $1,020,000 at 6.34%, principal and interest.')
    expect(t()).toContain('Investment equity loan split, $740,000 at 6.59%, interest only for 5 years.')
  })

  it('gives the reason that was recorded, in the words it was recorded in', () => {
    expect(t()).toContain('These funds were used to release equity for further investment.')
  })

  it('puts the splits under the house each one is secured by', () => {
    const s = t()
    expect(s).toContain('Secured by 16 Sample Street, Paddington:')
    expect(s).toContain('Secured by 7/22 Sample Road, Hawks Nest:')
    expect(s.indexOf('Secured by 16 Sample Street')).toBeLessThan(s.indexOf('$740,000'))
    expect(s.indexOf('$740,000')).toBeLessThan(s.indexOf('Secured by 7/22 Sample Road'))
  })

  it('says how many properties are being refinanced', () => {
    expect(t()).toContain('This is a refinance of existing lending secured by two properties.')
  })
})

// IT IS PROSE, NOT A FORM FIELD. repaymentLine() writes "P&I" and
// "Interest only · 5 yrs" for a screen. Lower-casing it put "p&i" and a middle
// dot inside a regulated document, which is how this was caught.
describe('it reads like a sentence', () => {
  it('never prints the form wording', () => {
    const s = text(deal(SIX, TWO_HOUSES))
    expect(s).not.toContain('p&i')
    expect(s).not.toMatch(/interest only ·/)
    expect(s).not.toContain('term not recorded ·')
  })

  it.each([
    [{ repaymentType: 'P&I' }, 'principal and interest'],
    [{ repaymentType: 'Interest only', ioYears: '5' }, 'interest only for 5 years'],
    [{ repaymentType: 'Interest only' }, 'interest only, term not recorded'],
    [{ repaymentType: 'Fixed P&I' }, 'fixed, principal and interest'],
    [{ repaymentType: 'Fixed IO', ioYears: '3' }, 'fixed, interest only for 3 years'],
    [{ repaymentType: '' }, ''],
  ])('%o reads as "%s"', (s, want) => {
    expect(howItRepays(s as any)).toBe(want)
  })

  // Said once above the list. It used to sit under all six splits.
  it('states a shared purpose once, not on every line', () => {
    const s = text(deal(SIX, TWO_HOUSES))
    expect(s).toContain('All of it is investment borrowing.')
    expect(s.match(/investment borrowing/g)).toHaveLength(1)
  })
})

// NOTHING IS INVENTED. The only reason anybody writes down is the purpose of
// funds box; a split with nothing in it is a gap on the form, not a sentence to
// be made up here.
describe('a split with no reason recorded', () => {
  const bare = SIX.map(s => ({ ...s, fundsUsedFor: '' }))

  it('is flagged rather than explained', () => {
    const r = boxFour(deal(bare, TWO_HOUSES))
    expect(r.text).toMatch(/NOT RECORDED — nothing has been recorded to explain/)
    expect(r.gaps.map(g => g.what)).toContain('Purpose of funds on each split')
  })

  it('names which splits are missing it', () => {
    const one = [...SIX.slice(0, 3), { ...SIX[3], fundsUsedFor: '' }]
    const r = boxFour(deal(one, TWO_HOUSES))
    expect(r.text).toContain('Investment equity loan split')
    expect(r.text).toMatch(/explain the split:/)
  })

  it('says nothing at all when every split has its reason', () => {
    expect(boxFour(deal(SIX, TWO_HOUSES)).text).not.toMatch(/nothing has been recorded to explain/)
  })

  it('reasonFor invents nothing from a purpose alone', () => {
    expect(reasonFor({ purpose: 'investment' } as any)).toBe('')
  })
})

// A SPLIT AGAINST NOTHING IS NEVER DROPPED.
describe('a split with no security on it', () => {
  it('is listed under its own heading rather than vanishing', () => {
    const stray = [...SIX, split({ id: 'x', label: 'Unattached split', amount: '90,000', securityId: '' })]
    const s = text(deal(stray, TWO_HOUSES))
    expect(s).toContain('Not recorded against any of the securities above:')
    expect(s).toContain('Unattached split, $90,000')
  })
})

// AND EVERY OTHER DEAL READS EXACTLY AS IT DID.
describe('a single split deal is untouched', () => {
  const ONE = [split({ id: 'only', label: 'Loan to be refinanced', amount: '1,000,000', securityId: 'p1' })]

  it('still states the repayment type in the recommendation sentence', () => {
    const s = text(deal(ONE, [TWO_HOUSES[0]]))
    expect(s).toMatch(/has been recommended, on a .*rate of 6\.34% with principal and interest repayments over a thirty year term\./)
  })

  it('does not list a single split back to itself', () => {
    expect(text(deal(ONE, [TWO_HOUSES[0]]))).not.toContain('Secured by 16 Sample Street, Paddington:')
  })
})

describe('what the arranging itself returns', () => {
  it('knows the deal is mixed', () => {
    expect(lendingBySplit(deal(SIX, TWO_HOUSES)).mixed).toBe(true)
  })

  it('knows a deal that is not', () => {
    const allPI = SIX.map(s => ({ ...s, repaymentType: 'P&I', ioYears: '' }))
    expect(lendingBySplit(deal(allPI, TWO_HOUSES)).mixed).toBe(false)
  })

  it('drops a split with no money in it', () => {
    const withBlank = [...SIX, split({ id: 'blank', label: 'Empty', amount: '', securityId: 'p1' })]
    expect(lendingBySplit(deal(withBlank, TWO_HOUSES)).lines).toHaveLength(4)
  })
})

// THE OPENING SENTENCE NAMES THE HOUSES.
//
// 12 Oct 2026. On a three-property refinance it said the clients were borrowing
// "against the security recorded on this deal" - a placeholder, because
// compliance_data.securityAddress is one box and there were three houses. Box
// nine named all three immediately underneath it.
describe('the opening sentence', () => {
  it('names every security instead of the placeholder', () => {
    const s = text(deal(SIX, TWO_HOUSES))
    expect(s).toContain('against 16 Sample Street, Paddington and 7/22 Sample Road, Hawks Nest.')
    expect(s).not.toContain('the security recorded on this deal')
  })

  it('names the one, on a deal with one', () => {
    const one = [split({ id: 'only', label: 'Loan', amount: '1,000,000', securityId: 'p1' })]
    expect(text(deal(one, [TWO_HOUSES[0]]))).toContain('against 16 Sample Street, Paddington.')
  })

  // It must never name a property box nine does not, which is why both read the
  // same list in the same order.
  it('names the same houses box nine does', () => {
    const d = deal(SIX, TWO_HOUSES)
    const four = text(d)
    for (const addr of ['16 Sample Street, Paddington', '7/22 Sample Road, Hawks Nest']) {
      expect(four).toContain(addr)
      expect(boxNine(d).text).toContain(addr)
    }
  })

  it('falls back to the old line when nothing is recorded', () => {
    const bare = deal(SIX, [])
    bare.bc_data.securityIds = []
    bare.fact_find_data = { ...bare.fact_find_data, properties: [] }
    bare.bc_data.propertyValue = ''
    expect(text(bare)).toContain('the security recorded on this deal')
  })
})

// "They own ..., AN UNIT." See lib/a-or-an.test.ts for the rule itself.
describe('it writes a and an properly', () => {
  it('says a unit, not an unit', () => {
    const d = deal(SIX, TWO_HOUSES)
    expect(text(d)).toContain(', a unit.')
    expect(text(d)).not.toContain('an unit')
  })
})

// THE INTEREST ONLY PARAGRAPH SAYS WHICH MONEY IT IS ABOUT.
//
// 12 Oct 2026. flexibilityPassage() opens "Interest only repayments for the
// first 5 years keep the commitment as low as possible", which reads as the
// whole loan. On this deal half the money is principal and interest.
//
// Fabio approved one sentence in front of it. The paragraph itself is his and
// is not touched.
describe('the interest only paragraph, on a deal whose splits disagree', () => {
  it('says which splits it is talking about', () => {
    const s = text(deal(SIX, TWO_HOUSES))
    expect(s).toContain('Where splits are on interest only, the reasoning is as follows.')
  })

  it('puts that sentence immediately before the paragraph, not somewhere else', () => {
    const s = text(deal(SIX, TWO_HOUSES))
    const lead = s.indexOf('Where splits are on interest only, the reasoning is as follows.')
    const para = s.indexOf('Interest only repayments for')
    expect(lead).toBeGreaterThan(-1)
    expect(para).toBeGreaterThan(lead)
    expect(para - lead).toBeLessThan(80)
  })

  // The wording itself is untouched.
  it('leaves the paragraph exactly as it was', () => {
    expect(text(deal(SIX, TWO_HOUSES)))
      .toContain('keep the commitment as low as possible while')
  })

  it('adds nothing when every split is interest only', () => {
    const allIO = SIX.map(s => ({ ...s, repaymentType: 'Interest only', ioYears: '5' }))
    expect(text(deal(allIO, TWO_HOUSES))).not.toContain('Where splits are on interest only')
  })

  it('adds nothing when no split is interest only', () => {
    const allPI = SIX.map(s => ({ ...s, repaymentType: 'P&I', ioYears: '' }))
    const s = text(deal(allPI, TWO_HOUSES))
    expect(s).not.toContain('Where splits are on interest only')
  })

  it('adds nothing on a single split deal', () => {
    const one = [split({ id: 'only', label: 'Loan', amount: '1,000,000', securityId: 'p1', repaymentType: 'Interest only', ioYears: '5' })]
    expect(text(deal(one, [TWO_HOUSES[0]]))).not.toContain('Where splits are on interest only')
  })
})

// BOX ONE HAD THE SAME PLACEHOLDER BOX FOUR DID.
//
// 12 Oct 2026. Box four was fixed earlier the same day and this line was missed:
// on a three-property refinance box one still said the clients were borrowing
// "against the security recorded on this deal" while box nine named all three.
describe('box one names the securities too', () => {
  it('names them instead of the placeholder', () => {
    const s = boxOne(deal(SIX, TWO_HOUSES)).text.replace(/\s+/g, ' ')
    expect(s).toContain('against 16 Sample Street, Paddington and 7/22 Sample Road, Hawks Nest')
    expect(s).not.toContain('the security recorded on this deal')
  })

  it('names the same houses box four and box nine do', () => {
    const d = deal(SIX, TWO_HOUSES)
    for (const addr of ['16 Sample Street, Paddington', '7/22 Sample Road, Hawks Nest']) {
      expect(boxOne(d).text).toContain(addr)
      expect(boxFour(d).text).toContain(addr)
      expect(boxNine(d).text).toContain(addr)
    }
  })

  it('falls back to the old line when nothing is recorded', () => {
    const bare = deal(SIX, [])
    bare.bc_data.securityIds = []
    bare.fact_find_data = { ...bare.fact_find_data, properties: [] }
    bare.bc_data.propertyValue = ''
    bare.compliance_data = { ...bare.compliance_data, securityAddress: '' }
    expect(boxOne(bare).text).toContain('the security recorded on this deal')
  })
})

// THE DEAL STRIP STOPPED ASKING FOR A FOURTH ANSWER.
describe('the security address box on the deal strip', () => {
  const STRIP = readFileSync('components/DealStructure.tsx', 'utf8')

  it('reads the securities where the deal has them', () => {
    expect(STRIP).toContain('securitiesOf(deal)')
    expect(STRIP).toContain('From the fact find, ticked on the BC')
  })

  // The one case it was ever right for: a pre-approval with no property yet.
  it('keeps the typed box when there is nothing upstream to read', () => {
    expect(STRIP).toContain("setField('securityAddress'")
    expect(STRIP).toContain('Filled from the BC suburb because this is a pre-approval')
  })
})
