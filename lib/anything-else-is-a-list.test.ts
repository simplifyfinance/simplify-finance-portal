import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { anythingElseItems } from './anything-else'

// KYLIE'S THREE REQUIREMENTS, PRINTED AS ONE SENTENCE.
//
// 22 Oct 2026, on a construction pre-approval. She typed three things into
// "Anything else", separated by blank lines. The email put all three behind one
// tick with the blank lines stripped, so "ordered" ran into "The valuation" and
// "Moore Creek" ran into "Friendly reminder".
//
// Her words, as typed, are the fixture below. If this ever passes them through
// as one item again, that is the bug coming back.
const KYLIE = `Fixed Price Build Contract - to include building plans and specifications (signed and dated). This is so that a full 'as if complete valuation' can be ordered

The valuation will need to support the rental that we have estimated for Moore Creek

Friendly reminder that any contribution that needs to be made by you will be required to be paid to the builder first (with receipts to be provided) before Orde will draw down the construction loan`

describe('anything else is a list, not a paragraph', () => {
  it('gives Kylie three items', () => {
    const out = anythingElseItems(KYLIE)
    expect(out).toHaveLength(3)
    expect(out[0]).toMatch(/^Fixed Price Build Contract/)
    expect(out[1]).toBe('The valuation will need to support the rental that we have estimated for Moore Creek')
    expect(out[2]).toMatch(/^Friendly reminder/)
    // And nothing runs into the next one.
    expect(out[0]).not.toContain('The valuation')
    expect(out[1]).not.toContain('Friendly reminder')
  })

  it('keeps a requirement that wraps over lines whole', () => {
    // THE REASON IT IS NOT EVERY LINE BREAK. A long requirement is typed across
    // several lines all the time; splitting on each one would have cut Kylie's
    // first item into three and made it worse than it was.
    expect(anythingElseItems('One requirement\nthat runs over\nthree lines'))
      .toEqual(['One requirement that runs over three lines'])
  })

  it('takes a dash off a line somebody bulleted themselves', () => {
    // The list is already ticked. A tick and a dash on one line reads as a typo.
    expect(anythingElseItems('- First thing\n\n* Second thing\n\n• Third thing'))
      .toEqual(['First thing', 'Second thing', 'Third thing'])
  })

  it('says nothing when nothing was typed', () => {
    expect(anythingElseItems('')).toEqual([])
    expect(anythingElseItems(null)).toEqual([])
    expect(anythingElseItems('   \n\n   \n')).toEqual([])
  })

  it('handles the line endings Outlook pastes in', () => {
    expect(anythingElseItems('One\r\n\r\nTwo')).toEqual(['One', 'Two'])
  })
})

describe('every email with an Anything else box uses it', () => {
  // THE LIST. Three emails carry the box and all three had the same fault. A
  // fourth written the old way fails here rather than in front of a client.
  const FILES = [
    'lib/preapproval-email.ts',
    'lib/formal-approval-email.ts',
    'lib/offer-accepted-email.ts',
  ]

  it('reads the rule rather than pushing the whole box', () => {
    for (const f of FILES) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} does not split Anything else`).toContain('anythingElseItems(ctx.extra)')
      expect(src, `${f} still pushes the whole box as one item`)
        .not.toMatch(/if \(extra\) (needs|theirs)\.push\(extra\)/)
    }
  })
})

describe('the ANZ assessment email files itself too', () => {
  it('carries the deal’s code on the link', () => {
    const src = readFileSync('lib/anz-assessment.ts', 'utf8')
    expect(src).toContain('bccForDeal')
    expect(src).toContain('bcc=')
  })
})
