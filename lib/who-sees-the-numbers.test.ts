// WHO SEES WHICH NUMBERS.
//
// 11 Nov 2026. The Lodged and settled page shipped open to anybody signed in,
// which put every broker's figures and every referral partner's terms in front
// of the whole office. Fabio: "these friday email capabilities and reporting
// only available to whomever have admin access?"
import { describe, it, expect } from 'vitest'
import {
  viewFor, dealsFor, showsMoney, showsReferral, showsBrokers, mayEmail, VIEW_NOTE,
} from './who-sees-the-numbers'

// The three roles as they actually stand: five admins, two brokers, ten staff.
describe('the role decides, and nobody is named', () => {
  it('reads the role already on the login', () => {
    expect(viewFor('admin')).toBe('everything')
    expect(viewFor('broker')).toBe('mine')
    expect(viewFor('staff')).toBe('team')
  })

  it('is not fussy about how it was typed', () => {
    expect(viewFor(' Admin ')).toBe('everything')
    expect(viewFor('BROKER')).toBe('mine')
  })

  // A role added next year must not arrive holding the commission figures.
  it('gives anything unrecognised the smallest view', () => {
    for (const r of ['', null, undefined, 'support', 'superuser']) {
      expect(viewFor(r as any), String(r)).toBe('team')
    }
  })
})

describe('whose deals', () => {
  const deals = [
    { id: 'a', assigned_broker: 'justin' },
    { id: 'b', assigned_broker: 'keanen' },
    { id: 'c', assigned_broker: 'Fabio' },
  ]

  it('an admin sees every one', () => {
    expect(dealsFor('everything', deals, 'fabio')).toHaveLength(3)
  })

  // Broker keys are stored both ways round in the live table - "Fabio" with a
  // capital, everybody else lower - so matching has to ignore it.
  it('a broker sees their own, whatever case the key is in', () => {
    expect(dealsFor('mine', deals, 'justin').map(d => d.id)).toEqual(['a'])
    expect(dealsFor('mine', deals, 'FABIO').map(d => d.id)).toEqual(['c'])
  })

  // THE FAILURE HAS TO BE IN THE SAFE DIRECTION. An empty page is a question
  // somebody asks, which is how it gets fixed. Everybody's deals is not.
  it('a broker with no key sees nothing rather than everything', () => {
    expect(dealsFor('mine', deals, '')).toEqual([])
    expect(dealsFor('mine', deals, null)).toEqual([])
  })

  it('and the team view is the whole team, which is the point of it', () => {
    expect(dealsFor('team', deals, '')).toHaveLength(3)
  })
})

describe('which columns', () => {
  // Commission is admin only everywhere else in this portal. A report printing
  // "Justin Cornock 50%, Simplify 50%" is the same information in a hat.
  it('keeps referral terms to admin', () => {
    expect(showsReferral('everything')).toBe(true)
    expect(showsReferral('mine')).toBe(false)
    expect(showsReferral('team')).toBe(false)
  })

  it('keeps one broker’s figures away from another', () => {
    expect(showsBrokers('everything')).toBe(true)
    expect(showsBrokers('mine')).toBe(false)
  })

  // A broker sees what their own deals are worth. The rest of the team get
  // counts - what a deal is worth is not a question their job asks.
  it('holds the money back below broker', () => {
    expect(showsMoney('everything')).toBe(true)
    expect(showsMoney('mine')).toBe(true)
    expect(showsMoney('team')).toBe(false)
  })

  // Nothing about a referral relationship leaves the building without an admin
  // pressing it.
  it('and the Friday emails are admin only, both of them', () => {
    expect(mayEmail('everything')).toBe(true)
    expect(mayEmail('mine')).toBe(false)
    expect(mayEmail('team')).toBe(false)
  })

  it('every view says on screen what it is not showing', () => {
    for (const v of ['everything', 'mine', 'team'] as const) {
      expect(VIEW_NOTE[v].length).toBeGreaterThan(10)
    }
    expect(VIEW_NOTE.mine).toContain('not here')
    expect(VIEW_NOTE.team).toContain('not here')
  })
})
