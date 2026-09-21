import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// A TAB THAT KEEPS WHAT IS ON SCREEN MUST SAY IT DID.
//
// Both of these tabs re-read their record from the database the moment they
// open, and both decide, correctly, to leave the screen alone when somebody is
// already typing in it. Neither said anything about it - and that silence is
// what turned a display fault into an hour of Mellissa believing a whole
// Compliance tab of work was gone on 18 September.
//
// The rule is in lib/tab-behind.ts and it is narrow on purpose: the person has
// typed AND the record holds materially more than the screen. This test is
// here so a future edit cannot quietly take the sentence back out.

const read = (p: string) => readFileSync(p, 'utf8')

const TABS = [
  ['the lending options tab', 'app/(app)/deals/[id]/LOForm.tsx'],
  ['the compliance tab',      'app/(app)/deals/[id]/ComplianceForm.tsx'],
]

describe('the tabs that re-read their record', () => {
  for (const [what, file] of TABS) {
    const src = read(file)

    it(`${what} asks whether it is behind`, () => {
      expect(src, `${what} does not read lib/tab-behind.ts`).toContain("from '@/lib/tab-behind'")
      expect(src, `${what} never asks the question`).toContain('tabIsBehind(liveD.current')
    })

    it(`${what} draws the notice`, () => {
      expect(src, `${what} imports the rule but never shows anything`)
        .toContain('<TabBehindNotice')
    })

    it(`${what} puts the saved work back rather than asking`, () => {
      expect(src, `${what} does not put the saved record back through keepWhatTheyTyped`)
        .toContain('keepWhatTheyTyped(')
      // The first version of this put a fork in front of the team. One side of
      // it was always the right answer, so it is not a fork any more. If these
      // ever come back, the hesitation comes back with them.
      expect(src, `${what} is asking the team to choose again`)
        .not.toContain('onShowSaved')
      expect(src, `${what} is asking the team to choose again`)
        .not.toContain('onKeepScreen')
    })
  }
})

describe('the notice itself', () => {
  const src = read('components/TabBehindNotice.tsx')

  it('says nothing at all when there is nothing to say', () => {
    expect(src).toContain('if (!behind) return null')
  })

  // It reports; it does not ask. A decision where one side is always correct
  // is not a decision, it is a thing to hesitate over.
  it('asks the team nothing', () => {
    expect(src).not.toContain('Show me what is saved')
    expect(src).not.toContain('Keep what is on screen')
  })

  it('tells the person their own typing is safe', () => {
    // The reassurance lives in behindLine(), which this renders.
    expect(read('lib/tab-behind.ts')).toContain('Everything you typed has been kept')
  })
})
