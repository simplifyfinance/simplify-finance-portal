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
import { answerFrom, sourceOf, isChecked, whatToCheck, rankOfTier, USABLE, NOTE_BESIDE_POLICY } from './paco-answers-from-policy'

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

// AN UNCHECKED LINE ANSWERS, AND SAYS SO.
//
// 13 Oct 2026. This used to hold that nothing unticked ever answered, and the
// day the library filled up that turned out to be the wrong promise: NAB's
// policy went in, 455 lines came out, and Paco told Fabio he had no lender
// policy on a question whose answer was on the screen behind him.
//
// The thing that stops a machine's reading being mistaken for the bank's
// policy was never the tick. It is the quote. A tick nobody has time to do
// three hundred times protects nobody; a sentence from the document sitting
// under every answer protects everybody. So the promise is now harder to keep,
// not easier: an unchecked line must answer, must be marked every single time,
// and must never be shown above a line a person has read.
describe('an unchecked line answers, and says it is unchecked', () => {
  it('a proposed rule is an answer', () => {
    const a = answerFrom([rule({ status: 'proposed' })], [], TODAY)
    expect(a.policy).toHaveLength(1)
  })

  it('and it is counted, so the mark can never be quietly dropped', () => {
    const a = answerFrom([rule({ status: 'proposed' }), rule({ status: 'proposed' })], [], TODAY)
    expect(a.unchecked).toBe(2)
  })

  it('a ticked one is not counted as unchecked', () => {
    expect(answerFrom([rule({ status: 'live' })], [], TODAY).unchecked).toBe(0)
    expect(isChecked(rule({ status: 'live' }))).toBe(true)
    expect(isChecked(rule({ status: 'proposed' }))).toBe(false)
  })

  // ORDER IS THE OTHER HALF OF THE MARK. A line somebody has read against the
  // document goes first, even where the unchecked one is just as official.
  it('and what a person has read comes first', () => {
    const a = answerFrom([
      rule({ id: 'unread', status: 'proposed', tier: 'A' }),
      rule({ id: 'read', status: 'live', tier: 'A' }),
    ], [], TODAY)
    expect(a.policy.map(r => r.id)).toEqual(['read', 'unread'])
  })

  // THE ONE THAT STILL NEVER ANSWERS. Somebody looked at this line, held it
  // against the document and said it was wrong. That is a decision, and it
  // stands.
  it('a rejected one still never answers', () => {
    expect(answerFrom([rule({ status: 'rejected' })], [], TODAY).policy).toHaveLength(0)
    expect(answerFrom([rule({ status: 'rejected' })], [], TODAY).unchecked).toBe(0)
  })

  // AND AN UNCHECKED READING IS NOT A SOURCE FALLING OUT WITH A TEAM NOTE.
  // That is a machine and a person, and dressing it up as a conflict between
  // the bank and our own experience would be theatre.
  it('does not pick a fight with a team note on its own', () => {
    const withNote = answerFrom([rule({ status: 'proposed', tier: 'A' })],
      [{ lender: 'NAB', said: 'They took nine months once' }], TODAY)
    expect(withNote.disagrees).toBe(false)

    const checked = answerFrom([rule({ status: 'live', tier: 'A' })],
      [{ lender: 'NAB', said: 'They took nine months once' }], TODAY)
    expect(checked.disagrees).toBe(true)
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

  it('both ticked and unticked rules are read', () => {
    expect(route).toContain(".in('status', USABLE")
  })

  // A LINE SOMEBODY CALLED WRONG STOPS ANSWERING, and that is the only thing
  // that stops one. USABLE is the whole list, so 'rejected' being absent from
  // it is what keeps it out.
  it('and a rejected one is not', () => {
    expect([...USABLE]).toEqual(['live', 'proposed'])
    expect([...USABLE]).not.toContain('rejected')
  })

  // THE COUNT NOBODY WAS PASSING. "0 lender policies loaded" was not a reading
  // of anything: policies defaulted to nought in lib/paco.ts and the route
  // never sent a real one, so Paco reported an empty library however full it
  // was, and then said "I have no lender policy on this" off the back of it.
  it('and the number of policies he holds is actually passed to him', () => {
    expect(route).toContain('policies: policy.length')
  })

  // NO QUEUE, NO NAG, ONE CORRECTION.
  //
  // 13 Oct 2026. Fabio, after 455 lines landed in a review list: "a lot of
  // these are statements. Just it really is reading. Like, why do I need to
  // confirm? So that needs to go."
  //
  // What replaced it is one link under every answer, used by somebody who
  // tripped over a wrong line while doing their job. So the panel must offer
  // that, and must not have grown a queue or a nag back.
  it('the panel offers one correction, under the answer', () => {
    expect(panel).toContain('That is not what it says')
    expect(panel).toContain('<Wrong id={r.id}')
  })

  it('and never asks anybody to go and confirm anything', () => {
    for (const nag of ['nobody has checked this yet', 'not checked by a person', 'waiting to be checked']) {
      expect(panel, `the nag is back: "${nag}"`).not.toContain(nag)
    }
  })

  // HE ASKS WHEN HE HAS NOTHING. That is the whole of "make it conversational":
  // a dead end becomes an offer, and the bank comes with it so nobody types it
  // in twice.
  it('and asks whether you know when he has nothing', () => {
    expect(panel).toContain('Do you know?')
    expect(panel).toContain('Yes, I know this one')
    expect(panel).toContain('onTell((a as any).askedAbout')
    expect(route).toContain('askedAbout')
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
    const said = panel.slice(panel.indexOf('function Said({ a, onTell }'))
    expect(said.indexOf('<Policy')).toBeGreaterThan(-1)
    expect(said.indexOf('<Policy')).toBeLessThan(said.indexOf('<Notes'))
  })
})
