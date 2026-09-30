import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { pdfSafe, encodable, droppedFrom } from './pdf-text'

// ONE PASTED CHARACTER DESTROYED A CLIENT'S PAPERWORK.
//
// 30 Sep 2026, Lucy Ilbery & Andrew Leigh: the Fact Find PDF would not build at
// all - "WinAnsi cannot encode \\uE113". A private-use character had arrived in
// the internal notes with a paste and showed on screen as an empty box. The PDF
// uses Helvetica, pdf-lib threw, and there was no document.
//
// Dropping a character beats throwing. A document missing a decoration is a
// document; a document that will not build is a phone call.

describe('a name survives as a name', () => {
  it('leaves alone anything the font can already set', () => {
    expect(pdfSafe('Valério')).toBe('Valério')
    expect(pdfSafe('Renée Müller-Ferreira')).toBe('Renée Müller-Ferreira')
    expect(pdfSafe('Ilbery & Leigh — 32A Rayner Ave')).toBe('Ilbery & Leigh — 32A Rayner Ave')
    expect(pdfSafe('“quoted” ‘words’ • €1,000')).toBe('“quoted” ‘words’ • €1,000')
  })

  // ONE CHARACTER AT A TIME, not the whole word. Dvorak's a-acute is in
  // Latin-1 and stays exactly as typed; only the r-caron, which the font does
  // not have, is flattened. Stripping accents wholesale would mangle names the
  // font could have set perfectly.
  it('flattens only the character the font does not have', () => {
    expect(pdfSafe('Dvořák')).toBe('Dvorák')
    expect(pdfSafe('Łukasz')).toBe('Lukasz')
    expect(pdfSafe('Nguyễn')).toBe('Nguyen')
    // A stroke is not an accent - nothing decomposes it, and this used to lose
    // the first letter of the name entirely.
    expect(pdfSafe('Đặng')).toBe('Dang')
    // A stroke is not an accent - nothing decomposes it, and this used to lose
    // the first letter of the name entirely.
    expect(pdfSafe('Đặng')).toBe('Dang')
  })

  // THE ONE THAT BROKE IT.
  it('drops what has no letter behind it at all', () => {
    expect(pdfSafe(' Against New OO purchase')).toBe(' Against New OO purchase')
    expect(pdfSafe('Deposit bond 🏠 arranged')).toBe('Deposit bond  arranged')
    expect(pdfSafe('注意 check this')).toBe(' check this')
  })

  it('and the rest of the line is untouched by one bad character', () => {
    const notes = 'Inheritance from his mums estate:\n $800K sale of property — auction 19/9/26'
    expect(pdfSafe(notes)).toContain('$800K sale of property — auction 19/9/26')
    expect(pdfSafe(notes)).toContain('Inheritance from his mums estate')
  })

  it('survives nothing at all', () => {
    expect(pdfSafe('')).toBe('')
    expect(pdfSafe(null)).toBe('')
    expect(pdfSafe(undefined)).toBe('')
    expect(pdfSafe(42)).toBe('42')
  })

  it('keeps the line breaks the layout depends on', () => {
    expect(pdfSafe('one\ntwo\r\nthree\tfour')).toBe('one\ntwo\r\nthree\tfour')
  })

  it('knows what the font has', () => {
    expect(encodable('é')).toBe(true)
    expect(encodable('—')).toBe(true)
    expect(encodable('€')).toBe(true)
    expect(encodable('')).toBe(false)
    expect(encodable('ř')).toBe(false)
  })

  it('can say what it dropped, for anybody who asks why', () => {
    expect(droppedFrom(' hello 🏠')).toEqual(['U+E113', 'U+1F3E0'])
    expect(droppedFrom('Dvořák')).toEqual([])
    expect(droppedFrom('plain text')).toEqual([])
  })
})

describe('nothing reaches the page unguarded', () => {
  const draw = readFileSync('lib/form-pdf.ts', 'utf8')

  // THE GUARD IS AT THE DRAWING LAYER on purpose. Several content files feed
  // text in from places people type; putting it in one of them would leave the
  // next one free to break the same way.
  it('every draw and every form box goes through pdfSafe', () => {
    for (const call of draw.match(/(drawText|setText)\(([^\n]*)/g) || []) {
      expect(call, `${call.slice(0, 60)} does not go through pdfSafe`).toContain('pdfSafe(')
    }
  })

  it('and there is at least one of each, so this is testing something', () => {
    expect((draw.match(/drawText\(/g) || []).length).toBeGreaterThanOrEqual(4)
    expect((draw.match(/setText\(/g) || []).length).toBeGreaterThanOrEqual(1)
  })
})
