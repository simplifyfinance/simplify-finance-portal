// THE FINANCIAL YEAR GRID.
//
// Invented brokers and invented deals throughout.
//
// EVERY DATE HERE IS WRITTEN WITHOUT A Z and the file is run under three
// timezones in the ship. A lodgement is stored as Sydney midnight, which is
// 13:00 the day before in UTC, so a test that passes only in Sydney is a test
// that hides the exact fault it is meant to catch.
import { describe, it, expect } from 'vitest'
import {
  busiestCell, gridFor, monthLodged, monthsOfFY, shadeOf, totalRow,
} from './the-year-so-far'
import type { Line2 } from './who-brought-us-this'

const line = (key: string, name: string, lodged: any[]): Line2 => ({
  key, name, terms: '', lodged, settled: [], lodgedAmount: 0, settledAmount: 0,
})

// Sydney midnight on the given day, the way the column actually stores it.
const lodgedOn = (sydneyDay: string, amount = 100_000) => ({
  id: 'd' + sydneyDay + Math.random(),
  lodged_at: `${sydneyDay}T13:00:00+00:00`,
  lodged_total: amount,
})

describe('the twelve months', () => {
  it('start in July and end in June', () => {
    const m = monthsOfFY('2026-11-17')
    expect(m).toHaveLength(12)
    expect(m.map(x => x.label))
      .toEqual(['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
                'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'])
    expect(m[0].key).toBe('2026-07')
    expect(m[11].key).toBe('2027-06')
  })

  // A MONTH THAT HAS NOT HAPPENED IS A DASH, NOT A NOUGHT.
  it('mark the months the year has not reached', () => {
    const m = monthsOfFY('2026-11-17')
    const future = Object.fromEntries(m.map(x => [x.label, x.future]))
    expect(future.Jul).toBe(false)
    expect(future.Oct).toBe(false)
    expect(future.Dec).toBe(true)
    expect(future.Jun).toBe(true)
  })

  it('count the month we are halfway through as happened', () => {
    const m = monthsOfFY('2026-11-01')
    expect(m.find(x => x.label === 'Nov')!.future).toBe(false)
  })

  it('roll into the next financial year on 1 July', () => {
    expect(monthsOfFY('2026-06-30')[0].key).toBe('2025-07')
    expect(monthsOfFY('2026-07-01')[0].key).toBe('2026-07')
  })
})

describe('the Sydney month, not the UTC one', () => {
  // The fault behind "we more than 1 deal this week", at a month boundary.
  // 2026-08-01T13:00:00Z IS 1 August in Sydney and 1 August is August.
  it('puts a deal lodged on the first of the month in that month', () => {
    expect(monthLodged(lodgedOn('2026-08-01'))).toBe('2026-08')
  })

  it('puts a deal lodged on the last of the month in that month', () => {
    expect(monthLodged(lodgedOn('2026-07-31'))).toBe('2026-07')
  })

  it('is empty for a deal that never lodged', () => {
    expect(monthLodged({})).toBe('')
    expect(monthLodged({ lodged_at: null })).toBe('')
  })
})

describe('the grid', () => {
  const months = monthsOfFY('2026-11-17')
  const rows = () => gridFor([
    line('mark', 'Mark Gallo', [
      lodgedOn('2026-07-10', 500_000), lodgedOn('2026-07-28', 300_000),
      lodgedOn('2026-10-02', 400_000),
    ]),
    line('kylie', 'Kylie Bianchi', [lodgedOn('2026-11-03', 200_000)]),
  ], months)

  it('counts each broker into the month they lodged in', () => {
    const [mark, kylie] = rows()
    const at = (r: any, label: string) => r.cells[months.findIndex(m => m.label === label)]
    expect(at(mark, 'Jul')).toBe(2)
    expect(at(mark, 'Aug')).toBe(0)
    expect(at(mark, 'Oct')).toBe(1)
    expect(at(kylie, 'Nov')).toBe(1)
  })

  it('leaves a month that has not happened as a dash, not a nought', () => {
    const dec = months.findIndex(m => m.label === 'Dec')
    for (const r of rows()) expect(r.cells[dec]).toBe(null)
  })

  it('carries the broker total and the money', () => {
    const [mark] = rows()
    expect(mark.total).toBe(3)
    expect(mark.amount).toBe(1_200_000)
  })

  it('adds the business row up from the brokers', () => {
    const all = totalRow(rows(), months)
    const at = (label: string) => all.cells[months.findIndex(m => m.label === label)]
    expect(at('Jul')).toBe(2)
    expect(at('Nov')).toBe(1)
    expect(at('Dec')).toBe(null)
    expect(all.total).toBe(4)
    expect(all.amount).toBe(1_400_000)
  })

  it('ignores a lodgement from outside the financial year', () => {
    const old = gridFor([line('mark', 'Mark Gallo', [lodgedOn('2026-06-30')])], months)
    expect(old[0].total).toBe(0)
    expect(old[0].cells.every(c => c === null || c === 0)).toBe(true)
  })
})

describe('one hue getting darker', () => {
  it('is nothing at all for an empty month', () => {
    expect(shadeOf(0, 10)).toBe(0)
    expect(shadeOf(null, 10)).toBe(0)
  })

  it('darkens with the share of the busiest cell', () => {
    expect(shadeOf(1, 10)).toBe(1)
    expect(shadeOf(5, 10)).toBe(2)
    expect(shadeOf(10, 10)).toBe(3)
  })

  it('does not divide by nothing when every month is quiet', () => {
    expect(shadeOf(1, 1)).toBe(3)
    expect(shadeOf(1, 0)).toBe(3)
  })

  it('finds the busiest cell across every broker', () => {
    const months = monthsOfFY('2026-11-17')
    const rows = gridFor([
      line('a', 'A', [lodgedOn('2026-07-10'), lodgedOn('2026-07-11')]),
      line('b', 'B', [lodgedOn('2026-08-10')]),
    ], months)
    expect(busiestCell(rows)).toBe(2)
  })
})
