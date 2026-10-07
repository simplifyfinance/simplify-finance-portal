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
