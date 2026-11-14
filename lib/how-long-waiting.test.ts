// A CHASE LIST WITHOUT AGES IS NOT A CHASE LIST.
//
// 15 Nov 2026. "Client" is a category. "Client, 6 days" is a phone call.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { daysWaiting, waitedWords, oldestFirst } from './how-long-waiting'

const NOW = new Date('2026-11-15T09:00:00+11:00')
const ago = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString()

// phaseSince() reads the deal's own milestones. A deal with nothing else set
// falls back to created_at, which is what these fixtures use.
const deal = (days: number | null) =>
  ({ id: 'd' + days, created_at: days === null ? null : ago(days) })

describe('how long it has been sitting there', () => {
  it('counts whole days since the deal last moved', () => {
    expect(daysWaiting(deal(11), NOW)).toBe(11)
    expect(daysWaiting(deal(1), NOW)).toBe(1)
    expect(daysWaiting(deal(0), NOW)).toBe(0)
  })

  it('a date nobody set is not a long wait, it is no answer', () => {
    expect(daysWaiting(deal(null), NOW)).toBe(null)
    expect(daysWaiting(null, NOW)).toBe(null)
    expect(daysWaiting({ created_at: 'not a date' }, NOW)).toBe(null)
  })

  // A clock a few seconds ahead must not produce "-1 days".
  it('and a date in the future reads as today, never as negative', () => {
    expect(daysWaiting({ created_at: ago(-2) }, NOW)).toBe(0)
  })
})

describe('the words on the row', () => {
  it('are plain, and never a judgement', () => {
    expect(waitedWords(11)).toBe('11 days')
    expect(waitedWords(1)).toBe('1 day')
    expect(waitedWords(0)).toBe('today')
    expect(waitedWords(null)).toBe('')
  })

  // THE PORTAL DOES NOT KNOW WHOSE FAULT A VALUER IS.
  it('nothing here tells the broker off', () => {
    for (const d of [0, 1, 6, 11, 40, null]) {
      const words = waitedWords(d).toLowerCase()
      for (const nag of ['overdue', 'late', 'chase', 'still', 'should']) {
        expect(words, `"${words}" reads as a judgement`).not.toContain(nag)
      }
    }
  })
})

describe('oldest first', () => {
  const rows = [deal(2), deal(11), deal(6)].map(d => ({ deal: d }))

  it('because the top of a list is the part anybody reads', () => {
    const sorted = oldestFirst(rows, r => r.deal, NOW)
    expect(sorted.map(r => daysWaiting(r.deal, NOW))).toEqual([11, 6, 2])
  })

  // NOT KNOWING HOW LONG IS NOT THE SAME AS A LONG TIME.
  it('and a deal with no date sorts last, not first', () => {
    const withBlank = [...rows, { deal: deal(null) }]
    const sorted = oldestFirst(withBlank, r => r.deal, NOW)
    expect(daysWaiting(sorted[sorted.length - 1].deal, NOW)).toBe(null)
  })

  it('leaves the list it was given alone', () => {
    const before = rows.map(r => r.deal.id)
    oldestFirst(rows, r => r.deal, NOW)
    expect(rows.map(r => r.deal.id)).toEqual(before)
  })
})

// 12 Nov 2026, Fabio on the broker's screen: "nothing here pushes him... no
// target, no league table, nothing red at them."
describe('and none of it is red', () => {
  const SRC = readFileSync('lib/how-long-waiting.ts', 'utf8')
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

  it('this file carries no colour at all', () => {
    for (const token of ['chase', 'text-chase', 'bg-chase', 'red']) {
      expect(SRC, `${token} on a broker's screen reads as an accusation`)
        .not.toContain(token)
    }
  })
})
