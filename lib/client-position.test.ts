import { describe, it, expect } from 'vitest'
import {
  ownsIt, shareOf, nobodyOwnsIt, holdingFor, positionFor, countIn,
  wouldEmptyTheClient, emptyRefusal, sourceLine, applicantName,
} from './client-position'

const megan = { id: 'a1', clientId: 'c1', firstName: 'Megan', lastName: 'Isherwood' }
const dylan = { id: 'a2', clientId: 'c2', firstName: 'Dylan', lastName: 'Smyth' }

describe('reading an ownership record', () => {
  // Properties carry percentages, liabilities and assets carry Yes/blank. Both
  // shapes have been in the fact find since it was written.
  it('understands a percentage and a tickbox', () => {
    expect(ownsIt({ a1: '50' }, 'a1')).toBe(true)
    expect(ownsIt({ a1: 'Yes' }, 'a1')).toBe(true)
    expect(ownsIt({ a1: '100%' }, 'a1')).toBe(true)
  })

  // '0' is a non-empty string, so the old `!!ownership[id]` test read it as
  // ownership and handed the asset to somebody recorded as owning none of it.
  it('nought per cent is not ownership', () => {
    expect(ownsIt({ a1: '0' }, 'a1')).toBe(false)
    expect(ownsIt({ a1: '' }, 'a1')).toBe(false)
    expect(ownsIt({}, 'a1')).toBe(false)
    expect(ownsIt(null, 'a1')).toBe(false)
  })

  it('gives back the share only where one was recorded', () => {
    expect(shareOf({ a1: '50' }, 'a1')).toBe(50)
    // A tickbox never said what share. Deciding it is 50% because there are two
    // applicants would be inventing a figure.
    expect(shareOf({ a1: 'Yes' }, 'a1')).toBeNull()
    expect(shareOf({ a1: '0' }, 'a1')).toBeNull()
  })

  it('knows when nobody owns something', () => {
    expect(nobodyOwnsIt({}, ['a1', 'a2'])).toBe(true)
    expect(nobodyOwnsIt({ a2: 'Yes' }, ['a1', 'a2'])).toBe(false)
  })
})

describe('what one applicant holds', () => {
  it('a sole item, with its share', () => {
    const h = holdingFor({ a1: '100' }, megan, [megan, dylan])
    expect(h).toEqual({ share: 100, jointWith: [], ownershipConfirmed: true })
  })

  it('a joint item names the other owner, at full value', () => {
    const h = holdingFor({ a1: '50', a2: '50' }, megan, [megan, dylan])
    expect(h?.jointWith).toEqual(['Dylan Smyth'])
    // The share is recorded; the VALUE is never halved. Halving invents a figure
    // that is in no document.
    expect(h?.share).toBe(50)
  })

  it('an item somebody else owns is not theirs', () => {
    expect(holdingFor({ a2: 'Yes' }, megan, [megan, dylan])).toBeNull()
  })

  // The silent loss this whole file exists to stop. Liabilities and assets are
  // tickboxes and are NOT filled in automatically, so an untouched car loan
  // belongs to nobody and used to drop out of both clients' records.
  it('an item nobody assigned goes to everybody, and says so', () => {
    const h = holdingFor({}, megan, [megan, dylan])
    expect(h).not.toBeNull()
    expect(h?.ownershipConfirmed).toBe(false)
    expect(h?.jointWith).toEqual(['Dylan Smyth'])
  })

  it('on a one-applicant deal there is nothing to confirm', () => {
    const h = holdingFor({}, megan, [megan])
    expect(h).toEqual({ share: null, jointWith: [], ownershipConfirmed: true })
  })
})

describe('a whole position, taken off a deal', () => {
  const factFind = {
    applicants: [megan, dylan],
    properties: [
      { id: 'p1', address: 'Haberfield', ownership: { a1: '50', a2: '50' } },
      { id: 'p2', address: 'Marrickville', ownership: { a1: '100' } },
      { id: 'p3', address: "Dylan's flat", ownership: { a2: '100' } },
    ],
    liabilities: [
      { id: 'l1', liabilityType: 'Car loan', ownership: { a1: 'Yes' } },
      { id: 'l2', liabilityType: 'Credit card', ownership: {} },   // nobody ticked
    ],
    assets: [{ id: 's1', assetType: 'Super', ownership: { a1: 'Yes' } }],
  }

  it('gives one client only what is theirs', () => {
    const p = positionFor(factFind, megan)
    expect(p.properties.map(x => x.id)).toEqual(['p1', 'p2'])
    expect(p.liabilities.map(x => x.id)).toEqual(['l1', 'l2'])
    expect(p.assets.map(x => x.id)).toEqual(['s1'])
    expect(countIn(p)).toBe(5)
  })

  it('counts what nobody had assigned, so it can be said out loud', () => {
    expect(positionFor(factFind, megan).unconfirmed).toBe(1)
    expect(positionFor(factFind, dylan).unconfirmed).toBe(1)
  })

  it('the unassigned card reaches BOTH of them rather than neither', () => {
    expect(positionFor(factFind, dylan).liabilities.map(x => x.id)).toEqual(['l2'])
  })
})

describe('the guard', () => {
  const empty = { properties: [], liabilities: [], assets: [], unconfirmed: 0 }
  const full = { properties: [{}, {}], liabilities: [{}], assets: [{}], unconfirmed: 0 }

  it('refuses to leave a client who held a book holding nothing', () => {
    expect(wouldEmptyTheClient({ properties: [{}, {}], liabilities: [{}], assets: [{}] }, empty)).toBe(true)
  })

  it('allows a first capture on a client who held nothing', () => {
    expect(wouldEmptyTheClient(null, empty)).toBe(false)
    expect(wouldEmptyTheClient({ properties: [], liabilities: [], assets: [] }, full)).toBe(false)
  })

  it('does not fire on a client holding one or two odds and ends', () => {
    expect(wouldEmptyTheClient({ properties: [{}], liabilities: [], assets: [] }, empty)).toBe(false)
  })

  it('says what it refused, and what to do instead', () => {
    const msg = emptyRefusal('Megan Isherwood', { properties: [{}, {}], liabilities: [{}], assets: [{}] })
    expect(msg).toContain('NOT SAVED')
    expect(msg).toContain('4 things')
    expect(msg).toContain('Nothing has been changed')
  })
})

describe('saying where a position came from', () => {
  it('a settlement reads differently from an application', () => {
    expect(sourceLine('settlement', 'Chapman 2026')).toBe('As at the settlement of Chapman 2026')
    expect(sourceLine('application', 'Chapman 2026')).toBe('As declared on the application of Chapman 2026')
  })

  it('a closed deal says no loan was written', () => {
    expect(sourceLine('deal closed', 'Chapman 2026')).toContain('did not proceed')
  })

  it('reads properly with no deal named', () => {
    expect(sourceLine('settlement')).toBe('As at the settlement')
  })

  it('names an applicant without inventing one', () => {
    expect(applicantName(megan)).toBe('Megan Isherwood')
    expect(applicantName({ id: 'x' })).toBe('the other applicant')
  })
})
