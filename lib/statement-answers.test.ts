import { describe, it, expect } from 'vitest'
import { reasonsFor, describeAnswer, answerFor, openCount, type Answer } from './statement-answers'

const ans = (o: Partial<Answer>): Answer => ({
  item_key: 'salary_gap', reason_id: 'parental_leave', reason_label: 'Parental leave',
  note: null, answered_by: 'Fabio de Castro', answered_at: '2026-08-31T08:42:00Z', ...o,
})

describe('worklist answers', () => {
  it('offers reasons for a known item, always ending in Other', () => {
    const r = reasonsFor('salary_gap')
    expect(r[0].label).toBe('Parental leave')
    expect(r[r.length - 1].id).toBe('other')
  })

  it('still offers Other for an item with no canned reasons', () => {
    expect(reasonsFor('something_new').map(x => x.id)).toEqual(['other'])
  })

  it('uses what was typed as the answer when the reason is Other', () => {
    expect(describeAnswer(ans({ reason_id: 'other', reason_label: 'Other…', note: 'Client was overseas caring for a parent' })))
      .toBe('Client was overseas caring for a parent')
  })

  it('never leaves the word Other standing on its own', () => {
    expect(describeAnswer(ans({ reason_id: 'other', reason_label: 'Other…', note: '   ' }))).toBe('Answered')
  })

  it('adds a typed note to a canned reason', () => {
    expect(describeAnswer(ans({ note: 'Returned to work 14 July' })))
      .toBe('Parental leave — Returned to work 14 July')
  })

  it('takes the most recent answer when an item has been answered twice', () => {
    const a = answerFor([
      ans({ reason_label: 'Between jobs', answered_at: '2026-08-30T01:00:00Z' }),
      ans({ reason_label: 'Parental leave', answered_at: '2026-08-31T08:42:00Z' }),
    ], 'salary_gap')
    expect(a!.reason_label).toBe('Parental leave')
  })

  it('does not let an answer drift onto another item', () => {
    expect(answerFor([ans({ item_key: 'salary_gap' })], 'gambling')).toBeNull()
  })

  it('counts what is still open', () => {
    const items = [{ key: 'salary_gap' }, { key: 'salary_variance' }, { key: 'coverage' }]
    expect(openCount(items, [ans({})])).toBe(2)
    expect(openCount(items, [])).toBe(3)
  })
})
