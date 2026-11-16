// THE SETTLEMENT TEAM'S DAY, DRAFTED FROM THE MORNING LIST.
//
// 18 Nov 2026. Credit has said what they are doing every morning since 23
// October, and brokers since the week after. Settlements had the work on screen
// - the morning list - and no way to say which of it was today's.
//
// That gap is the one thing management could not see: Fabio, on the admin band,
// wants "who has planned" and a Friday report. Neither can exist until somebody
// says what their day is.
//
// IT IS THE SAME DAY EVERY OTHER SEAT HAS. The same daily_plans row, the same
// line between today and the queue, the same notes that are gone tomorrow, the
// same one-press "tell management". A settlement person who has watched Belle's
// screen already knows how to use it.
//
// THE DRAFT IS NOT A NEW OPINION. It is lib/the-morning-list.ts, deduplicated
// to one row per deal, in the order that screen already puts them in - so the
// day cannot disagree with the list sitting underneath it.
import { morningList, type MorningItem } from './the-morning-list'
import { type SettlementSettings } from './settlement-settings'
import { LINE } from './the-days-plan'

export type SettlementDayDeal = {
  id: string
  name: string
  /** What the morning list says this deal owes - shown as the reason. */
  stage: string
  /** How long it has been, or when it falls due. */
  since: string | null
  broker?: string
  /** How many separate jobs this deal owes this morning. */
  jobs: number
}

/** The most that lands above the line before anybody touches it. */
export const A_DAY = 7

/**
 * ONE ROW PER DEAL, KEEPING THE MOST URGENT REASON.
 *
 * The morning list is a list of jobs, and a deal can owe two of them. A day is
 * a list of files, because that is what a person picks up. The first reason
 * wins, which is already the most urgent one - morningList() sorted them.
 */
export function settlementDraft(
  deals: any[], s: SettlementSettings, today: Date = new Date(),
): SettlementDayDeal[] {
  const items: MorningItem[] = morningList(deals || [], s, today)
  const byId = new Map<string, any>((deals || []).map(d => [String(d?.id), d]))
  const out: SettlementDayDeal[] = []
  const seen = new Map<string, SettlementDayDeal>()
  for (const it of items) {
    const had = seen.get(it.dealId)
    if (had) { had.jobs += 1; continue }
    const deal = byId.get(it.dealId)
    const row: SettlementDayDeal = {
      id: it.dealId,
      name: it.dealName,
      stage: it.words,
      since: it.since || null,
      broker: deal?.assigned_broker || undefined,
      jobs: 1,
    }
    seen.set(it.dealId, row)
    out.push(row)
  }
  return out
}

/**
 * WHERE THE LINE STARTS THE DAY.
 *
 * Seven above it, the rest below. Fabio, 12 Nov 2026, on a credit assessor
 * holding fourteen files: "7 is the maximum I want to show." A draft of thirty
 * is not a plan, and a person who has to delete twenty-three rows before they
 * can start will stop using the screen by Thursday.
 *
 * A SAVED DAY BEATS THE DRAFT. Once somebody has said what today is, that is
 * today - their order, their line - and anything that has arrived since goes to
 * the end of the queue rather than jumping into their day.
 */
export function draftOrder(
  draft: SettlementDayDeal[], saved: string[] = [], cap = A_DAY,
): string[] {
  const ids = draft.map(d => d.id)
  const kept = (saved || []).map(String).filter(id => ids.includes(id))
  if (kept.length) {
    return [...kept, LINE, ...ids.filter(id => !kept.includes(id))]
  }
  return [...ids.slice(0, cap), LINE, ...ids.slice(cap)]
}

/** "Belle has said what she is doing" / "Belle has not said yet". */
export function plannedWords(name: string, confirmedAt: any): string {
  const first = String(name || '').trim().split(/\s+/)[0] || 'They'
  return confirmedAt ? `${first} has said what today is` : `${first} has not said yet`
}

/** How many of the team have told management, for the admin band. */
export function howManyPlanned(
  team: Array<{ id: string; confirmedAt?: any }>,
): { said: number; team: number } {
  return {
    said: (team || []).filter(t => !!t.confirmedAt).length,
    team: (team || []).length,
  }
}
