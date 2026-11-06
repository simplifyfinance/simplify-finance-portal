// Stage history, for Alan's reporting pack and the settlements chase. 17 Aug 2026.
import { describe, it, expect } from 'vitest'
import { PHASE_ORDER } from './deal-phase'
import {
  COLUMN_PHASE, phaseOfColumn, bucketOf, bucketsAreComplete, BUCKET_LABEL,
  historyOf, historyFromColumns, mergedHistory, nowAt, daysHere,
  firstReached, daysInBucket, wentBackwards,
} from './a-stage-is-a-fact'

const NOW = new Date('2026-08-17T00:00:00Z')

const ROWS = [
  { column_name: 'lodged_at', entered_at: '2026-07-01T00:00:00Z', changed_by: 'u-katie' },
  { column_name: 'formal_approval_at', entered_at: '2026-08-02T00:00:00Z', changed_by: 'u-katie' },
  { column_name: 'preapproval_at', entered_at: '2026-07-14T00:00:00Z', changed_by: 'u-ellie' },
]

describe('which column means which stage', () => {
  it('reads the milestone columns', () => {
    expect(phaseOfColumn('lodged_at')).toBe('lodged')
    expect(phaseOfColumn('formal_approval_at')).toBe('formal')
    expect(phaseOfColumn('settled_at')).toBe('settled')
  })

  it('says nothing for a column that is not a stage', () => {
    expect(phaseOfColumn('loan_amount')).toBeNull()
    expect(phaseOfColumn('')).toBeNull()
    expect(phaseOfColumn(null)).toBeNull()
  })
})

describe('the five reporting buckets', () => {
  // The pack: "Map every portal stage to one of five reporting buckets held in
  // config, so stages can be renamed or added without breaking reports."
  it('covers every phase the portal has', () => {
    expect(bucketsAreComplete()).toBe(true)
    for (const p of PHASE_ORDER) {
      expect(BUCKET_LABEL[bucketOf(p)], p).toBeTruthy()
    }
  })

  it('puts the pre-lodgement work together', () => {
    expect(bucketOf('fact_find')).toBe('pre_lodgement')
    expect(bucketOf('compliance_sent')).toBe('pre_lodgement')
  })

  it('counts outstanding as still lodged', () => {
    expect(bucketOf('lodged')).toBe('lodged')
    expect(bucketOf('outstanding')).toBe('lodged')
  })

  // A preapproval is the lender saying yes to something.
  it('counts a preapproval as approved', () => {
    expect(bucketOf('preapproved')).toBe('approved')
    expect(bucketOf('formal')).toBe('approved')
    expect(bucketOf('settlement_booked')).toBe('approved')
  })

  it('keeps settled and lost on their own', () => {
    expect(bucketOf('settled')).toBe('settled')
    expect(bucketOf('lost')).toBe('lost')
  })
})

describe('the history of one deal', () => {
  const h = historyOf(ROWS, NOW)

  it('is in order whatever order the rows arrived in', () => {
    expect(h.map(e => e.phase)).toEqual(['lodged', 'preapproved', 'formal'])
  })

  it('works out when each stage ended from the next one', () => {
    expect(h[0].exitedAt).toBe('2026-07-14T00:00:00Z')
    expect(h[1].exitedAt).toBe('2026-08-02T00:00:00Z')
    expect(h[2].exitedAt).toBeNull()
  })

  it('counts the days in each', () => {
    expect(h[0].days).toBe(13)
    expect(h[1].days).toBe(19)
    expect(h[2].days).toBe(15)
  })

  it('keeps who, where there is one', () => {
    expect(h[0].changedBy).toBe('u-katie')
    expect(h[1].changedBy).toBe('u-ellie')
  })

  it('says where it is now and for how long', () => {
    expect(nowAt(h)?.phase).toBe('formal')
    expect(daysHere(h)).toBe(15)
  })

  // A column removed from the portal is not a stage with no name.
  it('drops a row naming a column this build does not know', () => {
    const odd = historyOf([...ROWS, { column_name: 'retired_at', entered_at: '2026-07-02T00:00:00Z' }], NOW)
    expect(odd).toHaveLength(3)
  })

  it('does not throw on nothing', () => {
    expect(historyOf([], NOW)).toEqual([])
    expect(historyOf(null as any, NOW)).toEqual([])
    expect(daysHere([])).toBe(0)
    expect(nowAt([])).toBeNull()
  })
})

describe('a deal that went backwards', () => {
  const BACK = [
    { column_name: 'lodged_at', entered_at: '2026-07-01T00:00:00Z' },
    { column_name: 'outstanding_at', entered_at: '2026-07-10T00:00:00Z' },
    { column_name: 'lodged_at', entered_at: '2026-07-20T00:00:00Z' },
  ]
  const h = historyOf(BACK, NOW)

  // A merged total would hide the move, which is the thing worth seeing.
  it('keeps both stays rather than merging them', () => {
    expect(h.map(e => e.phase)).toEqual(['lodged', 'outstanding', 'lodged'])
    expect(h[0].days).toBe(9)
    expect(h[2].days).toBe(28)
  })

  it('says so', () => {
    expect(wentBackwards(h)).toBe(true)
    expect(wentBackwards(historyOf(ROWS, NOW))).toBe(false)
  })

  it('adds up the time in a bucket across every visit', () => {
    // Nine days lodged, eighteen outstanding, twenty-eight lodged again - and
    // outstanding is in the Lodged bucket too, so all of it counts.
    expect(daysInBucket(h, 'lodged')).toBe(9 + 10 + 28)
  })

  it('reports when it FIRST reached a stage', () => {
    expect(firstReached(h, 'lodged')).toBe('2026-07-01T00:00:00Z')
    expect(firstReached(h, 'settled')).toBeNull()
  })
})

describe('the history a deal already has', () => {
  // Every deal in the book gets one of these from day one, with no backfill
  // job and nothing waiting on the trigger seeing a change.
  const DEAL = {
    lodged_at: '2026-07-01T00:00:00Z',
    preapproval_at: '2026-07-14T00:00:00Z',
    formal_approval_at: '2026-08-02T00:00:00Z',
    loan_amount: '960000',
    settled_at: null,
  }

  it('reads it off the dated columns', () => {
    const h = historyFromColumns(DEAL, NOW)
    expect(h.map(e => e.phase)).toEqual(['lodged', 'preapproved', 'formal'])
  })

  // Nobody recorded who moved those deals. A guess would be worse than a blank.
  it('leaves who blank rather than inventing one', () => {
    expect(historyFromColumns(DEAL, NOW).every(e => e.changedBy === null)).toBe(true)
  })

  it('ignores a column that is not a stage, and a blank one', () => {
    const h = historyFromColumns(DEAL, NOW)
    expect(h).toHaveLength(3)
  })

  it('does not throw on a deal with nothing on it', () => {
    expect(historyFromColumns({}, NOW)).toEqual([])
    expect(historyFromColumns(null, NOW)).toEqual([])
  })
})

describe('both together', () => {
  const DEAL = {
    lodged_at: '2026-07-01T00:00:00Z',
    preapproval_at: '2026-07-14T00:00:00Z',
    formal_approval_at: '2026-08-02T00:00:00Z',
  }
  const RECORDED = [
    { column_name: 'formal_approval_at', entered_at: '2026-08-02T00:00:00Z', changed_by: 'u-katie' },
  ]

  // A deal carries dates from before the trigger AND rows written since.
  it('keeps the recorded row, because it is the one with a user on it', () => {
    const h = mergedHistory(DEAL, RECORDED, NOW)
    expect(h).toHaveLength(3)
    expect(h.find(e => e.phase === 'formal')?.changedBy).toBe('u-katie')
    expect(h.find(e => e.phase === 'lodged')?.changedBy).toBeNull()
  })

  it('does not draw the same stage twice from the two sources', () => {
    const h = mergedHistory(DEAL, RECORDED, NOW)
    expect(h.filter(e => e.phase === 'formal')).toHaveLength(1)
  })

  it('falls back to the columns where nothing is recorded', () => {
    expect(mergedHistory(DEAL, [], NOW)).toHaveLength(3)
  })
})
