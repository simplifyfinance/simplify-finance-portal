// TWO KINDS OF COPY, AND THEY ARE NOT THE SAME VERB.
//
// 13 Oct 2026. Four refinances about to lodge, and a purchase to write for the
// same clients while their fact find is still open. Fabio:
//
//   "when we clone that deal that is a complex refinance, it's not allowing me
//    to do a purchase because it's cloning all the way to lending options and
//    it's not letting me change"
//
// Clone means "another version of THIS deal" - same people, same scenario,
// pointed at a different bank. It is a good feature and it is untouched here.
//
// What he needed is "another deal for THESE PEOPLE". Their circumstances are
// the same; everything about the loan is new. That is not a copy of a deal, and
// giving it its own name rather than adding a question to Clone is the whole
// design decision: a dialog asking "how far should this copy?" makes somebody
// think about our tabs at the moment they are trying to do something simple.
//
// Invented clients.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { cloneFields, cloneAsks, CLONE_READS, withProvenance, provenanceLine } from './clone-deal'

const from = {
  id: 'deal-1',
  deal_name: 'Veljovic_Refinance_2026',
  client_id: 'c1', deal_type: 'Refinance',
  assigned_broker: 'Fabio', assigned_credit_officer: 'katie-uuid',
  fact_find_data: { properties: [{ id: 'p1', value: '2200000' }], applicants: 2 },
  bc_data: { template: 'complex_refinance', splits: [{ amount: '1313000' }] },
  bc_scenarios: [{ id: 's1' }],
  lo_data: { lenders: [{ id: 'L1' }], refinanceSplits: [{ id: 'u1' }] },
}

describe('the clone that already existed is untouched', () => {
  const out = cloneFields(from, 'Veljovic_Refinance_2026_Copy')

  it('still carries the borrowing capacity and the lending options', () => {
    expect(out.bc_data).toEqual(from.bc_data)
    expect(out.lo_data).toEqual(from.lo_data)
    expect(out.bc_scenarios).toEqual(from.bc_scenarios)
  })

  it('and its wording still describes that', () => {
    expect(cloneAsks('X')).toContain('pointed at a different bank')
  })
})

describe('a new deal for the same people carries them and not the loan', () => {
  const out = cloneFields(from, 'Veljovic_Purchase_2026', 'clients')

  it('the fact find comes across', () => {
    expect(out.fact_find_data.applicants).toBe(2)
    expect(out.fact_find_data.properties).toEqual(from.fact_find_data.properties)
  })

  // THE FAULT HE HIT. A purchase written on top of a complex refinance's
  // borrowing capacity has its scenario already answered, and would not let him
  // change it.
  it('and nothing about the loan does', () => {
    expect(out.bc_data).toBeUndefined()
    expect(out.bc_scenarios).toBeUndefined()
    expect(out.lo_data).toBeUndefined()
  })

  // A refinance's deal_type on a deal that has not chosen its scenario yet is a
  // guess, and choosing afresh is the entire point of this action.
  it('nor the loan type, which is the thing being chosen again', () => {
    expect(out.deal_type).toBeUndefined()
  })

  it('but the people working it do', () => {
    expect(out.assigned_broker).toBe('Fabio')
    expect(out.assigned_credit_officer).toBe('katie-uuid')
    expect(out.client_id).toBe('c1')
  })

  it('and it starts at the beginning', () => {
    expect(out.stage).toBe('FactFind')
    expect(out.status).toBe('in_progress')
  })

  it('its wording says both halves out loud', () => {
    const said = cloneAsks('Veljovic_Refinance_2026', 'clients')
    expect(said).toContain('income, expenses, liabilities and properties')
    expect(said).toContain('Does not')
    expect(said).toContain('blank borrowing capacity')
  })
})

// IT IS A COPY, NOT A LINK, AND THE DEAL SAYS SO.
//
// Update the original's fact find next week and this one will not hear about
// it. The expensive fix is both deals reading one client record; the cheap and
// honest one is saying where the figures came from so nobody assumes they are
// live.
describe('the new deal says where its fact find came from', () => {
  it('the name and the date ride along inside the fact find', () => {
    const ff = withProvenance(from.fact_find_data, from, from.deal_name, new Date('2026-10-13T02:00:00Z'))
    expect(ff.copiedFrom.dealName).toBe('Veljovic_Refinance_2026')
    expect(ff.copiedFrom.dealId).toBe('deal-1')
    expect(ff.properties).toEqual(from.fact_find_data.properties)
  })

  it('and it reads as a sentence', () => {
    const ff = withProvenance({}, from, from.deal_name, new Date('2026-10-13T02:00:00Z'))
    expect(provenanceLine(ff)).toContain('from Veljovic_Refinance_2026')
    expect(provenanceLine(ff)).toContain('copied on')
  })

  it('a fact find that was never copied says nothing', () => {
    expect(provenanceLine({ properties: [] })).toBe('')
    expect(provenanceLine(null)).toBe('')
  })

  it('every new deal of this kind gets the stamp', () => {
    const out = cloneFields(from, 'X', 'clients')
    expect(out.fact_find_data.copiedFrom?.dealName).toBe('Veljovic_Refinance_2026')
  })
})

describe('the wiring', () => {
  const page = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')

  // 13 OCT 2026, RENAMED. Both items read "clone" and both were a bare label,
  // so Fabio's team could not tell them apart - "clone is clone, they're just
  // used to cloning". The word stays on the one they know and comes off the
  // other, and the line underneath each does most of the work.
  it('there are two actions in the menu, not a question on one', () => {
    expect(page).toContain("cloneThisDeal('deal')")
    expect(page).toContain("cloneThisDeal('clients')")
    expect(page).toContain('Clone this deal')
    expect(page).toContain('Start another deal for these clients')
  })

  it('and each says what it is for, which is what was missing', () => {
    expect(page).toContain('For trying another lender.')
    expect(page).toContain('Carries their position AFTER this deal settles.')
    // Fabio: "I don't want to pigeonhole that because it could be other
    // situations." So it does not name the purchase-beside-a-refinance case.
    expect(page, 'the description pigeonholes it again')
      .not.toContain('For a purchase alongside a refinance')
  })

  // The select asking for one column fewer than the insert writes is how a
  // clone quietly loses a form. They live in one list for that reason, and the
  // stamp needs two more of them.
  it('the read fetches what the stamp needs', () => {
    expect(CLONE_READS).toContain('id')
    expect(CLONE_READS).toContain('deal_name')
  })

  // THE CREDIT POINT, AND THE REASON THIS LINE IS WORTH THE SPACE. A purchase
  // written beside four unsettled refinances carries their balances as they are
  // today, which is not the position a lender will assess it on.
  it('the deal says it is a copy, and names the risk', () => {
    expect(page).toContain('provenanceLine(dealData.fact_find_data)')
    expect(page).toContain('It is a copy, not a link')
    expect(page).toContain('the position before')
  })
})
