import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// A ROBOT MUST ASK FOR A BOX BY NAME, NEVER BY POSITION.
//
// 5 Oct 2026, and this cost a ship. tests/browser/two-people.spec.ts held:
//
//     const notes = (page) => page.locator('textarea').first()
//
// which found internal notes for weeks, because internal notes happened to be
// the first box on the page. Then the rail moved that box out of the form,
// "first" became Purpose of loan - a client facing Fact Find box - and the
// test went on running without anybody knowing it had changed what it was
// testing. It typed robot text into a real field and reported the Fact Find's
// own save race as a notes fault.
//
// Nothing warned, because nothing broke. The test still found A box.
//
// So: no spec may take a control by its position on the page. Ask for it by
// its name, its label or its placeholder, and moving it either still works or
// fails loudly - which is the whole point of having robots.
const DIR = 'tests/browser'

// .first() on a list ALREADY narrowed by name is fine - getByRole returning
// two matching buttons, for instance. Picking out of every control of a kind
// is what is banned.
//
// TEXT BOXES ONLY. This is where the fault lives: a text box that moves takes
// somebody's typing with it. A select or a button picked out of a dialog is a
// smaller sin and is left alone rather than rewritten in a hurry.
const BY_POSITION = /\.locator\(\s*['"`](textarea|input)[^'"`]*['"`]\s*\)\s*\.\s*(first|last|nth)\(/

// AND A TEST THAT MEANS "WHICHEVER BOX IS FIRST" SAYS SO.
// two-people.spec.ts has one on purpose: it proves that the other window
// saving eats nothing, whatever box that window happened to touch. A line
// carrying this marker is allowed, and has to say why in the line above it.
const ON_PURPOSE = 'ANY BOX ON PURPOSE'

describe('a robot asks for a box by name, not by where it sits', () => {
  const specs = readdirSync(DIR).filter(f => f.endsWith('.spec.ts'))

  it('there are specs to check', () => {
    expect(specs.length).toBeGreaterThan(0)
  })

  for (const f of specs) {
    it(f, () => {
      const lines = readFileSync(join(DIR, f), 'utf8').split('\n')
      const caught = lines
        .map((line, i) => ({ line: line.trim(), n: i + 1 }))
        .filter(x => BY_POSITION.test(x.line)
          && !x.line.includes(ON_PURPOSE)
          && !(lines[x.n - 2] || '').includes(ON_PURPOSE))
        .map(x => `  line ${x.n}: ${x.line}`)

      expect(caught, `${f} picks a control by position. A box that moves will\n`
        + `silently hand this test a different box - which is exactly how\n`
        + `two-people.spec.ts ended up typing into Purpose of loan.\n`
        + `Use getByLabel, getByRole or getByPlaceholder instead.\n`
        + caught.join('\n')).toEqual([])
    })
  }
})
