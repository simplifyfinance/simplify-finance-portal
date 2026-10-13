import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { offeringToTell, YES_TELL_ME, NOT_THE_LIBRARY } from './paco-takes-a-note'

const LENDERS = ['NAB', 'Macquarie', 'Bankwest', 'AMP', 'Bank of Sydney']

describe('being offered something, rather than asked something', () => {
  // THE ONE THAT STARTED IT. Paco matched the word savings and handed back an
  // unrelated NAB rule about family loans.
  it('takes Fabio’s sentence as the offer it was', () => {
    expect(offeringToTell('Can I give you the answer and you file on library?').offered).toBe(true)
  })

  it('and the rest of the ways a person says it', () => {
    for (const said of [
      'can I tell you?',
      'let me tell you how NAB handle it',
      "I'll tell you what they did",
      'I know the answer to this one',
      'I have the answer',
      'shall I tell you',
      'want me to add something',
      'remember this for next time',
      'can I add something',
      'note this down',
    ]) {
      expect(offeringToTell(said).offered, `"${said}" was not taken as an offer`).toBe(true)
    }
  })
})

// THE HALF THAT MATTERS MORE. A question misread as an offer stops him
// answering at all, which is worse than the clumsy reply we started with.
describe('a question is still a question', () => {
  it('does not mistake asking him for telling him', () => {
    for (const said of [
      'can you tell me NAB’s policy on casual income',
      'what can you tell me about Macquarie',
      'tell me about high density apartments',
      'tell me what AMP do with SMSF',
      'do you know if Bankwest take trust income',
      'NAB applicant living rent free',
      'what is AMP’s policy on high density apartments',
      'who have we used for limited title',
    ]) {
      expect(offeringToTell(said).offered, `"${said}" was taken as an offer`).toBe(false)
    }
  })

  it('and copes with nothing at all', () => {
    expect(offeringToTell('').offered).toBe(false)
    expect(offeringToTell(null).offered).toBe(false)
    expect(offeringToTell('   ').offered).toBe(false)
  })
})

describe('the bank they named comes across, so nobody types it twice', () => {
  it('picks the lender out of the offer', () => {
    expect(offeringToTell('can I tell you something about NAB', LENDERS).lender).toBe('NAB')
    expect(offeringToTell('let me tell you what Macquarie did', LENDERS).lender).toBe('Macquarie')
  })

  it('finds a bank whose name is more than one word', () => {
    expect(offeringToTell('I know the answer for Bank of Sydney', LENDERS).lender).toBe('Bank of Sydney')
  })

  // A THREE LETTER NAME MATCHES THREE LETTERS. Otherwise AMP turns up inside
  // "example" and the note is filed against the wrong bank.
  it('does not find a short name inside a longer word', () => {
    expect(offeringToTell('can I tell you about the ampersand', LENDERS).lender).toBe('')
    expect(offeringToTell('can I tell you about AMP', LENDERS).lender).toBe('AMP')
  })

  it('and says nothing when no bank was named', () => {
    expect(offeringToTell('can I tell you something', LENDERS).lender).toBe('')
    expect(offeringToTell('can I tell you something', []).lender).toBe('')
  })
})

// WHAT YOU TELL HIM IS NOT WHAT THE BANK WROTE DOWN.
describe('he says where it will actually land', () => {
  it('says yes, with the name and the date on it', () => {
    expect(YES_TELL_ME).toMatch(/your name/)
    expect(YES_TELL_ME).toMatch(/word for word/)
  })

  it('and corrects the thing everybody will assume', () => {
    expect(NOT_THE_LIBRARY).toMatch(/not in the library/)
    expect(NOT_THE_LIBRARY).toMatch(/what the lender wrote down/)
  })

  it('and never promises it becomes policy', () => {
    const both = `${YES_TELL_ME} ${NOT_THE_LIBRARY}`.toLowerCase()
    expect(both).not.toMatch(/becomes (the )?policy/)
    expect(both).not.toMatch(/as policy/)
  })
})

describe('the wiring', () => {
  const panel = readFileSync('components/Paco.tsx', 'utf8')

  // CHECKED BEFORE HE GOES LOOKING. The whole fault was that he answered
  // first and never considered he was being offered something.
  it('he looks for an offer before he searches for an answer', () => {
    expect(panel).toContain('offeringToTell(said')
    expect(panel.indexOf('offeringToTell(said'))
      .toBeLessThan(panel.indexOf('/api/paco?q='))
  })

  it('and opens the note box rather than guessing at a rule', () => {
    expect(panel).toContain('setTelling(true)')
    expect(panel).toContain('YES_TELL_ME')
    expect(panel).toContain('NOT_THE_LIBRARY')
  })
})
