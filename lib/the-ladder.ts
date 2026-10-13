// HOW FAR PACO HAS GOT ON ONE BANK.
//
// 13 Oct 2026. Fabio, after watching 455 lines land in a review list:
//
//   "a lot of these are statements. Just it really is reading. Like, why do I
//   need to confirm? So that needs to go... the point of all this is just
//   slowly, continually, community-based build the knowledge and database...
//   I don't want it to be arduous and time consuming."
//
// So the ticking went, and this went with it. The rungs used to count how much
// of a document somebody had confirmed, which only made sense while confirming
// was a job. Nobody confirms anything now - a line read out of a document is in,
// carrying the sentence it came from, and that quote is the check.
//
// WHAT THE RUNGS COUNT INSTEAD IS WHAT PACO CAN ANSWER FROM, and there are two
// kinds: what the bank wrote down, and what we have learned. They are different
// things and the ladder is the order of their worth.
//
//   nothing            - he can say nothing at all
//   only our own       - hearsay, with names on it, and no manual behind it
//   the bank's own     - the document is in
//   both               - the document, and what we have seen on top of it
//
// A bank with only team notes is a real and common state, and before this it
// looked identical to a bank with nothing. It is not: it means somebody knows
// something and nobody has got the manual yet.
//
// IT STILL GOES BACKWARDS, and that still matters. Retire the last note on a
// bank and it drops. A badge that only ever climbs is a badge that lies.
//
// AND IT IS NEVER A REWARD. No points, no streak, and no button anywhere that
// says it helps Paco learn. It is a readout of what he holds.

export type Rung = 'hangar' | 'ground' | 'wheels' | 'up'

/** Lowest first. The order is the ladder. */
export const RUNGS: readonly Rung[] = ['hangar', 'ground', 'wheels', 'up'] as const

export type Standing = {
  rung: Rung
  /** What the badge says. */
  label: string
  /** One plain sentence under it. */
  why: string
  documents: number
  /** Lines read out of the bank's own documents. */
  fromTheBank: number
  /** Things people here have told him, still standing. */
  fromUs: number
}

export function rungLabel(r: Rung): string {
  return r === 'hangar' ? 'In the hangar'
    : r === 'ground' ? 'Ground school'
    : r === 'wheels' ? 'Training wheels on'
    : 'Wheels up'
}

type DocLike = { id?: any }
type RuleLike = { status?: any }
type NoteLike = { retired_at?: any; retiredAt?: any }

const txt = (v: any): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim())

/** A line somebody looked at and said was wrong is not an answer any more. */
const stands = (r: any): boolean => txt(r?.status) !== 'rejected'

/** A note that has been retired stays readable, but stops answering. */
const standing = (n: any): boolean => !txt(n?.retired_at) && !txt(n?.retiredAt)

/**
 * Where Paco stands on one bank.
 *
 * Takes that bank's documents, the lines read out of them, and what the team
 * has told him. It counts. It reads nothing and decides nothing about whether
 * any of it is true.
 */
export function whereIsPaco(docs: DocLike[], rules: RuleLike[], notes: NoteLike[] = []): Standing {
  const documents = (Array.isArray(docs) ? docs : []).length
  const fromTheBank = (Array.isArray(rules) ? rules : []).filter(stands).length
  const fromUs = (Array.isArray(notes) ? notes : []).filter(standing).length

  const counts = { documents, fromTheBank, fromUs }
  const ours = fromUs === 1 ? '1 thing we have told him' : `${fromUs} things we have told him`
  const theirs = fromTheBank === 1 ? '1 line' : `${fromTheBank} lines`

  if (fromTheBank === 0 && fromUs === 0) {
    return {
      rung: 'hangar', label: rungLabel('hangar'), ...counts,
      why: documents > 0
        ? 'A document is on file but nothing has been read out of it yet.'
        : 'Nothing from this bank, and nothing from us. He says so rather than guessing.',
    }
  }

  if (fromTheBank === 0) {
    return {
      rung: 'ground', label: rungLabel('ground'), ...counts,
      why: `Only ${ours}, with their names on. Nothing the bank has written down.`,
    }
  }

  if (fromUs === 0) {
    return {
      rung: 'wheels', label: rungLabel('wheels'), ...counts,
      why: `${theirs} out of the bank's own ${documents === 1 ? 'document' : 'documents'}. Nothing from us yet.`,
    }
  }

  return {
    rung: 'up', label: rungLabel('up'), ...counts,
    why: `${theirs} from the bank, and ${ours} on top.`,
  }
}

// A COLOUR A RUNG, IN THE PORTAL'S OWN FOUR. Never amber.
//
// Purple is what one of us said; blue is what the bank wrote. Those are the
// two colours Paco already answers in, so the tile and the answer agree.
export function rungTone(r: Rung): 'quiet' | 'waiting' | 'info' | 'done' {
  return r === 'hangar' ? 'quiet' : r === 'ground' ? 'waiting' : r === 'wheels' ? 'info' : 'done'
}

/** Lowest rung first, so the banks he can say least about come up the top. */
export function byRung(a: Rung, b: Rung): number {
  return RUNGS.indexOf(a) - RUNGS.indexOf(b)
}
