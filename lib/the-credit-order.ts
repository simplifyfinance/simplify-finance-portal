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
// THE SUGGESTION IS THE ORDER, NOT THE SELECTION
// ---------------------------------------------------------------------------
//
// 17 Nov 2026. The screen opened with ten ticked. Fabio, looking at it: "we
// would need tick 10 things remeber max things you cna do a day 4-5... all
// boxes next to it a unticked so when we tick starts arranging in order THEN
// we confirm this is my day."
//
// So nothing is ticked for her. What the portal offers is the ORDER she should
// read the list in - compliance first, because that is a deal this week - and
// she ticks what she is actually doing. A screen that ticks ten things on
// somebody's behalf has decided their morning for them, and ten is twice what
// anybody finishes.

/** Closest to a lodged deal first. Anything unrecognised sorts last. */
export const CREDIT_STAGES = ['Compliance', 'LO', 'BC', 'Fact Find'] as const
export type CreditStage = typeof CREDIT_STAGES[number]

/**
 * HOW MANY ARE TICKED WHEN SHE ARRIVES. None of them.
 *
 * Deliberately a number rather than a removed argument: the day opening with
 * nothing ticked is a decision somebody made on 17 Nov 2026, and it should be
 * readable as one.
 */
export const PRE_TICKED = 0

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
 * WHERE A CREDIT ASSESSOR'S DAY OPENS. EMPTY.
 *
 * Everything below the line, and she ticks what she is doing. For a day in
 * November it opened with ten already ticked; that was taken out on 17 Nov
 * 2026 because ten is twice what anybody finishes and because deciding
 * somebody's morning for them is not the portal's job. The portal decides the
 * ORDER she reads the list in. See the top of this file.
 *
 * A SAVED DAY ALWAYS WINS. Once she has said "this is my day", that is her
 * day - and a deal that arrived since then goes to the queue rather than
 * silently into her morning. Same rule as startingOrder(), and the reason this
 * cannot simply be "the first ten every time".
 */
export function openWithSuggestion(ids: string[], saved: string[] | null | undefined,
                                   howMany: number = PRE_TICKED,
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

/**
 * FOR THE COUNTER: "4 of 27 — most people get through four or five".
 *
 * It says what a day looks like, and it never says she has picked too many.
 * 17 Nov 2026, Fabio: "max things you cna do a day 4-5". An eleventh tick is
 * her call and the counter stays out of it.
 */
export function pickedWords(picked: number, all: number): string {
  if (all === 0) return 'nothing with you today'
  return `of ${all} — most people get through four or five`
}
