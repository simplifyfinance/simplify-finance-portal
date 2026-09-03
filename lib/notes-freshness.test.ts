import { describe, it, expect } from 'vitest'
import { fingerprint, noteFacts, changesSince, noteFreshness, reviewNotes,
         type NoteFacts } from './notes-freshness'

const facts = (over: Partial<NoteFacts> = {}): NoteFacts => ({
  hash: 'aaa', lender: 'ING', loanAmount: '$1,700,000', purpose: 'Owner occupied',
  fundsToComplete: '$3,841,500', approval: 'Pre-approval', product: 'Orange Advantage', ...over,
})

describe('the fingerprint', () => {
  it('is the same answer every time for the same text', () => {
    expect(fingerprint('the facts')).toBe(fingerprint('the facts'))
  })

  it('moves when one character does', () => {
    expect(fingerprint('income $120,000')).not.toBe(fingerprint('income $130,000'))
  })

  it('copes with nothing at all', () => {
    expect(typeof fingerprint('')).toBe('string')
  })

  it('is built from the facts block, not the headline values', () => {
    const a = noteFacts({ lender: 'ING', loanAmount: '', purpose: '', fundsToComplete: '', approval: '', product: '' }, 'INCOME: $120,000')
    const b = noteFacts({ lender: 'ING', loanAmount: '', purpose: '', fundsToComplete: '', approval: '', product: '' }, 'INCOME: $130,000')
    expect(a.hash).not.toBe(b.hash)
  })
})

describe('what moved', () => {
  it('names the field and both values', () => {
    expect(changesSince(facts(), facts({ lender: 'Macquarie' })))
      .toEqual(['the lender changed from ING to Macquarie'])
  })

  it('reads a newly filled field as recorded, not changed from blank', () => {
    expect(changesSince(facts({ product: '' }), facts())[0])
      .toBe('the product was not recorded, and is now Orange Advantage')
  })

  it('says when something was cleared', () => {
    expect(changesSince(facts(), facts({ lender: '' }))[0])
      .toBe('the lender was ING, and is now blank')
  })

  it('lists everything that moved, not just the first', () => {
    expect(changesSince(facts(), facts({ lender: 'CBA', loanAmount: '$1,900,000' })))
      .toHaveLength(2)
  })

  // An income or a liability changing does not show up in the six headline
  // fields, but it still makes the prose wrong.
  it('notices a change it cannot name', () => {
    expect(changesSince(facts(), facts({ hash: 'bbb' })))
      .toEqual(['something in the fact find changed after this was written'])
  })

  it('says nothing when nothing moved', () => {
    expect(changesSince(facts(), facts())).toEqual([])
  })

  it('has nothing to compare against on a note that was never stamped', () => {
    expect(changesSince(undefined, facts())).toEqual([])
  })
})

describe('one note', () => {
  const stamp = (over: any = {}) => ({ at: '2026-09-01T00:00:00Z', facts: facts(), ...over })

  it('is fresh when the deal has not moved', () => {
    expect(noteFreshness('Some prose.', stamp(), facts()).state).toBe('fresh')
  })

  it('is stale when it has, and says why', () => {
    const f = noteFreshness('Some prose.', stamp(), facts({ lender: 'CBA' }))
    expect(f.state).toBe('stale')
    if (f.state !== 'stale') return
    expect(f.changes).toEqual(['the lender changed from ING to CBA'])
    expect(f.at).toBe('2026-09-01T00:00:00Z')
  })

  it('is nothing at all when the field is empty', () => {
    expect(noteFreshness('', stamp(), facts()).state).toBe('none')
    expect(noteFreshness('   ', stamp(), facts()).state).toBe('none')
  })

  // Somebody wrote this themselves. It is not the model's to grade.
  it('never calls a hand-typed note stale', () => {
    expect(noteFreshness('I wrote this myself.', null, facts({ lender: 'CBA' })).state).toBe('typed')
  })

  // Fabio, 3 Sep 2026, on the same problem in the client email: "Don't worry
  // about all deals. as long as it's fixed moving forward." Every note written
  // before today looks like this, and warning on all of them is noise about
  // something we cannot actually check.
  it('holds its tongue on a note generated before stamping existed', () => {
    expect(noteFreshness('Older prose.', { confidence: 'High' }, facts({ lender: 'CBA' })).state)
      .toBe('unknown')
  })
})

describe('the whole tab, in one answer', () => {
  const stamps = {
    needsPrimary: { at: '2026-09-01T09:00:00Z', facts: facts() },
    optionsComment: { at: '2026-09-01T09:05:00Z', facts: facts() },
    depositComment: { at: '2026-09-02T10:00:00Z', facts: facts({ lender: 'CBA' }) },
  }
  const fields = [
    { field: 'needsPrimary', text: 'a' },
    { field: 'optionsComment', text: 'b' },
    { field: 'depositComment', text: 'c' },
    { field: 'creditHistoryComment', text: 'typed by hand' },
    { field: 'securityComment', text: '' },
  ]

  it('lists only the notes that actually moved', () => {
    const r = reviewNotes(fields, stamps, facts({ lender: 'CBA' }))
    expect(r.staleFields).toEqual(['needsPrimary', 'optionsComment'])
  })

  // Nine notes written in the same batch all moved for the same reason.
  it('says the reason once, not once per field', () => {
    const r = reviewNotes(fields, stamps, facts({ lender: 'CBA' }))
    expect(r.changes).toEqual(['the lender changed from ING to CBA'])
  })

  it('reports the oldest note as the age of the problem', () => {
    expect(reviewNotes(fields, stamps, facts({ lender: 'CBA' })).writtenAt).toBe('2026-09-01T09:00:00Z')
  })

  // depositComment was regenerated later, against CBA. It is the one note that
  // matches a deal now back on ING - and the two written first are the stale
  // ones. Which way round it falls depends only on the stamps, never on the
  // order the fields are listed in.
  it('works the other way round too', () => {
    const r = reviewNotes(fields, stamps, facts())
    expect(r.staleFields).toEqual(['depositComment'])
    expect(r.changes).toEqual(['the lender changed from CBA to ING'])
  })

  it('is quiet when every note matches', () => {
    const matched = { needsPrimary: { at: '2026-09-01T09:00:00Z', facts: facts() } }
    const r = reviewNotes([{ field: 'needsPrimary', text: 'a' }], matched, facts())
    expect(r.staleFields).toEqual([])
    expect(r.changes).toEqual([])
    expect(r.writtenAt).toBeUndefined()
  })

  it('copes with a deal that has no stamps at all', () => {
    expect(reviewNotes(fields, null, facts()).staleFields).toEqual([])
  })
})
