import { contractPrice, contractLoan, contractStampDuty } from './contract-figures'
import { isLandPurchase, landLoanPayout, dutyApplies } from './construction'
import { buildsSomething, purchasePriceOf } from './sale-build'
import { securitiesWithPurchase, totalsOf, canBuyAndRefinance,
         BEING_PURCHASED, purchaseLoanOf } from './securities'
import { isTopUp, cashReleased, isDollarForDollar } from './top-up'
import { lmiAmount, lmiTreatment, LMI_COST_LABEL } from './lmi'
import { money } from './money'

// WHAT THE CLIENT HAS TO FIND.
//
// Deliberately, aggressively simple. Fabio, 3 Sep 2026: "it is VERY simple
// Purchase Price, Stamp Duty, and deposit as we have the loan value correct? no
// legal fees etc AND no funds to complete if a refinance - remember construction
// will have funds to complete."
//
// The first version of this added lender fees, LMI, the first home owner grant,
// sale proceeds and the debt being refinanced. Every one of those was a way to
// be wrong, and two of them WERE wrong - a released-equity line double counted
// the same dollars, and a purchase-plus-refinance produced a six-figure surplus
// that did not exist. Cutting them out removed the bugs with them.
//
// Purchase:      price + stamp duty  −  loan
// Construction:  land + build + stamp duty  −  loan
// Refinance:     nothing at all. There is no completion to fund.
//
// THE DEPOSIT IS NOT SUBTRACTED. Fabio, 3 Sep 2026, looking at Chapman: "missed
// that funds to complete IS deposit not one or the other!" The deposit is not
// money already handed over and taken off the bill - it is the money the client
// has to produce, which is the whole question this strip answers. Subtracting it
// answered "nil" on a deal where the client has to find $3,841,500.
//
// So the recorded deposit is carried alongside as a CHECK. On Chapman the two
// agree to the dollar. When they do not, the strip says so, because one of the
// two numbers is then wrong and it is worth knowing before settlement.

export type FundsLine = { label: string; amount: number; kind: 'cost' | 'source' }

export type FundsToComplete = {
  lines: FundsLine[]
  // SHOWN, BUT NOT ADDED UP. LMI and the risk fee are capitalised onto the loan
  // - the client does not find that money at settlement, the loan carries it. So
  // it belongs on the strip where somebody can see it, and nowhere near the
  // arithmetic. Fabio, 3 Sep 2026: "add LMI ... it doesnt impact funds to
  // complete as LMI and risk fee is capitalised on the loans".
  capitalised: FundsLine[]
  toFind: number
  // The deposit the BC records. It should BE the funds to complete - it is the
  // same money described from the other end - so it is shown beside the total
  // rather than taken off it. Null when none has been recorded.
  deposit: number | null
  // False when a deposit IS recorded and does not match, to the dollar.
  depositAgrees: boolean
  // False when the deal is mixed and the split roles are unanswered. The lines
  // are still worth showing; the total is not, because it would be wrong.
  workable: boolean
  // Named, so the strip can say "stamp duty has not been recorded" rather than
  // treating a blank as zero and quoting a total that is short by $45,000.
  missing: string[]
  // False on a refinance, and on anything with nothing recorded yet. Nothing is
  // drawn at all.
  applies: boolean
}

function num(v: any): number {
  // Money is stored comma-formatted all over this codebase and
  // Number("5,250,000") is NaN.
  const n = Number(String(v ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const has = (v: any) => num(v) > 0
const txt = (v: any) => String(v ?? '').trim()

// A BUILD IS A BUILD WHOEVER IS PAYING FOR IT.
//
// 9 Oct 2026. This asked the template name, so a buy and sell funding a build
// was treated as an ordinary purchase: the funds box would have added a
// purchase price that is not there and ignored the land and the build.
//
// buildsSomething() is the construction template OR a buy and sell answered
// that way - see lib/sale-build.ts. The typed-cost line below it stays: it is
// the net for records written before any of this, and it is deliberately NOT
// the thing that decides, because a half-typed box is not an answer.
export function isConstruction(deal: any): boolean {
  return buildsSomething(deal?.bc_data)
    || has(deal?.bc_data?.constructionCost)
}

// A pure refinance has no funds to complete - there is no settlement to fund.
// A deal that BOTH refinances and buys does: the purchase still has to settle.
export function fundsApply(deal: any): boolean {
  const bc = deal?.bc_data || {}
  return isConstruction(deal) || has(bc.purchasePrice) || has(bc.newPurchasePrice)
}

// A deal that both refinances and buys.
//
// purchasePriceOf() rather than bc.purchasePrice: a deal switched from buying
// to building keeps the price it was typed with, and reading it raw would have
// this reporting a purchase that is not happening - which costs a total,
// because a mixed deal refuses to answer until every split has a role.
function mixed(deal: any): boolean {
  const bc = deal?.bc_data || {}
  // A BUY AND SELL IS NOT ONE OF THESE, AND HAS BEEN TREATED AS ONE SINCE THIS
  // WAS WRITTEN.
  //
  // 9 Oct 2026. The existing loan on a buy and sell is discharged OUT OF THE
  // SALE - the net proceeds box is the sale price less the agent fees less that
  // balance, and what survives becomes the deposit. The new lending funds the
  // purchase and nothing else.
  //
  // Reading an existing loan balance here made every buy and sell deal in the
  // portal refuse to show a funds to complete at all. It asked for a role on
  // each split, which this scenario has already answered, and until somebody
  // gave it one the box said nothing.
  //
  // refinancedDebt() itself is deliberately untouched: that debt IS being paid
  // out and the deal row is right to say so.
  if (txt(bc.template) === 'buy_sell') return false

  // THE SCENARIO ITSELF IS AN ANSWER TO THIS QUESTION.
  //
  // 16 Oct 2026. Equity release + purchase refinances existing properties and
  // buys one - that is what the template IS, and it is the only reason anybody
  // picks it. Deciding "does this deal refinance" from whether a payout figure
  // happens to be typed meant the answer flipped the moment those figures moved
  // onto the securities, and the funds to complete went to $0 on a $700,000
  // purchase. A scenario a person chose is firmer ground than a box they may
  // not have reached yet.
  if (canBuyAndRefinance(bc.template)) return true

  return (has(purchasePriceOf(bc)) || has(bc.newPurchasePrice)) && refinancedDebt(deal) > 0
}

// THE LENDING THAT ACTUALLY REACHES THE PURCHASE.
//
// Counting the whole loan reported "$625,000 over" on a deal whose real answer
// was $75,000, because most of that lending paid out an old mortgage and
// released equity - money the purchase never sees. On a mixed deal only the
// splits somebody marked as funding the purchase are counted.
//
// Null means "cannot be worked out yet": the deal is mixed and at least one
// split has not been answered. A partial sum would look finished and be wrong.
//
// This reads splits directly rather than through deal-structure's splitsOf(),
// which imports from this file. One narrow duplication beats a circular import,
// and all it needs here is an amount and a role.
function purchaseLoan(deal: any): number | null {
  if (!mixed(deal)) return loanAmount(deal)
  const lo = deal?.lo_data || {}
  const fromLo = (lo.refinanceSplits || []).filter((s: any) => has(s?.amount) || txt(s?.label))
  const splits: any[] = fromLo.length > 0 ? fromLo : (deal?.bc_data?.splits || [])
  if (splits.length === 0) return null

  // THE ONE ANSWER TO "WHAT BUYS THE HOUSE", shared with the LVR box on the
  // lending options and the purchase card in its email. It reads the split's
  // security first and its label second, so a deal recorded before the TBA
  // security existed still comes out right. See lib/securities.ts.
  const buying = purchaseLoanOf({ splits })
  if (buying > 0) return buying

  // THE HOUSE A SPLIT IS SECURED BY ANSWERS THIS WITHOUT BEING ASKED AGAIN.
  //
  // 16 Oct 2026. A loan secured by a property the clients already own does not
  // fund the purchase of a different one, and a loan secured by the property
  // being purchased does nothing else. Both are recorded facts on the split -
  // see BEING_PURCHASED in lib/securities.ts - so where every split carries a
  // security there is nothing left to ask.
  //
  // A TYPED ROLE STILL WINS, and a split carrying neither still stops this
  // dead. Null means "cannot be worked out yet"; a partial sum would look
  // finished and be wrong, which is the whole reason this returns null at all.
  // A NARROWER QUESTION THAN THE ONE ON SCREEN, ON PURPOSE. The deal structure
  // block asks a three-way role - funds the purchase, pays out debt, releases
  // equity - and payout versus equity is a real distinction only a person can
  // make. This only needs yes or no to the first one, and a split secured by a
  // house the clients already own answers no with certainty.
  const fundsThePurchase = (x: any): boolean | null => {
    const typed = txt(x?.funds)
    if (typed) return typed === 'purchase'
    const sec = txt(x?.securityId)
    if (sec === BEING_PURCHASED) return true
    if (sec) return false
    return null
  }
  if (splits.some((s: any) => fundsThePurchase(s) === null)) return null
  return splits.filter((s: any) => fundsThePurchase(s) === true)
    .reduce((t: number, s: any) => t + num(s?.amount), 0)
}

export function fundsToComplete(deal: any): FundsToComplete {
  const bc = deal?.bc_data || {}
  if (!fundsApply(deal)) {
    return { lines: [], capitalised: [], toFind: 0, deposit: null, depositAgrees: true,
             workable: false, missing: [], applies: false }
  }

  const lines: FundsLine[] = []
  const capitalised: FundsLine[] = []
  const missing: string[] = []

  if (isConstruction(deal)) {
    // LAND ALREADY OWNED IS NOT A COST. It is the security, and it was being
    // counted as money to find - see lib/construction.ts. A payout on an
    // existing land loan IS a cost, because the facility has to fund it.
    if (isLandPurchase(bc)) {
      if (has(bc.landValue)) lines.push({ label: 'Land value', amount: num(bc.landValue), kind: 'cost' })
      else missing.push('Land value has not been recorded')
    } else {
      const payout = landLoanPayout(bc)
      if (payout > 0) lines.push({ label: 'Existing land loan paid out', amount: payout, kind: 'cost' })
    }
    if (has(bc.constructionCost)) lines.push({ label: 'Construction cost', amount: num(bc.constructionCost), kind: 'cost' })
    else missing.push('Construction cost has not been recorded')
  } else {
    // THE CONTRACT WINS OVER THE ESTIMATE. The BC's price is what the clients
    // could afford; this is what they paid. See lib/contract-figures.ts - the BC
    // itself is never rewritten, it is simply no longer the newest thing we know.
    const price = contractPrice(deal)
      || (has(bc.purchasePrice) ? num(bc.purchasePrice) : num(bc.newPurchasePrice))
    lines.push({ label: 'Purchase price', amount: price, kind: 'cost' })
  }

  // NEVER treated as zero. On a purchase this is tens of thousands of dollars,
  // and a total that quietly leaves it out looks exactly like a correct one.
  // Duty follows the price that was actually paid, once somebody records it.
  // See contractStampDuty - the portal never works duty out for itself.
  // THE BOX THIS TEMPLATE ACTUALLY WRITES INTO.
  //
  // 16 Oct 2026. Fabio, on an Equity release + purchase: "you know from BC that
  // equity is being used to purchase the property, why do you ask?"
  //
  // The BC's new purchase block writes newPurchaseStampDuty and
  // newPurchaseDeposit. The client email has read both for weeks - that is why
  // the BC email was right. This file read bc.stampDuty and bc.deposit only, so
  // the compliance tab reported two figures missing that were sitting on the
  // deal. One file reading three fields and another reading one.
  const duty = contractStampDuty(deal)
    || (has(bc.stampDuty) ? num(bc.stampDuty)
      : has(bc.newPurchaseStampDuty) ? num(bc.newPurchaseStampDuty) : 0)
  if (duty > 0) lines.push({ label: 'Stamp duty', amount: duty, kind: 'cost' })
  // A BUILD ON LAND SOMEBODY ALREADY OWNS HAS NO DUTY, and "not recorded" is a
  // different claim from "none". This deal was permanently reported incomplete
  // over a figure that does not exist.
  else if (!isConstruction(deal) || dutyApplies(bc)) missing.push('Stamp duty has not been recorded')

  // WHERE THE PREMIUM GOES DEPENDS ON THE ANSWER, AND THIS NEVER ASKED.
  //
  // 22 Oct 2026. These four lines put every LMI premium in the capitalised
  // list - shown, never added - and that was the right call on 3 Sep, when
  // capitalised was the only thing the portal could record. The
  // capitalised-or-settlement question went on the BC on 16 Sep. This file has
  // never read it, so for six weeks a premium the client pays on the day has
  // been left out of the one figure that tells them what to bring. Every
  // template, not just the build that found it.
  //
  // It also read bc.lmi raw, so the per-property premiums that replaced that
  // box on 20 Oct were invisible here. lmiAmount() adds those up and falls
  // back to the deal-level box, which is what the other eighty-odd readers
  // already use.
  const premium = lmiAmount(bc)
  if (premium !== null) {
    const how = lmiTreatment(bc)
    if (how === 'settlement') {
      // Found on the day, exactly like the stamp duty above it.
      lines.push({ label: LMI_COST_LABEL, amount: premium, kind: 'cost' })
    } else {
      // Capitalised onto the loan, so it changes what is borrowed and never
      // what is found at settlement. Listed so nobody wonders where it went.
      capitalised.push({ label: LMI_COST_LABEL, amount: premium, kind: 'cost' })
      // UNANSWERED IS NOT CAPITALISED, it is unanswered. The total above stays
      // exactly what it has always been - nothing on a live file moves - and
      // the gap is named instead of filled, which is this file's own habit
      // with stamp duty and the deposit.
      if (how === 'unanswered') {
        missing.push(`LMI of ${money(premium)} is recorded but nobody has said whether it is added to the loan. If it is paid at settlement this figure is short by that much.`)
      }
    }
  } else if (txt(bc.lmiApplicable).toLowerCase().startsWith('y')) {
    missing.push('LMI applies but no amount has been recorded')
  }


  const loan = purchaseLoan(deal)
  if (loan === null) {
    // Mixed deal, unanswered splits. Nothing is guessed and no total is offered.
    missing.push('This deal both refinances and buys. Say what each split does — funds the purchase, pays out existing debt, or releases equity — and the funds to complete can be worked out.')
  } else if (loan > 0) {
    lines.push({ label: mixed(deal) ? 'Loan funding the purchase' : 'Loan', amount: loan, kind: 'source' })
  } else {
    missing.push('No loan amount has been recorded')
  }

  const costs = lines.filter(l => l.kind === 'cost').reduce((s, l) => s + l.amount, 0)
  const sources = lines.filter(l => l.kind === 'source').reduce((s, l) => s + l.amount, 0)

  // Never negative. A purchase where the loan and deposit exceed the price and
  // duty needs nothing found; "minus $4,000" reads like a refund.
  // No answer at all while the split roles are unanswered - see purchaseLoan().
  const known = loan !== null
  const toFind = known ? Math.max(0, Math.round(costs - sources)) : 0

  // The cross-check. Not an error either way - a deposit that disagrees means
  // one of the two figures needs another look, and the strip is the place to
  // notice that rather than the settlement statement.
  // AND THE EQUITY RELEASE IS THE DEPOSIT, ON THE SCENARIO BUILT TO SAY SO.
  //
  // On an equity release and purchase the client contributes no savings - the
  // release IS the contribution, which is the whole point of the scenario and
  // what its client email has always printed. Read only where the deal both
  // refinances and buys; on anything else an equity release is not a deposit
  // and must not be counted as one.
  //
  // ON A TOP UP THE DEPOSIT IS THE INCREASE. 20 Oct 2026. A top up has no
  // deal-level equity release box - the figure lives per property, in
  // securityIncreases - so the fallback below found nothing and the strip said
  // "No deposit has been recorded" on a deal whose deposit was sitting right
  // there. The client email already tells them the contribution comes from the
  // loan increase; this makes the portal agree with it.
  const deposit = has(bc.deposit) ? num(bc.deposit)
    : has(bc.newPurchaseDeposit) ? num(bc.newPurchaseDeposit)
    : isTopUp(bc.template) && cashReleased(bc) > 0 ? cashReleased(bc)
    : canBuyAndRefinance(bc.template) && has(bc.equityRelease) ? num(bc.equityRelease)
    : null
  if (deposit === null) missing.push('No deposit has been recorded')

  return {
    lines, capitalised, toFind, deposit,
    depositAgrees: deposit === null || !known || Math.abs(deposit - toFind) < 1,
    workable: known,
    missing, applies: true,
  }
}

// THE BC IS THE LOAN UNLESS SOMEBODY TYPED OTHERWISE ON THE LENDING OPTIONS.
//
// 8 Oct 2026, and the reasoning is in the header of this file's companion
// patch note - in short, this used to prefer lo_data.loanAmount, which is a
// COPY the LO form took from the BC the day the LO record was first written.
// Change the BC afterwards and every reader - the deal card, funds to
// complete, the deal facts, and the prompt that writes the compliance wording
// - went on quoting the old number. Nothing on screen said so.
//
// A copy is not a second opinion. What makes the LO's figure worth preferring
// is a PERSON having typed it, and that used to be recorded on a flag (retired
// in LOForm. Where nobody typed it, the BC wins and carries across by itself,
// with nothing to press and no second writer on lo_data.
export function loanAmount(deal: any): number {
  // Once somebody has answered how a changed price is funded, that answer is the
  // loan. Not before: recording a price does not decide the lending.
  const contracted = contractLoan(deal)
  if (contracted > 0) return contracted
  const lo = deal?.lo_data || {}
  // THE BORROWING CAPACITY'S SPLITS ARE THE LOAN.
  //
  // 13 Oct 2026. This line used to come first:
  //
  //   if (lo.loanAmountByHand && has(lo.loanAmount)) return num(lo.loanAmount)
  //
  // A figure typed on the lending options beat the borrowing capacity, for
  // good, and the deal strip carried a blue banner explaining that it had -
  // "the figure entered by hand wins, and it is what the client sees and what
  // the compliance wording uses". On the Veljovic deal that meant $1,000,000
  // against a borrowing capacity of $2,720,000, in front of a client.
  //
  // Fabio: "why LO anc BC amount dont match fucking hell". They do not match
  // because this line let them. How much is being borrowed is the sum of the
  // splits, the splits are the BC's, so the total is the BC's. The lending
  // options price it; they do not decide how big it is.
  //
  // loanAmountByHand is left on the record because deals already carry it. It
  // is not written any more and must not be read again. docs/the-chain.md.
  const fromBc = bcSplitsTotal(deal)
  if (fromBc > 0) return fromBc
  // A deal with no BC splits at all - the LO's figure is all there is.
  return has(lo.loanAmount) ? num(lo.loanAmount) : 0
}

// The BC's own answer, added up. Every split, never the first - a multi-split
// deal read off the first one reports half the loan.
export function bcSplitsTotal(deal: any): number {
  const splits = deal?.bc_data?.splits || []
  return splits.reduce((s: number, x: any) => s + num(x?.amount), 0)
}

// WHEN THE TWO RECORDS DISAGREE, SAY SO. NEVER CORRECT IT QUIETLY.
//
// Returning null means there is nothing to report: they agree, or there is
// only one of them, or a contract figure has settled the question. Otherwise
// this is the pair of numbers and whether the difference is somebody's
// decision or a copy left behind.
//
// This is the same device as depositAgrees above, and for the same reason: two
// numbers that should be one are worth a sentence on screen, and never worth a
// silent choice between them.
export type LoanDisagreement = { using: number; stored: number; byHand: boolean }

export function loanAmountDisagrees(deal: any): LoanDisagreement | null {
  // An answered contract supersedes both; there is no disagreement left.
  if (contractLoan(deal) > 0) return null
  const lo = deal?.lo_data || {}
  if (!has(lo.loanAmount)) return null
  const stored = num(lo.loanAmount)
  const fromBc = bcSplitsTotal(deal)
  if (fromBc <= 0) return null
  if (Math.abs(stored - fromBc) < 1) return null
  // byHand is always false now. The field stays on the type because callers
  // destructure it; nothing can set it, because nothing may overrule the BC.
  return { using: loanAmount(deal), stored, byHand: false }
}

export type SecurityValue = { total: number; count: number; lvr: number | null; why?: string }

// EVERY security, not just the one being bought. Written the naive way first -
// total lending against the purchase price alone - and it produced an LVR of
// 158.8% on a deal that also refinanced a $620,000 investment property. An LVR
// is a number people act on, so it is absent rather than wrong.
export function securityValue(deal: any): SecurityValue {
  const bc = deal?.bc_data || {}
  const values: number[] = []

  // The security is worth what was paid for it, once that is known. An LVR
  // worked out against a price nobody paid is a number people act on, and it
  // would be wrong in both directions.
  // A BUILD'S SECURITY IS WHAT IT WILL BE WORTH FINISHED.
  //
  // 9 Oct 2026. Nothing here knew that, so a construction deal reached this
  // with no purchase price, no refinanced property and no BC property value -
  // and the compliance facts sheet printed "LVR cannot be worked out" while the
  // client email on the same deal printed an LVR off the "as if complete"
  // valuation. One of those two goes in front of a regulator.
  //
  // It is the figure the lender lends against and the one constructionLvr()
  // already uses, so this is the sheet agreeing with the email rather than a
  // new opinion about anything.
  // THE SECURITIES THE BC ACTUALLY TICKED COME FIRST.
  //
  // 13 Oct 2026, the Veljovic deal. The strip listed SECURITIES (3) with their
  // addresses and said PROPERTY VALUE "not recorded" and LVR "not known" in the
  // same row. Both were true at once, because they were reading different
  // lists: the addresses came from the securities ticked on the BC, and the
  // value came from the loop below, which only counts a fact find property
  // whose LOAN is marked to be refinanced. Tick a house as security without its
  // loan being paid out - which is the whole point of a complex refinance - and
  // it is a security worth nothing.
  //
  // Fabio: "the logic is ALWAYS THE SAME BC sets the tone structure". Which
  // houses secure this deal is the BC's answer, so what they are worth is the
  // total of those houses. securitiesOf and totalsOf are the same two functions
  // the strip already draws the addresses with, so the two cannot disagree again.
  // AND THE HOUSE BEING BOUGHT IS ONE OF THEM.
  //
  // 16 Oct 2026. This found the ticked securities and returned on the spot,
  // never reaching the purchase price below - so on a deal that refinances two
  // houses and buys a third, the purchase LOAN was in the numerator and the
  // purchase PRICE was not in the denominator. 1,855,000 over 1,825,000 of
  // security: 101.6%, printed in Box 1 and Box 4 of a compliance pack. The
  // honest figure is 73.5%.
  const ticked = securitiesWithPurchase(bc, deal?.fact_find_data)
  if (ticked.length > 0) {
    const t = totalsOf(ticked)
    const loan = loanAmount(deal)
    if (t.value > 0 && loan > 0) {
      return { total: t.value, count: ticked.length, lvr: Math.round((loan / t.value) * 1000) / 10 }
    }
    // Ticked but not valued. Said as what it is - an unanswered question on the
    // fact find - rather than falling through to a total built another way,
    // which is how the two came to disagree in the first place.
    if (t.value <= 0) {
      return { total: 0, count: ticked.length, lvr: null,
        why: 'the securities on this deal have no value on the fact find' }
    }
  }

  const built = buildsSomething(bc) && has(bc.asIfCompleteValue) ? num(bc.asIfCompleteValue) : 0
  const buying = contractPrice(deal) || built
    || (has(purchasePriceOf(bc)) ? num(purchasePriceOf(bc))
      : has(bc.newPurchasePrice) ? num(bc.newPurchasePrice) : 0)
  if (buying > 0) values.push(buying)

  for (const p of deal?.fact_find_data?.properties || []) {
    const involved = (p?.loans || []).some((l: any) =>
      ['To be refinanced', 'To be consolidated'].includes(txt(l?.status)))
    if (involved && has(p?.value)) values.push(num(p.value))
  }

  if (values.length === 0 && has(bc.propertyValue)) values.push(num(bc.propertyValue))

  const total = values.reduce((s, v) => s + v, 0)
  const loan = loanAmount(deal)
  if (total <= 0 || loan <= 0) {
    return { total, count: values.length, lvr: null,
      why: 'either the lending or the security value is not recorded' }
  }
  return { total, count: values.length, lvr: Math.round((loan / total) * 1000) / 10 }
}

export function lvrOf(deal: any): number | null {
  return securityValue(deal).lvr
}

// Scenarios where the client is buying and nothing is being refinanced. On these
// an existing loan balance is the mortgage on the home they already own and are
// keeping - see refinancedDebt.
const PURCHASE_ONLY_TEMPLATES = new Set([
  'oo_purchase', 'oo_lvr_compare', 'investment_purchase', 'fhb', 'smsf',
  'construction', 'family_pledge',
])

// What is being paid out on a refinance. Not part of funds to complete - it goes
// in the deal row instead, because it should not vanish just because there is no
// completion to fund.
//
// The BC's existing loan balance is NOT proof of a refinance. Chapman's OO
// purchase carries $1,279,283.98 in that box - the loan on the home they are
// selling out of - and reading it as refinanced debt made a plain purchase look
// like a deal that both refinances and buys, which withheld the funds to
// complete total and demanded an answer to "what does this split do" that the
// deal does not have. On a purchase-only scenario the fact find's "To be
// refinanced" flag is the only authority, because that flag is somebody saying
// so rather than a number left in a box.
export function refinancedDebt(deal: any): number {
  const bc = deal?.bc_data || {}
  let flagged = 0
  for (const p of deal?.fact_find_data?.properties || []) {
    for (const l of p?.loans || []) {
      if (txt(l?.status) === 'To be refinanced') flagged += num(l?.balance)
    }
  }
  if (PURCHASE_ONLY_TEMPLATES.has(txt(bc.template))) return flagged

  // WHAT EACH SECURITY OWES, WHICH IS WHERE THIS FIGURE NOW LIVES.
  //
  // 16 Oct 2026, and this one is mine. Moving the balances onto the securities
  // emptied bc.existingLoanBal, and this function did not know about the new
  // boxes - so a deal refinancing $1,116,000 across two houses reported no
  // refinanced debt at all.
  //
  // That is not a cosmetic figure. mixed() asks "does this deal refinance AND
  // buy" by calling this, so the answer flipped to "no", purchaseLoan() counted
  // the WHOLE $1,855,000 as money reaching the purchase, and the funds to
  // complete came out at $0 on a $700,000 purchase. Fabio: "why thinks deposit
  // is $0 when you can see purchase price breakdown has 290 from equity?"
  //
  // Newest first, and never added together: a deal has its balances in one
  // place or the other, and summing the two would double the payout.
  // A TOP UP PAYS OUT NOTHING, AND THIS IS WHERE THAT WENT WRONG.
  //
  // 20 Oct 2026. On a top up the balance on a security is a loan STAYING with
  // the lender it is already with. Counted here it became "debt being paid
  // out", and two screens then said so out loud: the deal structure block
  // printed it as an existing loan being discharged, and the compliance pack's
  // deposit box read the shape of the deal as a refinance and wrote "This is a
  // refinance of the existing debt dollar for dollar... the new lending of
  // $1,142,441 replaces the existing balance of $942,441 being paid out."
  //
  // Not one clause of that is true on a top up, and it goes to a lender. It is
  // the exact failure the header of lib/top-up.ts is written against: the loan
  // is not moving, so the pack must never call it a refinance.
  //
  // A TICKED SECURITY IS STILL A PAYOUT. Dollar for dollar means the loan DOES
  // move to a new lender, so that balance is discharged and belongs in this
  // figure - which is the third place that tick changes arithmetic rather than
  // wording.
  const balances: Record<string, any> = bc?.securityBalances || {}
  if (isTopUp(bc?.template)) {
    const moving = Object.keys(balances)
      .filter(id => isDollarForDollar(bc, id))
      .reduce((t, id) => t + num(balances[id]), 0)
    if (moving > 0) return moving
    return flagged
  }
  const perSecurity = Object.values(balances).reduce((t: number, v: any) => t + num(v), 0)
  if (perSecurity > 0) return perSecurity

  // Unchanged for every scenario that does refinance: the BC's figure wins,
  // because it is the payout the deal was priced on.
  if (has(bc.existingLoanBal)) return num(bc.existingLoanBal)
  return flagged
}
