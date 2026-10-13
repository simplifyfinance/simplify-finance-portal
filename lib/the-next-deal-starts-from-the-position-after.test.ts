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
  positionChanges, applyChanges, subjectToSettlementCount, REFINANCING,
} from './position-after-settlement'

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

describe('what the lending options do to their position', () => {
  it('every loan being paid out is replaced by the one replacing it', () => {
    const rep = changes().filter(c => c.kind === 'replace')
    expect(rep).toHaveLength(2)
    expect(rep[0].was).toContain('Westpac')
    expect(rep[0].now).toContain('Bankwest')
    expect(rep[0].now).toContain('$1,313,000')
    expect(rep[0].now).toContain('Interest only')
  })

  it('an equity release is a new liability on the next application', () => {
    const add = changes().find(c => c.kind === 'add')
    expect(add).toBeTruthy()
    expect(add!.now).toContain('$200,000')
    expect(add!.about).toContain('16 Spring Street Paddington')
  })

  // THE LOANS DO NOT EXIST YET. Whoever writes the second application has to
  // see that, and so does the lender reading it.
  it('and everything the other deal has to settle first says so', () => {
    for (const c of changes().filter(c => c.kind !== 'funds')) {
      expect(c.subjectToSettlement, `${c.about} does not say it waits on settlement`).toBe(true)
    }
  })

  it('a loan nobody marked as being refinanced is left alone', () => {
    const d: any = deal()
    d.fact_find_data.properties[1].loans[0].status = 'Ongoing'
    expect(positionChanges(d, '45,000').filter(c => c.kind === 'replace')).toHaveLength(1)
  })

  // Where the BC never said which house a split sits against there is nothing
  // to match a loan to, and guessing which figure pays out which debt is not a
  // guess worth making.
  it('and so is one whose split names no property', () => {
    const d: any = deal()
    d.bc_data.splits = d.bc_data.splits.map((s: any) => ({ ...s, securityId: '' }))
    expect(positionChanges(d, '45,000').filter(c => c.kind === 'replace')).toHaveLength(0)
  })
})

describe('the cash out is offered, never assumed', () => {
  it('it is its own line, with what they would hold', () => {
    const f = changes().find(c => c.kind === 'funds')
    expect(f!.was).toBe('$45,000')
    expect(f!.now).toBe('$245,000')
  })

  // Released equity is deposit money on some files and stays in the loan on
  // others. Only a person knows which, so the two are separate answers.
  it('and leaving it out does not touch the liability it came from', () => {
    const chosen = changes().filter(c => c.kind !== 'funds')
    const ff = applyChanges(deal().fact_find_data, chosen, 'Veljovic_Refinance_2026')
    expect(ff.savings).toBe('45,000')
    expect(subjectToSettlementCount(ff)).toBe(3)
  })

  it('no cash out, no line', () => {
    const d: any = deal()
    d.bc_data.splits = d.bc_data.splits.filter((s: any) => !/equity/i.test(s.label))
    d.lo_data.lenders[0].lenderSplits = d.lo_data.lenders[0].lenderSplits.filter((s: any) => !/equity/i.test(s.label))
    expect(positionChanges(d, '45,000').some(c => c.kind === 'funds')).toBe(false)
  })
})

describe('applying only what was ticked', () => {
  const ff = () => applyChanges(deal().fact_find_data, changes(), 'Veljovic_Refinance_2026')

  it('the old loan becomes the new one', () => {
    const l = ff().properties[0].loans[0]
    expect(l.lenderName).toBe('Bankwest')
    expect(l.balance).toBe('1,313,000')
    expect(l.interestRate).toBe('6.04')
    expect(l.repaymentType).toBe('Interest only')
  })

  // On the NEW deal it is simply a loan they have. Left as "To be refinanced"
  // the next borrowing capacity would think it is paying these out again.
  it('and stops being marked as one being refinanced', () => {
    expect(ff().properties[0].loans[0].status).toBe('Ongoing')
    expect(REFINANCING).toContain('To be refinanced')
  })

  it('the equity release arrives as a loan of its own', () => {
    const loans = ff().properties[0].loans
    expect(loans).toHaveLength(2)
    expect(loans[1].balance).toBe('200,000')
  })

  it('every one of them is stamped with the deal it waits on', () => {
    expect(subjectToSettlementCount(ff())).toBe(3)
    expect(ff().properties[0].loans[0].subjectToSettlementOf).toBe('Veljovic_Refinance_2026')
  })

  it('ticking nothing changes nothing', () => {
    const before = deal().fact_find_data
    const after = applyChanges(before, [], 'X')
    expect(after.savings).toBe('45,000')
    expect(subjectToSettlementCount(after)).toBe(0)
    expect(after.properties[0].loans[0].lenderName).toBe('Westpac')
  })

  it('and what it is not asked about is untouched', () => {
    const after = ff()
    expect(after.properties[1].address).toBe('7/22-26 Russell Street Hawks Nest')
    expect(after.properties[0].value).toBe('2200000')
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
    expect(page).toContain('setProposed({ changes, chosen:')
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
