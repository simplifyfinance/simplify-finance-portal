// How long a deal has sat in its current stage, and whether that is a problem.
// Business days, because a Friday action should not look stale on Monday.

// Ageing starts here. A stage entered before this date is not aged at all — those
// timestamps predate the rule, and a list that opens with twenty deals nobody intends
// to chase teaches people to ignore the group. Anything that moves from this date on
// is tracked immediately, including deals created long before it.
export const AGEING_FROM = '2026-08-24'

export type AgeGroup = 'nudge' | 'long' | 'moving' | 'closed'

// Thresholds differ by stage: a fact find waiting on client documents for a week is
// normal; a deal at compliance issued for a week means nobody moved the card.
const THRESHOLDS: Record<string, { long: number; nudge: number }> = {
  fact_find:         { long: 10, nudge: 15 },
  bc:                { long: 3,  nudge: 5 },
  lo:                { long: 7,  nudge: 10 },
  compliance:        { long: 5,  nudge: 8 },
  compliance_issued: { long: 5,  nudge: 8 },
}

export function stageKey(deal: any): string {
  if (deal?.compliance_completed_at) return 'compliance_issued'
  if (deal?.lo_completed_at) return 'compliance'
  if (deal?.bc_completed_at) return 'lo'
  return String(deal?.stage || '').toLowerCase().includes('fact') ? 'fact_find' : 'bc'
}

// The stage began when the previous one finished. Before any stage is complete, the
// deal has been waiting since it was created.
export function stageSince(deal: any): string | null {
  return deal?.compliance_completed_at || deal?.lo_completed_at || deal?.bc_completed_at || deal?.created_at || null
}

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

export function stageAge(deal: any): { key: string; days: number | null; label: string } {
  const key = stageKey(deal)
  const since = stageSince(deal)
  const tracked = !!since && String(since).slice(0, 10) >= AGEING_FROM
  const days = tracked ? businessDaysSince(since) : null
  const label = days === null ? '\u2014' : days === 0 ? 'today' : days === 1 ? '1 day' : `${days} days`
  return { key, days, label }
}

export function ageGroupOf(deal: any): AgeGroup {
  if (deal?.status === 'lost' || deal?.status === 'completed') return 'closed'
  const { key, days } = stageAge(deal)
  const t = THRESHOLDS[key]
  if (days === null || !t) return 'moving'
  if (days >= t.nudge) return 'nudge'
  if (days >= t.long) return 'long'
  return 'moving'
}

export const GROUP_ORDER: AgeGroup[] = ['nudge', 'long', 'moving', 'closed']

export const GROUP_STYLE: Record<AgeGroup, { label: string; text: string; chip: string }> = {
  nudge:  { label: 'Needs a nudge', text: 'text-[#C4553B]', chip: 'bg-[#FBEDE9] text-[#C4553B]' },
  long:   { label: 'Running long',  text: 'text-[#946017]', chip: 'bg-[#FDF6E7] text-[#9A7B2E]' },
  moving: { label: 'Moving',        text: 'text-[#A29889]', chip: 'bg-[#FAF7F2] text-[#6E665C]' },
  closed: { label: 'Closed',        text: 'text-[#A29889]', chip: 'bg-[#F1F7F3] text-[#25794C]' },
}
