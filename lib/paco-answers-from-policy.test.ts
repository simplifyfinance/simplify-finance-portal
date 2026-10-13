// PACO ANSWERS FROM THE LENDER'S OWN POLICY, AND NEVER INSTEAD OF THE TEAM.
//
// 13 Oct 2026. The documents went in and the rules sat in a table doing
// nothing. This is the half that makes them worth having.
//
// The one rule everything hangs off, from the blueprint and from docs/paco.md:
//
//   Official written lender policy outranks everything else, and internal
//   experience never silently overwrites official policy.
//
// BOTH HALVES, and the second is the easy one to get wrong. A team note is not
// demoted to a footnote and it is not hidden - it is shown ALONGSIDE, with its
// own name and date. "The manual says 80%" and "Sam got 85% through in March"
// are both true and a broker needs both. What must never happen is the note
// reading as though it were the policy.
//
// Invented lenders where invented; the tiers are the blueprint's.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { answerFrom, sourceOf, whatToCheck, rankOfTier, NOTE_BESIDE_POLICY } from './paco-answers-from-policy'

const TODAY = '2026-10-13'
const rule = (o: any = {}) => ({
  id: String(Math.random()), status: 'live', tier: 'A',
  says: 'Limited title is considered to 80%',
  quote: 'Properties held under limited title are acceptable security to a maximum LVR of 80%.',
  section: '7.2', effectiveFrom: null, effectiveTo: null, ...o,
}) as any

describe('the firmest thing he has, first', () => {
  it('a manual before a written update before a product guide', () => {
    const a = answerFrom([rule({ tier: 'C' }), rule({ tier: 'A' }), rule({ tier: 'B' })], [], TODAY)
    expect(a.policy.map(r => r.tier)).toEqual(['A', 'B', 'C'])
  })

  it('and the tiers rank the way the blueprint says', () => {
    expect(rankOfTier('A')).toBeLessThan(rankOfTier('B'))
    expect(rankOfTier('D')).toBeGreaterThan(rankOfTier('C'))
    expect(rankOfTier('nonsense')).toBeGreaterThan(rankOfTier('D'))
  })
})

describe('nothing a person has not ticked ever answers', () => {
  // A machine's reading of a credit manual, repeated as though it were the
  // bank's policy, is the one thing this whole design exists to prevent.
  it('a proposed rule is not an answer', () => {
    expect(answerFrom([rule({ status: 'proposed' })], [], TODAY).policy).toHaveLength(0)
  })

  it('nor a rejected one', () => {
    expect(answerFrom([rule({ status: 'rejected' })], [], TODAY).policy).toHaveLength(0)
  })
})

describe('the dates decide, and a future rule is said rather than hidden', () => {
  it('a rule that starts next month is held', () => {
    const a = answerFrom([rule({ says: 'now' }), rule({ says: 'soon', effectiveFrom: '2026-11-01' })], [], TODAY)
    expect(a.policy.map(r => r.says)).toEqual(['now'])
    expect(a.coming.map(r => r.says)).toEqual(['soon'])
  })

  // "Nothing recorded" and "one starts in three weeks" are different answers,
  // and only one of them is true.
  it('and it is said, with its date', () => {
    const a = answerFrom([rule({ effectiveFrom: '2026-11-01' })], [], TODAY)
    expect(whatToCheck(a, 'limited title')).toContain('2026-11-01')
  })

  it('a rule that has been overtaken stops answering', () => {
    expect(answerFrom([rule({ effectiveTo: '2026-03-01' })], [], TODAY).policy).toHaveLength(0)
  })
})

describe('our own experience sits beside the policy, never instead of it', () => {
  const a = () => answerFrom([rule()], [{ said: 'Sam got 85% through in March' }], TODAY)

  it('the note is kept', () => {
    expect(a().notes).toHaveLength(1)
    expect(a().policy).toHaveLength(1)
  })

  it('and both being on record is said out loud', () => {
    expect(a().disagrees).toBe(true)
    expect(NOTE_BESIDE_POLICY).toContain('does not change it')
  })

  // HE DOES NOT READ TWO SENTENCES AND DECIDE WHETHER THEY CONTRADICT. He has
  // no business doing that. It is simply that something official and something
  // internal are both on record, which is exactly when a person reads both.
  it('a note on its own contradicts nothing', () => {
    expect(answerFrom([], [{ said: 'x' }], TODAY).disagrees).toBe(false)
  })

  it('and policy on its own contradicts nothing either', () => {
    expect(answerFrom([rule()], [], TODAY).disagrees).toBe(false)
  })
})

describe('he is specific about not knowing', () => {
  it('nothing recorded at all', () => {
    expect(whatToCheck(answerFrom([], [], TODAY), 'limited title')).toContain('Nothing recorded')
  })

  it('only our own experience, which is not verification', () => {
    const said = whatToCheck(answerFrom([], [{ said: 'x' }], TODAY), 'limited title')
    expect(said).toContain('Not verified')
    expect(said).toContain('BDM')
  })

  it('and when there is policy he says nothing of the sort', () => {
    expect(whatToCheck(answerFrom([rule()], [], TODAY), 'x')).toBe('')
  })
})

describe('what he shows as the source', () => {
  it('a sentence out of a manual', () => {
    expect(sourceOf(rule())).toEqual({ quote: rule().quote })
  })

  // NAB's income shading is a row in a three column table. Flattened, nobody
  // can tell which number is the shading and which is the period.
  it('or the table row, kept as a row', () => {
    const r = sourceOf({ rowHeaders: ['Income Type', 'Shading', 'Period'], rowCells: ['Commissions', '20%', '6 Months'] })
    expect(r).toEqual({ headers: ['Income Type', 'Shading', 'Period'], cells: ['Commissions', '20%', '6 Months'] })
  })

  it('a row whose headings do not line up shows nothing rather than a guess', () => {
    expect(sourceOf({ rowHeaders: ['A'], rowCells: ['x', 'y'] })).toBeNull()
  })

  it('and a rule with neither shows nothing', () => {
    expect(sourceOf({})).toBeNull()
  })
})

describe('the wiring', () => {
  const route = readFileSync('app/api/paco/route.ts', 'utf8')
  const panel = readFileSync('components/Paco.tsx', 'utf8')

  it('only ticked rules are read', () => {
    expect(route).toContain(".eq('status', 'live')")
  })

  // A Macquarie question answered with a Bankwest rule would be worse than no
  // answer, because it would look like one.
  it('and they are filtered by the lender and the subject, like the notes', () => {
    expect(route).toContain('function forThisQuestion')
    expect(route).toContain('flat((r as any).lenderName) === named')
  })

  it('the panel quotes rather than describes', () => {
    expect(panel).toContain('sourceOf(r)')
    expect(panel).toContain('citation(r,')
  })

  it('and the policy is drawn above the deals and the notes', () => {
    const said = panel.slice(panel.indexOf('function Said({ a }'))
    expect(said.indexOf('<Policy')).toBeGreaterThan(-1)
    expect(said.indexOf('<Policy')).toBeLessThan(said.indexOf('<Notes'))
  })
})
