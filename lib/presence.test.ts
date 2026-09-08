import { describe, it, expect } from 'vitest'
import { stillHere, initials, chipTitle, sameTabNames, names,
         GONE_AFTER_SECONDS, type Presence } from './presence'

const p = (o: Partial<Presence>): Presence =>
  ({ userId: 'u1', name: 'Katie Amos', tab: 'Fact Find', secondsAgo: 5, ...o })

describe('who is still here', () => {
  it('leaves me out of my own list', () => {
    expect(stillHere([p({ userId: 'me' }), p({ userId: 'u2', name: 'Ellie' })], 'me').map(r => r.name))
      .toEqual(['Ellie'])
  })

  // THE GHOST. Ellie was showing on eight deals at once because nothing here
  // could tell a live heartbeat from a four day old one.
  it('drops somebody whose heartbeat stopped', () => {
    expect(stillHere([p({ userId: 'u2', secondsAgo: 58388 })], 'me')).toEqual([])
  })

  it('keeps somebody who missed a beat', () => {
    expect(stillHere([p({ userId: 'u2', secondsAgo: 45 })], 'me')).toHaveLength(1)
  })

  it('drops one that went stale between the query and the screen', () => {
    expect(stillHere([p({ userId: 'u2', secondsAgo: GONE_AFTER_SECONDS })], 'me')).toEqual([])
  })

  it('reads the most recently active person first', () => {
    const out = stillHere([
      p({ userId: 'a', name: 'Old', secondsAgo: 50 }),
      p({ userId: 'b', name: 'New', secondsAgo: 2 }),
    ], 'me')
    expect(out.map(r => r.name)).toEqual(['New', 'Old'])
  })

  it('never trusts a missing or broken age', () => {
    expect(stillHere([p({ userId: 'u2', secondsAgo: NaN as any })], 'me')).toEqual([])
    expect(stillHere([p({ userId: 'u2', secondsAgo: undefined as any })], 'me')).toEqual([])
  })

  it('copes with nothing at all', () => {
    expect(stillHere(null, 'me')).toEqual([])
    expect(stillHere(undefined, 'me')).toEqual([])
    expect(stillHere([], 'me')).toEqual([])
  })
})

describe('the circle in the header', () => {
  it('takes the first and last initial', () => {
    expect(initials('Katie Amos')).toBe('KA')
    expect(initials('Sri Bindhu Kancharakuntla')).toBe('SK')
  })

  it('copes with one name', () => {
    expect(initials('Ellie')).toBe('E')
  })

  it('never renders empty', () => {
    expect(initials('')).toBe('?')
    expect(initials('   ')).toBe('?')
    expect(initials(null as any)).toBe('?')
  })

  it('says who and where on hover, as a fact', () => {
    expect(chipTitle(p({}))).toBe('Katie Amos — Fact Find')
  })

  it('still says something when the tab is unknown', () => {
    expect(chipTitle(p({ tab: '' }))).toBe('Katie Amos is in this deal')
  })
})

describe('naming whoever else is on this tab', () => {
  it('names them', () => {
    expect(sameTabNames([p({ tab: 'Fact Find' })], 'Fact Find')).toBe('Katie Amos')
  })

  it('ignores somebody on a different tab', () => {
    expect(sameTabNames([p({ tab: 'Compliance' })], 'Fact Find')).toBe('')
  })

  it('reads properly for two, and for three', () => {
    expect(names([p({ name: 'Katie Amos' }), p({ name: 'Ellie' })])).toBe('Katie Amos and Ellie')
    expect(names([p({ name: 'A' }), p({ name: 'B' }), p({ name: 'C' })])).toBe('A, B and C')
  })

  it('says something sensible when a name is missing', () => {
    expect(names([p({ name: '' })])).toBe('Somebody else')
  })
})
