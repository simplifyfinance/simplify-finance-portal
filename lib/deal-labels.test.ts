import { describe, it, expect } from 'vitest'
import { typeOf, useOf, chipsFor, brokerColour, chipStyle, dealTitle } from './deal-labels'

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

describe('the deal name on a card', () => {
  it('drops the type and the year, because both are already on screen', () => {
    expect(dealTitle('Kornelia_Viragova_Purchase_2026')).toBe('Kornelia Viragova')
    expect(dealTitle('Sasa_Kalajdzic_Tori_Headington_Refinance_2026')).toBe('Sasa Kalajdzic Tori Headington')
  })

  it('copes with the stray spaces people actually type', () => {
    expect(dealTitle('Blake_Toscan _Refinance_2026')).toBe('Blake Toscan')
    expect(dealTitle('Santiago _Moscatelli_Investment_2026')).toBe('Santiago Moscatelli')
    expect(dealTitle('Kendall_Hume_ Sam_Delamont_Purchase_2026')).toBe('Kendall Hume Sam Delamont')
  })

  it('keeps a surname that already contains a space', () => {
    expect(dealTitle('Belinda_Birchland Hickson_Simon_Hickson_Purchase_2026'))
      .toBe('Belinda Birchland Hickson Simon Hickson')
  })

  it('handles a two-word type', () => {
    expect(dealTitle('Jo_Sample_Equity_Release_2026')).toBe('Jo Sample')
  })

  it('leaves a name alone when there is nothing to strip', () => {
    expect(dealTitle('Jo Sample')).toBe('Jo Sample')
  })

  it('never returns an empty card', () => {
    // A deal named only for its type would strip down to nothing.
    expect(dealTitle('Refinance_2026')).toBe('Refinance 2026')
    expect(dealTitle('')).toBe('')
  })
})
