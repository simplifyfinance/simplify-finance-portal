// ONE STRIP, THE SAME ON EVERY STAGE.
//
// 22 Oct 2026. The BC and the Lending options each had their own row of buttons
// in their own order, split by little grey rules, and two of them disappeared
// entirely when no credit officer was assigned. Fabio, on why his team hesitate
// before pressing anything: a button that is sometimes there and sometimes not
// is how a screen loses their trust.
//
// The fix was not new buttons. It was separating the two things that were being
// drawn as one row - where the deal IS, which is a picture, from what to do
// next, which is at most two buttons.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const bc = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
const lo = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')
const strip = readFileSync('components/WhatNow.tsx', 'utf8')

describe('both stages use the one strip', () => {
  for (const [name, src] of [['the BC', bc], ['the lending options', lo]] as const) {
    it(`${name} draws WhatNow rather than its own row of buttons`, () => {
      expect(src).toContain("import WhatNow from '@/components/WhatNow'")
      expect(src).toContain('<WhatNow')
    })

    it(`${name} no longer has the hand-rolled button bar`, () => {
      expect(src, 'the old bar is back')
        .not.toContain('rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap')
      expect(src, 'the little grey rules between button groups are back')
        .not.toContain('<div className="w-px h-8 bg-gray-200" />')
    })

    it(`${name} still sends, and still hands back to the broker`, () => {
      expect(src).toContain('Send to client')
      expect(src).toContain('setThenSend(true); setHandingOver(true)')
    })
  }
})

describe('the strip keeps status and actions apart', () => {
  it('the steps are not buttons', () => {
    const stepsBlock = strip.slice(strip.indexOf('{steps.map'), strip.indexOf('What now'))
    expect(stepsBlock, 'a step became pressable, which is the confusion coming back')
      .not.toContain('<button')
    expect(stepsBlock).not.toContain('onClick')
  })

  it('the actions are buttons and carry the heading', () => {
    expect(strip).toContain('What now')
    expect(strip).toContain('{actions.map')
    expect(strip).toContain('<button')
  })

  it('uses the portal’s own colours and no amber', () => {
    for (const token of ['bg-done-bg', 'bg-info-bg', 'bg-waiting-bg', 'bg-ink']) {
      expect(strip).toContain(token)
    }
    expect(strip).not.toMatch(/amber|yellow|orange/)
  })
})

describe('never more than two buttons', () => {
  // Three is a menu, and a menu is the thing this replaces. Counted off the
  // call sites rather than trusted: each actions={[...]} has at most two
  // entries, and each entry is a spread guarded by one condition.
  for (const [name, src] of [['the BC', bc], ['the lending options', lo]] as const) {
    it(`${name} offers at most two`, () => {
      const i = src.indexOf('actions={[')
      expect(i, `${name} has no actions`).toBeGreaterThan(-1)
      const block = src.slice(i, src.indexOf('hint={', i))
      expect((block.match(/label:/g) || []).length).toBeLessThanOrEqual(2)
    })
  }
})
