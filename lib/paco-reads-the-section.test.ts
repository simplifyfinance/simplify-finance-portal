import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { sectionAnswer, cleanSection, citeSection, THE_RULES } from './paco-reads-the-section'

// MEASURED, NOT IMAGINED.
//
// 14 Oct 2026. Before any of this went near the portal, the whole search was
// stood up on a real Postgres with the real schema, loaded with the real
// Macquarie guidelines through the real splitter - 56,999 characters, 25
// sections - and asked sixteen questions a broker would actually ask.
//
// Fourteen landed on the right section first. All sixteen were in the top two.
// The numbers in these tests are the ones that run came back with.

const row = (over: any = {}) => ({
  section_id: 's1', document_id: 'd1',
  number: '1A', title: 'Equity release and cash out',
  path: '1A Equity release and cash out', part: '',
  body: 'Up to 80% LVR: No limit is applicable to the equity release/cash out component.',
  tier: 'A', score: 0.0973, ...over,
})

describe('when every word matched', () => {
  const a = sectionAnswer([row()], false, 'Macquarie')

  it('the section is the answer', () => {
    expect(a.kind).toBe('answer')
    expect(a.sections).toHaveLength(1)
    expect(a.closest).toHaveLength(0)
  })

  it('and the lender is named in the line he leads with', () => {
    expect(a.says).toContain('Macquarie')
  })

  it('the words come back untouched, never summarised', () => {
    // A paraphrase with a section number beside it reads exactly like a
    // citation, and nobody checks a citation that looks complete.
    expect(a.sections[0].body).toBe(row().body)
  })
})

// THE CRYPTO CASE, AND IT IS THE IMPORTANT ONE.
//
// "crypto currency as a deposit" - the word crypto appears ZERO times in
// Macquarie's guidelines. The strict pass correctly finds nothing. The loose
// pass then matches "deposit" and returns Contributions and Genuine Savings,
// which is about something else entirely.
//
// Both implementation briefs call declining to answer the single
// highest-value behaviour to get right. A loosened result presented as an
// answer is the most convincing kind of wrong there is.
describe('when only some of the words matched', () => {
  const a = sectionAnswer([row({ title: 'Contributions and Genuine Savings', number: '2E' })],
                          true, 'Macquarie')

  it('it is NOT an answer', () => {
    expect(a.kind).toBe('closest')
    expect(a.sections, 'a loose match is being handed back as the answer').toHaveLength(0)
  })

  it('it is offered as the closest thing, and said to be', () => {
    expect(a.closest).toHaveLength(1)
    // It has to say the question was NOT matched, before it offers anything.
    expect(a.says).toContain('Nothing in')
    expect(a.says).toContain('matches all of that')
    expect(a.says.toLowerCase()).toContain('closest')
  })

  it('and it warns that it may not be about the question at all', () => {
    expect(a.says.toLowerCase()).toContain('may not be about your question')
  })
})

describe('when the words are not in the document at all', () => {
  const a = sectionAnswer([], false, 'Macquarie')

  it('says so plainly rather than reaching for something', () => {
    expect(a.kind).toBe('nothing')
    expect(a.sections).toHaveLength(0)
    expect(a.closest).toHaveLength(0)
  })

  it('and points at the one person who does know', () => {
    expect(a.says).toContain('BDM')
    expect(a.says, 'a dead end is not an answer either').toContain('tell me what they say')
  })

  it('works when the question named no lender', () => {
    expect(sectionAnswer([], false, '').says).toContain('policy')
  })
})

describe('a section that cannot be quoted is not shown', () => {
  it('drops one with no words in it', () => {
    expect(cleanSection(row({ body: '   ' }))).toBeNull()
  })

  it('drops one with no name, because it could not be cited', () => {
    expect(cleanSection(row({ title: '' }))).toBeNull()
  })

  it('and the answer skips them rather than falling over', () => {
    const a = sectionAnswer([row(), row({ body: '' })], false, 'Macquarie')
    expect(a.sections).toHaveLength(1)
  })
})

describe('the citation reads the way a broker would say it', () => {
  it('names the lender, the document and the section', () => {
    expect(citeSection(cleanSection(row())!, 'Macquarie', 'Credit Guidelines v14.1'))
      .toBe('Macquarie — Credit Guidelines v14.1 — 1A Equity release and cash out')
  })

  it('says when it is only part of a section', () => {
    // A third of a section shown as the whole is a citation that reads as
    // complete and is not.
    expect(citeSection(cleanSection(row({ part: '2 of 3' }))!, 'NAB', 'Policy'))
      .toContain('(part 2 of 3)')
  })

  it('falls back to the title where the lender did not number their sections', () => {
    expect(citeSection(cleanSection(row({ number: '' }))!, 'NAB', 'Policy'))
      .toContain('Equity release and cash out')
  })
})

describe('it decides nothing and fetches nothing', () => {
  const src = readFileSync('lib/paco-reads-the-section.ts', 'utf8')

  it('calls no model and no database', () => {
    for (const banned of ['fetch(', 'anthropic', 'Anthropic', 'supabase', 'rpc(']) {
      expect(src, `this file must stay a function of its rows (${banned})`).not.toContain(banned)
    }
  })

  it('and the rules it keeps are written down', () => {
    expect(THE_RULES).toContain('a loosened result is never presented as an answer')
    expect(THE_RULES.length).toBeGreaterThan(3)
  })
})

// AND THE SCREEN HAS TO HONOUR IT TOO.
//
// The rule is worthless if the logic says "this is only the closest" and the
// component then draws it in the blue band that means "this IS the policy".
describe('the screen tells the two apart', () => {
  const ui = readFileSync('components/Paco.tsx', 'utf8')
  const at = ui.indexOf('function Sections(')
  const block = ui.slice(at, ui.indexOf('function Policy(', at))

  it('draws the closest sections differently from an answer', () => {
    expect(at, 'the sections block has gone').toBeGreaterThan(-1)
    expect(block).toContain("const near = s.kind === 'closest'")
    // The blue "what the bank wrote" band is the one that means this IS the
    // policy. A loose match must never wear it.
    expect(block).toMatch(/near\s*\?[\s\S]{0,200}border-card-line/)
  })

  it('and labels them as the closest, not as what the bank wrote', () => {
    expect(block).toContain("{near ? 'Closest section' : 'What the bank wrote'}")
  })

  it('shows the section leading, above the older pre-chopped rules', () => {
    const sections = ui.indexOf('<Sections s=')
    const policy = ui.indexOf('<Policy p=')
    expect(sections).toBeGreaterThan(-1)
    expect(sections, 'the rules are being shown above the section').toBeLessThan(policy)
  })

  it('keeps the lender line breaks, so a table does not become a paragraph', () => {
    // Flattening a table into prose is how the shading percentage and the
    // verification period get swapped.
    expect(block).toContain('whitespace-pre-wrap')
  })
})
