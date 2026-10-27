// THE TEAM DIRECTORY, LIVE.
//
// 27 Oct 2026. Catherine, Operations Manager, item 9 of nine: "Live group
// directory - in the portal or Teams, instead of a PDF on the shared drive."
//
// The fixture below is the real PDF, abbreviated: people across more than one
// business, both offices, and the rows on it that have no name.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  personFromRow, blankPerson, matches, byBusiness, businessesIn, isReal,
} from './the-directory'

const ROWS = [
  { id: '1', business: 'Simplify Finance', name: 'Fabio De Castro', role: 'Director/Broker',
    email: 'fabio@simplifyfinance.com.au', phone: '0432 489 152', location: 'AU', sort_order: 130 },
  { id: '2', business: 'Simplify Finance', name: 'Katie Amos', role: 'Credit Support Manager',
    email: 'katie@simplifyfinance.com.au', phone: '(02) 9466 2496', location: 'AU', sort_order: 90 },
  { id: '3', business: 'Simplify Finance', name: 'Cris Po', role: 'Client Services Officer',
    email: 'cris@simplifyfinance.com.au', phone: '(02) 9466 2471', location: 'PH', sort_order: 20 },
  { id: '4', business: 'Simplify Buyers Agency', name: 'John Halliday', role: 'Director',
    email: 'john@simplifyba.com.au', phone: '0407 248 619', location: 'AU', sort_order: 10 },
  { id: '5', business: 'Simplify Accounting', name: 'Brad Milovic', role: 'Senior Accountant',
    email: 'brad@simplifyaccounting.com.au', phone: '0475 623 538', location: 'AU', sort_order: 10 },
]

const people = ROWS.map(personFromRow)

describe('a row becomes a person', () => {
  it('with the location in capitals, however it was typed', () => {
    expect(personFromRow({ ...ROWS[0], location: 'au' }).location).toBe('AU')
  })

  it('a missing business falls back rather than reading blank', () => {
    expect(personFromRow({ id: 'x', name: 'Somebody' }).business).toBe('Simplify Finance')
  })

  it('and a new one starts empty but placed', () => {
    const p = blankPerson('Simplify Processing')
    expect(p.business).toBe('Simplify Processing')
    expect(p.name).toBe('')
    expect(p.id).toBe('')
  })
})

describe('finding somebody', () => {
  it('by name', () => {
    expect(byBusiness(people, 'katie')[0].people[0].name).toBe('Katie Amos')
  })

  it('by what they do, which is how people actually search', () => {
    const hits = byBusiness(people, 'client services').flatMap(g => g.people)
    expect(hits.map(p => p.name)).toEqual(['Cris Po'])
  })

  it('by which business they are in', () => {
    const hits = byBusiness(people, 'accounting').flatMap(g => g.people)
    expect(hits.map(p => p.name)).toEqual(['Brad Milovic'])
  })

  it('and by a phone number typed without its spaces', () => {
    // The number somebody pastes out of their phone has no spaces in it.
    expect(matches(people[0], '0432489152')).toBe(true)
    expect(matches(people[0], '0432 489 152')).toBe(true)
    // Katie's is (02) 9466 2496. Typed without punctuation it is 0294662496 -
    // this line said 0296462496 on the first go, which is a different number
    // and the reason the test failed rather than the code.
    expect(matches(people[1], '0294662496')).toBe(true)
    expect(matches(people[1], '(02) 9466 2496')).toBe(true)
    expect(matches(people[1], '9466')).toBe(true)
    // And a number that is genuinely not theirs still does not match.
    expect(matches(people[1], '0296462496')).toBe(false)
  })

  it('an empty search finds everybody', () => {
    expect(byBusiness(people, '').flatMap(g => g.people)).toHaveLength(5)
    expect(byBusiness(people).flatMap(g => g.people)).toHaveLength(5)
  })

  it('and a search nobody matches finds nobody, not everybody', () => {
    expect(byBusiness(people, 'zzzz')).toEqual([])
  })
})

describe('how it is grouped', () => {
  it('by business, and the businesses in order', () => {
    expect(byBusiness(people).map(g => g.business))
      .toEqual(['Simplify Accounting', 'Simplify Buyers Agency', 'Simplify Finance'])
  })

  it('and inside a business, the order the PDF had', () => {
    // Directors at the bottom of their own team. That order carried meaning
    // and alphabetical would have been tidier and wrong.
    const finance = byBusiness(people).find(g => g.business === 'Simplify Finance')!
    expect(finance.people.map(p => p.name)).toEqual(['Cris Po', 'Katie Amos', 'Fabio De Castro'])
  })

  it('two people on the same rung fall back to their names', () => {
    const tied = [
      personFromRow({ id: 'a', business: 'X', name: 'Zoe', sort_order: 10 }),
      personFromRow({ id: 'b', business: 'X', name: 'Adam', sort_order: 10 }),
    ]
    expect(byBusiness(tied)[0].people.map(p => p.name)).toEqual(['Adam', 'Zoe'])
  })

  it('a business with nobody left after a search is not an empty heading', () => {
    expect(byBusiness(people, 'katie').map(g => g.business)).toEqual(['Simplify Finance'])
  })

  it('and the count of businesses is the count of businesses', () => {
    expect(businessesIn(people)).toHaveLength(3)
  })
})

describe('a row with no name is not a person', () => {
  it('which is why the directory counts 29 and the PDF says 35', () => {
    // Six rows on the PDF have no name - one reads "B", one reads "(", four
    // are blank with only a location. They were left out rather than invented.
    expect(isReal(personFromRow({ id: 'x', name: 'B' }))).toBe(false)
    expect(isReal(personFromRow({ id: 'x', name: '(' }))).toBe(false)
    expect(isReal(personFromRow({ id: 'x', name: '' }))).toBe(false)
    expect(isReal(personFromRow({ id: 'x', name: '  ' }))).toBe(false)
    expect(isReal(people[0])).toBe(true)
  })
})

describe('the screen', () => {
  const list = readFileSync('components/DirectoryList.tsx', 'utf8')
  const sidebar = readFileSync('components/Sidebar.tsx', 'utf8')

  it('has its own tab, not a corner of Team', () => {
    // Fabio, 27 Oct 2026: "I want a directy tab". Team is an admin screen for
    // logins and roles; most people on this directory have no login at all.
    expect(sidebar).toContain('href: "/directory"')
    expect(sidebar.indexOf('href: "/directory"'), 'the directory is behind the admin gate')
      .toBeLessThan(sidebar.indexOf('const adminNav'))
  })

  it('anybody can add, edit and remove', () => {
    // Fabio: "please alwasy have ability to edit and delete and add". A
    // directory you have to ask an admin to correct is the PDF again.
    expect(list).toContain('+ Add somebody')
    expect(list).toContain('>Edit<')
    expect(list).toContain(".delete().eq('id', id)")
  })

  it('and removing somebody asks first', () => {
    expect(list).toContain('Remove {p.name}?')
  })

  it('the write is checked, because RLS refuses by returning nothing', () => {
    expect(list).toContain('if (error || !data?.length)')
  })

  it('and it draws a shape while it loads rather than the word Loading', () => {
    expect(list).toContain('<SkelRows')
  })
})
