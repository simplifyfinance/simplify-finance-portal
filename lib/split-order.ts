// THE ORDER THE COMMISSION SPLITS ARE OFFERED IN.
//
// 28 Oct 2026. Fourteen arrangements in one alphabetical list, every line
// repeating the name and spelling out "upfront" and "trail", and no way to find
// anything. Fabio: "it's very, very messy... my team is getting lost."
//
// He then gave the order himself, which is the only order worth having: the
// ones they actually use, in the sequence they reach for them.
//
//   1. Simplify only                      not sharing with anybody
//   2. Simplify Justin Cornock referral
//   3. Simplify Kenan Wood referral
//   4. Navigate Advisors
//   5. the three Simplify broker splits   Justin, Kenan, Luke
//   6. everything else                    folded away until somebody asks
//
// MATCHED ON WORDS, NOT ON AN EXACT NAME. The list lives in a database table
// people rename things in. "Simplify Broker Split - Justin Cornock" and
// "Simplify broker — Justin" are the same arrangement, and an exact-name list
// would quietly drop one of them to the bottom the first time somebody tidied
// the wording.
//
// AND AN UNMATCHED ONE IS NOT A FAULT. Fabio: "anything else that is added
// sits on the expansion pack." A new arrangement nobody has told this file
// about appears in the folded group, alphabetically, which is exactly where a
// rarely-used one belongs.

const txt = (v: any) => String(v ?? '').trim()

/** Lower case, punctuation gone, single spaces - so wording changes do not matter. */
export function normalise(name: any): string {
  return txt(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * THE ORDER, AS WORDS THAT ALL HAVE TO APPEAR.
 *
 * Each entry is a set of words. A split matches when its name contains every
 * word in the set. First match wins, so the referrals sit above the broker
 * splits even though both carry a first name.
 *
 * To change the order, move a line. To add one, write the words that pick it
 * out. Nothing else in the portal has to know.
 */
export const PINNED_ORDER: string[][] = [
  ['justin', 'referral'],
  ['kenan', 'referral'],
  ['navigate'],
  ['broker', 'justin'],
  ['broker', 'kenan'],
  ['broker', 'luke'],
]

/** Where this name sits in PINNED_ORDER, or -1 where it is not pinned. */
export function pinnedRank(name: any): number {
  const n = normalise(name)
  if (!n) return -1
  for (let i = 0; i < PINNED_ORDER.length; i++) {
    if (PINNED_ORDER[i].every(word => n.includes(word))) return i
  }
  return -1
}

export type Ordered<T> = {
  /** Shown straight away, in Fabio's order. */
  shown: T[]
  /** Folded away until somebody presses. Alphabetical. */
  rest: T[]
}

/**
 * SPLIT THE LIST INTO THE ONES THEY USE AND THE ONES THEY DO NOT.
 *
 * `nameOf` because this is used on two slightly different shapes and a second
 * copy of the ordering is the one thing this file exists to prevent.
 */
export function inOrder<T>(items: T[], nameOf: (x: T) => string): Ordered<T> {
  const shown: Array<{ rank: number; item: T }> = []
  const rest: T[] = []

  for (const item of items || []) {
    const rank = pinnedRank(nameOf(item))
    if (rank >= 0) shown.push({ rank, item })
    else rest.push(item)
  }

  // TWO THINGS MATCHING THE SAME RULE KEEP A STABLE ORDER between them, so the
  // list does not reshuffle itself between page loads.
  shown.sort((a, b) => a.rank - b.rank)
  rest.sort((a, b) => nameOf(a).localeCompare(nameOf(b)))

  return { shown: shown.map(s => s.item), rest }
}

/**
 * THE TERMS, IN AS FEW CHARACTERS AS WILL CARRY THEM.
 *
 * It used to read "Aspire Partners — Aspire Partners 20% upfront, 20% trail":
 * the name twice, then two words everybody in the business already knows. The
 * name is on the line already, so this is the numbers and nothing else.
 *
 * "20 / 20" is upfront then trail. Where every line of a split pays the same,
 * it is said once with "each" rather than repeated down the row.
 */
export function termsShort(lines: Array<{ who?: string; upfront: number | null; trail: number | null }>): string {
  const real = (lines || []).filter(l => l && (l.upfront !== null || l.trail !== null))
  if (real.length === 0) return ''

  const pair = (l: { upfront: number | null; trail: number | null }) =>
    l.upfront !== null && l.trail !== null ? `${l.upfront} / ${l.trail}`
      : l.upfront !== null ? `${l.upfront} upfront`
      : `${l.trail} trail`

  const first = pair(real[0])
  if (real.length === 1) return first
  // Everybody on the same terms is one figure, not the same figure three times.
  return real.every(l => pair(l) === first) ? `${first} each`
    : real.map(l => `${txt(l.who).split(' ')[0] || '?'} ${pair(l)}`).join(' · ')
}
