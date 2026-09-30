import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  NO_FILTERS, passesFilters, applyFilters, anyFilter, countFilters, toggleValue,
  optionsFor, nudgeCount, filterChips, showingLine, readFilters, needsAttention,
  columnCountLabel,
  type BoardFilters,
} from './board-filters'

// A FILTER IS A WAY TO HIDE DEALS.
//
// This board was built because nine deals once sat hidden in a state the portal
// called finished and refused to show. Adding filters to it is deliberately
// giving people a way to do that again - so every test here is about the board
// never being quiet about what it is not showing.

const deal = (o: Partial<{ broker: string; officer: string; lender: string; urgent: boolean; since: string }>) => ({
  id: Math.random().toString(36).slice(2),
  assigned_broker: o.broker ?? 'kylie',
  credit_officers: o.officer ? { name: o.officer } : null,
  lenders: o.lender ? { name: o.lender } : null,
  is_urgent: !!o.urgent,
  urgent_until: o.urgent ? '2099-01-01' : null,
  stage: 'BC',
  bc_started_at: o.since ?? '2026-09-29T00:00:00Z',
})

const BOOK = [
  deal({ broker: 'kylie', officer: 'Ellie', lender: 'ANZ' }),
  deal({ broker: 'kylie', officer: 'Katie Amos', lender: 'Bankwest' }),
  deal({ broker: 'fabio', officer: 'Ellie', lender: 'ANZ' }),
  deal({ broker: 'fabio', officer: 'Win', lender: 'ubank' }),
  deal({ broker: 'mark', officer: 'Ellie', lender: 'Bankwest', urgent: true }),
]

const f = (o: Partial<BoardFilters>): BoardFilters => ({ ...NO_FILTERS, ...o })

describe('nothing on means nothing hidden', () => {
  it('lets every deal through', () => {
    expect(applyFilters(BOOK, NO_FILTERS).length).toBe(BOOK.length)
    expect(anyFilter(NO_FILTERS)).toBe(false)
    expect(countFilters(NO_FILTERS)).toBe(0)
  })

  it('hands back the same list rather than a copy, so nothing can drift', () => {
    expect(applyFilters(BOOK, NO_FILTERS)).toBe(BOOK)
  })

  it('survives rubbish', () => {
    expect(applyFilters(null as any, NO_FILTERS)).toEqual([])
    expect(applyFilters(BOOK, f({ broker: [] })).length).toBe(5)
  })
})

describe('within one filter, any of them', () => {
  it('two brokers means both books, not the deals they share', () => {
    const out = applyFilters(BOOK, f({ broker: ['kylie', 'fabio'] }))
    expect(out.length).toBe(4)
  })
})

describe('between filters, all of them', () => {
  it('broker and lender both have to be true', () => {
    expect(applyFilters(BOOK, f({ broker: ['kylie'], lender: ['ANZ'] })).length).toBe(1)
  })

  it('and a combination nothing matches gives nothing, not everything', () => {
    // The dangerous failure: a filter that quietly stops applying.
    expect(applyFilters(BOOK, f({ broker: ['kylie'], lender: ['ubank'] })).length).toBe(0)
  })

  it('three at once', () => {
    expect(applyFilters(BOOK, f({ broker: ['fabio'], officer: ['Ellie'], lender: ['ANZ'] })).length).toBe(1)
  })
})

describe('needs attention', () => {
  it('catches one flagged urgent by hand', () => {
    expect(needsAttention(BOOK[4])).toBe(true)
    expect(applyFilters(BOOK, f({ nudge: true })).length).toBe(1)
  })

  it('combines with the rest like everything else', () => {
    expect(applyFilters(BOOK, f({ nudge: true, broker: ['kylie'] })).length).toBe(0)
  })
})

describe('what the menu offers', () => {
  it('lists every value the book actually holds, alphabetically', () => {
    expect(optionsFor(BOOK, 'lender', NO_FILTERS).map(o => o.value))
      .toEqual(['ANZ', 'Bankwest', 'ubank'])
  })

  // The count beside each option is what it WOULD leave with everything else
  // still on - so once a broker is picked, the lender list describes that
  // broker's book rather than the whole book.
  it('counts each option against the other filters, not against everything', () => {
    const opts = optionsFor(BOOK, 'lender', f({ broker: ['kylie'] }))
    expect(opts.find(o => o.value === 'ANZ')!.count).toBe(1)
    expect(opts.find(o => o.value === 'Bankwest')!.count).toBe(1)
    expect(opts.find(o => o.value === 'ubank')!.count).toBe(0)
  })

  // AN OPTION THAT WOULD EMPTY THE BOARD IS OFFERED WITH ITS ZERO. Left out of
  // the list it reads as "no deals with this lender anywhere", which is a lie.
  it('offers a zero rather than hiding the option', () => {
    expect(optionsFor(BOOK, 'lender', f({ broker: ['kylie'] })).map(o => o.value))
      .toContain('ubank')
  })

  // THE ONE THAT WOULD TRAP SOMEBODY. A broker who has left, or a lender
  // renamed, still has to appear while it is picked - or the filter hiding
  // every deal cannot be turned off.
  it('keeps a picked value on the list even when nothing matches it', () => {
    const opts = optionsFor(BOOK, 'broker', f({ broker: ['somebody-who-left'] }))
    const stale = opts.find(o => o.value === 'somebody-who-left')
    expect(stale, 'a stale filter must stay visible or it can never be cleared').toBeTruthy()
    expect(stale!.picked).toBe(true)
    expect(stale!.count).toBe(0)
  })

  it('counts what needs attention the same way', () => {
    expect(nudgeCount(BOOK, NO_FILTERS)).toBe(1)
    expect(nudgeCount(BOOK, f({ broker: ['kylie'] }))).toBe(0)
  })
})

describe('the board never goes quiet about it', () => {
  it('always says both numbers', () => {
    expect(showingLine(14, 41)).toBe('Showing 14 of 41 deals')
    expect(showingLine(1, 1)).toBe('Showing 1 of 1 deal')
  })

  it('names everything that is on, one chip each', () => {
    const chips = filterChips(f({ broker: ['kylie', 'fabio'], lender: ['ANZ'], nudge: true }))
    expect(chips.length).toBe(4)
    expect(chips[0].label).toBe('Needs attention')
    expect(chips.map(c => c.value)).toContain('ANZ')
  })

  it('uses the broker’s name rather than their key', () => {
    const chips = filterChips(f({ broker: ['kylie'] }),
      (which, v) => which === 'broker' && v === 'kylie' ? 'Kylie Searle' : '')
    expect(chips[0].label).toBe('Kylie Searle')
  })

  it('has nothing to say when nothing is on', () => {
    expect(filterChips(NO_FILTERS)).toEqual([])
  })
})

describe('turning one on and off', () => {
  it('adds, removes, and ignores an empty value', () => {
    let s = toggleValue(NO_FILTERS, 'broker', 'kylie')
    expect(s.broker).toEqual(['kylie'])
    s = toggleValue(s, 'broker', 'fabio')
    expect(s.broker).toEqual(['kylie', 'fabio'])
    s = toggleValue(s, 'broker', 'kylie')
    expect(s.broker).toEqual(['fabio'])
    expect(toggleValue(s, 'broker', '   ')).toBe(s)
  })

  it('never touches the other filters', () => {
    const s = toggleValue(f({ lender: ['ANZ'], nudge: true }), 'broker', 'kylie')
    expect(s.lender).toEqual(['ANZ'])
    expect(s.nudge).toBe(true)
  })
})

describe('what comes back from a profile is checked, not trusted', () => {
  // A FILTER IS REMEMBERED, SO IT CAN COME BACK WRONG. Anything could be sitting
  // in that column - an older shape, a half-written value - and a board that
  // trusted it would open empty on a Monday with no explanation.
  it('reads a good one back', () => {
    expect(readFilters({ broker: ['kylie'], officer: [], lender: ['ANZ'], nudge: true }))
      .toEqual({ broker: ['kylie'], officer: [], lender: ['ANZ'], nudge: true })
  })

  it('falls back to showing everything, never to hiding things', () => {
    for (const rubbish of [null, undefined, 'yes', 42, [], { broker: 'kylie' }]) {
      expect(readFilters(rubbish)).toEqual(NO_FILTERS)
    }
  })

  it('drops blanks and duplicates', () => {
    expect(readFilters({ broker: ['kylie', 'kylie', '', '  '] }).broker).toEqual(['kylie'])
  })

  it('only a real true turns needs-attention on', () => {
    expect(readFilters({ nudge: 'true' }).nudge).toBe(false)
    expect(readFilters({ nudge: 1 }).nudge).toBe(false)
    expect(readFilters({ nudge: true }).nudge).toBe(true)
  })
})

describe('the screens say it out loud', () => {
  const bar = readFileSync('components/BoardFilters.tsx', 'utf8')
  const board = readFileSync('components/DealBoard.tsx', 'utf8')
  const page = readFileSync('app/(app)/deals/page.tsx', 'utf8')

  it('the bar prints both numbers, from the one function', () => {
    expect(bar).toContain('showingLine(')
  })

  it('there is a way to clear everything in one press', () => {
    expect(bar).toContain('Clear all')
    expect(bar).toContain('onClear')
  })

  // A count that reads "3" on a filtered column is how a filtered board gets
  // mistaken for the book.
  it('a column shows both numbers while a filter is on', () => {
    expect(columnCountLabel(3, 6)).toBe('3/6')
    expect(columnCountLabel(0, 6)).toBe('0/6')
  })

  it('and one number when nothing is filtered, exactly as before', () => {
    expect(columnCountLabel(6, null)).toBe('6')
  })

  it('the board asks for that wording rather than writing its own', () => {
    expect(board).toContain('columnCountLabel(')
    expect(board).toContain('totalByColumn')
  })

  it('and the folded strip uses the same answer, so folding hides nothing either', () => {
    const folded = board.slice(board.indexOf('writingMode'))
    expect(board.split('countLabel(').length - 1,
      'both the open column and the folded strip must count the same way').toBeGreaterThanOrEqual(2)
    expect(folded.length).toBeGreaterThan(0)
  })

  it('the board is handed both lists, or it cannot say both numbers', () => {
    expect(page).toContain('allDeals={boardDeals}')
    expect(page).toContain('deals={boardShown}')
  })

  it('the filters are applied with the same function the tests use', () => {
    expect(page).toContain('applyFilters(')
  })
})
