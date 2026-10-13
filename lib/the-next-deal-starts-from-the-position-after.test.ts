// TWO APPLICATIONS AT ONCE, AND THE SECOND ONE IS NOT ASSESSED ON THE PAST.
//
// 13 Oct 2026. Velimir refinances three properties to Bankwest and takes
// $200,000 out. In parallel a purchase goes to a different lender. Fabio:
//
//   "When I go to Ord, I need to show them that the Bankwest loans are now in
//    play... the lending options becomes the updated financial position."
//
// The first version of "another deal for these clients" copied the fact find as
// it stood - the position BEFORE the refinance. Nobody assessing the purchase
// cares about that. What they need is written on the refinance's LENDING
// OPTIONS, which is the only place the Bankwest structure exists.
//
// Nothing here decides anything. It proposes, line by line, and a person ticks.
//
// Invented clients, invented figures.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  positionChanges, applyChanges, subjectToSettlementCount,
} from './position-after-settlement'

const num = (v: any) => Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0

const deal = () => ({
  id: 'd1',
  bc_data: {
    securityIds: ['p1', 'p2'],
    loanTerm: '30',
    splits: [
      { label: 'Existing Investment Home loan', amount: '1313000', type: 'Interest only', purpose: 'INV', securityId: 'p1' },
      { label: 'Investment loan', amount: '447000', type: 'Interest only', purpose: 'INV', securityId: 'p2' },
      { label: 'Equity release', amount: '200000', type: 'Interest only', purpose: 'INV', securityId: 'p1' },
    ],
  },
  fact_find_data: {
    savings: '45,000',
    properties: [
      { id: 'p1', address: '16 Spring Street Paddington', value: '2200000',
        loans: [{ id: 'l1', lenderName: 'Westpac', balance: '1,313,000', interestRate: '6.44',
                  repaymentType: 'P&I', status: 'To be refinanced' }] },
      { id: 'p2', address: '7/22-26 Russell Street Hawks Nest', value: '600000',
        loans: [{ id: 'l2', lenderName: 'ANZ', balance: '447,000', interestRate: '6.59',
                  repaymentType: 'P&I', status: 'To be refinanced' }] },
    ],
  },
  lo_data: {
    recommendedOptionId: 'L1',
    lenders: [{ id: 'L1', lenderName: 'Bankwest', productName: 'Complete Home Loan',
                lenderSplits: [
                  { id: 's0', label: 'Existing Investment Home loan', amount: '1313000', rate: '6.04', repaymentType: 'Interest only' },
                  { id: 's1', label: 'Investment loan', amount: '447000', rate: '6.04', repaymentType: 'Interest only' },
                  { id: 's2', label: 'Equity release', amount: '200000', rate: '6.04', repaymentType: 'Interest only' },
                ] }],
  },
  compliance_data: {},
})

const changes = () => positionChanges(deal(), deal().fact_find_data.savings)

// 13 OCT 2026, AN HOUR AFTER IT SHIPPED: IT READ THE LABEL.
//
// The first version decided whether a split paid a loan out or released equity
// by matching /equity|release|cash out/ against its LABEL. On this very deal
// every split is called "Investment equity loan split", so all three read as
// equity, none as a refinance, and Fabio got a screen with three new
// liabilities, no refinance at all, and $934,000 of savings.
//
// A label is free text somebody typed. The deal already holds the answer -
// `funds` is purchase, payout or equity - and where nobody was asked, the
// arithmetic answers: money above what is being paid out is money coming out.
describe('every liability is listed, and what becomes of it', () => {
  it('a loan being refinanced is shown as being paid out', () => {
    const closed = changes().filter(c => c.kind === 'close')
    expect(closed).toHaveLength(2)
    expect(closed[0].was).toContain('Westpac')
    expect(closed[0].now).toContain('paid out')
    expect(closed[0].amount).toBe('1,313,000')
  })

  // Fabio: "maybe list all libiities not just the equity". A position you can
  // only see half of is one somebody has to go and check somewhere else.
  it('and a loan that is not changing is listed too, as unchanged', () => {
    const d: any = deal()
    d.fact_find_data.properties[1].loans.push({
      id: 'l9', lenderName: 'CBA', balance: '88,000', repaymentType: 'P&I', status: 'Ongoing',
    })
    const kept = positionChanges(d, '45,000').filter(c => c.kind === 'keep')
    expect(kept).toHaveLength(1)
    expect(kept[0].was).toContain('CBA')
    expect(kept[0].now).toBe('unchanged')
    // Nothing to decide about it, so nothing to tick and nothing to edit.
    expect(kept[0].editable).toBe(false)
  })

  it('every split becomes a loan they will owe', () => {
    const added = changes().filter(c => c.kind === 'add')
    expect(added).toHaveLength(3)
    expect(added.map(a => a.amount)).toEqual(['1,313,000', '447,000', '200,000'])
    expect(added[0].now).toContain('Bankwest')
  })

  it('named against the house it sits on', () => {
    const added = changes().filter(c => c.kind === 'add')
    expect(added[0].about).toBe('16 Spring Street Paddington')
    expect(added[1].about).toBe('7/22-26 Russell Street Hawks Nest')
  })

  // THE LOANS DO NOT EXIST YET.
  it('and everything new says it waits on settlement', () => {
    for (const c of changes().filter(c => c.kind === 'add')) {
      expect(c.subjectToSettlement, `${c.about} does not say it waits on settlement`).toBe(true)
    }
  })

  // Fabio: "we can only tick and untick so I want to edit the figures".
  it('the new figures can be changed on the screen', () => {
    for (const c of changes().filter(c => c.kind === 'add')) expect(c.editable).toBe(true)
    expect(changes().find(c => c.kind === 'funds')!.editable).toBe(true)
  })
})

describe('what the money does is asked of the deal, never read off the name', () => {
  // THE EXACT FAULT. Every split on this deal is called "Investment equity loan
  // split" and only one of them is equity.
  it('a label saying equity on every split does not make them all equity', () => {
    const d: any = deal()
    d.bc_data.splits = d.bc_data.splits.map((x: any) => ({ ...x, label: 'Investment equity loan split' }))
    const f = positionChanges(d, '45,000').find(c => c.kind === 'funds')
    // $1,960,000 of new lending against $1,760,000 being paid out.
    expect(f!.amount).toBe('245,000')
  })

  it('and where somebody answered what the money does, that answer is used', () => {
    const d: any = deal()
    d.bc_data.splits = d.bc_data.splits.map((x: any, i: number) =>
      ({ ...x, label: 'Loan', funds: i === 2 ? 'equity' : 'payout' }))
    expect(positionChanges(d, '45,000').find(c => c.kind === 'funds')!.amount).toBe('245,000')
  })

  it('no money coming out, no savings line', () => {
    const d: any = deal()
    d.bc_data.splits = d.bc_data.splits.filter((x: any) => num(x.amount) !== 200000)
    d.lo_data.lenders[0].lenderSplits = d.lo_data.lenders[0].lenderSplits.slice(0, 2)
    expect(positionChanges(d, '45,000').some(c => c.kind === 'funds')).toBe(false)
  })
})

describe('applying only what was ticked', () => {
  const ff = () => applyChanges(deal().fact_find_data, changes(), 'Veljovic_Refinance_2026')

  // Leaving it beside the loan that replaces it would double their liabilities
  // on the next application.
  it('a loan being paid out is gone', () => {
    const loans = ff().properties[0].loans
    expect(loans.some((l: any) => l.lenderName === 'Westpac')).toBe(false)
  })

  it('and the new ones are there, stamped with the deal they wait on', () => {
    const loans = ff().properties[0].loans
    expect(loans).toHaveLength(2)
    expect(loans[0].lenderName).toBe('Bankwest')
    expect(loans[0].subjectToSettlementOf).toBe('Veljovic_Refinance_2026')
    expect(subjectToSettlementCount(ff())).toBe(3)
  })

  it('an edited figure is what lands', () => {
    const edited = changes().map(c => c.kind === 'add' && c.amount === '447,000' ? { ...c, amount: '500,000' } : c)
    const after = applyChanges(deal().fact_find_data, edited, 'X')
    const loans = after.properties[1].loans
    expect(loans[loans.length - 1].balance).toBe('500,000')
  })

  it('the savings follow the cash out', () => {
    expect(ff().savings).toBe('245,000')
  })

  it('and leaving the savings line out keeps what they had', () => {
    const without = changes().filter(c => c.kind !== 'funds')
    expect(applyChanges(deal().fact_find_data, without, 'X').savings).toBe('45,000')
  })

  it('ticking nothing changes nothing', () => {
    const after = applyChanges(deal().fact_find_data, [], 'X')
    expect(after.savings).toBe('45,000')
    expect(subjectToSettlementCount(after)).toBe(0)
    expect(after.properties[0].loans[0].lenderName).toBe('Westpac')
  })

  it('and what it is not asked about is untouched', () => {
    expect(ff().properties[1].address).toBe('7/22-26 Russell Street Hawks Nest')
    expect(ff().properties[0].value).toBe('2200000')
  })
})

// FABIO'S OWN CAUTION, 13 Oct 2026: "I am very cautious of all of this doesn't
// get updated to the client data... which is a separate issue".
//
// It cannot. applyChanges takes a fact find and returns a fact find. It has no
// database, no client id, and no way to reach one.
describe('it cannot reach the client record', () => {
  const src = readFileSync('lib/position-after-settlement.ts', 'utf8')

  it('the file never mentions clients at all', () => {
    expect(src).not.toMatch(/client_id|from\('clients'\)|clients\./)
  })

  it('and never writes anything anywhere', () => {
    expect(src).not.toContain('supabase')
    expect(src).not.toMatch(/\.update\(|\.insert\(|\.upsert\(/)
  })

  it('it is given a fact find and hands one back', () => {
    const out = applyChanges({ properties: [] }, [], 'X')
    expect(Object.keys(out)).toEqual(['properties'])
  })
})

// THE SCREEN, AND THE TWO PROMISES IT MAKES.
describe('what is on the screen before anything is created', () => {
  const page = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')

  it('the proposal is worked out and shown, not applied', () => {
    expect(page).toContain('positionChanges(full')
    expect(page).toContain('setProposed({')
    expect(page).toContain("c.kind !== 'keep'")
  })

  // Everything starts ticked because on a normal file every line is true.
  // Untick is the exception, which is why it is a tick and not a question.
  it('every line can be unticked', () => {
    expect(page).toContain('proposed.chosen.has(c.id)')
    expect(page).toContain('next.delete(c.id)')
  })

  it('and only what is ticked is applied', () => {
    expect(page).toContain('proposed.changes.filter(c => proposed.chosen.has(c.id))')
    expect(page).toContain('applyChanges(fields.fact_find_data, chosen')
  })

  // FABIO'S CAUTION, WIRED. "I am very cautious of all of this doesn't get
  // updated to the client data." It is applied to the fields of the NEW deal
  // and to nothing else.
  it('it is applied to the new deal and to nothing else', () => {
    const create = page.slice(page.indexOf('async function createFromProposal'),
                              page.indexOf('async function createFromProposal') + 1200)
    expect(create).toContain('fields.fact_find_data = applyChanges')
    expect(create, 'it is writing to the client record').not.toMatch(/from\('clients'\)/)
    expect(create, 'it is writing back to this deal').not.toMatch(/\.eq\('id', deal\.id\)/)
    expect(page).toContain('The client record is not touched')
  })

  it('and a deal that changes nothing says so rather than showing an empty box', () => {
    expect(page).toContain('Nothing on this deal changes their position yet')
  })
})
