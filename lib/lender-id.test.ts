// A NEAR MISS MUST NOT LOAD ANOTHER BANK'S ANSWERS.
//
// The rules table is keyed on lenders.id and the deal carries a name. If that
// lookup ever guesses, a client gets Bankwest's contract wording under ubank's
// name - the same class of mistake as the recommendation printing under the
// lender the clients actually chose, which cost three ships to chase down.

import { describe, it, expect } from 'vitest'
import { lenderIdFrom, norm } from './lender-id'

const LENDERS = [
  { id: 'id-bankwest', name: 'Bankwest', aliases: ['Bank of Western Australia'] },
  { id: 'id-ubank', name: 'ubank', aliases: ['UBank', 'U Bank'] },
  { id: 'id-anz', name: 'ANZ', aliases: null },
  { id: 'id-macq', name: 'Macquarie Bank', aliases: ['Macquarie'] },
]

describe('turning the name on a deal into a lender row', () => {
  it('matches the name however it was typed', () => {
    expect(lenderIdFrom(LENDERS, 'Bankwest')).toBe('id-bankwest')
    expect(lenderIdFrom(LENDERS, 'bankwest')).toBe('id-bankwest')
    expect(lenderIdFrom(LENDERS, 'Bank West')).toBe('id-bankwest')
  })

  it('matches a recorded alias', () => {
    expect(lenderIdFrom(LENDERS, 'U Bank')).toBe('id-ubank')
    expect(lenderIdFrom(LENDERS, 'Macquarie')).toBe('id-macq')
  })

  // THE ONE THAT MATTERS. "Bank" is inside four of these names. A contains-match
  // would hand back whichever row came first.
  it('gives back nothing rather than the nearest thing', () => {
    expect(lenderIdFrom(LENDERS, 'Bank')).toBe('')
    expect(lenderIdFrom(LENDERS, 'Bankwest Business')).toBe('')
    expect(lenderIdFrom(LENDERS, 'Macquarie Bank Limited')).toBe('')
    expect(lenderIdFrom(LENDERS, 'Some Lender We Have Never Used')).toBe('')
  })

  it('gives back nothing for no name and for no lenders', () => {
    expect(lenderIdFrom(LENDERS, '')).toBe('')
    expect(lenderIdFrom(LENDERS, null)).toBe('')
    expect(lenderIdFrom(null, 'ANZ')).toBe('')
    expect(lenderIdFrom([], 'ANZ')).toBe('')
  })

  it('lets a name of its own beat somebody else’s alias', () => {
    const clash = [
      { id: 'id-other', name: 'Other Bank', aliases: ['ANZ'] },
      { id: 'id-anz', name: 'ANZ', aliases: null },
    ]
    expect(lenderIdFrom(clash, 'ANZ')).toBe('id-anz')
  })

  it('normalises punctuation and spacing out of the way', () => {
    expect(norm('St. George')).toBe(norm('stgeorge'))
    expect(norm('  ME  Bank ')).toBe('mebank')
  })
})
