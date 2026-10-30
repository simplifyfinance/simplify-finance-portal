import { BEING_PURCHASED, canBuyAndRefinance } from './securities'
import { isTopUp } from './top-up'

const txt = (v: unknown) => String(v ?? '').trim()

// WHICH HOUSE EACH SPLIT IS AGAINST, FILLED IN WHERE THERE IS ONLY ONE ANSWER.
//
// 29 Oct 2026. Fabio, on an Equity release + purchase: "I cannot link the new
// purchase to the security at the top." The screen was telling him "1 split not
// against any security - New purchase. Pick one on the split, or tick the
// property it belongs to", and the property it belongs to is the house he is
// buying, which has no tick box because nobody owns it yet.
//
// THE TAGGING WAS GATED ON THE WRONG QUESTION. It ran only on a top up, and
// "can this scenario buy a house as well as refinance one" is a different list:
// Equity release + purchase buys and is not a top up. So on that template the
// split seeded as "New purchase" never got pointed at the purchase, and the
// screen complained about it on every one of those deals.
//
// Two different rules live here and they are not gated the same way:
//
//   THE PURCHASE NAMES ITSELF, on any scenario that buys something. The split
//   that buys the house points at the reserved id, never at a property being
//   refinanced - that is the Alter Street fault of 15 Oct, where a purchase
//   loan parked on a house that was not buying anything printed 124%.
//
//   ONE TICKED SECURITY ANSWERS FOR THE REST, on a top up only. Asking
//   somebody to choose between one option is asking them to restate the only
//   answer available. It stays a top-up rule: on the other templates a split
//   with no security is a real question, not a foregone conclusion.
//
// NEVER OVERWRITES. A split that already names a house keeps it.
//
// Returns the new list, or null when there was nothing to fill in - so the
// caller can skip the state write rather than loop.
/**
 * WHICH SPLIT BUYS THE HOUSE. Returns -1 where there is none.
 *
 * THE TAG BEATS THE LABEL BEATS THE POSITION, the same order lib/securities.ts
 * reads them in, so the panel and the figures downstream can never disagree
 * about which split that is.
 *
 * POSITION IS LAST AND IT IS NOT A GUESS. The templates that buy and refinance
 * seed three splits - the loan being refinanced, the equity coming out, and the
 * one buying the house - and the New purchase panel has written into the third
 * by position since before the tag existed. A deal recorded that way has a
 * purchase split with an empty label and no tag, and reading it any other way
 * means the panel edits one split while everything else reads another.
 */
export function findPurchaseSplit(splits: any): number {
  const arr = Array.isArray(splits) ? splits : []
  const tagged = arr.findIndex(x => txt(x?.securityId) === BEING_PURCHASED)
  if (tagged >= 0) return tagged
  const named = arr.findIndex(x => /new purchase/i.test(txt(x?.label)))
  if (named >= 0) return named
  return arr.length > 2 ? 2 : -1
}

export function autoTagSplits(
  splits: any[], template: unknown, securityIds: unknown[],
): any[] | null {
  const list = Array.isArray(splits) ? splits : []
  const topUp = isTopUp(template)
  const buys = canBuyAndRefinance(template)
  if (!topUp && !buys) return null

  const ids = (securityIds || []).map(txt).filter(Boolean)
  const only = topUp && ids.length === 1 ? ids[0] : ''

  // THE SAME ANSWER THE FORM USES. 30 Oct 2026: this asked the label and the
  // form asked the label AND the position, so a purchase split with an empty
  // label was edited by the New purchase panel and left against no security by
  // this. One function now.
  const buyIdx = buys ? findPurchaseSplit(list) : -1

  let changed = false
  const next = list.map((sp, i) => {
    if (txt(sp?.securityId)) return sp
    if (i === buyIdx) {
      changed = true
      return { ...sp, securityId: BEING_PURCHASED }
    }
    if (!only) return sp
    changed = true
    return { ...sp, securityId: only }
  })
  return changed ? next : null
}
