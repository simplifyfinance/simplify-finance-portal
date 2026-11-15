// "THEY OWN ... THEY OWN ... THEY OWN ..."
//
// 17 Nov 2026. Three property sentences in a row opening the same way, on a
// file where one applicant owned all three on his own.
import { describe, it, expect } from 'vitest'
import { ownersOf, pronounFor, ownsOpener, plainAddress } from './who-owns-what'

const DANIEL = { id: 'a1', firstName: 'Daniel', gender: 'Male' }
const PRIYA = { id: 'a2', firstName: 'Priya', gender: 'Female' }
const NOSAY = { id: 'a3', firstName: 'Alex', gender: '' }
const people = [DANIEL, PRIYA, NOSAY]
const his = { ownership: { a1: '100' } }
const hers = { ownership: { a2: '100' } }
const theirs = { ownership: { a1: '50', a2: '50' } }
const nobodys = { ownership: {} }

describe('who holds it', () => {
  it('reads the percentages off the fact find', () => {
    expect(ownersOf(his, people)).toEqual(['Daniel'])
    expect(ownersOf(theirs, people)).toEqual(['Daniel', 'Priya'])
    expect(ownersOf(nobodys, people)).toEqual([])
    expect(ownersOf(null, people)).toEqual([])
  })

  it('and a nought per cent share is not ownership', () => {
    expect(ownersOf({ ownership: { a1: '100', a2: '0' } }, people)).toEqual(['Daniel'])
  })
})

// A PRONOUN IS A RECORDED ANSWER OR IT IS NOT USED.
describe('a pronoun', () => {
  it('comes off the gender box', () => {
    expect(pronounFor(DANIEL)).toBe('he')
    expect(pronounFor(PRIYA)).toBe('she')
  })

  it('and is empty when the fact find does not say', () => {
    expect(pronounFor(NOSAY)).toBe('')
    expect(pronounFor({})).toBe('')
    expect(pronounFor(null)).toBe('')
  })
})

describe('how the sentence opens', () => {
  it('names the owner the first time', () => {
    expect(ownsOpener(['Daniel'], people, null)).toBe('Daniel owns')
    expect(ownsOpener(['Daniel', 'Priya'], people, null)).toBe('Daniel and Priya own')
  })

  // THE WHOLE POINT. The second and third sentences stop repeating the first.
  it('and uses the pronoun when it is the same owner again', () => {
    expect(ownsOpener(['Daniel'], people, ['Daniel'])).toBe('He also owns')
    expect(ownsOpener(['Priya'], people, ['Priya'])).toBe('She also owns')
    expect(ownsOpener(['Daniel', 'Priya'], people, ['Daniel', 'Priya'])).toBe('They also own')
  })

  it('repeating the name rather than guessing a pronoun', () => {
    expect(ownsOpener(['Alex'], people, ['Alex'])).toBe('Alex also owns')
  })

  // WHEN THE OWNER CHANGES, SAY SO. That is the thing worth noticing.
  it('names them again the moment the owner is different', () => {
    expect(ownsOpener(['Priya'], people, ['Daniel'])).toBe('Priya owns')
    expect(ownsOpener(['Daniel'], people, ['Daniel', 'Priya'])).toBe('Daniel owns')
  })

  it('and where the fact find records nobody it reads as it always has', () => {
    expect(ownsOpener([], people, null)).toBe('They own')
    expect(ownsOpener([], people, [])).toBe('They also own')
  })
})

describe('the country comes off the address', () => {
  it('however it was written', () => {
    expect(plainAddress('14 Marrack St, Kingswood NSW 2747, Australia'))
      .toBe('14 Marrack St, Kingswood NSW 2747')
    expect(plainAddress('14 Marrack St, Kingswood NSW 2747 Australia'))
      .toBe('14 Marrack St, Kingswood NSW 2747')
    expect(plainAddress('6 Dunmore Ln, Armidale NSW 2350, AUSTRALIA'))
      .toBe('6 Dunmore Ln, Armidale NSW 2350')
  })

  it('and an address that never had it is untouched', () => {
    expect(plainAddress('14 Marrack St, Kingswood NSW 2747'))
      .toBe('14 Marrack St, Kingswood NSW 2747')
    expect(plainAddress('')).toBe('')
    expect(plainAddress(null)).toBe('')
  })

  // AUSTRALIA STREET, NEWTOWN IS A REAL ADDRESS.
  it('and it only ever takes it off the end', () => {
    expect(plainAddress('12 Australia St, Newtown NSW 2042, Australia'))
      .toBe('12 Australia St, Newtown NSW 2042')
  })
})
