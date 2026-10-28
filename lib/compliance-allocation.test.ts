import { describe, it, expect } from 'vitest'
import { allocate, todaySoFar, countToday, capOf, isAway, sayDate, DEFAULT_DAILY_CAP } from './compliance-allocation'

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

// ─────────────────────────────────────────────────────────────────────────────
// SOMEBODY IS AWAY.
//
// 28 Oct 2026. Fabio: "if number one is off, it always goes to number two. If
// number two is off, there's no overflow. It just keeps floating to number one.
// There will be very rare instances, if ever, that both of them are on leave.
// So just put a warning somewhere."
//
// THIS IS THE QUIETEST FAULT IN THE PORTAL. A pack sent to somebody on leave
// produces no error, no bounce and no missing row - it lands in an inbox nobody
// is reading, and the first anybody knows is a compliance file with a fortnight
// missing out of it. So every branch is written down here, including the two
// nobody expects: both away, and a half-typed leave range.
// ─────────────────────────────────────────────────────────────────────────────

/** Away across WED (28 Oct), both ends inclusive. */
const away = (p: { id: string; name: string }, from = '2026-10-26', until = '2026-10-30') =>
  ({ ...p, onLeaveFrom: from, onLeaveUntil: until })

describe('IS THIS PERSON AWAY', () => {
  it('yes, on every day of the range', () => {
    for (const day of ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']) {
      expect(isAway(away(ELLESSE), day), day).toBe(true)
    }
  })

  it('AND BOTH ENDS ARE INCLUSIVE', () => {
    // "Away from the 26th until the 30th" means the 30th is a day off. Treating
    // the end as exclusive sends a pack to somebody on the last day of their
    // leave, which is exactly the day they are least likely to look.
    expect(isAway(away(ELLESSE), '2026-10-30')).toBe(true)
    expect(isAway(away(ELLESSE), '2026-10-31')).toBe(false)
    expect(isAway(away(ELLESSE), '2026-10-25')).toBe(false)
  })

  it('HALF AN ANSWER IS NOT AN ANSWER', () => {
    // Somebody types the start date and is called away before typing the end.
    // Reading that as "away for ever" would divert every pack from that day on
    // and nobody would know why.
    expect(isAway({ ...ELLESSE, onLeaveFrom: '2026-10-26', onLeaveUntil: null }, WED)).toBe(false)
    expect(isAway({ ...ELLESSE, onLeaveFrom: null, onLeaveUntil: '2026-10-30' }, WED)).toBe(false)
    expect(isAway({ ...ELLESSE, onLeaveFrom: '', onLeaveUntil: '' }, WED)).toBe(false)
  })

  it('and a range typed backwards is read the way it was meant', () => {
    expect(isAway({ ...ELLESSE, onLeaveFrom: '2026-10-30', onLeaveUntil: '2026-10-26' }, WED)).toBe(true)
  })

  it('and nobody is never away', () => {
    expect(isAway(null, WED)).toBe(false)
    expect(isAway(ELLESSE, WED)).toBe(false)
    expect(isAway(away(ELLESSE), '')).toBe(false)
  })
})

describe('THE DATE, SAID OUT LOUD', () => {
  it('reads the way a person would say it', () => {
    expect(sayDate('2026-11-07')).toBe('7 November')
    expect(sayDate('2026-10-30')).toBe('30 October')
    expect(sayDate('2026-01-01')).toBe('1 January')
  })

  it('and anything it does not recognise is handed back untouched', () => {
    for (const junk of ['', 'next week', '2026-13-01']) {
      expect(typeof sayDate(junk)).toBe('string')
    }
    expect(sayDate('next week')).toBe('next week')
  })
})

describe('THE FIRST PERSON IS AWAY', () => {
  // Fabio: "if number one is off, it always goes to number two."
  it('everything goes to the second person', () => {
    const a = go({ first: away(ELLESSE) })
    expect(a.to).toMatchObject({ id: ELLIE.id })
    expect(a.why).toBe('second')
    expect(a.awayFirst).toBe(true)
  })

  it('AND THE DAILY NUMBER STOPS APPLYING', () => {
    // There is nobody to split across, so counting to five decides nothing.
    // Without this the sixth pack of the day would "overflow" from a person who
    // is in Bali to a person who is already taking all of them.
    const a = go({ first: away(ELLESSE), sent: sent(ELLIE, 40) })
    expect(a.to).toMatchObject({ id: ELLIE.id })
    expect(a.capApplies).toBe(false)
  })

  it('and the sentence says when she is back', () => {
    const a = go({ first: away(ELLESSE, '2026-10-26', '2026-11-07') })
    expect(a.words).toContain('Ellesse Mowbray is away until 7 November')
    expect(a.words).toContain('Everything goes to Ellie Nakamura')
  })

  it('but not on a day outside the range', () => {
    const a = go({ first: away(ELLESSE, '2026-11-01', '2026-11-07') })
    expect(a.to).toMatchObject({ id: ELLESSE.id })
    expect(a.awayFirst).toBe(false)
  })
})

describe('THE SECOND PERSON IS AWAY', () => {
  // Fabio: "If number two is off, there's no overflow. It just keeps floating
  // to number one."
  it('the first person keeps taking them past the cap', () => {
    const a = go({ second: away(ELLIE), sent: sent(ELLESSE, 9) })
    expect(a.to).toMatchObject({ id: ELLESSE.id })
    expect(a.why).toBe('first')
    expect(a.capApplies).toBe(false)
  })

  it('AND IT IS STILL THE FIRST PERSON AT ONE HUNDRED', () => {
    // No quiet ceiling. If this ever stopped handing them over, packs would
    // simply stop being produced.
    const a = go({ second: away(ELLIE), sent: sent(ELLESSE, 100) })
    expect(a.to).toMatchObject({ id: ELLESSE.id })
  })

  it('and the sentence admits the cap is being passed', () => {
    const a = go({ second: away(ELLIE), sent: sent(ELLESSE, 7) })
    expect(a.words).toContain('Ellie Nakamura is away until 30 October')
    expect(a.words).toContain('past the 5')
  })
})

describe('BOTH AWAY - THE RARE ONE', () => {
  // Fabio: "There will be very rare instances, if ever, that both of them are
  // on leave. So just put a warning somewhere."
  it('IT STILL GOES SOMEWHERE', () => {
    // A pack sent nowhere is worse than a pack sent to a desk that is empty for
    // a week: one of them leaves a trail.
    const a = go({ first: away(ELLESSE), second: away(ELLIE) })
    expect(a.to).toMatchObject({ id: ELLESSE.id })
    expect(a.awayFirst).toBe(true)
    expect(a.awaySecond).toBe(true)
  })

  it('and it says so, with what to do about it', () => {
    const a = go({ first: away(ELLESSE), second: away(ELLIE) })
    expect(a.words).toContain('both away')
    expect(a.words).toContain('set somebody else as the first person')
  })
})

describe('WHAT LEAVE DOES NOT CHANGE', () => {
  it('A DEAL ALREADY GIVEN TO SOMEBODY STAYS WITH THEM', () => {
    // Even if they are away. Moving it silently on the second press would mean
    // two people believe they hold the same pack, which is worse than one
    // person holding it late. Reassign is a button somebody presses.
    const a = go({ first: away(ELLESSE), alreadyOn: ELLESSE })
    expect(a.to).toMatchObject({ id: ELLESSE.id })
    expect(a.why).toBe('kept')
  })

  it('and one person set, away, still takes it', () => {
    const a = go({ first: away(ELLESSE), second: null })
    expect(a.to).toMatchObject({ id: ELLESSE.id })
    expect(a.words).toContain('no second person is set')
  })

  it('and nobody set is still nobody', () => {
    const a = go({ first: null, second: null })
    expect(a.to).toBeNull()
    expect(a.why).toBe('nobody')
  })

  it('and with nobody away the answer is exactly what it was before', () => {
    const a = go({ sent: sent(ELLESSE, 5) })
    expect(a.to).toEqual(ELLIE)
    expect(a.capApplies).toBe(true)
    expect(a.words).toContain('full for today at 5')
  })
})

describe('AND THE SETTINGS LINE SAYS THE SAME THING', () => {
  it('the first person away', () => {
    const t = todaySoFar({ first: away(ELLESSE, '2026-10-26', '2026-11-07'), second: ELLIE, today: WED, sent: sent(ELLIE, 4) })
    expect(t.awayFirst).toBe(true)
    expect(t.capApplies).toBe(false)
    expect(t.full).toBe(false)
    expect(t.firstAwayWords).toBe('away until 7 November')
    expect(t.words).toContain('Everything goes to Ellie Nakamura until 7 November')
  })

  it('the second person away', () => {
    const t = todaySoFar({ first: ELLESSE, second: away(ELLIE), today: WED, sent: sent(ELLESSE, 7) })
    expect(t.awaySecond).toBe(true)
    expect(t.firstCount).toBe(7)
    expect(t.capApplies).toBe(false)
    expect(t.secondAwayWords).toBe('away until 30 October')
    expect(t.words).toContain('takes them all, past the 5')
  })

  it('BOTH AWAY IS NEVER SAID QUIETLY', () => {
    const t = todaySoFar({ first: away(ELLESSE), second: away(ELLIE), today: WED, sent: [] })
    expect(t.bothAway).toBe(true)
    expect(t.words).toContain('both away')
    expect(t.words).toContain('still being sent')
  })

  it('and nobody away reads exactly as it did yesterday', () => {
    const t = todaySoFar({ first: ELLESSE, second: ELLIE, today: WED, sent: sent(ELLESSE, 3) })
    expect(t.bothAway).toBe(false)
    expect(t.capApplies).toBe(true)
    expect(t.firstAwayWords).toBe('')
    expect(t.words).toContain('The next one goes to Ellesse Mowbray — 3 of 5')
  })
})
