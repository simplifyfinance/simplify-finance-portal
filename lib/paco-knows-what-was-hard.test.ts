// WHAT MADE THE DEAL HARD, AND WHY IT IS THE ONLY NEW THING WE ASK FOR.
//
// 12 Oct 2026. Fabio wants a bot that answers "which lender will do a limited
// title property" from our own policies, our own BDM notes and our own deals.
//
// The first plan was a box at submission asking the team to type why they chose
// a lender. THAT WAS WRONG, and the repo said so: the Lending Options tab
// already records every lender considered, which was recommended, the broker's
// own words on why, whether the client overrode it and the reason they gave -
// and the deal records whether it was lodged, approved or declined. Asking for
// the reason again would be a second door onto recommendationNote and would be
// answered "best rate".
//
// The one thing nothing in this portal holds is the OBSTACLE. A recommendation
// note explains why a product suits a client, because that is what it is for.
// It never says "the title was the problem", and that is the word somebody
// searches on two years later.
//
// So this file pins the one new field, and pins the reasons the others were not
// added - because the cheapest way for this to rot is somebody adding a second
// free-text box in six months "to capture the why".
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { TAG_GROUPS, ALL_TAGS, tagsOf, toggleTag, tagLine, groupOf } from './deal-tags'

describe('the tags themselves', () => {
  it('no tag appears in two groups, and none is blank', () => {
    expect(new Set(ALL_TAGS).size).toBe(ALL_TAGS.length)
    for (const t of ALL_TAGS) expect(t.trim().length).toBeGreaterThan(0)
  })

  it('every group has some, so none is an empty heading on screen', () => {
    expect(TAG_GROUPS.length).toBeGreaterThan(2)
    for (const g of TAG_GROUPS) expect(g.tags.length).toBeGreaterThan(0)
  })

  it('covers the five things that actually make a deal awkward', () => {
    // Named rather than counted: a later tidy-up that drops a whole group is a
    // decision, and this is where it gets argued.
    expect(TAG_GROUPS.map(g => g.group)).toEqual(
      ['The security', 'The income', 'The structure', 'The credit', 'Other'])
  })

  it('every tag belongs to a group it can be found under', () => {
    for (const t of ALL_TAGS) expect(groupOf(t), t).not.toBe('')
  })
})

describe('reading them back off a deal', () => {
  it('a deal saved before today has none, which is not the same as none applied', () => {
    expect(tagsOf({})).toEqual([])
    expect(tagsOf({ dealTags: undefined })).toEqual([])
    expect(tagsOf(null)).toEqual([])
  })

  it('a retired or mistyped tag stops coming back rather than lingering', () => {
    // A string nobody can search for is worse than nothing: it looks like data.
    expect(tagsOf({ dealTags: ['Limited title', 'Flibbertigibbet'] })).toEqual(['Limited title'])
  })

  it('always in the order they appear on screen, never click order', () => {
    const clicked = ['Turnaround', 'Limited title', 'SMSF']
    const back = tagsOf({ dealTags: clicked })
    expect(back).toEqual(['Limited title', 'SMSF', 'Turnaround'])
  })

  it('junk in the column cannot crash the tab', () => {
    expect(tagsOf({ dealTags: 'Limited title' })).toEqual([])
    expect(tagsOf({ dealTags: [null, 7, { a: 1 }] })).toEqual([])
  })
})

describe('turning one on and off', () => {
  it('adds, removes, and ignores anything not on the list', () => {
    expect(toggleTag([], 'SMSF')).toEqual(['SMSF'])
    expect(toggleTag(['SMSF'], 'SMSF')).toEqual([])
    expect(toggleTag([], 'Something nobody offered')).toEqual([])
  })

  it('two reasons is the normal case, not an edge one', () => {
    // Most hard deals are hard twice over, and "limited title AND turnaround"
    // is a more useful memory than either on its own.
    const two = toggleTag(toggleTag([], 'Limited title'), 'Turnaround')
    expect(two).toEqual(['Limited title', 'Turnaround'])
    expect(tagLine(two)).toBe('Limited title and Turnaround')
  })

  it('says one back plainly, and nothing back as nothing', () => {
    expect(tagLine(['SMSF'])).toBe('SMSF')
    expect(tagLine([])).toBe('')
  })
})

// ---------------------------------------------------------------------------
// AND THE SCREEN KEEPS ITS SIDE OF THE BARGAIN.
// WHERE THIS QUESTION LIVES NOW, 14 OCT 2026.
//
// It used to be a block of chips on the Lending Options tab. It is gone from
// there - it asked the same thing the handover box asks when the BC is sent, a
// box built the day AFTER it to replace it and which never did. Fabio: "we
// removed that when we added notes when sending BC and LO didnt we?"
//
// These tests did not get deleted with the block. They moved, because what
// they were protecting is still worth protecting: the chips must come off one
// list, nothing may nag, and the question must be asked ONCE.
describe('WHERE THIS QUESTION LIVES NOW - NOWHERE, AND ON PURPOSE', () => {
  const lo = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')
  const box = readFileSync('components/Handover.tsx', 'utf8')

  // 3 Nov 2026. Fabio: "the section on was anything hard about this one is too
  // long and not really working, so remove and only leave what they need to
  // know. Change wording to what does the broker need to know."
  //
  // 28 chips in five groups, plus a second question under it, in front of
  // somebody who had already written the sentence that mattered - and
  // required, so Send stayed off until they tapped something. A required
  // question nobody wants to answer gets answered at random, and a tag picked
  // at random is worse than none, because Paco COUNTS them. Asking it was
  // making his numbers worse, not better.
  it('the borrowing capacity handover does not ask it', () => {
    expect(box).not.toContain('Was anything hard about this one?')
    expect(box).not.toContain('What would have made it easier?')
  })

  it('AND ASKS THE ONE THING IT DOES ASK IN FABIO\u2019S WORDS', () => {
    expect(box).toContain('What does the broker need to know?')
  })

  it('and the duplicate did not come back on the Lending Options tab', () => {
    // 14 Oct 2026: it was asked twice, once there and once here. Neither.
    expect(lo).not.toContain('What made this one hard?')
  })

  it('AND NOTHING WAS DELETED FROM THE LIBRARY', () => {
    // A handover recorded before today still prints its tags on the broker's
    // side and in the file note. The question is not asked on new ones; the
    // old answers are not taken away.
    const notes = readFileSync('lib/handover-notes.ts', 'utf8')
    expect(notes).toContain('NOTHING_UNUSUAL')
    expect(notes).toContain('EASIER')
    expect(readFileSync('lib/deal-tags.ts', 'utf8')).toContain('TAG_GROUPS')
  })

  it('AND THE LENDING OPTIONS SIDE IS UNTOUCHED', () => {
    // Its questions are about the LENDERS, which is what Paco is actually
    // useful for - why each bank is on the deal, and what one of them did that
    // surprised us.
    expect(box).toContain('Why these lenders?')
    expect(box).toContain('Anything a lender did that surprised you?')
  })
})

// ---------------------------------------------------------------------------
// THE REASONS WE DID NOT ADD MORE.
describe('the tab already holds everything else, which is why we ask for so little', () => {
  const ui = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')

  it.each([
    ['every lender considered',        'lenders:'],
    ['which one was recommended',      'recommendedOptionId'],
    ['why, in the broker\'s own words', 'recommendationNote'],
    ['whether the client overrode it', 'clientAgreedLender'],
    ['and the reason they gave',       'clientChosenLenderReason'],
  ])('%s is already recorded here', (_what, field) => {
    expect(ui).toContain(field)
  })

  it('and there is exactly one free-text box about the choice, not two', () => {
    // If a second one appears, somebody has re-added the thing this design
    // deliberately did without - read the note at the top of this file first.
    const at = ui.indexOf('What made this one hard?')
    const block = ui.slice(at, at + 2600)
    expect(block).not.toContain('<textarea')
  })
})
