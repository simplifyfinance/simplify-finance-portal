// THE SLOTS REACH THE SCREENS.
//
// 27 Oct 2026. Catherine, Operations Manager, item 2 of nine: "The deal lists
// the credit managers send don't show which broker each deal belongs to. When
// Mark and Kylie reprioritise, other brokers' deals, like Justin's, keep
// getting pushed back."
//
// lib/a-slot-each.test.ts holds the rule. This holds the wiring, because a
// fair order nobody is shown is not worth having.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { draftDay, type PlanDeal } from './the-days-plan'
import { askOn } from './a-slot-each'

const DAY = '2026-10-27'
const at = (t: string) => `${DAY}T${t}:00+11:00`
const ask = (by: string, t: string) =>
  askOn({ priority_by: by, priority_why: 'Finance clause Friday', priority_at: at(t), priority_day: DAY }, DAY)

describe('the draft shares the asks out', () => {
  const list: PlanDeal[] = [
    { id: 'm1', name: 'A', stage: 'BC', since: at('07:00'), priority: ask('mark', '08:00') },
    { id: 'm2', name: 'B', stage: 'BC', since: at('07:00'), priority: ask('mark', '08:05') },
    { id: 'j1', name: 'C', stage: 'BC', since: at('07:00'), priority: ask('justin', '09:40') },
    { id: 'old', name: 'D', stage: 'BC', since: '2026-10-01T00:00:00Z' },
  ]

  it('Justin is seen before Mark gets a second one', () => {
    expect(draftDay(list).map(d => d.id)).toEqual(['m1', 'j1', 'm2', 'old'])
  })

  it('and everything nobody asked for is still oldest first, underneath', () => {
    const more: PlanDeal[] = [...list,
      { id: 'older', name: 'E', stage: 'BC', since: '2026-09-01T00:00:00Z' }]
    expect(draftDay(more).map(d => d.id)).toEqual(['m1', 'j1', 'm2', 'older', 'old'])
  })

  it('a rework still beats every ask', () => {
    const withRework: PlanDeal[] = [...list, {
      id: 'rw', name: 'F', stage: 'BC', since: at('07:00'),
      rework: { at: at('09:00'), by: 'Mark Gallo', label: 'A different scenario', note: 'x', count: 1 },
    }]
    expect(draftDay(withRework)[0].id).toBe('rw')
  })

  it('and a day with no asks is unchanged from how it always was', () => {
    const plain: PlanDeal[] = [
      { id: 'b', name: 'B', stage: 'BC', since: '2026-10-05T00:00:00Z' },
      { id: 'a', name: 'A', stage: 'BC', since: '2026-10-01T00:00:00Z' },
    ]
    expect(draftDay(plain).map(d => d.id)).toEqual(['a', 'b'])
  })
})

describe('what credit now sees on every row', () => {
  const day = readFileSync('components/MyDay.tsx', 'utf8')

  it('whose file it is, which it never said', () => {
    expect(day).toContain('{d.broker && <span className={BRK}>')
    expect(day).toContain("import { brokerLabel } from '@/lib/broker-key'")
  })

  it('and a name, not the key, because the key is lower case by design', () => {
    expect(day).toContain('brokerLabel(d.broker).toUpperCase()')
  })

  it('who asked, and why', () => {
    expect(day).toContain('askChip(d.priority')
    expect(day).toContain('d.priority?.why')
  })
})

describe('and the broker asks on their own Today', () => {
  const today = readFileSync('components/TodayPlan.tsx', 'utf8')
  const control = readFileSync('components/AskForThisNext.tsx', 'utf8')

  it('on the box that already lists their files with credit', () => {
    expect(today).toContain('<AskForThisNext deal={deal} deals={deals} brokerKey={brokerKey}')
  })

  it('the reason is required', () => {
    expect(control).toContain('validateAsk({ by: me, why })')
    expect(control).toContain('disabled={busy || !!problem}')
  })

  it('asking for a second one moves the slot instead of failing', () => {
    // A broker changing their mind at eleven is the normal case. Telling them
    // "you have used today's slot" sends them straight back to email.
    expect(control).toContain('You already asked for')
    expect(control).toContain('clearAskPatch()')
  })

  it('and the old one is cleared BEFORE the new one is written', () => {
    // The database holds one ask per broker per day, so the other order is
    // simply refused by the unique index.
    const i = control.indexOf('if (moving)')
    const j = control.indexOf('askPatch({ by: me, why })')
    expect(i).toBeGreaterThan(-1)
    expect(i, 'the new ask is written before the old one is cleared').toBeLessThan(j)
  })

  it('and the write is checked, because RLS refuses by saying nothing', () => {
    expect(control).toContain('if (error || !data?.length)')
  })
})

describe('today only', () => {
  it('the draft reads today’s ask, not whatever is on the column', () => {
    const today = readFileSync('components/TodayPlan.tsx', 'utf8')
    expect(today).toContain('priority: askWaiting(d, today)')
    expect(today, 'the raw column is being read again').not.toContain('priority: d.priority || null')
  })
})
