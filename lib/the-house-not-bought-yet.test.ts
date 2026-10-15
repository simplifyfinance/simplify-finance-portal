import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  BEING_PURCHASED, BEING_PURCHASED_LABEL, isBeingPurchased, purchaseLending,
  groupBySecurity, orphanSplits, type Security,
} from './securities'

// 15 Oct 2026. Fabio, on an equity release and purchase secured by two houses:
// "the deal structure is not allocating the new loan to the TBA security (new
// security) hence why you are getting all this issues."
//
// The real deal: Alter Street $995,000 carrying $506,000 + $290,000 + $438,000
// because the New purchase split had nowhere else to go. 124% against a
// property, which is not true of any house on the file.

const alter: Security = { id: 'p-alter', address: '15/15 Alter St', use: 'Investment',
                          subtype: 'Unit', value: '995,000', limit: '' }
const mango: Security = { id: 'p-mango', address: '10/5 Kinsellas Rd', use: 'Investment',
                          subtype: 'Unit', value: '830,000', limit: '' }

const splits = [
  { label: 'Existing loan refinanced', amount: '506,000', securityId: 'p-alter' },
  { label: 'Equity access',            amount: '290,000', securityId: 'p-alter' },
  { label: 'Existing loan refinanced', amount: '610,000', securityId: 'p-mango' },
  { label: 'New purchase',             amount: '438,000', securityId: BEING_PURCHASED },
]

describe('the new purchase no longer lands on somebody else-s house', () => {
  const groups = groupBySecurity(splits, [alter, mango])

  it('Alter Street carries only what is actually against it', () => {
    const g = groups.find(x => x.security.id === 'p-alter')!
    expect(g.drawn).toBe(796000)          // 506 + 290, NOT 1,234,000
    expect(g.drawn / 995000).toBeLessThan(1)
  })

  it('which is 80%, not 124%', () => {
    const g = groups.find(x => x.security.id === 'p-alter')!
    expect(Math.round((g.drawn / 995000) * 100)).toBe(80)
  })

  it('and Mango Hill is untouched by any of it', () => {
    expect(groups.find(x => x.security.id === 'p-mango')!.drawn).toBe(610000)
  })
})

describe('it is lending, not a mistake', () => {
  it('is NOT flagged as an orphan', () => {
    // An orphan is money nobody has thought about. This is money with a house
    // that does not exist yet. Flagging it trains people to ignore the warning.
    expect(orphanSplits(splits, [alter, mango])).toHaveLength(0)
  })

  it('a split pointing at a security that was unticked IS still an orphan', () => {
    const gone = [...splits, { label: 'Stray', amount: '50,000', securityId: 'p-sold' }]
    expect(orphanSplits(gone, [alter, mango])).toHaveLength(1)
  })

  it('and it can be counted on its own', () => {
    expect(purchaseLending(splits)).toBe(438000)
    expect(isBeingPurchased(splits[3])).toBe(true)
    expect(isBeingPurchased(splits[0])).toBe(false)
  })
})

describe('the dropdown offers it', () => {
  const form = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

  it('on a scenario that buys something', () => {
    expect(form).toContain('BEING_PURCHASED')
    expect(form).toContain('!buysNothing(template) && (')
  })

  it('and the label says plainly that there is no address yet', () => {
    expect(BEING_PURCHASED_LABEL).toContain('TBA')
  })
})
