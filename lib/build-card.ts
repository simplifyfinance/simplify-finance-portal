// THE BUILD, AS ONE CARD, IN ONE PLACE.
//
// 9 Oct 2026. Three emails now describe the same build - the BC on the
// construction template, the BC on a buy and sell whose proceeds are funding a
// build, and the lending options email on either of those. These rows were
// written inline in one branch of one route, which is one copy away from the
// fault this codebase keeps paying for: a fix applied to one email and not the
// others.
//
// NOTHING HERE IS NEW. Every row and every word is the construction branch's,
// moved rather than rewritten. The arithmetic is still lib/construction.ts and
// the card itself is still lib/email-card.ts - including why the markup looks
// like 2004, which is Outlook, and which scripts/check-email-html.sh enforces.
import { row } from './email-card'
import { dutyLabel } from './duty-state'
import { money } from './money'
import { totalCost, isLandPurchase, landEquity, landLoanPayout,
         repaymentDuringConstruction, num, DRAWDOWN_NOTE } from './construction'

// THE ITALIC SUB-LINE. Anything in this card that is a sentence rather than an
// amount goes here, full width, so it is never mistaken for a number that lost
// its digits. The padding varies by where it sits, which is why it is a
// parameter rather than three near-identical functions.
export function buildNote(text: string, pad = '4px 0 0'): string {
  return `<tr><td colspan="2" style="font-size:11px;color:#7a5c3a;font-style:italic;line-height:1.5;padding:${pad}"><span style="color:#7a5c3a;">${text}</span></td></tr>`
}

// WHAT HAS TO BE FUNDED, AND NOTHING ELSE IN THIS BLOCK.
//
// A client reads straight down the money column, so a figure that is not part
// of the sum cannot sit inside it. The first version had land the clients
// already owned in here, and an owned-land email read $900,000 + $600,000 =
// $600,000. Right arithmetic, unreadable page.
//
// The land and its duty sit together, then the build. Fabio, 30 Sep 2026:
// "Land value / Stamp duty (NSW) than Construction cost".
export function buildCostRows(d: any): string {
  const buyingLand = isLandPurchase(d)
  const payout = landLoanPayout(d)
  return (buyingLand ? row('Land value', money(d.landValue)) : '') +
    (buyingLand ? row(dutyLabel(d), money(d.stampDuty)) : '') +
    row('Construction cost', money(d.constructionCost)) +
    (payout > 0 ? row('Existing land loan paid out', money(payout)) : '') +
    `<tr style="border-top:1px solid #CEBEAB"><td style="font-size:12px;font-weight:600;color:#343333;padding-top:6px"><span style="color:#343333;">${buyingLand ? 'Total cost' : 'Total to fund'}</span></td><td style="font-size:12px;font-weight:600;color:#343333;text-align:right;padding-top:6px"><span style="color:#343333;">${money(totalCost(d))}</span></td></tr>` +
    // WHAT THE SECURITY IS WORTH, below the total and clearly not part of it.
    (!buyingLand ? row('Land you already own', money(d.landValue)) : '') +
    row('"As if complete" valuation', money(d.asIfCompleteValue))
}

// One row per split, so the construction loan and its own rate and repayment
// type are actually in the email. They never were.
export function buildSplitRows(splits: any): string {
  return (splits || [])
    .filter((sp: any) => num(sp?.amount) > 0)
    .map((sp: any, i: number) => row(
      sp.label || `Split ${i + 1}`,
      `${money(num(sp.amount))} &nbsp;·&nbsp; ${sp.rate || ''}% &nbsp;·&nbsp; ${sp.type || 'P&I'}`,
    )).join('')
}

// Not "deposit". It is cash found across the land settlement and the build, not
// a deposit on a purchase. Fabio, 2 Sep 2026.
//
// The incidentals wording is passed in rather than chosen here, because the two
// emails word it slightly differently today and this move is not the moment to
// change what a client reads.
export function fundsToContributeRow(contribute: number, incidentals: string): string {
  return contribute > 0
    ? row(`Funds you need to contribute${incidentals}`, money(contribute))
    // "Nil" rather than "$0". And the parenthesis comes off the label, because
    // "(plus solicitor's fees and incidentals): Nil" reads as if there is
    // nothing to pay at all - so it is said underneath instead.
    : row('Funds you need to contribute', 'Nil') +
      buildNote('You will still have your solicitor&rsquo;s fees and incidentals to cover.', '2px 0 0')
}

// WHY THE LVR IS WHAT IT IS on a deal with no deposit in it. Their land equity
// is the answer, and without it 35% on a page with no deposit anywhere on it
// reads as a mistake.
export function landEquityNote(d: any): string {
  const equity = landEquity(d)
  return equity > 0
    ? buildNote(`Your ${money(equity)} of equity in the land takes the place of a deposit.`)
    : ''
}

// Left out entirely when nobody has typed a repayment, rather than mailing a
// client "$0 / month".
export function duringConstructionRows(splits: any): string {
  const during = repaymentDuringConstruction(splits)
  return during > 0
    ? row('Repayments during construction', money(during) + ' / month') +
      buildNote(DRAWDOWN_NOTE, '8px 0 0')
    : ''
}
