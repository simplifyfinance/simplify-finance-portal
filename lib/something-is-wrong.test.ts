// The correction loop. Alan's item 5, clarified 9 Nov 2026.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  WHERE_OPTIONS, SCOPE_LABEL, SCOPE_COST, FORGOTTEN_DAYS,
  statusOf, isOpen, waitingOnAFix, readyToCheck, openOn, forgotten,
  headline, raisedLine, cardLine, noteWhenRaised, noteWhenChecked,
  raisedSubject, raisedBody, closedSubject, closedBody,
  type Flag,
} from './something-is-wrong'

const NOW = new Date('2026-11-09T00:00:00Z')

const RAISED: Flag = {
  id: 'f1', deal_id: 'd1', where_at: 'Lending options', scope: 'library',
  description: 'ANZ Simplicity Plus settlement fee is showing $350. The loan docs say $395.',
  raised_by_name: 'Katie Nguyen', raised_at: '2026-11-03T04:00:00Z',
}
const FIXED: Flag = { ...RAISED, id: 'f2', fixed_at: '2026-11-05T04:00:00Z', fixed_by_name: 'Mel Harris' }
const CLOSED: Flag = { ...FIXED, id: 'f3', checked_at: '2026-11-06T04:00:00Z', checked_by_name: 'Catherine Ellis' }

describe('the three states', () => {
  it('reads them off the dates', () => {
    expect(statusOf(RAISED)).toBe('waiting_on_a_fix')
    expect(statusOf(FIXED)).toBe('ready_to_check')
    expect(statusOf(CLOSED)).toBe('closed')
  })

  // Somebody saying they fixed it is not the end. That gap is the whole ask.
  it('does not treat fixed as finished', () => {
    expect(isOpen(FIXED)).toBe(true)
    expect(isOpen(CLOSED)).toBe(false)
  })

  it('splits the list into the two piles it is worked from', () => {
    const all = [RAISED, FIXED, CLOSED]
    expect(waitingOnAFix(all).map(f => f.id)).toEqual(['f1'])
    expect(readyToCheck(all).map(f => f.id)).toEqual(['f2'])
  })

  it('survives a flag with nothing on it', () => {
    expect(statusOf(null)).toBe('waiting_on_a_fix')
    expect(waitingOnAFix(null as any)).toEqual([])
  })
})

describe('the card on the deal', () => {
  it('shows only the open ones for that deal', () => {
    const other: Flag = { ...RAISED, id: 'f9', deal_id: 'd2' }
    const list = [RAISED, FIXED, CLOSED, other]
    expect(openOn(list, 'd1').map(f => f.id)).toEqual(['f1', 'f2'])
    expect(openOn(list, 'd2').map(f => f.id)).toEqual(['f9'])
  })

  // A library flag has no deal, and that is the point rather than a gap.
  it('leaves library flags off a deal card', () => {
    const lib: Flag = { ...RAISED, id: 'f8', deal_id: null, where_at: 'Lender library' }
    expect(openOn([lib], 'd1')).toEqual([])
  })

  it('says where it is up to, in one line', () => {
    expect(cardLine(RAISED)).toBe('Flagged by Katie Nguyen on 3 Nov. Waiting on a fix.')
    expect(cardLine(FIXED)).toBe('Flagged by Katie Nguyen on 3 Nov. Fixed 5 Nov, waiting to be checked.')
  })
})

describe('forgotten, not wrong', () => {
  // The only case where it turns red. Work in hand is not a fault.
  it('is not forgotten while somebody is still touching it', () => {
    expect(forgotten(RAISED, new Date('2026-11-10T00:00:00Z'))).toBe(false)
    expect(forgotten(FIXED, new Date('2026-11-16T00:00:00Z'))).toBe(false)
  })

  it('is forgotten after a fortnight with nothing happening', () => {
    expect(forgotten(RAISED, new Date('2026-11-17T05:00:00Z'))).toBe(true)
    expect(FORGOTTEN_DAYS).toBe(14)
  })

  it('counts from the last thing that happened, not from when it was raised', () => {
    // Raised 3 Nov, fixed 5 Nov. On the 18th the fix is 13 days old.
    expect(forgotten(FIXED, new Date('2026-11-18T03:00:00Z'))).toBe(false)
    expect(forgotten(FIXED, new Date('2026-11-19T05:00:00Z'))).toBe(true)
  })

  it('is never forgotten once it is closed', () => {
    expect(forgotten(CLOSED, new Date('2027-01-01T00:00:00Z'))).toBe(false)
  })
})

describe('what it says', () => {
  it('takes the first line for a list', () => {
    expect(headline(RAISED)).toBe('ANZ Simplicity Plus settlement fee is showing $350')
  })

  it('cuts a long one rather than wrapping a table', () => {
    const long: Flag = { ...RAISED, description: 'x'.repeat(200) }
    expect(headline(long).length).toBeLessThanOrEqual(70)
    expect(headline(long).endsWith('…')).toBe(true)
  })

  it('names who and when and where', () => {
    expect(raisedLine(RAISED)).toBe('Katie Nguyen · 3 Nov · Lending options')
  })

  it('says what a library problem is costing', () => {
    expect(SCOPE_COST.library).toBe('Wrong on every quote until it is fixed.')
    expect(SCOPE_COST.deal).toBe('Wrong on this deal only.')
    expect(SCOPE_LABEL.library).toContain('wrong for everyone')
  })

  it('offers the screens that exist', () => {
    expect(WHERE_OPTIONS).toContain('Lending options')
    expect(WHERE_OPTIONS).toContain('Lender library')
  })

  it('writes a file note at both ends', () => {
    expect(noteWhenRaised(RAISED)).toContain('Something wrong flagged on Lending options')
    expect(noteWhenRaised(RAISED)).toContain('Flagged as a library problem')
    expect(noteWhenChecked(CLOSED)).toContain('fixed and checked by Catherine Ellis')
  })
})

describe('the two emails', () => {
  it('tells management what was flagged and where', () => {
    expect(raisedSubject(RAISED, 'Chen & Cardey'))
      .toBe("Something's wrong: Lending options — Chen & Cardey")
    const body = raisedBody(RAISED, 'Chen & Cardey', 'https://x/deals/d1')
    expect(body).toContain('Katie Nguyen has flagged something')
    expect(body).toContain('Wrong on every quote until it is fixed.')
    expect(body).toContain('https://x/deals/d1')
  })

  it('says so when there is no deal behind it', () => {
    const lib: Flag = { ...RAISED, deal_id: null, where_at: 'Lender library' }
    expect(raisedBody(lib)).toContain('No deal — raised in the library.')
    expect(raisedSubject(lib)).toBe("Something's wrong: Lender library")
  })

  // The one that does not happen today: the person who spotted it hears back.
  it('closes the loop with whoever raised it', () => {
    expect(closedSubject(CLOSED)).toContain('Fixed:')
    const body = closedBody(CLOSED, 'Chen & Cardey')
    expect(body).toContain('Hi Katie,')
    expect(body).toContain('has been fixed and checked')
    expect(body).toContain('You said: ANZ Simplicity Plus settlement fee')
  })

  // A quote already sent still has the old figure on it.
  it('says what the fix does not cover', () => {
    expect(closedBody(CLOSED)).toContain('Anything already sent is unchanged')
    const onDeal: Flag = { ...CLOSED, scope: 'deal' }
    expect(closedBody(onDeal)).toContain('Anything already sent on this deal is unchanged')
  })
})

describe('nothing counts anything', () => {
  // Fabio: "I don't see the point of counting errors." Alan: "that's not what
  // this is." A total in here would be the first step back to a scoreboard.
  it('exports no totals', () => {
    const src = readFileSync('lib/something-is-wrong.ts', 'utf8')
    const names = [...src.matchAll(/^export (?:function|const) (\w+)/gm)].map(m => m[1])
    expect(names.length).toBeGreaterThan(5)
    expect(names.filter(n => /count|total|score|tally|stats/i.test(n))).toEqual([])
  })
})
