import { describe, it, expect } from 'vitest'
import { loPurchaseBlock, SALE_ESTIMATE_NOTE } from './lo-purchase-block'

// THE LO's NUMBERS, 7 OCT 2026.
//
// What went out before this file existed, on a real buy-and-sell deal:
//
//     Purchase Price: $1,300,000
//     Stamp Duty (WA): $59,000
//     Deposit Required (plus solicitor's fees and incidentals): $506,000
//     Loan Amount: $853,000
//
// No total cost. "Deposit Required" on a deal where nobody is saving a deposit.
// Title Case against the BC's sentence case, a week apart, same client.
const buySell = {
  bcTemplate: 'buy_sell',
  purchasePrice: '1,300,000',
  stampDuty: '59,000',
  dutyState: 'WA',
  loanAmount: '860,000',
  deposit: '499,000',
}

describe('the LO purchase block', () => {
  const html = loPurchaseBlock(buySell)

  it('says where the money comes from, in the BC\'s words', () => {
    expect(html).toContain('Your contribution required (coming from your sale proceeds)')
    expect(html, 'nobody is saving a deposit on a buy and sell')
      .not.toContain('Deposit Required')
  })

  it('adds the price and the duty up for the client', () => {
    expect(html).toContain("Total cost (plus solicitor's fees, and incidentals)")
    expect(html).toContain('$1,359,000')
  })

  it('names the state the duty belongs to', () => {
    expect(html).toContain('Stamp duty (WA)')
  })

  it('writes in sentence case, like the BC', () => {
    for (const shouted of ['Purchase Price:', 'Stamp Duty', 'Loan Amount:']) {
      expect(html, `${shouted} is Title Case - the BC does not write like that`)
        .not.toContain(shouted)
    }
  })

  // His words, and they go under the figures rather than six paragraphs later.
  it('warns that the sale figures are estimates', () => {
    expect(SALE_ESTIMATE_NOTE).toBe(
      'The figures used for the proposed sale are only estimated amounts. '
      + 'If you were to sell the property for less we would need to re-work your numbers.')
    expect(html).toContain(SALE_ESTIMATE_NOTE)
    expect(html.indexOf('Your contribution required'),
      'the warning belongs under the numbers it is warning about')
      .toBeLessThan(html.indexOf(SALE_ESTIMATE_NOTE))
  })

  it('says "and savings" only where something was added on top', () => {
    expect(loPurchaseBlock({ ...buySell, additionalSavings: '40,000' }))
      .toContain('coming from your sale proceeds and savings')
    expect(loPurchaseBlock({ ...buySell, additionalSavings: '0' }))
      .toContain('coming from your sale proceeds)')
  })
})

describe('every other purchase', () => {
  const plain = { bcTemplate: 'purchase', purchasePrice: '800,000', stampDuty: '31,000',
                  dutyState: 'NSW', loanAmount: '640,000', deposit: '191,000', depositSource: 'savings' }

  it('uses the source the BC recorded', () => {
    expect(loPurchaseBlock(plain)).toContain('coming from your savings')
  })

  // The note names a sale. There is no sale.
  it('carries no sale warning', () => {
    expect(loPurchaseBlock(plain)).not.toContain(SALE_ESTIMATE_NOTE)
  })

  it('names no source rather than guessing one', () => {
    const html = loPurchaseBlock({ ...plain, depositSource: '' })
    expect(html).toContain('Your contribution required<')
    expect(html).not.toContain('coming from')
  })
})

describe('nothing to show', () => {
  it('prints nothing at all rather than an empty card', () => {
    expect(loPurchaseBlock({})).toBe('')
    expect(loPurchaseBlock({ bcTemplate: 'buy_sell' })).toBe('')
  })
})

// Word renders Outlook mail. It paints a background only from a bgcolor
// attribute and drops a colour set on a paragraph, so every coloured surface
// needs both and every piece of text needs a span.
// scripts/check-email-html.sh enforces this across the whole repo; this states
// it on the one block, so a failure here names the block rather than the file.
describe('it survives Outlook', () => {
  const html = loPurchaseBlock(buySell)

  it('paints the card from a bgcolor attribute, not from CSS alone', () => {
    expect(html).toContain('bgcolor="#F2E8DB"')
  })

  it('wraps every coloured line in a span', () => {
    const texts = html.match(/<(p|td)\b[^>]*color:[^>]*>([^<]*)/g) || []
    for (const t of texts) {
      expect(t.replace(/<(p|td)\b[^>]*>/, '').trim(),
        'text sitting straight inside a coloured p or td arrives black in Outlook')
        .toBe('')
    }
  })
})

// THE FEE REACHES THE EMAIL FROM THE SCREEN IT IS ALREADY ON.
//
// 14 Oct 2026. The application fee was sitting in the Lending Options fees
// block, auto-filled from the lender library, and the purchase card never
// asked for it. Only the RECOMMENDED option's fee counts - that is the loan
// the client is being quoted, so another option's fee has nothing to do with
// this figure.
describe('a lender fee that sits inside the loan', () => {
  const deal = (lenders: any[]) => ({
    purchasePrice: '2,000,000', stampDuty: '92,000', dutyState: 'NSW',
    loanAmount: '1,162,053', deposit: '929,947', depositSource: 'Savings',
    recommendedOptionId: 'a', lenders,
  })

  it('comes off the loan when the recommended option has it ticked', () => {
    const html = loPurchaseBlock(deal([
      { id: 'a', lenderName: 'ORDE Financial', applicationFee: '4,053', feeInLoan: true },
    ]))
    expect(html).toContain('$1,162,053')
    expect(html).toContain('includes $4,053 application fee, added to the loan')
    expect(html, 'the fee is still being counted as if it bought the house').toContain('$934,000')
  })

  it('is left alone when nobody ticked it', () => {
    const html = loPurchaseBlock(deal([
      { id: 'a', lenderName: 'ORDE Financial', applicationFee: '4,053' },
    ]))
    expect(html).toContain('$929,947')
    expect(html).not.toContain('added to the loan')
  })

  // LUCY ILBERY & ANDREW LEIGH, AGAIN.
  //
  // We recommended one bank, the clients went to another. The fee has to come
  // off the lender the deal is ON. Reading the recommended option here would
  // put the wrong bank's fee into the cash these clients have to find - a wrong
  // figure under a right name, which nobody notices.
  it('uses the lender the clients actually went with, not the one we recommended', () => {
    const html = loPurchaseBlock({
      purchasePrice: '2,000,000', stampDuty: '92,000', dutyState: 'NSW',
      loanAmount: '1,162,053', deposit: '929,947', depositSource: 'Savings',
      recommendedLender: 'ORDE Financial', recommendedOptionId: 'a',
      clientAgreedLender: 'No', clientChosenLender: 'ubank',
      lenders: [
        { id: 'a', lenderName: 'ORDE Financial', applicationFee: '4,053', feeInLoan: true },
        { id: 'b', lenderName: 'ubank', applicationFee: '', feeInLoan: false },
      ],
    })
    expect(html, "ORDE's fee is being charged to a ubank client").not.toContain('$4,053')
    expect(html).toContain('$929,947')
  })

  it('ignores a fee on an option that was not recommended', () => {
    const html = loPurchaseBlock(deal([
      { id: 'a', lenderName: 'ORDE Financial', applicationFee: '' },
      { id: 'b', lenderName: 'Other Bank', applicationFee: '9,000', feeInLoan: true },
    ]))
    expect(html).toContain('$929,947')
    expect(html).not.toContain('$9,000')
  })
})
