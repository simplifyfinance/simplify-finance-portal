import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// A PROMISE THE PORTAL MADE FOR MONTHS AND DID NOT KEEP.
//
// Products & policy has had an on/off switch on every bank and every product
// since it was built, and the message on a refused delete told people to use
// it: "it comes off every dropdown and every deal that used it stays exactly
// as it is."
//
// The second half was true. The first half was not. The loan options screen
// loaded lender_products with select('*') and lenders with select('id, name'),
// no filter on either, so a bank switched off in the library went on being
// offered on every new deal.
//
// 7 Oct 2026 the switch was renamed Archive, which is what it was always for.
// This guard is the half that makes the word true.
//
// AND THE OTHER DIRECTION, WHICH MATTERS MORE.
//
// A deal that ALREADY chose an archived product must still show it. Filter it
// out of that deal's own dropdown and the box falls back to "- select product
// -" while the record still holds the id, and the next person to save that
// deal wipes what was recommended. That is the deal-card damage the archive was
// meant to prevent, arriving through the front door instead.

const src = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')

const lenderList = src.slice(src.indexOf('const uniqueLenders'), src.indexOf('function getProductsForLender'))
const productList = src.slice(src.indexOf('function getProductsForLender'), src.indexOf('function selectLenderName'))

describe('an archived bank or product is off the loan options screen', () => {
  it("knows whether each product's bank is archived", () => {
    expect(src).toContain("select('id, name, active')")
    expect(src).toContain('lender_active')
  })

  it('leaves an archived bank out of the lender list', () => {
    expect(lenderList, 'an archived bank is still being offered on new deals')
      .toContain('p.lender_active')
  })

  it('leaves an archived product out of the product list', () => {
    expect(productList, 'an archived product is still being offered on new deals')
      .toContain('p.active && p.lender_active')
  })

  it('still shows one this deal already chose', () => {
    expect(productList, 'archiving a product would blank the Product box on every\n'
      + 'deal that had chosen it, and the next save would wipe the recommendation')
      .toContain('chosenProductIds.has(p.id)')
    expect(lenderList, 'archiving a bank would blank the Lender box on every deal\n'
      + 'that had chosen it')
      .toContain('chosenLenderIds.has(p.lender_id)')
  })

  it('still loads every product, archived ones included', () => {
    // The filter belongs on what is OFFERED, not on what is loaded. Filtering
    // the query itself would mean a deal could not name the product it chose.
    expect(src).toContain("supabase.from('lender_products').select('*')")
  })
})
