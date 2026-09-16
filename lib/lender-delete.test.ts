import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// "DELETE LENDER STICKS."
//
// Fabio, 16 Sep 2026. The popup appeared, Cancel worked, and "Yes, delete" did
// nothing at all.
//
// It was doing something: the database refused, deleteLender set writeError and
// returned without closing the popup - correct, the lender is not deleted - and
// the banner carrying that message is drawn at the TOP OF THE PAGE, underneath
// the full-screen overlay the person was looking at. The explanation was two
// inches away behind a grey sheet.
//
// Two things now. The reason is drawn inside the popup. And the commonest reason
// is said before the database is even asked: a lender that deals or commission
// rates point at cannot go, and the thing they actually want is the Active
// toggle.

const src = readFileSync('components/LenderLibrary.tsx', 'utf8')

describe('deleting a lender says what happened', () => {
  it('draws the reason inside the popup, not behind it', () => {
    const modal = src.slice(src.indexOf('Confirm Delete Modal'), src.indexOf('AI Import Modal'))
    expect(modal, 'the refusal is still only drawn on the page behind the overlay')
      .toContain('{writeError && (')
    expect(modal.indexOf('{writeError && ('))
      .toBeLessThan(modal.indexOf('Yes, delete'))
  })

  it('starts each attempt without the last one\'s message', () => {
    const fn = src.slice(src.indexOf('async function deleteLender'), src.indexOf('async function deleteProduct'))
    expect(fn).toContain("setWriteError('')")
  })

  it('clears it on cancel, so it cannot haunt the next lender', () => {
    expect(src).toContain("onClick={() => { setWriteError(''); setConfirmDelete(null) }}")
  })

  it('counts what is holding the lender up before asking the database', () => {
    expect(src).toContain("from('deals').select('id', { count: 'exact', head: true }).eq('lender_id', id)")
    expect(src).toContain("from('commission_rates')")
  })

  it('points at the Active toggle instead of leaving somebody stuck', () => {
    // Which is what "delete" was being reached for: get it off the dropdowns.
    // Deleting would take the history of every deal that used it.
    expect(src).toMatch(/Active toggle/)
  })

  it('still refuses rather than deleting history', () => {
    const fn = src.slice(src.indexOf('async function deleteLender'), src.indexOf('async function deleteProduct'))
    expect(fn).toMatch(/if \(inUse\) \{ setWriteError\(inUse\); return \}/)
  })
})
