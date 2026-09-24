// THE ONE LETTER THAT TORE THE PAGE UP.
//
// 24 Sep 2026. Fabio settled a deal on staging and the prompt asking about the
// client's position appeared and vanished, again and again, for hours. His
// console said `Minified React error #418` - the page the server drew and the
// page the browser drew were not the same, so React threw the browser's copy
// away and started again, taking with it everything the page was holding,
// including the fact that it was showing him a prompt.
//
// The difference was the short name of ONE month. Node and Chrome disagree
// about September - "Sep" against "Sept" - and agree about the other eleven.
// The settled date is only on the page once a deal is settled, and today was
// the first day anybody settled one. That is why it started today.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { dayMonthYear, dayMonth, longDate, dayMonthTime } from './same-date-everywhere'

describe('a date is spelled here, never asked of the machine', () => {
  it('September is Sep, and it is Sep everywhere', () => {
    expect(dayMonthYear('2026-09-24')).toBe('24 Sep 2026')
    expect(dayMonth('2026-09-24')).toBe('24 Sep')
    expect(longDate('2026-09-24')).toBe('24 September 2026')
  })

  it('and the machine would not have agreed with itself', () => {
    // The very call that caused it. Whatever this box says today, the point is
    // that it is not OURS to depend on - it changes with the machine.
    const fromTheMachine = new Date(2026, 8, 24)
      .toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
    expect(['24 Sep 2026', '24 Sept 2026']).toContain(fromTheMachine)
    // Ours never moves.
    expect(dayMonthYear('2026-09-24')).toBe('24 Sep 2026')
  })

  it('every month, spelled the same way twice', () => {
    const got = Array.from({ length: 12 }, (_, m) =>
      dayMonth(`2026-${String(m + 1).padStart(2, '0')}-01`))
    expect(got).toEqual(['01 Jan', '01 Feb', '01 Mar', '01 Apr', '01 May', '01 Jun',
                         '01 Jul', '01 Aug', '01 Sep', '01 Oct', '01 Nov', '01 Dec'])
  })

  it('a plain date is read as digits, not as a moment in time', () => {
    // `new Date('2026-09-24')` is midnight UTC - which in Melbourne is already
    // the 24th and in London is still the 23rd. The digits are what somebody
    // typed, and they do not move.
    expect(dayMonthYear('2026-09-24')).toBe('24 Sep 2026')
    expect(dayMonth('2026-01-01')).toBe('01 Jan')
  })

  it('keeps whichever shape each place already had', () => {
    expect(dayMonth('2026-09-05')).toBe('05 Sep')
    expect(dayMonth('2026-09-05', false)).toBe('5 Sep')
  })

  it('nothing in, nothing out', () => {
    for (const f of [dayMonthYear, dayMonth, longDate, dayMonthTime]) {
      expect(f('')).toBe('')
      expect(f(null)).toBe('')
      expect(f(undefined)).toBe('')
      expect(f('not a date')).toBe('')
    }
  })
})

describe('a clock is pinned to the office, not to the machine', () => {
  it('the same instant reads the same on any machine', () => {
    // 24 Sep 2026, 11:16 UTC is 9:16pm in Melbourne. The server was drawing
    // one of those and the browser the other.
    expect(dayMonthTime('2026-09-24T11:16:00Z')).toBe('24 Sep, 9:16 pm')
  })

  it('midnight and noon are said the way a person says them', () => {
    expect(dayMonthTime('2026-09-24T14:00:00Z')).toBe('25 Sep, 12:00 am')
    expect(dayMonthTime('2026-09-24T02:00:00Z')).toBe('24 Sep, 12:00 pm')
  })
})

describe('the deal page never asks the machine for a date again', () => {
  // These are the files that draw on BOTH sides - server first, then browser -
  // so a date in any of them has to be the same on both.
  const FILES = [
    'app/(app)/deals/[id]/DealSettlement.tsx',
    'app/(app)/deals/[id]/DealProgress.tsx',
    'app/(app)/deals/[id]/BCForm.tsx',
    'app/(app)/deals/[id]/LOForm.tsx',
    'app/(app)/deals/[id]/ComplianceForm.tsx',
  ]

  for (const f of FILES) {
    it(`${f.split('/').pop()} spells its own dates`, () => {
      const src = readFileSync(new URL('../' + f, import.meta.url), 'utf8')
      const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
      expect(code, 'a month name from the machine tears the page up').not.toContain('toLocaleDateString')
      expect(code, 'a clock from the machine tears the page up').not.toContain('toLocaleString(\'en-AU\', {')
      expect(code).toContain('same-date-everywhere')
    })
  }
})
