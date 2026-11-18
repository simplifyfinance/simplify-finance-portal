import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  signerFor, isTheBroker, brokerCopy, replyTo, signatureNote,
  theTeamIsSigning, teamName, TEAM_EMAIL,
} from './nobody-signs-for-somebody-else'
import { TEMPLATES } from './milestone-emails'

// NOBODY SIGNS FOR SOMEBODY ELSE.
//
// 19 Nov 2026. Catherine, on a formal approval that reached her client: "Is
// coming from Melissa - her name and email sig - was that intentional, or
// should it be broker?"
//
// Fabio: "I never want a staff member to impersonate a broker... if it's the
// broker on the file, send an email as the broker. If it's anyone else, the
// signature should say the team as Simplify Finance and CC the broker."

const justin = {
  name: 'Justin Cornock', email: 'justin@simplifyfinance.com.au',
  phone: '0400 000 111', userId: 'u-justin',
}
const himself = { id: 'u-justin', name: 'Justin C', email: 'justin@simplifyfinance.com.au', phone: '0400 000 111' }
const mellissa = { id: 'u-mel', name: 'Mellissa Sedin', email: 'mellissa@simplifyfinance.com.au', phone: '0400 000 222' }

describe('the broker sending his own file', () => {
  it('is recognised by his login, never by his name', () => {
    expect(isTheBroker(himself, justin)).toBe(true)
    // Same name, different login. A name match here means somebody signs as
    // somebody else, which is the whole thing this file exists to stop.
    expect(isTheBroker({ ...himself, id: 'u-other' }, justin)).toBe(false)
  })

  it('signs as himself, off the register', () => {
    const who = signerFor(himself, justin, 'Simplify Finance')
    expect(who.name).toBe('Justin Cornock')
    expect(who.email).toBe('justin@simplifyfinance.com.au')
    expect(who.phone).toBe('0400 000 111')
  })

  it('and is not copied on his own email', () => {
    expect(brokerCopy(himself, justin)).toEqual([])
  })
})

describe('anybody else sending it', () => {
  it('signs as the team, never as the broker', () => {
    const who = signerFor(mellissa, justin, 'Simplify Finance')
    expect(who.name).toBe('The team at Simplify Finance')
    expect(who.name).not.toContain('Justin')
    expect(who.name).not.toContain('Mellissa')
    expect(who.email).toBe(TEAM_EMAIL)
    expect(theTeamIsSigning(mellissa, justin)).toBe(true)
  })

  it('and the broker is copied', () => {
    expect(brokerCopy(mellissa, justin)).toEqual(['justin@simplifyfinance.com.au'])
  })

  it('with the reply landing on the broker first', () => {
    expect(replyTo(mellissa, justin))
      .toEqual(['justin@simplifyfinance.com.au', 'mellissa@simplifyfinance.com.au'])
  })

  it('and the screen says so before the send', () => {
    const note = signatureNote(mellissa, justin, 'Simplify Finance')
    expect(note).toContain('The team at Simplify Finance')
    expect(note).toContain('Justin Cornock')
    expect(note).toContain('Replies go to him')
  })
})

// A SECOND BRAND IS A DIFFERENT COMPANY AT THE FOOT OF THE EMAIL.
describe('the team wears the deal’s own brand', () => {
  it('not always Simplify Finance', () => {
    expect(teamName('New Blue Finance')).toBe('The team at New Blue Finance')
    expect(signerFor(mellissa, justin, 'New Blue Finance').name)
      .toBe('The team at New Blue Finance')
  })

  it('and falls back to ours where no brand resolved', () => {
    expect(teamName('')).toBe('The team at Simplify Finance')
  })
})

describe('a broker nobody has linked to a login', () => {
  const unlinked = { name: 'Luke Suidgeest', email: '', phone: '', userId: '' }

  it('cannot be matched, so the team signs - the safe way round', () => {
    expect(isTheBroker(mellissa, unlinked)).toBe(false)
    expect(signerFor(mellissa, unlinked, 'Simplify Finance').name)
      .toBe('The team at Simplify Finance')
  })

  it('cannot be copied, and the screen says why rather than inventing one', () => {
    expect(brokerCopy(mellissa, unlinked)).toEqual([])
    expect(signatureNote(mellissa, unlinked, 'Simplify Finance'))
      .toContain('no email address on his record')
  })
})

describe('no deal with a broker on it at all', () => {
  it('the team signs and nobody is copied, said out loud', () => {
    expect(signerFor(mellissa, null).name).toBe('The team at Simplify Finance')
    expect(brokerCopy(mellissa, null)).toEqual([])
    expect(signatureNote(mellissa, null)).toContain('No broker is recorded')
  })
})

// THE DROPDOWN IS GONE.
//
// The final check-in had one: pick a broker, send as him. That is the
// impersonation Fabio ruled out, and the booking button it carried now reads
// the broker on the file instead.
const ROUTE = readFileSync('app/api/send-milestone-email/route.ts', 'utf8')

describe('nobody picks a sender any more', () => {
  it('no template claims to', () => {
    expect(TEMPLATES.every(t => !t.picksSender)).toBe(true)
  })

  it('and the route does not offer one', () => {
    expect(ROUTE).not.toContain('brokerSender(')
    expect(ROUTE).toContain('signerFor(sender, broker')
  })

  it('the from line is the signer, not whoever pressed the button', () => {
    expect(ROUTE).toContain('from: `${who.name} <${fromAddress}>`')
    expect(ROUTE).not.toContain('from: `${sender.name}')
  })

  it('and the broker rides on the copy line of every one of them', () => {
    expect(ROUTE).toContain('...brokerCopy(sender, broker)')
    // Twice: the preview and the send, so what you are shown is what goes.
    expect(ROUTE.split('...brokerCopy(sender, broker)').length - 1).toBe(2)
  })
})
