import { describe, it, expect } from 'vitest'
import { RELATIONSHIP_STATUSES, needsPartner, partnerOptions,
         applyRelationship, relationshipLine } from './relationship'

const one = { id: 'a1', firstName: 'Matti', lastName: 'Hallanoro' }
const two = { id: 'a2', firstName: 'Elizabeth', lastName: 'Hallanoro' }
const blank = { id: 'a2', firstName: '', lastName: '' }

describe('which statuses ask about somebody else', () => {
  it('married, de facto and separated do', () => {
    for (const s of ['Married', 'De facto', 'Separated']) expect(needsPartner(s)).toBe(true)
  })
  it('single, divorced and widowed do not', () => {
    for (const s of ['Single', 'Divorced', 'Widowed', '']) expect(needsPartner(s)).toBe(false)
  })
  it('offers the six a lender asks for', () => {
    expect([...RELATIONSHIP_STATUSES]).toEqual(
      ['Single', 'Married', 'De facto', 'Separated', 'Divorced', 'Widowed'])
  })
})

describe('the "to whom" dropdown', () => {
  it('offers everybody but yourself', () => {
    expect(partnerOptions([one, two], 'a1')).toEqual([{ id: 'a2', label: 'Elizabeth Hallanoro' }])
  })

  // Applicant two is very often added before anybody types who they are.
  it('names an applicant nobody has filled in yet by their number', () => {
    expect(partnerOptions([one, blank], 'a1')).toEqual([{ id: 'a2', label: 'Applicant 2' }])
  })

  // The whole reason the id is stored rather than the name.
  it('shows the real name the moment it is typed, with nothing re-saved', () => {
    const before = applyRelationship([one, blank], 'a1', 'Married', 'a2')
    const named = [before[0], { ...before[1], firstName: 'Elizabeth', lastName: 'Hallanoro' }]
    expect(relationshipLine(named)).toBe('Married — Matti Hallanoro and Elizabeth Hallanoro')
  })
})

describe('setting it', () => {
  it('records the status and who it is with', () => {
    const [a, b] = applyRelationship([one, two], 'a1', 'Married', 'a2')
    expect(a.relationshipStatus).toBe('Married')
    expect(a.relatedToApplicantId).toBe('a2')
  })

  // Fabio: "applicant two, we don't have to worry about it."
  it('fills in the other person too, so nobody types it twice', () => {
    const [, b] = applyRelationship([one, two], 'a1', 'De facto', 'a2')
    expect(b.relationshipStatus).toBe('De facto')
    expect(b.relatedToApplicantId).toBe('a1')
  })

  it('leaves no half-marriage behind when the partner changes', () => {
    const three = { id: 'a3', firstName: 'Sam', lastName: 'Okafor' }
    const first = applyRelationship([one, two, three], 'a1', 'Married', 'a2')
    const moved = applyRelationship(first, 'a1', 'Married', 'a3')
    expect(moved.find(x => x.id === 'a2')!.relatedToApplicantId).toBe('')
    expect(moved.find(x => x.id === 'a3')!.relatedToApplicantId).toBe('a1')
  })

  it('clears the link when the status stops being about anybody', () => {
    const married = applyRelationship([one, two], 'a1', 'Married', 'a2')
    const single = applyRelationship(married, 'a1', 'Single', '')
    expect(single[0].relatedToApplicantId).toBe('')
    expect(single.find(x => x.id === 'a2')!.relatedToApplicantId).toBe('')
  })

  // Being single is a fact about you, not a claim about the other person.
  it('does not make the other person single too', () => {
    const married = applyRelationship([one, two], 'a1', 'Married', 'a2')
    const single = applyRelationship(married, 'a1', 'Single', '')
    expect(single.find(x => x.id === 'a2')!.relationshipStatus).toBe('Married')
  })
})

describe('the line the PDF prints', () => {
  it('names both people and how they are related', () => {
    expect(relationshipLine(applyRelationship([one, two], 'a1', 'Married', 'a2')))
      .toBe('Married — Matti Hallanoro and Elizabeth Hallanoro')
  })

  it('says nothing on a single-applicant deal', () => {
    expect(relationshipLine([one])).toBe('')
  })

  it('says nothing when nobody has answered', () => {
    expect(relationshipLine([one, two])).toBe('')
  })

  // Two siblings, say: both single, no pairing, and that is still worth saying.
  it('reports a status they agree on even with no pairing', () => {
    const both = [{ ...one, relationshipStatus: 'Single' }, { ...two, relationshipStatus: 'Single' }]
    expect(relationshipLine(both)).toBe('Single')
  })

  it('stays quiet rather than guessing when they disagree', () => {
    const mixed = [{ ...one, relationshipStatus: 'Single' }, { ...two, relationshipStatus: 'Divorced' }]
    expect(relationshipLine(mixed)).toBe('')
  })

  it('ignores a link to somebody who is no longer on the deal', () => {
    const orphan = [{ ...one, relationshipStatus: 'Married', relatedToApplicantId: 'gone' }, two]
    expect(relationshipLine(orphan)).toBe('')
  })
})
