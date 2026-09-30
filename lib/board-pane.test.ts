import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { paneHeight, dragScrollBy, WIDE_ENOUGH, MIN_PANE, EDGE } from './board-pane'

// THE BOARD FITS THE SCREEN, AND A SMALL SCREEN IS LEFT ALONE.
//
// Kylie, 30 Sep 2026: each column should scroll on its own, and you should be
// able to go sideways from anywhere. Fabio, on what to do about a phone: "keep
// todays behaviour on a small screen".
//
// The maths is out here rather than inside the component so it can be tested at
// all. A height worked out inside a useEffect is a height nothing can check.

describe('how tall the board should be', () => {
  it('takes what is left of the screen under wherever the board starts', () => {
    expect(paneHeight({ windowWidth: 1440, windowHeight: 900, boardTop: 300 })).toBe(576)
  })

  it('moves with the board when the filters wrap and push it down', () => {
    const high = paneHeight({ windowWidth: 1440, windowHeight: 900, boardTop: 240 })!
    const low = paneHeight({ windowWidth: 1440, windowHeight: 900, boardTop: 340 })!
    expect(high - low).toBe(100)
  })

  // A SMALL SCREEN GETS TODAY'S BOARD. Null is the signal for that, and every
  // part of the component reads it - the height, the column stretch, the inner
  // scroll and the drag nudge all fall back together or not at all.
  it('is null on anything narrower than a laptop', () => {
    expect(paneHeight({ windowWidth: 430, windowHeight: 930, boardTop: 200 })).toBeNull()
    expect(paneHeight({ windowWidth: WIDE_ENOUGH - 1, windowHeight: 900, boardTop: 200 })).toBeNull()
    expect(paneHeight({ windowWidth: WIDE_ENOUGH, windowHeight: 900, boardTop: 200 })).not.toBeNull()
  })

  it('never squeezes itself down to nothing on a short window', () => {
    // A wide but very short window - a laptop with every toolbar open.
    expect(paneHeight({ windowWidth: 1440, windowHeight: 500, boardTop: 420 })).toBe(MIN_PANE)
  })

  it('survives a window it cannot measure', () => {
    expect(paneHeight({ windowWidth: NaN, windowHeight: 900, boardTop: 200 })).toBeNull()
  })
})

describe('dragging a card to the edge brings the next column along', () => {
  const pane = { paneLeft: 100, paneRight: 1100 }

  it('does nothing in the middle, where somebody is just moving a card', () => {
    expect(dragScrollBy({ ...pane, pointerX: 600 })).toBe(0)
  })

  it('goes left near the left edge and right near the right', () => {
    expect(dragScrollBy({ ...pane, pointerX: 110 })).toBeLessThan(0)
    expect(dragScrollBy({ ...pane, pointerX: 1090 })).toBeGreaterThan(0)
  })

  it('goes faster the harder you push', () => {
    const gentle = Math.abs(dragScrollBy({ ...pane, pointerX: 100 + EDGE - 5 }))
    const hard = Math.abs(dragScrollBy({ ...pane, pointerX: 101 }))
    expect(hard).toBeGreaterThan(gentle)
  })

  // Nudging by nothing is the same as not nudging, and a card held just inside
  // the edge would sit there doing nothing at all.
  // Math.abs, not .not.toBe(0). Without the rounding guard the far edge of the
  // zone returns -0, and Object.is(-0, 0) is false - so `.not.toBe(0)` PASSED on
  // a broken function. Caught by breaking it on purpose and watching the test
  // stay green, which is the only way that kind of hole ever shows up.
  it('always moves by at least a pixel once it is in the zone', () => {
    for (let x = 101; x < 100 + EDGE; x++) {
      expect(Math.abs(dragScrollBy({ ...pane, pointerX: x })),
        `a card held ${x - 100}px from the edge does not move the board`).toBeGreaterThanOrEqual(1)
    }
    for (let x = 1100 - EDGE + 1; x < 1100; x++) {
      expect(Math.abs(dragScrollBy({ ...pane, pointerX: x }))).toBeGreaterThanOrEqual(1)
    }
  })

  it('ignores a pointer that has left the board', () => {
    expect(dragScrollBy({ ...pane, pointerX: 40 })).toBe(0)
    expect(dragScrollBy({ ...pane, pointerX: 1400 })).toBe(0)
    expect(dragScrollBy({ paneLeft: 0, paneRight: 0, pointerX: 0 })).toBe(0)
  })
})

describe('the board reads the one answer', () => {
  const board = readFileSync('components/DealBoard.tsx', 'utf8')

  it('asks lib/board-pane.ts rather than working it out again', () => {
    expect(board).toContain("from '@/lib/board-pane'")
    expect(board).toContain('paneHeight({')
  })

  // THE WHOLE POINT OF THE CHANGE. A column that does not scroll on its own
  // leaves the board exactly as tall as its longest column, which is what Kylie
  // complained about.
  it('gives each column its own scroll', () => {
    expect(board).toContain('overflow-y-auto')
  })

  it('and keeps the sideways bar on the pane, not on the page', () => {
    expect(board).toContain('overflow-x-auto')
    expect(board).toContain('overflow-y-hidden')
  })

  // EVERY PIECE OF THE PANE IS BEHIND THE SAME CONDITION.
  //
  // A count was not enough: removing the guard from one line still left four
  // others and this test stayed green while the board was broken. So each piece
  // is named and has to carry the check on its own line. Half a pane - a fixed
  // height with columns that still grow inside it - is worse than either
  // behaviour whole.
  it('puts every piece of the pane behind the same condition', () => {
    const pieces: [string, string][] = [
      // The exact class list, not a bare "overflow-y-auto" - the deal-peek
      // modal on this same page has one of those and has nothing to do with the
      // board.
      ['min-h-0 overflow-y-auto', 'a column scrolling its own cards'],
      ['overflow-y-hidden', 'the pane clipping instead of the page growing'],
      ['items-stretch', 'columns stretching to the pane'],
      ['flex flex-col min-h-0', 'a column becoming a header plus a list'],
      ['height: paneH', 'the pane taking a fixed height'],
    ]
    for (const [needle, what] of pieces) {
      const lines = board.split('\n').filter(l => l.includes(needle))
      expect(lines.length, `${what}: "${needle}" is not in the board at all`).toBeGreaterThan(0)
      for (const line of lines) {
        expect(line, `${what} happens on a narrow screen too - that line does not check paneH`)
          .toContain('paneH === null')
      }
    }
  })
})
