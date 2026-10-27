// A REWORK GOES TO THE TOP OF THE DAY, AND SAYS SO ON EVERY SCREEN.
//
// 27 Oct 2026. Fabio, asked whether a deal a broker sent back should jump the
// queue: straight to the top. The reasoning stands on its own - a rework is a
// deal that was FINISHED, where a client is already waiting and a broker has
// stopped. Everything below it is work nobody is blocked on yet.
//
// The ordering is in draftDay(); the words are in MyDay and on both forms. This
// holds the two together, because an order nobody can see the reason for is the
// exact thing the line was built to fix.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { draftDay, reworkWaiting, type PlanDeal } from './the-days-plan'

const REWORK = { at: '2026-10-27T09:12:00Z', by: 'Mark Gallo',
                 label: 'A different scenario', note: 'Run it on three securities.', count: 1 }

describe('what the draft puts first', () => {
  const list: PlanDeal[] = [
    { id: 'old', name: 'Ashworth 2026', stage: 'BC', since: '2026-10-01T00:00:00Z' },
    { id: 'star', name: 'Delacroix 2026', stage: 'LO', since: '2026-10-20T00:00:00Z',
      priority: { by: 'Mark', why: 'client is waiting', at: '2026-10-27T08:00:00Z' } },
    { id: 'back', name: 'Harding & Vass 2026', stage: 'BC', since: '2026-10-24T00:00:00Z',
      rework: REWORK },
  ]

  it('the rework, above a broker’s priority and above the oldest', () => {
    expect(draftDay(list).map(d => d.id)).toEqual(['back', 'star', 'old'])
  })

  it('and a rework that is also a priority is only counted once', () => {
    const both = [{ ...list[2], priority: list[1].priority }, list[1], list[0]]
    expect(draftDay(both).map(d => d.id)).toEqual(['back', 'star', 'old'])
  })

  it('two reworks go oldest first, like everything else on this list', () => {
    const two: PlanDeal[] = [
      { id: 'late', name: 'B', stage: 'BC', since: null, rework: { ...REWORK, at: '2026-10-27T11:00:00Z' } },
      { id: 'early', name: 'A', stage: 'BC', since: null, rework: { ...REWORK, at: '2026-10-27T09:00:00Z' } },
    ]
    expect(draftDay(two).map(d => d.id)).toEqual(['early', 'late'])
  })

  it('and with none, nothing about the old order changes', () => {
    expect(draftDay([list[0], list[1]]).map(d => d.id)).toEqual(['star', 'old'])
  })
})

describe('which stage the rework is read off', () => {
  const credit = { bc_owner_officer: 'o1', bc_owner_name: 'Katie Amos',
                   lo_owner_officer: 'o1', lo_owner_name: 'Katie Amos' }

  it('the one that is sitting with us', () => {
    const deal = { ...credit, fact_find_data: { applicants: [{ firstName: 'A' }] },
                   bc_rework_at: '2026-10-27T09:12:00Z', bc_rework_why: 'figures',
                   bc_rework_note: 'The rental figure is gross.', bc_rework_count: 1 }
    expect(reworkWaiting(deal)?.label).toBe('Figures are wrong')
  })

  it('and a BC that has been finished again has none', () => {
    const deal = { ...credit, fact_find_data: { applicants: [{ firstName: 'A' }] },
                   bc_rework_at: '2026-10-27T09:12:00Z', bc_rework_why: 'figures',
                   bc_rework_note: 'x', bc_completed_at: '2026-10-27T23:00:00Z' }
    expect(reworkWaiting(deal)).toBeNull()
  })

  it('a deal with no rework anywhere has none', () => {
    expect(reworkWaiting({ ...credit, fact_find_data: { applicants: [{ firstName: 'A' }] } })).toBeNull()
  })
})

// THE SCREENS. A rework that orders first and looks identical to everything
// else has done half a job.
describe('it is visible, not just first', () => {
  it('the day list says REWORK and shows the broker’s words', () => {
    const day = readFileSync('components/MyDay.tsx', 'utf8')
    expect(day).toContain("import { reworkChip } from '@/lib/send-it-back'")
    expect(day).toContain('reworkChip(d.rework as any)')
    expect(day).toContain('d.rework?.note')
  })

  it('and the draft hands it the rework in the first place', () => {
    const today = readFileSync('components/TodayPlan.tsx', 'utf8')
    expect(today).toContain('rework: reworkWaiting(d)')
  })

  it('both forms show the banner before anything else', () => {
    for (const f of ['app/(app)/deals/[id]/BCForm.tsx', 'app/(app)/deals/[id]/LOForm.tsx']) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} has no rework banner`).toContain('<ReworkBanner rework={reworkOn(deal,')
      // Above the row of buttons, not below it.
      expect(src.indexOf('<ReworkBanner'), f).toBeLessThan(src.indexOf('<WhatNow'))
    }
  })

  it('and both offer Send it back, gated on the same one rule', () => {
    for (const [f, stage] of [['app/(app)/deals/[id]/BCForm.tsx', 'bc'],
                              ['app/(app)/deals/[id]/LOForm.tsx', 'lo']] as const) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} does not offer it`).toContain(`canSendToClient && canSendBack(deal, '${stage}').ok`)
      expect(src).toContain('Send it back')
    }
  })

  it('and both can send the client email again', () => {
    // 27 Oct 2026: "once we mark email sent it locks and we cant resend the
    // email with rewoked figures".
    for (const [f, stage] of [['app/(app)/deals/[id]/BCForm.tsx', 'bc'],
                              ['app/(app)/deals/[id]/LOForm.tsx', 'lo']] as const) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} still locks the send button`).toContain(`canSendAgain(deal, '${stage}')`)
      expect(src).toContain("label: 'Send again'")
    }
    expect(readFileSync('components/WhatNow.tsx', 'utf8')).toContain('a.again &&')
  })

  it('the box will not go without both answers', () => {
    const box = readFileSync('components/SendItBack.tsx', 'utf8')
    expect(box).toContain('validateSendBack({ why, note })')
    expect(box).toContain('disabled={busy || missing.length > 0}')
  })

  it('and the route checks again, because the screen is not what decides', () => {
    const route = readFileSync('app/api/send-it-back/route.ts', 'utf8')
    expect(route).toContain('validateSendBack({ why, note })')
    expect(route).toContain('canSendBack(deal, stage)')
    // RLS refuses a write by returning no rows and no error.
    expect(route).toContain("if (!rows?.length)")
  })

  it('and the email credit gets has the reason in it, which it never had', () => {
    const mail = readFileSync('lib/salestrekker-notify.ts', 'utf8')
    expect(mail).toContain('export async function notifySentBack')
    // The broker types this. It must not be able to carry markup into the mail.
    expect(mail).toContain('safeText(note)')
  })
})
