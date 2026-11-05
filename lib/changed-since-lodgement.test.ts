// The client who moved house during the application. 17 Aug 2026.
import { describe, it, expect } from 'vitest'
import {
  CHANGEABLE, isChangeable, fieldLabel, buildChange, withChange, marked,
  changesOn, liveChanges, notYetApplied, changeFor,
  noteFor, changeCountLine, alertFor, recordedBy, lodgedAnswer, nameOf,
  columnFor, clientPatchFor, pendingFor,
} from './changed-since-lodgement'

const ELLIE = { id: 'u-ellie', name: 'Ellie Nguyen' }
const WHEN = new Date('2026-08-17T04:00:00Z')

const MOVED = {
  field: 'currentAddress',
  applicantId: 'a1',
  applicantName: 'Mai Chen',
  was: '38/100-106 Queenscliff Road, Queens Cliff NSW 2096',
  now: 'U6 50-58 Crown Rd, Queens Cliff NSW 2096',
  note: 'Moved 2 Aug, still renting, same suburb.',
}

describe('recording one', () => {
  const c = buildChange(MOVED, ELLIE, WHEN)!

  it('keeps the lodged answer beside the new one', () => {
    expect(c.was).toBe('38/100-106 Queenscliff Road, Queens Cliff NSW 2096')
    expect(c.now).toBe('U6 50-58 Crown Rd, Queens Cliff NSW 2096')
  })

  it('names who said so', () => {
    expect(c.byName).toBe('Ellie Nguyen')
    expect(c.byId).toBe('u-ellie')
    expect(c.at).toBe('2026-08-17T04:00:00.000Z')
  })

  it('starts with nothing applied and nothing undone', () => {
    expect(c.appliedAt).toBeNull()
    expect(c.undoneAt).toBeNull()
  })

  it('does not record a field this does not cover', () => {
    expect(buildChange({ ...MOVED, field: 'baseIncome' }, ELLIE, WHEN)).toBeNull()
  })

  it('does not record an empty answer', () => {
    expect(buildChange({ ...MOVED, now: '   ' }, ELLIE, WHEN)).toBeNull()
  })

  // Somebody confirming the file is already right is not an error to show them.
  it('does not record an answer that is the one already on the file', () => {
    expect(buildChange({ ...MOVED, now: MOVED.was }, ELLIE, WHEN)).toBeNull()
  })

  it('covers the five that move mid-deal and nothing else', () => {
    expect(CHANGEABLE.map(f => f.key)).toEqual(
      ['currentAddress', 'mobile', 'email', 'employer', 'maritalStatus'])
    expect(isChangeable('currentAddress')).toBe(true)
    expect(isChangeable('liabilities')).toBe(false)
    expect(fieldLabel('currentAddress')).toBe('Current address')
  })
})

describe('the list on the deal', () => {
  const c = buildChange(MOVED, ELLIE, WHEN)!
  const deal: any = { changes_since_lodgement: withChange({}, c) }

  it('reads back', () => {
    expect(changesOn(deal)).toHaveLength(1)
    expect(liveChanges(deal)).toHaveLength(1)
  })

  it('survives a deal that has never had one', () => {
    expect(changesOn({})).toEqual([])
    expect(changesOn({ changes_since_lodgement: null })).toEqual([])
    expect(liveChanges(null)).toEqual([])
  })

  it('is offered at settlement until it is applied', () => {
    expect(notYetApplied(deal)).toHaveLength(1)
    const done: any = { changes_since_lodgement:
      marked(deal, c.id, { appliedAt: '2026-11-01T00:00:00.000Z' }) }
    expect(notYetApplied(done)).toHaveLength(0)
  })

  // Undo marks, never deletes. A row that vanishes is one nobody can ask about.
  it('drops out of everything once undone, and stays on the record', () => {
    const undone: any = { changes_since_lodgement:
      marked(deal, c.id, { undoneAt: '2026-08-19T00:00:00.000Z', undoneBy: 'Fabio' }) }
    expect(liveChanges(undone)).toHaveLength(0)
    expect(notYetApplied(undone)).toHaveLength(0)
    expect(changesOn(undone)).toHaveLength(1)
  })
})

describe('a client who moves twice', () => {
  const first = buildChange(MOVED, ELLIE, WHEN)!
  const second = buildChange(
    { ...MOVED, was: MOVED.now, now: '12 Bay St, Mosman NSW 2088' },
    ELLIE, new Date('2026-09-01T04:00:00Z'))!
  const deal: any = { changes_since_lodgement: [first, second] }

  it('has one current answer and two rows on the file', () => {
    expect(changeFor(deal, 'currentAddress', 'a1')?.now).toBe('12 Bay St, Mosman NSW 2088')
    expect(liveChanges(deal)).toHaveLength(2)
  })

  it('answers nothing for a field nobody has changed', () => {
    expect(changeFor(deal, 'mobile', 'a1')).toBeNull()
  })

  it('does not hand one applicant another applicant\'s answer', () => {
    expect(changeFor(deal, 'currentAddress', 'a2')).toBeNull()
  })
})

describe('what it says', () => {
  const c = buildChange(MOVED, ELLIE, WHEN)!
  const deal: any = { changes_since_lodgement: [c] }

  it('writes a file note somebody can read in six months', () => {
    expect(noteFor(c)).toBe(
      'Mai Chen: Current address changed since lodgement. ' +
      'Now U6 50-58 Crown Rd, Queens Cliff NSW 2096. ' +
      'Was 38/100-106 Queenscliff Road, Queens Cliff NSW 2096. ' +
      'Moved 2 Aug, still renting, same suburb.')
  })

  it('counts them for the strip', () => {
    expect(changeCountLine(deal)).toBe('1 change since lodgement')
    expect(changeCountLine({ changes_since_lodgement: [c, c] }))
      .toBe('2 changes since lodgement')
    expect(changeCountLine({})).toBe('')
  })

  it('names the lender in the Needs action line', () => {
    expect(alertFor(c, 'ANZ')).toBe('Tell ANZ the current address changed')
    expect(alertFor(c, '')).toBe('Tell the lender the current address changed')
  })

  it('says who recorded it, in Sydney time', () => {
    expect(recordedBy(c)).toBe('Recorded by Ellie Nguyen, 17 Aug')
  })
})

describe('reading the lodged answer', () => {
  const MAI = {
    firstName: 'Mai', lastName: 'Chen',
    phoneMobile: '0412 345 678', emailPersonal: 'mai@example.com',
    relationshipStatus: 'Married',
    addresses: [
      { id: 'ad2', address: 'U6 50-58 Crown Rd, Queens Cliff NSW 2096', isCurrent: false },
      { id: 'ad1', address: '38/100-106 Queenscliff Road, Queens Cliff NSW 2096', isCurrent: true },
    ],
    employment: [{ id: 'e1', employerName: '' }, { id: 'e2', employerName: 'Kalinga Builders' }],
  }

  // isCurrent, not addresses[0]: a previous address added later sits wherever
  // it landed in the list.
  it('finds the current address by its tick, not its position', () => {
    expect(lodgedAnswer(MAI, 'currentAddress'))
      .toBe('38/100-106 Queenscliff Road, Queens Cliff NSW 2096')
  })

  it('reads the fact find\'s own field names', () => {
    expect(lodgedAnswer(MAI, 'mobile')).toBe('0412 345 678')
    expect(lodgedAnswer(MAI, 'email')).toBe('mai@example.com')
    expect(lodgedAnswer(MAI, 'maritalStatus')).toBe('Married')
  })

  it('skips an employment row nobody filled in', () => {
    expect(lodgedAnswer(MAI, 'employer')).toBe('Kalinga Builders')
  })

  it('answers nothing rather than throwing on an empty applicant', () => {
    expect(lodgedAnswer(null, 'currentAddress')).toBe('')
    expect(lodgedAnswer({}, 'employer')).toBe('')
    expect(lodgedAnswer(MAI, 'baseIncome')).toBe('')
  })

  it('names them', () => {
    expect(nameOf(MAI)).toBe('Mai Chen')
    expect(nameOf({ firstName: 'Jessie' })).toBe('Jessie')
    expect(nameOf(null)).toBe('')
  })
})

describe('carrying it onto the client at settlement', () => {
  // A field that can be changed and has nowhere to land is a tick box that
  // does nothing. This is the check that stops one being added.
  it('every changeable field has a column on the client record', () => {
    for (const f of CHANGEABLE) {
      expect(columnFor(f.key), f.key).not.toBe('')
    }
  })

  it('builds the patch', () => {
    const c = buildChange(MOVED, ELLIE, WHEN)!
    expect(clientPatchFor([c])).toEqual({
      address: 'U6 50-58 Crown Rd, Queens Cliff NSW 2096',
    })
  })

  it('lands a client who moved twice at the second address', () => {
    const first = buildChange(MOVED, ELLIE, WHEN)!
    const second = buildChange({ ...MOVED, was: MOVED.now, now: '12 Bay St, Mosman NSW 2088' },
      ELLIE, new Date('2026-09-01T04:00:00Z'))!
    expect(clientPatchFor([first, second]).address).toBe('12 Bay St, Mosman NSW 2088')
  })

  it('offers each applicant only their own', () => {
    const mine = buildChange(MOVED, ELLIE, WHEN)!
    const theirs = buildChange({ ...MOVED, applicantId: 'a2', applicantName: 'Jessie Cardey',
      field: 'mobile', was: '0400 000 000', now: '0411 111 111' }, ELLIE, WHEN)!
    const deal: any = { changes_since_lodgement: [mine, theirs] }
    expect(pendingFor(deal, 'a1')).toHaveLength(1)
    expect(pendingFor(deal, 'a2')[0].now).toBe('0411 111 111')
  })

  it('stops offering one that has been applied', () => {
    const c = buildChange(MOVED, ELLIE, WHEN)!
    const deal: any = { changes_since_lodgement: [c] }
    const done: any = { changes_since_lodgement:
      marked(deal, c.id, { appliedAt: '2026-11-01T00:00:00.000Z' }) }
    expect(pendingFor(done, 'a1')).toHaveLength(0)
  })
})
