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

export type Person = { id: string; name: string } | null

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
  /** One sentence, for the file note and the settings line. */
  words: string
}

const txt = (v: any) => String(v ?? '').trim()

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

  // 1. A DEAL THAT ALREADY HAS SOMEBODY KEEPS THEM.
  const kept = opts.alreadyOn && txt(opts.alreadyOn.id) ? opts.alreadyOn : null
  if (kept) {
    return {
      to: kept, why: 'kept', usedToday, cap, workday,
      words: `Already with ${kept.name || 'the same person'}; sending it again does not move it.`,
    }
  }

  if (!first && !second) {
    return {
      to: null, why: 'nobody', usedToday, cap, workday,
      words: 'Nobody is named in Settings to receive the compliance pack.',
    }
  }

  // Only one of the two filled in - that one takes everything.
  if (!second) {
    return {
      to: first, why: 'first', usedToday, cap, workday,
      words: `${first!.name} takes it. No second person is set, so there is no overflow.`,
    }
  }
  if (!first) {
    return {
      to: second, why: 'second', usedToday, cap, workday,
      words: `${second.name} takes it. Nobody is set as the first person.`,
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
      to: first, why: 'first', usedToday, cap, workday,
      words: `${first.name} takes it. ${txt(opts.today)} is not a working day, so the daily count does not apply.`,
    }
  }

  if (usedToday < cap) {
    const left = cap - usedToday - 1
    return {
      to: first, why: 'first', usedToday, cap, workday,
      words: `${first.name} takes it — ${usedToday + 1} of ${cap} today`
        + (left === 0 ? `. That is the last one; the rest of today goes to ${second.name}.` : `.`),
    }
  }

  return {
    to: second, why: 'second', usedToday, cap, workday,
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
}): { firstCount: number; secondCount: number; cap: number; full: boolean; workday: boolean; words: string } {
  const cap = capOf(opts.cap)
  const workday = isWorkday(txt(opts.today))
  const firstCount = opts.first ? countToday(opts.sent, opts.first.id, opts.today) : 0
  const secondCount = opts.second ? countToday(opts.sent, opts.second.id, opts.today) : 0
  const full = Boolean(opts.first && opts.second && workday && firstCount >= cap)

  let words: string
  if (!opts.first && !opts.second) words = 'Nobody is set to receive the compliance pack.'
  else if (!workday) words = `${txt(opts.today)} is not a working day. Anything sent today goes to ${opts.first?.name || opts.second?.name}.`
  else if (!opts.second) words = `${opts.first!.name} takes everything — no second person is set.`
  else if (full) words = `${opts.first!.name} is full at ${cap}. The next one goes to ${opts.second.name}.`
  else words = `The next one goes to ${opts.first!.name} — ${firstCount} of ${cap} so far.`

  return { firstCount, secondCount, cap, full, workday, words }
}
