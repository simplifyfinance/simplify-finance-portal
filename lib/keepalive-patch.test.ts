import { describe, it, expect } from 'vitest'
import { buildPatch, applyPatch, KEEPALIVE_FIELDS } from './keepalive-patch'
import { newOwnership, focusField, markDirty, noteSaved } from './field-ownership'

// THE LAST HALF SECOND.
//
// 15 Sep 2026. Nothing disappears while somebody types any more - that was
// fixed today. This is the other way the same words go missing: the autosave
// waits 600ms after the last keystroke, and a refresh, a closed tab or a click
// to another page inside that window takes the sentence with it. The box looked
// perfect the whole time. Kylie opens the deal again and the last line is gone.
//
// AND IT CANNOT DESTROY ANYBODY'S WORK. Every field carries what this screen
// last saw saved in it. The server writes the new value only if the stored one
// still matches. If somebody else has changed it in the meantime that field is
// skipped - a write nobody is watching is never allowed to win an argument.

describe('what gets sent on the way out', () => {
  it('sends nothing when every box is saved', () => {
    expect(buildPatch(newOwnership(), { goals2Years: 'all saved' })).toEqual({})
  })

  it('sends a box with something unsaved in it', () => {
    const o = newOwnership()
    noteSaved(o, 'goals2Years', 'Richard and Letitia want')
    markDirty(o, 'goals2Years')
    expect(buildPatch(o, { goals2Years: 'Richard and Letitia want to be in the new place' })).toEqual({
      goals2Years: { was: 'Richard and Letitia want', now: 'Richard and Letitia want to be in the new place' },
    })
  })

  it('sends a box that has never been saved, with nothing as its was', () => {
    const o = newOwnership()
    markDirty(o, 'goals2Years')
    expect(buildPatch(o, { goals2Years: 'first words' }))
      .toEqual({ goals2Years: { was: undefined, now: 'first words' } })
  })

  it('sends nothing for a box that is focused but unchanged', () => {
    const o = newOwnership()
    noteSaved(o, 'goals2Years', 'same')
    focusField(o, 'goals2Years')
    expect(buildPatch(o, { goals2Years: 'same' })).toEqual({})
  })

  it('reaches a box that lives a level down', () => {
    const o = newOwnership()
    noteSaved(o, 'productReqs.otherRequirements', 'half')
    markDirty(o, 'productReqs.otherRequirements')
    expect(buildPatch(o, { productReqs: { otherRequirements: 'half a sentence' } })['productReqs.otherRequirements'])
      .toEqual({ was: 'half', now: 'half a sentence' })
  })

  it('NEVER SENDS ANYTHING THAT IS NOT A FREE TYPING BOX', () => {
    const o = newOwnership()
    markDirty(o, 'purchasePrice')
    expect(buildPatch(o, { purchasePrice: '900,000' })).toEqual({})
  })
})

describe('what the server does with it', () => {
  const stored = () => ({
    goals2Years: 'Richard and Letitia want',
    goals10Years: 'somebody else was writing this',
    productReqs: { otherRequirements: 'half', offset: 'Important' },
  })

  it('writes the field when nobody has touched it since', () => {
    const out = applyPatch(stored(), {
      goals2Years: { was: 'Richard and Letitia want', now: 'Richard and Letitia want to be in' },
    })
    expect(out.changed).toEqual(['goals2Years'])
    expect(out.record.goals2Years).toBe('Richard and Letitia want to be in')
  })

  it('REFUSES WHEN SOMEBODY ELSE HAS CHANGED IT SINCE', () => {
    const out = applyPatch(stored(), {
      goals2Years: { was: 'something this screen never saw', now: 'and this would have destroyed theirs' },
    })
    expect(out.changed).toEqual([])
    expect(out.skipped).toEqual(['goals2Years'])
    expect(out.record.goals2Years, "somebody else's words were overwritten").toBe('Richard and Letitia want')
  })

  it('writes a first-ever value only when there is nothing there', () => {
    const empty = applyPatch({ goals2Years: '' }, { goals2Years: { was: undefined, now: 'first words' } })
    expect(empty.record.goals2Years).toBe('first words')
    const taken = applyPatch({ goals2Years: 'theirs' }, { goals2Years: { was: undefined, now: 'first words' } })
    expect(taken.record.goals2Years).toBe('theirs')
    expect(taken.skipped).toEqual(['goals2Years'])
  })

  it('reaches a box a level down without disturbing its neighbours', () => {
    const out = applyPatch(stored(), { 'productReqs.otherRequirements': { was: 'half', now: 'half a sentence' } })
    expect(out.record.productReqs.otherRequirements).toBe('half a sentence')
    expect(out.record.productReqs.offset).toBe('Important')
  })

  it('leaves every other field exactly as it was', () => {
    const out = applyPatch(stored(), { goals2Years: { was: 'Richard and Letitia want', now: 'more' } })
    expect(out.record.goals10Years).toBe('somebody else was writing this')
  })

  it('ONLY EVER TOUCHES A FREE TYPING BOX, WHATEVER IT IS ASKED TO DO', () => {
    const out = applyPatch({ purchasePrice: '900,000' } as any,
      { purchasePrice: { was: '900,000', now: '9,000,000' } } as any)
    expect(out.changed).toEqual([])
    expect(out.record.purchasePrice).toBe('900,000')
  })

  it('does nothing at all with a patch that is not a patch', () => {
    for (const bad of [null, undefined, 'text', 42, []]) {
      expect(applyPatch(stored(), bad as any).changed).toEqual([])
    }
  })

  it('THE LIST OF BOXES IT MAY TOUCH IS EXACTLY THESE, AND HOLDS NO FIGURES', () => {
    // Widening this is a decision, not a tidy-up. Nobody is watching this write
    // and nobody can be asked to resolve a collision, so it must never be able
    // to reach a loan amount, a rate, a tick box or a date. Adding a field here
    // means changing this test on purpose.
    expect([...KEEPALIVE_FIELDS]).toEqual([
      'brokerNotes', 'templateNotes', 'internalNotes',
      'loanPurpose', 'goals2Years', 'goals10Years',
      'brokerPersonalisation', 'recommendationNote', 'importantNotes', 'additionalNotes',
      'needsPrimary', 'needsImmediate', 'needsLongTerm', 'analysisComment', 'depositComment',
      'creditHistoryComment', 'securityComment', 'optionsComment', 'borrowingPowerComment',
      'applicationSubmissionComment', 'productReqs.otherRequirements',
    ])
  })
})
