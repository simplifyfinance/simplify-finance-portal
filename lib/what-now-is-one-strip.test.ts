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
    const want = ['stage=', 'deal={deal}', 'view=', 'onView=', 'canAllocate=', 'onOwnerChange=', 'actions=']
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
  //
  // 27 Oct 2026. "Send it back" arrived and this read five on the BC. The rule
  // is right and it is not being loosened - what changed is that the count was
  // wrong in two ways.
  //
  // FIRST, IT COUNTED A BUTTON ATTACHED TO ANOTHER BUTTON. `again` is the
  // quiet "Send again" that sits beside the green tick - see Action in
  // components/WhatNow.tsx. It has a label, so the old regex counted it as a
  // fifth action. It is not one; it cannot exist without the action it hangs
  // off, and it only appears once that action is done.
  //
  // SECOND, IT COUNTED THINGS THAT CANNOT BE ON SCREEN TOGETHER. "Done" is
  // there only while the BC is UNfinished; "Send it back" only once it IS
  // finished. One or the other, never both - which is the invariant this test
  // was actually reaching for, and it is now asserted rather than approximated.
  it('never more than four, because five is a menu', () => {
    for (const [name, src] of [['the BC', bc], ['the lending options', lo]] as const) {
      const p = props(src)
      const block = p.slice(p.indexOf('actions={['))
      // The nested `again` button is not an action of its own.
      const flat = block.replace(/again:[\s\S]*?: undefined,/g, '')
      const n = (flat.match(/label:/g) || []).length
      const exclusive = /!bcCompletedAt \? \[\{/.test(flat) || /!loCompletedAt \? \[\{/.test(flat)
      // A pair that can never be drawn together counts as one slot.
      expect(n - (exclusive ? 1 : 0), `${name} has too many`).toBeLessThanOrEqual(4)
    }
  })

  it('and Done and Send it back are never both on screen', () => {
    // The whole reason four is still four. Done shows while the stage is
    // unfinished; Send it back shows only once it is finished.
    for (const [name, src, stamp] of [['the BC', bc, 'bcCompletedAt'],
                                      ['the lending options', lo, 'loCompletedAt']] as const) {
      const p = props(src)
      expect(p, `${name} shows Done without checking the stamp`)
        .toContain(`!${stamp} ? [{`)
      expect(p, `${name} offers Send it back without checking it is finished`)
        .toMatch(/canSendToClient && canSendBack\(deal, '(bc|lo)'\)\.ok/)
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

// COMPLIANCE CAUGHT UP, 27 Oct 2026.
//
// This used to assert that ComplianceForm had NO WhatNow - "compliance was in
// scope for a later ship", written on 23 Oct when the BC and the lending
// options got the row. That later ship is Catherine's item 8: "Auto-assign
// Compliance by capacity - the same way Credit work is assigned now."
//
// A test that says "not yet" has to be rewritten the day it happens, or it
// starts failing good work and somebody deletes it in a hurry. So it now
// asserts the thing that must stay true instead: all three stages use the one
// row, and none of them grows its own.
describe('all three stages use the one row', () => {
  const compliance = readFileSync('app/(app)/deals/[id]/ComplianceForm.tsx', 'utf8')

  it('compliance has it too, and asks the same queue', () => {
    expect(compliance).toContain('<WhatNow')
    expect(compliance).toContain('stage="compliance"')
    expect(compliance).toContain("handStageOver(supabase, deal.id, 'compliance', choice")
  })

  it('but with no view switch, because compliance is one page', () => {
    expect(compliance).toContain('showView={false}')
  })

  it('and nobody draws their own row beside it', () => {
    // The whole reason this file exists - see the note at the top of
    // components/WhatNow.tsx about five different drawings of one thing.
    const code = compliance.split('\n')
      .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')
    expect(code).not.toContain('What now<')
  })
})
