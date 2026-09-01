import { describe, it, expect } from 'vitest'
import { buildPeek, securityOf, money, peekAge } from './deal-peek'

const deal = (o: any = {}) => ({
  id: '1', deal_name: 'Kornelia_Viragova_Purchase_2026',
  created_at: '2026-08-21T00:00:00Z',
  fact_find_data: { applicants: [{ firstName: 'Kornelia', lastName: 'Viragova' }] },
  ...o,
})

describe('the quick look', () => {
  it('shows the client, not the filename', () => {
    expect(buildPeek(deal()).title).toBe('Kornelia Viragova')
    expect(buildPeek(deal()).fullName).toBe('Kornelia_Viragova_Purchase_2026')
  })

  it('names both applicants', () => {
    const d = deal({ fact_find_data: { applicants: [
      { firstName: 'Belinda', lastName: 'Birchland Hickson' },
      { firstName: 'Simon', lastName: 'Hickson' },
    ] } })
    expect(buildPeek(d).who.fields[0]).toMatchObject({ key: 'Applicants', value: 'Belinda Birchland Hickson & Simon Hickson' })
  })

  it('picks the property the loan is against, and counts the rest', () => {
    const d = deal({ fact_find_data: { properties: [
      { address: '9 Existing Ave, RICHMOND VIC', futureUse: 'Ongoing', propertySubtype: 'House' },
      { address: '14 Mercer Street, PRESTON VIC 3072', futureUse: 'Purchasing', propertySubtype: 'House', ownershipType: 'Owner occupied' },
    ] } })
    const s = securityOf(d)
    expect(s.address).toBe('14 Mercer Street, PRESTON VIC 3072')
    expect(s.detail).toBe('House · Owner occupied')
    expect(s.more).toBe(1)
  })

  it('falls back to the BC suburb before a fact find has a property', () => {
    const s = securityOf(deal({ fact_find_data: {}, bc_data: { suburb: 'Preston VIC', propertyType: 'Owner-occupied' } }))
    expect(s.address).toBe('Preston VIC')
    expect(s.detail).toBe('Owner-occupied')
  })

  it('says nothing is recorded rather than showing an empty row', () => {
    expect(buildPeek(deal()).security.fields[0]).toMatchObject({ value: 'none recorded', muted: true })
  })

  it('shows the loan ID as not issued until the lender gives one', () => {
    expect(buildPeek(deal()).loan.fields[2]).toMatchObject({ key: 'Loan ID', value: 'not issued yet', muted: true })
    expect(buildPeek(deal({ lender_ref: '4852124' })).loan.fields[2]).toMatchObject({ value: '4852124', muted: false })
  })

  it('prefers a confirmed settlement date over an expected one', () => {
    const d = deal({ expected_settlement_date: '2026-10-16', confirmed_settlement_date: '2026-10-20' })
    expect(buildPeek(d).loan.fields[3].value).toBe('20 Oct 2026')
  })

  it('does not claim a date it does not have', () => {
    const d = deal({ client_proceeded: true })       // agreed, but nothing stamped when
    expect(buildPeek(d).dates.fields[2].value).toBe('yes, date not recorded')
  })

  it('carries the internal notes through', () => {
    expect(buildPeek(deal({ internal_notes: '  Nela is a PR  ' })).notes).toBe('Nela is a PR')
    expect(buildPeek(deal()).notes).toBe('')
  })

  it('writes money the way the rest of the portal does', () => {
    expect(money(592000)).toBe('$592,000')
    expect(money(null)).toBe('—')
  })

  it('says how long it has been sitting there', () => {
    expect(peekAge({ fact_find_data: { a: 1 }, created_at: new Date(Date.now() - 4 * 86400000).toISOString() }))
      .toBe('4 days in this column')
  })
})
