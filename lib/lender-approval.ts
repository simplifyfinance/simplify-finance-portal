// HOW LONG AN APPROVAL FROM THIS BANK STANDS.
//
// 17 Aug 2026. Fabio, on the offer accepted panel: "it doesn't know that the
// offer accepted lasts 90 days. Is there somewhere in the lender library that
// I can update that?"
//
// There was not. lib/offer-accepted-rules.ts holds a list of ten banks with
// their preapproval terms written into it. Pepper, La Trobe, Liberty and
// Firstmac are not on that list, so the panel drew nothing for them at all -
// and nothing, on a screen about a deadline, reads as "there is no deadline".
// Correcting one of the ten meant a code change and a ship.
//
// SO THE TERMS MOVED ONTO THE LENDER, where the repricing threshold already
// lives. Four boxes Fabio owns: how long it lasts, will they extend it, how
// long the extension runs, what they charge.
//
// WHAT DID NOT MOVE. How you tell that bank about a change - AOL, their
// portal, an email - and the trap on each one, like ANZ wanting a signed
// acknowledgement when a loan REDUCES. That is not a number somebody keeps up
// to date, it is process written down once, and it stays in
// lib/offer-accepted-rules.ts.
//
// NOT RECORDED IS AN ANSWER. Nothing here defaults to ninety days. A lender
// nobody has filled in says so, with the place to fill it in - rather than
// borrowing a figure from the bank next to it and being quietly wrong about a
// date somebody is working to. Same rule as reprice_over_percent, which has
// worked this way since October.

const txt = (v: any) => String(v ?? '').trim()

export type LenderApproval = {
  days: number
  extends: boolean
  extendDays: number | null
  extendFee: number | null
}

// The columns on `lenders`. See docs/lender-approval.sql.
export type ApprovalRow = {
  name?: string | null
  preapproval_days?: number | null
  preapproval_extends?: boolean | null
  preapproval_extend_days?: number | null
  preapproval_extend_fee?: number | null
}

function whole(v: any): number | null {
  if (v === null || v === undefined || txt(v) === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/**
 * The approval terms recorded against a lender, or null where nobody has said.
 *
 * The days are what make this an answer at all - a lender with an extension
 * fee typed in and no term is still a lender nobody has told us how long its
 * approval runs for, so it counts as not recorded.
 */
export function approvalOf(lender: ApprovalRow | null | undefined): LenderApproval | null {
  const days = whole(lender?.preapproval_days)
  if (days === null) return null
  return {
    days,
    extends: lender?.preapproval_extends === true,
    extendDays: whole(lender?.preapproval_extend_days),
    extendFee: whole(lender?.preapproval_extend_fee),
  }
}

/** True where this lender has no approval terms recorded at all. */
export function approvalUnknown(lender: ApprovalRow | null | undefined): boolean {
  return approvalOf(lender) === null
}

// WHAT THE PANEL SAYS ABOUT EXTENDING IT.
//
// " They will extend it by another 90 days." / " They do not extend it."
// Leading space on purpose: it is glued onto the end of the sentence about
// when the approval runs out, which is how that line already reads today.
export function extensionWords(a: LenderApproval | null): string {
  if (!a) return ''
  if (!a.extends) return ' They do not extend it.'
  if (a.extendFee) return ` They will extend it, for $${a.extendFee}.`
  if (a.extendDays) return ` They will extend it by another ${a.extendDays} days.`
  return ' They will extend it.'
}

// THE LINE ON THE LENDER ROW IN THE LIBRARY, so "not recorded" is visible
// without opening anything. Fabio's mock, 17 Aug: the lender lines say what
// they hold.
export function approvalSummary(lender: ApprovalRow | null | undefined): string {
  const a = approvalOf(lender)
  if (!a) return 'preapproval not recorded'
  const extend = !a.extends ? 'no extension'
    : a.extendFee ? `$${a.extendFee} to extend`
    : a.extendDays ? `+${a.extendDays} days` : 'extendable'
  return `preapproval ${a.days} days, ${extend}`
}

/** "ANZ" or "this lender", for a sentence that has to name somebody. */
export function lenderWord(lender: ApprovalRow | null | undefined): string {
  return txt(lender?.name) || 'this lender'
}
