import { describe, it, expect } from 'vitest'
import { positionsOf, positionLine, securitiesWithPurchase, BEING_PURCHASED } from './securities'
import { purposeFromTheProperty, normalisePurpose } from './split-purpose'
import { purposeSummary, splitsOf } from './deal-structure'
import { fundsToComplete } from './funds-to-complete'

// 16 Oct 2026. The compliance tab refused to compose the lender's submission
// notes on an Equity release + purchase, listing three things as not recorded.
// Fabio: "did we remove the purpose of the loan? also you know from BC that
// equity is being used to purchase the property, why do you ask??"
//
// Nothing had been removed and nothing was missing. Three figures were on the
// deal and this side of the portal was reading different boxes:
//
//   stamp duty   the BC writes newPurchaseStampDuty; this read bc.stampDuty
//   deposit      the equity release IS the contribution; this read bc.deposit
//   purpose      the dropdown is drawn on two templates out of fifteen, while
//                both securities say "Investment" on the fact find
//
// The client email had read the first two for weeks, which is why the BC email
// was right and the compliance tab was not.

const FF = {
  properties: [
    { id: 'p1', address: '10 Example Road, Mango Hill QLD 4509', value: '830,000',
      ownershipType: 'Investment' },
    { id: 'p2', address: '15 Sample Street, Wynnum West QLD 4178', value: '995,000',
      ownershipType: 'Investment' },
  ],
}

const BC = {
  template: 'investment_equity',
  securityIds: ['p1', 'p2'],
  purchasePrice: '700,000',
  newPurchaseStampDuty: '17,500',
  equityRelease: '290,000',
  propertyType: 'Investment',
  loanTerm: '30',
  splits: [
    { label: 'Existing loan refinanced', amount: '610,000', securityId: 'p1' },
    { label: 'Existing loan refinanced', amount: '506,000', securityId: 'p2' },
    { label: 'New purchase',             amount: '449,000', securityId: BEING_PURCHASED },
    { label: 'Equity access',            amount: '290,000', securityId: 'p2' },
  ],
}

const DEAL = { loan_amount: 1855000, bc_data: BC, fact_find_data: FF }

describe('the figures the BC is already holding', () => {
  const f = fundsToComplete(DEAL)

  it('the stamp duty on the new purchase block counts as stamp duty', () => {
    expect(f.missing).not.toContain('Stamp duty has not been recorded')
    expect(f.lines.find(l => l.label === 'Stamp duty')?.amount).toBe(17500)
  })

  it('and the equity release is the deposit on the scenario built to say so', () => {
    expect(f.missing).not.toContain('No deposit has been recorded')
    expect(f.deposit).toBe(290000)
  })

  it('but an equity release on a refinance is NOT a deposit', () => {
    // There is nothing to complete on a refinance, and counting a release as a
    // contribution would be the portal inventing a settlement.
    const refi = { ...DEAL, bc_data: { ...BC, template: 'refinance_equity' } }
    expect(fundsToComplete(refi).deposit).toBeNull()
  })

  it('and a typed deposit still beats both', () => {
    const typed = { ...DEAL, bc_data: { ...BC, deposit: '120,000' } }
    expect(fundsToComplete(typed).deposit).toBe(120000)
  })
})

describe('owner occupied or investment, read off the house', () => {
  it('a split takes the use recorded against the property it sits on', () => {
    expect(purposeFromTheProperty(DEAL, 'p1')).toBe('INV')
    expect(purposeFromTheProperty(DEAL, 'p2')).toBe('INV')
  })

  it('and the house being bought takes the use recorded on the BC', () => {
    expect(purposeFromTheProperty(DEAL, BEING_PURCHASED)).toBe('INV')
    expect(purposeFromTheProperty(
      { bc_data: { newPurchasePropertyType: 'Owner occupied' } }, BEING_PURCHASED)).toBe('OO')
  })

  it('a split against no house stays unanswered - nothing is defaulted', () => {
    expect(purposeFromTheProperty(DEAL, '')).toBe('')
    expect(purposeFromTheProperty(DEAL, 'gone')).toBe('')
    expect(purposeFromTheProperty({ bc_data: {}, fact_find_data: { properties: [
      { id: 'p9', address: 'x', ownershipType: '' }] } }, 'p9')).toBe('')
  })

  it('and a purpose typed anywhere still wins over the property', () => {
    const typed = { ...DEAL, bc_data: { ...BC,
      splits: [{ label: 'Private', amount: '50,000', securityId: 'p1', purpose: 'owner_occupied' }] } }
    expect(splitsOf(typed)[0].purpose).toBe('OO')
    expect(normalisePurpose('owner_occupied')).toBe('OO')
  })

  // THE COMPLAINT, GONE. This is what the Compliance tab was refusing over.
  it('so the notes can say what kind of lending this is', () => {
    expect(purposeSummary(DEAL)).toBe('Investment')
  })
})

describe('one line per property, not one ratio across all of them', () => {
  const positions = positionsOf(securitiesWithPurchase(BC, FF), splitsOf(DEAL))

  it('a position per security, in the order they are ticked', () => {
    expect(positions.map(p => p.security.id)).toEqual(['p1', 'p2', BEING_PURCHASED])
  })

  it('lending is the splits on that house, not the whole deal', () => {
    expect(positions.map(p => p.lending)).toEqual([610000, 796000, 449000])
  })

  // The averaged 73.5% said none of these three.
  //
  // Rounded the same way lib/funds-to-complete.ts and the deal structure block
  // round, so the notes and the screen beside them cannot print two different
  // figures for one house. 449,000 / 700,000 is 64.142..., which is 64.1.
  it('and each house gets its own ratio', () => {
    expect(positions.map(p => p.lvr)).toEqual([73.5, 80, 64.1])
  })

  it('the line names the house, its use, its value, its lending and its ratio', () => {
    expect(positionLine(positions[1]))
      .toBe('15 Sample Street, Wynnum West QLD 4178 — investment, valued at $995,000, '
          + 'lending of $796,000 against it, a loan to value ratio of 80%.')
  })

  it('a house with nothing recorded says so rather than reading as zero risk', () => {
    const bare = positionsOf([{ id: 'p9', address: '1 Nowhere St', use: '', subtype: '',
                                value: '', limit: '' }], [])
    expect(positionLine(bare[0]))
      .toBe('1 Nowhere St — no value recorded, no lending recorded against it.')
    expect(bare[0].lvr).toBeNull()
  })

  it('the typed limit is the fallback when no split points at the house', () => {
    const typed = positionsOf([{ id: 'p9', address: '1 Nowhere St', use: 'Investment',
                                 value: '500,000', limit: '400,000' }], [])
    expect(typed[0].lending).toBe(400000)
    expect(typed[0].lvr).toBe(80)
  })
})
