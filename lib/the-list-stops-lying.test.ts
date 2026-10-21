import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  normaliseRef, monthOf, newestByRef, planFor, writeFor, monthName, asAtShort,
  type Holding, type TrailLine,
} from './refresh-balances'

// THE LIST STOPS LYING ABOUT WHAT PEOPLE OWE.
//
// 21 Oct 2026. Every figure on the portfolio review was the spreadsheet's
// original loan - 760 of 760. A loan paid down for six years reads as if not a
// dollar has come off it, the equity reads low, and a client worth ringing
// looks like one who is not.

const prop = (over: Partial<Holding> = {}): Holding => ({
  id: 'p1', review_id: 'r1', loan_ref: 'ABC-123',
  original_loan: 600000, current_balance: null, balance_as_at: null,
  investor: true, ...over,
})

const line = (over: Partial<TrailLine> = {}): TrailLine => ({
  loan_ref: 'ABC123', balance: 548310, period_month: '2026-08-01',
  lender_raw: 'St George', ...over,
})

describe('a loan reference is the same reference in any punctuation', () => {
  it('ignores spaces, hyphens and case', () => {
    expect(normaliseRef('abc-123')).toBe('ABC123')
    expect(normaliseRef(' ABC 123 ')).toBe('ABC123')
    expect(normaliseRef('ABC/123')).toBe('ABC123')
    expect(normaliseRef(null)).toBe('')
    expect(normaliseRef('')).toBe('')
  })

  // A reference written two ways on the two sides is the whole reason this
  // function exists. 423 properties carry one and they came from a different
  // system to the statements.
  it('meets a line written the other way', () => {
    const p = planFor([prop({ loan_ref: 'abc 123' })], [line({ loan_ref: 'ABC-123' })])
    expect(p.fill).toHaveLength(1)
    expect(p.fill[0].now).toBe(548310)
  })
})

describe('only the newest month counts', () => {
  it('takes the latest statement for a loan and ignores the rest', () => {
    const got = newestByRef([
      line({ period_month: '2026-06-01', balance: 560000 }),
      line({ period_month: '2026-08-01', balance: 548310 }),
      line({ period_month: '2026-07-01', balance: 554000 }),
    ])
    expect(got.get('ABC123')?.balance).toBe(548310)
    expect(got.get('ABC123')?.month).toBe('2026-08')
  })

  it('reads a timestamp and a plain date the same way', () => {
    expect(monthOf('2026-08-01')).toBe('2026-08')
    expect(monthOf('2026-08-01T00:00:00+00:00')).toBe('2026-08')
    expect(monthOf(null)).toBe('')
    expect(monthOf('not a date')).toBe('')
  })

  // A PAID OUT LOAN IS NOT A BALANCE OF ZERO.
  //
  // The statement keeps carrying the loan for a month or two after it is gone,
  // with nothing on it. Writing that over a real figure would tell a client
  // they owe nothing and have the whole property in equity.
  it('refuses a zero or missing balance', () => {
    expect(newestByRef([line({ balance: 0 })]).size).toBe(0)
    expect(newestByRef([line({ balance: null })]).size).toBe(0)
    expect(newestByRef([line({ balance: -5 })]).size).toBe(0)
    const p = planFor([prop()], [line({ balance: 0 })])
    expect(p.fill).toHaveLength(0)
    expect(p.noMatch).toBe(1)
  })
})

describe('what the plan says would happen', () => {
  it('fills a stale figure in and says which way it moved', () => {
    const p = planFor([prop()], [line()])
    expect(p.fill).toHaveLength(1)
    expect(p.fill[0]).toMatchObject({ was: 600000, now: 548310, asAt: '2026-08', way: 'down' })
    expect(p.newest).toBe('2026-08')
    expect(p.reviews).toBe(1)
  })

  // A LOAN THAT GREW IS NOT AN ERROR. It has been topped up or redrawn since
  // the spreadsheet, and the lender's figure is the right one either way.
  it('calls a loan that grew up, and does not refuse it', () => {
    const p = planFor([prop({ original_loan: 385000 })], [line({ balance: 402118 })])
    expect(p.fill[0].way).toBe('up')
    expect(p.fill[0].now).toBe(402118)
  })

  it('calls a few hundred dollars flat', () => {
    const p = planFor([prop({ original_loan: 780000 })], [line({ balance: 779004 })])
    expect(p.fill[0].way).toBe('flat')
  })

  it('counts a reference that meets nothing, and never guesses one', () => {
    const p = planFor([prop({ loan_ref: 'NOTHING' })], [line()])
    expect(p.fill).toHaveLength(0)
    expect(p.noMatch).toBe(1)
  })

  it('counts a property that came through with no reference', () => {
    for (const empty of [null, '', '   ']) {
      const p = planFor([prop({ loan_ref: empty as any })], [line()])
      expect(p.noRef, `${JSON.stringify(empty)} should count as no reference`).toBe(1)
      expect(p.fill).toHaveLength(0)
    }
  })

  // The home is shown on the review and counted nowhere, which is the rule the
  // schema sets and the list already follows.
  it('leaves the owner occupied property alone', () => {
    const p = planFor([prop({ investor: false })], [line()])
    expect(p.fill).toHaveLength(0)
    expect(p.noRef + p.noMatch + p.alreadyCurrent).toBe(0)
  })

  it('puts the biggest movement first, so the odd one is on screen', () => {
    const p = planFor([
      prop({ id: 'small', original_loan: 780000 }),
      prop({ id: 'big', loan_ref: 'XYZ', original_loan: 520000 }),
    ], [
      line({ balance: 779004 }),
      line({ loan_ref: 'XYZ', balance: 441775 }),
    ])
    expect(p.fill.map(f => f.id)).toEqual(['big', 'small'])
  })
})

describe('pressing it twice', () => {
  it('leaves a property already carrying this month or later', () => {
    const p = planFor([prop({ current_balance: 548310, balance_as_at: '2026-08-01' })], [line()])
    expect(p.fill).toHaveLength(0)
    expect(p.alreadyCurrent).toBe(1)
  })

  it('still refreshes one carrying an older month', () => {
    const p = planFor([prop({ current_balance: 560000, balance_as_at: '2026-06-01' })], [line()])
    expect(p.fill).toHaveLength(1)
    expect(p.fill[0].was).toBe(560000)
  })

  // The month on the row wins over the figure. A balance that happens to match
  // but was never dated is still worth dating.
  it('dates a figure that matches but has no month on it', () => {
    const p = planFor([prop({ current_balance: 548310, balance_as_at: null })], [line()])
    expect(p.fill).toHaveLength(1)
    expect(p.fill[0].asAt).toBe('2026-08')
  })
})

describe('what is written', () => {
  // THE SPREADSHEET'S FIGURE IS HISTORY AND IS NEVER TOUCHED. The schema says
  // so in its own comment, and the list falls back to it wherever no statement
  // has ever been matched.
  it('never writes original_loan', () => {
    const row = writeFor(planFor([prop()], [line()]).fill[0]) as any
    expect(row.original_loan).toBeUndefined()
    expect(Object.keys(row).sort()).toEqual(['balance_as_at', 'current_balance', 'id', 'lender_raw'])
  })

  it('writes the statement month as a date the database takes', () => {
    const row = writeFor(planFor([prop()], [line()]).fill[0])
    expect(row.balance_as_at).toBe('2026-08-01')
    expect(row.current_balance).toBe(548310)
  })

  // A blank from the statement would wipe a lender somebody typed in by hand.
  it('leaves the lender alone where the statement does not name one', () => {
    const row = writeFor(planFor([prop()], [line({ lender_raw: '' })]).fill[0]) as any
    expect('lender_raw' in row).toBe(false)
  })
})

describe('how a month reads', () => {
  it('spells it out in a sentence and shortens it on a row', () => {
    expect(monthName('2026-08')).toBe('August 2026')
    expect(asAtShort('2026-08-01')).toBe('Aug 26')
    expect(monthName('nonsense')).toBe('')
    expect(asAtShort(null)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// WHAT THE SCREEN PROMISED
// ---------------------------------------------------------------------------

describe('the screen keeps the promises the mock made', () => {
  const page = readFileSync('components/PortfolioReview.tsx', 'utf8')

  it('says out loud that nothing is written until it is agreed to', () => {
    expect(page).toContain('Nothing is written')
  })

  it('says where the figure came from', () => {
    expect(page.toLowerCase()).toContain('trail')
  })

  // There is no amber anywhere in this portal and there is none here. The
  // word itself appears in a comment saying so, which is why this looks for a
  // colour being used rather than for the word.
  it('uses no amber', () => {
    expect(page).not.toMatch(/\b(bg|text|border)-amber-/)
    expect(page).not.toMatch(/#(F59E0B|FBBF24|D97706|FEF3C7|FDE68A)/i)
  })

  it('checks the write rather than firing it and hoping', () => {
    // RLS refuses a write by returning no rows and NO error, which is the most
    // repeated failure in this codebase.
    const near = page.slice(page.indexOf('async function refresh'))
    expect(near).toContain('error')
  })
})
