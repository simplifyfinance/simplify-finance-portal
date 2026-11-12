// EVERY APPLICANT ON A REAL DEAL HAS A CLIENT RECORD.
//
// Invented applicants throughout.
//
// 12 Nov 2026. 174 deals had an applicant with no client record, so marking
// one settled said "nothing to record against" and the position was lost.
// Almost all were the SECOND person on a joint deal.
import { describe, it, expect } from 'vitest'
import {
  linkApplicants, nameable, needRecords, realEnough, rowFor, withIds,
} from './every-applicant-has-a-record'

const applicants = (...rows: any[]) => ({ fact_find_data: { applicants: rows } })
const lodged = (...rows: any[]) =>
  ({ ...applicants(...rows), lodged_at: '2026-11-09T13:00:00+00:00' })

const anna = { id: 'a1', firstName: 'Anna', lastName: 'Okonkwo' }
const ben = { id: 'a2', firstName: 'Ben', lastName: 'Okonkwo' }

describe('only once a deal is real', () => {
  // FABIO, 12 Nov 2026: "link everything that is from compliance issued or
  // lodged... anything before that, it could just be an inquiry."
  it('waits for compliance sent or lodged', () => {
    expect(realEnough({})).toBe(false)
    expect(realEnough({ bc_sent_at: '2026-11-01' })).toBe(false)
    expect(realEnough({ compliance_sent_at: '2026-11-01' })).toBe(true)
    expect(realEnough({ lodged_at: '2026-11-01' })).toBe(true)
  })

  it('does nothing at all on a deal still being worked out', () => {
    expect(needRecords(applicants(anna, ben))).toEqual([])
  })
})

describe('who needs one', () => {
  it('is the applicant with no clientId', () => {
    const out = needRecords(lodged({ ...anna, clientId: 'c1' }, ben))
    expect(out).toHaveLength(1)
    expect(out[0].index).toBe(1)
    expect(out[0].applicant.firstName).toBe('Ben')
  })

  it('is nobody when everyone is linked', () => {
    expect(needRecords(lodged({ ...anna, clientId: 'c1' }, { ...ben, clientId: 'c2' })))
      .toEqual([])
  })

  // THE REAL DATA HAD APPLICANTS CALLED "Camilla", "Don", "Eva" AND "Husband".
  // Those are placeholders somebody typed while working a deal out. A surname
  // cannot be invented and half a name is not a client.
  it('never invents a person out of half a name', () => {
    expect(nameable({ firstName: 'Husband' })).toBe(false)
    expect(nameable({ firstName: 'Camilla', lastName: '' })).toBe(false)
    expect(nameable({ lastName: 'Belfield' })).toBe(false)
    expect(nameable({ firstName: 'Laura', lastName: 'Belfield' })).toBe(true)
    expect(needRecords(lodged({ ...anna, clientId: 'c1' }, { firstName: 'Husband' })))
      .toEqual([])
  })

  it('survives a deal with no fact find at all', () => {
    expect(needRecords({ lodged_at: '2026-11-09' })).toEqual([])
    expect(needRecords(null)).toEqual([])
  })
})

describe('what gets written', () => {
  it('carries the name, and the contact where there is one', () => {
    expect(rowFor({ firstName: ' Ben ', lastName: 'Okonkwo', email: 'b@x.com' }))
      .toEqual({ first_name: 'Ben', last_name: 'Okonkwo', email: 'b@x.com', phone: null })
  })

  it('writes null rather than an empty string', () => {
    expect(rowFor({ firstName: 'Ben', lastName: 'Okonkwo', email: '  ' }).email).toBe(null)
  })
})

describe('putting the ids back', () => {
  it('touches only the ones that were made', () => {
    const deal = lodged({ ...anna, clientId: 'c1' }, ben)
    const out = withIds(deal, { 1: 'c2' })
    expect(out[0].clientId).toBe('c1')
    expect(out[1].clientId).toBe('c2')
    expect(out[1].firstName).toBe('Ben')
  })
})

describe('the whole thing', () => {
  it('creates what is missing and hands back the new list', async () => {
    const deal = lodged({ ...anna, clientId: 'c1' }, ben)
    const out = await linkApplicants(deal, async () => 'new-id')
    expect(out?.made).toBe(1)
    expect(out?.failed).toBe(0)
    expect(out?.applicants[1].clientId).toBe('new-id')
  })

  it('does nothing where there is nothing to do', async () => {
    expect(await linkApplicants(applicants(anna, ben), async () => 'x')).toBe(null)
    expect(await linkApplicants(lodged({ ...anna, clientId: 'c1' }), async () => 'x')).toBe(null)
  })

  // A DEAL REACHING COMPLIANCE MUST NOT FAIL BECAUSE A CLIENT RECORD WOULD NOT
  // WRITE. The stage change is the thing that matters.
  it('does not throw when the write is refused', async () => {
    const deal = lodged({ ...anna, clientId: 'c1' }, ben)
    expect(await linkApplicants(deal, async () => null)).toBe(null)
    expect(await linkApplicants(deal, async () => { throw new Error('rls') })).toBe(null)
  })

  it('keeps what it managed when one of two fails', async () => {
    const deal = lodged(anna, ben)
    let first = true
    const out = await linkApplicants(deal, async () => {
      if (first) { first = false; return 'made-1' }
      return null
    })
    expect(out?.made).toBe(1)
    expect(out?.failed).toBe(1)
    expect(out?.applicants[0].clientId).toBe('made-1')
    expect(out?.applicants[1].clientId).toBeUndefined()
  })
})
