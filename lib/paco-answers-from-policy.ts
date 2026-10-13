// PACO ANSWERS FROM THE LENDER'S OWN POLICY FIRST.
//
// 13 Oct 2026. The documents went in, the rules are read out and ticked, and
// they have been sitting in a table doing nothing. This is the half that makes
// them worth having.
//
// THE ONE RULE EVERYTHING HANGS OFF, from the blueprint and from docs/paco.md:
//
//   Official written lender policy outranks everything else, and internal
//   experience never silently overwrites official policy.
//
// Both halves matter and the second is the one that is easy to get wrong. A
// team note is not demoted to a footnote and it is not hidden - it is shown
// ALONGSIDE, with its own name and date, because "Macquarie's manual says 80%"
// and "Sam got one through at 85% in March" are both true and a broker needs
// both. What must never happen is the note reading as though it were the
// policy.
import type { PolicyRule } from './policy-rules'

const txt = (v: any): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim())
const day = (v: any): string => txt(v).slice(0, 10)

// Lower is firmer. A is the lender's own manual; D is what we have seen.
const RANK: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 }
export const rankOfTier = (t: any): number => RANK[txt(t).toUpperCase()] ?? 9

export type Answer = {
  /** Lender policy, firmest first. */
  policy: PolicyRule[]
  /** Rules with a start date that has not arrived. Said, not hidden. */
  coming: PolicyRule[]
  /** What the team has told him, shown with the policy and never instead. */
  notes: any[]
  /** Something official and something internal that do not agree. */
  disagrees: boolean
}

/**
 * Everything Paco has on this question, in the order he should say it.
 *
 * Takes rows and gives rows. It does not fetch, it does not format, and it
 * does not decide what is true - where two things disagree it says so and
 * shows both, which is the blueprint's escalation and the honest answer in a
 * four person office.
 */
export function answerFrom(
  rules: PolicyRule[], notes: any[], today: string,
): Answer {
  const live: PolicyRule[] = []
  const coming: PolicyRule[] = []

  for (const r of Array.isArray(rules) ? rules : []) {
    if (txt(r?.status) !== 'live') continue
    const from = day(r?.effectiveFrom), to = day(r?.effectiveTo), now = day(today)
    // LENDERS ANNOUNCE IN OCTOBER FOR NOVEMBER. A rule that has not started is
    // held and said to be coming, with its date - "nothing recorded" and
    // "something that starts in three weeks" are different answers.
    if (from && from > now) { coming.push(r); continue }
    if (to && to <= now) continue
    live.push(r)
  }

  live.sort((a, b) =>
    rankOfTier(a.tier) - rankOfTier(b.tier) ||
    day(b.effectiveFrom).localeCompare(day(a.effectiveFrom)))
  coming.sort((a, b) => day(a.effectiveFrom).localeCompare(day(b.effectiveFrom)))

  // DISAGREEING IS NOT ABOUT THE WORDS. Paco does not read two sentences and
  // decide whether they contradict - he has no business doing that. It is
  // simply that something official and something internal are both on record
  // for this question, which is exactly when a person should read both.
  const official = live.some(r => rankOfTier(r.tier) <= 1)
  const internal = (Array.isArray(notes) ? notes : []).length > 0
  return { policy: live, coming, notes: Array.isArray(notes) ? notes : [], disagrees: official && internal }
}

/** What a rule shows as its source: a sentence, or the row it came out of. */
export function sourceOf(r: any): { quote: string } | { headers: string[]; cells: string[] } | null {
  const cells = Array.isArray(r?.rowCells) ? r.rowCells.map(txt).filter(Boolean) : []
  const headers = Array.isArray(r?.rowHeaders) ? r.rowHeaders.map(txt) : []
  if (cells.length > 0 && headers.length === cells.length) return { headers, cells }
  const q = txt(r?.quote)
  return q ? { quote: q } : null
}

/** "Not verified - check with the lender or BDM", and what exactly to check. */
export function whatToCheck(a: Answer, subject: string): string {
  if (a.policy.length > 0) return ''
  if (a.coming.length > 0) {
    return `Nothing in force yet. A rule starting ${day(a.coming[0].effectiveFrom)} is recorded.`
  }
  if (a.notes.length > 0) {
    return `Not verified — only our own experience is recorded${subject ? ` on ${subject}` : ''}. Check with the lender or BDM.`
  }
  return `Nothing recorded${subject ? ` on ${subject}` : ''}. Check with the lender or BDM.`
}

/** The line that goes above a team note when policy is showing too. */
export const NOTE_BESIDE_POLICY =
  'Our own experience, alongside the policy above. It does not change it.'
