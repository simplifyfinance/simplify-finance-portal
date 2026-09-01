import { describe, it, expect } from 'vitest'
import { typeOf, useOf, chipsFor, brokerColour, chipStyle } from './deal-labels'

describe('labels derived from the deal', () => {
  it('takes the settlement fields first — they were set later and are more certain', () => {
    const d = { transaction_type: 'refinance', property_use: 'investment', bc_data: { template: 'oo_purchase' } }
    expect(typeOf(d)).toBe('refinance')
    expect(useOf(d)).toBe('investment')
  })

  it('falls back to the BC template', () => {
    expect(typeOf({ bc_data: { template: 'investment_purchase' } })).toBe('purchase')
    expect(useOf({ bc_data: { template: 'investment_purchase' } })).toBe('investment')
    expect(useOf({ bc_data: { template: 'smsf' } })).toBe('smsf')
    expect(typeOf({ bc_data: { template: 'construction' } })).toBe('construction')
    expect(typeOf({ bc_data: { template: 'refinance_equity' } })).toBe('equity_release')
  })

  it('reads a first home buyer as an owner-occupied purchase', () => {
    const d = { bc_data: { template: 'fhb' } }
    expect(typeOf(d)).toBe('purchase')
    expect(useOf(d)).toBe('owner_occupied')
  })

  it('falls back to the words on the deal when there is nothing else', () => {
    expect(typeOf({ deal_name: 'Kornelia_Viragova_Purchase_2026' })).toBe('purchase')
    expect(typeOf({ deal_name: 'Blake_Toscan_Refinance_2026' })).toBe('refinance')
    expect(useOf({ deal_type: 'Investment purchase' })).toBe('investment')
  })

  it('says nothing rather than saying Unknown', () => {
    expect(typeOf({ deal_name: 'A_Deal_2026' })).toBe('unknown')
    expect(chipsFor({ deal_name: 'A_Deal_2026' })).toEqual([])
  })

  it('puts the transaction first and the use second', () => {
    const c = chipsFor({ bc_data: { template: 'investment_purchase' } })
    expect(c.map(x => x.label)).toEqual(['Purchase', 'Investment'])
  })

  it('lets Settings override a colour without touching the label', () => {
    const c = chipsFor({ bc_data: { template: 'oo_purchase' } }, { type: { purchase: '#123456' } })
    expect(c[0]).toMatchObject({ label: 'Purchase', colour: '#123456' })
    expect(c[1].label).toBe('Owner occupied')
  })

  it('gives a broker the same colour every time, never a random one', () => {
    expect(brokerColour('fabio')).toBe(brokerColour('fabio'))
    expect(brokerColour('Fabio ')).toBe(brokerColour('fabio'))
    expect(brokerColour('fabio')).not.toBe(brokerColour('kylie'))
  })

  it('uses the colour Settings picked for a broker when there is one', () => {
    expect(brokerColour('fabio', { fabio: '#ABCDEF' })).toBe('#ABCDEF')
  })

  it('builds a wash and a border from the one stored colour', () => {
    const s = chipStyle('#0E6FA0')
    expect(s.color).toBe('#0E6FA0')
    expect(s.background).toBe('#0E6FA014')
    expect(s.borderColor).toBe('#0E6FA038')
  })
})
