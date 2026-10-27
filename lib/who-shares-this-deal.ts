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

// A SPLIT IS A LIST OF LINES.
//
// 27 Oct 2026, hours after the first version shipped. Fabio: "we need the
// ability of addint lines for upfront and trail so line one for exmaple 20%
// simplify line 80% broker 1 and abilty to add third line".
//
// He is right and the first shape was wrong. One pair of percentages can only
// say what ONE party gets - "the referrer takes 20%" and nothing about who
// holds the other eighty. A three-way split between the house, the referrer
// and the writing broker is the normal case, not the edge one.
//
// EACH LINE CARRIES ITS OWN UPFRONT AND TRAIL, because they are not always the
// same. A referrer on the upfront only, taking nothing of the trail, is a real
// arrangement that could not be written down before.
export type Line = {
  who: string
  /** Their share. Null means nobody recorded it; 0 means they genuinely get none. */
  upfront: number | null
  trail: number | null
}

export function lineFrom(raw: any): Line {
  return {
    who: txt(raw?.who),
    upfront: readPct(raw?.upfront),
    trail: readPct(raw?.trail),
  }
}

export function blankLine(): Line {
  return { who: '', upfront: null, trail: null }
}

/** A row of public.commission_splits. */
export type Split = {
  id: string
  name: string
  kind: SplitKind
  who: string
  contactEmail: string
  /** The share THEY get. Kept for rows written before lines existed. */
  upfront: number | null
  trail: number | null
  /** Who gets what. Never empty - see splitFromRow. */
  lines: Line[]
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
  const upfront = readPct(r?.upfront_pct)
  const trail = readPct(r?.trail_pct)
  const stored = Array.isArray(r?.lines) ? r.lines.map(lineFrom).filter((l: Line) => l.who || l.upfront !== null || l.trail !== null) : []
  // A ROW WRITTEN BEFORE LINES EXISTED READS AS ONE LINE.
  //
  // Two were added this morning under the old shape. Nothing has to be
  // retyped, and nothing silently reads as empty.
  const lines: Line[] = stored.length ? stored
    : (upfront !== null || trail !== null || txt(r?.who))
      ? [{ who: txt(r?.who) || txt(r?.name), upfront, trail }]
      : [blankLine()]
  return {
    id: txt(r?.id),
    name: txt(r?.name),
    kind: txt(r?.kind) === 'broker_split' ? 'broker_split' : 'referrer',
    who: txt(r?.who),
    contactEmail: txt(r?.contact_email),
    upfront, trail, lines,
    notes: txt(r?.notes),
    active: r?.active !== false,
  }
}

// ---------------------------------------------------------------------------
// DOES IT ADD UP?
// ---------------------------------------------------------------------------

export type Totals = { upfront: number; trail: number; upfrontOk: boolean; trailOk: boolean }

/**
 * A COLUMN THAT DOES NOT REACH 100% IS A WARNING, NOT A REFUSAL.
 *
 * Some arrangements genuinely do not account for all of it, and a screen that
 * refuses to save until the numbers are tidy is a screen people work around.
 * So it says so and saves anyway - and a line nobody has filled in counts as
 * nothing rather than dragging the total down to a false 100.
 */
export function totalsOf(lines: Line[]): Totals {
  const sum = (k: 'upfront' | 'trail') =>
    Math.round((lines || []).reduce((t, l) => t + (l[k] ?? 0), 0) * 100) / 100
  const upfront = sum('upfront')
  const trail = sum('trail')
  const near = (n: number) => Math.abs(n - 100) < 0.01
  return { upfront, trail, upfrontOk: near(upfront), trailOk: near(trail) }
}

/** The line under the table, or empty where both columns are right. */
export function addsUpWarning(lines: Line[]): string {
  const t = totalsOf(lines)
  if (t.upfrontOk && t.trailOk) return ''
  const bits: string[] = []
  if (!t.upfrontOk) bits.push(`Upfront adds up to ${t.upfront}%`)
  if (!t.trailOk) bits.push(`trail adds up to ${t.trail}%`)
  return `${bits.join(', ')}, not 100%. Saved anyway \u2014 some arrangements genuinely do not account `
    + 'for all of it \u2014 but worth a look before somebody is invoiced off this.'
}

/** Just the share, with no name in front of it. "20%", "25% upfront, 0% trail". */
export function shareWords(l: Line): string {
  const u = l?.upfront === null || l?.upfront === undefined ? null : `${l.upfront}%`
  const t = l?.trail === null || l?.trail === undefined ? null : `${l.trail}%`
  if (u === null && t === null) return 'share not recorded'
  if (u === t) return u as string
  if (t === null) return `${u} upfront`
  if (u === null) return `trail ${t}`
  return `${u} upfront, ${t} trail`
}

/** "Simplify 20% · Harrow 20% · Mark Gallo 60%" */
export function linesInWords(lines: Line[]): string {
  const real = (lines || []).filter(l => txt(l.who))
  if (!real.length) return 'share not recorded'
  return real.map(l => {
    const u = l.upfront === null ? null : `${l.upfront}%`
    // ONLY SAY THE TRAIL WHERE IT DIFFERS. On most arrangements the two are
    // the same and printing both doubles the length of the line for nothing.
    const t = l.trail === null ? null : `${l.trail}%`
    // A TRAIL NOBODY RECORDED MUST NOT READ LIKE A MATCHING ONE. 20% and
    // 20% is said once; 20% upfront with the trail left empty says "upfront",
    // because those are different arrangements and they looked identical.
    const share = u === null && t === null ? 'share not recorded'
      : u === t ? u
      : t === null ? `${u} upfront`
      : u === null ? `trail ${t}`
      : `${u} upfront, ${t} trail`
    return `${l.who} ${share}`
  }).join(' \u00b7 ')
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
  return `${s.name} \u2014 ${linesInWords(s.lines)}`
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
  /** The whole breakdown as it stood when it was chosen. */
  lines: Line[]
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
      commission_split_lines: null,
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
    // THE WHOLE BREAKDOWN, COPIED. Renegotiating an arrangement next year must
    // not rewrite what a settled deal says was agreed at the time.
    commission_split_lines: split.lines,
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
    lines: Array.isArray(deal.commission_split_lines) && deal.commission_split_lines.length
      ? deal.commission_split_lines.map(lineFrom)
      : [{ who: txt(deal.commission_split_name), upfront: readPct(deal.commission_split_upfront),
           trail: readPct(deal.commission_split_trail) }],
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
  if (s.none) return 'Not shared \u2014 this one is all ours'
  return `${s.name} \u2014 ${splitKindLabel(s.kind).toLowerCase()} \u00b7 ${linesInWords(s.lines)}`
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
  const then = linesInWords(s.lines)
  const current = linesInWords(now.lines)
  if (then === current) return ''
  return `This deal was agreed at ${then}. ${now.name} is now set to ${current}. `
    + 'The deal keeps what was agreed at the time.'
}
