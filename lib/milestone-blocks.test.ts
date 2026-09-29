// WHICH LINES BELONG IN THIS PARTICULAR EMAIL.
//
// Fabio's templates say it in capitals - "DELETE WHAT IS NOT APPLICABLE" - and
// somebody reads down a wall of text before every send. These tests are the
// portal doing that reading, and the ones that matter most are the OFF cases:
// a deposit bond line nobody deleted tells a client to arrange something they
// do not need.

import { describe, it, expect } from 'vitest'
import {
  formalApprovalBlocks, preapprovalBlocks, withOverrides, on, waitingOnLender,
  securityState, needsOriginalMortgage, needsDepositBond, isFamilyGuarantee,
  ORIGINAL_MORTGAGE_STATES,
} from './milestone-blocks'
import { rulesOf } from './lender-rules'

const ANSWERED = rulesOf([
  { key: 'contracts_issued_by', value: 'online', set_by: 'Katie', used: 12 },
  { key: 'insurance_minimum', value: 'property_value', set_by: 'Katie', used: 9 },
  { key: 'postcode_restrictions', value: 'no', set_by: 'Katie', used: 4 },
  { key: 'docusign_certificate', value: 'no', set_by: 'Katie', used: 4 },
  { key: 'preapproval_extensions', value: 'twice', set_by: 'Fabio', used: 2 },
])
const NOTHING = rulesOf([])

const PURCHASE = {
  property_use: 'owner_occupied',
  transaction_type: 'purchase',
  deal_type: 'OO purchase',
  bc_data: { template: 'oo_purchase', dutyState: 'NSW', deposit: '239000',
             purchasePrice: '950000', stampDuty: '37000' },
  lo_data: { recommendedLender: 'Bankwest', recommendedOptionId: 'o1',
             lenders: [{ id: 'o1', lenderName: 'Bankwest', productName: 'Complete Home Loan Package' }] },
}

describe('the security state decides the mortgage document', () => {
  // Fabio, 29 Sep 2026: "which state uses original mortgage docs WAS, TAS and
  // Northern Territory so only use that line for securities in those states."
  it('is exactly WA, TAS and NT', () => {
    expect(ORIGINAL_MORTGAGE_STATES).toEqual(['WA', 'TAS', 'NT'])
    for (const s of ['WA', 'TAS', 'NT']) {
      expect(needsOriginalMortgage({ bc_data: { dutyState: s } })).toBe(true)
    }
    for (const s of ['NSW', 'VIC', 'QLD', 'SA', 'ACT']) {
      expect(needsOriginalMortgage({ bc_data: { dutyState: s } })).toBe(false)
    }
  })

  it('reads the security address first, once there is a property', () => {
    // The BC still says NSW from the assessment; the contract is in Tasmania.
    expect(securityState({
      bc_data: { dutyState: 'NSW' },
      compliance_data: { securityAddress: '4 Bayview Road, Sandy Bay TAS 7005' },
    })).toBe('TAS')
  })

  it('says it cannot decide rather than guessing', () => {
    const b = formalApprovalBlocks({ ...PURCHASE, bc_data: { template: 'oo_purchase' } }, ANSWERED)
      .find(x => x.key === 'original_mortgage')!
    expect(b.on).toBe(false)
    expect(b.why).toContain('no state recorded')
  })
})

describe('the formal approval, on a NSW owner-occupied purchase', () => {
  const blocks = formalApprovalBlocks(PURCHASE, ANSWERED)

  it('copies the other side in, because it is a purchase', () => {
    expect(on(blocks, 'other_side')).toBe(true)
  })

  it('leaves out the property management quote on an owner-occupied deal', () => {
    expect(on(blocks, 'property_management')).toBe(false)
  })

  it('leaves out the deposit bond, because a cash deposit is recorded', () => {
    expect(on(blocks, 'deposit_bond')).toBe(false)
    expect(blocks.find(b => b.key === 'deposit_bond')!.why).toContain('cash deposit is recorded')
  })

  it('leaves out the mortgage document in NSW', () => {
    expect(on(blocks, 'original_mortgage')).toBe(false)
  })

  it('includes Deppro, because the product is a package', () => {
    expect(on(blocks, 'deppro')).toBe(true)
  })

  it('leaves out debt recycling until the BC or LO says so', () => {
    expect(on(blocks, 'debt_recycling')).toBe(false)
    const yes = { ...PURCHASE, lo_data: { ...PURCHASE.lo_data, strategy: 'Debt recycling' } }
    expect(on(formalApprovalBlocks(yes, ANSWERED), 'debt_recycling')).toBe(true)
  })

  it('never turns a block on without saying why', () => {
    for (const b of blocks) expect(b.why.trim()).not.toBe('')
  })
})

describe('an investment purchase in Western Australia', () => {
  const WA_INV = {
    ...PURCHASE, property_use: 'investment',
    bc_data: { ...PURCHASE.bc_data, dutyState: 'WA' },
  }
  const blocks = formalApprovalBlocks(WA_INV, ANSWERED)

  it('picks up the property management quote', () => {
    expect(on(blocks, 'property_management')).toBe(true)
  })

  it('picks up the mortgage document, and names the state', () => {
    expect(on(blocks, 'original_mortgage')).toBe(true)
    expect(blocks.find(b => b.key === 'original_mortgage')!.why).toContain('WA')
  })

  it('asks for the rental letter on the pre-approval', () => {
    expect(on(preapprovalBlocks(WA_INV, ANSWERED), 'rental_letter')).toBe(true)
  })
})

describe('a family guarantee', () => {
  const PLEDGE = { ...PURCHASE, bc_data: { ...PURCHASE.bc_data, template: 'family_pledge', deposit: '0' } }

  it('is recognised from the BC template', () => {
    expect(isFamilyGuarantee(PLEDGE)).toBe(true)
  })

  it('and from an older deal that only has it in its name', () => {
    expect(isFamilyGuarantee({ deal_name: 'Nguyen Family Guarantee 2026' })).toBe(true)
  })

  it('turns the deposit bond on', () => {
    expect(needsDepositBond(PLEDGE)).toBe(true)
    expect(on(formalApprovalBlocks(PLEDGE, ANSWERED), 'deposit_bond')).toBe(true)
    expect(on(preapprovalBlocks(PLEDGE, ANSWERED), 'deposit_bond')).toBe(true)
  })
})

describe('an SMSF purchase', () => {
  it('gets the entity name line, and nothing else does', () => {
    const smsf = { ...PURCHASE, property_use: 'smsf' }
    expect(on(preapprovalBlocks(smsf, ANSWERED), 'smsf_entity')).toBe(true)
    expect(on(preapprovalBlocks(PURCHASE, ANSWERED), 'smsf_entity')).toBe(false)
  })
})

describe('a lender nobody has answered for', () => {
  // The failure this protects against: a non-bank pre-approval going out with
  // no postcode warning in it because the portal assumed.
  const blocks = preapprovalBlocks(PURCHASE, NOTHING)

  it('turns the block OFF rather than guessing either way', () => {
    expect(on(blocks, 'postcode_restrictions')).toBe(false)
    expect(on(blocks, 'docusign_certificate')).toBe(false)
  })

  it('says which question is unanswered', () => {
    const b = blocks.find(x => x.key === 'postcode_restrictions')!
    expect(b.by).toBe('lender')
    expect(b.needs).toBe('postcode_restrictions')
    expect(b.why).toContain('Not recorded for Bankwest')
  })

  it('collects them so the send screen says it once', () => {
    const waiting = waitingOnLender(blocks)
    expect(waiting).toHaveLength(3)
    expect(waiting.every(w => w.startsWith('Not recorded'))).toBe(true)
  })

  it('and an answered lender is waiting on nothing', () => {
    expect(waitingOnLender(preapprovalBlocks(PURCHASE, ANSWERED))).toEqual([])
  })
})

describe('a lender answer that says no', () => {
  it('turns the block off, and that is not the same as unanswered', () => {
    const blocks = preapprovalBlocks(PURCHASE, ANSWERED)
    const b = blocks.find(x => x.key === 'postcode_restrictions')!
    expect(b.on).toBe(false)
    expect(b.why).toContain('Remembered for Bankwest')
    expect(waitingOnLender(blocks)).toEqual([])
  })

  it('a lender that will not extend drops the $800 line', () => {
    const none = rulesOf([{ key: 'preapproval_extensions', value: 'none', set_by: 'K', used: 1 }])
    expect(on(preapprovalBlocks(PURCHASE, none), 'preapproval_extensions')).toBe(false)
  })
})

describe('what the sender changed', () => {
  const blocks = formalApprovalBlocks(PURCHASE, ANSWERED)

  it('a key nobody touched keeps the portal decision', () => {
    expect(withOverrides(blocks, {})).toEqual(blocks)
    expect(on(withOverrides(blocks, { deppro: true }), 'other_side')).toBe(true)
  })

  it('turning one on says so, and keeps the original reason', () => {
    const b = withOverrides(blocks, { deposit_bond: true }).find(x => x.key === 'deposit_bond')!
    expect(b.on).toBe(true)
    expect(b.why).toContain('Turned on for this deal')
    expect(b.why).toContain('cash deposit is recorded')
  })

  it('turning one off says so too', () => {
    const b = withOverrides(blocks, { other_side: false }).find(x => x.key === 'other_side')!
    expect(b.on).toBe(false)
    expect(b.why).toContain('Turned off for this deal')
  })

  it('an override that agrees with the portal changes nothing at all', () => {
    const b = withOverrides(blocks, { other_side: true }).find(x => x.key === 'other_side')!
    expect(b.why).not.toContain('Turned on')
  })
})

describe('every block is answerable', () => {
  it('each one says who decided it', () => {
    for (const b of [...formalApprovalBlocks(PURCHASE, NOTHING), ...preapprovalBlocks(PURCHASE, NOTHING)]) {
      expect(['deal', 'lender', 'ask']).toContain(b.by)
      expect(b.label.trim()).not.toBe('')
      expect(b.why.trim()).not.toBe('')
      // A lender block must name the question it is waiting on, or the send
      // screen cannot offer to answer it.
      if (b.by === 'lender') expect(b.needs).toBeTruthy()
    }
  })

  it('no duplicate keys within one email', () => {
    for (const set of [formalApprovalBlocks(PURCHASE, ANSWERED), preapprovalBlocks(PURCHASE, ANSWERED)]) {
      const keys = set.map(b => b.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
})
