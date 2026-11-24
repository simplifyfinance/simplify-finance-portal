import { describe, it, expect } from 'vitest'
import { milestoneRows, missingFigures, emailIsRefinance,
         whatTheStructureSays, shapeDisagreement } from './milestone-figures'

// "THIS IS A PURCHASE FORMAL....WHY IS THE TEMPLATE SHOWING REFINANCE?"
//
// Fabio, 24 Nov 2026, on Toan Le-Vo's formal approval. The email was headed
// "formally approved - 2/285 Riding Road" and the money block under it read:
//
//     Loan amount                $845,000
//     Balance being refinanced   $389,000
//
// and stopped. No purchase price. No stamp duty. No total cost. No client
// contribution - which on a purchase is the line that tells somebody how much
// money to bring to settlement.
//
// Toan is buying and selling. The fact find holds the property he is SELLING,
// and that property's loan is marked to be refinanced, because it is - it goes
// when the house goes. The email builder asked the fact find whether this was
// a refinance, got a truthful yes to the wrong question, and printed the wrong
// block on a straight purchase.
//
// Fabio: "if offer accepted is going to look at Fact Find, it's never going to
// fucking work, is it?... The offer accepted always rely on compliance first,
// and then we adjust the figures."
//
// He is right, and it was never only the formal approval. The same block is
// built for the pre-approval, the offer accepted and the formal approval, so
// one wrong question made three wrong emails - and the missing-figure warning
// on the send screen asked the SAME question first, so it never said a word
// about the price and the duty being absent. The screen said the email was
// complete while it went out without the figures.
//
// The email now asks the deal what it is. The fact find is where a deal
// started; it is the oldest thing on the record by the time any of these go
// out, and on a buy-and-sell it describes a transaction that is not the one
// being approved.

const sellingAHouse = {
  properties: [{
    address: '14 Old Street',
    loans: [{ balance: '389000', status: 'to be refinanced' }],
  }],
}

const toan = {
  transaction_type: 'purchase',
  // buy_sell is the template a buy-and-sell is actually built on, and
  // lib/deal-labels.ts has mapped it to 'purchase' since October.
  bc_data: { template: 'buy_sell', purchasePrice: '1150000', stampDuty: '48000' },
  fact_find_data: sellingAHouse,
  contract_loan_amount: '845000',
}

describe("a buy-and-sell is a purchase, whatever the fact find says", () => {
  it('does not call Toan a refinance', () => {
    expect(emailIsRefinance(toan)).toBe(false)
  })

  it('prints the purchase block, not the refinance block', () => {
    const labels = milestoneRows(toan).map(r => r.label)
    expect(labels).toContain('Purchase price')
    expect(labels).not.toContain('Balance being refinanced')
  })

  it('still tells the client what they are borrowing', () => {
    expect(milestoneRows(toan).map(r => r.label)).toContain('Loan amount')
  })

  it('WARNS when a purchase is short of its price or duty, which it never did', () => {
    const noFigures = { ...toan, bc_data: { template: 'buy_sell' } }
    const words = missingFigures(noFigures)
    expect(words).toContain('the purchase price')
    expect(words).toContain('the stamp duty')
  })

  it('a consolidated debt on a purchase does not flip it either', () => {
    const consolidating = {
      ...toan,
      fact_find_data: {
        properties: [{ loans: [{ balance: '22000', status: 'to be consolidated' }] }],
      },
    }
    expect(emailIsRefinance(consolidating)).toBe(false)
  })
})

describe('a real refinance still gets its own three lines', () => {
  it('when the deal says so', () => {
    const refi = {
      transaction_type: 'refinance',
      bc_data: { template: 'refinance_only', existingLoanBal: '389000' },
      fact_find_data: sellingAHouse,
      contract_loan_amount: '845000',
    }
    expect(emailIsRefinance(refi)).toBe(true)
    expect(milestoneRows(refi).map(r => r.label)).toContain('Balance being refinanced')
  })

  it('and on an older deal that has no transaction type, the template answers', () => {
    const old = {
      bc_data: { template: 'refinance_equity' },
      contract_loan_amount: '600000',
    }
    expect(emailIsRefinance(old)).toBe(true)
  })

  it('but an older buy-and-sell with no transaction type still reads as a purchase', () => {
    // No transaction_type at all - the template alone has to carry it, and it
    // does. This is the case the old code got wrong every single time.
    const old = {
      bc_data: { template: 'buy_sell', purchasePrice: '900000', stampDuty: '40000' },
      fact_find_data: sellingAHouse,
      contract_loan_amount: '600000',
    }
    expect(emailIsRefinance(old)).toBe(false)
    expect(milestoneRows(old).map(r => r.label)).toContain('Purchase price')
  })
})

// ---------------------------------------------------------------------------
//
// AND THE TAG IS NOT THE LAST WORD EITHER.
//
// Fabio, 24 Nov 2026: "I understand there's a tag that says our purchase, but
// like I don't want to overcomplicate these things, but it should always be
// obvious. If you look on the compliance and the lending options tab, there is
// literally a breakdown of what the deal is for. So we don't even need to rely
// on a tag, just in case the tag is wrong."
//
// So the loan answers first. A tag is something somebody picked; the splits
// ARE the loan. Toan's is one split called End Debt for $845,000, which no
// tag has to be right for this to read correctly.

const endDebtOnly = {
  bc_data: {
    template: 'buy_sell',
    purchasePrice: '1150000',
    stampDuty: '48000',
    splits: [{ label: 'End Debt', amount: '845000' }],
  },
  fact_find_data: sellingAHouse,
}

const refinancedLoanOnly = {
  bc_data: {
    template: 'refinance_only',
    existingLoanBal: '389000',
    splits: [{ label: 'Refinanced loan', amount: '845000' }],
  },
}

describe('the loan structure answers before the tag does', () => {
  it('reads one End Debt split as a purchase', () => {
    expect(whatTheStructureSays(endDebtOnly)).toBe('purchase')
    expect(emailIsRefinance(endDebtOnly)).toBe(false)
  })

  it('reads a refinanced loan split as a refinance', () => {
    expect(whatTheStructureSays(refinancedLoanOnly)).toBe('refinance')
    expect(emailIsRefinance(refinancedLoanOnly)).toBe(true)
  })

  it('AND A WRONG TAG CANNOT DRAG A PURCHASE INTO THE REFINANCE BLOCK', () => {
    // The whole point. Somebody tagged it refinance by mistake; the loan is a
    // purchase; the client gets the purchase figures anyway.
    const mistagged = { ...endDebtOnly, transaction_type: 'refinance' }
    expect(emailIsRefinance(mistagged)).toBe(false)
    expect(milestoneRows(mistagged).map(r => r.label)).toContain('Purchase price')
  })

  it('and whoever is about to send it is told the two disagree', () => {
    const mistagged = { ...endDebtOnly, transaction_type: 'refinance' }
    const warning = shapeDisagreement(mistagged)
    expect(warning).toContain('CHECK THIS BEFORE SENDING')
    expect(warning).toContain('purchase')
    expect(warning).toContain('refinance')
  })

  it('and says nothing at all when they agree', () => {
    expect(shapeDisagreement({ ...endDebtOnly, transaction_type: 'purchase' })).toBeNull()
    expect(shapeDisagreement(refinancedLoanOnly)).toBeNull()
  })

  it('a deal that releases equity AND buys is left to the tag, as it always was', () => {
    // investment_equity - "Equity release + purchase". A real shape the portal
    // already files as an equity release. The structure says both, and both is
    // deliberately not decided here, so nothing about this deal changes.
    const mixed = {
      bc_data: {
        template: 'investment_equity',
        existingLoanBal: '500000',
        splits: [
          { label: 'Existing loan refinanced', amount: '500000' },
          { label: 'Equity access', amount: '150000' },
          { label: 'New purchase', amount: '600000' },
        ],
      },
    }
    expect(whatTheStructureSays(mixed)).toBe('both')
    expect(emailIsRefinance(mixed)).toBe(true)
    expect(shapeDisagreement(mixed)).toBeNull()
  })

  it('and a deal with no splits at all falls through to the tag', () => {
    expect(whatTheStructureSays({ bc_data: { template: 'buy_sell' } })).toBe('unknown')
    expect(emailIsRefinance({ bc_data: { template: 'buy_sell' } })).toBe(false)
  })
})
