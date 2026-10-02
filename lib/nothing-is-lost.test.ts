import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { FORM_FILES, PAGE_FILES, countWords, readFormWords, wordsIn, type FormWords } from './what-the-forms-say'

// NOTHING IS LOST.
//
// 2 Oct 2026. The deal page is about to be rearranged - four strips move to a
// rail, two prompts become one line, four sub-navigations become one. Every one
// of those is meant to move things WITHOUT removing anything, and the promise is
// worth exactly as much as the thing that checks it.
//
// So this holds the five forms against a locked list of every word on them. A
// ship that quietly drops a field, a dropdown option, a button or a section
// heading fails here and names what went.
//
// ONE DIRECTION ONLY. Adding is free and needs no edit to the snapshot - the
// portal gains fields every week. Removing requires editing
// lib/nothing-is-lost.snapshot.json by hand, which shows up in the diff and in
// the ship output, where a person can see it and say yes or no.
//
// The snapshot was taken on 2 Oct 2026, before any of the rearranging ships.

const SNAPSHOT = 'lib/nothing-is-lost.snapshot.json'

const locked: FormWords = JSON.parse(readFileSync(SNAPSHOT, 'utf8'))
const now = readFormWords()

describe('the snapshot itself is real', () => {
  it('exists and covers every form', () => {
    expect(existsSync(SNAPSHOT)).toBe(true)
    expect(Object.keys(locked).sort()).toEqual([...FORM_FILES].sort())
  })

  it('holds the whole Fact Find, not a sample of it', () => {
    // 174 the day it was taken. If this ever drops below 150 somebody has
    // regenerated the snapshot against a broken extractor rather than fixing
    // the code - which would turn this whole file into decoration.
    expect(locked['app/(app)/deals/[id]/FactFindForm.tsx'].length).toBeGreaterThan(150)
    expect(countWords(locked)).toBeGreaterThan(330)
  })

  it('and the forms it points at are still there', () => {
    for (const f of FORM_FILES) expect(existsSync(f), `${f} is gone`).toBe(true)
  })
})

describe('every word that was on the forms is still on them', () => {
  // THE TEST THAT MATTERS. One per file, so a failure names the form as well as
  // the field.
  for (const file of FORM_FILES) {
    it(file.split('/').pop()!, () => {
      const have = new Set(now[file] || [])
      const gone = (locked[file] || []).filter(w => !have.has(w))
      expect(gone, gone.length
        ? `${gone.length} thing${gone.length === 1 ? '' : 's'} a person could read on ${file} ${gone.length === 1 ? 'is' : 'are'} no longer there:\n  ` + gone.join('\n  ')
        : '').toEqual([])
    })
  }

  it('and the whole set has not shrunk', () => {
    expect(countWords(now)).toBeGreaterThanOrEqual(countWords(locked))
  })
})

describe('the extractor is not quietly broken', () => {
  // A snapshot test passes beautifully when the thing doing the reading has
  // stopped reading. These prove it still finds each kind of thing.
  it('finds a label, a placeholder, an option, a button and a heading', () => {
    const sample = `
      <label className="x">First name</label>
      <input placeholder="you@example.com" />
      <select><option value="a">Australian citizen</option></select>
      <button onClick={go}>Add previous address</button>
      <div className="h">PURPOSE AND GOALS</div>`
    const w = wordsIn(sample)
    for (const want of ['First name', 'you@example.com', 'Australian citizen',
                        'Add previous address', 'PURPOSE AND GOALS']) {
      expect(w, `the extractor stopped finding "${want}"`).toContain(want)
    }
  })

  it('and really does notice when one goes', () => {
    const before = wordsIn('<label>Rent amount</label><label>Frequency</label>')
    const after = wordsIn('<label>Frequency</label>')
    expect(before).toContain('Rent amount')
    expect(after).not.toContain('Rent amount')
  })

  it('does not count braces and punctuation as words', () => {
    expect(wordsIn('<label>{value}</label><label>---</label>')).toEqual([])
  })
})

describe('the things Fabio checked by hand, by name', () => {
  // Spelled out because these are the exact ones a mock-up of mine dropped, and
  // a list of 174 is not something a person should have to read to be sure.
  const factFind = new Set(now['app/(app)/deals/[id]/FactFindForm.tsx'] || [])
  const MUST_BE_THERE = [
    'Where is the deposit coming from?',
    'Purpose of loan / primary reason for finance',
    'Goals — next 2 years',
    'Goals — 2 to 10 years',
    'Preferred name', 'Previous name', 'Middle name', 'Residency status',
    'Relationship status', 'Phone mobile', 'Date of birth',
    'Current address', 'Move-in date', 'Rent amount', 'Frequency',
  ]
  it.each(MUST_BE_THERE)('%s', (label) => {
    expect(factFind.has(label), `"${label}" is no longer on the Fact Find`).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AND THE PAGE AROUND THE TABS.
//
// The five forms were locked first. Fabio then spent an hour finding things I
// had dropped from the page OUTSIDE them - the stage bar, the prompt line, the
// Client emails menu, the Next action box, the cards in the rail. The forms
// test said nothing, because none of that is in a form.
//
// Same lock, same direction, different list of files.
const PAGE_SNAPSHOT = 'lib/nothing-is-lost.page.json'
const lockedPage: FormWords = JSON.parse(readFileSync(PAGE_SNAPSHOT, 'utf8'))
const pageNow = readFormWords(PAGE_FILES)

describe('every word on the deal page outside the tabs is still there', () => {
  it('the snapshot covers every file that draws the page', () => {
    expect(existsSync(PAGE_SNAPSHOT)).toBe(true)
    expect(Object.keys(lockedPage).sort()).toEqual([...PAGE_FILES].sort())
  })

  // A FILE THAT READS AS EMPTY IS THE EXTRACTOR BEING BLIND.
  //
  // AnzAssessmentEmail.tsx came back with zero words on the first run, because
  // its button is an <a> and nothing was looking at anchors. A snapshot of
  // nothing passes forever while the thing it guards rots.
  it.each(PAGE_FILES)('%s says something', (f) => {
    expect((pageNow[f] || []).length, `nothing was found in ${f} - the extractor has gone blind`)
      .toBeGreaterThan(0)
  })

  for (const file of PAGE_FILES) {
    it(file.split('/').pop()!, () => {
      const have = new Set(pageNow[file] || [])
      const gone = (lockedPage[file] || []).filter(w => !have.has(w))
      expect(gone, gone.length
        ? `${gone.length} thing${gone.length === 1 ? '' : 's'} a person could read on ${file} ${gone.length === 1 ? 'is' : 'are'} no longer there:\n  ` + gone.join('\n  ')
        : '').toEqual([])
    })
  }

  it('and the page as a whole has not shrunk', () => {
    expect(countWords(pageNow)).toBeGreaterThanOrEqual(countWords(lockedPage))
  })
})

describe('the things Fabio caught by hand on the page, by name', () => {
  // Each of these is something a mock-up of mine dropped and he found.
  const all = new Set(Object.values(pageNow).flat())
  const MUST_BE_THERE = [
    'Back to deals',
    'Make it a real deal',
    'Internal notes',
    'Email the assessment team',
    'Rebuild all three',
    'Request them',
    'Who is doing the borrowing capacity?',
    'Unlock the deal',
    'Close this deal',
    'Record these figures',
    'Mark as settled',
  ]
  it.each(MUST_BE_THERE)('%s', (label) => {
    expect(all.has(label), `"${label}" is no longer anywhere on the deal page`).toBe(true)
  })
})
