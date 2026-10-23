// A KNOWLEDGE BASE ENTRY WITH NO PICTURE IS A KNOWLEDGE BASE ENTRY NOBODY READS.
//
// 22 Oct 2026. Fabio, after an entry about a button change went out with no
// screenshot in it: "I asked you 100 fucking times." He had, more than once:
// "I need images too mcuh words quick sanppy images showing where things are
// mokups" (21 Oct). I wrote another wall of words anyway.
//
// So it is a test now, not a good intention.
//
// THE NINE BELOW ARE A DEBT, NOT AN EXEMPTION. They were written before this
// test existed and every one of them should have a picture. They are listed by
// name so the debt is visible and shrinking, rather than invisible and growing.
// Take one off this list each time you give it a screenshot. Never add to it.
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { ENTRIES, isShot, shotPath, type Block } from './knowledge-base'

const WRITTEN_BEFORE_THIS_TEST = [
  'top-up-templates',
  'repayment-analysis',
  'refinance-saving-second-angle',
  'the-loan-that-stays',
  'lmi-per-property',
  'lending-options-step-by-step',
  'signing-in-changed',
  'lvr-exposure-on-the-book',
  'portfolio-review',
]

function shotsIn(blocks: Block[]): string[] {
  const out: string[] = []
  const eat = (b: any) => {
    if (isShot(b)) out.push(b.shot)
    else if (b && typeof b === 'object' && Array.isArray(b.body)) b.body.forEach(eat)
  }
  blocks.forEach(eat)
  return out
}

describe('every knowledge base entry shows somebody the thing', () => {
  for (const e of ENTRIES) {
    if (WRITTEN_BEFORE_THIS_TEST.includes(e.id)) continue
    it(`${e.id} has at least one picture`, () => {
      expect(shotsIn(e.body).length,
        `"${e.title}" is all words.\n`
        + 'An entry about something on screen shows the thing. Render it, put it\n'
        + 'in public/kb/, and add { shot: ..., caption: ... } to the body.')
        .toBeGreaterThan(0)
    })
  }

  it('and every picture it names actually exists', () => {
    for (const e of ENTRIES) {
      for (const shot of shotsIn(e.body)) {
        expect(existsSync(`public${shotPath(shot)}`), `${e.id} points at a missing ${shot}`).toBe(true)
      }
    }
  })

  it('the debt list only ever shrinks', () => {
    // If somebody adds an id here to get a build through, this is where it is
    // caught. Nine on 22 Oct 2026.
    expect(WRITTEN_BEFORE_THIS_TEST.length).toBeLessThanOrEqual(9)
    for (const id of WRITTEN_BEFORE_THIS_TEST) {
      expect(ENTRIES.some(e => e.id === id), `${id} is not an entry any more - take it off the list`).toBe(true)
    }
  })
})
