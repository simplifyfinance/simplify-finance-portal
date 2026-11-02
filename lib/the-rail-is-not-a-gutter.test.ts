import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// THE RAIL IS NOT A GUTTER.
//
// 2 Nov 2026. Fabio, looking at the BC tab: "I like the fix but see how it is
// a waste of space cramming the right hand column."
//
// Two faults, one cause - something fixed-width taking its share first and the
// words getting the remainder.
//
// THE COLUMN. The rail was pinned at 330px and the tab took everything else,
// about 1370px on his screen. The widest thing on the BC tab is the email
// preview, a 720px card centred in it, so roughly 650px of the tab was empty
// while every sentence in the rail broke at five words.
//
// THE ROW. Inside the documents box the tick, the Lodge/Compliance chip and
// the Arrived button are all fixed width and are laid out first. The document's
// name got what was left - about sixty pixels in the rail - so "Trust deed and
// agreement" wrapped one word per line and the chip landed on the text.
// Widening the rail alone would only move that: a long enough name does it
// again at any width. Both are fixed here, together, because either one on its
// own leaves the other.

const PAGE = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
const DOCS = readFileSync('components/DocumentsBox.tsx', 'utf8')

describe('THE RAIL GROWS WITH THE WINDOW', () => {
  it('it is no longer pinned at 330', () => {
    expect(PAGE).not.toContain('minmax(0,330px)')
  })

  it('AND 330 IS NOW THE FLOOR, NOT THE WIDTH', () => {
    expect(PAGE).toContain('minmax(0,clamp(330px,26vw,440px))')
  })

  it('and a small screen still gets the rail underneath', () => {
    // Nothing about this changes below 1100 - there the rail has never been a
    // column at all, it is a stack under the tab.
    expect(PAGE).toContain('max-[1100px]:grid-cols-1')
  })
})

describe('AND A DOCUMENT KEEPS ITS NAME', () => {
  it('the row may wrap', () => {
    expect(DOCS).toContain('className="flex flex-wrap gap-3 items-start px-4 py-[7px]')
  })

  it('AND THE NAME HAS A FLOOR', () => {
    // min-w-0 is what let it shrink to one word per line.
    expect(DOCS).toContain('<div className="flex-1 min-w-[170px]">')
  })

  it('and the chips travel together, so they wrap as one line', () => {
    // One at a time would leave Arrived stranded beside a crushed name, which
    // is the same fault with fewer pixels.
    expect(DOCS).toContain('<div className="flex gap-2 items-start flex-none ml-7">')
  })

  it('AND NOTHING WAS REMOVED TO MAKE ROOM', () => {
    expect(DOCS).toContain("{r.forWhat === 'lodge' ? 'Lodge' : 'Compliance'}")
    expect(DOCS).toContain('Arrived\n')
    expect(DOCS).toContain('>Remove</button>')
  })
})
