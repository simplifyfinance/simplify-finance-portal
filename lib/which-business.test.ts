// WHICH BUSINESS A DEAL BELONGS TO.
//
// Invented brokers, invented deals, invented brands throughout.
//
// The thing being held here is that the portal NEVER GUESSES SIMPLIFY. On
// 12 Nov every lodged deal in the book carried "simplify" because the old code
// guessed it, and a report built on that guess puts one licence on another
// brand's clients. See lib/which-business.ts.
import { describe, it, expect } from 'vitest'
import {
  NOT_SAID, acrossAll, brandOnDeal, businessOfDeal, businessesOf, oneBusinessOnly,
} from './which-business'
import { byBroker } from './who-brought-us-this'

const SPAN = { from: '2026-11-01', to: '2026-11-30' }

const BRANDS = [
  { id: 'simplify', name: 'Simplify Finance' },
  { id: 'sfb', name: 'Simplify Finance Brokers' },
]

// broker_key is a key, name is a full name. They are never equal, which is the
// whole fault lib/the-brand-follows-the-broker.ts was written for.
const BROKERS = [
  { broker_key: 'mark', name: 'Mark Gallo', brand_ids: ['simplify'], active: true },
  { broker_key: 'kylie', name: 'Kylie Bianchi', brand_ids: ['simplify'], active: true },
  { broker_key: 'keanen', name: 'Keanen Wood', brand_ids: ['sfb'], active: true },
  { broker_key: 'both', name: 'Both Brands', brand_ids: ['simplify', 'sfb'], active: true },
  { broker_key: 'untold', name: 'Nobody Said', brand_ids: [], active: true },
]

const deal = (over: any = {}) => ({
  id: 'd' + Math.random(), status: 'active',
  lodged_at: '2026-11-09T13:00:00+00:00', lodged_total: 100_000, ...over,
})

describe('which business one deal belongs to', () => {
  it('is certain when the broker holds exactly one brand', () => {
    expect(businessOfDeal(deal({ assigned_broker: 'mark' }), BROKERS)).toBe('simplify')
    expect(businessOfDeal(deal({ assigned_broker: 'keanen' }), BROKERS)).toBe('sfb')
  })

  // THE POINT OF THE WHOLE FILE. The deal says simplify because the old code
  // wrote it there without anybody choosing. The broker holds sfb and only
  // sfb, so the deal cannot be a Simplify Finance deal whatever is stored.
  it('ignores a stored brand the broker cannot actually write under', () => {
    const corrupted = deal({ assigned_broker: 'keanen', bc_data: { brand: 'simplify' } })
    expect(brandOnDeal(corrupted)).toBe('simplify')
    expect(businessOfDeal(corrupted, BROKERS)).toBe('sfb')
  })

  it('asks the deal only when the broker holds more than one', () => {
    expect(businessOfDeal(deal({ assigned_broker: 'both', bc_data: { brand: 'sfb' } }), BROKERS))
      .toBe('sfb')
    expect(businessOfDeal(deal({ assigned_broker: 'both', lo_data: { brandId: 'simplify' } }), BROKERS))
      .toBe('simplify')
  })

  it('says nobody has said rather than guessing', () => {
    // Holds two, deal names neither.
    expect(businessOfDeal(deal({ assigned_broker: 'both' }), BROKERS)).toBe(NOT_SAID)
    // Holds two, deal names a brand they do not hold.
    expect(businessOfDeal(deal({ assigned_broker: 'both', bc_data: { brand: 'other' } }), BROKERS))
      .toBe(NOT_SAID)
    // Nobody has ticked any brand for this broker.
    expect(businessOfDeal(deal({ assigned_broker: 'untold' }), BROKERS)).toBe(NOT_SAID)
    // No broker on the deal at all.
    expect(businessOfDeal(deal({ assigned_broker: '' }), BROKERS)).toBe(NOT_SAID)
    // A broker the register has never heard of.
    expect(businessOfDeal(deal({ assigned_broker: 'ghost' }), BROKERS)).toBe(NOT_SAID)
  })

  it('never answers simplify just because simplify exists', () => {
    for (const who of ['', 'ghost', 'untold']) {
      expect(businessOfDeal(deal({ assigned_broker: who }), BROKERS)).not.toBe('simplify')
    }
  })
})

describe('the report, business by business', () => {
  const deals = [
    deal({ assigned_broker: 'mark', lodged_total: 700_000 }),
    deal({ assigned_broker: 'mark', lodged_total: 300_000 }),
    deal({ assigned_broker: 'keanen', lodged_total: 500_000 }),
    deal({ assigned_broker: 'untold', lodged_total: 200_000 }),
  ]
  const run = () => businessesOf(byBroker(deals, SPAN), BROKERS, BRANDS)

  it('heads each group with the brand name from settings', () => {
    expect(run().map(b => b.name))
      .toEqual(['Simplify Finance', 'Simplify Finance Brokers', 'Nobody has said which business'])
  })

  it('puts nobody has said last, however big it gets', () => {
    const lots = [...Array(9)].map(() => deal({ assigned_broker: 'untold' }))
    const out = businessesOf(byBroker([...deals, ...lots], SPAN), BROKERS, BRANDS)
    expect(out[out.length - 1].id).toBe(NOT_SAID)
    expect(out[0].name).toBe('Simplify Finance')
  })

  it('adds the money up from the deals in that business', () => {
    const [simplify, sfb] = run()
    expect(simplify.lodged).toBe(2)
    expect(simplify.lodgedAmount).toBe(1_000_000)
    expect(sfb.lodged).toBe(1)
    expect(sfb.lodgedAmount).toBe(500_000)
  })

  // NOTHING IS COUNTED TWICE. The business totals must add back to the book,
  // or the dark strip at the bottom of the page is a lie.
  it('adds back to the whole book', () => {
    const all = acrossAll(run())
    expect(all.lodged).toBe(4)
    expect(all.lodgedAmount).toBe(1_700_000)
  })

  it('splits one broker across both businesses without duplicating a deal', () => {
    const mixed = [
      deal({ assigned_broker: 'both', bc_data: { brand: 'simplify' }, lodged_total: 100_000 }),
      deal({ assigned_broker: 'both', bc_data: { brand: 'sfb' }, lodged_total: 400_000 }),
    ]
    const out = businessesOf(byBroker(mixed, SPAN), BROKERS, BRANDS)
    expect(acrossAll(out).lodged).toBe(2)
    expect(acrossAll(out).lodgedAmount).toBe(500_000)
    const named = Object.fromEntries(out.map(b => [b.id, b]))
    expect(named.simplify.lodgedAmount).toBe(100_000)
    expect(named.sfb.lodgedAmount).toBe(400_000)
    // One broker, one line inside each business - not the whole broker twice.
    expect(named.simplify.brokers).toHaveLength(1)
    expect(named.simplify.brokers[0].lodged).toHaveLength(1)
  })

  it('orders the brokers inside a business biggest first', () => {
    const many = [
      deal({ assigned_broker: 'kylie' }),
      ...[...Array(3)].map(() => deal({ assigned_broker: 'mark' })),
    ]
    const [simplify] = businessesOf(byBroker(many, SPAN), BROKERS, BRANDS)
    expect(simplify.brokers.map(b => b.key)).toEqual(['mark', 'kylie'])
  })
})

describe('before anybody has set a second brand up', () => {
  const ONE = [{ broker_key: 'mark', name: 'Mark Gallo', brand_ids: ['simplify'], active: true }]
  const out = () => businessesOf(
    byBroker([deal({ assigned_broker: 'mark' })], SPAN), ONE, [BRANDS[0]])

  // The page must work on the day it ships, with one brand and nothing ticked
  // onto a second. One heading is the right answer, not a broken screen.
  it('draws one heading and says so', () => {
    expect(out()).toHaveLength(1)
    expect(out()[0].name).toBe('Simplify Finance')
    expect(oneBusinessOnly(out())).toBe(true)
  })

  it('stops saying so once a second business has work in it', () => {
    const two = businessesOf(
      byBroker([deal({ assigned_broker: 'mark' }), deal({ assigned_broker: 'keanen' })], SPAN),
      BROKERS, BRANDS)
    expect(oneBusinessOnly(two)).toBe(false)
  })

  // A brand somebody ticked onto a broker but never registered in Settings
  // still gets a heading. Work that exists is always shown.
  it('shows work under an unregistered brand rather than losing it', () => {
    const odd = [{ broker_key: 'mark', name: 'Mark Gallo', brand_ids: ['navigate'], active: true }]
    const [only] = businessesOf(byBroker([deal({ assigned_broker: 'mark' })], SPAN), odd, BRANDS)
    expect(only.id).toBe('navigate')
    expect(only.name).toBe('navigate')
    expect(only.lodged).toBe(1)
  })
})
