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
    // One box, opened when either thing is true.
    expect(RUN).toContain('(stuckPushes.length > 0 || overloaded)')
  })

  // A DEAL NOBODY HAS IS WORSE THAN A HEAVY WEEK, so it reads first.
  it('above the overloaded line, and both can be there at once', () => {
    const box = RUN.slice(RUN.indexOf('One thing is out of shape'))
    const stuck = box.indexOf('stuckPushes.map(')
    const heavy = box.indexOf('{overloaded && (')
    expect(stuck).toBeGreaterThan(-1)
    expect(heavy).toBeGreaterThan(-1)
    expect(stuck).toBeLessThan(heavy)
  })

  it('says when it was pressed, in Sydney time like everything else', () => {
    expect(RUN).toContain('dayMonthTime(s.at)')
    expect(RUN).toContain('No email was sent.')
  })

  it('and gives you the deal rather than making you find it', () => {
    expect(RUN).toContain('href={`/deals/${s.id}`}')
  })
})
