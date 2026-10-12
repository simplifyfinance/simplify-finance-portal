import { readMoney } from './money'

// WHICH SPLITS THE OFFSET ACCOUNTS SIT AGAINST.
//
// 12 Oct 2026. The tick was stored by the split's NAME. On a complex refinance
// with three houses the same two names repeat on each one -
//
//   Existing Investment Home loan      16 Spring Street
//   Investment equity loan split       16 Spring Street
//   Existing Investment Home loan      7/22-26 Russell Street
//   Investment equity loan split       7/22-26 Russell Street
//   Existing Investment Home loan      14/22-26 Russell Street
//   Investment equity loan split       14/22-26 Russell Street
//
// - so ticking one ticked all three, and the client email, which lists the
// names and removes duplicates, said "Your offset account sits against
// Investment equity loan split" with nothing to say which house. A client with
// one offset was told about one offset against three different loans.
//
// IT IS KEYED BY POSITION NOW, NOT BY NAME. Position because a borrowing
// capacity split has no id of its own, and giving it one would change the key
// that compliance_data.splitDetail already files the term, the product type and
// the interest only years under - throwing all three away on every deal written
// so far. A position is stable for as long as the list is, and removeSplit()
// moves the ticks when the list is not.
//
// NO DEAL CHANGES ITS MEANING ON ITS OWN. A record saved before today holds
// names, and names are still read: each one still selects every split that
// carries it, which is exactly what it did yesterday. It is wrong in the same
// way it was wrong, rather than quietly becoming right and telling a client
// something different from what the file says. Re-ticking it on the form fixes
// it, and that is a person's decision.
//
// NOTHING HERE TOUCHES REACT.

const txt = (v: any) => String(v ?? '').trim()
const num = (v: any) => readMoney(v) ?? 0

export type OffsetSplit = { split: any; index: number }

/** The splits with money in them - the only ones the form ever offers. */
function realOnes(bc: any): { split: any; index: number }[] {
  const list: any[] = Array.isArray(bc?.splits) ? bc.splits : []
  return list.map((split, index) => ({ split, index })).filter(r => num(r.split?.amount) > 0)
}

/**
 * The splits carrying an offset, in the order the splits are in - the email
 * lists them beside figures that are already in that order.
 */
export function chosenOffsetSplits(bc: any): OffsetSplit[] {
  const rows = realOnes(bc)
  const byIdx = bc?.offsetSplitIdx

  // The way it is recorded from today.
  if (Array.isArray(byIdx)) {
    const want = new Set(byIdx.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n)))
    return rows.filter(r => want.has(r.index))
  }

  // And the way it was recorded before: a list of names, or the single name
  // that shipped for one morning in October.
  const raw: any[] = Array.isArray(bc?.offsetSplits) ? bc.offsetSplits : [bc?.offsetSplit]
  const names = new Set(raw.map(txt).filter(Boolean))
  if (names.size === 0) return []
  return rows.filter(r => names.has(txt(r.split?.label)))
}

/** Is this split ticked? Asked per row by the form. */
export function offsetIsOn(bc: any, index: number): boolean {
  return chosenOffsetSplits(bc).some(r => r.index === index)
}

/** The list after ticking or unticking one row. Always positions. */
export function toggleOffset(bc: any, index: number): number[] {
  const on = chosenOffsetSplits(bc).map(r => r.index)
  return on.includes(index) ? on.filter(i => i !== index) : [...on, index].sort((a, b) => a - b)
}

/**
 * The ticks after a split is removed from the list.
 *
 * Everything after the hole moves up one, and the removed split's own tick goes
 * with it. Without this the offsets would silently slide onto the wrong loans.
 */
export function offsetsAfterRemoving(bc: any, removed: number): number[] {
  return chosenOffsetSplits(bc)
    .map(r => r.index)
    .filter(i => i !== removed)
    .map(i => (i > removed ? i - 1 : i))
}

// --- naming them ------------------------------------------------------------

// The address of the house a split sits against, from the snapshot the form
// writes onto the borrowing capacity. Read here rather than imported from
// lib/complex-refinance.ts, which reads this file's neighbours - two modules
// importing each other is how a bundle ends up with one of them undefined.
function addressOf(bc: any, split: any): string {
  const id = txt(split?.securityId)
  if (!id) return txt(split?.property)
  const list: any[] = Array.isArray(bc?.ffProperties) ? bc.ffProperties : []
  const hit = list.find(p => txt(p?.id) === id)
  return hit ? txt(hit.address) : ''
}

/** How many different houses the splits sit against. */
function houseCount(bc: any): number {
  const ids = realOnes(bc).map(r => txt(r.split?.securityId)).filter(Boolean)
  return new Set(ids).size
}

/**
 * What to call each ticked split in a sentence.
 *
 * On a deal with one house the name on its own is enough and always was. On a
 * deal with several, the name alone is ambiguous - and silently de-duplicating
 * the repeats is what told a client about one offset instead of three.
 */
export function offsetNames(bc: any): string[] {
  const many = houseCount(bc) > 1
  const out: string[] = []
  for (const r of chosenOffsetSplits(bc)) {
    const label = txt(r.split?.label)
    if (!label) continue
    const addr = many ? addressOf(bc, r.split) : ''
    const name = addr ? `${label} on ${addr}` : label
    if (!out.includes(name)) out.push(name)
  }
  return out
}
