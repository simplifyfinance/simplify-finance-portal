// THE FIGURES A MILESTONE EMAIL PRINTS.
//
// One job: turn a deal into the five lines every purchase on this portal uses,
// so the pre-approval email, the formal approval email, the client email and
// the BC all say the same thing because they are all the same code.
//
// NOTHING IS TYPED INTO AN EMAIL. Fabio's own templates carry "Purchase price $"
// with the figure filled in by hand every time, and a hand-filled figure is a
// figure that can disagree with the deal. Every one of these comes off the
// record.
//
// NEWEST WINS, which is the rule the rest of the portal already follows: once a
// contract exists its price, its duty and its loan are the deal's figures, and
// before that the borrowing capacity's are. A pre-approval email has no
// contract, so it gets the BC's - not because this file has a special case for
// pre-approvals, but because there is nothing newer to prefer.

import { purchaseRows, dutyLabelFor, type PurchaseRow } from './purchase-rows'
import { contractPrice, contractStampDuty } from './contract-figures'
import { loanAmount } from './funds-to-complete'
import { depositAsAssessed } from './contract-funding'
import { isRefinance as factFindSaysRefinance } from './document-rules'
import { typeOf } from './deal-labels'
import { splitsOf, suggestFunds } from './deal-structure'
import { amountOf } from './deal-phase'
import { balanceTotal } from './complex-refinance'
import { releaseOnDeal } from './a-rounding-is-not-an-equity-release'
import { money } from './money'

// WHAT THE EMAIL ASKS, AND WHO IT ASKS.
//
// 24 NOV 2026. TOAN LE-VO'S FORMAL APPROVAL WENT OUT AS A REFINANCE.
//
// It is a straight purchase. The email was headed "formally approved - 2/285
// Riding Road", and the money block under it read:
//
//     Loan amount                $845,000
//     Balance being refinanced   $389,000
//
// and stopped. No purchase price, no stamp duty, no total cost, and no
// contribution - which on a purchase is the line telling a buyer how much cash
// to bring to settlement.
//
// THE FIGURES WERE NEVER THE PROBLEM. THE QUESTION WAS.
//
// This file asked isRefinance() in lib/document-rules.ts, which scans the FACT
// FIND and answers yes if any property carries a loan marked to be refinanced,
// paid out or consolidated. Toan is buying and selling. The fact find holds the
// property he is SELLING and the loan that goes when it sells. A true answer to
// the wrong question - and true of every buy-and-sell, every upgrader, and
// every purchase with a debt being consolidated.
//
// Fabio, 24 Nov 2026: "when you start in lending options, which is the last
// piece of the puzzle, and you go compliance, you can see clearly as day that
// this is just a purchase... it's one split, 845,000, and then that figure can
// change on offer accepted... Whatever the lending options, compliance, that's
// the figure." And: "if offer accepted is going to look at Fact Find, it's
// never going to work, is it?"
//
// He is right, and the portal already had the answer. typeOf() in
// lib/deal-labels.ts is what every chip, card colour, filter and the
// settlements board already use. It reads the deal's transaction type first -
// set at lodgement, later and more certain than anything chosen at BC - then
// the template, which maps buy_sell to 'purchase' and has done since October.
// Nothing in this portal thought Toan was a refinance except this one line.
//
// SO THE EMAIL ASKS THE DEAL WHAT IT IS. One question, one answer, the same one
// the rest of the screen is already showing.
//
// 'unknown' is the only case that still asks the fact find, because a deal that
// records no type, no template and no words in its name has nothing else to be
// asked - and sending a genuine refinance through the purchase branch is the
// Mellissa Sedin fault of 28 October, where a refinance was asked for a
// purchase price, could not have one, and lost its whole money block.
//
// document-rules keeps its own version and should. A sold property's mortgage
// IS discharged, so asking for the discharge form off the fact find is the
// right question THERE. Two questions that sound alike: what documents does
// this deal need, and what IS this deal. Only the second belongs in a client's
// email.
// WHAT THE LOAN ITSELF SAYS IT IS.
//
// Fabio, 24 Nov 2026: "If you look on the compliance and the lending options
// tab, there is literally a breakdown of what the deal is for. So we don't even
// need to rely on a tag, just in case the tag is wrong."
//
// He is right, and this is the stronger evidence of the two. A tag is something
// somebody picked. The splits are the loan: what it is made of, what each part
// is called, and - on a deal that both buys and refinances - what each part's
// money actually does, answered on the lending options tab and carried into
// compliance.
//
// Toan's deal is one split called "End Debt" for $845,000. Nothing about that
// is a refinance, and no tag had to be right for this to see it.
//
// A recorded answer wins over the label. The label is only read where nobody
// has answered, which is most purchases - the funds question is only ASKED on
// deals that do both (see needsFundsRole), because everywhere else it is
// obvious. suggestFunds() is the portal's own reading of a label and is used
// here exactly as the lending options tab uses it.
export type DealShape = 'purchase' | 'refinance' | 'both' | 'unknown'

export function whatTheStructureSays(deal: any): DealShape {
  let buys = false
  let pays = false
  for (const sp of splitsOf(deal)) {
    const role = String((sp as any)?.funds || (sp as any)?.fundsUsedFor || '').trim()
      || suggestFunds(sp?.label)
    if (role === 'purchase') buys = true
    // Equity release is money taken against a loan that is being rewritten, so
    // it belongs on the refinance side of this question - which is also how
    // typeOf() files it.
    if (role === 'payout' || role === 'equity') pays = true
  }
  if (buys && pays) return 'both'
  if (buys) return 'purchase'
  if (pays) return 'refinance'
  return 'unknown'
}

// WHAT THE EMAIL ASKS, IN ORDER, AND WHY THAT ORDER.
//
// 1. THE SPLITS, because they are the loan rather than a label on it.
//    'both' is deliberately NOT decided here: a deal that releases equity AND
//    buys is a real shape this portal already handles, and the tag below
//    already files it correctly as an equity release. Guessing here would
//    change deals that work today.
// 2. THE DEAL'S OWN TYPE - typeOf() in lib/deal-labels.ts, which every chip,
//    card colour, filter and the settlements board already use. It reads the
//    transaction type set at lodgement, then the template, where buy_sell has
//    mapped to 'purchase' since October.
// 3. THE FACT FIND, and ONLY where the first two know nothing at all. A deal
//    with no splits, no type and no template has nothing else to be asked, and
//    sending a genuine refinance down the purchase branch is the Mellissa Sedin
//    fault of 28 October, where a refinance was asked for a purchase price it
//    could not have and lost its entire money block.
//
// THE FACT FIND IS NEVER ASKED ABOVE STEP 3 AGAIN. It is where a deal started.
// By the time any of these emails go out it is the oldest thing on the record,
// and on a buy-and-sell it describes a transaction that is not the one being
// approved. That one line is what put "Balance being refinanced" on Toan
// Le-Vo's purchase.
export function emailIsRefinance(deal: any): boolean {
  const shape = whatTheStructureSays(deal)
  if (shape === 'purchase') return false
  if (shape === 'refinance') return true

  const type = typeOf(deal)
  if (type === 'refinance' || type === 'equity_release') return true
  if (type !== 'unknown') return false
  return factFindSaysRefinance(deal)
}

// AND WHERE THE TWO DISAGREE, SOMEBODY IS TOLD.
//
// The structure and the tag should say the same thing. When they do not, one of
// them is wrong and this file cannot know which - so it prints the loan's own
// answer and says so on the send screen, rather than picking quietly. The email
// is not blocked: a warning nobody can act on is worse than one they can.
export function shapeDisagreement(deal: any): string | null {
  const shape = whatTheStructureSays(deal)
  if (shape !== 'purchase' && shape !== 'refinance') return null
  const type = typeOf(deal)
  if (type === 'unknown') return null
  const tagSaysRefinance = type === 'refinance' || type === 'equity_release'
  if (tagSaysRefinance === (shape === 'refinance')) return null
  return `CHECK THIS BEFORE SENDING. The loan is built as a ${shape === 'purchase' ? 'purchase' : 'refinance'} ` +
    `on the lending options, but the deal is tagged ${type.replace(/_/g, ' ')}. ` +
    `The figures below follow the loan, not the tag. If the tag is the right one, fix it on the deal and reopen this screen.`
}

const num = (v: any): number => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

// What the clients are putting in: what they answered against the contract,
// else what the borrowing capacity had them bringing.
export function contributionOf(deal: any): number {
  return num(deal?.contract_deposit) || depositAsAssessed(deal)
}

export function priceOf(deal: any): number {
  const bc = deal?.bc_data || {}
  return contractPrice(deal) || num(bc.purchasePrice) || num(bc.newPurchasePrice)
}

export function dutyOf(deal: any): number {
  return contractStampDuty(deal) || num(deal?.bc_data?.stampDuty)
}

// THE FIVE LINES. Purchase price, duty labelled by its state, total cost, loan
// amount, contribution - plus whatever LMI treatment the deal carries, which
// purchaseRows already knows how to say.
export function milestoneRows(deal: any): PurchaseRow[] {
  const bc = deal?.bc_data || {}

  // A REFINANCE HAS ITS OWN THREE LINES.
  //
  // There is no price, no duty and no deposit, and printing those labels empty
  // would be worse than leaving them out. What a refinancing client wants
  // confirmed is the same thing a buyer does - what are we borrowing - plus
  // what is being paid out and anything they are taking in hand.
  //
  // Each line appears only where there is a figure. A refinance with no equity
  // release prints two lines, not a "Cash out $0" that reads as a decision.
  if (emailIsRefinance(deal)) {
    const rows: PurchaseRow[] = []
    const add = (label: string, n: number) => { if (n > 0) rows.push({ label, value: money(n) }) }
    add('Loan amount', loanForEmail(deal))
    add('Balance being refinanced', balanceTotal(bc))
    // NOT THE ROUNDING - 19 Nov 2026. "Cash out $1,500" in front of a client
    // whose loan was rounded up to cover a month's interest reads as money
    // they are getting. See lib/a-rounding-is-not-an-equity-release.ts.
    add('Cash out', releaseOnDeal(deal))
    return rows
  }

  return purchaseRows({
    price: priceOf(deal),
    duty: dutyOf(deal),
    dutyLabel: dutyLabelFor(bc),
    loan: loanForEmail(deal),
    contribution: contributionOf(deal),
    contributionFrom: 'savings',
    // The record, not three of its fields - so a premium recorded against a
    // security reaches the preapproval, the formal approval and the offer
    // accepted email. See lmiFrom in lib/purchase-rows.ts.
    lmiFrom: bc,
  })
}

// WHETHER THERE IS ANYTHING WORTH PRINTING.
//
// An email whose money block is one line saying "Loan amount" is worse than one
// with no money block: it looks like the figures, and it is a fragment of them.
// So the block goes in whole or not at all, and the send screen says which.
export function figuresAreComplete(deal: any): boolean {
  return missingFigures(deal).length === 0
}

export function missingFigures(deal: any): string[] {
  // ONE LIST, SAID TWO WAYS. These words go in `problems`; the same list with
  // its boxes and its columns is what components/MissingFigures.tsx draws at
  // the top of the send screen. A second copy of "what is missing" would be a
  // screen offering a box for something the gate does not want, or refusing to
  // print over something it never asked for.
  return figuresToFill(deal).map(f => f.words)
}

// --- the loan's own details ------------------------------------------------

export type LoanDetail = { label: string; value: string }

// Product, rate, repayment type, term and monthly repayment - off the lending
// option THIS DEAL is with, which after 29 Sep is the clients' own choice where
// they made one. A detail with nothing recorded is left out rather than printed
// blank: six labels and three answers reads as a broken email.
export function loanDetails(deal: any, option: any, splits: any[]): LoanDetail[] {
  const out: LoanDetail[] = []
  const add = (label: string, value: any) => {
    const v = String(value ?? '').trim()
    if (v) out.push({ label, value: v })
  }
  const first = (splits || [])[0] || {}
  add('Product', option?.productName)
  // THE MODULES FIRST, THEN THE SPLITS.
  //
  // 28 Oct 2026. A lender priced on its splits has empty rate modules, and this
  // printed a product, a repayment type and no rate - on the same deal whose
  // lending options email had shown the rate perfectly, because that email
  // reads the splits. Two places to look and only one of them was looked at.
  add('Interest rate', rateOf(option) || rateFromSplits(splits))
  add('Repayments', first.repaymentType)
  add('Loan term', first.termYears ? `${first.termYears} years` : '')
  add('Monthly repayment', monthlyOf(option))
  return out
}

// The rate from whichever module the broker switched on. Two switched on and
// disagreeing prints nothing: there is no way to know which one a given split
// follows, and the wrong rate in a client email is money.
/**
 * THE RATE OFF THE SPLITS, WHERE EVERY SPLIT AGREES.
 *
 * Two splits on different rates print nothing: there is no single rate to name
 * and naming one of them is inventing the other. Exactly the rule rateOf()
 * follows for the modules.
 *
 * AND IT NEVER SAYS FIXED OR VARIABLE. A split does not record which, and the
 * repayment type beside it is P&I or interest only, which is a different
 * question. Printing "variable" because the module usually is would be a guess
 * on a client's email about the thing they care most about.
 */
function rateFromSplits(splits: any[]): string {
  const rates = (splits || [])
    .map(s => String(s?.rate ?? '').trim())
    .filter(Boolean)
  if (rates.length === 0) return ''
  if (!rates.every(r => r === rates[0])) return ''
  return `${rates[0]}% p.a.`
}

function rateOf(option: any): string {
  const rates = ['variablePI', 'variableIO', 'fixedPI', 'fixedIO']
    .map(k => (option?.[k]?.enabled ? String(option[k]?.rate ?? '').trim() : ''))
    .filter(Boolean)
  if (rates.length === 0) return ''
  if (!rates.every(r => r === rates[0])) return ''
  const kind = option?.fixedPI?.enabled || option?.fixedIO?.enabled ? 'fixed' : 'variable'
  return `${rates[0]}% p.a. ${kind}`
}

function monthlyOf(option: any): string {
  const reps = ['variablePI', 'variableIO', 'fixedPI', 'fixedIO']
    .map(k => (option?.[k]?.enabled ? String(option[k]?.repayment ?? '').trim() : ''))
    .filter(Boolean)
  if (reps.length !== 1) return ''
  const n = num(reps[0])
  return n > 0 ? `$${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}` : ''
}

// --- the figures that are not there, and where to put them -------------------

// THE LOAN A DEAL ACTUALLY HAS.
//
// 9 Nov 2026. Kelly Twyford's formal approval went out with no money block at
// all. The deal has a $900,000 contract price, $200,000 recorded when it was
// lodged on 9 October, and NO BORROWING CAPACITY - bc_data is null, and the
// history shows it was never filled rather than wiped. Fabio: "I am sure there
// was data in there." There never was; the deal was worked through the fact
// find, the lending options and the contract.
//
// loanAmount() reads the contract, then the BC's splits, then the lending
// options. amountOf() in lib/deal-phase.ts reads what the deal lodged and
// settled at. Two functions, one fact, and on this deal they disagreed: 0
// against $200,000.
//
// This is the usual medicine - ask the second one only when the first has
// nothing, so no deal that works today can change.
export function loanForEmail(deal: any): number {
  return loanAmount(deal) || amountOf(deal) || 0
}

// RECORDED, WHICH IS NOT THE SAME AS MORE THAN ZERO.
//
// A first home buyer's duty is $0 and that is an answer. A duty nobody has
// typed is also 0 through num(), and that is not. Told apart here, because
// money(0) prints "$0" - a figure, not a blank - and the two lines under it
// are then both short by the duty. On Twyford that was about $49,000 less cash
// than she has to bring, in writing, over a broker's signature.
const recorded = (v: any) => v !== null && v !== undefined && String(v).trim() !== ''

export function dutyIsRecorded(deal: any): boolean {
  return recorded(deal?.contract_stamp_duty) || recorded(deal?.bc_data?.stampDuty)
}

export type MissingFigure = {
  key: 'price' | 'loan' | 'duty'
  // In a sentence: "the purchase price is not on the deal".
  words: string
  // The box on the screen, and the column it is written to. Contract columns,
  // because they sit at the top of every precedence chain in this portal - a
  // figure typed here cannot be quietly outranked by an older one.
  column: 'contract_price' | 'contract_loan_amount' | 'contract_stamp_duty'
  label: string
  // Why the email cannot be built without it. Said, not implied.
  why: string
}

/**
 * What has to be recorded before the money block can print, and where it goes.
 *
 * THE CONTRIBUTION IS NOT ON THIS LIST ANY MORE. purchaseRows() works it out -
 * total cost minus the loan - so demanding somebody type it was asking for a
 * figure the email never reads. It cost Twyford its whole block.
 */
export function figuresToFill(deal: any): MissingFigure[] {
  const out: MissingFigure[] = []
  const loan: MissingFigure = {
    key: 'loan', words: 'the loan amount', column: 'contract_loan_amount',
    label: 'Loan amount',
    why: 'There is nothing to tell the client they are borrowing.',
  }

  // A refinance owes the loan amount and nothing else: there is no price and no
  // duty to ask for, and asking produced an answer of "missing" every time.
  if (emailIsRefinance(deal)) {
    if (loanForEmail(deal) <= 0) out.push(loan)
    return out
  }

  if (priceOf(deal) <= 0) {
    out.push({
      key: 'price', words: 'the purchase price', column: 'contract_price',
      label: 'Purchase price',
      why: 'Total cost and the contribution are both built on it.',
    })
  }
  if (loanForEmail(deal) <= 0) out.push(loan)
  if (!dutyIsRecorded(deal)) {
    out.push({
      key: 'duty', words: 'the stamp duty', column: 'contract_stamp_duty',
      label: 'Stamp duty',
      why: 'Not recorded is not $0. Left out, total cost and the contribution are ' +
           'both short by the duty.',
    })
  }
  return out
}
