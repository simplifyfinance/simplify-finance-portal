// THE SECURITY ON A BUILD IS THE FINISHED HOUSE.
//
// 9 Oct 2026. box-security.ts opens by promising that it names security "by the
// same test as securityValue()", so the box can never name a property the deal
// structure block did not count. securityValue() was taught on 9 Oct that a
// build is worth its "as if complete" valuation; this file was not, so the
// block started showing an LVR on a build while box nine named nothing.
//
// And the figure is NOT a price. A build valued at $1,340,000 has not been
// bought for $1,340,000 - the house does not exist yet - so it gets its own
// wording rather than being pushed through the purchase sentence.
//
// Invented clients, invented figures.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { securitiesOf, securitySentences } from './box-security'
import { securityValue, lvrOf } from './funds-to-complete'
import { brokerNotes } from './broker-notes'

const SELL_AND_BUILD = {
  template: 'buy_sell',
  saleProceedsUse: 'build',
  landFunding: 'purchase',
  landValue: '560,000',
  constructionCost: '720,000',
  stampDuty: '20,000',
  dutyState: 'NSW',
  asIfCompleteValue: '1,340,000',
  suburb: 'Thornleigh',
  propertyType: 'Owner-occupied',
  salePrice: '1,180,000',
  agentFees: '26,000',
  existingLoanBal: '415,000',
  deposit: '779,000',
  splits: [
    { label: 'Land loan', amount: '320,000', rate: '6.14', type: 'P&I', purpose: 'OO' },
    { label: 'Construction loan', amount: '201,000', rate: '6.39', type: 'Interest only', ioYears: '2', purpose: 'OO' },
  ],
}

const BUYING = {
  template: 'buy_sell',
  purchasePrice: '1,250,000',
  stampDuty: '54,000',
  dutyState: 'NSW',
  propertyType: 'Owner-occupied',
  salePrice: '1,180,000',
  agentFees: '26,000',
  existingLoanBal: '415,000',
  deposit: '779,000',
  splits: [{ label: 'End Debt', amount: '525,000', rate: '6.14', type: 'P&I', purpose: 'OO' }],
}

const deal = (bc: any, extra: any = {}) => ({ bc_data: bc, ...extra })
const said = (d: any) => {
  const list = securitiesOf(d)
  return list.map(s => securitySentences(d, s, list.length === 1).parts.join(' ')).join(' ')
}

describe('box nine and the deal structure block agree', () => {
  it('names the finished house as the security on a build', () => {
    const list = securitiesOf(deal(SELL_AND_BUILD))
    expect(list).toHaveLength(1)
    expect(list[0].kind).toBe('build')
    expect(list[0].value).toBe(1_340_000)
  })

  it('values it at exactly what the block works the LVR from', () => {
    const d = deal(SELL_AND_BUILD)
    expect(securitiesOf(d)[0].value).toBe(securityValue(d).total)
    expect(lvrOf(d)).toBe(38.9)
  })

  it('does the same on the plain construction template', () => {
    const site = deal({
      template: 'construction', landFunding: 'purchase',
      landValue: '560,000', constructionCost: '720,000', asIfCompleteValue: '1,340,000',
      splits: [{ label: 'Construction loan', amount: '521,000' }],
    })
    expect(securitiesOf(site)[0].kind).toBe('build')
    expect(securitiesOf(site)[0].value).toBe(securityValue(site).total)
  })

  it('names nothing when there is no valuation, because the block has no LVR either', () => {
    const d = deal({ ...SELL_AND_BUILD, asIfCompleteValue: '' })
    expect(securitiesOf(d)).toHaveLength(0)
    expect(lvrOf(d)).toBeNull()
  })

  it('leaves an ordinary purchase exactly as it was', () => {
    const list = securitiesOf(deal(BUYING))
    expect(list[0].kind).toBe('purchase')
    expect(list[0].value).toBe(1_250_000)
  })
})

describe('what the pack actually says', () => {
  const withAddress = deal(SELL_AND_BUILD, { compliance_data: { securityAddress: '12 Mock Street, Thornleigh' } })

  it('never calls a valuation a price', () => {
    // "the property being purchased for $1,340,000" is a false sentence: that
    // house does not exist yet and nobody paid anything for it.
    const text = said(withAddress)
    expect(text).not.toContain('being purchased for')
    expect(text).toContain('being built')
    expect(text).toContain('as if complete')
    expect(text).toContain('not a price paid')
    expect(text).toContain('$1,340,000')
  })

  it('still asks for the address, and still forgives a pre-approval for not having one', () => {
    const noAddress = said(deal(SELL_AND_BUILD))
    expect(noAddress).toContain('NOT RECORDED')

    const preApproval = said(deal(SELL_AND_BUILD, { compliance_data: { preApproval: true } }))
    expect(preApproval).not.toContain('NOT RECORDED')
    expect(preApproval).toContain('to be built')
  })

  it('still says "being purchased for" on something somebody is buying', () => {
    const buying = deal(BUYING, { compliance_data: { securityAddress: '9 Mock Avenue, Epping' } })
    expect(said(buying)).toContain('being purchased for')
  })
})

describe('the broker notes', () => {
  const ff = {
    applicants: [{ firstName: 'Dana', lastName: 'Whitfield', dateOfBirth: '1986-04-02' }],
  }

  it('say the clients are building, not purchasing', () => {
    // It read the template name, and buy_sell is on the purchase list - so this
    // told an assessor the clients wanted to purchase a house in Thornleigh.
    const notes = brokerNotes(deal(SELL_AND_BUILD, { fact_find_data: ff }))
    const text = JSON.stringify(notes)
    expect(text).toContain('construct')
    expect(text).not.toMatch(/purchase a .{0,40}in Thornleigh/)
  })

  it('still say purchase on a buy and sell that is buying', () => {
    const text = JSON.stringify(brokerNotes(deal(BUYING, { fact_find_data: ff })))
    expect(text).toContain('purchase')
    expect(text).not.toContain('construct')
  })
})

describe('one question, asked in one place', () => {
  it('neither file decides for itself what a build is', () => {
    const files = ['./box-security.ts', './broker-notes.ts']
    for (const f of files) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8')
        .replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
      expect(src, f).not.toMatch(/===\s*'construction'/)
    }
  })
})
