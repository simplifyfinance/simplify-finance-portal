import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { isBeingDischarged } from './security-figures'
import { LIABILITY_STATUSES } from './fact-find-options'

// A PROPERTY LOAN DOES NOT SAY "TO BE REFINANCED".
//
// The fact find asks two different questions with two different vocabularies.
//
//   a liability     Remain open / To be closed / To be consolidated / Limit to be reduced
//   a property loan Ongoing / Refinance / To be paid out
//
// Six libraries were reading PROPERTY loans with the LIABILITY words. So
// `status === 'To be refinanced'` on a property loan matched nothing at all -
// "To be refinanced" is not on that dropdown and never was.
//
// Not the kind of fault that shows up as a wrong number. It shows up as a loan
// quietly absent from a total, from a security box, from the documents the
// portal asks a client for, and from the facts the model is handed. Every one
// of them looked like a deal with nothing being refinanced.
//
// So the question is asked once, in lib/security-figures.ts, and the six ask
// it rather than restating it with the wrong words.

describe('ONE QUESTION, BOTH VOCABULARIES', () => {
  it('the property dropdown’s own words', () => {
    expect(isBeingDischarged('Refinance')).toBe(true)
    expect(isBeingDischarged('To be paid out')).toBe(true)
    expect(isBeingDischarged('Ongoing')).toBe(false)
  })

  it('AND THE LIABILITY WORDS, so fixing one did not break the other', () => {
    expect(isBeingDischarged('To be consolidated')).toBe(true)
    expect(isBeingDischarged('To be refinanced')).toBe(true)
    expect(isBeingDischarged('Remain open')).toBe(false)
    expect(isBeingDischarged('To be closed')).toBe(false)
    expect(isBeingDischarged('Limit to be reduced')).toBe(false)
  })

  it('and nothing, which is a loan nobody has answered for', () => {
    expect(isBeingDischarged('')).toBe(false)
    expect(isBeingDischarged(null)).toBe(false)
    expect(isBeingDischarged(undefined)).toBe(false)
  })

  it('AND IT DOES NOT CARE ABOUT CAPITALS OR SPACES', () => {
    expect(isBeingDischarged('  refinance  ')).toBe(true)
    expect(isBeingDischarged('REFINANCE')).toBe(true)
  })

  it('and every liability status is still answered one way or the other', () => {
    // A status this question has no opinion on is a status that silently
    // means "staying", which is how the first version of this went wrong.
    for (const s of LIABILITY_STATUSES) {
      expect(typeof isBeingDischarged(s), `${s} is unanswered`).toBe('boolean')
    }
  })
})

describe('AND THE SIX ASK IT RATHER THAN GUESSING', () => {
  const FILES = [
    'lib/funds-to-complete.ts',
    'lib/box-security.ts',
    'lib/document-rules.ts',
    'lib/deal-facts.ts',
    'lib/position-after-settlement.ts',
  ]

  it.each(FILES)('%s', (f) => {
    const src = readFileSync(f, 'utf8')
    expect(src, `${f} does not ask isBeingDischarged`).toContain('isBeingDischarged(')
  })

  it('AND NONE OF THEM DECIDES ON THE LIABILITY WORDS ANY MORE', () => {
    for (const f of FILES) {
      const src = readFileSync(f, 'utf8')
      // The words may still appear - position-after-settlement exports the old
      // list for other callers, and a comment explaining the history is worth
      // keeping. What must not come back is a DECISION made with them.
      expect(src, `${f} still filters on the liability words`)
        .not.toContain(".includes(txt(l?.status))")
      expect(src, `${f} still compares a property loan to the wrong word`)
        .not.toContain("txt(l?.status) === 'To be refinanced'")
    }
  })

  it('and the badge colours still know both, because a badge is not a decision', () => {
    // lib/property-checklist.ts colours whatever word a deal is carrying.
    const src = readFileSync('lib/property-checklist.ts', 'utf8')
    expect(src).toContain("'To be refinanced'")
    expect(src).toContain("'To be paid out'")
  })
})
