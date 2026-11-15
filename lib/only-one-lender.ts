// ONE LENDER ON A LENDING OPTION, AND WHY.
//
// 17 Nov 2026. A compliance note carried this, in capitals, inside a document
// that goes to a lender:
//
//   ** ONLY ONE LENDER OPTION RECORDED — there is not enough on this deal to
//      write this box. Please write it yourself, setting out what else was
//      considered and why this product was chosen. **
//
// It is a fair warning and it was in the wrong place. A broker deleted it and
// typed "Client wants to stay with existing lender St George" in its place -
// every time, by hand, on every file like it.
//
// Fabio: "if we are issuing a lending option that only has one lender, we need
// to force my credit team to give me an answer, because that answer then goes
// into the compliance notes."
//
// SO THIS ONE BLOCKS, AND IT IS THE ONLY THING IN THE NOTES THAT DOES. Every
// other gap is a warning on the list above the note - see lib/what-folds-away
// and the compliance pack - because a locked screen gets worked around by
// lunchtime. This is different: the reason has to exist BEFORE the lending
// option goes out, because that is the moment it is true and the moment the
// person who knows it is sitting there.
//
// NOTHING IS WRITTEN TWICE. The answer is recorded once on Lending options and
// both boxes that used to shout read it from there.

const txt = (v: any) => String(v ?? '').trim()

/** The reasons credit actually gives, as one press each. */
export const WHY_ONE_LENDER = [
  'Client wants to stay with their existing lender',
  'The clients asked for this lender',
  'Only lender that services this application',
  'The clients have an existing relationship with this lender',
] as const

export type WhyOneLender = typeof WHY_ONE_LENDER[number]

/** Where the answer lives. One key, on the lending options tab. */
export const WHY_KEY = 'oneLenderReason'

const SAID: Record<string, (lender: string) => string> = {
  'Client wants to stay with their existing lender': l =>
    `The clients want to stay with their existing lender${l ? `, ${l}` : ''}.`,
  'The clients asked for this lender': l =>
    `The clients asked for ${l || 'this lender'}.`,
  'Only lender that services this application': l =>
    `${l || 'This lender'} is the only lender that services this application.`,
  'The clients have an existing relationship with this lender': l =>
    `The clients have an existing relationship with ${l || 'this lender'}.`,
}

/** What was recorded, if anything. */
export function whyOneLender(lo: any): string {
  return txt(lo?.[WHY_KEY])
}

/**
 * THE SENTENCE THE NOTES PRINT.
 *
 * A reason off the list is written in the portal's words so that every file
 * reads the same. Anything typed is used exactly as it was typed, because a
 * broker explaining an unusual deal is not improved by being paraphrased.
 */
export function whyOneLenderSentence(lo: any, lender: string): string {
  const said = whyOneLender(lo)
  if (!said) return ''
  const known = SAID[said]
  if (known) return known(txt(lender))
  const own = said.replace(/\s*\.?\s*$/, '')
  return own ? `${own}.` : ''
}

/**
 * CAN THIS LENDING OPTION GO OUT?
 *
 * Only ever false on a one-option deal with no reason recorded. A deal with two
 * lenders on it has never needed this and is not asked.
 */
export function blockedForNoReason(lo: any, optionCount: number): boolean {
  return optionCount === 1 && !whyOneLender(lo)
}

export const ASK_FOR_IT =
  'Only one product is on this lending option. Record why before it goes out — it goes into the compliance notes.'
