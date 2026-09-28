// THE PRICE MOVED, AND NOBODY GETS TO GUESS WHERE THE MONEY CAME FROM.
//
// Fabio, 27 Sep 2026: "Ask before calcualting to ensure custoemr would like to
// keep same savings postion or reduce or increase". And on the BC itself, 28
// Sep: "Keep the BC, hold the contract beside it."

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { priceMove, choiceLine } from './contract-funding'
import { loanAmount, lvrOf, fundsToComplete } from './funds-to-complete'
import { contractPrice, contractLoan, onTheContract } from './contract-figures'

// A plain owner-occupied purchase: $1,000,000, $800,000 lending, 80% on the nose.
const deal = (over: any = {}) => ({
  bc_data: { template: 'oo_purchase', purchasePrice: '1,000,000', deposit: '200,000',
             splits: [{ label: 'Split 1', amount: '800,000' }] },
  lo_data: { loanAmount: '800,000' },
  ...over,
})

describe('nothing is asked when there is nothing to ask', () => {
  it('no contract price yet', () => expect(priceMove(deal())).toBeNull())
  it('the price has not moved', () =>
    expect(priceMove(deal({ contract_price: 1000000 }))).toBeNull())
  it('no BC to compare against', () =>
    expect(priceMove({ contract_price: 1100000 })).toBeNull())
  it('no lending recorded', () =>
    expect(priceMove({ bc_data: { purchasePrice: '1,000,000' }, contract_price: 1100000 })).toBeNull())
})

describe('the price went up', () => {
  const move = priceMove(deal({ contract_price: 1100000 }))!

  it('says by how much, and which way', () => {
    expect(move.was).toBe(1000000)
    expect(move.now).toBe(1100000)
    expect(move.difference).toBe(100000)
    expect(move.direction).toBe('up')
  })

  it('the loan can cover it — their savings stay put', () => {
    const c = move.choices.find(c => c.key === 'loan')!
    expect(c.loan).toBe(900000)
    expect(c.contribution).toBe(200000)   // unchanged
  })

  it('or they cover it — the loan stays put', () => {
    const c = move.choices.find(c => c.key === 'savings')!
    expect(c.loan).toBe(800000)
    expect(c.contribution).toBe(300000)   // they find the extra $100k
  })

  it('and a figure you type yourself is offered alongside them', () => {
    const typed = priceMove(deal({ contract_price: 1100000 }), 850000)!
      .choices.find(c => c.key === 'custom')!
    expect(typed.loan).toBe(850000)
    expect(typed.contribution).toBe(250000)
  })
})

describe('the price came down', () => {
  const move = priceMove(deal({ contract_price: 900000 }))!

  it('reads as a reduction, not a negative increase', () => {
    expect(move.direction).toBe('down')
    expect(move.difference).toBe(100000)
  })

  it('they can borrow less, or keep the difference', () => {
    expect(move.choices.find(c => c.key === 'loan')!.loan).toBe(700000)
    expect(move.choices.find(c => c.key === 'savings')!.loan).toBe(800000)
  })
})

// THE 80% LINE. LMI turning up at formal approval is the worst way to find out.
describe('the warning that matters', () => {
  it('flags the choice that takes them over 80', () => {
    // $1.1m paid, the loan absorbs it: 900k on 1.1m is 81.8%.
    const move = priceMove(deal({ contract_price: 1100000 }))!
    const byLoan = move.choices.find(c => c.key === 'loan')!
    expect(byLoan.lvr).toBe(81.8)
    expect(byLoan.bringsLmiIn).toBe(true)
  })

  it('and leaves alone the choice that does not', () => {
    const move = priceMove(deal({ contract_price: 1100000 }))!
    const bySavings = move.choices.find(c => c.key === 'savings')!
    expect(bySavings.lvr).toBe(72.7)
    expect(bySavings.bringsLmiIn).toBe(false)
  })

  // A warning that fires on every deal stops being read. A deal already at 90%
  // is not learning anything from "this takes you over 80".
  it('says nothing new on a deal that was always over 80', () => {
    const high = deal({ contract_price: 1100000 })
    high.lo_data.loanAmount = '950,000'
    high.bc_data.splits = [{ label: 'Split 1', amount: '950,000' }]
    const move = priceMove(high)!
    expect(move.lmiAlready).toBe(true)
    expect(move.choices.every(c => c.bringsLmiIn === false)).toBe(true)
  })
})

describe('what a person reads', () => {
  it('one line, not three numbers to compare', () => {
    const move = priceMove(deal({ contract_price: 1100000 }))!
    expect(choiceLine(move.choices[0], 'up'))
      .toBe('Loan $900,000 · they contribute $200,000 · LVR 81.8% — this takes it over 80% and LMI applies')
    expect(choiceLine(move.choices[1], 'up'))
      .toBe('Loan $800,000 · they contribute $300,000 · LVR 72.7%')
  })
})

// KEEP THE BC, HOLD THE CONTRACT BESIDE IT.
//
// The borrowing capacity is what the clients were assessed against and what the
// compliance pack was written from. It is never rewritten. What changes is which
// figure the three readers in funds-to-complete prefer.
describe('the contract is read in preference to the BC, and the BC survives', () => {
  it('a deal with no contract behaves exactly as it always did', () => {
    const d = deal()
    expect(loanAmount(d)).toBe(800000)
    expect(lvrOf(d)).toBe(80)
    expect(contractPrice(d)).toBe(0)
    expect(onTheContract(d)).toBe(false)
  })

  it('recording a price alone moves the security value, not the loan', () => {
    // Recording what they paid does not decide the lending - that is the whole
    // point of asking.
    const d = deal({ contract_price: 1100000 })
    expect(loanAmount(d)).toBe(800000)
    expect(lvrOf(d)).toBe(72.7)
  })

  it('answering the question moves the loan too', () => {
    const d = deal({ contract_price: 1100000, contract_loan_amount: 900000 })
    expect(loanAmount(d)).toBe(900000)
    expect(lvrOf(d)).toBe(81.8)
    expect(contractLoan(d)).toBe(900000)
  })

  it('and funds to complete follows the price they actually paid', () => {
    const before = fundsToComplete(deal())
    const after = fundsToComplete(deal({ contract_price: 1100000 }))
    const priceLine = (f: any) => f.lines.find((l: any) => l.label === 'Purchase price')?.amount
    expect(priceLine(before)).toBe(1000000)
    expect(priceLine(after)).toBe(1100000)
  })

  it('the BC itself is never touched', () => {
    const d = deal({ contract_price: 1100000, contract_loan_amount: 900000 })
    expect(d.bc_data.purchasePrice).toBe('1,000,000')
    expect(d.lo_data.loanAmount).toBe('800,000')
  })
})

// THE PANEL ASKS IT, AND RECORDS THE ANSWER AS ONE THING.
describe('the panel', () => {
  const src = readFileSync(new URL('../components/OfferAccepted.tsx', import.meta.url), 'utf8')
  const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  it('asks the question only when the price has actually moved', () => {
    expect(code).toContain('const move = priceMove(d, typedLoan)')
    expect(code).toContain('{move && (')
  })

  it('offers a figure typed by hand alongside the two obvious ones', () => {
    expect(code).toContain('setTypedLoan')
  })

  // A choice half-written is worse than no choice, on a regulated file.
  it('records the loan, the choice, the time and the person in one write', () => {
    const at = code.indexOf('async function recordFunding')
    const fn = code.slice(at, at + 900)
    for (const f of ['contract_loan_amount', 'contract_funding_choice',
                     'contract_funding_at', 'contract_funding_by']) {
      expect(fn, `${f} is not in the same write`).toContain(f)
    }
    expect((fn.match(/\.update\(/g) || []).length).toBe(1)
  })

  it('and the write is checked, because a refused one returns no rows', () => {
    const at = code.indexOf('async function recordFunding')
    expect(code.slice(at, at + 900)).toContain('checkedWrite(')
  })

  it('it still never writes the BC', () => {
    expect(code).not.toContain('bc_data:')
    expect(code).not.toContain('lo_data:')
  })
})

describe('the columns it writes to', () => {
  const sql = readFileSync(new URL('../docs/contract-funding-schema.sql', import.meta.url), 'utf8')

  it('exist, and can be added twice', () => {
    for (const c of ['contract_loan_amount', 'contract_funding_choice',
                     'contract_funding_at', 'contract_funding_by']) {
      expect(sql).toContain(`add column if not exists ${c}`)
    }
  })

  it('and nothing in it rewrites the borrowing capacity', () => {
    expect(sql).not.toMatch(/update\s+deals\s+set\s+bc_data/i)
  })
})
