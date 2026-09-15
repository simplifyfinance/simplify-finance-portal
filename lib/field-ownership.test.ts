import { describe, it, expect } from 'vitest'
import { newOwnership, focusField, blurField, markDirty, markSaved, mayWrite, applyOwned, OWNED_FIELDS } from './field-ownership'

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
