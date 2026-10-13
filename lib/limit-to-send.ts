// THE LIMIT THE BANK IS SENT, AND THE CONDITION THAT MAKES IT TRUE.
//
// 13 Oct 2026. Fabio: "handover goes 10,000 condition to be reduced".
//
// A credit card is assessed on its limit, not its balance. When the limit is
// coming down before settlement, the figure worth assessing is the one it is
// coming down to - that is the entire reason a broker asks a client to do it.
// So the assessment that goes to the lender carries the new limit.
//
// AND THAT IS A PROMISE, NOT A FACT. On the day the form is lodged the card is
// still at its old limit. Sending the lower figure without anybody being made
// to do the reduction is how a file gets approved on a number that never comes
// true. So the two are built together, here, and neither can be had without
// the other: the moment a reduction is recorded, a condition lands on the deal
// card with the client's name against it.

import { withNewItem, outstandingItems, type OutstandingItem } from './outstanding'
import { LIMIT_REDUCED } from './fact-find-options'
import { money, readMoney } from './money'

const txt = (v: any): string => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim()
const num = (v: any): number => readMoney(v) ?? 0

/** Is this card's limit coming down before settlement. */
export function limitIsComingDown(l: any): boolean {
  return txt(l?.status) === LIMIT_REDUCED
}

/**
 * The limit to assess on.
 *
 * The new one when there is a real one, lower than the old. Otherwise the limit
 * as it stands - a reduction with no figure typed is a sentiment, not a number,
 * and assessing on a sentiment is worse than assessing on today's limit.
 */
export function limitToSend(l: any): string {
  const was = txt(l?.limitAmount)
  if (!limitIsComingDown(l)) return was
  const now = num(l?.newLimitAmount)
  if (now <= 0) return was
  if (num(was) > 0 && now >= num(was)) return was
  return txt(l?.newLimitAmount)
}

/** Recorded as coming down, with no figure to come down to. */
export function reductionWithNoFigure(l: any): boolean {
  return limitIsComingDown(l) && num(l?.newLimitAmount) <= 0
}

/**
 * What the condition says, for one card.
 *
 * Deliberately readable out loud on the phone to a client, because that is what
 * somebody will be doing with it.
 */
export function conditionFor(l: any): string {
  if (!limitIsComingDown(l)) return ''
  const lender = txt(l?.lenderName)
  const now = num(l?.newLimitAmount)
  const where = lender ? `the ${lender} credit card` : 'the credit card'
  return now > 0
    ? `Reduce ${where} limit to ${money(now)} before settlement, and send the confirmation`
    : `Reduce ${where} limit before settlement — the new limit has not been recorded yet`
}

/** Every condition this deal's fact find implies, in the order the cards are in. */
export function conditionsOn(deal: any): string[] {
  const list = deal?.fact_find_data?.liabilities
  return (Array.isArray(list) ? list : [])
    .filter(l => /credit card/i.test(txt(l?.liabilityType)) && limitIsComingDown(l))
    .map(conditionFor)
    .filter(Boolean)
}

// THE SAME CONDITION IS NOT TWO CONDITIONS.
//
// A fact find is saved thirty times while it is being built. Adding the item on
// every save would give a client the same instruction thirty times, and a list
// nobody reads. Matching is on the lender rather than on the whole sentence, so
// correcting the figure from $12,000 to $10,000 updates nothing and adds
// nothing - it is the same job.
function sameJob(a: string, b: string): boolean {
  const key = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '').slice(0, 40)
  return key(a) === key(b)
}

/**
 * The outstanding list with any missing reduction condition added.
 *
 * Returns the WHOLE list, like everything else in lib/outstanding.ts, so the
 * caller saves it in one write. Nothing is ever removed: a condition that was
 * added and then changed its mind stays on the list and gets ticked off, which
 * is a record of what was asked rather than a record of what is left.
 */
export function withLimitConditions(deal: any, now = new Date()): OutstandingItem[] {
  const already = outstandingItems(deal)
  let out = already
  for (const want of conditionsOn(deal)) {
    if (already.some(i => sameJob(i.what, want))) continue
    out = withNewItem({ ...deal, outstanding_items: out }, want, 'client', now)
  }
  return out
}

/** Did that actually add anything, or is there nothing to save. */
export function conditionsChanged(deal: any, next: OutstandingItem[]): boolean {
  return next.length !== outstandingItems(deal).length
}
