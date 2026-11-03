import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { everyRow, ASK, STOP_AT } from './the-whole-book'
import { isTestDeal, realDealsOnly, REAL_DEALS_OR } from './test-deal'

// 92 DEALS LOOKED LIKE ALL OF THEM.
//
// 2 Nov 2026. Fabio: "can you help me find deal cards for andrew leigh and
// sangeeta gudigar I dont seem to be able to locate it but they were there
// yesterday."
//
// Both were in the database, both assigned to him, neither deleted. The deals
// screen asked for every deal at once; the database answered with the newest
// thousand of 1165 and said nothing about the rest. 1075 deals sit between
// today and Lucy's, so hers never arrived - and the search found nothing
// because a search can only search what was fetched.
//
// 241 of those deals were real. The board showed 92. The other 149 were on no
// screen in the portal.
//
// A LIMIT THAT SAYS NOTHING IS THE DANGEROUS KIND, and this board exists
// because nine deals once sat hidden. Every rule on it since - a filter is
// never quiet, a folded column still counts - came from that morning.

// A database that will only ever hand back `cap` rows at a time, like the real
// one, and will not say so.
function server(total: number, cap = ASK) {
  const all = Array.from({ length: total }, (_, i) => ({ id: i }))
  let asks = 0
  return {
    asks: () => asks,
    page: (from: number, to: number) => {
      asks++
      const want = Math.min(to - from + 1, cap)
      return Promise.resolve({ data: all.slice(from, from + want), error: null })
    },
  }
}

describe('EVERY ROW, NOT THE FIRST PAGE OF THEM', () => {
  it('reads past the cap', async () => {
    const s = server(1165)
    const { rows, truncated } = await everyRow<any>(s.page)
    expect(rows).toHaveLength(1165)
    expect(truncated).toBe(false)
  })

  it('AND THE ROWS ARE IN ORDER, NOT A PAGE REPEATED', async () => {
    const { rows } = await everyRow<any>(server(2500).page)
    expect(rows.map((r: any) => r.id)).toEqual(rows.map((_: any, i: number) => i))
  })

  it('AND A SERVER THAT CAPS LOWER THAN WE ASK IS STILL READ IN FULL', async () => {
    // The obvious version of this stops at the first short page, which on a
    // server capping at 100 would read 100 rows and be quieter than the bug.
    const s = server(1165, 100)
    const { rows, truncated } = await everyRow<any>(s.page)
    expect(rows).toHaveLength(1165)
    expect(truncated).toBe(false)
  })

  it('and an empty table is one ask and no rows', async () => {
    const s = server(0)
    const { rows, truncated } = await everyRow<any>(s.page)
    expect(rows).toEqual([])
    expect(truncated).toBe(false)
    expect(s.asks()).toBe(1)
  })

  it('and a table that fits in one page does not get read twice over', async () => {
    const s = server(40)
    await everyRow<any>(s.page)
    // One page of rows, then one that says there are no more.
    expect(s.asks()).toBe(2)
  })
})

describe('AND A SHORT READ SAYS SO', () => {
  it('a failed page is not the end of the book', async () => {
    let n = 0
    const { rows, error, truncated } = await everyRow<any>((from, to) => {
      n++
      if (n === 2) return Promise.resolve({ data: null, error: { message: 'gone' } })
      return Promise.resolve({ data: Array.from({ length: ASK }, (_, i) => ({ id: from + i })), error: null })
    })
    expect(error).toEqual({ message: 'gone' })
    expect(truncated).toBe(true)
    // What it did get is handed back, but never as if it were everything.
    expect(rows).toHaveLength(ASK)
  })

  it('AND THE HARD STOP SAYS SO TOO', async () => {
    const { rows, truncated } = await everyRow<any>(server(STOP_AT + ASK).page)
    expect(rows.length).toBeGreaterThan(STOP_AT - 1)
    expect(truncated).toBe(true)
  })
})

describe('WHAT A REAL DEAL IS HAS ONE HOME', () => {
  it('and the database is asked the same question in its own words', () => {
    expect(REAL_DEALS_OR).toBe('is_test.is.null,is_test.eq.false')
  })

  it('A DEAL WITH NO FLAG IS A REAL DEAL, BOTH WAYS OF ASKING', () => {
    // The filter says is_test IS NULL or is_test = false. isTestDeal says only
    // an explicit true is a test. The two have to agree or a deal is real on
    // one screen and absent from another.
    expect(isTestDeal({})).toBe(false)
    expect(isTestDeal({ is_test: null })).toBe(false)
    expect(isTestDeal({ is_test: false })).toBe(false)
    expect(isTestDeal({ is_test: true })).toBe(true)
    expect(realDealsOnly([{ is_test: true }, { is_test: null }, {}])).toHaveLength(2)
  })
})

describe('AND THE SCREENS THAT COUNT ASK FOR ALL OF IT', () => {
  const BOARD = readFileSync('app/(app)/deals/page.tsx', 'utf8')
  const DASH = readFileSync('app/(app)/dashboard/page.tsx', 'utf8')
  const SETTLE = readFileSync('app/(app)/settlements/page.tsx', 'utf8')
  const WORK = readFileSync('app/(app)/credit-team-workload/WorkloadClient.tsx', 'utf8')
  const RECONCILE = readFileSync('components/SettlementReconcile.tsx', 'utf8')
  const OFFICER = readFileSync('lib/allocate-officer.ts', 'utf8')

  it.each([
    ['the deals board', BOARD],
    ['the dashboard', DASH],
    ['the settlements list', SETTLE],
    ["the credit team's workload", WORK],
    ['the commission reconciliation', RECONCILE],
    ['who the next file goes to', OFFICER],
  ])('%s', (_what, src) => {
    expect(src).toContain('everyRow')
  })

  it('AND THE BOARD LEAVES THE TEST DEALS IN THE DATABASE', () => {
    // 924 of 1165. Fetching them to throw them away in the browser is what
    // spent the thousand rows on junk.
    expect(BOARD).toContain('tests ? q.eq(\'is_test\', true) : q.or(REAL_DEALS_OR)')
  })

  it('and counts them without fetching them', () => {
    expect(BOARD).toContain("count: 'exact', head: true")
  })

  it('AND PAGING WALKS A TOTAL ORDER', () => {
    // Two deals the database considers equal can swap between pages, which
    // skips one and repeats the other. id breaks every tie.
    expect(BOARD).toContain(".order('created_at', { ascending: false }).order('id')")
  })

  it('AND THE BOARD ADMITS IT WHEN THE BOOK IS SHORT', () => {
    expect(BOARD).toContain('This is not your whole book.')
  })
})
