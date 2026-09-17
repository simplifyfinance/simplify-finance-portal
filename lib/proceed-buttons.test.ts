import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// THE TWO BUTTONS THAT MOVE A DEAL ON.
//
// 17 Sep 2026, Emma Byrnes and Joshua Byrnes: "we are clicking on client agreed
// move to compliance, nothing happens."
//
// Both buttons sit above the tabs and are always on screen. Both dialogs were
// written inside the Preview & share block, so pressing the button from the form
// tab set a flag and drew nothing - no dialog, no error, nothing in the console.
// They worked from Preview and nowhere else, and nothing said so.
//
// This is the shape of fault that cannot be seen by reading either piece on its
// own: the button is fine, the dialog is fine, and they are in different rooms.
// So it is checked by position - a dialog that opens from a button outside the
// tabs must itself be outside the tabs.

type Piece = { file: string; flag: string; label: RegExp }

const PIECES: Piece[] = [
  { file: 'app/(app)/deals/[id]/BCForm.tsx', flag: 'showMoveToLoPopup',
    label: /Client agreed — move to LO/ },
  { file: 'app/(app)/deals/[id]/LOForm.tsx', flag: 'showMoveToCompliancePopup',
    label: /Client agreed — move to Compliance/ },
]

const lineOf = (lines: string[], match: (l: string) => boolean, what: string) => {
  const i = lines.findIndex(match)
  expect(i, what).toBeGreaterThan(-1)
  return i
}

describe.each(PIECES)('$flag', ({ file, flag, label }) => {
  const lines = readFileSync(file, 'utf8').split('\n')

  const dialog = () => lineOf(lines, l => l.trim() === `{${flag} && (`,
    `${file}: the dialog for ${flag} has gone`)
  const tabBlocks = () => lines
    .map((l, i) => ({ l: l.trim(), i }))
    .filter(x => x.l.startsWith('{activeTab === ') && x.l.endsWith('&& ('))
    .map(x => x.i)

  it('the button is still there and still says what it does', () => {
    expect(lines.some(l => label.test(l))).toBe(true)
  })

  it('opens from a button that is not inside a tab', () => {
    const press = lineOf(lines, l => l.includes(`set${flag[0].toUpperCase()}${flag.slice(1)}(true)`),
      `${file}: nothing opens ${flag}`)
    const first = Math.min(...tabBlocks())
    expect(press, 'the button that opens it has moved inside a tab').toBeLessThan(first)
  })

  it('AND THE DIALOG IS OUTSIDE THE TABS TOO', () => {
    const at = dialog()
    for (const t of tabBlocks()) {
      expect(at, `${file}: ${flag} is drawn inside a tab block again. Press the `
        + 'button from the other tab and nothing will happen - no dialog, no error.')
        .toBeLessThan(t)
    }
  })
})

// ---------------------------------------------------------------------------
// AND THEY ARE NOT WIRED TO EACH OTHER.
//
// Fabio, 17 Sep 2026: "I want to make sure the proceed buttons are not
// interrelated - meaning say I don't press client proceed in BC, it won't stop
// me from doing it in LO."
//
// They are two separate columns on the deal - client_proceeded for the BC,
// lo_client_proceeded for the LO - and each form reads only its own. Nothing
// about a deal's tabs is gated on either: the only thing that locks a tab is the
// deal being with the lender. This keeps it that way.

describe('the two proceed buttons are independent', () => {
  const bc = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
  const lo = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')

  it('the BC reads its own flag and never the LO\'s', () => {
    expect(bc).toMatch(/deal\.client_proceeded/)
    expect(bc, 'the BC has started reading the LO\'s proceed flag')
      .not.toMatch(/deal\.lo_client_proceeded/)
  })

  it('the LO reads its own flag and never the BC\'s', () => {
    expect(lo).toMatch(/deal\.lo_client_proceeded/)
    expect(lo, 'the LO has started reading the BC\'s proceed flag')
      .not.toMatch(/deal\.client_proceeded[^A-Za-z_]/)
  })

  it('neither button is disabled by anything to do with the other tab', () => {
    for (const [name, src, flag] of [['BC', bc, 'showMoveToLoPopup'],
                                     ['LO', lo, 'showMoveToCompliancePopup']] as const) {
      const line = src.split('\n').find(l => l.includes(`set${flag[0].toUpperCase()}${flag.slice(1)}(true)`))
      expect(line, `${name}: nothing opens ${flag}`).toBeTruthy()
      expect(line, `${name}: the proceed button has grown a disabled condition`)
        .not.toMatch(/disabled=/)
    }
  })

  it('nothing locks a tab on a proceed flag - only the deal being with the lender', () => {
    const lock = readFileSync('lib/deal-lock.ts', 'utf8')
    expect(lock).not.toMatch(/proceeded/)
  })
})
