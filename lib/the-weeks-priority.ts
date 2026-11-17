// WHAT MANAGEMENT IS COUNTING ON THIS WEEK, ON THE PERSON'S OWN SCREEN.
//
// 19 Nov 2026. Fabio: "since we as management decide the deals that are to be
// lodged today, this week, if they belong to Mel or Katie or Dinisha, we
// should be having something in their today page that will show this is a
// priority for the week, because these are the ones that we're working. So
// always keep an eye on these deals."
//
// NOTHING NEW IS RECORDED. The week a deal is lodging is already a fact the
// portal holds - lodgement_plan and lodgement_week, written by sayTheWeek()
// from the Monday run-through and from the Due to lodge panel. tabOf() in
// lib/lodging-when.ts is the one function that reads them. This file asks it
// the same question on a credit assessor's behalf.
//
// So the box looks after itself. Move a deal to next week on the run-through
// and it leaves the box. Lodge it and it leaves. Fabio: "they update as we
// update... so that disapers". Nobody tidies anything up, because there is
// nothing here to tidy - it is a view of a fact, not a list somebody keeps.
//
// AND IT SAYS WHETHER SHE IS ON IT. That is the whole reason it earns a box
// rather than a chip. A deal management is counting on, that is not in her
// day, is the thing somebody needs to see before Thursday.
//
// HERS ONLY. 19 Nov 2026, Fabio: "this is for Katie Mel and Dinsiha." It is
// her Today page; a deal of Katie's on Mellissa's screen is not her problem
// and would only make the number wrong.

import { tabOf } from './lodging-when'

export type WeekRow = {
  id: string
  name: string
  /** "Compliance", "With client - documents". What it says under the name. */
  where: string
  days: number | null
  /** Has she actually ticked it into today? */
  onToday: boolean
}

/** Is this deal one of the ones we said is lodging this week? */
export function lodgingThisWeek(deal: any, now: Date = new Date()): boolean {
  return tabOf(deal, now) === 'this_week'
}

/**
 * THE BOX. Her deals, this week's lodgements, the ones she is not on first.
 *
 * Not on today first, because that is the row somebody has to do something
 * about - the same rule planBoard() sorts by, and for the same reason. Then
 * oldest first, which is every other list on this screen.
 */
export function theWeeksPriority(
  rows: Array<{ id: any; name?: any; where?: any; days?: any }>,
  onToday: Set<string> | string[],
): WeekRow[] {
  const on = onToday instanceof Set ? onToday : new Set((onToday || []).map(String))
  return (rows || [])
    .map(r => ({
      id: String(r.id),
      name: String(r.name ?? ''),
      where: String(r.where ?? ''),
      days: typeof r.days === 'number' ? r.days : null,
      onToday: on.has(String(r.id)),
    }))
    .sort((a, b) => {
      if (a.onToday !== b.onToday) return a.onToday ? 1 : -1
      return (b.days ?? -1) - (a.days ?? -1)
    })
}

/** "2 of 3 are in her day" - the line under the count. Plain words, no maths. */
export function weekWords(rows: WeekRow[]): string {
  if (rows.length === 0) return 'Nothing of yours is down to lodge this week.'
  const on = rows.filter(r => r.onToday).length
  if (on === rows.length) return rows.length === 1 ? 'It is in your day.' : 'All of them are in your day.'
  if (on === 0) return rows.length === 1 ? 'It is not in your day.' : 'None of them are in your day.'
  return `${on} of ${rows.length} are in your day.`
}
