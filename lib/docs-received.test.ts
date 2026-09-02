import { describe, it, expect } from 'vitest'
import { docsDelayMinutes, assessorDueAt, docsStateOf, stillCancellable, assessorMissing,
         DEFAULT_DOCS_DELAY_MINUTES, MAX_DOCS_DELAY_MINUTES, NO_ASSESSOR_MESSAGE } from './docs-received'

const RECEIVED = '2026-09-02T03:45:00.000Z'   // 1:45 pm Sydney
const DUE      = '2026-09-02T04:15:00.000Z'   // 2:15 pm

describe('how long to wait', () => {
  it('is half an hour unless Settings says otherwise', () => {
    expect(docsDelayMinutes({})).toBe(DEFAULT_DOCS_DELAY_MINUTES)
    expect(docsDelayMinutes({ docs_delay_minutes: null })).toBe(30)
    expect(docsDelayMinutes({ docs_delay_minutes: '' })).toBe(30)
  })
  it('takes a number from Settings', () => {
    expect(docsDelayMinutes({ docs_delay_minutes: 45 })).toBe(45)
    expect(docsDelayMinutes({ docs_delay_minutes: '15' })).toBe(15)
  })
  it('allows no wait at all', () => {
    expect(docsDelayMinutes({ docs_delay_minutes: 0 })).toBe(0)
  })
  it('refuses to park an email for five hours on a typo', () => {
    expect(docsDelayMinutes({ docs_delay_minutes: 5000 })).toBe(MAX_DOCS_DELAY_MINUTES)
    expect(docsDelayMinutes({ docs_delay_minutes: -10 })).toBe(0)
    expect(docsDelayMinutes({ docs_delay_minutes: 'soon' })).toBe(30)
  })
  it('puts the assessor half an hour after the documents were marked', () => {
    expect(assessorDueAt(RECEIVED, 30).toISOString()).toBe(DUE)
  })
})

// Between BC and lending options there is always a credit officer on the deal.
// Where there is not, the fix is to allocate one - not to invent a recipient who
// is not working the file.
describe('a deal with nobody allocated', () => {
  it('is spotted before anything is sent', () => {
    expect(assessorMissing({})).toBe(true)
    expect(assessorMissing({ assigned_credit_officer: 'co-1' })).toBe(false)
  })
  it('is told what to do, not just refused', () => {
    expect(NO_ASSESSOR_MESSAGE).toMatch(/Allocate one first/)
  })
})

describe('what the deal is showing', () => {
  it('shows nothing before anybody presses it', () => {
    expect(docsStateOf({}).kind).toBe('none')
  })
  it('is waiting while the assessor email is still with Resend', () => {
    const s = docsStateOf({ docs_received_at: RECEIVED, docs_assessor_due_at: DUE },
                          new Date('2026-09-02T04:00:00.000Z'))
    expect(s.kind).toBe('waiting')
    if (s.kind !== 'waiting') return
    expect(s.dueAt.toISOString()).toBe(DUE)
  })
  it('is done once the time has passed, because Resend owns the send', () => {
    expect(docsStateOf({ docs_received_at: RECEIVED, docs_assessor_due_at: DUE },
                       new Date('2026-09-02T04:15:00.000Z')).kind).toBe('done')
  })
  it('says so when the assessor email could not be scheduled at all', () => {
    // Cris was told, the deal is marked, and nothing is queued. This must never
    // look the same as a deal quietly waiting.
    expect(docsStateOf({ docs_received_at: RECEIVED }).kind).toBe('unscheduled')
  })
})

describe('cancelling the assessor email', () => {
  it('is offered while it is still in the future', () => {
    expect(stillCancellable({ docs_received_at: RECEIVED, docs_assessor_due_at: DUE },
                            new Date('2026-09-02T04:00:00.000Z'))).toBe(true)
  })
  it('is not offered once it has gone', () => {
    expect(stillCancellable({ docs_received_at: RECEIVED, docs_assessor_due_at: DUE },
                            new Date('2026-09-02T04:15:01.000Z'))).toBe(false)
  })
  it('is not offered when nothing was ever queued', () => {
    expect(stillCancellable({ docs_received_at: RECEIVED })).toBe(false)
    expect(stillCancellable({})).toBe(false)
  })
})
