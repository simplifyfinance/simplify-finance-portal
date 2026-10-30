import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { securitiesWithPurchase, BEING_PURCHASED, BEING_PURCHASED_LABEL } from './securities'

// THE HOUSE GETS ITS NAME THE DAY THE OFFER IS ACCEPTED.
//
// 30 Oct 2026. Fabio: "offer accepted process is not allowing us to change the
// security details - remember it starts as TBA, then we find a property."
//
// The row has existed since 16 Oct, carrying the purchase price, the loan
// against it and its own LVR. What it never had was an address, because until
// an offer is accepted there is no address to give it - and the panel that
// records an accepted offer never asked for one.
//
// Invented clients.

const PANEL = readFileSync('components/OfferAccepted.tsx', 'utf8')

const bc = { template: 'investment_equity', securityIds: ['p1'],
             newPurchasePrice: '900,000',
             splits: [{ label: 'New purchase', amount: '720,000', securityId: BEING_PURCHASED }] }
const ff = { properties: [{ id: 'p1', address: '35/10 Goodwin St', value: '1,150,000' }] }
const buyRow = (address?: string) =>
  securitiesWithPurchase(bc, ff, address).find(s => s.id === BEING_PURCHASED)

describe('THE ROW THAT HAD NO NAME', () => {
  it('takes the address once there is one', () => {
    expect(buyRow('18 Coach Rd, Woodend VIC 3442')?.address).toBe('18 Coach Rd, Woodend VIC 3442')
  })

  it('AND SAYS TBA UNTIL THERE IS', () => {
    // Which is the truth, not a gap. Nothing is invented and nothing is blank.
    expect(buyRow()?.address).toBe(BEING_PURCHASED_LABEL)
    expect(buyRow('')?.address).toBe(BEING_PURCHASED_LABEL)
    expect(buyRow('   ')?.address).toBe(BEING_PURCHASED_LABEL)
  })

  it('and nothing else about the row moves', () => {
    const named = buyRow('18 Coach Rd')
    expect(named?.value).toBe('900,000')
    expect(named?.limit).toBe('720000')
    expect(named?.id).toBe(BEING_PURCHASED)
  })

  it('and the houses they already own are untouched', () => {
    const list = securitiesWithPurchase(bc, ff, '18 Coach Rd')
    expect(list[0].address).toBe('35/10 Goodwin St')
    expect(list).toHaveLength(2)
  })
})

describe('AND THE PANEL ASKS FOR IT', () => {
  it('in a box of its own', () => {
    expect(PANEL).toContain('The property being bought')
  })

  it('that writes where every screen reads', () => {
    expect(PANEL).toContain("onBlurField('purchase_address')")
  })

  it('AND BEFORE THE DATES, BECAUSE IT IS THE FIRST THING AN OFFER TELLS YOU', () => {
    expect(PANEL.indexOf('The property being bought'))
      .toBeLessThan(PANEL.indexOf('Settlement date'))
  })

  it('and it says what happens while it is empty', () => {
    expect(PANEL).toContain('every screen calls it')
  })
})

describe('AND EVERY SCREEN IS HANDED THE SAME ANSWER', () => {
  // A screen that is not given the address would print TBA beside one that
  // prints the street - which is the fault this codebase keeps paying for.
  const callers = [
    'lib/funds-to-complete.ts', 'lib/box-one.ts', 'lib/commission.ts',
    'app/(app)/deals/[id]/BCForm.tsx', 'app/(app)/deals/[id]/LOForm.tsx',
  ]

  it.each(callers)('%s passes it', (f) => {
    const src = readFileSync(f, 'utf8')
    const calls = src.match(/securitiesWithPurchase\([^)]*\)/g) || []
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) expect(c, `${f}: ${c}`).toContain('purchase_address')
  })
})
