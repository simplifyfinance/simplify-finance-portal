import { describe, it, expect } from 'vitest'
import { newOwnership, focusField, blurField, markDirty, markSaved, mayWrite, applyOwned, keepOwned, settleSaved, busyFields, noteSaved, OWNED_FIELDS } from './field-ownership'

// THE BOX SOMEBODY IS TYPING IN BELONGS TO THEM.
//
// Kylie, 15 Sep 2026, broker notes on Jacob Joson: letters being deleted while
// she typed. Live editing is off, so nothing was being pushed at her screen.
// This was her own save: onAdopt and onMerge both hand the whole record to
// applyBcData, which calls setBrokerNotes() with a value read out of the form
// 700 milliseconds earlier. Every character typed in between is gone.
//
// The rule, and there is only one: NOTHING EXTERNAL MAY WRITE A FIELD THAT IS
// FOCUSED OR HAS UNSAVED CHANGES. It is not about where the record came from -
// a merge, an adopt, a live update are all external to the box somebody is
// inside.
//
// Nothing is lost by refusing. The record still goes to the database with the
// other person's fields in it; the only thing that does not happen is this
// screen being rewritten underneath a cursor.

describe('the rule', () => {
  it('lets an external value in when nobody is in the box', () => {
    expect(mayWrite(newOwnership(), 'brokerNotes')).toBe(true)
  })

  it('REFUSES while the box has focus', () => {
    const o = newOwnership()
    focusField(o, 'brokerNotes')
    expect(mayWrite(o, 'brokerNotes')).toBe(false)
  })

  it('REFUSES after focus has gone if what is in there is not saved yet', () => {
    // The 700ms between the last keystroke and the save landing. She has clicked
    // away but her sentence is still only on screen.
    const o = newOwnership()
    focusField(o, 'brokerNotes'); markDirty(o, 'brokerNotes'); blurField(o, 'brokerNotes')
    expect(mayWrite(o, 'brokerNotes')).toBe(false)
  })

  it('lets it in again once that box has been saved', () => {
    const o = newOwnership()
    focusField(o, 'brokerNotes'); markDirty(o, 'brokerNotes'); blurField(o, 'brokerNotes')
    markSaved(o, 'brokerNotes')
    expect(mayWrite(o, 'brokerNotes')).toBe(true)
  })

  it('still refuses after a save if she has carried on typing', () => {
    const o = newOwnership()
    focusField(o, 'brokerNotes'); markDirty(o, 'brokerNotes')
    markSaved(o, 'brokerNotes')      // the save of what she had a moment ago
    markDirty(o, 'brokerNotes')      // and she kept going
    blurField(o, 'brokerNotes')
    expect(mayWrite(o, 'brokerNotes')).toBe(false)
  })

  it('one box being busy does not protect another', () => {
    const o = newOwnership()
    focusField(o, 'brokerNotes')
    expect(mayWrite(o, 'templateNotes')).toBe(true)
  })

  it('a field nobody owns is always writable', () => {
    const o = newOwnership()
    focusField(o, 'brokerNotes')
    expect(mayWrite(o, 'purchasePrice')).toBe(true)
  })

  it('a blur that arrives late does not unprotect the box just moved into', () => {
    const o = newOwnership()
    focusField(o, 'brokerNotes')
    focusField(o, 'templateNotes')
    blurField(o, 'brokerNotes')
    expect(mayWrite(o, 'templateNotes')).toBe(false)
  })
})

describe('applying a record around the boxes in use', () => {
  const setters = (log: Record<string, any>) => ({
    brokerNotes: (v: any) => { log.brokerNotes = v },
    templateNotes: (v: any) => { log.templateNotes = v },
    purchasePrice: (v: any) => { log.purchasePrice = v },
  })

  it('writes every field when nobody is typing', () => {
    const log: Record<string, any> = {}
    applyOwned({ brokerNotes: 'theirs', templateNotes: 'theirs', purchasePrice: '900,000' },
               setters(log), newOwnership())
    expect(log).toEqual({ brokerNotes: 'theirs', templateNotes: 'theirs', purchasePrice: '900,000' })
  })

  it('SKIPS THE BOX SHE IS IN AND WRITES EVERYTHING ELSE', () => {
    const log: Record<string, any> = {}
    const o = newOwnership()
    focusField(o, 'brokerNotes'); markDirty(o, 'brokerNotes')
    applyOwned({ brokerNotes: 'the stale copy', templateNotes: 'theirs', purchasePrice: '900,000' },
               setters(log), o)
    expect(log.brokerNotes, 'her sentence was overwritten').toBeUndefined()
    expect(log.templateNotes).toBe('theirs')
    expect(log.purchasePrice).toBe('900,000')
  })

  it('only writes keys the record actually carries', () => {
    // A record saved before a field existed must not blank that field out.
    const log: Record<string, any> = {}
    applyOwned({ purchasePrice: '900,000' }, setters(log), newOwnership())
    expect('brokerNotes' in log).toBe(false)
    expect(log.purchasePrice).toBe('900,000')
  })

  it('ignores a record that is not a record', () => {
    const log: Record<string, any> = {}
    for (const bad of [null, undefined, 'text', 42]) applyOwned(bad, setters(log), newOwnership())
    expect(log).toEqual({})
  })

  it('reports which fields it held back, so the screen can say so', () => {
    const o = newOwnership()
    focusField(o, 'brokerNotes')
    const held = applyOwned({ brokerNotes: 'theirs', purchasePrice: '900,000' }, setters({}), o)
    expect(held).toEqual(['brokerNotes'])
  })
})

describe('which boxes the rule covers', () => {
  it('is the free text boxes, named out loud', () => {
    // Widening this is a decision. A figure is typed and left; a sentence is
    // typed over minutes, and it is the sentence that gets destroyed.
    expect([...OWNED_FIELDS]).toEqual(['brokerNotes', 'templateNotes', 'internalNotes'])
  })
})

// The Fact Find, Lending options and Compliance tabs hold the whole tab in one
// object and replace it wholesale. They cannot go field by field through
// setters the way BC does, so the record itself is repaired before it reaches
// the screen.
describe('putting a whole record on screen around the boxes in use', () => {
  const screen = () => ({
    goals2Years: 'Kylie is half way through this sentence',
    loanPurpose: 'Refinance',
    productReqs: { otherRequirements: 'and half way through this one', offset: 'Important' },
    dependants: '2',
  })

  it('passes the record straight through when nobody is typing', () => {
    const incoming = { ...screen(), dependants: '3' }
    expect(keepOwned(incoming, screen(), newOwnership())).toEqual(incoming)
  })

  it('PUTS HER SENTENCE BACK AND KEEPS EVERYTHING ELSE', () => {
    const o = newOwnership()
    focusField(o, 'goals2Years')
    const incoming = { ...screen(), goals2Years: 'the copy from 700ms ago', dependants: '3' }
    const out = keepOwned(incoming, screen(), o)
    expect(out.goals2Years).toBe('Kylie is half way through this sentence')
    expect(out.dependants, "somebody else's change was thrown away").toBe('3')
  })

  it('reaches a box that lives a level down', () => {
    const o = newOwnership()
    markDirty(o, 'productReqs.otherRequirements')
    const incoming = { ...screen(), productReqs: { otherRequirements: 'stale', offset: 'Do not want' } }
    const out = keepOwned(incoming, screen(), o)
    expect(out.productReqs.otherRequirements).toBe('and half way through this one')
    expect(out.productReqs.offset, 'the rest of that section was thrown away').toBe('Do not want')
  })

  it('does not touch the record it was given', () => {
    const o = newOwnership()
    focusField(o, 'goals2Years')
    const incoming = { ...screen(), goals2Years: 'stale' }
    keepOwned(incoming, screen(), o)
    expect(incoming.goals2Years).toBe('stale')
  })

  it('leaves a field alone when it is not on screen at all', () => {
    const o = newOwnership()
    focusField(o, 'notAFieldAtAll')
    expect(keepOwned({ dependants: '3' }, screen(), o)).toEqual({ dependants: '3' })
  })

  it('ignores anything that is not a record', () => {
    for (const bad of [null, undefined, 'text', 42]) {
      expect(keepOwned(bad, screen(), newOwnership())).toBe(bad)
    }
  })
})

describe('when a save lands', () => {
  it('clears the boxes it actually carried, and only those', () => {
    const o = newOwnership()
    markDirty(o, 'goals2Years'); markDirty(o, 'loanPurpose')
    const onScreen = { goals2Years: 'done', loanPurpose: 'still typing this' }
    settleSaved(o, { goals2Years: 'done', loanPurpose: 'still typ' }, onScreen)
    expect(mayWrite(o, 'goals2Years')).toBe(true)
    expect(mayWrite(o, 'loanPurpose'), 'a box she is still typing in was let go').toBe(false)
  })

  it('names every field it is protecting', () => {
    const o = newOwnership()
    focusField(o, 'a'); markDirty(o, 'b')
    expect(busyFields(o).sort()).toEqual(['a', 'b'])
  })
})

describe('what this screen last saw saved', () => {
  it('a save records what it actually wrote, for the last write on the way out', () => {
    // buildPatch carries this as `was` so the server can refuse to overwrite
    // somebody else. See lib/keepalive-patch.ts.
    const o = newOwnership()
    markDirty(o, 'goals2Years')
    settleSaved(o, { goals2Years: 'the first half' }, { goals2Years: 'the first half and more' })
    expect(o.lastSaved.goals2Years).toBe('the first half')
    expect(mayWrite(o, 'goals2Years'), 'a box still being typed in was let go').toBe(false)
  })

  it('a box nobody has saved has nothing recorded against it', () => {
    const o = newOwnership()
    expect(o.lastSaved.goals2Years).toBeUndefined()
    noteSaved(o, 'goals2Years', 'now it has')
    expect(o.lastSaved.goals2Years).toBe('now it has')
  })
})
