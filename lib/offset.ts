// DOES THIS PRODUCT HAVE AN OFFSET ACCOUNT? ONE RULE, ONE PLACE.
//
// 17 Sep 2026, Emma and Joshua Byrnes. The lender library has MA Money's
// Residential Prime Alt Doc ticked as having an offset AND multiple offsets, so
// the Lending Options tab recorded the words "Yes - multiple offsets". The
// compliance write-up tested that box for the single word "yes", did not find
// it, and told the credit team the product does not include an offset account -
// in the same paragraph that said the clients had asked for one.
//
// The portal had three different answers to the same question: the lender
// comparison and the product requirements panel treated anything that was not
// "No" as a yes, and the write-up wanted the exact word. This file is now the
// only place that decides, and everything asks it.
//
// AND SILENCE IS NOT A NO. A box nobody has filled in does not mean the product
// has no offset - it means nobody has said. The write-up may not claim either
// way from a blank, the same rule we already hold on repayments and on LMI.

const txt = (v: any) => String(v ?? '').trim()

export type OffsetAnswer = 'yes' | 'no' | 'unknown'

// Words that mean nobody has answered. "-" and an em dash are what an empty
// library field prints as, and they arrive here as text like anything else.
const NOTHING = /^(-+|–|—|n\/a|na|tbc|tba|unknown|not\s+(recorded|specified|stated|known))$/i

// Words that mean no. Anchored at the start so "No offset on this product" is a
// no, while "Normal offset" is not caught by the bare "no".
const NEGATIVE = /^(no\b|none\b|nil\b|false\b|0$|not\s+(available|offered|applicable|included|on\s+this))/i

export function offsetAnswer(v: any): OffsetAnswer {
  const s = txt(v)
  if (!s || NOTHING.test(s)) return 'unknown'
  if (NEGATIVE.test(s)) return 'no'
  // "Yes", "Yes - multiple offsets", "Yes, one per loan account", "Available",
  // "100% offset" - every way anyone has written it down means the same thing.
  return 'yes'
}

// The product has an offset account.
export function hasOffset(v: any): boolean {
  return offsetAnswer(v) === 'yes'
}

// Somebody has answered the question, either way. Not the same as hasOffset:
// this is what stands between a blank box and a sentence claiming a fact.
export function offsetRecorded(v: any): boolean {
  return offsetAnswer(v) !== 'unknown'
}
