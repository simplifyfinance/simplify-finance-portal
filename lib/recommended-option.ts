// WHICH OPTION WAS RECOMMENDED - not which BANK.
//
// Fabio, 16 Sep 2026, on William Welton: "we recommended 2 products both
// Bankwest, one simple and one package, we selected simple but the HTML is
// recommending both."
//
// It was. The dropdown showed "Bankwest - Simple" and "Bankwest - Package" but
// its value was only ever `lenderName`, so both choices saved the same four
// letters. Sixteen places then asked each option "are you Bankwest?" and both
// said yes. The client email starred both columns, which is what the processing
// team saw.
//
// The quieter half of the same bug is worse. Most of those sixteen do not ask
// "which ones", they do `.find(l => l.lenderName === recommendedLender)` and take
// the FIRST match - so the compliance wording, the rates in the client email, the
// loan structure, the summary PDF and the handover sheet could all be describing
// the Package while the broker had chosen the Simple. Nothing says so.
//
// So the recommendation now points at an OPTION. Every option carries a stable
// id, the dropdown saves that id, and this file is the only place that turns a
// saved record into "this one".
//
// OLD RECORDS HAVE NO IDS, and this has to keep working for them: the email route
// and the PDF route read lo_data straight out of the database, and nothing
// backfills an id until somebody opens the LO tab. So the name is still read as a
// fallback - but ONLY where it picks out exactly one option. Where two options
// share a bank and there is no id, the answer is "we do not know", never a guess,
// because a guess here prints a real rate against the wrong product.

const txt = (v: any) => String(v ?? '').trim()

export type LenderLike = { id?: string; lenderName?: string; productName?: string; [k: string]: any }
export type LoLike = {
  lenders?: LenderLike[]
  recommendedOptionId?: string
  recommendedLender?: string
  [k: string]: any
}

function options(lo: LoLike): LenderLike[] {
  return Array.isArray(lo?.lenders) ? lo.lenders : []
}

// Every option that carries the saved lender name. One is an answer; two is a
// question.
function byName(lo: LoLike): LenderLike[] {
  const want = txt(lo?.recommendedLender)
  if (!want) return []
  return options(lo).filter(l => txt(l?.lenderName) === want)
}

// THE ONE THAT WAS CHOSEN, or null. Never a guess between two.
export function recommendedOption(lo: LoLike): LenderLike | null {
  if (!lo) return null
  const id = txt(lo.recommendedOptionId)
  if (id) {
    const hit = options(lo).find(l => txt(l?.id) === id)
    // An id that matches nothing means the option was deleted. Fall through to
    // the name rather than reporting a recommendation that is not on the list.
    if (hit) return hit
  }
  const named = byName(lo)
  return named.length === 1 ? named[0] : null
}

// Two options share the bank, and nothing recorded which one. The LO form says so
// out loud; everything else treats it as "not chosen yet" and shouts NOT RECORDED
// in its own words, which is what this portal does everywhere else rather than
// print a figure it cannot stand behind.
export function recommendationIsAmbiguous(lo: LoLike): boolean {
  if (!lo) return false
  // Resolved is resolved, however it got there.
  if (recommendedOption(lo)) return false
  return byName(lo).length > 1
}

// Is THIS option the recommended one? Identity first, so two rows that happen to
// share a name are never both true.
export function isRecommended(lo: LoLike, option: LenderLike): boolean {
  const rec = recommendedOption(lo)
  if (!rec || !option) return false
  const a = txt(rec.id), b = txt(option.id)
  if (a && b) return a === b
  // No ids on either side: these came from the same array, so sameness is
  // identity, not a string compare.
  return rec === option
}

// "Bankwest — Simple Home Loan", so nobody has to work out which Bankwest.
export function recommendedLabel(lo: LoLike): string {
  const rec = recommendedOption(lo)
  if (rec) {
    const name = txt(rec.lenderName), product = txt(rec.productName)
    return name && product ? `${name} — ${product}` : (name || product)
  }
  return txt(lo?.recommendedLender)
}

// The recommended option first, everything else in the order it was entered.
// A plain boolean comparator, so two options from the same bank cannot both
// claim the front.
export function recommendedFirst<T extends LenderLike>(lo: LoLike, list: T[]): T[] {
  const rec = recommendedOption(lo)
  if (!rec) return list
  return [...list].sort((a, b) =>
    (isRecommended(lo, b) ? 1 : 0) - (isRecommended(lo, a) ? 1 : 0))
}
