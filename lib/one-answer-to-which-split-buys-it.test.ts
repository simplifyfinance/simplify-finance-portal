import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { autoTagSplits, findPurchaseSplit } from './split-security-tag'
import { boxesFor } from './security-figures'
import { orphanSplits, BEING_PURCHASED, purchaseLoanOf } from './securities'

// ONE ANSWER TO "WHICH SPLIT BUYS THE HOUSE".
//
// 30 Oct 2026, the Ollie Murphy deal - an INV purchase with an equity release.
// Fabio: "we are still struggling with the same problem we dealt with
// yesterday... new purchase is NOT linking to TBA at the top hence why it says
// nothing owing yet. Do you understand that refi equity purchase template we
// acquire a new security and there is a loan against THAT security?"
//
// There were TWO answers in the portal and they disagreed:
//
//   findPurchaseSplit()  tag, then label, then POSITION - the third split
//   autoTagSplits()      tag, then label, and nothing else
//
// His third split has an empty label, which is why the warning called it "Split
// 3". The New purchase panel found it by position and wrote the price, the loan
// and the rate into it. The tagger found no label, left it against no security,
// and the house being bought showed "drawn $0".
//
// Invented clients. The figures are his.

const FORM = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

// 18 Coach Rd owes $189,000 and is carrying the release; the purchase split is
// third, with no label on it at all.
const splits = [
  { label: 'Existing loan refinanced', amount: '189,000', securityId: 'p1', existingBalance: '189,000' },
  { label: 'Equity access SHARES', amount: '300,000', securityId: 'p1', existingBalance: '0' },
  { label: '', amount: '960,000' },
  { label: 'Equity access for deposit', amount: '288,000', securityId: 'p1' },
]
const bc: any = { template: 'investment_equity', securityIds: ['p1'],
                  newPurchasePrice: '1,200,000', splits }
const ff = { properties: [{ id: 'p1', address: '18 Coach Rd, Woodend VIC', value: '1,300,000' }] }

describe('THE SPLIT THE PANEL EDITS IS THE SPLIT THE TAGGER TAGS', () => {
  it('and it is found the same way by both', () => {
    expect(findPurchaseSplit(splits)).toBe(2)
  })

  it('SO THE PURCHASE LINKS TO THE HOUSE IT BUYS', () => {
    const out = autoTagSplits(splits, 'investment_equity', ['p1'])!
    expect(out[2].securityId).toBe(BEING_PURCHASED)
  })

  it('and the red line goes with it', () => {
    const after = autoTagSplits(splits, 'investment_equity', ['p1'])!
    expect(orphanSplits(after, [{ id: 'p1' } as any])).toEqual([])
  })

  it('AND THE HOUSE BEING BOUGHT STOPS READING $0', () => {
    const after = autoTagSplits(splits, 'investment_equity', ['p1'])!
    expect(purchaseLoanOf({ ...bc, splits: after })).toBe(960000)
    expect(boxesFor({ ...bc, splits: after }, ff, BEING_PURCHASED).limit).toBe(960000)
  })

  it('and a tagged split is still believed over its position', () => {
    const tagged = [{ label: 'x', amount: '1' }, { label: 'y', securityId: BEING_PURCHASED, amount: '2' },
                    { label: 'z', amount: '3' }]
    expect(findPurchaseSplit(tagged)).toBe(1)
  })

  it('and a named one over its position', () => {
    const named = [{ label: 'New purchase', amount: '1' }, { label: 'y', amount: '2' },
                   { label: 'z', amount: '3' }]
    expect(findPurchaseSplit(named)).toBe(0)
  })

  it('and two splits are not a purchase by position', () => {
    expect(findPurchaseSplit([{ label: 'a' }, { label: 'b' }])).toBe(-1)
    expect(findPurchaseSplit([])).toBe(-1)
    expect(findPurchaseSplit(null)).toBe(-1)
  })

  it('AND IT IS WRITTEN DOWN ONCE', () => {
    expect(FORM).toContain("import { autoTagSplits, findPurchaseSplit } from '@/lib/split-security-tag'")
    expect(FORM, 'a second copy in the form').not.toContain('function findPurchaseSplit(list: Split[])')
  })

  it('and the panel says so on whatever it edits', () => {
    expect(FORM).toContain('[field]: val, securityId: BEING_PURCHASED')
  })
})

describe('AND "OWES NOW" READS BOTH PLACES IT IS RECORDED', () => {
  it('the BC box, where this deal has it', () => {
    // "Existing balance on this property" - $189,000, in plain sight two
    // panels down from a box that said nothing.
    expect(boxesFor(bc, ff, 'p1').owes).toBe(189000)
  })

  it('and what is lent against the house, less what it owes, is the release', () => {
    const box = boxesFor(bc, ff, 'p1')
    expect(box.limit).toBe(777000)
    expect(box.releasing).toBe(588000)
  })

  it('BUT THE FACT FIND STILL WINS WHERE IT HAS ONE', () => {
    // The client's own record of what they owe beats a figure typed on a BC.
    const withLoan = { properties: [{ ...ff.properties[0],
      loans: [{ balance: '200,000', status: 'Refinance' }] }] }
    expect(boxesFor(bc, withLoan, 'p1').owes).toBe(200000)
  })

  it('and a house with neither still shows nothing', () => {
    const bare = { ...bc, splits: [{ amount: '400,000', securityId: 'p1' }] }
    expect(boxesFor(bare, ff, 'p1').owes).toBe(0)
  })
})
