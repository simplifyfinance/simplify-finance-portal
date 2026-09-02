import { describe, it, expect } from 'vitest'
import {
  daysUntil, toneOf, chipLabel, newestFirst, byUrgency, openAlerts, dueLabel, whenLabel,
} from './deal-notes'
import { isLocked, canUnlock, unlockNote, reasonIsEnough } from './deal-lock'

const NOW = new Date('2026-09-03T00:00:00Z')
const alert = (o: any = {}) => ({
  id: 'a', deal_id: 'd', title: 'Valuation came in short', owner_name: 'Fabio',
  due_on: null, resolved_at: null, resolved_by: null, author_name: 'Fabio',
  created_at: '2026-09-02T00:00:00Z', ...o,
})

describe('the lock', () => {
  const lodged = { fact_find_data: { applicants: [{}] }, client_proceeded: true, lo_client_proceeded: true, lodged_at: '2026-09-01' }

  it('a deal still being written is not locked', () => {
    expect(isLocked({})).toBe(false)
    expect(isLocked({ ...lodged, lodged_at: null })).toBe(false)
  })
  it('locks from lodgement onwards', () => {
    expect(isLocked(lodged)).toBe(true)
    expect(isLocked({ ...lodged, settled_at: '2026-10-01' })).toBe(true)
  })
  it('only admin and brokers may unlock', () => {
    expect(canUnlock('admin')).toBe(true)
    expect(canUnlock('broker')).toBe(true)
    expect(canUnlock('staff')).toBe(false)
    expect(canUnlock(null)).toBe(false)
    expect(canUnlock('')).toBe(false)
  })
  it('an unlock has to say why', () => {
    expect(reasonIsEnough('')).toBe(false)
    expect(reasonIsEnough('   ')).toBe(false)
    expect(reasonIsEnough('typo')).toBe(true)
  })
  it('the note names the tab and carries the reason', () => {
    expect(unlockNote('FactFind', 'Employer entity was wrong.'))
      .toBe('Fact Find unlocked and edited. Employer entity was wrong.')
    expect(unlockNote('LO', '')).toBe('Lending options unlocked and edited.')
  })
})

describe('how long until an alert is due', () => {
  it('counts whole days, and goes negative once it has passed', () => {
    expect(daysUntil('2026-09-06', NOW)).toBe(3)
    expect(daysUntil('2026-09-03', NOW)).toBe(0)
    expect(daysUntil('2026-09-01', NOW)).toBe(-2)
  })
  it('an alert with no date has no countdown', () => {
    expect(daysUntil(null, NOW)).toBeNull()
    expect(daysUntil('not a date', NOW)).toBeNull()
  })
})

describe('how loud an alert is', () => {
  it('red inside two days, and once overdue', () => {
    expect(toneOf(alert({ due_on: '2026-09-04' }), NOW)).toBe('red')
    expect(toneOf(alert({ due_on: '2026-09-01' }), NOW)).toBe('red')
  })
  it('amber further out', () => {
    expect(toneOf(alert({ due_on: '2026-09-11' }), NOW)).toBe('amber')
  })
  it('an alert with no date is amber - a problem, not a clock', () => {
    expect(toneOf(alert(), NOW)).toBe('amber')
  })
})

describe('the chip on a deal card', () => {
  it('fits, and says when', () => {
    expect(chipLabel(alert({ title: 'Finance clause', due_on: '2026-09-06' }), NOW))
      .toBe('Finance clause · 3d')
    expect(chipLabel(alert({ title: 'Finance clause', due_on: '2026-09-03' }), NOW))
      .toBe('Finance clause · today')
    expect(chipLabel(alert({ title: 'Finance clause', due_on: '2026-09-04' }), NOW))
      .toBe('Finance clause · tomorrow')
    expect(chipLabel(alert({ title: 'Finance clause', due_on: '2026-09-01' }), NOW))
      .toBe('Finance clause · overdue')
  })
  it('a long title is cut rather than breaking the card', () => {
    const s = chipLabel(alert({ title: 'Valuation came in forty thousand short of contract' }), NOW)
    expect(s.length).toBeLessThanOrEqual(28)
    expect(s.endsWith('…')).toBe(true)
  })
  it('no date means no countdown on the chip', () => {
    expect(chipLabel(alert({ title: 'Valuation short' }), NOW)).toBe('Valuation short')
  })
})

describe('what is still open', () => {
  it('a resolved alert is gone from the list', () => {
    const list = [alert({ id: '1' }), alert({ id: '2', resolved_at: '2026-09-02T10:00:00Z' })]
    expect(openAlerts(list).map(a => a.id)).toEqual(['1'])
  })

  it('most urgent first: overdue, then soonest, then undated', () => {
    const list = [
      alert({ id: 'none' }),
      alert({ id: 'week', due_on: '2026-09-10' }),
      alert({ id: 'over', due_on: '2026-08-30' }),
      alert({ id: 'soon', due_on: '2026-09-04' }),
      alert({ id: 'done', due_on: '2026-08-01', resolved_at: '2026-08-02T00:00:00Z' }),
    ]
    expect(byUrgency(list, NOW).map(a => a.id)).toEqual(['over', 'soon', 'week', 'none'])
  })
})

describe('the log reads newest first', () => {
  it('sorts by when it was written, not when it was loaded', () => {
    const n = (id: string, at: string) => ({ id, deal_id: 'd', body: id, kind: 'note', author_name: null, created_at: at })
    const out = newestFirst([n('old', '2026-09-01T09:00:00Z'), n('new', '2026-09-03T09:00:00Z'), n('mid', '2026-09-02T09:00:00Z')])
    expect(out.map(x => x.id)).toEqual(['new', 'mid', 'old'])
  })
  it('an empty log does not throw', () => {
    expect(newestFirst([])).toEqual([])
    expect(newestFirst(null as any)).toEqual([])
  })
})

describe('how a due date reads', () => {
  it('says it plainly', () => {
    expect(dueLabel('2026-09-06', NOW)).toBe('3 days')
    expect(dueLabel('2026-09-03', NOW)).toBe('due today')
    expect(dueLabel('2026-09-04', NOW)).toBe('due tomorrow')
    expect(dueLabel('2026-09-02', NOW)).toBe('1 day overdue')
    expect(dueLabel('2026-08-31', NOW)).toBe('3 days overdue')
    expect(dueLabel(null, NOW)).toBe('')
  })
})

describe('the clock is the office clock, not the reader\'s', () => {
  it('counts down from today in Sydney, not today in UTC', () => {
    // 20:00 UTC on 2 Sep is already 6am on 3 Sep in Sydney. A due date of
    // 3 Sep is TODAY for the business, not tomorrow - and an overseas staff
    // member reading the same screen must see the same answer.
    const lateUtc = new Date('2026-09-02T20:00:00Z')
    expect(daysUntil('2026-09-03', lateUtc)).toBe(0)
    expect(dueLabel('2026-09-03', lateUtc)).toBe('due today')
  })

  it('stamps carry the Sydney timezone so nobody reads them as local', () => {
    const label = whenLabel('2026-09-01T23:14:00Z')   // 9:14 am on 2 Sep in Sydney
    expect(label).toContain('2 Sep')
    expect(label).toContain('9:14')
    expect(label).toMatch(/AE[SD]T|GMT\+/)
  })

  it('a blank or broken timestamp shows nothing rather than "Invalid Date"', () => {
    expect(whenLabel(null)).toBe('')
    expect(whenLabel('not a time')).toBe('')
  })
})
