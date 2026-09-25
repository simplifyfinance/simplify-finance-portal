// THE POINT OF THE WHOLE THING.
//
// Fabio, 25 Sep 2026: "the client view has the detail for example test 3 now
// has a security property there BUT when start a new deal and select exisitng
// client test 3 the informaiton saved is not coming accros fix that as this is
// the point of all this."

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { seedFromClients, seedSummary } from './seed-from-client'

let n = 0
const newId = () => `new-${++n}`
const reset = () => { n = 0 }

const house = (extra: any = {}) => ({
  id: 'old-house', address: '3 Test St, Aintree VIC 3336', value: '1,120,000',
  ownershipType: 'Owner occupied', propertySubtype: 'House',
  loans: [{ id: 'old-loan', lenderName: 'Macquarie', balance: '415,000' }],
  ownership: { 'old-a1': '50', 'old-a2': '50' },
  ...extra,
})
const card = (extra: any = {}) => ({
  id: 'old-card', liabilityType: 'Credit card', lenderName: 'ANZ', limitAmount: '15,000',
  ownership: { 'old-a1': 'Yes' }, ...extra,
})
const savings = (extra: any = {}) => ({
  id: 'old-savings', assetType: 'Savings', value: '150,000',
  ownership: { 'old-a1': '100' }, ...extra,
})

const held = (share: number | null) => ({ share, jointWith: [], ownershipConfirmed: true })

describe('what the client already told us arrives on the new deal', () => {
  beforeEachReset()
  function beforeEachReset() { reset() }

  const applicants = [{ id: 'a1', clientId: 'c1' }]
  const position = {
    properties: [{ ...house(), held: held(100) }],
    liabilities: [{ ...card(), held: held(null) }],
    assets: [{ ...savings(), held: held(100) }],
  }
  const seeded = seedFromClients(applicants, () => position, newId)

  it('the property comes across, with everything on it', () => {
    expect(seeded.properties).toHaveLength(1)
    expect(seeded.properties[0].address).toBe('3 Test St, Aintree VIC 3336')
    expect(seeded.properties[0].value).toBe('1,120,000')
    expect(seeded.properties[0].loans[0].lenderName).toBe('Macquarie')
  })

  it('so do the liabilities and the assets', () => {
    expect(seeded.liabilities[0].liabilityType).toBe('Credit card')
    expect(seeded.liabilities[0].limitAmount).toBe('15,000')
    expect(seeded.assets[0].value).toBe('150,000')
  })

  it('it belongs to the applicant on THIS deal, not the one on the old one', () => {
    expect(seeded.properties[0].ownership).toEqual({ a1: '100' })
    expect(seeded.assets[0].ownership).toEqual({ a1: '100' })
    // A liability is a tick, not a share.
    expect(seeded.liabilities[0].ownership).toEqual({ a1: 'Yes' })
  })

  it('nothing carries an id from the deal it came from', () => {
    expect(seeded.properties[0].id).not.toBe('old-house')
    expect(seeded.properties[0].id).toMatch(/^new-/)
  })

  it('and nothing carries the client record’s own bookkeeping', () => {
    // `held` describes a client's stake, not the item. It has no place here.
    expect(seeded.properties[0]).not.toHaveProperty('held')
    expect(JSON.stringify(seeded)).not.toContain('jointWith')
    expect(JSON.stringify(seeded)).not.toContain('ownershipConfirmed')
  })
})

describe('a house two people own is one house, not two', () => {
  it('joins the two records back up by the id they share', () => {
    reset()
    const applicants = [{ id: 'a1', clientId: 'c1' }, { id: 'a2', clientId: 'c2' }]
    const each = { properties: [{ ...house(), held: held(50) }], liabilities: [], assets: [] }
    const seeded = seedFromClients(applicants, () => each, newId)

    expect(seeded.properties).toHaveLength(1)
    expect(seeded.properties[0].ownership).toEqual({ a1: '50', a2: '50' })
  })

  it('joins them by their words where an old record has no id', () => {
    reset()
    const applicants = [{ id: 'a1', clientId: 'c1' }, { id: 'a2', clientId: 'c2' }]
    const noId = { ...house(), id: undefined, held: held(null) }
    const seeded = seedFromClients(applicants, () => ({ properties: [noId] }), newId)
    expect(seeded.properties).toHaveLength(1)
  })

  it('two DIFFERENT houses stay two houses', () => {
    reset()
    const applicants = [{ id: 'a1', clientId: 'c1' }, { id: 'a2', clientId: 'c2' }]
    const seeded = seedFromClients(applicants, (id) => ({
      properties: [{ ...house({ id: 'h-' + id, address: id + ' St' }), held: held(100) }],
    }), newId)
    expect(seeded.properties).toHaveLength(2)
    expect(seeded.properties[0].ownership).toEqual({ a1: '100' })
    expect(seeded.properties[1].ownership).toEqual({ a2: '100' })
  })
})

describe('a share nobody ever stated is not invented', () => {
  it('one owner and nothing said is theirs, all of it', () => {
    reset()
    const seeded = seedFromClients([{ id: 'a1', clientId: 'c1' }],
      () => ({ properties: [{ ...house(), held: held(null) }] }), newId)
    expect(seeded.properties[0].ownership).toEqual({ a1: '100' })
  })

  it('two owners and nothing said is left for a person to fill in', () => {
    reset()
    // Halving it would put a figure on the file that is in no document.
    const seeded = seedFromClients(
      [{ id: 'a1', clientId: 'c1' }, { id: 'a2', clientId: 'c2' }],
      () => ({ properties: [{ ...house(), held: held(null) }] }), newId)
    expect(seeded.properties[0].ownership).toEqual({ a1: '', a2: '' })
  })

  it('a stated share is kept exactly', () => {
    reset()
    const seeded = seedFromClients(
      [{ id: 'a1', clientId: 'c1' }, { id: 'a2', clientId: 'c2' }],
      (id) => ({ properties: [{ ...house(), held: held(id === 'c1' ? 70 : 30) }] }), newId)
    expect(seeded.properties[0].ownership).toEqual({ a1: '70', a2: '30' })
  })
})

describe('nothing on file, nothing carried', () => {
  it('a brand new client brings nothing and does not fall over', () => {
    reset()
    expect(seedFromClients([{ id: 'a1', clientId: 'c1' }], () => null, newId))
      .toEqual({ properties: [], liabilities: [], assets: [] })
  })

  it('an applicant with no client record is skipped', () => {
    reset()
    expect(seedFromClients([{ id: 'a1' }], () => ({ properties: [house()] }), newId).properties)
      .toHaveLength(0)
  })

  it('no applicants at all is three empty lists', () => {
    reset()
    expect(seedFromClients([], () => ({ properties: [house()] }), newId))
      .toEqual({ properties: [], liabilities: [], assets: [] })
  })
})

describe('what somebody is told before the deal is made', () => {
  it('says what is coming, in words', () => {
    expect(seedSummary({ properties: [1], liabilities: [1, 2], assets: [] } as any))
      .toBe('1 property and 2 liabilities')
    expect(seedSummary({ properties: [1, 2], liabilities: [1], assets: [1] } as any))
      .toBe('2 properties, 1 liability and 1 asset')
    expect(seedSummary({ properties: [1], liabilities: [], assets: [] } as any))
      .toBe('1 property')
  })

  it('says nothing when there is nothing - "0 properties" is noise', () => {
    expect(seedSummary({ properties: [], liabilities: [], assets: [] } as any)).toBe('')
  })
})

describe('the new deal actually asks for it', () => {
  const page = readFileSync(new URL('../app/(app)/deals/page.tsx', import.meta.url), 'utf8')

  it('a new deal no longer starts with three empty lists', () => {
    expect(page).toContain('seedFromClients')
    expect(page, 'the fact find is still hard-coded empty')
      .not.toContain('const fact_find_data = { applicants, assets: [], properties: [], liabilities: [] }')
  })

  it('it reads the position off the client record', () => {
    expect(page).toContain('position_properties')
    expect(page).toContain('position_liabilities')
    expect(page).toContain('position_assets')
  })
})
