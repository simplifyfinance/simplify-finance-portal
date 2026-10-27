// WHO SHARES THIS DEAL.
//
// 27 Oct 2026. Fabio: "there is not where in compliance that we can select
// commissions for that deal so I rather build a section in settings so we can
// load all commisions by name so broker can seelect in Fact Find Stage what
// commission split to select so it carries accross to handover notes".
//
// And Catherine, the same morning, on one broker writing a deal for another:
// "capture the right branding and the specific referrer, and carry both
// through to compliance."
//
// Two requests, one answer. A split is a named arrangement - an outside
// referrer paid a share, or two of our own brokers sharing a deal - and it is
// the same shape either way. Asked which, Fabio said both, in one list.
//
// THIS IS MONEY GOING OUT. The Commission library already in Settings is what
// the BANKS PAY US: upfront, trail and clawback per lender. The two are
// opposite directions and must never be confused, which is why nothing in this
// file is called a rate.
//
// NOTHING IS CALCULATED HERE. It records the arrangement and carries it to the
// people who need to see it. Dollars means joining it to what a lender
// actually paid, which is a bigger job and should not hold this one up.
//
// THREE RULES THAT ARE NOT OBVIOUS, AND ARE THE WHOLE FILE:
//
//   1. A deal keeps its own copy of the terms. Renegotiating a referrer from
//      20% to 25% must not rewrite what a settled deal says was agreed.
//   2. "Nobody - this one is all ours" is an ANSWER. It is different from
//      never having been asked, and compliance has to tell them apart.
//   3. A missing percentage is not zero. Null means nobody wrote it down;
//      zero means they genuinely get none of it, which is a real arrangement
//      (an upfront-only referrer) and reads completely differently.

const txt = (v: any) => String(v ?? '').trim()

export type SplitKind = 'referrer' | 'broker_split'

export const SPLIT_KIND_LABEL: Record<SplitKind, string> = {
  referrer: 'Referrer',
  broker_split: 'Broker split',
}

export const SPLIT_KINDS: SplitKind[] = ['referrer', 'broker_split']

export function splitKindLabel(v: any): string {
  const k = txt(v)
  return SPLIT_KIND_LABEL[k as SplitKind] || SPLIT_KIND_LABEL.referrer
}

/** A row of public.commission_splits. */
export type Split = {
  id: string
  name: string
  kind: SplitKind
  who: string
  contactEmail: string
  /** The share THEY get. Null where nobody recorded it. */
  upfront: number | null
  trail: number | null
  notes: string
  active: boolean
}

export function readPct(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  // STRIPPING A WORD LEAVES AN EMPTY STRING, AND Number('') IS 0, NOT NaN.
  // So "abc" read as a share of nought per cent, which is a real arrangement
  // and would have gone to a referrer's invoice looking deliberate.
  const digits = String(v).replace(/[^0-9.-]/g, '')
  if (!digits || !/[0-9]/.test(digits)) return null
  const n = Number(digits)
  if (!Number.isFinite(n)) return null
  // A share of a commission. Outside 0-100 it is a typo, and a typo that
  // reaches a referrer's invoice is an argument.
  if (n < 0 || n > 100) return null
  return Math.round(n * 100) / 100
}

export function splitFromRow(r: any): Split {
  return {
    id: txt(r?.id),
    name: txt(r?.name),
    kind: txt(r?.kind) === 'broker_split' ? 'broker_split' : 'referrer',
    who: txt(r?.who),
    contactEmail: txt(r?.contact_email),
    upfront: readPct(r?.upfront_pct),
    trail: readPct(r?.trail_pct),
    notes: txt(r?.notes),
    active: r?.active !== false,
  }
}

/** What goes in the dropdown: the ones in use, by name. */
export function offered(rows: any[]): Split[] {
  return (rows || []).map(splitFromRow)
    .filter(s => s.active && s.name)
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------------------
// SAYING IT IN WORDS
// ---------------------------------------------------------------------------

/** "20% upfront, 20% trail" - or what is actually known. */
export function termsInWords(upfront: number | null, trail: number | null): string {
  const bits: string[] = []
  if (upfront !== null) bits.push(`${upfront}% upfront`)
  if (trail !== null) bits.push(`${trail}% trail`)
  // NOT "0% / 0%". A share nobody has recorded is unknown, and writing it as
  // nothing is how a referrer ends up unpaid and nobody notices.
  return bits.length ? bits.join(', ') : 'share not recorded'
}

/** The one line a dropdown shows. */
export function splitInWords(s: Split): string {
  return `${s.name} — ${splitKindLabel(s.kind).toLowerCase()} · ${termsInWords(s.upfront, s.trail)}`
}

// ---------------------------------------------------------------------------
// WHAT THE DEAL REMEMBERS
// ---------------------------------------------------------------------------

export type ChosenSplit = {
  /** Null where the answer was "nobody". */
  id: string | null
  name: string
  kind: SplitKind
  upfront: number | null
  trail: number | null
  /** True where somebody answered "nobody - this one is all ours". */
  none: boolean
  at: string | null
  by: string
}

/**
 * THE WRITE, when a broker picks one on the fact find.
 *
 * The terms are copied ONTO THE DEAL rather than looked up later. See rule 1
 * at the top: a split renegotiated next year must not change what a settled
 * deal says was agreed at the time.
 */
export function chooseSplitPatch(
  split: Split | null, by: string, now: Date = new Date(),
): Record<string, any> {
  if (!split) {
    // "Nobody - this one is all ours." An answer, recorded as one.
    return {
      commission_split_id: null,
      commission_split_name: null,
      commission_split_kind: null,
      commission_split_upfront: null,
      commission_split_trail: null,
      commission_split_none: true,
      commission_split_at: now.toISOString(),
      commission_split_by: txt(by),
    }
  }
  return {
    commission_split_id: split.id,
    commission_split_name: split.name,
    commission_split_kind: split.kind,
    commission_split_upfront: split.upfront,
    commission_split_trail: split.trail,
    commission_split_none: false,
    commission_split_at: now.toISOString(),
    commission_split_by: txt(by),
  }
}

/**
 * WHAT THIS DEAL SAYS, or null where NOBODY HAS BEEN ASKED.
 *
 * Null and "nobody" are different answers and this is the line that keeps them
 * apart - see rule 2. Compliance shows the first in red and the second as a
 * fact.
 */
export function splitOn(deal: any): ChosenSplit | null {
  if (!deal) return null
  const none = deal.commission_split_none
  const id = txt(deal.commission_split_id)
  if (!id && none !== true) return null
  return {
    id: id || null,
    name: txt(deal.commission_split_name),
    kind: txt(deal.commission_split_kind) === 'broker_split' ? 'broker_split' : 'referrer',
    upfront: readPct(deal.commission_split_upfront),
    trail: readPct(deal.commission_split_trail),
    none: none === true && !id,
    at: txt(deal.commission_split_at) || null,
    by: txt(deal.commission_split_by),
  }
}

/** Has anybody answered the question at all? */
export function answered(deal: any): boolean {
  return splitOn(deal) !== null
}

/**
 * THE SENTENCE THAT APPEARS IN THREE PLACES.
 *
 * The handover credit reads, the compliance file, and the fact find's own
 * confirmation line. One wording, so nobody has to check whether two screens
 * are saying the same thing in different words.
 */
export function sharedWithLine(deal: any): string {
  const s = splitOn(deal)
  if (!s) return 'Not recorded — nobody has said whether this deal is shared'
  if (s.none) return 'Not shared — this one is all ours'
  return `${s.name} — ${splitKindLabel(s.kind).toLowerCase()}, ${termsInWords(s.upfront, s.trail)}`
}

/**
 * A SPLIT CHOSEN ON A DEAL WHOSE ARRANGEMENT HAS SINCE CHANGED.
 *
 * Not an error and never corrected automatically - the deal is right and the
 * list has moved on. But somebody looking at the deal should be told, because
 * the two numbers in front of them will not match Settings.
 */
export function termsHaveMoved(deal: any, rows: any[]): string {
  const s = splitOn(deal)
  if (!s?.id) return ''
  const now = (rows || []).map(splitFromRow).find(r => r.id === s.id)
  if (!now) return ''
  if (now.upfront === s.upfront && now.trail === s.trail) return ''
  return `This deal was agreed at ${termsInWords(s.upfront, s.trail)}. `
    + `${now.name} is now set to ${termsInWords(now.upfront, now.trail)}. `
    + `The deal keeps what was agreed at the time.`
}
