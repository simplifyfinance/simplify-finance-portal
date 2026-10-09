// THE THREE FIELDS ARE BACK WHERE THE THREE LINKS ARE.
//
// 9 Oct 2026. The restyle of 5 Oct moved OneDrive, SalesTrekker and Summary out
// of the header and into the rail - but as read-only rows, drawn only where the
// link already had a value. The boxes that SET them stayed at the bottom of the
// Fact Find tab. A deal with neither showed one line, Summary page, and there
// was nowhere on screen to put one.
//
// Fabio: "after the restyle the BCC OneDrive and another box is missing ... add
// the 3 fields back".
//
// AND THE BCC IS THE ONE THAT COSTS SOMETHING. BCForm and LOForm both read
// deal.salestrekker_bcc into the bcc of the client email, so an empty one means
// every client email on that deal goes out without copying SalesTrekker.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const src = readFileSync('components/DealLinks.tsx', 'utf8')
const code = src.replace(/\/\/[^\n]*/g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

describe('every row is drawn, whether or not it has a value', () => {
  it('no longer filters the empty ones out of existence', () => {
    // The whole fault in one line. If this comes back, a deal with no links
    // shows one row and looks broken.
    expect(code).not.toMatch(/\.filter\(r => r\.href\)/)
    expect(code).not.toMatch(/if \(rows\.length === 0\) return null/)
  })

  it('carries all four, including the one that was never here', () => {
    for (const k of ['onedrive_link', 'salestrekker_link', 'salestrekker_bcc']) {
      expect(code, `${k} is not in the rail`).toContain(k)
    }
    expect(code).toContain('Summary page')
  })
})

describe('and every one of them can be typed into', () => {
  it('offers Add on an empty row and Edit on a filled one', () => {
    expect(code).toContain("{r.value ? 'Edit' : 'Add'}")
    expect(code).toContain('<input')
  })

  it('writes through checkedWrite, so a refused save cannot look like it worked', () => {
    // A bare .update() hides a total failure - see lib/checked-write.ts and
    // scripts/check-writes.sh.
    expect(code).toContain('checkedWrite(')
    expect(code).toContain("supabase.from('deals').update({ [key]: clean })")
  })

  it('hands the saved value back to the page instead of needing a reload', () => {
    expect(code).toContain('onUpdated?.({ [key]: clean })')
    const page = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
    expect(page).toContain('<DealLinks deal={dealData}')
    expect(page).toMatch(/<DealLinks[\s\S]{0,200}onUpdated=/)
  })

  it('is the only place they are set - the Fact Find copy is gone', () => {
    // They were in two places and only one of them could be typed into. Fabio,
    // 9 Oct 2026: "did we move to the top of the page? I dont like I want under
    // salestrekker and links tab on the right."
    const ff = readFileSync('app/(app)/deals/[id]/FactFindForm.tsx', 'utf8')
    expect(ff).not.toContain('saveDealLinks')
    expect(ff).not.toContain('Paste OneDrive folder URL')
  })
})

describe('nothing a person could read was lost on the way', () => {
  // lib/nothing-is-lost.test.ts holds every readable string on the five forms
  // against a locked list. These moved OUT of FactFindForm, so its entry in the
  // snapshot had to be edited by hand - which is the one sanctioned way to
  // remove anything and shows up in the diff on purpose.
  //
  // That protection must not just end there. It follows the words: they are
  // pinned to this file now, word for word.
  const MOVED = [
    'OneDrive folder',
    'Paste OneDrive folder URL...',
    'SalesTrekker card',
    'Paste SalesTrekker deal URL...',
    'SalesTrekker BCC code',
    'e.g. deal-12345@salestrekker.com',
    'That link',
  ]

  it('every label and placeholder from the Fact Find is readable here instead', () => {
    for (const w of MOVED) expect(src, `"${w}" went missing in the move`).toContain(w)
  })

  it('and the Fact Find no longer carries a second copy of any of them', () => {
    const ff = readFileSync('app/(app)/deals/[id]/FactFindForm.tsx', 'utf8')
    for (const w of MOVED.filter(x => x !== 'That link')) {
      expect(ff, `"${w}" is still on the Fact Find as well`).not.toContain(w)
    }
  })

  it('the only thing genuinely dropped is the heading the rail already has', () => {
    // "Deal links" was the heading above those three boxes. The rail box is
    // headed "SalesTrekker & links", so keeping it would be the same words
    // twice. It is the single removal in this change.
    const ff = readFileSync('app/(app)/deals/[id]/FactFindForm.tsx', 'utf8')
    expect(ff).not.toContain('Deal links')
    expect(src).toContain('SalesTrekker &amp; links')
  })
})

describe('an empty BCC says what it costs', () => {
  it('names the consequence rather than leaving a blank', () => {
    expect(src).toContain('Client emails on this deal are not copying SalesTrekker.')
  })

  it('and it is the one row that goes red', () => {
    expect(code).toContain("isBcc ? 'text-chase'")
  })
})
