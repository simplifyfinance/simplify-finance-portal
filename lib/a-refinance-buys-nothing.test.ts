import { describe, it, expect } from 'vitest'
import { securitiesOf } from './box-security'
import { isBuying, buysNothing, BUYING_TEMPLATES, NOT_BUYING_TEMPLATES } from './buying'

// A REFINANCE MUST NEVER CLAIM A PURCHASE IN A COMPLIANCE PACK.
//
// 12 Oct 2026. The borrowing capacity form drew a Purchase price box on a
// complex refinance, because each box was hidden by its own hand-written list of
// templates and complex refinance was never added to any of them.
//
// For a while this looked like clutter: the complex refinance client email never
// reads those boxes. It is not clutter. lib/box-security.ts asked one question -
// is there a purchase price? - and if there was, box nine of the compliance pack
// states that a property is being purchased for that amount. So a figure typed
// into a box that should not have been on screen would put a purchase into a
// regulated document for a deal where nothing is being bought.
//
// The box is going from the form. This test is about the pack, which must not
// depend on the form remembering to hide a box - and about the deals where
// somebody already typed one before today.
const deal = (bc: any, props: any[] = []) => ({ bc_data: bc, fact_find_data: { properties: props } })

describe('box nine, on a scenario where nothing is bought', () => {
  it.each([['complex_refinance'], ['refinance_only'], ['refinance_equity'], ['debt_recycling']])(
    '%s with a stray purchase price names no purchase', (template) => {
      const out = securitiesOf(deal({ template, purchasePrice: '1,000,000' }))
      expect(out.filter(s => s.kind === 'purchase')).toHaveLength(0)
    })

  it('the ticked securities are still named', () => {
    const out = securitiesOf(deal(
      { template: 'complex_refinance', purchasePrice: '1,000,000', securityIds: ['p1', 'p2'] },
      [
        { id: 'p1', address: '16 Mock Street Paddington', value: '2,200,000', ownershipType: 'Investment' },
        { id: 'p2', address: '7/22 Mock Street Hawks Nest', value: '600,000', ownershipType: 'Investment' },
        { id: 'p3', address: '19 Mock Road Oatlands', value: '900,000', ownershipType: 'Owner occupied' },
      ]))
    expect(out.map(s => s.kind)).toEqual(['existing', 'existing'])
    expect(out.map(s => s.address)).toEqual(['16 Mock Street Paddington', '7/22 Mock Street Hawks Nest'])
  })
})

describe('and every other deal is left exactly as it was', () => {
  it('a purchase still names its purchase', () => {
    const out = securitiesOf(deal({ template: 'oo_purchase', purchasePrice: '1,000,000' }))
    expect(out.filter(s => s.kind === 'purchase')).toHaveLength(1)
    expect(out[0].value).toBe(1000000)
  })

  // An unknown template is not an answer either way, so nothing about it changes.
  it.each([[''], ['custom'], [undefined]])('a deal on template %s is untouched', (template) => {
    const out = securitiesOf(deal({ template, purchasePrice: '850,000' }))
    expect(out.filter(s => s.kind === 'purchase')).toHaveLength(1)
  })
})

describe('the one list both the form and the pack read', () => {
  it('no template is on both lists', () => {
    const both = (BUYING_TEMPLATES as readonly string[]).filter(t =>
      (NOT_BUYING_TEMPLATES as readonly string[]).includes(t))
    expect(both).toEqual([])
  })

  it('buysNothing is not simply the opposite of isBuying', () => {
    expect(isBuying('custom')).toBe(false)
    expect(buysNothing('custom')).toBe(false)
  })

  it('complex refinance is on the list that was missing it', () => {
    expect(buysNothing('complex_refinance')).toBe(true)
    expect(isBuying('complex_refinance')).toBe(false)
  })
})
