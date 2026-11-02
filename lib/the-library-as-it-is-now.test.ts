import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// THE LIBRARY AS IT IS NOW, NOT AS IT WAS WHEN THE SCREEN OPENED.
//
// 30 Oct 2026. Fabio: "I am updating the lender library and it is not coming
// across when we select the product in the LO email."
//
// The lending options screen read every product once, on mount, and held that
// copy for as long as the page stayed open. Add Bankwest's $350 legal fee to
// the library, go back to a deal in the other tab, pick that product - and it
// copied the row as it was before the edit. The fee was saved and correct in
// the library; the deal got the old blank, and the client's email had no legal
// fee line on it at all.
//
// Nothing warned, because nothing knew. The screen was not holding a wrong
// answer. It was holding one that was right when it asked.

const LO = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')
const BLOCK = LO.slice(LO.indexOf('async function selectProduct'),
                       LO.indexOf('function updateLender'))

describe('PICKING A PRODUCT READS THE PRODUCT', () => {
  it('from the database, at the moment it is picked', () => {
    expect(BLOCK).toContain("supabase.from('lender_products')")
    expect(BLOCK).toContain(".eq('id', productId)")
  })

  it('AND THE FEES COME OFF THAT READ', () => {
    expect(BLOCK).toContain('legalFee: product.legal_fee')
    expect(BLOCK).toContain('applicationFee: product.application_fee')
    expect(BLOCK).toContain('annualFee: product.annual_fee')
    expect(BLOCK).toContain('valuationFee: product.valuation_fee')
  })

  it('and the cached row is the fall-back, not the first answer', () => {
    // A product picked with yesterday's fees beats one picked with none.
    expect(BLOCK).toContain('let product: any = cached')
    expect(BLOCK).toContain('if (fresh)')
  })

  it('and a read that fails does not lose the pick', () => {
    expect(BLOCK).toContain('} catch {')
    expect(BLOCK).not.toContain('if (!fresh) return')
  })

  it('and what it reads is kept, so the next pick is not a second round trip', () => {
    expect(BLOCK).toContain('setAllProducts(prev => prev.map(')
  })
})

describe('AND THE DROPDOWN ITSELF COMES BACK', () => {
  it('when the tab is looked at again', () => {
    // A product ADDED while this page was open was not in the list at all.
    expect(LO).toContain('const [libraryRead, setLibraryRead] = useState(0)')
    expect(LO).toContain("document.addEventListener('visibilitychange', again)")
  })

  it('and the load watches for it', () => {
    expect(LO).toContain('}, [libraryRead])')
  })

  it('AND IT STILL ONLY LISTENS WHILE THE PAGE IS THERE', () => {
    expect(LO).toContain("document.removeEventListener('visibilitychange', again)")
    expect(LO).toContain("window.removeEventListener('focus', again)")
  })
})
