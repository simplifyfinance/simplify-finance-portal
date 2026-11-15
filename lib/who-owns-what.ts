// WHOSE HOUSE IS IT, AND SAYING SO WITHOUT WRITING THE SAME SENTENCE THREE TIMES.
//
// 17 Nov 2026. The Analysis box wrote one sentence per property and every one
// of them opened the same way:
//
//   "They own 9 Pelham Pl ... It is valued at ... with $793,991 owing to ..."
//   "They own 14 Marrack St ... It is valued at ... with $395,899 owing to ..."
//   "They own 6 Dunmore Ln ... It is valued at ... with $278,000 owing to ..."
//
// Three times, word for word, only the numbers moving. Fabio's broker rewrote
// it as "Daniel owns ... He also owns ... He also owns ...", and credit's word
// for the whole note was "repetitive".
//
// TWO THINGS ARE WRONG WITH "THEY OWN". It is the same opener every time, and
// on a file where one applicant owns a house on their own it is not true. The
// fact find records an ownership percentage per applicant per property and
// nothing was reading it.
//
// ---------------------------------------------------------------------------
// A PRONOUN IS A RECORDED FACT HERE, OR IT IS NOT USED
// ---------------------------------------------------------------------------
//
// "He also owns" needs to know that Daniel is a he. The fact find has a gender
// box, so where it is filled in this is reading an answer. Where it is blank
// the name is repeated instead - "Daniel also owns" - because guessing somebody's
// pronoun from their first name on a document that goes to a lender is exactly
// the kind of invention this codebase keeps having to take back out.
import { ownersByPercent } from './property-checklist'

const txt = (v: any) => String(v ?? '').trim()

/** The first names of whoever holds this property, in applicant order. */
export function ownersOf(item: any, applicants: any[]): string[] {
  const line = ownersByPercent(item?.ownership, applicants || [])
  return line ? line.split(', ').filter(Boolean) : []
}

/** "he" / "she", or '' when the fact find does not say. */
export function pronounFor(applicant: any): string {
  const g = txt(applicant?.gender).toLowerCase()
  if (g === 'male' || g === 'm') return 'he'
  if (g === 'female' || g === 'f') return 'she'
  return ''
}

const andNames = (names: string[]): string =>
  names.length <= 1 ? (names[0] || '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/**
 * HOW A PROPERTY SENTENCE OPENS.
 *
 * `seen` is the owners of the property written just before this one. Same
 * owners twice in a row and it becomes "He also owns" - or "They also own",
 * or the name again where no pronoun is recorded. Different owners and it
 * names them, because that is the thing the reader needs to notice.
 */
export function ownsOpener(
  owners: string[], applicants: any[], previous: string[] | null,
): string {
  const same = previous !== null
    && previous.length === owners.length
    && previous.every((n, i) => n === owners[i])

  // NOBODY RECORDED. Unchanged from how this box has always read, because
  // naming a person the fact find does not name would be an invention.
  if (owners.length === 0) return same ? 'They also own' : 'They own'

  if (owners.length > 1) return same ? 'They also own' : `${andNames(owners)} own`

  const name = owners[0]
  if (!same) return `${name} owns`
  const who = (applicants || []).find((a: any) => txt(a?.firstName) === name)
  const p = pronounFor(who)
  return p ? `${p[0].toUpperCase()}${p.slice(1)} also owns` : `${name} also owns`
}

/**
 * AN ADDRESS WITHOUT THE COUNTRY.
 *
 * 17 Nov 2026, Fabio: off every address. The fact find's address lookup returns
 * ", Australia" on the end of everything, and a compliance note read by an
 * Australian lender about an Australian property does not need telling four
 * times which country it is in.
 */
export function plainAddress(address: any): string {
  return txt(address).replace(/,?\s*australia\s*$/i, '').replace(/\s*,\s*$/, '')
}
