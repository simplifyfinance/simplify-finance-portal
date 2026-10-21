import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  exposure, totalsFor, valueOf, loanOf, bandFor, sourceLine, shortDate,
  HOT, WARM, type Holding, type Named,
} from './lvr-exposure'

// LVR EXPOSURE, ON THE WHOLE BOOK.
//
// 21 Oct 2026. The report was reading clients.position_properties - 33
// properties across the whole portal. The portfolio review holds 760. Thirty
// rows looks like a report, which is why nobody noticed it was showing about
// four percent of the lending.

const hold = (over: Partial<Holding> = {}): Holding => ({
  review_id: 'r1', address: '45 Bellbird Avenue', investor: true,
  original_value: 420000, original_loan: 336000,
  current_balance: null, balance_as_at: null,
  estimated_current_value: null, valuation_date: null,
  ...over,
})

const names: Named[] = [{ review_id: 'r1', first_name: 'Thilina', last_name: 'Marchetti' }]

describe('which figure it uses, and what it says about it', () => {
  it('uses the book value and says it is from settlement', () => {
    const v = valueOf(hold())
    expect(v.amount).toBe(420000)
    expect(sourceLine(v.from)).toBe('book · at settlement')
  })

  // An estimate somebody looked up beats what it was worth the day the loan
  // started, which could be ten years ago.
  it('prefers an estimate, and dates it', () => {
    const v = valueOf(hold({ estimated_current_value: 520000, valuation_date: '2026-10-14' }))
    expect(v.amount).toBe(520000)
    expect(sourceLine(v.from)).toBe('estimate · Oct 26')
  })

  it('uses the book loan where no statement has been matched', () => {
    const l = loanOf(hold())
    expect(l.amount).toBe(336000)
    expect(sourceLine(l.from)).toBe('book · at settlement')
  })

  it('uses the lender balance where there is one, and dates it', () => {
    const l = loanOf(hold({ current_balance: 318450, balance_as_at: '2026-08-01' }))
    expect(l.amount).toBe(318450)
    expect(sourceLine(l.from)).toBe('lender · Aug 26')
  })

  // A BALANCE WITH NO DATE IS NOT THE LENDER'S. It came from the book import,
  // and calling it the lender's would be a claim the screen cannot back up.
  it('refuses to call an undated balance the lender figure', () => {
    const l = loanOf(hold({ current_balance: 318450, balance_as_at: null }))
    expect(sourceLine(l.from)).toBe('book · at settlement')
  })

  it('never invents a date it has not got', () => {
    expect(sourceLine({ kind: 'lender', on: '' })).toBe('lender')
    expect(sourceLine({ kind: 'estimate', on: 'rubbish' })).toBe('estimate')
    expect(shortDate(null)).toBe('')
  })
})

describe('the bands', () => {
  it('puts 80 and over in the hot one', () => {
    expect(bandFor(80)).toBe('hot')
    expect(bandFor(97.4)).toBe('hot')
    expect(bandFor(HOT)).toBe('hot')
  })
  it('puts 70 to under 80 in the middle', () => {
    expect(bandFor(70)).toBe('warm')
    expect(bandFor(WARM)).toBe('warm')
    expect(bandFor(79.9)).toBe('warm')
  })
  it('leaves the rest plain', () => {
    expect(bandFor(69.9)).toBe('cool')
    expect(bandFor(0.1)).toBe('cool')
  })
})

describe('the rows', () => {
  it('works the LVR out and names the client', () => {
    const [row] = exposure([hold()], names)
    expect(row.lvr).toBe(80)
    expect(row.band).toBe('hot')
    expect(row.client).toBe('Thilina Marchetti')
    expect(row.address).toBe('45 Bellbird Avenue')
  })

  it('says so rather than guessing where no name was recorded', () => {
    const [row] = exposure([hold()], [])
    expect(row.client).toBe('Name not recorded')
  })

  // ZERO IS A CLAIM. A property with no value cannot have an LVR, and showing
  // it at 0% would put it at the bottom looking safe.
  it('leaves out a property with no value or no loan', () => {
    expect(exposure([hold({ original_value: null })], names)).toHaveLength(0)
    expect(exposure([hold({ original_value: 0 })], names)).toHaveLength(0)
    expect(exposure([hold({ original_loan: null, current_balance: null })], names)).toHaveLength(0)
  })

  it('puts the worst first', () => {
    const rows = exposure([
      hold({ address: 'safe', original_value: 1000000, original_loan: 400000 }),
      hold({ address: 'tight', original_value: 500000, original_loan: 450000 }),
      hold({ address: 'middle', original_value: 800000, original_loan: 600000 }),
    ], names)
    expect(rows.map(r => r.address)).toEqual(['tight', 'middle', 'safe'])
  })

  // The home is still lending against a security, so it is on the report. The
  // toggle is on the screen, not in here.
  it('keeps the owner occupied property and marks it', () => {
    const rows = exposure([hold({ investor: false })], names)
    expect(rows).toHaveLength(1)
    expect(rows[0].investor).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// A SETTLEMENT LVR IS NOT EXPOSURE
// ---------------------------------------------------------------------------
//
// 21 Oct 2026, within an hour of shipping the report. The tiles said "359 at
// 80% or over" in red across the top of the screen. 308 of those were
// settlement-day figures - a purchase with a 10% deposit IS 90% on the day it
// settles - and 39 were construction, where the value is the land and the loan
// is land plus the build, so they read over 100%.
//
// None of it was risk, and all of it was in red.

describe('the counts above the table', () => {
  const mixed = () => exposure([
    hold({ original_value: 500000, original_loan: 450000 }),                 // 90% at settlement
    hold({ original_value: 1000000, original_loan: 750000 }),                // 75% at settlement
    hold({ original_value: 1000000, original_loan: 850000,
           current_balance: 850000, balance_as_at: '2026-08-01' }),          // 85% today
    hold({ original_value: 1000000, original_loan: 400000,
           current_balance: 400000, balance_as_at: '2026-08-01' }),          // 40% today
  ], names)

  it('counts only today’s figures as exposure', () => {
    const t = totalsFor(mixed())
    expect(t.current).toBe(2)
    expect(t.over80).toBe(1)      // the 85%, not the 90% from settlement day
    expect(t.between).toBe(0)     // the 75% is history and is not counted
    expect(t.stillOnBook).toBe(2)
  })

  // The sum is a sum. It is not a claim that anybody is over-exposed.
  it('still totals the lending across every row', () => {
    expect(totalsFor(mixed()).lending).toBe(450000 + 750000 + 850000 + 400000)
  })

  it('claims nothing at all where no balance has been refreshed', () => {
    const t = totalsFor(exposure([
      hold({ original_value: 500000, original_loan: 450000 }),
      hold({ original_value: 400000, original_loan: 700000 }),  // a construction lot
    ], names))
    expect(t.current).toBe(0)
    expect(t.over80).toBe(0)
    expect(t.between).toBe(0)
    expect(t.stillOnBook).toBe(2)
  })
})

describe('a row knows whether anybody can act on it', () => {
  it('marks a dated balance as current and an undated one as history', () => {
    const [live] = exposure([hold({ current_balance: 300000, balance_as_at: '2026-08-01' })], names)
    expect(live.current).toBe(true)
    const [old] = exposure([hold()], names)
    expect(old.current).toBe(false)
  })

  // A settlement LVR from 2016 above a real one puts the thing nobody can act
  // on at the top of the screen.
  it('sorts today’s figures above history, worst first inside each', () => {
    const rows = exposure([
      hold({ address: 'old-bad', original_value: 300000, original_loan: 900000 }),
      hold({ address: 'live-mild', original_value: 1000000, original_loan: 500000,
             current_balance: 500000, balance_as_at: '2026-08-01' }),
      hold({ address: 'live-bad', original_value: 1000000, original_loan: 880000,
             current_balance: 880000, balance_as_at: '2026-08-01' }),
      hold({ address: 'old-mild', original_value: 1000000, original_loan: 400000 }),
    ], names)
    expect(rows.map(r => r.address)).toEqual(['live-bad', 'live-mild', 'old-bad', 'old-mild'])
  })
})

// ---------------------------------------------------------------------------
// WHAT THE SCREEN PROMISED
// ---------------------------------------------------------------------------

describe('the report keeps the promises the mock made', () => {
  const page = readFileSync('app/(app)/reports/page.tsx', 'utf8')

  it('reads the portfolio review, not the 33 client positions', () => {
    expect(page).toContain('portfolio_review_properties')
  })

  // Rate exposure still needs the client position - it is the only place a
  // client's interest rate is recorded anywhere in this portal.
  it('leaves rate exposure on the client position', () => {
    expect(page).toContain('position_properties')
    expect(page).toContain('interestRate')
  })

  it('says where every figure came from', () => {
    expect(page).toContain('sourceLine')
  })

  it('uses no amber', () => {
    expect(page).not.toMatch(/\b(bg|text|border)-amber-/)
    expect(page).not.toMatch(/#(F59E0B|FBBF24|D97706|FEF3C7|FDE68A)/i)
  })

  it('says out loud when nothing on screen is current', () => {
    expect(page).toContain('No LVR here is current yet')
  })

  // Colour is a claim. A settlement LVR printed in red tells somebody to act
  // on a figure from 2016.
  it('only colours an LVR that is today’s figure', () => {
    expect(page).toContain('!r.current')
    expect(page).toContain('at settlement')
  })

  it('lets you look at the history on purpose rather than by accident', () => {
    expect(page).toContain('setBasis')
  })
})
