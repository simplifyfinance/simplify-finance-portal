// SUB-TABS UNDER THREE COLUMNS OF THE BOARD.
//
// 17 Nov 2026. Four settlement columns, and the seven steps are finer than they
// are: Contracts Issued leaves a card in Formal approval, and three steps leave
// it in Contracts returned. Coarse on the board for the whole business, fine
// inside the column for the team working it.
//
// IT OPENS ON ALL EVERY MORNING, and both of them asked for that independently:
//
//   JULIAN KOK: "please reset each morning so that it shows all deal cards in
//   each sub tab. We will manually filter by outstanding if required."
//   BELLE: "Julian is right, please reset each morning..."
//
// Which is why nothing here persists anything. A remembered filter saves two
// clicks a day and costs the one morning somebody opens the board, sees four
// cards and thinks the book has emptied.
import { STEPS, STEP_LABEL, BOARD_COLUMN, stepOf, type Step } from './the-seven-steps'

export const ALL = '__all__'

/** The columns that gain sub-tabs. Every other column is untouched. */
export const SPLIT_COLUMNS = ['formal', 'contracts_returned', 'settled'] as const
export type SplitColumn = typeof SPLIT_COLUMNS[number]

export function hasSubTabs(column: string): column is SplitColumn {
  return (SPLIT_COLUMNS as readonly string[]).includes(column)
}

/**
 * A DEAL THAT HAS NEVER BEEN PUT ON A STEP.
 *
 * Every deal in the book on the morning this ships. It is in Formal approval
 * because it is formally approved, so it belongs to the FIRST sub-step of its
 * column - which is where a deal enters that column anyway. Filtering would
 * otherwise show nought of everything on day one and read as broken.
 */
const FIRST_IN_COLUMN: Record<SplitColumn, Step> = {
  formal: 'formal',
  contracts_returned: 'contracts_reviewing',
  settled: 'settled',
}

/** Settled, but the review, compliance or commission is still open. */
export function toCloseOut(deal: any): boolean {
  return !!deal?.settled_at
    && !(deal?.review_sent && deal?.compliance_finalised && deal?.commission_paid)
}

export const CLOSE_OUT = '__close_out__'

/** Which sub-tab a card sits under, inside its column. */
export function subTabOf(deal: any, column: SplitColumn): string {
  if (column === 'settled') return toCloseOut(deal) ? CLOSE_OUT : ALL
  const step = stepOf(deal)
  if (step && BOARD_COLUMN[step] === column) return step
  return FIRST_IN_COLUMN[column]
}

export type SubTab = { key: string; label: string }

/** The tabs a column offers, in the order the work happens. */
export function subTabsFor(column: SplitColumn): SubTab[] {
  if (column === 'settled') {
    return [{ key: ALL, label: 'All' }, { key: CLOSE_OUT, label: 'To close out' }]
  }
  const steps = STEPS.filter(s => BOARD_COLUMN[s] === column)
  return [{ key: ALL, label: 'All' }, ...steps.map(s => ({ key: s, label: STEP_LABEL[s] }))]
}

/** How many cards sit under each tab. */
export function countsFor(cards: any[], column: SplitColumn): Record<string, number> {
  const out: Record<string, number> = { [ALL]: (cards || []).length }
  for (const t of subTabsFor(column)) if (t.key !== ALL) out[t.key] = 0
  for (const d of cards || []) {
    const k = subTabOf(d, column)
    if (k !== ALL) out[k] = (out[k] || 0) + 1
  }
  return out
}

/** The cards a tab shows. All shows everything, always. */
export function cardsOn(cards: any[], column: SplitColumn, tab: string): any[] {
  if (!tab || tab === ALL) return cards || []
  return (cards || []).filter(d => subTabOf(d, column) === tab)
}

/**
 * "SHOWING 2 OF 7", so a filtered column never reads as an empty one.
 *
 * Empty while nothing is filtered: a column that says "showing 7 of 7" is
 * furniture.
 */
export function showingWords(shown: number, all: number, tab: string): string {
  if (!tab || tab === ALL) return ''
  return `Showing ${shown} of ${all}`
}
