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

// AND COUNTING ALONG A LIST THAT WAS NARROWED BY NAME IS STILL COUNTING.
//
// 6 Oct 2026, and this one got past the rule above and cost a ship:
//
//     page.getByRole('button', { name: /Write from the deal/i }).nth(1)
//
// Asking by name and then taking the SECOND one is not asking by name. It was
// right while Compliance showed one section at a time - three boxes, three
// buttons - and it became wrong the day Compliance became one page, because the
// same button now appears NINE times. Nothing failed at the moment it became
// wrong. It failed weeks later, on a ship that had changed some colours.
//
// .first() is still allowed. Taking THE one of a kind is a real question, and
// two-people.spec.ts leans on it on purpose. .nth() and .last() are not: they
// are a position wearing a name. Walk forward from the field instead -
//
//     field.locator('xpath=following::button[contains(., "...")][1]')
//
// which is what every other box in boxone.spec.ts already does.
const COUNTING_BY_NAME = /get(ByRole|ByLabel|ByPlaceholder|ByText)\([\s\S]{0,160}?\.\s*(nth|last)\(/

describe('a robot asks for a box by name, not by where it sits', () => {
  const specs = readdirSync(DIR).filter(f => f.endsWith('.spec.ts'))

  it('there are specs to check', () => {
    expect(specs.length).toBeGreaterThan(0)
  })

  for (const f of specs) {
    it(f, () => {
      const lines = readFileSync(join(DIR, f), 'utf8').split('\n')
      const caught = lines
        // A chain can be wrapped over several lines, so the second rule reads
        // this line plus any that CONTINUE it - a continuation starts with a
        // dot. It must not read the next statement: joining two unrelated
        // lines is how a guard starts failing honest code, which this one did
        // within a minute of being written.
        .map((line, i) => {
          let window = line
          for (let j = i + 1; j < lines.length && /^\s*\./.test(lines[j]); j++) window += '\n' + lines[j]
          return { line: line.trim(), n: i + 1, window }
        })
        .filter(x => (BY_POSITION.test(x.line) || COUNTING_BY_NAME.test(x.window))
          && !x.window.includes(ON_PURPOSE)
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
