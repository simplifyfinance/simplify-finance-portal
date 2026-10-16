import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  canHaveManySecurities, securedByMany, securedHeading, securedAddresses,
  releaseTotal, groupsOf,
} from './complex-refinance'

// 16 Oct 2026. Fabio, with two securities ticked on a Refinance + equity
// release: "I want the same thing on refinance and equity release and refinance
// only ... the LO is working in the refinance equity template but the BC still
// has the old view - did you miss that?"
//
// I had. MANY_SECURITIES named two templates and neither was his. The form was
// one line. The EMAIL was not, and that is what these tests are mostly about:
// those templates print the deal-level existingLoanBal and equityRelease, and
// those are the exact two boxes that leave the form once each property carries
// its own.

const TWO_HOUSES = {
  template: 'refinance_equity',
  securityIds: ['p1', 'p2'],
  securityBalances: { p1: '495,000', p2: '111,000' },
  securityReleases: { p1: '115,000', p2: '685,000' },
  securityLimits:   { p1: '610,000', p2: '796,000' },
  ffProperties: [
    { id: 'p1', address: '10/5 Kinsellas Road, Mango Hill QLD 4509', value: '830,000' },
    { id: 'p2', address: '15/15 Alter St, Wynnum West QLD 4178', value: '995,000' },
  ],
  splits: [
    { label: 'Existing loan refinanced', amount: '610,000', rate: '6.64', securityId: 'p1' },
    { label: 'Equity release', amount: '685,000', rate: '6.89', securityId: 'p2' },
    { label: 'Existing loan refinanced', amount: '111,000', rate: '6.64', securityId: 'p2' },
  ],
}

describe('the two templates Fabio asked for', () => {
  it.each([['refinance_equity'], ['refinance_only']])('%s can have more than one security', t => {
    expect(canHaveManySecurities(t)).toBe(true)
  })

  it('and the two that already could still can', () => {
    expect(canHaveManySecurities('complex_refinance')).toBe(true)
    expect(canHaveManySecurities('investment_equity')).toBe(true)
  })

  it('a straight purchase still cannot', () => {
    expect(canHaveManySecurities('oo_purchase')).toBe(false)
    expect(canHaveManySecurities('fhb')).toBe(false)
  })
})

describe('"can have" and "has" are not the same question', () => {
  // THIS IS THE ONE THAT PROTECTS EVERY DEAL ALREADY RECORDED. A refinance
  // where nobody ticked a security still has its suburb, its balance and its
  // release filled in, and must keep printing the email it has always printed.
  it('a refinance with nothing ticked is not secured by many', () => {
    expect(securedByMany({ template: 'refinance_equity' })).toBe(false)
    expect(securedByMany({ template: 'refinance_equity', securityIds: [] })).toBe(false)
    expect(securedByMany({ template: 'refinance_equity', securityIds: [''] })).toBe(false)
  })

  it('and a purchase is never secured by many however it is filled in', () => {
    expect(securedByMany({ template: 'oo_purchase', securityIds: ['p1', 'p2'] })).toBe(false)
  })

  it('two ticked on a template that allows it is', () => {
    expect(securedByMany(TWO_HOUSES)).toBe(true)
  })

  it('one ticked counts too - the card still has to name it', () => {
    expect(securedByMany({ ...TWO_HOUSES, securityIds: ['p1'] })).toBe(true)
  })
})

describe('each property carries its own balance and release', () => {
  const groups = groupsOf(TWO_HOUSES)

  it('a card per house, in the order the splits put them', () => {
    expect(groups.map(g => g.property)).toEqual([
      '10/5 Kinsellas Road, Mango Hill QLD 4509',
      '15/15 Alter St, Wynnum West QLD 4178',
    ])
  })

  it('and the figures belong to the house they are printed on', () => {
    expect(groups[0].balance).toBe(495000)
    expect(groups[0].release).toBe(115000)
    expect(groups[0].limit).toBe(610000)
    expect(groups[1].balance).toBe(111000)
    expect(groups[1].release).toBe(685000)
    expect(groups[1].limit).toBe(796000)
  })

  it('drawn is the splits on that house, not the whole deal', () => {
    expect(groups[0].drawn).toBe(610000)
    expect(groups[1].drawn).toBe(796000)
  })

  // THE DEAL-LEVEL BOXES ARE NOT A FALLBACK. One old balance printed against
  // the first house is a specific claim about a specific property.
  it('a deal-level balance is never borrowed for a property', () => {
    const borrowed = groupsOf({ ...TWO_HOUSES, securityBalances: {}, securityReleases: {},
                                existingLoanBal: '606,000', equityRelease: '800,000' })
    expect(borrowed[0].balance).toBe(0)
    expect(borrowed[0].release).toBe(0)
  })

  it('"Other lending" is not a house, so it owes nothing and releases nothing', () => {
    const orphaned = groupsOf({ ...TWO_HOUSES,
      splits: [...TWO_HOUSES.splits, { label: 'Unassigned', amount: '50,000' }] })
    const other = orphaned.find(g => g.property === '')!
    expect(other.balance).toBe(0)
    expect(other.release).toBe(0)
    expect(other.limit).toBe(0)
  })
})

describe('the houses get named', () => {
  it('both of them, in a sentence', () => {
    expect(securedHeading(TWO_HOUSES))
      .toBe('10/5 Kinsellas Road, Mango Hill QLD 4509 and 15/15 Alter St, Wynnum West QLD 4178')
  })

  it('unassigned splits are not named - "Against Other lending" is not a sentence', () => {
    const withOrphan = { ...TWO_HOUSES,
      splits: [...TWO_HOUSES.splits, { label: 'Unassigned', amount: '50,000' }] }
    expect(securedAddresses(withOrphan)).toHaveLength(2)
    expect(securedHeading(withOrphan)).not.toContain('Other lending')
  })

  it('and nothing ticked names nothing, so the caller can fall back', () => {
    expect(securedHeading({ template: 'refinance_equity', splits: [] })).toBe('')
  })
})

describe('the equity figure in the opening sentence', () => {
  it('adds the releases up across the houses', () => {
    expect(releaseTotal(TWO_HOUSES)).toBe(800000)
  })

  it('falls back to the old single box when nothing is ticked', () => {
    expect(releaseTotal({ template: 'refinance_equity', equityRelease: '115,000' })).toBe(115000)
  })

  it('and is zero rather than a guess when there is neither', () => {
    expect(releaseTotal({ template: 'refinance_equity' })).toBe(0)
  })
})

describe('the email route reads the answer rather than the old boxes', () => {
  const src = readFileSync('app/api/generate-email/route.ts', 'utf8')

  // 16 Oct 2026. These two asserted that Refinance only and Refinance + equity
  // release both rendered the Complex refinance layout once securities were
  // ticked. Fabio, on a straight refinance of two houses: "why did you decide
  // to change the html template - that is not an approved template."
  //
  // He had not approved it, and it did not fit: "Equity released $0" on a deal
  // releasing nothing, and $129,000 printed three times as Limit, Refinanced
  // loan and Drawn. Refinance only now gets its OWN approved card, twice - see
  // refinanceBoxes() - and Refinance + equity release goes back to the email it
  // has always sent until a layout for it is drawn and approved.
  it('the grouped property cards belong to complex refinance', () => {
    expect(src).toContain('function propertyCards(')
    expect((src.match(/propertyCards\(d\)/g) || []).length).toBe(1)
  })

  it('refinance only prints its own approved card, once per security', () => {
    expect(src).toContain("template === 'refinance_only' && securedByMany(d)")
    expect(src).toContain('function refinanceBoxes(')
    expect(src).toContain('refinanceBoxes(d)')
  })

  it('and refinance + equity release has no second layout at all', () => {
    expect(src).not.toContain("template === 'refinance_equity' && securedByMany(d)")
  })

  // A ZERO IS NOT A FIGURE. money(0) is "$0", which rowIf reads as one.
  it('no card prints a row for a release of nothing', () => {
    expect(src).not.toContain("rowIf('Equity released'")
    expect(src).toContain("g.release > 0 ? row('Equity released'")
  })

  it('and the old single-property branches are still there underneath', () => {
    // Every refinance recorded before today goes down these. Deleting them
    // would silently re-shape email for deals nobody has touched.
    expect(src).toContain("} else if (template === 'refinance_equity') {")
    expect(src).toContain("} else if (template === 'refinance_only') {")
  })

  // 16 Oct 2026, corrected the same day. The first version of this returned
  // nothing at all when a deal had several securities - right that one suburb
  // box cannot name two houses, wrong about what to do instead. Refinance +
  // equity release then named no property anywhere in its email, because its
  // Split 1 and Split 2 cards carry no address either.
  it('"Against {suburb}" gives way to the securities, which are named', () => {
    expect(src).toContain('const named = securedHeading(d)')
    expect(src).toContain('propHead(`Against ${named}`')
  })

  // 15 Oct 2026 shipped the securities block on Equity release + purchase and
  // left its email heading reading one suburb. It is live and has never been
  // sent through.
  it('equity release + purchase names the ticked securities, not the suburb box', () => {
    expect(src).toContain("securedHeading(d) || d.suburb || '[Existing Property]'")
  })
})

describe('the form says when a security has no money on it', () => {
  const form = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

  it('because a house with no split never opens a card in the email', () => {
    expect(form).toContain('will not appear in the client email')
  })
})
