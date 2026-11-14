// THE ORDER FROM ABOVE, ON SCREEN.
//
// 12 Nov 2026. Fabio: "the brokers and admin always dictate for Katie and Mel
// what they want to be done first."
//
// And on what happens at her end: "Credit never disagrees with the order...
// if I give the order, they follow the order."
//
// 14 Nov, after I offered a version where her confirmed day was reopened and
// she had to answer it again: "I don't want her to have to agree to it... she
// does confirm that she understands the changes."
//
// SO THE WHOLE LOOP ASKS ONE QUESTION: has she seen it. No accepting, no
// declining, no re-confirming her day. The rules are in
// lib/the-order-from-above.ts and its own 24 tests; this is the wiring.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const RUN = readFileSync('components/RunThrough.tsx', 'utf8')
const SET = readFileSync('components/SetHerOrder.tsx', 'utf8')
const CAME = readFileSync('components/TheOrderCame.tsx', 'utf8')
const TODAY = readFileSync('components/TodayPlan.tsx', 'utf8')
const PAGE = readFileSync('app/(app)/dashboard/page.tsx', 'utf8')

describe('management sets it', () => {
  it('from the credit team column, on every admin\'s Today', () => {
    expect(RUN).toContain('Set her order')
    expect(RUN).toContain('<SetHerOrder')
  })

  it('and the page gives each assessor her own open files to order', () => {
    expect(PAGE).toContain('openDeals:')
    expect(PAGE).toContain("d.assigned_credit_officer === o.id")
  })

  // IT IS HER OWN LIST, REORDERED - not a day invented for her.
  it('which is her list reordered, with the shared move/add/remove rules', () => {
    expect(SET).toContain('moveBy(')
    expect(SET).toContain('putOn(')
    expect(SET).toContain('takeOff(')
  })

  it('and the write is the one function that clears seen_at', () => {
    expect(SET).toContain('orderPatch(me, ids, note)')
    // A hand-rolled update here would be a second shape of the same row, and
    // would forget to clear seen_at - which is the entire loop.
    expect(SET).not.toContain('order_from: {')
  })

  // 14 Nov 2026: "I think the option to tell them why, but I don't want it to
  // be obligatory."
  it('the note is offered and never demanded', () => {
    expect(SET).toContain('Optional')
    expect(SET).toContain('disabled={busy || ids.length === 0}')
    expect(SET, 'an empty note must not block sending').not.toContain('!note')
  })

  it('and the write is checked, because a blocked policy returns no rows', () => {
    expect(SET).toContain('checkedWrite(')
  })
})

describe('the loop closes on her screen', () => {
  it('she is told, above the day she was already going to answer', () => {
    expect(TODAY).toContain('<TheOrderCame plan={myRow}')
    const order = TODAY.indexOf('<TheOrderCame')
    const presses = TODAY.indexOf("{view === 'credit' && dayCard}")
    expect(order).toBeLessThan(presses)
  })

  // THE ONE RULE THAT MATTERS. Got it means seen.
  it('and the only thing she can press is that she has seen it', () => {
    expect(CAME).toContain('Got it')
    expect(CAME).toContain("seen_at:")
    for (const never of ['Accept', 'Decline', 'Agree', 'Reject']) {
      expect(CAME, `there is no ${never} button in this loop`).not.toContain(never)
    }
  })

  it('her day is not un-ticked by it', () => {
    expect(CAME).not.toContain('confirmed_at')
  })

  it('and somebody looking at her day cannot answer for her', () => {
    expect(TODAY).toContain("{view === 'credit' && !readOnly && meOfficerId && myRow && (")
  })
})

describe('and management can see whether she looked', () => {
  it('the pill is the shared rule, not a second idea of seen', () => {
    expect(RUN).toContain('seenState(t.plan')
    expect(RUN).toContain("from '@/lib/the-order-from-above'")
  })

  it('and it is red until she has, green after', () => {
    expect(RUN).toContain('border-done-edge bg-done-bg text-done')
    expect(RUN).toContain('border-chase-edge bg-chase-bg text-chase')
  })
})
