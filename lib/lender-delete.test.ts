import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// "DELETE LENDER STICKS."
//
// Fabio, 16 Sep 2026. The popup appeared, Cancel worked, and "Yes, delete" did
// nothing at all.
//
// It was doing something: the database refused, deleteLender set writeError and
// returned without closing the popup - correct, the lender is not deleted - and
// the banner carrying that message was drawn at the TOP OF THE PAGE, underneath
// the full-screen overlay the person was looking at. The explanation was two
// inches away behind a grey sheet.
//
// ============================================================== 7 Oct 2026
//
// THAT BUTTON IS GONE, AND SO IS THE ONE BESIDE IT.
//
// Fabio: "we dont want to delete so it doesnt impact deal cards so why not
// archive". He is right, and the product half was worse than the lender half.
//
//   a lender  - deals and commission rates point at it by a real column, so
//               the database refused, and the refusal was at least honest
//   a product - a deal keeps its id inside lo_data, which no foreign key
//               watches, so Delete simply worked. Every deal that chose that
//               product was left pointing at a row that is not there, with the
//               fees still written on the deal and nothing to say where they
//               came from. No undo, no message, no trace.
//
// So this file turned over. It used to check that a refusal was visible. It now
// checks that there is nothing to refuse: this screen cannot take a row out of
// the database at all. The lesson is the same one, finished properly.

const src = readFileSync('components/LenderLibrary.tsx', 'utf8')

describe('products and policy never deletes anything', () => {
  it('has no delete call left in it', () => {
    // .delete() on any table. The screen writes and it archives; it does not
    // remove. If a delete is ever wanted again it needs this guard changed on
    // purpose, with somebody reading the reasoning above first.
    const found = src.split('\n')
      .map((line, i) => ({ line, i: i + 1 }))
      .filter(x => /\.delete\(\)/.test(x.line))
      .map(x => `components/LenderLibrary.tsx:${x.i}`)
    expect(found, 'a deal remembers a product by its id and no foreign key\n'
      + 'watches that, so a deleted product leaves those deals pointing at\n'
      + 'nothing, with no undo. Archive instead - it is the same on/off column\n'
      + 'and every deal that used the row keeps working.\n' + found.join('\n')).toEqual([])
  })

  it('does not offer to delete anything in words either', () => {
    expect(src).not.toMatch(/permanently deleted/)
    expect(src).not.toMatch(/Yes, delete/)
  })

  it('still counts what a bank is holding before it archives one', () => {
    // The two counts that used to explain a refusal now say what archiving is
    // leaving alone. Losing them would make the question meaningless.
    expect(src).toContain("from('deals').select('id', { count: 'exact', head: true }).eq('lender_id', id)")
    expect(src).toContain("from('commission_rates')")
  })

  it('counts how many deals chose a product before archiving it', () => {
    // The product half had no such count at all, which is how Delete got to sit
    // beside a product that seven deals were using.
    expect(src).toContain("contains('lo_data', { lenders: [{ lenderProductId: id }] })")
  })

  it('asks in place, not behind a full-screen sheet', () => {
    // The whole fault of 16 Sep was a question drawn over the thing it was
    // about, with its own answer hidden behind it. The archive question is a
    // panel under the row - same rule OfferAccepted was built on.
    const ask = src.slice(src.indexOf('{askingThis && ('), src.indexOf('Archive it'))
    expect(ask).not.toMatch(/fixed inset-0/)
    expect(ask).toContain('We archive, we never delete.')
  })

  it('says what archiving leaves alone, in the question itself', () => {
    expect(src).toMatch(/stay exactly as they are/)
  })
})
