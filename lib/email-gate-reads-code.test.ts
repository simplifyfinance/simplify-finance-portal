import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { execFileSync } from 'child_process'

// A COMMENT EXPLAINING A RULE IS NOT A BREACH OF IT.
//
// 29 Sep 2026. lib/milestone-email-parts.ts opens with a note saying Word does
// not understand rgba(), and the email gate read the word in the note and
// refused the ship. Nothing was wrong with the email. The same thing had
// happened a week earlier to a SQL guard, where a comment discussing `ilike`
// tripped a rule about using it.
//
// There are two ways to get a ship through when a gate is wrong: reword the
// comment, or fix the gate. Rewording teaches everybody to write around the
// gate, and the next person loses an hour to the same thing.
//
// WHY THIS DOES NOT WRITE FILES TO PROVE THE GATE STILL BITES. The first
// version did - it wrote a probe into lib/, ran the script, and deleted it.
// lib/recommended-option.test.ts walks lib/ at the same time, and a file that
// appears and vanishes mid-walk made THAT test fail instead. A test that breaks
// another test is worse than the gap it closes.
//
// So this reads the script, the way lib/browser-gate-blocks.test.ts reads its
// own gate, and runs it once against the repo as it stands. That the gate still
// catches a real rgba, a background on a div and a painted cell with no bgcolor
// was proven by breaking each one on purpose before this shipped.

const src = readFileSync('scripts/check-email-html.sh', 'utf8')

describe('the gate reads the code, not the comments', () => {
  it('blanks whole-line comments before scanning', () => {
    expect(src).toContain('COMMENT = re.compile')
    expect(src).toContain('code_only(io.open')
  })

  it('blanks them rather than deleting them, so line numbers still point at the right line', () => {
    // Deleting would shift every message below the comment.
    expect(src).toContain("COMMENT.sub(lambda m: '', src)")
  })

  it('only blanks a line that BEGINS with //', () => {
    // A `//` part way along a line could be inside a URL or a string, and
    // guessing wrong there would blind the gate to something real. It stays
    // strict and over-reports instead - the right side to err on for the check
    // that protects client email.
    expect(src).toContain("r'^[ \\t]*//.*$'")
  })

  it('does not scan test files, which hold fixtures and never render anywhere', () => {
    expect(src).toContain("not f.endswith('.test.ts')")
  })

  it('still passes on the repo as it stands', () => {
    // A gate that has stopped working is a gate nobody notices has stopped.
    expect(() => execFileSync('bash', ['scripts/check-email-html.sh'], { encoding: 'utf8' }))
      .not.toThrow()
  })

  it('still knows all three things it was written to catch', () => {
    expect(src).toContain('rgba()')
    expect(src).toContain('Word paints nothing')
    expect(src).toContain('no bgcolor attribute')
  })
})
