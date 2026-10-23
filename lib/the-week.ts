// THE WORKING WEEK, AND WHAT COUNTS AS YESTERDAY.
//
// 23 Oct 2026. Fabio, the morning after Today shipped: "So just again,
// remember, there is weekends. So don't do that on the weekend. So it's 7:30
// Monday to Friday."
//
// Without this, Saturday morning tells four credit assessors they have not
// told the brokers their day, and keeps counting how late they are all
// weekend. By Monday the flag says 48 hours. Nobody was late. The portal was.
//
// And Monday's "yesterday you finished" was Sunday, which is always empty, so
// every Friday's work vanished from the one place it was meant to appear.
//
// HIS TWO ANSWERS, 23 Oct 2026, asked straight:
//   Monday's yesterday  -> "Friday only"
//   Saturday and Sunday -> "Nothing at all"
//   Public holidays     -> "Now, NSW holidays"
//
// So this file is the week. One question - is this a working day - asked by
// the plan, the flag and the yesterday list, so the three cannot disagree.

/**
 * NSW PUBLIC HOLIDAYS.
 *
 * Typed out rather than worked out. Easter moves every year and Christmas
 * rolls onto the next weekday when it lands on a weekend, so a clever
 * calculation here would be a clever calculation to be wrong in April.
 *
 * THE BANK HOLIDAY IN AUGUST IS NOT HERE ON PURPOSE. It applies to banks and
 * certain financial institutions, not to us, and we work it.
 *
 * Source: nsw.gov.au/about-nsw/public-holidays.
 * WHEN THIS LIST RUNS SHORT the test below fails sixty days out, with the
 * address to copy the next year from. That is deliberate: a holiday list that
 * expires quietly is worse than no list, because the portal would start
 * calling Christmas a working day and nobody would know why.
 */
export const NSW_HOLIDAYS: Record<string, string> = {
  '2026-01-01': 'New Year’s Day',
  '2026-01-26': 'Australia Day',
  '2026-04-03': 'Good Friday',
  '2026-04-04': 'Easter Saturday',
  '2026-04-05': 'Easter Sunday',
  '2026-04-06': 'Easter Monday',
  '2026-04-25': 'ANZAC Day',
  '2026-04-27': 'ANZAC Day holiday',
  '2026-06-08': 'King’s Birthday',
  '2026-10-05': 'Labour Day',
  '2026-12-25': 'Christmas Day',
  '2026-12-26': 'Boxing Day',
  '2026-12-28': 'Boxing Day holiday',

  '2027-01-01': 'New Year’s Day',
  '2027-01-26': 'Australia Day',
  '2027-03-26': 'Good Friday',
  '2027-03-27': 'Easter Saturday',
  '2027-03-28': 'Easter Sunday',
  '2027-03-29': 'Easter Monday',
  '2027-04-25': 'ANZAC Day',
  '2027-06-14': 'King’s Birthday',
  '2027-10-04': 'Labour Day',
  '2027-12-25': 'Christmas Day',
  '2027-12-26': 'Boxing Day',
  '2027-12-27': 'Christmas Day holiday',
  '2027-12-28': 'Boxing Day holiday',
}

/** The last day the list above knows about. Read by the test that nags. */
export function lastKnownHoliday(): string {
  return Object.keys(NSW_HOLIDAYS).sort().slice(-1)[0]
}

/** A plain 'YYYY-MM-DD' read as a calendar day, never as a moment in time. */
const asDay = (day: string) => new Date(`${day}T00:00:00Z`)

/** Saturday or Sunday on the Sydney calendar. */
export function isWeekend(day: string): boolean {
  const d = asDay(day).getUTCDay()
  return d === 0 || d === 6
}

/** The name of the holiday, or null. What the screen says instead of a plan. */
export function holidayName(day: string): string | null {
  return NSW_HOLIDAYS[day] || null
}

/** Monday to Friday, less NSW public holidays. */
export function isWorkday(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  return !isWeekend(day) && !holidayName(day)
}

/** Why today has no plan on it, in the words the screen uses. */
export function whyNoPlan(day: string): string | null {
  const holiday = holidayName(day)
  if (holiday) return holiday
  if (isWeekend(day)) return 'the weekend'
  return null
}

/** One calendar day back. Not the same thing as the last working day. */
export function dayBefore(day: string): string {
  const d = asDay(day)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * THE LAST DAY ANYBODY WAS AT WORK.
 *
 * Monday's is Friday. Tuesday after a long weekend is Friday too. It is what
 * "yesterday you finished" means to a person, and it is never a Sunday.
 *
 * Fabio chose Friday ONLY, not Friday plus the weekend: if somebody worked a
 * Saturday it does not appear on Monday's list. His call, and the simpler one
 * to read - one day, one list, same as every other morning.
 */
export function lastWorkdayBefore(day: string, give_up_after = 10): string {
  let d = dayBefore(day)
  for (let i = 0; i < give_up_after; i++) {
    if (isWorkday(d)) return d
    d = dayBefore(d)
  }
  // Ten days of holidays in a row has never happened. If it ever does, one
  // calendar day back is wrong but harmless - better than looping forever.
  return dayBefore(day)
}
