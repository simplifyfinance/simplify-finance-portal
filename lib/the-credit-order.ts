// WHAT CREDIT SHOULD DO FIRST, AND WHY.
//
// 16 Nov 2026. Fabio, on how a credit assessor's day should be suggested:
//
//   "By importance, we always start with lending options compliance... If
//    someone is at compliance, I want that to be sitting on the top of the
//    list for credit, because that means we're going to get a deal that week.
//    Everything that we do in this business is to get deals that particular
//    week."
//
// So the order is the distance to a lodged deal, closest first:
//
//   Compliance   the last thing before it lodges
//   LO           lending options
//   BC           borrowing capacity
//   Fact Find    the beginning, and the furthest from a deal this week
//
// and inside each stage, OLDEST FIRST - the file that has been sitting longest
// has kept somebody waiting longest. The portal already knows when a stage
// opened; see stageOpenedAt() in lib/the-days-plan.ts.
//
// ---------------------------------------------------------------------------
// WHAT THIS DOES NOT REORDER
// ---------------------------------------------------------------------------
//
// Two bands sit above all of it, and they were decided on 27 Oct 2026:
//
//   SENT BACK      a broker returned the work. Fabio's call, asked straight:
//                  straight to the top. "A priority is a broker saying do this
//                  one first, and a rework is a broker saying the one you
//                  already did is wrong and a client is waiting on the fix."
//   A BROKER ASKED today's priority, shared one broker at a time so that Mark
//                  asking three times does not bury Justin. See a-slot-each.
//
// Those are people giving instructions. This file is the portal making a
// suggestion, and a suggestion does not outrank an instruction.
//
// ---------------------------------------------------------------------------
// TEN, AND NO MORE
// ---------------------------------------------------------------------------
//
// Fabio: "don't make more than 10... because remember, they can't do more than
// 10." It is not a cap - she can tick an eleventh - it is what the portal
// offers. Suggesting fifteen to somebody who finishes ten is suggesting
// failure, and a list nobody can finish is a list nobody trusts.

/** Closest to a lodged deal first. Anything unrecognised sorts last. */
export const CREDIT_STAGES = ['Compliance', 'LO', 'BC', 'Fact Find'] as const
export type CreditStage = typeof CREDIT_STAGES[number]

/** How many the day opens with ticked. */
export const SUGGEST = 10

export function stageRank(stage: any): number {
  const i = (CREDIT_STAGES as readonly string[]).indexOf(String(stage ?? '').trim())
  return i < 0 ? CREDIT_STAGES.length : i
}

const when = (v: any) => {
  const t = new Date(String(v ?? '')).getTime()
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER
}

/**
 * COMPLIANCE, THEN LO, THEN BC - AND OLDEST FIRST INSIDE EACH.
 *
 * A stable sort on a copy. The list it is given is not touched, because the
 * caller's order is the fallback for two deals that tie on both counts.
 */
export function byStageThenAge<T extends { stage?: any; since?: any }>(rows: T[]): T[] {
  return [...(rows || [])].sort((a, b) => {
    const s = stageRank(a.stage) - stageRank(b.stage)
    return s !== 0 ? s : when(a.since) - when(b.since)
  })
}

/**
 * WHERE A CREDIT ASSESSOR'S DAY OPENS.
 *
 * 12 Nov 2026 it opened EMPTY - everything below the line, and she pulled up
 * what she was doing. That was right while nothing could say which ten were
 * worth pulling up. Now something can, so the portal offers them and she
 * unticks what she is not doing.
 *
 * A SAVED DAY ALWAYS WINS. Once she has said "this is my day", that is her
 * day - and a deal that arrived since then goes to the queue rather than
 * silently into her morning. Same rule as startingOrder(), and the reason this
 * cannot simply be "the first ten every time".
 */
export function openWithSuggestion(ids: string[], saved: string[] | null | undefined,
                                   howMany: number = SUGGEST,
                                   LINE = '__line__'): string[] {
  const all = (ids || []).filter(Boolean)
  if (saved && saved.length) {
    const above = saved.filter(id => all.includes(id))
    const rest = all.filter(id => !above.includes(id))
    return [...above, LINE, ...rest]
  }
  const n = Math.max(0, Math.min(howMany, all.length))
  return [...all.slice(0, n), LINE, ...all.slice(n)]
}

/**
 * THE WHOLE DRAFT, IN THE ORDER THE PORTAL SUGGESTS IT.
 *
 * draftDay() in lib/the-days-plan.ts has already done the two bands that are
 * people giving instructions - a rework sent back, then a broker's ask shared
 * one broker at a time. Both keep the order it put them in.
 *
 * Everything under them is the portal's own suggestion, and that is what gets
 * sorted: compliance, LO, BC, oldest first inside each.
 */
export function creditDay<T extends { rework?: any; priority?: any; stage?: any; since?: any }>(
  deals: T[],
): T[] {
  const all = deals || []
  const back = all.filter(d => d.rework)
  const asked = all.filter(d => !d.rework && d.priority)
  const rest = all.filter(d => !d.rework && !d.priority)
  return [...back, ...asked, ...byStageThenAge(rest)]
}

/** For the counter: "10 of 27 — the most anybody gets through". */
export function pickedWords(picked: number, all: number): string {
  if (all === 0) return 'nothing with you today'
  return `of ${all} — the most anybody gets through`
}
