import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// A TEST DEAL THAT IS STILL COUNTED SOMEWHERE IS NOT A TEST DEAL.
//
// 18 Sep 2026: five test deals were sitting in the book. They counted on the
// workload page, they counted on the dashboard and the pipeline, one of them
// had written a rate into lender_rate_observations - which is where the portal
// learns what lenders actually charge - and any of them could have sent a real
// Simplify Finance email to whatever address had been typed in.
//
// lib/test-deal.ts is the one rule. This test is the reason it stays the one
// rule: a screen that counts deals and does not ask it will not get out of the
// building. The same class of fault - one fact decided separately in two places
// and the two allowed to disagree - has cost an afternoon six times in this
// codebase, and the answer each time was a file like that one plus a test like
// this one.

const read = (p: string) => readFileSync(p, 'utf8')

// Every screen that puts a number in front of somebody, or lists the book.
const COUNTING_SCREENS = [
  ['the dashboard',            'app/(app)/dashboard/page.tsx'],
  ['the credit team workload', 'app/(app)/credit-team-workload/WorkloadClient.tsx'],
  ['the settlements list',     'app/(app)/settlements/page.tsx'],
  ['a client’s own page', 'app/(app)/clients/[id]/page.tsx'],
  ['the deals list',           'app/(app)/deals/page.tsx'],
]

describe('every screen that counts deals asks the rule', () => {
  for (const [what, file] of COUNTING_SCREENS) {
    it(`${what} filters test deals out`, () => {
      const src = read(file)
      expect(src, `${what} does not read lib/test-deal.ts at all`)
        .toContain("from '@/lib/test-deal'")
      expect(src, `${what} imports the rule but never calls realDealsOnly`)
        .toContain('realDealsOnly(')
    })
  }
})

describe('a test deal leaves no mark on the business', () => {
  it('the rate library is not written from a test deal', () => {
    const lo = read('app/(app)/deals/[id]/LOForm.tsx')
    const guard = lo.indexOf('recordsRateData(deal)')
    const write = lo.indexOf("from('lender_rate_observations')")
    expect(guard, 'LOForm does not ask whether this deal records rate data').toBeGreaterThan(-1)
    expect(write, 'LOForm no longer writes rate observations - move this test').toBeGreaterThan(-1)
    expect(guard, 'the rate observation is written BEFORE the test-deal check')
      .toBeLessThan(write)
  })

  it('the next steps email is addressed through the rule, never straight to the client', () => {
    const route = read('app/api/send-next-steps-email/route.ts')
    expect(route, 'the route does not use emailGoesTo').toContain('emailGoesTo(')
    // The old line. If it comes back, a test deal emails a real person again.
    expect(route, 'the route still addresses the client directly')
      .not.toContain('to: clientEmail,')
  })

  it('a new deal can be born as a test', () => {
    const deals = read('app/(app)/deals/page.tsx')
    expect(deals, 'the new deal screen has no tick').toContain('This is a test deal')
    expect(deals, 'the tick is not written to the row').toContain('is_test: isTest,')
  })

  it('a test deal says so across every tab', () => {
    const page = read('app/(app)/deals/[id]/DealPageClient.tsx')
    expect(page, 'nothing on the deal page says it is a test').toContain('<TestDealBand ')
    const band = read('components/TestDealBand.tsx')
    expect(band, 'the band is not admin-gated').toContain('canChangeTestFlag(userRole)')
  })
})

describe('the column this all rests on', () => {
  it('there is a migration, and it adds the column without touching a row', () => {
    const sql = read('docs/test-deal-schema.sql')
    expect(sql).toContain('add column if not exists is_test boolean not null default false')
    // Nothing in this migration may remove anything.
    expect(sql.toLowerCase()).not.toMatch(/\bdrop\s+(table|column|database)\b/)
    expect(sql.toLowerCase()).not.toMatch(/\bdelete\s+from\b/)
  })

  it('the pipeline register excludes test deals in the database, because no screen can', () => {
    const sql = read('docs/test-deal-schema.sql')
    expect(sql).toContain('create or replace function public.pipeline_register()')
    expect(sql, 'the register still reports test deals').toContain('where d.is_test = false')
  })
})
