import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { tidyName, unDoubled, clientName } from './a-name-is-a-name'

// A NAME IS WRITTEN DOWN THE WAY IT IS SAID.
//
// 3 Nov 2026, found while reading a list of deals that had been hidden for a
// month:
//
//   " Kathleen  Kathleen Stone"   first "Kathleen", last "Kathleen Stone"
//   " Matthew Clements"           a leading space
//   "Aaron ."                     a full stop where a surname should be
//   "Hameed  Abdul Jabbar"        two spaces
//
// None of these is a typo somebody made twice. They are what happens when a
// name is taken from one place and put in another without being looked at.
//
// It matters because a client's name is not decoration: it goes on the deal
// card, into the email that greets them, onto the Fact Find PDF and into the
// lender's portal. "Dear Kathleen Kathleen" is a mistake a client remembers.

describe('SPACE IS NOT PART OF A NAME', () => {
  it('front, back and middle', () => {
    expect(tidyName(' Matthew Clements')).toBe('Matthew Clements')
    expect(tidyName('Hameed  Abdul Jabbar')).toBe('Hameed Abdul Jabbar')
    expect(tidyName('Elizabeth Cardey ')).toBe('Elizabeth Cardey')
  })

  it('AND A SURNAME THAT IS A FULL STOP IS NOT A SURNAME', () => {
    // An import that would not leave a column empty. A name is never one piece
    // of punctuation, so there is nothing to lose.
    expect(tidyName('.')).toBe('')
    expect(tidyName(' - ')).toBe('')
  })

  it('and nothing stays nothing', () => {
    expect(tidyName('')).toBe('')
    expect(tidyName(null)).toBe('')
    expect(tidyName(undefined)).toBe('')
  })
})

describe('THE FIRST NAME SAID TWICE', () => {
  it('is one person whose full name went in the surname box', () => {
    expect(unDoubled('Kathleen', 'Kathleen Stone'))
      .toEqual({ first: 'Kathleen', last: 'Stone' })
  })

  it('and the spaces around it go too', () => {
    expect(clientName(' Kathleen ', ' Kathleen  Stone '))
      .toEqual({ first_name: 'Kathleen', last_name: 'Stone' })
  })

  it('AND A REAL NAME IS NEVER CORRECTED', () => {
    // Nothing is guessed here. A portal that tidies up names it does not
    // recognise is worse than one that leaves them alone.
    expect(unDoubled('Juan', 'de la Cruz')).toEqual({ first: 'Juan', last: 'de la Cruz' })
    expect(unDoubled('Anne', 'Marie Anne')).toEqual({ first: 'Anne', last: 'Marie Anne' })
    expect(unDoubled('Stone', 'Stonehouse')).toEqual({ first: 'Stone', last: 'Stonehouse' })
  })

  it('AND A SURNAME THAT IS ONLY THE FIRST NAME IS LEFT ALONE', () => {
    // "James James" is a person, and taking the surname off would leave them
    // without one. Only a surname with something AFTER the repeat is trimmed.
    expect(unDoubled('James', 'James')).toEqual({ first: 'James', last: 'James' })
  })

  it('and capitals do not hide the repeat', () => {
    expect(unDoubled('kathleen', 'Kathleen Stone'))
      .toEqual({ first: 'kathleen', last: 'Stone' })
  })

  it('and a missing half is left as it is', () => {
    expect(unDoubled('Aaron', '')).toEqual({ first: 'Aaron', last: '' })
    expect(unDoubled('', 'Stone')).toEqual({ first: '', last: 'Stone' })
  })
})

describe('AND IT IS DONE WHERE THE CLIENT IS WRITTEN', () => {
  // Not on the way out. Fixing it where it is shown leaves the record wrong,
  // and every PDF built from that record still says the wrong thing.
  it.each([
    ['the new deal modal', 'app/(app)/deals/page.tsx'],
    ['a review becoming a deal', 'components/ReviewActions.tsx'],
  ])('%s', (_what, f) => {
    expect(readFileSync(f, 'utf8')).toContain('clientName(')
  })
})
