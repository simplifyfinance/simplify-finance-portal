// How long a deal has sat in its current stage, and whether that is a problem.
// Business days, because a Friday action should not look stale on Monday.

// Ageing starts here. A stage entered before this date is not aged at all — those
// timestamps predate the rule, and a list that opens with twenty deals nobody intends
// to chase teaches people to ignore the group. Anything that moves from this date on
// is tracked immediately, including deals created long before it.
export const AGEING_FROM = '2026-08-24'

import { phaseOf, phaseSince, isInApplication, isFinished, type Phase } from './deal-phase'

export type AgeGroup = 'nudge' | 'long' | 'moving' | 'in_application' | 'settled' | 'lost'

// Thresholds differ by stage: a fact find waiting on client documents for a week is
// normal; a deal at compliance issued for a week means nobody moved the card.
// Per phase, in business days. Editable in Settings - these are the defaults.
//
// Fabio, 1 Sep 2026: Compliance sent 3/5 and Lodged 3/5, because support only has
// to move a card and a lender only has to acknowledge a file. Formal has none for
// now: it is governed by the settlement date rather than by sitting still, but
// the setting exists so it can be given one later.
export const DEFAULT_THRESHOLDS: Partial<Record<Phase, { long: number; nudge: number }>> = {
  fact_find:       { long: 10, nudge: 15 },
  bc:              { long: 3,  nudge: 5 },
  lo:              { long: 7,  nudge: 10 },
  compliance:      { long: 5,  nudge: 8 },
  compliance_sent: { long: 3,  nudge: 5 },
  lodged:          { long: 3,  nudge: 5 },
  preapproved:     { long: 20, nudge: 30 },
  // An accepted offer has a settlement date attached to it, so this is the one
  // stage on the board where sitting still has a deadline behind it. Formal
  // approval should follow within the week.
  offer_accepted:  { long: 5,  nudge: 8 },
  // Contracts returned and Settlement booked ship with none, for the same reason
  // Formal has none: they are governed by the settlement date rather than by
  // sitting still, and the Settlement panel already goes red as that date nears.
  // The boxes exist in Settings so they can be given one later.
}

// Kept as thin wrappers so callers do not all have to change at once. The answer
// comes from lib/deal-phase.ts, which is the only place that decides.
export function stageKey(deal: any): string { return phaseOf(deal) }
export function stageSince(deal: any): string | null { return phaseSince(deal) }

export function businessDaysSince(iso: string | null): number | null {
  if (!iso) return null
  const start = new Date(iso)
  if (isNaN(start.getTime())) return null
  let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
  const now = new Date()
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  let n = 0
  let guard = 0
  while (d < end && guard++ < 4000) {
    d = new Date(d.getTime() + 86400000)
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) n++
  }
  return n
}

export function stageAge(deal: any, thresholds = DEFAULT_THRESHOLDS): { key: string; days: number | null; label: string } {
  const key = phaseOf(deal)
  const since = phaseSince(deal)
  const tracked = !!since && String(since).slice(0, 10) >= AGEING_FROM
  const days = tracked ? businessDaysSince(since) : null
  const label = days === null ? '\u2014' : days === 0 ? 'today' : days === 1 ? '1 day' : `${days} days`
  return { key, days, label }
}

export function ageGroupOf(deal: any, thresholds = DEFAULT_THRESHOLDS): AgeGroup {
  // Settled and lost are separate answers, not one "closed". They were folded
  // together, which is how three lost deals ended up parked at the bottom of the
  // list forever while nine live ones were hidden.
  const phase = phaseOf(deal)
  if (phase === 'lost') return 'lost'
  if (phase === 'settled') return 'settled'

  const { days } = stageAge(deal, thresholds)
  const t = (thresholds as any)[phase]
  if (days !== null && t) {
    if (days >= t.nudge) return 'nudge'
    if (days >= t.long) return 'long'
  }
  // Live loans past compliance get their own section rather than being mixed in
  // with deals still being written.
  if (isInApplication(deal)) return 'in_application'
  return 'moving'
}

export const GROUP_ORDER: AgeGroup[] = ['nudge', 'long', 'moving', 'in_application', 'settled', 'lost']

export const GROUP_STYLE: Record<AgeGroup, { label: string; text: string; chip: string }> = {
  nudge:          { label: 'Needs a nudge',  text: 'text-[#C4553B]', chip: 'bg-[#FBEDE9] text-[#C4553B]' },
  long:           { label: 'Running long',   text: 'text-[#946017]', chip: 'bg-[#FDF6E7] text-[#9A7B2E]' },
  moving:         { label: 'Moving',         text: 'text-[#A29889]', chip: 'bg-[#FAF7F2] text-[#6E665C]' },
  in_application: { label: 'In application', text: 'text-[#0E8FCB]', chip: 'bg-[#EAF6FD] text-[#0E6FA0]' },
  settled:        { label: 'Settled',        text: 'text-[#25794C]', chip: 'bg-[#F1F7F3] text-[#25794C]' },
  lost:           { label: 'Lost',           text: 'text-[#A29889]', chip: 'bg-[#FAF7F2] text-[#6E665C]' },
}
