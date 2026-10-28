import { isWorkday } from './the-week'

// WHO GETS THE NEXT COMPLIANCE PACK.
//
// 28 Oct 2026. Fabio: "every time we allocate push to sales tracker, it goes to
// the first person until we hit the number of that particular day of five. Once
// we hit five, anything after that goes to person number two."
//
// THE WHOLE RULE IS IN THIS FILE AND IT TOUCHES NOTHING. No database, no email,
// no clock of its own - it is handed the day, the two names and what has
// already gone out, and it says who is next. That is what makes it testable,
// and the deciding is the part worth being certain about: get it wrong and one
// person quietly carries everybody's work.
//
// FOUR THINGS IT HOLDS:
//
//   1. A DEAL KEEPS WHOEVER IT WAS FIRST GIVEN TO. Pushing the same deal again
//      - it bounced, it was corrected, somebody pressed twice - does not move
//      it and does not use a slot. Fabio: "stays with the first person".
//   2. THE COUNT IS TODAY'S, AND ONLY TODAY'S. It starts again every working
//      morning because it is counted from the packs that carry today's date,
//      not from a running total somebody has to remember to reset.
//   3. WORKING DAYS ONLY. Monday to Friday, less NSW public holidays. The list
//      lives in lib/the-week.ts and is shared with Today and the credit team,
//      so the portal cannot hold two opinions about whether it is a work day.
//   4. THERE IS ALWAYS SOMEBODY. No second person, nobody set at all, a day
//      that is not a working day - every one of those still produces an answer.
//      A pack that goes nowhere is worse than a pack sent to the wrong desk.

/** The built-in number, used when Settings has not been given one. */
export const DEFAULT_DAILY_CAP = 5

export type Person = {
  id: string
  name: string
  /** First day of leave, inclusive, as YYYY-MM-DD. */
  onLeaveFrom?: string | null
  /** Last day of leave, inclusive. */
  onLeaveUntil?: string | null
} | null

export type Allocation = {
  /** Who it goes to. Null only when Settings names nobody at all. */
  to: Person
  /** 'first' | 'second' | 'kept' | 'nobody' - what happened, for the screen. */
  why: 'first' | 'second' | 'kept' | 'nobody'
  /** How many the first person already has today, before this one. */
  usedToday: number
  cap: number
  /** False on a weekend or a public holiday. */
  workday: boolean
  /** Is the first person away today. */
  awayFirst: boolean
  /** Is the second person away today. */
  awaySecond: boolean
  /**
   * IS THE DAILY NUMBER BEING APPLIED AT ALL.
   *
   * False whenever leave has taken the choice away - there is only one person
   * able to take it, so counting to five decides nothing. The screen reads this
   * rather than working it out: a pill saying "7 of 5" is a screen printing a
   * rule it is not following.
   */
  capApplies: boolean
  /** One sentence, for the file note and the settings line. */
  words: string
}

const txt = (v: any) => String(v ?? '').trim()

/**
 * IS THIS PERSON AWAY ON THIS DAY.
 *
 * BOTH DATES OR IT DOES NOT COUNT. Somebody typing a start date and being
 * called away before typing the end date must not silently divert a fortnight
 * of work on the strength of half an answer. One date on its own is "not away",
 * and the Settings page says so on the line.
 *
 * Compared as plain strings. Both ends are YYYY-MM-DD, which sorts the same way
 * it reads, so there is no Date object here and therefore no timezone to get
 * wrong - the fault that would show up as somebody being away a day early in
 * Sydney and not at all in Melbourne.
 *
 * Both ends are INCLUSIVE. Away "from the 26th until the 30th" means the 30th
 * is a day off, which is what a person means when they say it.
 */
export function isAway(p: Person, today: string): boolean {
  if (!p) return false
  const from = txt(p.onLeaveFrom)
  const until = txt(p.onLeaveUntil)
  if (!from || !until) return false
  const day = txt(today)
  if (!day) return false
  // A range typed backwards is a typing mistake, not an instruction to divert
  // every pack for ever. Read it the way it was obviously meant.
  const a = from <= until ? from : until
  const b = from <= until ? until : from
  return day >= a && day <= b
}

/** "7 November", for a sentence. Never a Date - see isAway. */
export function sayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(txt(iso))
  if (!m) return txt(iso)
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  const month = months[Number(m[2]) - 1]
  return month ? `${Number(m[3])} ${month}` : txt(iso)
}

export function capOf(setting: any): number {
  const n = Number(setting)
  // A nought or a negative would send every pack to the second person for ever,
  // which is a configuration mistake rather than an instruction.
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_DAILY_CAP
}

/**
 * HOW MANY OF TODAY'S PACKS ARE ALREADY WITH THIS PERSON.
 *
 * `sent` is every pack that has gone out, as {userId, at}. Counted here rather
 * than in the database query so the rule and the counting cannot drift apart,
 * and so this stays testable without a database.
 *
 * `today` is a plain YYYY-MM-DD. The timestamps are compared on their first ten
 * characters, which is the same day boundary the rest of the portal uses.
 */
export function countToday(
  sent: Array<{ userId?: string | null; at?: string | null }>, personId: string, today: string,
): number {
  const who = txt(personId)
  if (!who) return 0
  return (sent || []).filter(s =>
    txt(s?.userId) === who && txt(s?.at).slice(0, 10) === txt(today)).length
}

/**
 * WHO THE NEXT ONE GOES TO.
 *
 * `alreadyOn` is the person this deal was given to before, if any. Set, and
 * nothing moves: see fault 1.
 */
export function allocate(opts: {
  first: Person
  second: Person
  cap?: any
  /** YYYY-MM-DD. */
  today: string
  sent: Array<{ userId?: string | null; at?: string | null }>
  alreadyOn?: Person
}): Allocation {
  const cap = capOf(opts.cap)
  const workday = isWorkday(txt(opts.today))
  const first = opts.first && txt(opts.first.id) ? opts.first : null
  const second = opts.second && txt(opts.second.id) ? opts.second : null
  const usedToday = first ? countToday(opts.sent, first.id, opts.today) : 0
  const awayFirst = isAway(first, opts.today)
  const awaySecond = isAway(second, opts.today)

  // 1. A DEAL THAT ALREADY HAS SOMEBODY KEEPS THEM.
  const kept = opts.alreadyOn && txt(opts.alreadyOn.id) ? opts.alreadyOn : null
  if (kept) {
    return {
      to: kept, why: 'kept', usedToday, cap, workday, awayFirst, awaySecond, capApplies: false,
      words: `Already with ${kept.name || 'the same person'}; sending it again does not move it.`,
    }
  }

  if (!first && !second) {
    return {
      to: null, why: 'nobody', usedToday, cap, workday, awayFirst, awaySecond, capApplies: false,
      words: 'Nobody is named in Settings to receive the compliance pack.',
    }
  }

  // Only one of the two filled in - that one takes everything, away or not.
  //
  // A PACK IS NEVER SENT NOWHERE. That was the rule before leave existed and
  // leave does not get to break it: the alternative is a compliance record that
  // silently stops being produced for a fortnight, which nobody discovers until
  // an audit asks for it.
  if (!second) {
    return {
      to: first, why: 'first', usedToday, cap, workday, awayFirst, awaySecond, capApplies: false,
      words: awayFirst
        ? `${first!.name} is away until ${sayDate(txt(first!.onLeaveUntil))}, and no second person is set — so it still goes to ${first!.name}.`
        : `${first!.name} takes it. No second person is set, so there is no overflow.`,
    }
  }
  if (!first) {
    return {
      to: second, why: 'second', usedToday, cap, workday, awayFirst, awaySecond, capApplies: false,
      words: awaySecond
        ? `${second.name} is away until ${sayDate(txt(second.onLeaveUntil))}, and nobody is set as the first person — so it still goes to ${second.name}.`
        : `${second.name} takes it. Nobody is set as the first person.`,
    }
  }

  // ── LEAVE, BEFORE THE DAILY NUMBER ────────────────────────────────────────
  //
  // Leave is asked FIRST because it decides whether the number means anything.
  // Counting to five and then discovering the overflow person is in Bali would
  // send the sixth pack to an empty desk with a confident sentence attached.
  //
  // 1. BOTH AWAY. The rare one. It goes to the first person and the screen
  //    shouts, because the honest answer is "this needs a human", not silence.
  if (awayFirst && awaySecond) {
    return {
      to: first, why: 'first', usedToday, cap, workday, awayFirst, awaySecond, capApplies: false,
      words: `${first.name} and ${second.name} are both away. It goes to ${first.name} anyway —`
        + ` set somebody else as the first person, or it waits until ${sayDate(txt(first.onLeaveUntil))}.`,
    }
  }

  // 2. THE FIRST PERSON IS AWAY - everything to the second, with no number.
  //    Fabio: "if number one is off, it always goes to number two."
  if (awayFirst) {
    return {
      to: second, why: 'second', usedToday, cap, workday, awayFirst, awaySecond, capApplies: false,
      words: `${first.name} is away until ${sayDate(txt(first.onLeaveUntil))}.`
        + ` Everything goes to ${second.name}.`,
    }
  }

  // 3. THE SECOND PERSON IS AWAY - no overflow, it piles on the first person.
  //    Fabio: "If number two is off, there's no overflow. It just keeps
  //    floating to number one." So the cap is not applied at all, rather than
  //    applied and then ignored - which is why capApplies is false here and the
  //    screen stops printing "of 5".
  if (awaySecond) {
    return {
      to: first, why: 'first', usedToday, cap, workday, awayFirst, awaySecond, capApplies: false,
      words: `${second.name} is away until ${sayDate(txt(second.onLeaveUntil))}.`
        + ` ${first.name} takes them all, past the ${cap} — ${usedToday + 1} today.`,
    }
  }

  // 3. A DAY THAT IS NOT A WORKING DAY HAS NO QUOTA TO FILL.
  //
  // The rule is about spreading a working day's load. A Saturday push is a rare
  // thing somebody is doing deliberately, and sending it to the overflow person
  // because of a count nobody was keeping would be surprising in both
  // directions. It goes to the first person and does not consume a weekday slot.
  if (!workday) {
    return {
      to: first, why: 'first', usedToday, cap, workday, awayFirst, awaySecond, capApplies: false,
      words: `${first.name} takes it. ${txt(opts.today)} is not a working day, so the daily count does not apply.`,
    }
  }

  if (usedToday < cap) {
    const left = cap - usedToday - 1
    return {
      to: first, why: 'first', usedToday, cap, workday, awayFirst, awaySecond, capApplies: true,
      words: `${first.name} takes it — ${usedToday + 1} of ${cap} today`
        + (left === 0 ? `. That is the last one; the rest of today goes to ${second.name}.` : `.`),
    }
  }

  return {
    to: second, why: 'second', usedToday, cap, workday, awayFirst, awaySecond, capApplies: true,
    words: `${second.name} takes it. ${first.name} is full for today at ${cap}.`,
  }
}

/**
 * WHERE TODAY STANDS, FOR THE SETTINGS PAGE.
 *
 * The same counting as above, said out loud, so nobody has to work out who is
 * next by reading a table.
 */
export function todaySoFar(opts: {
  first: Person
  second: Person
  cap?: any
  today: string
  sent: Array<{ userId?: string | null; at?: string | null }>
}): {
  firstCount: number; secondCount: number; cap: number; full: boolean; workday: boolean
  awayFirst: boolean; awaySecond: boolean; bothAway: boolean; capApplies: boolean
  /** "away until 7 November", or '' when they are here. For the pill. */
  firstAwayWords: string; secondAwayWords: string
  words: string
} {
  const cap = capOf(opts.cap)
  const workday = isWorkday(txt(opts.today))
  const firstCount = opts.first ? countToday(opts.sent, opts.first.id, opts.today) : 0
  const secondCount = opts.second ? countToday(opts.sent, opts.second.id, opts.today) : 0
  const awayFirst = isAway(opts.first, opts.today)
  const awaySecond = isAway(opts.second, opts.today)
  const bothAway = Boolean(opts.first && opts.second && awayFirst && awaySecond)

  // THE NUMBER ONLY MEANS SOMETHING WHEN THERE ARE TWO PEOPLE TO SPLIT ACROSS.
  // Exactly the condition allocate() uses, so the line on the page cannot say
  // one thing while the rule does another.
  const capApplies = Boolean(opts.first && opts.second && workday && !awayFirst && !awaySecond)
  const full = Boolean(capApplies && firstCount >= cap)

  const until = (p: Person) => p ? sayDate(txt(p.onLeaveUntil)) : ''
  const firstAwayWords = awayFirst ? `away until ${until(opts.first)}` : ''
  const secondAwayWords = awaySecond ? `away until ${until(opts.second)}` : ''

  let words: string
  if (!opts.first && !opts.second) words = 'Nobody is set to receive the compliance pack.'
  else if (bothAway) words = `${opts.first!.name} and ${opts.second!.name} are both away. Packs are still being sent, and they are going to ${opts.first!.name}.`
  else if (awayFirst && opts.second) words = `${opts.first!.name} is away. Everything goes to ${opts.second.name} until ${until(opts.first)}.`
  else if (awaySecond && opts.first) words = `${opts.second!.name} is away. ${opts.first.name} takes them all, past the ${cap}, until ${until(opts.second)}.`
  else if (!workday) words = `${txt(opts.today)} is not a working day. Anything sent today goes to ${opts.first?.name || opts.second?.name}.`
  else if (!opts.second) words = `${opts.first!.name} takes everything — no second person is set.`
  else if (!opts.first) words = `${opts.second.name} takes everything — nobody is set as the first person.`
  else if (full) words = `${opts.first.name} is full at ${cap}. The next one goes to ${opts.second.name}.`
  else words = `The next one goes to ${opts.first.name} — ${firstCount} of ${cap} so far.`

  return {
    firstCount, secondCount, cap, full, workday,
    awayFirst, awaySecond, bothAway, capApplies,
    firstAwayWords, secondAwayWords, words,
  }
}
