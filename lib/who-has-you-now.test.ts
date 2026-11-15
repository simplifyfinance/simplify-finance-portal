import { describe, it, expect } from 'vitest'
import { handoverLine, firstNameOf, NO_NEW_CREDIT } from './who-has-you-now'

describe('the handover sentence', () => {
  // WRITTEN IN THE FIRST PERSON. The email is signed by the person sending it,
  // so naming them again above their own signature reads as though somebody
  // else wrote it about them.
  it('is the sender speaking, never the sender described', () => {
    const line = handoverLine('Marco Ferreira')
    expect(line).toContain('I’ll be looking after your settlement')
    expect(line).not.toMatch(/is running your settlement/)
  })

  // The client knows the broker and will ring them anyway.
  it('names the broker, by first name', () => {
    expect(handoverLine('Marco Ferreira')).toContain('Marco is still across the file')
    expect(handoverLine('Marco Ferreira')).not.toContain('Ferreira')
  })

  it('and says the first half alone where no broker is recorded', () => {
    const line = handoverLine('')
    expect(line).toContain('first point of contact')
    expect(line).not.toContain('still across the file')
  })

  // NOBODY ELSE IS INTRODUCED. The credit officer's work is done before this
  // email exists, and the client does not know what compliance is.
  it('introduces nobody else', () => {
    const line = handoverLine('Marco Ferreira')
    for (const word of ['credit', 'compliance', 'assessor']) {
      expect(line.toLowerCase(), word).not.toContain(word)
    }
  })
})

describe('first names', () => {
  it('takes the first word', () => {
    expect(firstNameOf('Marco Ferreira')).toBe('Marco')
    expect(firstNameOf('  Belle  Tran ')).toBe('Belle')
  })

  it('and nothing from nothing', () => {
    expect(firstNameOf('')).toBe('')
    expect(firstNameOf(null)).toBe('')
  })
})

describe('the credit warning', () => {
  // "Any new credit" sounds like it means a mortgage.
  it('names what people actually do', () => {
    expect(NO_NEW_CREDIT).toContain('car loan')
    expect(NO_NEW_CREDIT).toContain('buy now pay later')
  })

  // A WAY OUT, NOT A SCARE. Someone who needs a car should tell us, not hide it.
  it('and gives them somewhere to go', () => {
    expect(NO_NEW_CREDIT).toContain('call us first')
  })
})
