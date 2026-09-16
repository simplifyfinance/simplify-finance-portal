// CHANGING SCENARIO USED TO THROW THE SPLITS AWAY.
//
// One click on a scenario chip ran setSplits(defaults), and every amount, rate,
// label, repayment type, typed repayment and per-property balance went with it.
// No confirmation, nothing kept in deal_history to put back, and the autosave
// wrote the empty version 700ms later.
//
// The NOTES have been safe since 8 Sep - notesAfterScenarioChange in
// lib/email-freshness.ts leaves anything a broker has typed alone and only
// replaces wording nobody has touched. The splits never got the same treatment.
// This is that rule, for the splits, plus the question the notes never needed:
// keep them, or replace them.
//
// The test for "has anybody typed here" is word-for-word equality with the
// scenario's own defaults. Anything else - including a figure the BC copied in
// from the existing loan balance - counts as something to lose, because it is
// a number on screen that would vanish. Erring towards asking is cheap; erring
// the other way is the bug.

const txt = (v: any) => String(v ?? '').trim()

export type SplitLike = {
  label?: any; amount?: any; rate?: any; type?: any
  repayment?: any; existingBalance?: any; deposit?: any
  lmi?: any; lmiApplicable?: any; interestCapitalised?: any
  [k: string]: any
}

// Everything a person can put into a split. Compared field by field rather than
// by JSON, so a key added later cannot quietly make every deal look "touched".
const TYPED_FIELDS = ['label', 'amount', 'rate', 'type', 'repayment', 'existingBalance',
                      'deposit', 'lmi', 'lmiApplicable', 'interestCapitalised'] as const

function same(a: SplitLike, b: SplitLike): boolean {
  return TYPED_FIELDS.every(f => txt(a?.[f]) === txt(b?.[f]))
}

const blank = (s: SplitLike) => TYPED_FIELDS.every(f => !txt(s?.[f]))

// Still word for word what the scenario put there, or never filled in at all.
export function splitsAreUntouched(current: SplitLike[] | undefined, defaults: SplitLike[] | undefined): boolean {
  const now = Array.isArray(current) ? current : []
  const was = Array.isArray(defaults) ? defaults : []
  if (now.every(blank)) return true
  if (now.length !== was.length) return false
  return now.every((s, i) => same(s, was[i]))
}

// WHAT A CLICK WOULD COST, in the broker's own words and figures. Null when it
// would cost nothing, which is when the question is not worth asking.
export type ChangeCost = { lines: string[] }

export function scenarioChangeCost(
  current: SplitLike[] | undefined,
  previousDefaults: SplitLike[] | undefined,
): ChangeCost | null {
  if (splitsAreUntouched(current, previousDefaults)) return null
  const lines: string[] = []
  ;(current || []).forEach((s, i) => {
    if (blank(s)) return
    const head = txt(s.label) || `Split ${i + 1}`
    const bits = [
      txt(s.amount) ? `$${txt(s.amount)}` : '',
      txt(s.rate) ? `${txt(s.rate)}%` : '',
      txt(s.type),
      txt(s.repayment) ? `${txt(s.repayment)} repayment` : '',
      txt(s.existingBalance) ? `$${txt(s.existingBalance)} existing` : '',
    ].filter(Boolean)
    lines.push(bits.length ? `${head} — ${bits.join(' · ')}` : head)
  })
  return lines.length ? { lines } : null
}

// KEEP WHAT WAS TYPED, AND ADD WHAT THE NEW SCENARIO STILL NEEDS.
//
// One split moving to bridging, which is a bridging loan and an end loan: the
// typed one stays exactly as it is and the second arrives blank, waiting. Fabio
// chose this on 16 Sep - "keep mine, add the missing ones blank" - because the
// alternative is an email whose wording describes a loan that is not there.
//
// Splits beyond what the new scenario expects are never dropped. A broker who
// built three parts meant three parts.
export function keepSplits(current: SplitLike[] | undefined, nextDefaults: SplitLike[] | undefined): SplitLike[] {
  const now = (Array.isArray(current) ? current : []).map(s => ({ ...s }))
  const want = Array.isArray(nextDefaults) ? nextDefaults : []
  for (let i = now.length; i < want.length; i++) now.push({ ...want[i] })
  return now
}

// How many blank rows the Keep would add, so the question can say so.
export function splitsAdded(current: SplitLike[] | undefined, nextDefaults: SplitLike[] | undefined): number {
  const have = (Array.isArray(current) ? current : []).length
  const want = (Array.isArray(nextDefaults) ? nextDefaults : []).length
  return Math.max(0, want - have)
}
