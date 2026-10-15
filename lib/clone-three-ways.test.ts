import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { cloneFields, cloneAsks } from './clone-deal'
import { downstreamStarted } from './bc-scenarios'

// 15 Oct 2026. "Would you like to clone this deal all the way to lending
// options, or ... to borrowing capacity? And then put a little note that if you
// clone it to lending options, you won't be able to change BC."

const parent = {
  id: 'd1', deal_name: 'X', client_id: 'c1', deal_type: 'purchase',
  assigned_broker: 'fabio', assigned_credit_officer: 'co1',
  fact_find_data: { applicants: [{ first: 'A' }, { first: 'B' }] },
  bc_data: { template: 'oo_purchase' },
  bc_scenarios: [{ bc: { template: 'investment_purchase' }, completedAt: null }],
  lo_data: { lenders: [{ lenderName: 'Bankwest' }], emailHtml: '<p>sent</p>' },
}

describe('clone to the borrowing capacity', () => {
  const out: any = cloneFields(parent, 'X_Copy', 'borrowing-capacity')

  it('brings the figures and leaves the lending options behind', () => {
    expect(out.bc_data).toEqual(parent.bc_data)
    expect(out.fact_find_data).toEqual(parent.fact_find_data)
    expect(out.lo_data).toBeUndefined()
  })

  it('so the scenario is still yours to change', () => {
    expect(downstreamStarted(out)).toBe(false)
  })

  it('and the dialog says so', () => {
    expect(cloneAsks('X', 'borrowing-capacity')).toContain('still yours to change')
  })
})

describe('clone with the lending options', () => {
  const out: any = cloneFields(parent, 'X_Copy', 'lending-options')

  it('brings them, which is the whole point of this one', () => {
    expect(out.lo_data).toEqual(parent.lo_data)
    expect(out.bc_data).toEqual(parent.bc_data)
  })

  it('and the scenario is locked, which is the cost', () => {
    expect(downstreamStarted(out)).toBe(true)
  })

  it('the dialog says it is locked AND how to get out of it', () => {
    const ask = cloneAsks('X', 'lending-options')
    expect(ask).toContain('LOCKED')
    // The old message said "clone the deal", which is what he had just done.
    expect(ask).toContain('clone to the borrowing capacity instead')
  })
})

describe('the default is the safe one', () => {
  it('a clone with nothing said does not carry the lending options', () => {
    expect((cloneFields(parent, 'X_Copy') as any).lo_data).toBeUndefined()
  })
})

describe('"Start another deal for these clients" is untouched', () => {
  const out: any = cloneFields(parent, 'X_New', 'clients')

  it('still brings the people and nothing about the loan', () => {
    expect(out.lo_data).toBeUndefined()
    expect(out.bc_data).toBeUndefined()
    expect(out.bc_scenarios).toBeUndefined()
    expect(out.fact_find_data.applicants).toHaveLength(2)
  })

  it('and its wording is word for word what it was', () => {
    const ask = cloneAsks('X', 'clients')
    expect(ask).toContain('New deal for the clients on')
    expect(ask).toContain('You start on a blank borrowing capacity and choose the scenario yourself.')
  })
})

describe('the menu offers both and names the cost', () => {
  const page = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')

  it('has a button for each', () => {
    expect(page).toContain("cloneThisDeal('borrowing-capacity')")
    expect(page).toContain("cloneThisDeal('lending-options')")
  })

  it('says the scenario is locked on the one that locks it', () => {
    expect(page).toContain('The scenario is locked.')
  })

  it('and still has the untouched third option', () => {
    expect(page).toContain("cloneThisDeal('clients')")
    expect(page).toContain('Start another deal for these clients')
  })
})
