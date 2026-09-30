// WHO AND WHAT YOU WANT TO SEE ON THE BOARD.
//
// Fabio, 30 Sep 2026: "on the board view I want filters for deals give me ideas
// thinking broekers definetly one". Four of them in the end - broker, credit
// officer, lender, and whatever needs chasing.
//
// A FILTER IS A WAY TO HIDE DEALS, and this board exists because nine of them
// once sat hidden in a state the portal called finished and refused to show. So
// the rule everything here follows: a filter may never be quiet. The count is
// always BOTH numbers, the column counts say so too, and clearing it is one
// click that is always in the same place.
//
// The maths lives out here rather than inside the component for the usual
// reason - a filter worked out inside a render is a filter nothing can test, and
// "which deals are hidden right now" is exactly the question worth a test.

import { brokerKey as keyOf } from './broker-key'
import { ageGroupOf } from './deal-age'
import { isUrgentNow } from './push-answers'
import type { ThresholdMap } from './board-settings'

const txt = (v: any) => String(v ?? '').trim()

export type BoardFilters = {
  // Broker keys, lowercased - the same key the card is coloured by.
  broker: string[]
  // Credit officer names, as the deal carries them.
  officer: string[]
  // Lender names.
  lender: string[]
  // Past its nudge threshold, or flagged urgent by hand.
  nudge: boolean
}

export const NO_FILTERS: BoardFilters = { broker: [], officer: [], lender: [], nudge: false }

export type FilterKey = 'broker' | 'officer' | 'lender'
export const FILTER_KEYS: FilterKey[] = ['broker', 'officer', 'lender']

export const FILTER_LABEL: Record<FilterKey, string> = {
  broker: 'Broker',
  officer: 'Credit officer',
  lender: 'Lender',
}

// --- what a deal answers to -------------------------------------------------

export function brokerOf(deal: any): string { return keyOf(deal?.assigned_broker) || '' }
export function officerOf(deal: any): string { return txt(deal?.credit_officers?.name) }
export function lenderOf(deal: any): string { return txt(deal?.lenders?.name) }

export function valueOf(deal: any, which: FilterKey): string {
  return which === 'broker' ? brokerOf(deal) : which === 'officer' ? officerOf(deal) : lenderOf(deal)
}

// NEEDS ATTENTION IS TWO THINGS, and both are already on the card. A deal past
// the nudge threshold you set in Settings, or one somebody flagged urgent by
// hand. Either one is a reason to be looking at it.
export function needsAttention(deal: any, thresholds?: ThresholdMap): boolean {
  return ageGroupOf(deal, thresholds) === 'nudge' || isUrgentNow(deal)
}

// --- the rule ----------------------------------------------------------------

// WITHIN ONE FILTER, ANY OF THEM. BETWEEN FILTERS, ALL OF THEM.
//
// Kylie and Fabio means both their books, not the deals they share. Kylie AND
// ANZ AND needs attention means all three are true - which is what makes "what
// of Kylie's is rotting at ANZ" a question somebody can actually ask.
//
// `skip` leaves one filter out, so a menu can count what each option WOULD give
// with everything else still applied.
export function passesFilters(deal: any, f: BoardFilters, thresholds?: ThresholdMap,
                              skip?: FilterKey | 'nudge'): boolean {
  for (const k of FILTER_KEYS) {
    if (skip === k) continue
    const want = f[k]
    if (want.length && !want.includes(valueOf(deal, k))) return false
  }
  if (skip !== 'nudge' && f.nudge && !needsAttention(deal, thresholds)) return false
  return true
}

export function applyFilters(deals: any[], f: BoardFilters, thresholds?: ThresholdMap): any[] {
  if (!anyFilter(f)) return deals || []
  return (deals || []).filter(d => passesFilters(d, f, thresholds))
}

export function anyFilter(f: BoardFilters): boolean {
  return countFilters(f) > 0
}

export function countFilters(f: BoardFilters): number {
  return f.broker.length + f.officer.length + f.lender.length + (f.nudge ? 1 : 0)
}

export function toggleValue(f: BoardFilters, which: FilterKey, value: string): BoardFilters {
  const v = txt(value)
  if (!v) return f
  const had = f[which].includes(v)
  return { ...f, [which]: had ? f[which].filter(x => x !== v) : [...f[which], v] }
}

// --- what the menu offers ----------------------------------------------------

export type FilterOption = { value: string; label: string; count: number; picked: boolean }

// EVERY VALUE THE BOOK ACTUALLY HOLDS, with how many deals each would leave.
//
// Counted with every OTHER filter still on, so once a broker is picked the
// lender list says what that broker has. An option that would empty the board
// comes back with a zero rather than being left out: a lender missing from the
// list reads as "no deals anywhere", and a lender showing 0 reads as "not with
// what you have already picked", which is the truth.
export function optionsFor(deals: any[], which: FilterKey, f: BoardFilters,
                           thresholds?: ThresholdMap,
                           labelFor?: (value: string) => string): FilterOption[] {
  const values = new Set<string>()
  for (const d of deals || []) {
    const v = valueOf(d, which)
    if (v) values.add(v)
  }
  // Anything already picked stays on the list even if nothing matches it now,
  // or a filter could become impossible to turn off.
  for (const v of f[which]) values.add(v)

  const visible = (deals || []).filter(d => passesFilters(d, f, thresholds, which))
  return [...values]
    .map(value => ({
      value,
      label: labelFor ? (labelFor(value) || value) : value,
      count: visible.filter(d => valueOf(d, which) === value).length,
      picked: f[which].includes(value),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function nudgeCount(deals: any[], f: BoardFilters, thresholds?: ThresholdMap): number {
  return (deals || [])
    .filter(d => passesFilters(d, f, thresholds, 'nudge') && needsAttention(d, thresholds)).length
}

// --- saying what is on -------------------------------------------------------

export type FilterChip = { which: FilterKey | 'nudge'; value: string; label: string }

// THE CHIPS ON THE BAR. Everything that is on, in words, each one droppable
// without opening the panel - because a filter you have to go looking for to
// turn off is a filter that stays on by accident.
export function filterChips(f: BoardFilters, labelFor?: (which: FilterKey, value: string) => string): FilterChip[] {
  const out: FilterChip[] = []
  if (f.nudge) out.push({ which: 'nudge', value: 'nudge', label: 'Needs attention' })
  for (const k of FILTER_KEYS) {
    for (const v of f[k]) {
      out.push({ which: k, value: v, label: (labelFor ? labelFor(k, v) : '') || v })
    }
  }
  return out
}

// HOW A COLUMN'S COUNT READS. Null total means nothing is filtered, and the
// column says one number as it always has. Otherwise BOTH, because "3" on a
// filtered column is exactly how a filtered board gets mistaken for the book.
//
// Out here rather than inside the board so it can be tested: the first version
// lived in the component, and gutting it left every test green.
export function columnCountLabel(shown: number, total: number | null): string {
  return total === null ? String(shown) : `${shown}/${total}`
}

// "Showing 14 of 41 deals". Always both numbers - see the note at the top of
// this file about the nine hidden deals.
export function showingLine(shown: number, total: number): string {
  return `Showing ${shown} of ${total} deal${total === 1 ? '' : 's'}`
}

// --- what is safe to remember ------------------------------------------------

// A FILTER IS REMEMBERED, WHICH MEANS IT CAN COME BACK WRONG.
//
// Fabio chose sticky filters, and they are read back from a person's profile
// where anything could be sitting - a broker who has left, a lender renamed, a
// shape from an older version. Trusted as-is, a stale value silently hides every
// deal and the board looks empty on a Monday morning.
//
// So what comes back is checked into shape, and anything that is not a list of
// strings is dropped. It is a view, never a record; the safe direction is always
// "show everything".
export function readFilters(raw: any): BoardFilters {
  const list = (v: any): string[] =>
    Array.isArray(v) ? [...new Set(v.map(txt).filter(Boolean))] : []
  if (!raw || typeof raw !== 'object') return NO_FILTERS
  return {
    broker: list(raw.broker),
    officer: list(raw.officer),
    lender: list(raw.lender),
    nudge: raw.nudge === true,
  }
}
