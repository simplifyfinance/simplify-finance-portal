// ONE ROW, THE SAME ON THE BC AND THE LENDING OPTIONS.
//
// 23 Oct 2026. Fabio put the two screens side by side and nothing matched:
//
//   "BC form"          vs  "LO Form"
//   "Preview & share"  vs  "Email Preview"
//   blue outline pill  vs  solid black
//   round pills        vs  square buttons
//   no Docs received   vs  Docs received
//
// And on the lending options the tab you were standing on and the button that
// moved the deal to Compliance were both solid black. One changes what you are
// reading, the other moves the deal, and they looked identical.
//
// "see right now theres NO consistency". He was right. This file is the lock.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const bc = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
const lo = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')
const row = readFileSync('components/WhatNow.tsx', 'utf8')

// WHAT A PERSON READS, NOT WHAT A COMMENT REMEMBERS.
//
// 23 Oct 2026. The first run of this file failed on the comment above the row
// in LOForm.tsx, which names the old labels in order to explain why they went.
// A lock that stops anybody writing down what changed is a lock that gets the
// history deleted instead. Same stripper as lib/who-is-doing-the-bc.test.ts.
const noComments = (s: string) =>
  s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

// Everything between <WhatNow and its closing />, on each screen.
function props(src: string): string {
  const i = src.indexOf('<WhatNow')
  expect(i, 'this screen does not draw the row at all').toBeGreaterThan(-1)
  return src.slice(i, src.indexOf('/>', i))
}

describe('the two screens draw the same row', () => {
  it('both use it, neither rolls its own', () => {
    for (const [name, src] of [['the BC', bc], ['the lending options', lo]] as const) {
      expect(src, `${name} does not import the row`).toContain("import WhatNow from '@/components/WhatNow'")
      expect(src, `${name} has a hand-rolled button bar again`)
        .not.toContain('rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap')
      expect(src, `${name} has the little grey rules between button groups again`)
        .not.toContain('<div className="w-px h-8 bg-gray-200" />')
    }
  })

  it('and hand it the same things, in the same order', () => {
    const want = ['stage=', 'deal={deal}', 'view=', 'onView=', 'finishedAt=', 'canAllocate=', 'onOwnerChange=', 'actions=']
    for (const [name, src] of [['the BC', bc], ['the lending options', lo]] as const) {
      const p = props(src)
      let at = -1
      for (const k of want) {
        const i = p.indexOf(k)
        expect(i, `${name} does not pass ${k}`).toBeGreaterThan(-1)
        expect(i, `${name} passes ${k} out of order`).toBeGreaterThan(at)
        at = i
      }
    }
  })

  it('name the stage they actually are', () => {
    expect(props(bc)).toContain('stage="bc"')
    expect(props(lo)).toContain('stage="lo"')
  })

  it('and the old names are gone from both', () => {
    for (const [name, src] of [['the BC', bc], ['the lending options', lo]] as const) {
      const code = noComments(src)
      expect(code, `${name} still says Preview & share`).not.toContain('Preview &amp; share')
      expect(code, `${name} still says Email Preview`).not.toContain('Email Preview')
    }
  })
})

describe('a tab can never be mistaken for an action', () => {
  it('the view switch is quiet and grey, not black', () => {
    const i = row.indexOf('THE VIEW.')
    const switchBlock = row.slice(i, row.indexOf('What now', i))
    expect(switchBlock).toContain('bg-line-soft')
    expect(switchBlock, 'the view switch is solid black again, like the buttons')
      .not.toContain('bg-ink')
  })

  it('and the actions are the only black thing', () => {
    const actionBlock = row.slice(row.indexOf('{actions.map'))
    expect(actionBlock).toContain('bg-ink text-page')
  })
})

describe('the buttons', () => {
  // The BC has three. The lending options has four, because "Docs received"
  // is a thing that happens on that stage and nowhere else. Five would be a
  // menu, and a menu is what this row replaced.
  it('never more than four, because five is a menu', () => {
    for (const [name, src] of [['the BC', bc], ['the lending options', lo]] as const) {
      const p = props(src)
      const block = p.slice(p.indexOf('actions={['))
      expect((block.match(/label:/g) || []).length, `${name} has too many`).toBeLessThanOrEqual(4)
    }
  })

  it('are shown greyed rather than hidden', () => {
    expect(row).toContain('waiting')
    expect(row).toContain('border-dashed')
  })

  it('say the same words on both screens', () => {
    for (const src of [bc, lo]) {
      expect(props(src)).toContain("'Send to client'")
      expect(props(src)).toContain('Client agreed')
    }
  })

  it('and use the portal’s own colours, no amber', () => {
    for (const token of ['bg-done-bg', 'bg-info-bg', 'bg-ink', 'bg-line-soft']) {
      expect(row).toContain(token)
    }
    expect(row).not.toMatch(/amber|yellow|orange/)
  })
})

describe('who is doing it', () => {
  it('offers two answers, never a list of names', () => {
    // Written as {'I\u2019ll do it'} rather than I&rsquo;ll, so that the word
    // lock in lib/what-the-forms-say.ts can see it. An entity is invisible to
    // every reader except the browser.
    expect(row).toContain("I\u2019ll do it")
    expect(row).toContain('Put it in the credit queue')
    expect(row, 'the broker is picking a person again')
      .not.toMatch(/officers\.map|credit_officers\.map/)
  })

  it('both screens hand over through the one function', () => {
    for (const [name, src] of [['the BC', bc], ['the lending options', lo]] as const) {
      expect(src, `${name} does its own handover`)
        .toContain("import { handStageOver } from '@/lib/hand-this-stage-over'")
    }
    expect(bc).toContain("handStageOver(supabase, deal.id, 'bc', choice")
    expect(lo).toContain("handStageOver(supabase, deal.id, 'lo', choice")
  })
})

describe('compliance is deliberately untouched', () => {
  it('this ship changed the BC and the lending options only', () => {
    const compliance = readFileSync('app/(app)/deals/[id]/ComplianceForm.tsx', 'utf8')
    expect(compliance, 'compliance was in scope for a later ship')
      .not.toContain('<WhatNow')
  })
})
