// THE LO's PURCHASE FIGURES, IN THE SAME CARD AND THE SAME WORDS AS THE BC.
//
// 7 Oct 2026. Fabio, on a buy-and-sell deal where the BC was right and the LO
// was not: "BC template for buy and sale scenario is working perfectly but when
// we go into the LO the sale breakdown the way we do is not coming across".
//
// The LO wrote four lines of its own:
//
//     Purchase Price: $1,300,000
//     Stamp Duty (WA): $59,000
//     Deposit Required (plus solicitor's fees and incidentals): $506,000
//     Loan Amount: $853,000
//
// Three things wrong with that, and none of them is arithmetic.
//
//   NO TOTAL COST. The client adds the price and the duty in their head.
//
//   "DEPOSIT REQUIRED" IS THE WRONG WORDS on this scenario. Nobody is saving a
//   deposit - the money comes out of the sale. The BC has said "Your
//   contribution required (coming from your sale proceeds)" for weeks.
//
//   TITLE CASE, against the BC's sentence case, on two emails about one deal
//   sent a week apart by the same firm.
//
// So the LO stops writing its own and calls purchaseRows() - the file whose own
// note reads "ONE PURCHASE BREAKDOWN, ON EVERY SCENARIO THAT BUYS SOMETHING".
// There is now one set of words and the two emails cannot drift apart again.
//
// WHAT IS DELIBERATELY NOT HERE: the LVR. The BC prints one because it holds the
// LMI treatment and the percentage. The LO holds neither. An LVR worked out here
// from a loan and a price, with no idea whether a premium is inside the loan or
// paid at settlement, is a figure this email cannot stand behind - and
// lib/contract-funding.ts already says why that is a line not to cross. It can
// come, with the LMI fields, once the figures question below is settled.
//
// AND THE FIGURES ARE STILL A COPY. The LO takes the price, duty, contribution
// and loan out of the BC once, when it is created, and nothing holds them
// together afterwards. On the deal that started this, the BC said $860,000 /
// $499,000 and the LO said $853,000 / $506,000 - both internally correct, two
// ends of the same equation from different starting numbers. This file changes
// the WORDS. It does not change where the numbers come from, and it must not be
// read as having fixed that.
import { dutyLabel } from './duty-state'
import { buildsSomething } from './sale-build'
import { totalCost, totalLending, num } from './construction'
import { buildCostRows, fundsToContributeRow, landEquityNote, buildNote } from './build-card'
import { money } from './money'
import { INCIDENTALS } from './purchase-rows'
// THE CARD IS NOT DRAWN TWICE. lib/no-duplicate-logic.test.ts caught the second
// copy the day this file was written, which is exactly what it is for.
import { card, row } from './email-card'
import { purchaseRows } from './purchase-rows'

const txt = (v: any) => String(v ?? '').trim()

export const SALE_ESTIMATE_NOTE =
  'The figures used for the proposed sale are only estimated amounts. '
  + 'If you were to sell the property for less we would need to re-work your numbers.'

// A buy-and-sell LO is an ordinary purchase LO - the template does not say so,
// because every non-refinance, non-bridging deal becomes lo_purchase. What the
// BC was is carried on the LO as bcTemplate, and that is what this asks.
export function isBuyAndSell(d: any): boolean {
  return txt(d?.bcTemplate) === 'buy_sell'
}

// WHERE THE MONEY COMES FROM, IN THE BC's OWN WORDS.
//
// The BC asks depositSource on every template except two, where the answer is
// not a free choice: a buy and sell is paying out of the sale, and it says "sale
// proceeds and savings" only where something was actually added on top. This
// follows that rule rather than inventing a second one, so the sentence the
// client reads on the LO is the sentence they read on the BC.
//
// Empty is a real answer. purchaseRows then prints "Your contribution required"
// and names no source, which is better than guessing "savings" on a deal where
// nobody said so.
function contributionSource(d: any): string {
  if (isBuyAndSell(d)) {
    return (Number(String(d?.additionalSavings ?? '').replace(/,/g, '')) || 0) > 0
      ? 'sale proceeds and savings'
      : 'sale proceeds'
  }
  return txt(d?.depositSource)
}

// THE SALE WARNING. Under the figures it is about, not six paragraphs later.
function saleNote(d: any): string {
  return isBuyAndSell(d)
    ? `<p style="font-size:12.5px;color:#6b6b6b;font-style:italic;line-height:1.55;margin:0 0 14px"><span style="color:#6b6b6b;">${SALE_ESTIMATE_NOTE}</span></p>`
    : ''
}

// A BUILD IS NOT A PURCHASE, AND THIS EMAIL COULD NOT SAY SO.
//
// 9 Oct 2026. Handed only the lending options record, this file had no land
// value, no construction cost and no valuation - so a construction deal got a
// card headed "New purchase" with a loan amount and a contribution in it and
// nothing about a build. True of the Construction template since the day it was
// built, and the buy and sell that funds a build would have walked into it.
//
// The borrowing capacity is passed in per request and never stored, so there is
// no second copy of these figures to go stale. The rows are the same rows the
// client email prints - see lib/build-card.ts.
//
// THE LENDING IS THE LENDING OPTIONS' OWN FIGURE, because this is their email
// and the whole page is about the loan being applied for. The contribution is
// then worked out from it, so the column a client reads adds up on its own
// page rather than against a figure that is not on it.
function loBuildBlock(d: any, bc: any): string {
  const cost = totalCost(bc)
  if (cost <= 0) return ''
  const lending = num(d?.loanAmount) || totalLending(bc?.splits)
  const contribute = Math.max(0, Math.round(cost - lending))
  // Lower case because it lands mid-sentence, the same way purchaseRows does it.
  const from = contributionSource(d).toLowerCase()
  return card('Your build',
    buildCostRows(bc) +
    row('Total lending', money(lending)) +
    fundsToContributeRow(contribute, INCIDENTALS) +
    (from ? buildNote(`This comes from your ${from}.`) : '') +
    landEquityNote(bc)
  ) + saleNote(d)
}

// The whole block: the card, and on a buy and sell the estimate warning under
// it. Empty when there is nothing to show, so the email simply skips it rather
// than printing a card with one line in it.
//
// `bc` is the deal's borrowing capacity, passed through from the request. It is
// optional only so that a caller with nothing to say about a build still
// compiles; every real caller passes it.
export function loPurchaseBlock(d: any, bc?: any): string {
  if (buildsSomething(bc)) return loBuildBlock(d, bc)
  const rows = purchaseRows({
    price: d?.purchasePrice,
    duty: d?.stampDuty,
    dutyLabel: dutyLabel(d),
    loan: d?.loanAmount,
    contribution: d?.deposit,
    contributionFrom: contributionSource(d),
  })
  if (!rows.length) return ''

  const body = rows.map(r => r.note
    // A note is a sentence, not an amount - full width rather than right-aligned
    // in the money column, where it reads like a number that lost its digits.
    ? `<tr><td colspan="2" style="font-size:11px;color:#7a5c3a;font-style:italic;line-height:1.5;padding:0 0 4px"><span style="color:#7a5c3a;">${r.value}</span></td></tr>`
    : row(r.label, r.value)).join('')

  // UNDER THE FIGURES, NOT AT THE END OF THE EMAIL. It is a caveat on these
  // numbers; six paragraphs later it is just another line nobody reads.
  return card('New purchase', body) + saleNote(d)
}
