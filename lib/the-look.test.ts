import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { THE_LOOK, built, outstanding } from './the-look'

// EVERY CLAIM IN lib/the-look.ts HAS TO BE TRUE.
//
// The point of the list is that neither of us has to remember whether a piece
// of an approved mock is in the portal. Marking something built without
// building it fails here, which is the only thing that makes the list worth
// anything.

describe('the approved look, piece by piece', () => {
  it('the list is not empty and every entry says where it came from', () => {
    expect(THE_LOOK.length).toBeGreaterThan(0)
    for (const p of THE_LOOK) {
      expect(p.mock, 'every piece names the mock it came from').toBeTruthy()
      expect(p.piece, 'every piece says what it is').toBeTruthy()
    }
  })

  for (const p of THE_LOOK.filter(built)) {
    it(`${p.piece} — is really in the code`, () => {
      const f = p.proof!.file
      expect(existsSync(f), `${f} does not exist, so "${p.piece}" cannot be in it`).toBe(true)
      const src = readFileSync(f, 'utf8')
      expect(src.includes(p.proof!.contains),
        `"${p.piece}" is marked built, but ${f} does not contain ${p.proof!.contains}`).toBe(true)
    })
  }

  // Not a failure - a number. It is how much of the approved look is still only
  // a drawing, and it is meant to go down and never up.
  it('says how much of the approved look is still not built', () => {
    const left = outstanding()
    const done = THE_LOOK.length - left.length
    console.log(`\n  THE LOOK: ${done} of ${THE_LOOK.length} pieces built, ${left.length} to go`)
    for (const p of left) console.log(`    not built - ${p.piece}`)
    expect(left.length).toBeLessThanOrEqual(THE_LOOK.length)
  })
})

// A CARD IS STILL CALLED BY ITS TAB NAME.
//
// The status line lives inside the button, so without an explicit name the
// button is called "Compliance Not started" and anything clicking the tab by
// name - a person using a screen reader, or six of our own browser specs -
// cannot find it. See components/DealTabCards.tsx.
describe('the tab cards answer to their own names', () => {
  const src = readFileSync('components/DealTabCards.tsx', 'utf8')

  it('every card states its name rather than letting the words inside it decide', () => {
    expect(src).toMatch(/aria-label=\{label\}/)
  })
})
