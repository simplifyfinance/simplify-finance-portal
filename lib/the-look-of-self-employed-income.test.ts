import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'

// THE SCREEN AGAINST THE MOCK IT WAS AGREED FROM.
//
// 22 Nov 2026. Six mocks, all signed off before a line of the screen existed.
// Fabio, after the commission splits went out looking nothing like the drawing:
// "see another example that the mock and reality are COMPLETELY DIFFERENT.
// Fix this - this needs to stop."
//
// So the mocks are in the repo, this reads them off disk, and every promise
// made in a drawing is checked against the thing that was built. A mock that
// is deleted or renamed fails here rather than quietly stopping being the
// specification.

const LOOKS = 'docs/approved-looks'
const MOCKS = [
  'self-employed-income.html',    // the whole flow: drop, documents, add-backs, the four
  'se-the-four-ways.html',        // the comparison, up year and down year
  'se-in-the-income-tab.html',    // how it sits in the real Income tab
  'se-guide-the-team.html',       // the routes, their limits, and the stops
  'se-simple-and-complex.html',   // what each column writes
  'se-using-this.html',           // before pressing, after, and once it has gone out
]

// THE MOCKS ARE HTML AND THE SCREEN IS NOT.
//
// A mock writes &mdash; where the code writes an em dash, and &rsquo; where the
// code writes an apostrophe. Comparing the raw text would fail on the encoding
// rather than on the words, which would teach everybody to ignore this file.
// So both sides are read as what a person sees.
const words = (html: string) => html
  .replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013')
  .replace(/&rsquo;/g, '\u2019').replace(/&lsquo;/g, '\u2018')
  .replace(/&ldquo;/g, '\u201c').replace(/&rdquo;/g, '\u201d')
  .replace(/&middot;/g, '\u00b7').replace(/&amp;/g, '&')

const mock = (name: string) => words(readFileSync(`${LOOKS}/${name}`, 'utf8'))

const SCREEN = readFileSync('components/SelfEmployedFromReturns.tsx', 'utf8')
const RULES  = readFileSync('lib/tax-documents.ts', 'utf8')
const FORM   = readFileSync('app/(app)/deals/[id]/FactFindForm.tsx', 'utf8')

describe('the mocks are still here', () => {
  for (const m of MOCKS) {
    it(m, () => {
      expect(existsSync(`${LOOKS}/${m}`), `${m} is gone from ${LOOKS}`).toBe(true)
      expect(readFileSync(`${LOOKS}/${m}`, 'utf8').length).toBeGreaterThan(1000)
    })
  }
})

// ---------------------------------------------------------------------------
// THE ROUTE QUESTION, AND ITS LIMITS
// ---------------------------------------------------------------------------
//
// Fabio: "SIMPLE ONLY read company and individual, doesnt read trust, multiple
// entities etc - so we need to GUIDE my team." The limits are on the card, not
// in a note somewhere.
describe('the two routes say what they do and do not do', () => {
  const MOCK = mock('se-guide-the-team.html')

  it('both routes are offered by name', () => {
    for (const t of ['Simple — read the returns', 'Complex — do it by hand']) {
      expect(MOCK, `${t} is not in the mock`).toContain(t)
      expect(SCREEN, `${t} is not on the screen`).toContain(t)
    }
  })

  it('simple lists what it reads', () => {
    for (const t of ['Individual tax returns', 'One company', 'Two financial years']) {
      expect(SCREEN).toContain(t)
    }
  })

  it('and lists what it refuses, which is the point', () => {
    for (const t of ['Trusts', 'Partnerships', 'More than one business']) {
      expect(SCREEN, `${t} is not named as a limit`).toContain(t)
    }
  })

  it('complex names the cases it is for', () => {
    for (const t of ['Low doc', 'Director’s salary only', 'Trusts and partnerships']) {
      expect(SCREEN).toContain(t)
    }
  })
})

// ---------------------------------------------------------------------------
// THE STOP
// ---------------------------------------------------------------------------
describe('it stops rather than half-reading a deal', () => {
  const MOCK = mock('se-guide-the-team.html')

  it('the band says the same thing the mock says', () => {
    expect(MOCK).toContain('This one needs the complex route')
    expect(RULES).toContain('This one needs the complex route')
  })

  it('and offers both ways out', () => {
    expect(SCREEN).toContain('Switch to complex')
    expect(RULES).toContain('Remove the')
    expect(RULES).toContain('only')
  })

  it('what it did read is kept on screen, so nothing is typed twice', () => {
    expect(SCREEN).toContain('Documents')
    expect(SCREEN).toContain('not read')
  })
})

// ---------------------------------------------------------------------------
// THE COMPARISON
// ---------------------------------------------------------------------------
describe('the comparison is drawn the way it was agreed', () => {
  const MOCK = mock('se-the-four-ways.html')

  it('two header bands, in both', () => {
    for (const t of ['As read off the documents', 'What you could use']) {
      expect(MOCK).toContain(t)
      expect(SCREEN).toContain(t)
    }
  })

  it('every column offers Use this, and none is chosen for you', () => {
    expect(SCREEN).toContain("'Using this' : 'Use this'")
    expect(SCREEN, 'nothing may be preselected').not.toContain('defaultColumn')
  })

  it('what was left out is said under the table', () => {
    expect(MOCK).toContain('Not shown:')
    expect(SCREEN).toContain('Not shown:')
  })

  // HIS CORRECTION, 22 NOV. The growth percentage is ours, not a lender's.
  it('the growth percentage is editable, on the column that uses it', () => {
    expect(SCREEN).toContain("c.id === 'previous_plus_growth'")
    expect(SCREEN).toContain('onPct')
    expect(SCREEN, 'this is not a lender setting')
      .not.toContain('lender_rules')
  })
})

// ---------------------------------------------------------------------------
// WHAT IT WRITES
// ---------------------------------------------------------------------------
//
// The part that matters for compliance. seAssessmentMethod is read in eight
// places including the compliance notes.
describe('it writes the fields compliance already reads', () => {
  const MOCK = mock('se-simple-and-complex.html')

  it('the mock promised these three, and the code writes them', () => {
    for (const f of ['seAssessmentMethod', 'seGrowthMethod', 'seGrowthPercentOption']) {
      expect(MOCK, `${f} is not in the mock`).toContain(f)
    }
    const RULES2 = readFileSync('lib/se-comparison.ts', 'utf8')
    for (const f of ['seAssessmentMethod', 'seGrowthMethod', 'seGrowthPercentOption']) {
      expect(RULES2).toContain(f)
    }
  })

  it('and the figures go in the year boxes that already exist', () => {
    expect(SCREEN).toContain('seYear1')
    expect(SCREEN).toContain('seYear2')
  })

  // THE DROPDOWN DOES NOT GO. Fabio: "we need the dropdown because thats the
  // income used in compliance right??? (double check code)" - it is, in eight
  // files, so it stays.
  it('the Assessment method dropdown is still on the form', () => {
    expect(FORM).toContain('Assessment method')
    for (const m of ['Last 2 financial years', 'One year in isolation',
                     "Director's salary", 'Low doc — BAS']) {
      expect(FORM, `${m} has gone from the dropdown`).toContain(m)
    }
  })

  it('and the complex route is the form, untouched', () => {
    expect(SCREEN).toContain("inc.seRoute === 'complex'")
    expect(SCREEN).toContain('return null')
  })
})

// ---------------------------------------------------------------------------
// THE SIZE PROBLEM IS ALREADY SOLVED
// ---------------------------------------------------------------------------
describe('a full set of financials is not too big to send', () => {
  it('it goes through the reading room, like the loan contracts', () => {
    expect(SCREEN).toContain('sendToBeRead(file)')
    expect(SCREEN).toContain('readAnswer(res)')
    const ROUTE = readFileSync('app/api/read-tax-document/route.ts', 'utf8')
    expect(ROUTE).toContain('documentFrom(')
    expect(ROUTE).toContain('ReadingRoomError')
  })

  it('and the reader never invents a year', () => {
    const ROUTE = readFileSync('app/api/read-tax-document/route.ts', 'utf8')
    expect(ROUTE).toContain('DO NOT GUESS OR INVENT ANY VALUE')
    expect(ROUTE).toContain('leave fy empty rather than guessing')
  })

  it('and never adds anything back by itself', () => {
    const ROUTE = readFileSync('app/api/read-tax-document/route.ts', 'utf8')
    expect(ROUTE).toContain('DO NOT add anything back')
  })
})
