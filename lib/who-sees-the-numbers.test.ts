// WHO SEES WHICH NUMBERS.
//
// 11 Nov 2026. The Lodged and settled page shipped open to anybody signed in,
// which put every broker's figures and every referral partner's terms in front
// of the whole office. Fabio: "these friday email capabilities and reporting
// only available to whomever have admin access?"
import { describe, it, expect } from 'vitest'
import { viewFor, dealsFor, mayEmail, VIEW_NOTE } from './who-sees-the-numbers'

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

describe('what the three views actually differ on', () => {
  // THIS TEST SAID THE OPPOSITE FOR A DAY.
  //
  // The first version kept dollars and referral terms to admin, on the
  // reasoning that commission is admin only everywhere else in the portal.
  // Fabio, asked straight out: the whole team, same detail. The people doing
  // the work can see the work, and a report somebody has to ask a colleague to
  // read out is a report nobody uses.
  it('shows staff everything an admin sees', () => {
    expect(VIEW_NOTE.team).toBe(VIEW_NOTE.everything)
  })

  // What stays with admin is SENDING, not knowing. One of those emails goes to
  // a referral partner, and nothing about a referral relationship leaves this
  // building without Fabio or Alan pressing it.
  it('and keeps only the sending to admin', () => {
    expect(mayEmail('everything')).toBe(true)
    expect(mayEmail('team')).toBe(false)
    expect(mayEmail('mine')).toBe(false)
  })

  it('every view says on screen what it is', () => {
    for (const v of ['everything', 'mine', 'team'] as const) {
      expect(VIEW_NOTE[v].length).toBeGreaterThan(10)
    }
    expect(VIEW_NOTE.mine).toContain('not here')
  })
})
