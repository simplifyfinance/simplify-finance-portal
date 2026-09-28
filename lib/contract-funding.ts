// THE PRICE MOVED. WHERE DOES THE DIFFERENCE COME FROM?
//
// Fabio, 27 Sep 2026, asked what should happen when the contract comes in above
// the BC: "Ask before calcualting to ensure custoemr would like to keep same
// savings postion or reduce or increase".
//
// That is the whole question, and it is a conversation with a client rather than
// a sum. The clients either keep their savings where they are and borrow the
// difference, or they find it themselves and borrow what they always were. Both
// are normal. Nothing here decides; it works out what each one would mean and
// waits.
//
// THE LVR IS NOT CALCULATED HERE. It is asked of the real one, by handing
// lvrOf a copy of the deal with the figures it would have. A second
// implementation would drift from the first the week somebody changed how
// security is counted - and this codebase has already been bitten by an LVR that
// looked right and was 158.8%. See securityValue.

import { lvrOf } from './funds-to-complete'

const num = (v: any): number => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

// Above this, lenders mortgage insurance comes into it. The one number on this
// screen somebody could walk a client past without noticing.
const LMI_AT = 80

export type FundingChoice = {
  key: 'loan' | 'savings' | 'custom'
  // What it means, in the words somebody would use to a client.
  title: string
  loan: number
  // What the clients put in themselves, which is the other half of the same
  // decision. Price less loan - the costs around it are funds to complete's job.
  contribution: number
  lvr: number | null
  // The LVR crosses 80 on this choice when it did not before. Not "the LVR is
  // over 80" - a deal that was always over 80 is not news, and a warning that
  // fires on every deal stops being read.
  bringsLmiIn: boolean
}

export type PriceMove = {
  was: number
  now: number
  difference: number
  direction: 'up' | 'down'
  choices: FundingChoice[]
  // True when the deal was already over 80 before any of this.
  lmiAlready: boolean
}

// Null when there is nothing to ask: no contract price, no BC price to compare
// against, no loan to move, or the price has not actually changed.
export function priceMove(deal: any, customLoan?: any): PriceMove | null {
  const bc = deal?.bc_data || {}
  const was = num(bc.purchasePrice) || num(bc.newPurchasePrice)
  const now = num(deal?.contract_price)
  // The loan as it stood BEFORE any contracted figure - the thing being moved.
  const loanBefore = num(deal?.lo_data?.loanAmount)
    || (deal?.bc_data?.splits || []).reduce((s: number, x: any) => s + num(x?.amount), 0)

  if (was <= 0 || now <= 0 || loanBefore <= 0 || was === now) return null

  const difference = now - was
  const lvrIf = (loan: number) =>
    lvrOf({ ...deal, contract_price: now, contract_loan_amount: loan })

  // What it is today, against today's price - the baseline a warning is measured
  // from.
  const lvrBefore = lvrOf({ ...deal, contract_price: 0, contract_loan_amount: 0 })
  const lmiAlready = lvrBefore !== null && lvrBefore > LMI_AT

  const make = (key: FundingChoice['key'], title: string, loan: number): FundingChoice => {
    const lvr = lvrIf(loan)
    return {
      key, title, loan,
      contribution: Math.max(0, now - loan),
      lvr,
      bringsLmiIn: !lmiAlready && lvr !== null && lvr > LMI_AT,
    }
  }

  const choices: FundingChoice[] = [
    make('loan', difference > 0
      ? 'Their savings stay where they are — the loan covers it'
      : 'They borrow less — the saving comes off the loan',
      Math.max(0, loanBefore + difference)),
    make('savings', difference > 0
      ? 'They cover it themselves — the loan stays the same'
      : 'They keep the difference — the loan stays the same',
      loanBefore),
  ]

  const typed = num(customLoan)
  if (typed > 0) choices.push(make('custom', 'The loan amount you have typed', typed))

  return { was, now, difference: Math.abs(difference), direction: difference > 0 ? 'up' : 'down', choices, lmiAlready }
}

// One line a person reads, rather than three numbers they have to compare.
export function choiceLine(c: FundingChoice, moveDirection: 'up' | 'down'): string {
  const money = (n: number) => '$' + Math.round(n).toLocaleString('en-AU')
  const lvr = c.lvr === null ? 'LVR not known' : `LVR ${c.lvr}%`
  const warn = c.bringsLmiIn ? ' — this takes it over 80% and LMI applies' : ''
  return `Loan ${money(c.loan)} · they contribute ${money(c.contribution)} · ${lvr}${warn}`
}
