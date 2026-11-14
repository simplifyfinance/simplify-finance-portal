// THE PERSON WHO PRESSED IT IS TOLD.
//
// 13 Nov 2026. Katie pressed push on Jayver Varghese's deal, no email went,
// and nothing was written anywhere. She walked away believing it had gone.
// It took three SQL queries and the Supabase request logs, at midnight, to
// find out - and it came close to being a conversation with her about whether
// she was telling the truth.
//
// The mark and the one-hour chase both shipped on 14 Nov. But the chase goes
// to the run-through, which is management's screen. Fabio asked whether it
// should also reach the person who pressed it, and the question went
// unanswered for a day.
//
// She is the one person who could have fixed it in thirty seconds, and the
// only one the portal never told.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  startPush, appended, settled, needsChasing, pressedBy, mineNotArrived,
  STUCK_AFTER_MS,
} from './the-push-leaves-a-mark'

const KATIE = 'user-katie'
const MEL = 'user-mel'
const NOW = new Date('2026-11-13T15:11:00+11:00')
const LATER = new Date(NOW.getTime() + STUCK_AFTER_MS + 60_000)
const SOON = new Date(NOW.getTime() + 10 * 60_000)

const pushed = (by: string, byId: string, at: Date = NOW) =>
  appended(null, startPush(by, at, byId))

const deal = (id: string, log: any, name = 'A deal') =>
  ({ id, deal_name: name, push_log: log })

describe('who pressed it', () => {
  // A NAME IS SOMETHING A PERSON TYPES AND RETYPES. The id is written at the
  // moment of the press and never changes. See CLAUDE.md.
  it('is read from the id, never from the name', () => {
    const log = pushed('Katie', KATIE)
    expect(pressedBy(log, KATIE)).toBe(true)
    expect(pressedBy(log, MEL)).toBe(false)
    expect(pressedBy(log, 'Katie')).toBe(false)
  })

  it('and nobody owns a push with no log', () => {
    expect(pressedBy(null, KATIE)).toBe(false)
    expect(pressedBy(pushed('Katie', KATIE), '')).toBe(false)
  })
})

describe('the pushes I made that never arrived', () => {
  it('appear on my screen once the hour is up', () => {
    const deals = [deal('d1', pushed('Katie', KATIE), 'Varghese 2026')]
    expect(mineNotArrived(deals, KATIE, SOON)).toEqual([])
    const mine = mineNotArrived(deals, KATIE, LATER)
    expect(mine).toHaveLength(1)
    expect(mine[0].id).toBe('d1')
    expect(mine[0].name).toBe('Varghese 2026')
  })

  // THE SAME HOUR AS THE RUN-THROUGH USES. If these two ever disagreed,
  // somebody would be chased about a deal their own screen said was fine.
  it('on exactly the same clock management is chased on', () => {
    const log = pushed('Katie', KATIE)
    expect(needsChasing(log, LATER)).toBe(true)
    expect(mineNotArrived([deal('d1', log)], KATIE, LATER)).toHaveLength(1)
    expect(needsChasing(log, SOON)).toBe(false)
    expect(mineNotArrived([deal('d1', log)], KATIE, SOON)).toHaveLength(0)
  })

  it('and never on somebody else\'s', () => {
    const deals = [deal('d1', pushed('Katie', KATIE))]
    expect(mineNotArrived(deals, MEL, LATER)).toEqual([])
  })

  // A PUSH THAT WORKED IS NOT A PROBLEM.
  it('a push that arrived is not on anybody\'s screen', () => {
    const log = settled(pushed('Katie', KATIE), NOW.toISOString(),
      { state: 'sent', to: 'SalesTrekker', packs: 4 })
    expect(needsChasing(log, LATER)).toBe(false)
    expect(mineNotArrived([deal('d1', log)], KATIE, LATER)).toEqual([])
  })

  it('says what happened in words she can act on', () => {
    const mine = mineNotArrived([deal('d1', pushed('Katie', KATIE))], KATIE, LATER)
    expect(mine[0].line).toBe('You pushed this and it never arrived. Nobody has this deal.')
  })

  // IT IS NOT AN ACCUSATION. The software failed, not the person. "When the
  // data and a person's account disagree, assume the software failed."
  it('and never blames her for it', () => {
    const mine = mineNotArrived([deal('d1', pushed('Katie', KATIE))], KATIE, LATER)
    const words = mine[0].line.toLowerCase()
    for (const blame of ['you did not', 'you failed', 'forgot', 'should have', 'again']) {
      expect(words, `"${words}" reads as blame`).not.toContain(blame)
    }
  })

  it('handles an empty book and a missing id', () => {
    expect(mineNotArrived([], KATIE, LATER)).toEqual([])
    expect(mineNotArrived(null as any, KATIE, LATER)).toEqual([])
    expect(mineNotArrived([deal('d1', pushed('Katie', KATIE))], null, LATER)).toEqual([])
  })
})

describe('the wiring', () => {
  const PAGE = readFileSync('app/(app)/dashboard/page.tsx', 'utf8')
  const TODAY = readFileSync('components/TodayPlan.tsx', 'utf8')

  it('the page works it out for whoever is being looked at', () => {
    expect(PAGE).toContain('mineNotArrived(')
    expect(PAGE).toContain('myStuckPushes')
  })

  it('and her own screen tells her, above everything else', () => {
    expect(TODAY).toContain('myStuckPushes')
  })
})
