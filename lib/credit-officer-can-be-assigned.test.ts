import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// A DEAL WITH NOBODY ON IT IS INVISIBLE TO THE CREDIT TEAM.
//
// 8 Oct 2026. Fabio cloned a deal and the credit officer could not see it:
// "only lets me reassign broker not credit can we avoid this in futrue find a
// fix".
//
// Two faults met. The clone did not carry assigned_credit_officer, so the copy
// was born with nobody on it - fixed in lib/clone-deal.ts, guarded in
// lib/clone-deal.test.ts. And this screen, the one place that could have put
// somebody on it, began:
//
//     if (!assignedId) return null
//
// So the control that assigns a credit officer was hidden on exactly the deals
// that had none. You could re-assign; you could never assign. The only way in
// was the push-to-credit flow, which does not happen twice on a copy.
//
// WHY IT IS NOT A COSMETIC BUG. docs/rls_rollback_2026-08-19.sql, "Deal
// visibility by role": a staff member sees a deal only where
// assigned_credit_officer is theirs. An unassigned deal is invisible to the
// whole credit team, and the screen that could have fixed that was hiding
// itself.

const src = readFileSync('app/(app)/deals/[id]/CreditOfficerAssignment.tsx', 'utf8')

describe('a credit officer can be put on a deal that has none', () => {
  it('does not hide itself just because nobody is assigned', () => {
    expect(src, 'the control is hidden on exactly the deals that need it')
      .not.toMatch(/if \(!assignedId\) return null/)
  })

  it('still stays out of the way for somebody who cannot assign', () => {
    // A broker or a staff member seeing "Nobody assigned" with no way to act
    // on it is noise. The state is shown to the people who can change it.
    expect(src).toContain('if (!assignedId && !isAdmin) return null')
  })

  it('says what the empty state costs, rather than showing a blank', () => {
    expect(src).toContain('Nobody assigned')
    expect(src, 'the reason it matters is not said, so it reads as a label')
      .toMatch(/credit team cannot see this deal/i)
  })

  it('offers to assign, not only to reassign', () => {
    expect(src).toMatch(/Assign a credit officer/)
    // Two buttons, not one with a ternary label: lib/nothing-is-lost.test.ts
    // reads the words a person can see as text nodes, and a label folded into
    // an expression is one that can be deleted without the snapshot noticing.
    expect(src).toMatch(/>Reassign</)
  })

  it('says why the list is empty instead of offering a dead dropdown', () => {
    // The options are the officers linked to THIS deal's broker. When there
    // are none, an empty select beside a Confirm that can never be pressed
    // teaches nobody anything.
    expect(src).toMatch(/No credit officer is linked to/)
  })

  it('wears colours that have a dark value', () => {
    // Tailwind's own green and red are the same in both themes. Ours invert -
    // the Settlements page was fixed for this on 6 Oct and this file was
    // missed. See lib/colours.ts.
    for (const c of ['text-green-600', 'bg-green-50', 'border-green-200',
                     'text-red-600', 'bg-red-50', 'border-red-200']) {
      expect(src, `${c} is Tailwind's own and does not invert in dark mode`)
        .not.toContain(c)
    }
  })
})
