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
describe('where it sits on the Lending Options tab', () => {
  const ui = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')

  it('is under the recommendation, not somewhere else', () => {
    const tags = ui.indexOf('What made this one hard?')
    const note = ui.indexOf("Field label=\"Recommendation paragraph\"")
    const decision = ui.indexOf("The client&apos;s decision")
    expect(tags).toBeGreaterThan(-1)
    expect(tags).toBeGreaterThan(note)
    expect(tags, 'the tags belong above the client decision, not below it').toBeLessThan(decision)
  })

  it('draws the groups off the one list rather than a second copy', () => {
    expect(ui).toContain('TAG_GROUPS.map')
    // A hand-written chip in the tab would drift from lib/deal-tags.ts the first
    // time the list changed.
    for (const t of ['Limited title', 'Casual income', 'SMSF']) {
      expect(ui, `${t} is written out in the tab instead of coming off the list`)
        .not.toContain(`>${t}<`)
    }
  })

  it('is optional, and says so', () => {
    expect(ui).toContain('Optional. Tap any that applied.')
  })

  it('nothing nags about it', () => {
    // No warning pill, no red, no required. A deal with nothing unusual is a
    // true answer and must not look like an unfinished form.
    const at = ui.indexOf('What made this one hard?')
    const block = ui.slice(at, at + 2600)
    expect(block).not.toContain('text-chase')
    expect(block).not.toContain('border-chase-edge')
    expect(block).not.toContain('required')
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
