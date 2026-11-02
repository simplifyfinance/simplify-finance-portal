import { describe, it, expect } from 'vitest'
import {
  recorded, gapsOn, quotable, lenderUse, feeRows, shown, counts,
  FEES_THAT_REACH_A_CLIENT, FEE_COLUMNS, type LibProduct, type LibLender,
} from './fee-gaps'

// A BLANK FEE IS SILENT, NOT WRONG.
//
// 30 Oct 2026. Fabio put a $350 settlement fee on Bankwest Complete Variable
// and it never reached the client. That cause is fixed. The audit he asked for
// next - "all I'm asking you is to audit to make sure this is not happening
// anywhere else" - found the half nothing can fix on its own:
//
// The email prints the fees it is given. Complete Variable now says $350.
// Complete Fixed, where nobody has filled the box in, says nothing - and a
// client reads nothing as nothing to pay. The option we know LESS about is the
// one that looks cheaper.
//
// Nothing warns, because nothing can: a blank box and a bank that charges
// nothing are the same two characters in the database. Only a person knows
// which is which, so this is a list to work through, not a rule to enforce.

const L: LibLender[] = [
  { id: 'bw', name: 'Bankwest', active: true, legal_fee_label: 'Legal fee' },
  { id: 'mq', name: 'Macquarie', active: true, legal_fee_label: null },
  { id: 'old', name: 'A bank we left', active: false, legal_fee_label: 'Legal fee' },
]

const P: LibProduct[] = [
  { id: 'p1', lender_id: 'bw', product_name: 'Complete Variable', active: true,
    application_fee: '$0', annual_fee: '$395', monthly_fee: '', valuation_fee: '$0',
    rate_lock_fee: '', early_repayment_fee: '', discharge_fee: '', legal_fee: '$350' },
  { id: 'p2', lender_id: 'bw', product_name: 'Complete Fixed', active: true,
    application_fee: '$0', annual_fee: '$395', monthly_fee: '', valuation_fee: '$0',
    rate_lock_fee: '', early_repayment_fee: '', discharge_fee: '', legal_fee: '  ' },
  { id: 'p3', lender_id: 'mq', product_name: 'Basic Home Loan', active: true,
    application_fee: '$0', annual_fee: '$0', monthly_fee: '$0', valuation_fee: '$0',
    rate_lock_fee: '$0', early_repayment_fee: '$0', discharge_fee: '$400', legal_fee: '$363' },
  { id: 'p4', lender_id: 'bw', product_name: 'An archived one', active: false,
    legal_fee: '' },
  { id: 'p5', lender_id: 'old', product_name: 'At a bank we left', active: true,
    legal_fee: '' },
]

describe('A TYPED ZERO IS AN ANSWER', () => {
  it('and an empty box is not', () => {
    expect(recorded('$0')).toBe(true)
    expect(recorded('0')).toBe(true)
    expect(recorded('Nil')).toBe(true)
    expect(recorded('')).toBe(false)
    expect(recorded('   ')).toBe(false)
    expect(recorded(null)).toBe(false)
    expect(recorded(undefined)).toBe(false)
  })

  it('SO A PRODUCT WITH EVERY FEE AT $0 IS NOT ON THE LIST', () => {
    // Macquarie Basic charges nothing and somebody said so. That is a finished
    // product, and putting it on a list of gaps is how a list stops being read.
    expect(gapsOn(P[2])).toEqual([])
  })

  it('and the Bankwest pair differ by the one box nobody filled in', () => {
    expect(gapsOn(P[0])).not.toContain('legal_fee')
    expect(gapsOn(P[1])).toContain('legal_fee')
  })
})

describe('ONLY WHAT A BROKER CAN STILL PICK', () => {
  it('an archived product is not a gap', () => {
    // It is off the dropdown, so it cannot reach a client.
    expect(quotable(P, L).map(p => p.id)).not.toContain('p4')
  })

  it('AND NOR IS ANYTHING AT A BANK WE LEFT', () => {
    expect(quotable(P, L).map(p => p.id)).not.toContain('p5')
  })

  it('and the three live ones are all there', () => {
    expect(quotable(P, L).map(p => p.id)).toEqual(['p1', 'p2', 'p3'])
  })
})

describe('THE COUNTS ARE OFF THE LIVE PRODUCTS', () => {
  const c = counts(P, L)

  it('three products at two lenders', () => {
    expect(c.products).toBe(3)
    expect(c.lenders).toBe(2)
  })

  it('AND ONE PRODUCT IS MISSING ITS SETTLEMENT FEE', () => {
    expect(c.missing.legal_fee).toBe(1)
  })

  it('and two are missing a discharge fee', () => {
    expect(c.missing.discharge_fee).toBe(2)
  })

  it('AND A LENDER WITH NO FEE WORDING IS COUNTED TOO', () => {
    // Bankwest's was unset on 30 Oct, so a recorded $350 came out under a
    // heading nobody at that bank uses.
    expect(c.noWording).toBe(1)
  })

  it('and a bank we left is not counted as a lender with no wording', () => {
    expect(counts(P, [{ id: 'z', name: 'Gone', active: false, legal_fee_label: null }])
      .noWording).toBe(0)
  })
})

describe('MOST USED FIRST', () => {
  const use = lenderUse([
    { lender_id: 'mq' }, { lender_id: 'mq' }, { lender_id: 'bw' },
    { lender_id: null }, { lender_id: '  ' },
  ])

  it('counted off the deals, not off a list somebody keeps', () => {
    expect(use).toEqual({ mq: 2, bw: 1 })
  })

  it('AND THE BANK WE SEND MOST IS AT THE TOP', () => {
    const r = feeRows(P, L, use)
    expect(r[0].lender).toBe('Macquarie')
    expect(r[0].deals).toBe(2)
  })

  it('and a lender is named once, on its first row', () => {
    const r = feeRows(P, L, use)
    const bw = r.filter(x => x.lender === 'Bankwest')
    expect(bw.map(x => x.firstOfLender)).toEqual([true, false])
  })
})

describe('AND THE FILTERS', () => {
  const use = { bw: 1 }
  const rows = feeRows(P, L, use)

  it('"Lenders we use" leaves out the ones no deal has gone to', () => {
    expect(shown(rows, 'used').map(r => r.lender)).toEqual(['Bankwest', 'Bankwest'])
  })

  it('AND "MISSING SOMETHING" LEAVES OUT THE FINISHED ONES', () => {
    expect(shown(rows, 'gaps').map(r => r.product)).not.toContain('Basic Home Loan')
  })

  it('and finding one searches the lender and the product', () => {
    expect(shown(rows, 'all', 'complete fixed').map(r => r.id)).toEqual(['p2'])
    expect(shown(rows, 'all', 'macquarie').map(r => r.id)).toEqual(['p3'])
  })

  it('AND THE LENDER IS STILL NAMED ONCE AFTER A FILTER', () => {
    // Hiding the first row of a lender must not hide its name with it.
    const only = shown(rows, 'gaps')
    expect(only[0].firstOfLender).toBe(true)
  })
})

describe('AND THE LIST COVERS WHAT A CLIENT CAN BE TOLD', () => {
  it('the eight the lending options screen copies off a product', () => {
    expect(FEES_THAT_REACH_A_CLIENT.map(f => f.key)).toEqual([
      'application_fee', 'annual_fee', 'monthly_fee', 'valuation_fee',
      'legal_fee', 'rate_lock_fee', 'early_repayment_fee', 'discharge_fee',
    ])
  })

  it('AND EVERY COLUMN ON SCREEN IS ONE OF THEM', () => {
    const known = new Set(FEES_THAT_REACH_A_CLIENT.map(f => f.key))
    FEE_COLUMNS.forEach(k => expect(known.has(k)).toBe(true))
  })

  it('and the three left off the table are still counted', () => {
    const c = counts(P, L)
    expect(c.missing.monthly_fee).toBe(2)
    expect(c.missing.rate_lock_fee).toBe(2)
    expect(c.missing.early_repayment_fee).toBe(2)
  })
})
