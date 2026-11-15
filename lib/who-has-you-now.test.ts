import { describe, it, expect } from 'vitest'
import {
  handoverLine, firstNameOf, namesInWords, suggestedContacts, pickOrder,
  isSendingThemselves, NO_NEW_CREDIT, type Person,
} from './who-has-you-now'

const belle: Person = { id: '1', name: 'Belle Tran', email: 'belle@s.com', settlements: true }
const julian: Person = { id: '2', name: 'Julian Kok', email: 'julian@s.com', settlements: true }
const kylie: Person = { id: '3', name: 'Kylie Mason', email: 'kylie@s.com', settlements: false }

describe('who is pre-selected', () => {
  // "Julian and Belle is generally what we like to introduce" - and that lives
  // in Settings, Team, not in this file.
  it('whoever has the settlements box ticked', () => {
    expect(suggestedContacts([belle, julian, kylie]).map(p => p.name))
      .toEqual(['Belle Tran', 'Julian Kok'])
  })

  it('and nobody where nobody is ticked', () => {
    expect(suggestedContacts([kylie])).toEqual([])
  })

  it('the pick list puts settlements first but keeps everyone', () => {
    expect(pickOrder([kylie, julian, belle]).map(p => p.name))
      .toEqual(['Belle Tran', 'Julian Kok', 'Kylie Mason'])
  })
})

describe('the sentence follows the choice', () => {
  it('first person when the only person introduced is the sender', () => {
    const line = handoverLine({ contacts: [belle], senderEmail: 'belle@s.com', brokerName: 'Marco Ferreira' })
    expect(line).toContain('I’ll be looking after your settlement')
  })

  // THE BUG THIS WHOLE THING EXISTS FOR. Kylie sending it must not claim she
  // is running the settlement.
  it('third person when somebody else sends it', () => {
    const line = handoverLine({ contacts: [belle], senderEmail: 'kylie@s.com' })
    expect(line).toContain('Belle Tran will be looking after your settlement')
    expect(line).not.toContain('I’ll be looking after')
  })

  it('both names where two people are introduced', () => {
    const line = handoverLine({ contacts: [belle, julian], senderEmail: 'kylie@s.com' })
    expect(line).toContain('Belle Tran and Julian Kok will be looking after')
  })

  // Belle introducing Belle AND Julian cannot say "I" - half of it is Julian's.
  it('and never first person where somebody else is introduced too', () => {
    const line = handoverLine({ contacts: [belle, julian], senderEmail: 'belle@s.com' })
    expect(line).not.toContain('I’ll be looking after')
    expect(line).toContain('Belle Tran and Julian Kok')
  })

  // A broker who does not know yet sends something vaguer, and true.
  it('names the team where nobody is picked', () => {
    const line = handoverLine({ contacts: [], senderEmail: 'marco@s.com' })
    expect(line).toContain('Our settlements team will look after it')
    expect(line).not.toContain('undefined')
  })

  it('the broker is named at the end, by first name', () => {
    expect(handoverLine({ contacts: [belle], brokerName: 'Marco Ferreira' }))
      .toContain('Marco is still across the file')
    expect(handoverLine({ contacts: [belle], brokerName: '' }))
      .not.toContain('still across the file')
  })
})

describe('matching the sender', () => {
  // Two people can share a first name and no display name is spelled the same
  // in two tables.
  it('is done on email, not on name', () => {
    expect(isSendingThemselves([belle], 'BELLE@s.com')).toBe(true)
    expect(isSendingThemselves([belle], 'belle.tran@s.com')).toBe(false)
  })

  it('and never with nobody, or with more than one', () => {
    expect(isSendingThemselves([], 'belle@s.com')).toBe(false)
    expect(isSendingThemselves([belle, julian], 'belle@s.com')).toBe(false)
  })
})

describe('names in words', () => {
  it('reads like a person wrote it', () => {
    expect(namesInWords(['Belle Tran'])).toBe('Belle Tran')
    expect(namesInWords(['Belle Tran', 'Julian Kok'])).toBe('Belle Tran and Julian Kok')
    expect(namesInWords(['A', 'B', 'C'])).toBe('A, B and C')
  })

  it('and says nothing from nothing', () => {
    expect(namesInWords([])).toBe('')
    expect(namesInWords(['', '  '])).toBe('')
  })
})

describe('first names', () => {
  it('takes the first word', () => {
    expect(firstNameOf('Marco Ferreira')).toBe('Marco')
  })
  it('and nothing from nothing', () => {
    expect(firstNameOf(null)).toBe('')
  })
})

describe('the credit warning', () => {
  it('names what people actually do', () => {
    expect(NO_NEW_CREDIT).toContain('car loan')
    expect(NO_NEW_CREDIT).toContain('buy now pay later')
  })
  it('and gives them somewhere to go', () => {
    expect(NO_NEW_CREDIT).toContain('call us first')
  })
})
