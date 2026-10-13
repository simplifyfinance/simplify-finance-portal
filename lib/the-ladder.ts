// HOW FAR PACO HAS GOT ON ONE BANK.
//
// 13 Oct 2026. Fabio, looking at 370 lines read out of NAB's October policy
// and waiting for somebody to tick them one at a time: "I dont want to confirm
// everythign - a lot of this are factual so is there a way we cna start
// building the library and use the community-driven rationa of confirming
// these policies as we go while Paco has his tranning wheels on?"
//
// So the checking stopped being a gate and became a readout. Nothing is held
// back - a line is live the moment it is read, carrying its quote, and the
// badge says how checked the bank is rather than whether you may use it.
//
// FOUR RUNGS, PER BANK, NEVER OVERALL. NAB can be halfway up while ubank has
// never left the ground, and one number across twenty six banks would hide
// both facts.
//
// IT GOES BACKWARDS. A new document arrives with lines nobody has read, which
// is the truth about how checked Paco is, so the bank drops a rung. A document
// nobody has looked at in a year drops it too. A badge that only ever climbs
// is a badge that lies, and the whole value of this one is that somebody
// glancing at the library can believe it.
//
// AND IT IS NEVER A REWARD. There are no points, no streak and no button
// anywhere that says it helps Paco learn. The moment ticking a line feels like
// moving a badge along, somebody ticks a line to move the badge along, and we
// have built a machine for turning a wrong reading into a fact.
import { isGettingOld } from './policy-rules'

export type Rung = 'hangar' | 'ground' | 'wheels' | 'up'

/** Lowest first. The order is the ladder. */
export const RUNGS: readonly Rung[] = ['hangar', 'ground', 'wheels', 'up'] as const

export type Standing = {
  rung: Rung
  /** What the badge says. */
  label: string
  /** One plain sentence under it: why he is on this rung. */
  why: string
  documents: number
  checked: number
  waiting: number
}

export function rungLabel(r: Rung): string {
  return r === 'hangar' ? 'In the hangar'
    : r === 'ground' ? 'Ground school'
    : r === 'wheels' ? 'Training wheels on'
    : 'Wheels up'
}

type DocLike = { id?: any; last_checked_at?: any; supersedes?: any }
type RuleLike = { document_id?: any; status?: any }

const txt = (v: any): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim())

/**
 * Where Paco stands on one bank.
 *
 * Takes that bank's documents and that bank's rules and counts. It reads
 * nothing, fetches nothing and decides nothing about whether a rule is true -
 * it only reports how much of what we hold a person has actually looked at.
 */
export function whereIsPaco(docs: DocLike[], rules: RuleLike[], today: string): Standing {
  const ds = Array.isArray(docs) ? docs : []
  const rs = Array.isArray(rules) ? rules : []

  const checked = rs.filter(r => txt(r?.status) === 'live').length
  const waiting = rs.filter(r => txt(r?.status) === 'proposed').length
  const documents = ds.length

  const counts = { documents, checked, waiting }

  if (documents === 0) {
    return {
      rung: 'hangar', label: rungLabel('hangar'), ...counts,
      why: 'Nothing from this bank in writing. Paco answers from our own notes and says so.',
    }
  }

  if (checked === 0) {
    return {
      rung: 'ground', label: rungLabel('ground'), ...counts,
      why: waiting > 0
        ? `Read, but nobody has checked a line of it. ${waiting} waiting. He answers and shows the quote every time.`
        : 'Filed, but nothing has been read out of it yet.',
    }
  }

  if (waiting > 0) {
    return {
      rung: 'wheels', label: rungLabel('wheels'), ...counts,
      why: `${checked} checked, ${waiting} still waiting on a person.`,
    }
  }

  // NOTHING WAITING IS NOT THE SAME AS CURRENT. A document nobody has looked
  // at in a year holds him on the rung below, because he has not been checked
  // on what the bank has done since.
  const stale = ds.filter(d => isGettingOld(d?.last_checked_at, today))
  if (stale.length > 0) {
    return {
      rung: 'wheels', label: rungLabel('wheels'), ...counts,
      why: `${checked} checked, but ${stale.length === 1 ? 'the document has' : `${stale.length} documents have`} not been looked at in a year.`,
    }
  }

  return {
    rung: 'up', label: rungLabel('up'), ...counts,
    why: `Checked right through — ${checked} lines. He answers straight, quote on request.`,
  }
}

/** Which colour the badge wears, in the portal's own four. Never amber. */
export function rungTone(r: Rung): 'quiet' | 'info' | 'done' {
  return r === 'hangar' || r === 'ground' ? 'quiet' : r === 'wheels' ? 'info' : 'done'
}

/** Lowest rung first, so the library can lead with the banks that need work. */
export function byRung(a: Rung, b: Rung): number {
  return RUNGS.indexOf(a) - RUNGS.indexOf(b)
}
