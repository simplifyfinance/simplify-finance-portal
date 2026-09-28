// FABIO'S OWN DEAL, 28 Sep 2026.
//
// "99% of the time cusotmer have preapporval for example for $1M and a loan at
// 80% or 800K with Stamp Duty of say $39,000 in NSW they buy for $950,000 we
// normally keep the 80% at $760,000 so keep same LVR and stmap duty is now
// $37,000 OR customer still puts the same savings amount and reduce LVR."
//
// And the rule, in his words: "purcahse pirce + duty = total cost - deposit =
// loan amount". The deposit is the question; the loan falls out of it.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { reworkFromDeposit, depositAsAssessed, depositToKeepLvr,
         dutyNow, priceHasMoved, stampDutyNeedsUpdating } from './contract-funding'
import { loanAmount, lvrOf, fundsToComplete } from './funds-to-complete'
import { contractPrice, contractLoan } from './contract-figures'
import { amountOf } from './deal-phase'

// Preapproved on $1,000,000 at 80%: an $800,000 loan, $39,000 of NSW duty, and
// a $239,000 contribution - which is what the BC keeps in step.
const nsw = (over: any = {}) => ({
  bc_data: { template: 'oo_purchase', purchasePrice: '1,000,000', stampDuty: '39,000',
             deposit: '239,000', splits: [{ label: 'Split 1', amount: '800,000' }] },
  lo_data: { loanAmount: '800,000' },
  ...over,
})

// Bought at $950,000, duty retyped by the team at $37,000.
const bought = (over: any = {}) =>
  nsw({ contract_price: 950000, contract_stamp_duty: 37000, ...over })

describe('what they were already going to bring', () => {
  it('is the deposit the BC has been keeping in step', () => {
    expect(depositAsAssessed(nsw())).toBe(239000)
  })

  it('and is worked out where the BC never recorded one', () => {
    // price + duty - loan, which is the same sum in the other direction.
    const d = nsw()
    d.bc_data.deposit = ''
    expect(depositAsAssessed(d)).toBe(239000)
  })

  it('nothing to say on a deal with no price or no loan', () => {
    expect(depositAsAssessed({})).toBe(0)
    expect(depositAsAssessed({ bc_data: { purchasePrice: '1,000,000' } })).toBe(0)
  })
})

describe('the duty the team typed', () => {
  it('is used once it is there', () => expect(dutyNow(bought())).toBe(37000))
  it('and the BC figure stands until it is', () => expect(dutyNow(nsw({ contract_price: 950000 }))).toBe(39000))
})

// THE SUM. price + duty = total cost, less the deposit, is the loan.
describe('the rework, from the one question', () => {
  const r = reworkFromDeposit(bought(), 239000)!

  it('adds the total cost up rather than storing it', () => {
    expect(r.price).toBe(950000)
    expect(r.duty).toBe(37000)
    expect(r.totalCost).toBe(987000)
  })

  it('and the loan falls out of the deposit', () => {
    expect(r.deposit).toBe(239000)
    expect(r.loan).toBe(748000)          // 987,000 - 239,000
  })

  it('with the LVR that follows from it', () => {
    expect(r.lvr).toBe(78.7)             // 748,000 on 950,000
    expect(r.bringsLmiIn).toBe(false)
  })

  it('a bigger deposit means a smaller loan', () => {
    expect(reworkFromDeposit(bought(), 300000)!.loan).toBe(687000)
  })

  // A deposit larger than the whole cost is no lending, not a negative loan.
  it('never returns a negative loan', () => {
    expect(reworkFromDeposit(bought(), 1200000)!.loan).toBe(0)
  })

  it('nothing to rework without a price or a deposit', () => {
    expect(reworkFromDeposit(nsw(), 239000)).toBeNull()
    expect(reworkFromDeposit(bought(), 0)).toBeNull()
  })
})

// "we normally keep the 80% at $760,000 so keep same LVR"
describe('the deposit that keeps the LVR where it was', () => {
  it('is $227,000 on his numbers, for a $760,000 loan', () => {
    const keep = depositToKeepLvr(bought())
    expect(keep).toBe(227000)
    const r = reworkFromDeposit(bought(), keep)!
    expect(r.loan).toBe(760000)
    expect(r.lvr).toBe(80)
  })

  it('and follows the duty, so it changes when the duty is retyped', () => {
    // Still on the BC's $39,000: 950,000 + 39,000 - 760,000.
    expect(depositToKeepLvr(nsw({ contract_price: 950000 }))).toBe(229000)
  })

  it('nothing to offer with no contract price', () => {
    expect(depositToKeepLvr(nsw())).toBe(0)
  })
})

// THE 80% LINE. A deposit too small takes them into LMI even on a cheaper house.
describe('the warning that matters', () => {
  it('flags a deposit that pushes them over 80', () => {
    // Only $150,000 in: loan $837,000 on $950,000 is 88.1%.
    const r = reworkFromDeposit(bought(), 150000)!
    expect(r.lvr).toBe(88.1)
    expect(r.bringsLmiIn).toBe(true)
  })

  it('and says nothing on a deal that was already over 80', () => {
    const high = bought()
    high.lo_data.loanAmount = '950,000'
    high.bc_data.splits = [{ label: 'Split 1', amount: '950,000' }]
    expect(reworkFromDeposit(high, 150000)!.bringsLmiIn).toBe(false)
  })
})

describe('the duty going stale', () => {
  it('is noticed the moment the price moves', () => {
    expect(stampDutyNeedsUpdating(nsw({ contract_price: 950000 }))).toBe(true)
  })
  it('and stops once the team types the new one', () => {
    expect(stampDutyNeedsUpdating(bought())).toBe(false)
  })
  it('nothing to say when the price has not moved', () => {
    expect(priceHasMoved(nsw())).toBe(false)
    expect(stampDutyNeedsUpdating(nsw({ contract_price: 1000000 }))).toBe(false)
  })
})

// THE FIGURES BECOME THE DEAL'S FIGURES.
//
// Fabio, 28 Sep 2026: "THAT figures now becomes the true reflection of formal
// apporval, settled loan, commissions etc". Lodging happens before the property
// is found, so the lodged total is a preapproval figure and the contract beats
// it. Only what actually settled sits above.
describe('what the rest of the portal then reads', () => {
  const done = bought({ contract_loan_amount: 748000 })

  it('the loan, the LVR and funds to complete all follow the contract', () => {
    expect(loanAmount(done)).toBe(748000)
    expect(lvrOf(done)).toBe(78.7)
    const f = fundsToComplete(done)
    const line = (l: string) => f.lines.find((x: any) => x.label === l)?.amount
    expect(line('Purchase price')).toBe(950000)
    expect(line('Stamp duty')).toBe(37000)
    expect(line('Loan')).toBe(748000)
    expect(f.toFind).toBe(239000)       // what they bring, and it agrees
  })

  it('and it beats the lodged figure, which was recorded before the property was found', () => {
    const lodged = { ...done, lodged_total: 800000 }
    expect(amountOf(lodged)).toBe(748000)
  })

  it('but what actually settled still wins', () => {
    expect(amountOf({ ...done, lodged_total: 800000, settled_total: 747500 })).toBe(747500)
  })

  it('and a deal with no contract is untouched by any of it', () => {
    expect(amountOf({ lodged_total: 800000 })).toBe(800000)
    expect(loanAmount(nsw())).toBe(800000)
    expect(contractPrice(nsw())).toBe(0)
    expect(contractLoan(nsw())).toBe(0)
  })

  it('the BC is never written to', () => {
    expect(done.bc_data.purchasePrice).toBe('1,000,000')
    expect(done.bc_data.stampDuty).toBe('39,000')
    expect(done.lo_data.loanAmount).toBe('800,000')
  })
})

describe('commission and the settlement book read it too', () => {
  const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')

  for (const [file, path] of [
    ['commission', './commission.ts'],
    ['the settlements board', '../app/(app)/settlements/page.tsx'],
    ['the settlement reconcile', '../components/SettlementReconcile.tsx'],
  ] as const) {
    it(`${file} prefers the contract over the lodged figure`, () => {
      const s = src(path)
      expect(s).toContain('contract_loan_amount')
      const at = s.indexOf('contract_loan_amount')
      // settled first, contract second, lodged after.
      expect(s.slice(Math.max(0, at - 220), at)).toContain('settled_total')
      expect(s.slice(at)).toContain('lodged_total')
    })
  }
})

// THE PANEL ASKS ONE QUESTION AND PRINTS THE FIVE LINES.
describe('the panel', () => {
  const code = readFileSync(new URL('../components/OfferAccepted.tsx', import.meta.url), 'utf8')
    .replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  it('asks for the deposit, not for a loan', () => {
    expect(code).toContain('setTypedDeposit')
    expect(code).toContain('reworkFromDeposit(')
    // The loan-first version is gone.
    expect(code).not.toContain('priceMove')
    expect(code).not.toContain('choiceLine')
  })

  it('offers what they were already bringing, and what keeps the LVR', () => {
    expect(code).toContain('depositAsAssessed(d)')
    expect(code).toContain('depositToKeepLvr(d)')
  })

  it('prints the breakdown every purchase uses, rather than its own', () => {
    expect(code).toContain('purchaseRows({')
    expect(code).toContain("from '@/lib/purchase-rows'")
  })

  it('labels duty by state, as the client email does', () => {
    expect(code).toContain('dutyLabelFor(d.bc_data)')
    expect(code).toContain('dutyState')
  })

  // A rework half-written is worse than none, on a regulated file.
  it('records the deposit, the loan, the duty and the person in one write', () => {
    const at = code.indexOf('async function recordRework')
    const fn = code.slice(at, at + 800)
    for (const f of ['contract_deposit', 'contract_loan_amount', 'contract_stamp_duty',
                     'contract_funding_at', 'contract_funding_by']) {
      expect(fn, `${f} is not in the same write`).toContain(f)
    }
    expect((fn.match(/\.update\(/g) || []).length).toBe(1)
    expect(fn).toContain('checkedWrite(')
  })

  it('and still never writes the BC', () => {
    expect(code).not.toContain('bc_data:')
    expect(code).not.toContain('lo_data:')
  })
})

describe('the deposit column', () => {
  it('exists and can be added twice', () => {
    const sql = readFileSync(new URL('../docs/contract-funding-schema.sql', import.meta.url), 'utf8')
    expect(sql).toContain('add column if not exists contract_deposit')
  })
})
