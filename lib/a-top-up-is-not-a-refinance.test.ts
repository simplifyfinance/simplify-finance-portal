import { describe, it, expect } from 'vitest'
import {
  isTopUp, isDollarForDollar, increaseFor, increaseTotal, lendingAgainst, lvrFor,
  splitsForSecurity, cashReleased, treatmentOf, anyRefinanced, anyToppedUp,
  repaymentTypeLine,
} from './top-up'

// A TOP UP IS NOT A REFINANCE, AND ITS LVR COUNTS THE LOAN THAT IS ALREADY THERE.
//
// Fabio's worked example, 20 Oct 2026: a house worth $1,000,000 with a $500,000
// loan, topped up by $300,000. The answer is 80%.
//
// Count only the increase and it reads 30%. That hides LMI, passes a deal that
// should have been questioned, and puts a wrong figure in a client's email.
// "In the past we had a lot of issues with you getting this structure right."

const HARTLEY = 'p1'
const BERKELEY = 'p2'

const DEAL = {
  template: 'top_up_purchase',
  securityIds: [HARTLEY, BERKELEY],
  securityBalances: { [HARTLEY]: '500,000', [BERKELEY]: '400,000' },
  securityIncreases: { [HARTLEY]: '300,000', [BERKELEY]: '160,000' },
  securityDollarForDollar: {},
}

describe('the LVR, which is the whole point', () => {
  it('counts the existing loan and the increase', () => {
    expect(lendingAgainst(DEAL, HARTLEY)).toBe(800000)
    expect(lvrFor(DEAL, HARTLEY, '1,000,000')).toBe(80)
  })

  // THE FAULT THIS FILE EXISTS TO STOP. Spelled out so that anybody who
  // "simplifies" the lending figure one day sees what they have broken.
  it('is never the increase on its own', () => {
    expect(lvrFor(DEAL, HARTLEY, '1,000,000')).not.toBe(30)
  })

  it('works per property, not across the deal', () => {
    expect(lvrFor(DEAL, BERKELEY, '800,000')).toBe(70)
    expect(lvrFor(DEAL, HARTLEY, '1,000,000')).toBe(80)
  })

  // Zero is a claim - it says there is no lending against a house. A 0% LVR on
  // a screen is read as a fact.
  it('says nothing rather than zero when it cannot be known', () => {
    expect(lvrFor(DEAL, HARTLEY, '')).toBeNull()
    expect(lvrFor(DEAL, HARTLEY, '0')).toBeNull()
    expect(lvrFor({ ...DEAL, securityBalances: {}, securityIncreases: {} }, HARTLEY, '900,000')).toBeNull()
  })

  it('reads a figure typed with commas and a dollar sign the same way', () => {
    const typed = { ...DEAL, securityBalances: { [HARTLEY]: '$500,000.00' } }
    expect(lendingAgainst(typed, HARTLEY)).toBe(800000)
  })
})

describe('the dollar for dollar tick', () => {
  const MIXED = { ...DEAL, securityDollarForDollar: { [BERKELEY]: true } }

  // Fabio, 20 Oct 2026: "do a little tick box and say next to the security
  // saying this is a dollar for dollar refi, not a top up."
  it('takes the increase off that security, whatever is in the box', () => {
    expect(increaseFor(MIXED, BERKELEY)).toBe(0)
    expect(lendingAgainst(MIXED, BERKELEY)).toBe(400000)
    expect(lvrFor(MIXED, BERKELEY, '800,000')).toBe(50)
  })

  it('leaves the other securities alone', () => {
    expect(increaseFor(MIXED, HARTLEY)).toBe(300000)
    expect(lvrFor(MIXED, HARTLEY, '1,000,000')).toBe(80)
  })

  // Unticking has to get the figure back, so the box is ignored rather than
  // cleared. Somebody who ticks it to see what happens must not lose what they
  // typed.
  it('ignores the figure rather than wiping it', () => {
    expect(increaseFor({ ...MIXED, securityDollarForDollar: {} }, BERKELEY)).toBe(160000)
  })

  // THE SECOND PLACE THE TICK MATTERS, and the one a label could never do.
  it('releases no cash, so it never pays a deposit', () => {
    expect(cashReleased(DEAL)).toBe(460000)
    expect(cashReleased(MIXED)).toBe(300000)
  })

  it('says which properties are doing what', () => {
    expect(treatmentOf(MIXED, HARTLEY)).toBe('topped-up')
    expect(treatmentOf(MIXED, BERKELEY)).toBe('dollar-for-dollar')
    expect(anyRefinanced(MIXED)).toBe(true)
    expect(anyToppedUp(MIXED)).toBe(true)
  })

  // "Nothing is being refinanced" is true of a plain top up and false the
  // moment one security is ticked. A sentence that is wrong on a regulated
  // document is worse than no sentence.
  it('knows a plain top up refinances nothing', () => {
    expect(anyRefinanced(DEAL)).toBe(false)
  })
})

describe('the splits', () => {
  const hartley = { id: HARTLEY, address: '14 Hartley St', balance: 500000, increase: 300000, dollarForDollar: false }

  it('are two lines when the increase is kept separate', () => {
    const sp = splitsForSecurity(hartley, { merged: false, rate: '6.14', type: 'Interest only', ioYears: '5' })
    expect(sp.map(s => [s.label, s.amount])).toEqual([
      ['Existing loan', '500,000'],
      ['Loan increase', '300,000'],
    ])
    // Real lending, counted everywhere, but not money being arranged.
    expect(sp[0].staying).toBe(true)
    expect(sp[1].staying).toBeUndefined()
  })

  // Fabio, 20 Oct 2026: "if we add into the current split, let's estimate the
  // repayments, which is the 500 plus the 300." One split means one amount, and
  // every repayment downstream is worked out on the whole of it.
  it('are one line at the new total when added to the current loan', () => {
    const sp = splitsForSecurity(hartley, { merged: true, rate: '6.14', type: 'Interest only', ioYears: '5' })
    expect(sp.length).toBe(1)
    expect(sp[0].label).toBe('Loan increased')
    expect(sp[0].amount).toBe('800,000')
  })

  it('are one refinanced line, at the balance, on a dollar for dollar', () => {
    const sp = splitsForSecurity({ ...hartley, dollarForDollar: true, increase: 0 },
      { merged: false, rate: '6.14', type: 'Interest only', ioYears: '3' })
    expect(sp.length).toBe(1)
    expect(sp[0].label).toBe('Refinanced loan')
    expect(sp[0].amount).toBe('500,000')
    // It IS moving, so nothing is staying.
    expect(sp[0].staying).toBeUndefined()
  })

  it('carry their own interest only years, per split', () => {
    const sp = splitsForSecurity(hartley,
      { merged: false, rate: '6.14', type: 'Interest only', ioYears: '5', existingIoYears: '3' })
    expect(sp[0].ioYears).toBe('3')
    expect(sp[1].ioYears).toBe('5')
  })

  it('leave out an increase of nothing rather than printing a zero', () => {
    const sp = splitsForSecurity({ ...hartley, increase: 0 },
      { merged: false, rate: '6.14', type: 'P&I' })
    expect(sp.length).toBe(1)
    expect(sp[0].label).toBe('Existing loan')
  })

  it('tie every split to its property, so the LVR can group them', () => {
    const sp = splitsForSecurity(hartley, { merged: false, rate: '6.14', type: 'P&I' })
    for (const s of sp) {
      expect(s.securityId).toBe(HARTLEY)
      expect(s.property).toBe('14 Hartley St')
    }
  })
})

describe('interest only never travels on its own', () => {
  // Fabio, 20 Oct 2026: "make sure you always add how many years interest only,
  // because you tend to forget." The answer comes from lib/split-cards.ts,
  // which every client email already uses - re-exported rather than rewritten.
  it('says how many years, out of the one function that already knew', () => {
    expect(repaymentTypeLine({ type: 'Interest only', ioYears: '5' } as any, '30'))
      .toBe('Interest only for 5 years, then principal and interest for 25')
    expect(repaymentTypeLine({ type: 'Interest only', ioYears: '3' } as any, ''))
      .toBe('Interest only for 3 years')
  })

  it('leaves P&I alone', () => {
    expect(repaymentTypeLine({ type: 'P&I' } as any, '30')).toBe('P&I')
  })

  // A term nobody recorded is not a term to invent.
  it('says the type alone when nobody has said how long', () => {
    expect(repaymentTypeLine({ type: 'Interest only' } as any, '30')).toBe('Interest only')
  })

  it('says nothing at all when there is no type', () => {
    expect(repaymentTypeLine({ type: '' } as any, '30')).toBe('')
  })
})

describe('which templates these rules apply to', () => {
  it('is the two new ones and nothing else', () => {
    expect(isTopUp('top_up')).toBe(true)
    expect(isTopUp('top_up_purchase')).toBe(true)
    for (const other of ['refinance_equity', 'refinance_only', 'investment_equity',
                         'complex_refinance', 'custom', '', null]) {
      expect(isTopUp(other), `${other} should not be a top up`).toBe(false)
    }
  })
})
