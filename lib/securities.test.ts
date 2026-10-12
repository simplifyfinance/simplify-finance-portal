// MULTIPLE SECURITIES, AND THE THINGS THAT MUST NOT HAPPEN QUIETLY.
//
// 12 Oct 2026. A complex refinance could already name a property on each split,
// by typing it. These tests exist because of the four ways that failed, and
// each one is named below so a later change has to argue with the reason rather
// than just the assertion.
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
// limitOf is aliased: lib/securities.ts exports one too - by id, returning the
// typed string - and two things of that name in one file is how the wrong one
// gets asserted against. This is the email's, which resolves both shapes and
// returns a number.
import { groupsOf, propertyOf, limitOf as crLimitOf,
         everySplitHasAProperty, UNASSIGNED } from './complex-refinance'
import {
  securitiesOf, securityIdsOf, isSecurity, limitOf, lvrOf, totalsOf,
  groupBySecurity, orphanSplits, securityLines, totalLine, legacyMatch,
  legacyAddress, pct, ffProperties,
} from './securities'

const ff = {
  properties: [
    { id: 'p1', address: '12 Smith St, Hawthorn', ownershipType: 'Owner occupied',
      propertySubtype: 'Fully detached house', value: '1,150,000' },
    { id: 'p2', address: '7 Elgin Ave, Carnegie', ownershipType: 'Investment',
      propertySubtype: 'Fully detached house', value: '780,000' },
    { id: 'p3', address: '3/22 Garnet Rd, Thornbury', ownershipType: 'Investment',
      propertySubtype: 'Apartment', value: '540,000' },
    { id: 'p4', address: '14 Bowen Cr, Reservoir', ownershipType: 'Investment',
      propertySubtype: 'Fully detached house', value: '610,000' },
  ],
}
const bc = {
  securityIds: ['p1', 'p2', 'p3'],
  securityLimits: { p1: '600,000', p2: '310,000', p3: '95,000' },
}
const splits = [
  { label: 'Split 1', amount: '420,000', securityId: 'p1' },
  { label: 'Split 2', amount: '180,000', securityId: 'p1' },
  { label: 'Split 3', amount: '310,000', securityId: 'p2' },
  { label: 'Split 4', amount: '95,000',  securityId: 'p3' },
]

describe('which properties are security', () => {
  it('only the ticked ones, in fact find order', () => {
    expect(securitiesOf(bc, ff).map(s => s.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('a property on the fact find that is not ticked is not security', () => {
    expect(isSecurity(bc, 'p4')).toBe(false)
    expect(securitiesOf(bc, ff).find(s => s.id === 'p4')).toBeUndefined()
  })

  it('a ticked id whose property is gone is dropped, not drawn blank', () => {
    // A property deleted off the fact find is not a security with no name.
    const s = securitiesOf({ ...bc, securityIds: ['p1', 'ghost'] }, ff)
    expect(s.map(x => x.id)).toEqual(['p1'])
  })

  it('a deal with nothing ticked has no securities and does not throw', () => {
    expect(securitiesOf({}, ff)).toEqual([])
    expect(securityIdsOf(null)).toEqual([])
    expect(ffProperties(null)).toEqual([])
  })

  it('the use comes off the property, never off the split', () => {
    // Owner occupied or investment belongs to the house. Asking twice is how
    // the two end up disagreeing on the same deal.
    const s = securitiesOf(bc, ff)
    expect(s[0].use).toBe('Owner occupied')
    expect(s[1].use).toBe('Investment')
  })

  it('the value is read live, not copied onto the BC', () => {
    const corrected = { properties: ff.properties.map(p => p.id === 'p1' ? { ...p, value: '1,250,000' } : p) }
    expect(securitiesOf(bc, corrected)[0].value).toBe('1,250,000')
  })

  it('and falls back to the RP Data figure rather than nothing', () => {
    const noOwn = { properties: [{ id: 'p1', address: 'x', value: '', rpDataEstimatedValue: '900,000' }] }
    expect(securitiesOf({ securityIds: ['p1'] }, noOwn)[0].value).toBe('900,000')
  })
})

describe('the LVRs a lender actually assesses', () => {
  it('one security at a time', () => {
    const s = securitiesOf(bc, ff)
    expect(pct(lvrOf(s[0]))).toBe('52.2%')
    expect(pct(lvrOf(s[1]))).toBe('39.7%')
  })

  it('and across all of them, which could not be worked out before', () => {
    const t = totalsOf(securitiesOf(bc, ff))
    expect(t.value).toBe(2470000)
    expect(t.limit).toBe(1005000)
    expect(pct(t.lvr)).toBe('40.7%')
  })

  it('a missing value is not a low LVR, it is no LVR', () => {
    // Zero is a number somebody reads as "no debt". Null is a question.
    expect(lvrOf({ value: '', limit: '500,000' })).toBeNull()
    expect(lvrOf({ value: '800,000', limit: '' })).toBeNull()
    expect(pct(null)).toBe('')
  })

  it('and one unvalued security makes the total say so', () => {
    const half = { properties: ff.properties.map(p => p.id === 'p3' ? { ...p, value: '' } : p) }
    const t = totalsOf(securitiesOf(bc, half))
    expect(t.valuedAll).toBe(false)
    expect(totalLine(t)).toContain('understated')
  })
})

describe('which split sits against which house', () => {
  it('grouped by security, with what is drawn and what is not', () => {
    const g = groupBySecurity(splits, securitiesOf(bc, ff))
    expect(g[0].splits.length).toBe(2)
    expect(g[0].drawn).toBe(600000)
    expect(g[0].undrawn).toBe(0)
    expect(g[2].drawn).toBe(95000)
  })

  it('a limit above what is drawn is said, not swallowed', () => {
    const roomy = { ...bc, securityLimits: { ...bc.securityLimits, p2: '400,000' } }
    const g = groupBySecurity(splits, securitiesOf(roomy, ff))
    expect(g[1].undrawn).toBe(90000)
  })

  it('an empty row the form is carrying is not a split', () => {
    const g = groupBySecurity([...splits, { label: 'Split 5', amount: '' }], securitiesOf(bc, ff))
    expect(g.reduce((t, x) => t + x.splits.length, 0)).toBe(4)
  })
})

describe('a split against nothing is named, never hidden', () => {
  it('no security at all', () => {
    // THIS IS THE ONE THAT USED TO VANISH. Money in the structure that no
    // property is carrying, dropped silently out of the grouping.
    const o = orphanSplits([...splits, { label: 'Split 5', amount: '50,000' }], securitiesOf(bc, ff))
    expect(o.map(s => s.label)).toEqual(['Split 5'])
  })

  it('or pointing at a security somebody has since unticked', () => {
    const fewer = securitiesOf({ ...bc, securityIds: ['p1', 'p2'] }, ff)
    expect(orphanSplits(splits, fewer).map(s => s.label)).toEqual(['Split 4'])
  })

  it('and nothing is quietly reassigned to make the numbers tidy', () => {
    const fewer = securitiesOf({ ...bc, securityIds: ['p1', 'p2'] }, ff)
    const g = groupBySecurity(splits, fewer)
    expect(g.reduce((t, x) => t + x.drawn, 0)).toBe(910000)
  })
})

describe('compliance stops being typed out by hand', () => {
  const lines = securityLines(securitiesOf(bc, ff))

  it('one line per security, with its use, type, value and limit', () => {
    expect(lines.length).toBe(3)
    expect(lines[0]).toContain('12 Smith St, Hawthorn')
    expect(lines[0]).toContain('owner occupied, fully detached house')
    expect(lines[0]).toContain('52.2% LVR')
    expect(lines[2]).toContain('apartment')
  })

  it('a security with no limit says so rather than printing a 0% LVR', () => {
    const l = securityLines(securitiesOf({ securityIds: ['p4'] }, ff))
    expect(l[0]).toContain('No limit recorded')
    expect(l[0]).not.toContain('0% LVR')
  })

  it('and the total line is the one an assessor asks for', () => {
    expect(totalLine(totalsOf(securitiesOf(bc, ff)))).toContain('overall LVR of 40.7%')
  })
})

describe('deals recorded before today', () => {
  it('link only where the address is exactly the same', () => {
    expect(legacyMatch('12 Smith St, Hawthorn', ff.properties)).toBe('p1')
    expect(legacyMatch('  12 SMITH ST, HAWTHORN  ', ff.properties)).toBe('p1')
  })

  it('and NEVER on a near miss, however obvious it looks', () => {
    // "St" against "Street" is the portal deciding which house a loan is
    // against - and it is wrong on the deal where the client owns both.
    expect(legacyMatch('12 Smith Street, Hawthorn', ff.properties)).toBe('')
    expect(legacyMatch('12 Smith', ff.properties)).toBe('')
    expect(legacyMatch('', ff.properties)).toBe('')
  })

  it('an unlinked split keeps showing what somebody typed', () => {
    expect(legacyAddress({ property: '12 Smith Street, Hawthorn' })).toBe('12 Smith Street, Hawthorn')
    expect(legacyAddress({ securityId: 'p1', property: 'anything' })).toBe('')
  })
})


// ---------------------------------------------------------------------------
// WHERE THE OLD WORDS WENT.
//
// lib/nothing-is-lost.snapshot.json found two readable strings on the BC that
// are no longer there, and both were replaced on purpose on 12 Oct 2026:
//
//   "Limit approved against each property"  ->  "Securities for this loan"
//   "Which property is this against?"       ->  "Which security is this against?"
//
// The first listed whatever the splits had TYPED, keyed by the address string.
// The second was the box that let them type it. Neither survives the change,
// because the change IS that a security is picked rather than written - so the
// replacements are pinned here instead of the snapshot simply shrinking.
describe('the words on the BC that replaced the typed ones', () => {
  const ui = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

  it('the block is about securities now, not typed addresses', () => {
    expect(ui).toContain('Securities for this loan')
    expect(ui).toContain('Tick the ones this loan is secured by')
  })

  it('and the split picks one rather than having it typed', () => {
    expect(ui).toContain('Which security is this against?')
    expect(ui, 'the free-text property box is back').not.toContain('list="bc-ff-properties"')
  })

  it('a deal with no properties on the fact find is told why, not left blank', () => {
    expect(ui).toContain('nothing to secure this against')
  })

  it('splits against nothing are named on screen', () => {
    expect(ui).toContain('not against any security')
  })

  it('an understated total says so rather than looking precise', () => {
    expect(ui).toContain('the total is understated')
  })
})

describe('it reaches the other two tabs', () => {
  it('lending options carries the security and shows the real LVR', () => {
    const lo = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')
    expect(lo).toContain('securityId')
    expect(lo).toContain('Secured by')
    expect(lo, 'the single-property LVR is still presented as the answer')
      .toContain('measures against a single property value')
  })

  it('compliance follows the ticked list when there is one', () => {
    const box = readFileSync('lib/box-security.ts', 'utf8')
    expect(box).toContain('securityIds')
    // And the old inference survives for every deal that has not ticked one.
    expect(box).toContain('REFINANCING.includes')
  })
})


// ---------------------------------------------------------------------------
// AND THE CLIENT EMAIL STILL DRAWS ONE CARD PER HOUSE.
//
// 12 Oct 2026. This is the test that should have existed before the BC was
// touched at all, and its absence is why a1d6c40 shipped broken.
//
// The complex refinance email groups its property cards by reading the address
// off each split. The securities change replaced that typed address with an id,
// so every split on a new deal landed in "Other lending" and the client got ONE
// unheaded card holding all their money instead of a card per property - the
// single thing the template exists to do. Every test passed. Nothing covered
// the email.
//
// Fabio found it by asking what the email looked like.
describe('the email finds the houses by id', () => {
  const ffProps = [
    { id: 'p1', address: '18 Rowallan Pde, Blackburn', value: '1,320,000' },
    { id: 'p2', address: '9 Finchley St, Coburg', value: '910,000' },
    { id: 'p3', address: '2/44 Ardoyne Rd, Yarraville', value: '640,000' },
  ]
  // Three properties, two splits each - the shape Fabio asked about.
  const six = [
    { label: 'Split 1', amount: '540,000', securityId: 'p1' },
    { label: 'Split 2', amount: '160,000', securityId: 'p1' },
    { label: 'Split 3', amount: '395,000', securityId: 'p2' },
    { label: 'Split 4', amount: '60,000',  securityId: 'p2' },
    { label: 'Split 5', amount: '330,000', securityId: 'p3' },
    { label: 'Split 6', amount: '45,000',  securityId: 'p3' },
  ]
  const bc = {
    template: 'complex_refinance', splits: six, ffProperties: ffProps,
    securityLimits: { p1: '780,000', p2: '455,000', p3: '375,000' },
  }

  it('three houses, three cards, two splits in each', () => {
    const g = groupsOf(bc)
    expect(g.length).toBe(3)
    expect(g.map(x => x.heading)).toEqual(ffProps.map(p => p.address))
    expect(g.map(x => x.splits.length)).toEqual([2, 2, 2])
  })

  it('and NOT one card called Other lending', () => {
    // The exact shape of the break.
    expect(groupsOf(bc).map(x => x.heading)).not.toContain(UNASSIGNED)
  })

  it('each card totals its own splits', () => {
    expect(groupsOf(bc).map(x => x.drawn)).toEqual([700000, 455000, 375000])
  })

  it('the limit is found by id, and what is undrawn is still said', () => {
    const g = groupsOf(bc)
    expect(g[0].limit).toBe(780000)
    expect(g[0].undrawn).toBe(80000)
    expect(g[1].undrawn).toBe(0)
  })

  it('and the value still comes off the fact find list', () => {
    expect(groupsOf(bc)[0].value).toBe('$1,320,000')
  })
})

describe('deals recorded before the change still read', () => {
  const typed = {
    template: 'complex_refinance',
    splits: [
      { label: 'Split 1', amount: '420,000', property: '12 Smith St, Hawthorn' },
      { label: 'Split 2', amount: '310,000', property: '7 Elgin Ave, Carnegie' },
    ],
    propertyLimits: { '12 Smith St, Hawthorn': '600,000' },
  }

  it('the typed address still groups them', () => {
    expect(groupsOf(typed).map(g => g.heading))
      .toEqual(['12 Smith St, Hawthorn', '7 Elgin Ave, Carnegie'])
  })

  it('and the old address-keyed limit is still found', () => {
    expect(crLimitOf(typed, '12 Smith St, Hawthorn')).toBe(600000)
  })

  it('a split with neither is unassigned and says so', () => {
    const none = { splits: [{ label: 'Split 1', amount: '50,000' }] }
    expect(groupsOf(none)[0].heading).toBe(UNASSIGNED)
    expect(everySplitHasAProperty(none)).toBe(false)
  })

  it('an id pointing at a property that is gone is unassigned, not a blank heading', () => {
    const ghost = { splits: [{ label: 'Split 1', amount: '50,000', securityId: 'gone' }],
                    ffProperties: [{ id: 'p1', address: 'somewhere' }] }
    expect(propertyOf(ghost.splits[0], ghost)).toBe('')
    expect(groupsOf(ghost)[0].heading).toBe(UNASSIGNED)
  })
})

describe('the id reaches the email at all', () => {
  it('the BC puts it on the payload the email reads', () => {
    const ui = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
    const at = ui.indexOf('ffProperties:')
    expect(at).toBeGreaterThan(-1)
    // Without the id on this list there is nothing for propertyOf to resolve
    // against, and every card collapses into one.
    expect(ui.slice(at, at + 200)).toContain('id:')
  })
})
