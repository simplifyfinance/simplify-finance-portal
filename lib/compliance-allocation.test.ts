import { describe, it, expect } from 'vitest'
import { allocate, todaySoFar, countToday, capOf, DEFAULT_DAILY_CAP } from './compliance-allocation'

// WHO GETS THE NEXT COMPLIANCE PACK.
//
// 28 Oct 2026. Fabio: "it goes to the first person until we hit the number of
// that particular day of five. Once we hit five, anything after that goes to
// person number two."
//
// Getting this wrong is quiet. Nobody sees an error - one person just carries
// everybody's work, or the overflow person gets nothing for a week and nobody
// notices until somebody looks at the workload tab.
//
// Invented names. 28 Oct 2026 is a Wednesday; 31 Oct 2026 is a Saturday.

const ELLESSE = { id: 'u1', name: 'Ellesse Mowbray' }
const ELLIE = { id: 'u2', name: 'Ellie Nakamura' }
const WED = '2026-10-28'
const SAT = '2026-10-31'
const CHRISTMAS = '2026-12-25'

/** n packs already sent to this person on this day. */
const sent = (person: { id: string }, n: number, day = WED) =>
  Array.from({ length: n }, (_, i) => ({ userId: person.id, at: `${day}T0${i}:00:00Z` }))

const go = (over: any = {}) => allocate({
  first: ELLESSE, second: ELLIE, today: WED, sent: [], ...over,
})

describe('the first five of a working day', () => {
  it('an empty day goes to the first person', () => {
    const a = go()
    expect(a.to).toEqual(ELLESSE)
    expect(a.why).toBe('first')
    expect(a.words).toContain('1 of 5')
  })

  it('and so do the next four', () => {
    for (let already = 1; already < 5; already++) {
      const a = go({ sent: sent(ELLESSE, already) })
      expect(a.to, `pack ${already + 1}`).toEqual(ELLESSE)
      expect(a.words).toContain(`${already + 1} of 5`)
    }
  })

  it('THE FIFTH SAYS IT IS THE LAST ONE', () => {
    // So nobody is surprised when the sixth lands somewhere else.
    const a = go({ sent: sent(ELLESSE, 4) })
    expect(a.to).toEqual(ELLESSE)
    expect(a.words).toContain('the rest of today goes to Ellie Nakamura')
  })
})

describe('AND THE SIXTH GOES TO THE SECOND PERSON', () => {
  it('once the first person is full', () => {
    const a = go({ sent: sent(ELLESSE, 5) })
    expect(a.to).toEqual(ELLIE)
    expect(a.why).toBe('second')
    expect(a.words).toContain('full for today at 5')
  })

  it('and so does everything after it, with no limit of its own', () => {
    // Fabio: "anything after that goes to person number two."
    const busy = [...sent(ELLESSE, 5), ...sent(ELLIE, 40)]
    expect(go({ sent: busy }).to).toEqual(ELLIE)
  })
})

describe('THE COUNT IS TODAY AND ONLY TODAY', () => {
  it('yesterday does not fill up today', () => {
    // The thing a running total would get wrong. There is no total - it is
    // counted from the packs that carry today's date.
    const a = go({ sent: sent(ELLESSE, 20, '2026-10-27') })
    expect(a.to).toEqual(ELLESSE)
    expect(a.usedToday).toBe(0)
  })

  it('and tomorrow does not either', () => {
    expect(go({ sent: sent(ELLESSE, 20, '2026-10-29') }).to).toEqual(ELLESSE)
  })

  it('counting only sees the right person on the right day', () => {
    const mixed = [...sent(ELLESSE, 3), ...sent(ELLIE, 9), ...sent(ELLESSE, 7, '2026-10-27')]
    expect(countToday(mixed, ELLESSE.id, WED)).toBe(3)
    expect(countToday(mixed, ELLIE.id, WED)).toBe(9)
  })

  it('and a pack with no date or no person counts for nothing', () => {
    const junk = [{ userId: ELLESSE.id, at: '' }, { userId: '', at: `${WED}T01:00:00Z` }, {}]
    expect(countToday(junk as any, ELLESSE.id, WED)).toBe(0)
  })
})

describe('A DEAL KEEPS WHOEVER IT WAS FIRST GIVEN TO', () => {
  // Fabio: "stays with the first person". A deal that bounced back and went
  // again must not move desk, and must not eat a second slot out of the day.
  it('pushing it again does not move it', () => {
    const a = go({ alreadyOn: ELLIE, sent: [] })
    expect(a.to).toEqual(ELLIE)
    expect(a.why).toBe('kept')
  })

  it('even when the first person has room', () => {
    expect(go({ alreadyOn: ELLIE, sent: sent(ELLESSE, 0) }).to).toEqual(ELLIE)
  })

  it('and even when it was with the first person and they are now full', () => {
    expect(go({ alreadyOn: ELLESSE, sent: sent(ELLESSE, 5) }).to).toEqual(ELLESSE)
  })
})

describe('WORKING DAYS ONLY', () => {
  it('a Saturday has no quota, so it goes to the first person', () => {
    const a = go({ today: SAT, sent: sent(ELLESSE, 50, SAT) })
    expect(a.to).toEqual(ELLESSE)
    expect(a.workday).toBe(false)
    expect(a.words).toContain('not a working day')
  })

  it('and so does Christmas Day', () => {
    // NSW public holidays come from lib/the-week.ts, which Today and the credit
    // team already read. One list, so the portal cannot hold two opinions.
    const a = go({ today: CHRISTMAS, sent: sent(ELLESSE, 50, CHRISTMAS) })
    expect(a.workday).toBe(false)
    expect(a.to).toEqual(ELLESSE)
  })

  it('but a normal Wednesday does have one', () => {
    expect(go().workday).toBe(true)
  })
})

describe('the number can be changed', () => {
  it('a cap of two means the third goes to the second person', () => {
    expect(go({ cap: 2, sent: sent(ELLESSE, 1) }).to).toEqual(ELLESSE)
    expect(go({ cap: 2, sent: sent(ELLESSE, 2) }).to).toEqual(ELLIE)
  })

  it('and nonsense falls back to five rather than breaking the day', () => {
    // A nought would send every pack to the second person for ever. That is a
    // configuration mistake, not an instruction.
    for (const bad of [0, -3, null, undefined, '', 'five', NaN]) {
      expect(capOf(bad), String(bad)).toBe(DEFAULT_DAILY_CAP)
    }
  })

  it('a number typed as text still works', () => {
    expect(capOf('8')).toBe(8)
    expect(capOf(7.9)).toBe(7)
  })
})

describe('THERE IS ALWAYS SOMEBODY, OR IT SAYS SO PLAINLY', () => {
  // A pack that goes nowhere is worse than one on the wrong desk.
  it('one person set means they take everything', () => {
    const a = go({ second: null, sent: sent(ELLESSE, 20) })
    expect(a.to).toEqual(ELLESSE)
    expect(a.words).toContain('No second person is set')
  })

  it('only a second person set means they take everything', () => {
    expect(go({ first: null }).to).toEqual(ELLIE)
  })

  it('and nobody set says nobody is set, rather than pretending', () => {
    const a = go({ first: null, second: null })
    expect(a.to).toBeNull()
    expect(a.why).toBe('nobody')
    expect(a.words).toContain('Nobody is named in Settings')
  })

  it('a person with no id is not a person', () => {
    expect(go({ first: { id: '', name: 'Ghost' } }).to).toEqual(ELLIE)
  })
})

describe('where today stands, for the Settings page', () => {
  it('says who is next and how far through', () => {
    const t = todaySoFar({ first: ELLESSE, second: ELLIE, today: WED, sent: sent(ELLESSE, 3) })
    expect(t.firstCount).toBe(3)
    expect(t.full).toBe(false)
    expect(t.words).toContain('The next one goes to Ellesse Mowbray — 3 of 5')
  })

  it('and says plainly when the first person is full', () => {
    const t = todaySoFar({ first: ELLESSE, second: ELLIE, today: WED,
      sent: [...sent(ELLESSE, 5), ...sent(ELLIE, 2)] })
    expect(t.full).toBe(true)
    expect(t.secondCount).toBe(2)
    expect(t.words).toContain('The next one goes to Ellie Nakamura')
  })

  it('and never says full on a day with no quota', () => {
    const t = todaySoFar({ first: ELLESSE, second: ELLIE, today: SAT, sent: sent(ELLESSE, 9, SAT) })
    expect(t.full).toBe(false)
    expect(t.words).toContain('not a working day')
  })
})
