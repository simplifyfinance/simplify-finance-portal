// THE LIGHT LIST IS THE WHOLE BOOK MINUS FIVE, AND STAYS THAT WAY.
//
// 18 Nov 2026. Today and Settlements stopped asking for `select('*')` and
// started naming their columns, which is the only way to leave the five big
// JSON ones behind.
//
// A NAMED LIST IS A LIST THAT CAN GO STALE. Add a column in a migration,
// forget this file, and the screens read undefined - and every one of those
// reads has a fallback behind it, so nothing would break and nothing would say
// so. That is precisely the failure scripts/check-deal-columns.sh was written
// for, pointing the other way.
//
// So the committed column list is the authority, here as well as there.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { LIGHT, HEAVY, LIGHT_SELECT, HEAVY_SELECT, stillWorthTheDetail, whoNeedsTheDetail, withTheDetail }
  from './the-columns-a-screen-needs'

const committed = readFileSync('docs/deals-columns.txt', 'utf8')
  .split('\n').map(l => l.trim())
  .filter(l => l && !l.startsWith('#'))

const NOW = new Date('2026-11-18T09:00:00+11:00')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

describe('the light list is every column but the five', () => {
  it('asks for everything the database has, minus the heavy ones', () => {
    const expected = [...new Set(committed)].filter(c => !(HEAVY as readonly string[]).includes(c)).sort()
    expect([...LIGHT].sort()).toEqual(expected)
  })

  it('never asks for a column that does not exist', () => {
    for (const c of LIGHT) expect(committed, `${c} is not a real column`).toContain(c)
  })

  it('and the heavy five are real columns too', () => {
    for (const c of HEAVY) expect(committed).toContain(c)
  })

  it('both selects name id, so the two asks can be married up', () => {
    expect(LIGHT_SELECT).toContain('id')
    expect(HEAVY_SELECT.startsWith('id')).toBe(true)
  })
})

describe('who still needs the detail', () => {
  it('anything unsettled', () => {
    expect(stillWorthTheDetail({ id: 'a' }, NOW)).toBe(true)
  })

  it('never a lost deal', () => {
    expect(stillWorthTheDetail({ id: 'a', status: 'lost' }, NOW)).toBe(false)
  })

  it('a settlement this month, because the month still reads its figures', () => {
    expect(stillWorthTheDetail({ id: 'a', settled_at: daysAgo(9) }, NOW)).toBe(true)
  })

  it('not one from two years ago', () => {
    expect(stillWorthTheDetail({ id: 'a', settled_at: daysAgo(700) }, NOW)).toBe(false)
  })

  // A DATE NOBODY CAN READ IS NOT A REASON TO DROP THE FIGURES.
  it('keeps a deal whose settled date is nonsense', () => {
    expect(stillWorthTheDetail({ id: 'a', settled_at: 'soon' }, NOW)).toBe(true)
  })

  it('lists the ids to ask for', () => {
    expect(whoNeedsTheDetail([
      { id: 'live' }, { id: 'lost', status: 'lost' }, { id: 'old', settled_at: daysAgo(700) },
    ], NOW)).toEqual(['live'])
  })
})

describe('putting the detail back', () => {
  it('adds the blobs to the rows they belong to', () => {
    const out = withTheDetail(
      [{ id: 'a', deal_name: 'One' }, { id: 'b', deal_name: 'Two' }],
      [{ id: 'b', lo_data: { loanAmount: 500 } }])
    expect(out[0]).toEqual({ id: 'a', deal_name: 'One' })
    expect(out[1]).toEqual({ id: 'b', deal_name: 'Two', lo_data: { loanAmount: 500 } })
  })

  it('never drops a field the light row already had', () => {
    const out = withTheDetail([{ id: 'a', deal_name: 'One', lender: 'ubank' }], [{ id: 'a', bc_data: {} }])
    expect(out[0].lender).toBe('ubank')
    expect(out[0].deal_name).toBe('One')
  })

  it('hands back the light rows untouched when nothing heavy came', () => {
    const light = [{ id: 'a' }]
    expect(withTheDetail(light, [])).toEqual(light)
  })
})
