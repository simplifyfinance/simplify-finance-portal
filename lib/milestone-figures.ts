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
  return purchaseRows({
    price: priceOf(deal),
    duty: dutyOf(deal),
    dutyLabel: dutyLabelFor(bc),
    loan: loanAmount(deal),
    contribution: contributionOf(deal),
    contributionFrom: 'savings',
    lmiApplicable: bc.lmiApplicable,
    lmi: bc.lmi,
    lmiTreatment: bc.lmiTreatment,
  })
}

// WHETHER THERE IS ANYTHING WORTH PRINTING.
//
// An email whose money block is one line saying "Loan amount" is worse than one
// with no money block: it looks like the figures, and it is a fragment of them.
// So the block goes in whole or not at all, and the send screen says which.
export function figuresAreComplete(deal: any): boolean {
  return priceOf(deal) > 0 && loanAmount(deal) > 0 && contributionOf(deal) > 0
}

export function missingFigures(deal: any): string[] {
  const out: string[] = []
  if (priceOf(deal) <= 0) out.push('the purchase price')
  if (loanAmount(deal) <= 0) out.push('the loan amount')
  if (contributionOf(deal) <= 0) out.push("the clients' contribution")
  // Duty is not in the list on purpose. Zero duty is a real answer on a first
  // home buyer, and purchaseRows already prints it as one.
  return out
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
  add('Interest rate', rateOf(option))
  add('Repayments', first.repaymentType)
  add('Loan term', first.termYears ? `${first.termYears} years` : '')
  add('Monthly repayment', monthlyOf(option))
  return out
}

// The rate from whichever module the broker switched on. Two switched on and
// disagreeing prints nothing: there is no way to know which one a given split
// follows, and the wrong rate in a client email is money.
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
