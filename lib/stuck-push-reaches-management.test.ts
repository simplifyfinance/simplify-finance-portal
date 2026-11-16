// A DEAL NOBODY HAS COMES TO MANAGEMENT ON ITS OWN.
//
// 13 Nov 2026, Jayver Varghese. The push button was pressed, no email went,
// and nobody found out until Fabio went looking the next night. Credit were
// waiting, the broker believed it was handed over, and the client was waiting
// on both of them.
//
// Fabio, 14 Nov: "run through on his own after 1 hours" and "that sits on the
// admin today's page for everyone that is admin."
//
// So it is not his login, it is the admin Today; it is not Monday, it is an
// hour; and it is the red box that already exists rather than a new panel.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const PAGE = readFileSync('app/(app)/dashboard/page.tsx', 'utf8')
const RUN = readFileSync('components/RunThrough.tsx', 'utf8')

describe('the admin Today works out which deals are stuck', () => {
  it('it asks the one rule, rather than its own copy of it', () => {
    expect(PAGE).toContain("from '@/lib/the-push-leaves-a-mark'")
    expect(PAGE).toContain('needsChasing(')
    // A second idea of what "stuck" means is how two screens start disagreeing.
    expect(PAGE).not.toMatch(/60\s*\*\s*60\s*\*\s*1000/)
  })

  it('and hands them to the run-through', () => {
    expect(PAGE).toContain('stuckPushes={stuckPushes}')
  })

  // EVERY ADMIN, NOT ONE LOGIN. The View as picker is Fabio's alone; this is
  // not. Anybody who sees the run-through sees this.
  it('for everyone who sees the admin Today', () => {
    const where = PAGE.indexOf('stuckPushes={stuckPushes}')
    const block = PAGE.slice(PAGE.lastIndexOf('seesAll', where), where)
    expect(block).toContain('<RunThrough')
  })
})

describe('where it shows', () => {
  it('in the red box that already exists, not a new one', () => {
    expect(RUN).toContain('One thing is out of shape')
    expect(RUN).toContain('stuckPushes.length > 0 &&')
  })

  // 18 Nov 2026. THE BOX IS NOW THIS AND NOTHING ELSE.
  //
  // It used to carry a second line naming whoever had the most files open.
  // Fabio: "remove this for now, it wont work until we work on next project
  // with getting the system to really understand where files are sitting, as a
  // lot of the time its not their fault." A count of open files cannot tell a
  // file waiting on a lender from one waiting on her, so the line was a verdict
  // wearing a measurement's clothes. The numbers stay on Credit team workload.
  it('and names nobody for having a heavy week', () => {
    expect(RUN, 'the overloaded line must not come back').not.toContain('files open</b>, against a team average')
    expect(RUN).not.toContain('Move some off')
  })

  it('says when it was pressed, in Sydney time like everything else', () => {
    expect(RUN).toContain('dayMonthTime(s.at)')
    expect(RUN).toContain('No email was sent.')
  })

  it('and gives you the deal rather than making you find it', () => {
    expect(RUN).toContain('href={`/deals/${s.id}`}')
  })
})
