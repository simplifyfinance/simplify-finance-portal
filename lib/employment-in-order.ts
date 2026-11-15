// EMPLOYMENT, READ IN DATE ORDER.
//
// 17 Nov 2026. A compliance note read "with a previous role ending in May
// 2025" on a file where the role before the current one ended on 6 November
// 2026. Nothing was wrong with the data. lib/box-four.ts said:
//
//     const prev = (a.employment || []).find(e => !e.isCurrent && e.endDate)
//
// and find() takes the FIRST one in the list. The list is in the order the
// boxes were filled in, and on that file the 2023-2025 job had been typed
// before the 2025-2026 one. "Previous employer #1" means typed first. It has
// never meant most recent, and the note was reading it as though it did.
//
// Fabio: "the portal is not adjusting chronologically so AI notes confused the
// previous employment supposed to be 2026".
//
// THE FORM WAS SAYING THE SAME WRONG THING. A person reading the fact find saw
// the older job sitting above the newer one under a heading numbered #1, so the
// screen gave the same impression the note did. Both are fixed from here: the
// note sorts before it picks, and the form shows the history in order.
//
// ---------------------------------------------------------------------------
// AND THE DATES THAT CANNOT BE RIGHT
// ---------------------------------------------------------------------------
//
// Sorting a wrong date only sorts it. Three checks, agreed 17 Nov 2026 - a date
// in the future, an end date before its own start, and two roles overlapping.
// A GAP IS NOT ONE OF THEM: leaving one job in March and starting the next in
// June is an ordinary thing a broker explains to a lender, and warning on it
// every time would teach everybody to ignore the warnings.
import { notWorking } from './fact-find'

const txt = (v: any) => String(v ?? '').trim()

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/**
 * A DATE, IN WHATEVER WAY IT WAS STORED - AND NOTHING ELSE.
 *
 * The pickers write "2026-11-06". Older records and pasted ones hold
 * "06/11/2026", which is 6 November here and 11 June to `new Date()`, so the
 * Australian order is read explicitly rather than left to the browser. Some
 * older fields only ever held a month and a year ("Mar 2019"), which is read as
 * the first of that month.
 *
 * NOTHING ELSE IS PARSED, AND new Date() IS NEVER THE FALLBACK. Handed
 * "sometime in 2019", V8 returns 1 January 2019 - a date nobody typed, which
 * would then sort a role and print on a document that goes to a lender. Any
 * other shape is null: never today, never zero, never a guess.
 */
export function when(v: any): number | null {
  const raw = txt(v)
  if (!raw) return null
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]|$)/)
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3])
  const au = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (au) return Date.UTC(+au[3], +au[2] - 1, +au[1])
  const my = raw.match(/^(\d{1,2})\/(\d{4})$/)
  if (my) return Date.UTC(+my[2], +my[1] - 1, 1)
  const word = raw.match(/^([A-Za-z]{3,9})\s+(\d{4})$/)
  if (word) {
    const m = MONTHS.indexOf(word[1].slice(0, 3).toLowerCase())
    if (m >= 0) return Date.UTC(+word[2], m, 1)
  }
  return null
}

export type Role = { isCurrent?: boolean; startDate?: any; endDate?: any; [k: string]: any }

const isPast = (e: Role) => !e?.isCurrent

/**
 * NEWEST FIRST, CURRENT ROLES ABOVE FINISHED ONES.
 *
 * A stable sort on a copy: two roles that cannot be told apart by date keep the
 * order somebody typed them in, which is the only order left that means
 * anything. The list handed in is never touched.
 */
export function inDateOrder(employment: Role[] | null | undefined): Role[] {
  const all = [...(employment || [])]
  const rank = (e: Role) => (isPast(e) ? 1 : 0)
  const key = (e: Role) => (isPast(e) ? when(e.endDate) : when(e.startDate))
  return all
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const r = rank(a.e) - rank(b.e)
      if (r !== 0) return r
      const ka = key(a.e)
      const kb = key(b.e)
      // A role with no date sorts below the dated ones rather than to the top.
      if (ka === null && kb === null) return a.i - b.i
      if (ka === null) return 1
      if (kb === null) return -1
      return kb - ka || a.i - b.i
    })
    .map(x => x.e)
}

/** True when sorting would actually move something. */
export function outOfOrder(employment: Role[] | null | undefined): boolean {
  const now = employment || []
  const sorted = inDateOrder(now)
  return sorted.some((e, i) => e !== now[i])
}

/** The current roles, the one held longest first. */
export function currentRoles(applicant: any): Role[] {
  return inDateOrder((applicant?.employment || []).filter((e: Role) => e?.isCurrent))
}

/** The job they are actually in, ignoring a "not working" row. */
export function currentRole(applicant: any): Role | null {
  const on = currentRoles(applicant)
  return on.find(e => !notWorking(e)) || null
}

/**
 * THE ROLE BEFORE THIS ONE - the whole point of this file.
 *
 * Most recent end date wins. A previous role with no end date recorded cannot
 * be the most recent one, because nothing says when it stopped.
 */
export function roleBefore(applicant: any): Role | null {
  const past = (applicant?.employment || []).filter((e: Role) => isPast(e) && txt(e?.endDate))
  return inDateOrder(past)[0] || null
}

export type DateProblem = { what: string; role: string }

const named = (e: Role) =>
  txt(e?.employerName) || txt(e?.employer) || txt(e?.occupation) || 'a role'

/** Two periods overlap when each starts before the other ends. */
function overlaps(a: Role, b: Role): number | null {
  const as = when(a.startDate)
  const ae = when(a.endDate)
  const bs = when(b.startDate)
  const be = when(b.endDate)
  if (as === null || ae === null || bs === null || be === null) return null
  const from = Math.max(as, bs)
  const to = Math.min(ae, be)
  return to > from ? Math.round((to - from) / 2592000000) : null
}

/**
 * DATES THAT CANNOT BE RIGHT. Never a block - these go on the list above the
 * note, where somebody can see them and keep working.
 */
export function dateProblems(applicant: any, today = new Date()): DateProblem[] {
  const all = (applicant?.employment || []) as Role[]
  const now = today.getTime()
  const out: DateProblem[] = []

  for (const e of all) {
    const s = when(e.startDate)
    const en = when(e.endDate)
    if (s !== null && s > now) out.push({ what: 'starts in the future', role: named(e) })
    if (en !== null && en > now) out.push({ what: 'ends in the future', role: named(e) })
    if (s !== null && en !== null && en < s) {
      out.push({ what: 'ends before it starts', role: named(e) })
    }
  }

  // SECONDARY EMPLOYMENT IS NOT AN OVERLAP. Two jobs at once is a recorded
  // answer on this form, and a warning on it would be the portal arguing with
  // something somebody deliberately typed.
  const primary = all.filter(e => !/secondary/i.test(txt(e?.employmentPriority)))
  for (let i = 0; i < primary.length; i++) {
    for (let j = i + 1; j < primary.length; j++) {
      const months = overlaps(primary[i], primary[j])
      if (months && months > 0) {
        out.push({
          what: `overlaps ${named(primary[j])} by ${months} month${months === 1 ? '' : 's'}`,
          role: named(primary[i]),
        })
      }
    }
  }
  return out
}

/** "Kerrand Civil ends before it starts", for the list above the note. */
export function problemLine(p: DateProblem): string {
  return `${p.role} ${p.what}`
}
