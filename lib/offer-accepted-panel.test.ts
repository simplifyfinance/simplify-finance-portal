// THE PANEL THAT FINALLY SHOWS WHAT WAS WRITTEN DOWN IN SEPTEMBER.
//
// lib/offer-accepted-rules.ts has held every lender's rules since 10 Sep 2026 -
// ninety days, who extends, email or AOL, ANZ's acknowledgement - and nothing
// has ever imported it but its own test. Nobody in the team has seen a word of
// it. These are the lines it now puts on the deal.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { lenderSteps, preapprovalLine, pricingLine, anzTemplateFor,
         stillBlank, loanOnTheDeal } from './offer-accepted-panel'

describe('what to do with this lender', () => {
  it('St George: resubmit in AOL, and the trap that costs a week', () => {
    const lines = lenderSteps('St George')
    expect(lines[0].text).toContain('Edit and resubmit in AOL')
    expect(lines[1].kind).toBe('watch')
    expect(lines[1].text).toContain('Untick preapproval')
  })

  it('Bankwest: their own portal', () => {
    expect(lenderSteps('Bankwest')[0].text).toContain('Bankwest portal')
  })

  it('Macquarie: AOL for the change, their portal for the documents', () => {
    const t = lenderSteps('Macquarie')[0].text
    expect(t).toContain('AOL')
    expect(t).toContain('Macquarie portal')
  })

  it('a lender we hold nothing for says so, rather than guessing', () => {
    const lines = lenderSteps('Pepper Money')
    expect(lines).toHaveLength(1)
    expect(lines[0].kind).toBe('unknown')
    expect(lines[0].text).toContain('no submission rules for Pepper Money')
  })
})

describe('how long is left on the preapproval', () => {
  const deal = (over: any = {}) => ({
    preapproval_at: '2026-07-01T00:00:00Z',
    lenders: { name: 'St George' }, ...over,
  })

  it('counts ninety days and names the day it runs out', () => {
    const line = preapprovalLine(deal(), new Date('2026-07-10T00:00:00Z'))!
    expect(line.text).toContain('stands until 29 Sep 2026')
  })

  it('changes its tone inside a fortnight, and offers the extension', () => {
    const line = preapprovalLine(deal(), new Date('2026-09-20T00:00:00Z'))!
    expect(line.text).toContain('runs out on 29 Sep 2026')
    expect(line.text).toContain('extend it by another 90 days')
  })

  it('says plainly when it has already gone', () => {
    const line = preapprovalLine(deal(), new Date('2026-10-05T00:00:00Z'))!
    expect(line.text).toContain('ran out on 29 Sep 2026')
  })

  it('names the fee where there is one', () => {
    const line = preapprovalLine(deal({ lenders: { name: 'WLTH' } }),
      new Date('2026-09-20T00:00:00Z'))!
    expect(line.text).toContain('extend it, for $100')
  })

  it('and says a lender does not extend where they do not', () => {
    const line = preapprovalLine(deal({ lenders: { name: 'Bankwest' } }),
      new Date('2026-09-20T00:00:00Z'))!
    expect(line.text).toContain('do not extend it')
  })

  it('nothing at all with no preapproval date, or a lender we do not hold', () => {
    expect(preapprovalLine(deal({ preapproval_at: null }))).toBeNull()
    expect(preapprovalLine(deal({ lenders: { name: 'Pepper Money' } }))).toBeNull()
  })
})

describe('whether the pricing survives', () => {
  it('within St George’s 10%', () => {
    const l = pricingLine('St George', 847500, 881500, 10)!
    expect(l.kind).toBe('do')
    expect(l.text).toContain('Within St George')
  })

  it('over it, and flagged as a thing to watch', () => {
    const l = pricingLine('Westpac', 847500, 952000, 10)!
    expect(l.kind).toBe('watch')
    expect(l.text).toContain('will want the pricing redone')
  })

  // N/A IS A REAL ANSWER. Every lender but three sits at N/A.
  it('no rule recorded is its own answer, not "fine"', () => {
    const l = pricingLine('Macquarie', 847500, 952000, null)!
    expect(l.kind).toBe('unknown')
    expect(l.text).toContain('No repricing rule is recorded')
  })

  it('and nothing is said when the loan has not moved', () => {
    expect(pricingLine('St George', 847500, 847500, 10)).toBeNull()
  })
})

describe('the ANZ acknowledgement', () => {
  const anz = { lenders: { name: 'ANZ' }, deal_name: 'Kieran Loughlin-Walsh 2026' }

  it('is needed when the loan comes DOWN', () => {
    const t = anzTemplateFor(anz, 900000, 850000, 'Fabio De Castro')
    expect(t.needed).toBe(true)
    expect(t.change).toBe('Loan amount reduced from $900,000 to $850,000.')
    expect(t.reference).toBe('Kieran Loughlin-Walsh 2026')
  })

  it('is not needed when it goes up', () => {
    expect(anzTemplateFor(anz, 850000, 900000, 'Fabio').needed).toBe(false)
  })

  it('and is ANZ’s rule, not everybody’s', () => {
    expect(anzTemplateFor({ lenders: { name: 'St George' } }, 900000, 850000, 'Fabio').needed).toBe(false)
  })

  it('prefers the SalesTrekker reference where the deal has one', () => {
    expect(anzTemplateFor({ ...anz, salestrekker_id: 'ST-4471' }, 900000, 850000, 'F').reference)
      .toBe('ST-4471')
  })
})

describe('a half-filled panel is allowed, and says what is missing', () => {
  it('names each blank in words', () => {
    expect(stillBlank({})).toEqual([
      'the settlement date', 'the finance clause date', 'the price paid', 'the deposit paid',
    ])
  })

  it('and nothing once it is filled in', () => {
    expect(stillBlank({
      expected_settlement_date: '2026-11-28', finance_clause_date: '2026-10-10',
      contract_price: 1180000, deposit_paid: 118000,
    })).toEqual([])
  })
})

describe('the loan the deal is built on', () => {
  it('prefers the deal row, then the LO, then the BC', () => {
    expect(loanOnTheDeal({ loan_amount: 847500, lo_data: { loanAmount: '1' } })).toBe(847500)
    expect(loanOnTheDeal({ lo_data: { loanAmount: '847,500' } })).toBe(847500)
    expect(loanOnTheDeal({ bc_data: { loanAmount: '$847,500' } })).toBe(847500)
    expect(loanOnTheDeal({})).toBe(0)
  })
})

// THE CORRECTION.
//
// I told Fabio on 25 September that the portal had never held a settlement date.
// It has held one since the settlements board was built. The panel writes those
// existing columns rather than making second copies, because two dates both
// called the settlement date is how a deal disagrees with itself.
describe('it reuses the dates the portal already holds', () => {
  const sql = readFileSync(new URL('../docs/offer-accepted-schema.sql', import.meta.url), 'utf8')

  it('adds only the three facts nothing else holds', () => {
    expect(sql).toContain('add column if not exists contract_price')
    expect(sql).toContain('add column if not exists deposit_paid')
    expect(sql).toContain('add column if not exists deposit_paid_at')
  })

  it('and does NOT make a second settlement date or finance clause', () => {
    expect(sql).not.toMatch(/add column if not exists\s+settlement_date/)
    expect(sql).not.toMatch(/add column if not exists\s+offer_settlement/)
    expect(sql).not.toMatch(/add column if not exists\s+\w*finance_clause/)
  })

  it('and never overwrites the BC’s estimate with the contract price', () => {
    expect(sql).not.toMatch(/update\s+deals\s+set\s+bc_data/i)
  })
})

// IT MUST NOT DIE THE WAY THE SETTLEMENT PROMPT DIED.
//
// 24 Sep 2026 cost a day: DealSettlement was written in BOTH branches of
// `isWithLender(deal) ? ... : ...`, so settling a deal - which moves it across
// that line - made React throw the panel away and rebuild it, losing everything
// it was holding. Marking a deal offer-accepted crosses the same kind of line.
describe('the panel is written once, so marking the stage cannot destroy it', () => {
  const page = readFileSync(new URL('../app/(app)/deals/[id]/DealPageClient.tsx', import.meta.url), 'utf8')

  it('appears once on the page, not once per branch', () => {
    expect((page.match(/<OfferAccepted\s/g) || []).length).toBe(1)
  })

  it('and is inside the column that is always drawn', () => {
    const at = page.indexOf('<OfferAccepted')
    // 5 Oct 2026: there is no second column any more - Important and File notes
    // moved to the rail - so the column it sits in is drawn unconditionally.
    // What is checked is unchanged: it is written once, beside the settlement
    // panel, and not inside a branch that a stage change can take away.
    expect(page.slice(0, at)).toContain('<DealSettlement ')
    // It must not be written inside an isWithLender branch - that is the fault
    // this whole file exists for. There is no such branch on the page now, and
    // if one ever comes back the panel must still be outside it.
    const before = page.slice(0, at)
    const opened = (before.match(/\{isWithLender\(dealData\) && \(/g) || []).length
    const closed = (before.match(/\)\}/g) || []).length
    expect(opened === 0 || closed >= opened,
      'OfferAccepted is written inside an isWithLender branch - settling the deal would take it away').toBe(true)
  })
})

describe('the panel writes only its own columns', () => {
  const src = readFileSync(new URL('../components/OfferAccepted.tsx', import.meta.url), 'utf8')
  const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  // Those three blobs each have one owner that saves them WHOLE. A second
  // writer is how a morning's work disappears.
  it('never touches bc_data, lo_data or compliance_data', () => {
    for (const blob of ['bc_data:', 'lo_data:', 'compliance_data:']) {
      expect(code, `writing ${blob}`).not.toContain(`update({ ${blob}`)
    }
    expect(code).not.toContain('patchDealColumn')
  })

  it('and every write is checked, because a refused write returns no rows', () => {
    expect(code).toContain('checkedWrite(')
  })

  it('it draws nothing until the stage is reached, and nothing after settlement', () => {
    expect(code).toContain('if (!d?.offer_accepted_at || d?.settled_at) return null')
  })

  it('the ANZ acknowledgement is handed over, never sent', () => {
    expect(code).toContain('anzReductionEmail(')
    expect(code).not.toMatch(/fetch\(['"]\/api\/send/)
  })
})
