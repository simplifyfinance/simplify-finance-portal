import { describe, it, expect } from 'vitest'
import { newOwnership, markDirty, keepOwned, settleSaved, readField, mayWrite } from './field-ownership'

// TICK BOXES, DROPDOWNS AND FIGURES INSIDE A LIST.
//
// Kylie, 14 Sep 2026, with Melissa in the same deal: "If I tick the box after a
// few seconds - it unticks it. If I remove a data - it goes back."
//
// The rule that protects a box somebody is typing in is the same rule these
// need - nothing external may write a field with an unsaved change in it. The
// difference is where they live: not `goals2Years` at the top of the record,
// but the ownership tick on ONE asset inside a list of them.
//
// A row is named by its id, never by its position. Somebody adding or removing
// a row above yours must not move which tick is protected.

const deal = () => ({
  applicants: [{ id: 'rich', firstName: 'Richard' }, { id: 'let', firstName: 'Letitia' }],
  assets: [
    { id: 'as1', label: 'Superannuation - Applicant 1', value: '111,418', ownership: { rich: 'Yes', let: '' } },
    { id: 'as2', label: 'Superannuation - Applicant 2', value: '64,405', ownership: { rich: '', let: 'Yes' } },
  ],
  properties: [{ id: 'p1', address: '12 Smith St', loans: [{ id: 'l1', balance: '339,000' }] }],
  dependants: '2',
})

describe('naming a field inside a list', () => {
  it('finds a row by its id, not its position', () => {
    expect(readField(deal(), 'assets#as2.value')).toBe('64,405')
  })

  it('finds a tick inside that row', () => {
    expect(readField(deal(), 'assets#as1.ownership.let')).toBe('')
  })

  it('reaches a row inside a row', () => {
    expect(readField(deal(), 'properties#p1.loans#l1.balance')).toBe('339,000')
  })

  it('is nothing at all when the row has gone', () => {
    expect(readField(deal(), 'assets#nosuch.value')).toBeUndefined()
  })
})

describe('the tick that unticked itself', () => {
  it('A TICK SURVIVES SOMEBODY ELSE SAVING', () => {
    const o = newOwnership()
    const onScreen = deal()
    onScreen.assets[0].ownership.let = 'Yes'          // Fabio ticks Letitia
    markDirty(o, 'assets#as1.ownership')

    // Melissa's record arrives - hers has never seen the tick.
    const out = keepOwned(deal(), onScreen, o)
    expect(out.assets[0].ownership.let, 'the tick came back off').toBe('Yes')
  })

  it('A FIGURE SOMEBODY CLEARS STAYS CLEARED', () => {
    const o = newOwnership()
    const onScreen = deal()
    onScreen.assets[1].value = ''
    markDirty(o, 'assets#as2.value')
    expect(keepOwned(deal(), onScreen, o).assets[1].value, 'the value came back').toBe('')
  })

  it('protects only that row, and lets the rest of their record in', () => {
    const o = newOwnership()
    const onScreen = deal()
    onScreen.assets[0].ownership.let = 'Yes'
    markDirty(o, 'assets#as1.ownership')

    const theirs = deal()
    theirs.assets[1].value = '70,000'          // Melissa edited the other asset
    theirs.dependants = '3'

    const out = keepOwned(theirs, onScreen, o)
    expect(out.assets[0].ownership.let).toBe('Yes')
    expect(out.assets[1].value, "Melissa's change was thrown away").toBe('70,000')
    expect(out.dependants).toBe('3')
  })

  it('still finds the row when somebody has added one above it', () => {
    const o = newOwnership()
    const onScreen = deal()
    onScreen.assets[1].value = 'mine'
    markDirty(o, 'assets#as2.value')

    const theirs = deal()
    theirs.assets.unshift({ id: 'as0', label: 'Savings', value: '5,000', ownership: {} } as any)

    const out = keepOwned(theirs, onScreen, o)
    expect(out.assets.find((a: any) => a.id === 'as2').value).toBe('mine')
    expect(out.assets.length, 'their new row was thrown away').toBe(3)
  })

  it('does not undo their delete by putting the row back', () => {
    const o = newOwnership()
    const onScreen = deal()
    onScreen.assets[1].value = 'mine'
    markDirty(o, 'assets#as2.value')

    const theirs = deal()
    theirs.assets = theirs.assets.filter((a: any) => a.id !== 'as2')
    expect(keepOwned(theirs, onScreen, o).assets.map((a: any) => a.id)).toEqual(['as1'])
  })

  it('reaches a loan inside a property', () => {
    const o = newOwnership()
    const onScreen = deal()
    onScreen.properties[0].loans[0].balance = '250,000'
    markDirty(o, 'properties#p1.loans#l1.balance')
    expect(keepOwned(deal(), onScreen, o).properties[0].loans[0].balance).toBe('250,000')
  })

  it('lets go once that tick has been saved', () => {
    const o = newOwnership()
    const onScreen = deal()
    onScreen.assets[0].ownership.let = 'Yes'
    markDirty(o, 'assets#as1.ownership')
    settleSaved(o, onScreen, onScreen)
    expect(mayWrite(o, 'assets#as1.ownership')).toBe(true)
  })

  it('stays protected while she is still changing it', () => {
    const o = newOwnership()
    markDirty(o, 'assets#as1.value')
    const saved = deal()
    const onScreen = deal(); onScreen.assets[0].value = '120,000'
    settleSaved(o, saved, onScreen)
    expect(mayWrite(o, 'assets#as1.value')).toBe(false)
  })
})
