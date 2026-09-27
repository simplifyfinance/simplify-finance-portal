// THE FIRST DECISION ON A DEAL WAS THREE CLICKS DEEP.
//
// Fabio, 27 Sep 2026: "Move the BC allocation button to somewhere here - maybe
// highlighted. Right now its on BC - Borrowing Capacity - then hit preview &
// Share and then hit the button."
//
// BC tab, then the Preview & share sub-tab, then the button - behind the one
// tab nobody opens unless they are emailing a client. The same thing happened
// to "Client agreed - move to LO" on 2 September and the answer was the same:
// the action that moves a deal on belongs on the deal.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const strip = (s: string) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('it is on the deal page now', () => {
  const page = strip(read('../app/(app)/deals/[id]/DealPageClient.tsx'))

  it('drawn once, under the document list and above the tabs', () => {
    expect((page.match(/<WhoIsDoingTheBc\s/g) || []).length).toBe(1)
    const at = page.indexOf('<WhoIsDoingTheBc')
    expect(page.slice(0, at)).toContain('<DocumentsBox')
    expect(page.slice(at)).toContain('{tabs.map(')
  })

  it('and it tells the page when it has been answered', () => {
    const at = page.indexOf('<WhoIsDoingTheBc')
    expect(page.slice(at, at + 300)).toContain('onUpdated')
  })
})

describe('it is a question, not a permanent row of buttons', () => {
  const src = read('../components/WhoIsDoingTheBc.tsx')
  const code = strip(src)

  it('disappears once somebody is on it', () => {
    expect(code).toContain('assigned_credit_officer')
    expect(code).toContain('bc_self_assigned')
    expect(code).toContain('if (answered || finished) return null')
  })

  it('and never shows on a finished deal', () => {
    expect(code).toContain("deal?.status === 'completed'")
    expect(code).toContain('settled_at')
  })

  it('does the same two things the old buttons did', () => {
    expect(code).toContain('/api/allocate-credit-officer')
    expect(code).toContain('bc_self_assigned: true')
    // Ellie's SalesTrekker card, off the back of either answer - and it is
    // asked for in ONE place, so the two buttons cannot drift apart the way the
    // two copies in BCForm had.
    expect((code.match(/fetch\('\/api\/notify-salestrekker'/g) || []).length).toBe(1)
    expect(code).toContain("trigger: 'bc_action'")
  })

  // Zero rows with no error means the write was refused. The old handler
  // checked for it and so does this one.
  it('never reports a refused write as saved', () => {
    expect(code).toContain('rows.length === 0')
  })
})

describe('and it has gone from Preview and share', () => {
  const bc = strip(read('../app/(app)/deals/[id]/BCForm.tsx'))

  it('the two buttons are not there any more', () => {
    expect(bc).not.toContain('handleBcSelfAssign')
    expect(bc).not.toContain('sendToCreditTeam')
    expect(bc).not.toContain('bcSelfAssigned')
  })

  it('nothing is left behind that would not compile', () => {
    for (const dead of ['creditTeamMsg', 'creditTeamErr', 'sendingToCreditTeam', 'assignmentRefreshKey']) {
      expect(bc, `${dead} is still referenced`).not.toContain(dead)
    }
  })

  // The credit officer's own button is a different thing and stays where it is.
  it('but "Done — send to broker for review" stays', () => {
    expect(bc).toContain('markBCComplete')
    expect(bc).toContain('Done — send to broker for review')
  })
})
