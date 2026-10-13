import { describe, it, expect } from 'vitest'
import {
  splitIntoSections, detectStyle, searchTextFor, citeSection, MAX_CHARS,
} from './split-into-sections'

// THE AFTERNOON THIS FILE EXISTS BECAUSE OF.
//
// 13 Oct 2026. Macquarie's credit guidelines were uploaded, hashed and sitting
// in the bucket, complete. Paco could not read one line of them, because one
// model call tried to carve the whole document into hundreds of rules, ran out
// of room, and every rule came back inside truncated JSON that would not parse.
//
// Fabio, at the end of it: "if I cant build a simple file where each banks
// informatiomn is there and can be searcehd what hope do i have".
//
// The splitter is the answer, and it only works if it is boring. No model, no
// network, no cleverness - the same text gives the same sections every time,
// and the worst case is one section holding everything rather than nothing at
// all. These tests hold that shut.

const lines = (...l: string[]) => l.join('\n')

describe('it never, ever returns nothing', () => {
  // THIS IS THE WHOLE POINT OF THE FILE. Everything else is a nicety. A
  // document we can read badly is worth more than a document we cannot read,
  // because the second one is what cost an afternoon.
  const awful: [string, string][] = [
    ['an empty string', ''],
    ['only whitespace', '   \n\n\t  \n '],
    ['a single word', 'Hello'],
    ['prose with no headings at all', 'Lorem ipsum dolor sit amet. '.repeat(400)],
    ['headings with nothing under them', '# A\n# B\n# C\n'],
    ['one paragraph longer than the cap', 'x'.repeat(MAX_CHARS * 2 + 11)],
    ['windows line endings', '# One\r\nbody one\r\n# Two\r\nbody two\r\n'],
    ['non breaking spaces', '# Heading one\nbody text'],
  ]

  for (const [what, text] of awful) {
    it(`gives back at least one titled section for ${what}`, () => {
      const secs = splitIntoSections(text, 'Dropped file')
      expect(secs.length, 'a document must never vanish').toBeGreaterThan(0)
      for (const s of secs) {
        // A section with no title cannot be cited, and an uncitable quote is
        // one we will not put in front of a credit assessor.
        expect(s.title.trim().length, 'every section must be citable').toBeGreaterThan(0)
      }
    })
  }

  it('keeps every character of a document it cannot split', () => {
    const body = 'No headings here. '.repeat(50).trim()
    const secs = splitIntoSections(body, 'Policy')
    expect(secs).toHaveLength(1)
    expect(secs[0].body).toBe(body)
    expect(secs[0].title).toBe('Policy')
  })

  it('cuts one enormous section rather than dropping it', () => {
    const huge = 'y'.repeat(MAX_CHARS * 3)
    const secs = splitIntoSections(`# Big\n\n${huge}`, 'Policy')
    expect(secs.length).toBeGreaterThan(1)
    expect(secs.reduce((n, s) => n + s.chars, 0)).toBe(huge.length)
    // And it says so, because a third of a section shown as the whole section
    // is a citation that reads as complete and is not.
    expect(secs[0].part).toBe(`1 of ${secs.length}`)
    expect(citeSection(secs[0], 'NAB', 'Policy')).toContain('part 1 of')
  })
})

describe('it splits on the headings the lender already wrote', () => {
  it('reads markdown, the way the NAB chapters arrived', () => {
    const doc = lines(
      '# 10.0 Income', 'Chapter opener.',
      '## 10.2 PAYG Income', 'The PAYG rules.',
      '### 10.2.1 Full time employment', 'Full time only.',
    )
    expect(detectStyle(doc)).toBe('markdown')
    const secs = splitIntoSections(doc, 'Chapter 10')
    expect(secs.map(s => s.number)).toEqual(['10.0', '10.2', '10.2.1'])
    expect(secs[2].title).toBe('Full time employment')
    expect(secs[2].body).toBe('Full time only.')
  })

  it('reads the markers we add to a pasted document', () => {
    const doc = lines(
      '@@1A. Loan Purpose', 'What the money is for.',
      '@@1A. Equity release and cash out', 'Up to 80% LVR there is no cap.',
    )
    expect(detectStyle(doc)).toBe('marker')
    const secs = splitIntoSections(doc, 'Credit Guidelines')
    expect(secs).toHaveLength(2)
    expect(secs[1].number).toBe('1A')
    expect(secs[1].title).toBe('Equity release and cash out')
  })

  it('reads bare numbered headings', () => {
    const doc = lines(
      '4.1 Residency', 'Who may borrow.',
      '4.2 Foreign Applicants', 'And who may not.',
      '4.3 Guarantors', 'Parents, mostly.',
    )
    expect(detectStyle(doc)).toBe('numbered')
    expect(splitIntoSections(doc, 'Policy')).toHaveLength(3)
  })

  // PROSE IS NOT A HEADING, and this one is real. Macquarie's self-employed
  // section opens with "1. In an upward trend a maximum income to be used is
  // 120% of the previous year..." - a numbered line, 30 words long, ending in
  // a full stop. Treating it as a heading cuts a rule in half, and half a rule
  // about income shading is worse than no rule at all.
  it('does not mistake numbered prose for a heading', () => {
    const doc = lines(
      '@@3C. Income, Self-Employed', 'How it is assessed:',
      '1. In an upward trend a maximum income to be used is 120% of the previous year, not exceeding the highest year.',
      '2. In a downward trend the income to be used is the most recent year.',
    )
    const secs = splitIntoSections(doc, 'Credit Guidelines')
    expect(secs, 'the numbered list is part of the rule, not three rules').toHaveLength(1)
    expect(secs[0].body).toContain('upward trend')
    expect(secs[0].body).toContain('downward trend')
  })

  it('keeps the words before the first heading, under the document name', () => {
    const doc = lines('Version 14.1, last updated 10 September 2026.', '@@1A. Loan Purpose', 'Body.')
    const secs = splitIntoSections(doc, 'Credit Guidelines v14.1')
    expect(secs[0].title).toBe('Credit Guidelines v14.1')
    expect(secs[0].body).toContain('Version 14.1')
  })

  it('does not mix two conventions in one document', () => {
    // Markdown headings AND shouted lines. Splitting on both cuts mid-rule.
    const doc = lines(
      '# 1.0 Security', 'IMPORTANT NOTICE APPLIES HERE', 'and the rule continues.',
      '# 2.0 Valuations', 'More.',
    )
    expect(detectStyle(doc)).toBe('markdown')
    const secs = splitIntoSections(doc, 'Policy')
    expect(secs).toHaveLength(2)
    expect(secs[0].body).toContain('IMPORTANT NOTICE')
  })
})

describe('a sub-section knows what it sits under', () => {
  it('builds the parent path from the numbering', () => {
    const doc = lines(
      '## 10.2 PAYG Income', 'Opener.',
      '### 10.2.1 Allowances', 'How allowances are treated.',
    )
    const secs = splitIntoSections(doc, 'Chapter 10')
    expect(secs[1].path).toBe('10.2 PAYG Income > 10.2.1 Allowances')
  })

  // THE BUG THIS TEST EXISTS FOR, found by running the splitter over the real
  // NAB chapters before any of it was wired up. NAB writes "11.5 Repayment at
  // retirement" as a bare heading with no words under it, then puts the body in
  // "11.5.1" underneath. An empty heading is not a section - but it IS
  // structure, and dropping it too early filed 11.5.1 under 11.4. The parent's
  // name goes into the search text, so a search for mature age found the wrong
  // chapter entirely.
  it('counts an empty heading as a parent even though it is not a section', () => {
    const doc = lines(
      '## 11.4 Loan repayments', 'Existing home loan debt.',
      '## 11.5 Repayment at retirement',
      '### 11.5.1 Mature age borrowers', 'Must show an exit strategy.',
    )
    const secs = splitIntoSections(doc, 'Chapter 11')
    expect(secs, 'the empty heading is not itself a section').toHaveLength(2)
    expect(secs[1].path).toContain('11.5 Repayment at retirement')
    expect(secs[1].path, 'it must not be filed under 11.4').not.toContain('11.4')
  })

  it('pops back out when the numbering goes back up a level', () => {
    const doc = lines(
      '## 10.2 PAYG', 'a',
      '### 10.2.1 Allowances', 'b',
      '## 10.3 Casual', 'c',
    )
    const secs = splitIntoSections(doc, 'Chapter 10')
    expect(secs[2].path).toBe('10.3 Casual')
  })
})

describe('what goes into the index, and what comes out as a citation', () => {
  // "Maximum LVR is 90%" indexed on its own is nearly useless - 90% for what,
  // at which lender? Both briefs say a model should write this context line.
  // It does not need one: the lender, the document and the path say it exactly,
  // for nothing, with no call that can fail halfway.
  it('the search text names the lender and the document', () => {
    const [s] = splitIntoSections('@@1D. Maximum LVR\nUp to 90% with LMI.', 'Credit Guidelines')
    const text = searchTextFor(s, 'Macquarie', 'Credit Guidelines v14.1')
    expect(text).toContain('Macquarie')
    expect(text).toContain('Credit Guidelines v14.1')
    expect(text).toContain('Maximum LVR')
    expect(text, 'the words themselves still have to be in there').toContain('Up to 90% with LMI.')
  })

  it('the citation reads the way a broker would say it', () => {
    const [s] = splitIntoSections('@@1A. Equity release and cash out\nNo cap under 80%.', 'Guidelines')
    expect(citeSection(s, 'Macquarie', 'Credit Guidelines v14.1'))
      .toBe('Macquarie — Credit Guidelines v14.1 — 1A Equity release and cash out')
  })
})

describe('it is boring on purpose', () => {
  it('gives the same answer twice', () => {
    const doc = lines('# 1.0 A', 'one', '## 1.1 B', 'two')
    expect(splitIntoSections(doc, 'P')).toEqual(splitIntoSections(doc, 'P'))
  })

  it('calls nothing and fetches nothing', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync('lib/split-into-sections.ts', 'utf8'))
    for (const banned of ['fetch(', 'anthropic', 'Anthropic', 'supabase', 'process.env']) {
      expect(src, `the splitter must stay a function of the text alone (${banned})`)
        .not.toContain(banned)
    }
  })

  it('numbers its sections from one, in the document order', () => {
    const secs = splitIntoSections(lines('# A', 'a', '# B', 'b', '# C', 'c'), 'P')
    expect(secs.map(s => s.ordinal)).toEqual([1, 2, 3])
  })
})
