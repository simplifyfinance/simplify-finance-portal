// KEEPING WHAT WE ARE ABOUT TO REPLACE.
//
// See docs/deal-history.sql for why this exists. In short: every save in this
// portal overwrote the previous version with no copy kept anywhere, so one bad
// save was permanent - and on 7 Sep 2026 one was.
//
// The judgement here is only about VOLUME. The tabs autosave a second after any
// keystroke, so keeping every version would be tens of thousands of rows a week,
// almost all of them one character apart. Two rules keep it to a useful pile:
//
//   1. Keep a version every few minutes, so there is always something recent.
//   2. ALWAYS keep one when the save is about to remove content - a shrinking
//      record is the only kind anybody has ever wanted back.
//
// Rule 2 is the one that matters and it has no throttle. Rule 1 is convenience.

import { filledCount } from './wipe-guard'

// How often a version is kept when the record is only growing or being tidied.
export const KEEP_EVERY_MS = 3 * 60 * 1000

export type HistoryClock = { lastKeptAt: number }

export function newHistoryClock(): HistoryClock {
  return { lastKeptAt: 0 }
}

// Nothing to keep when there was nothing there, and nothing to keep when the
// save changes nothing.
export function shouldKeep(
  previous: any, next: any, clock: HistoryClock, now: number,
): boolean {
  if (previous === null || previous === undefined) return false
  const had = filledCount(previous)
  if (had === 0) return false
  if (JSON.stringify(previous) === JSON.stringify(next)) return false
  // Anything being removed is kept, always, whatever the clock says.
  if (filledCount(next) < had) return true
  return now - clock.lastKeptAt >= KEEP_EVERY_MS
}

export async function keepVersion(
  supabase: any,
  dealId: string,
  column: string,
  previous: any,
  by: { id?: string | null; name?: string | null } | undefined,
): Promise<void> {
  // fire-and-forget: this is a safety net, not the record. If it cannot be
  // written the save itself must still go ahead - refusing somebody's work
  // because the history table is unreachable would be the tail wagging the dog,
  // and the whole point of today is that nobody gets blocked. A failure is
  // logged so it can be noticed, and the deal is unaffected either way.
  try {
    const { error } = await supabase.from('deal_history').insert({
      deal_id: dealId,
      column_name: column,
      data: previous,
      filled: filledCount(previous),
      replaced_by: by?.id || null,
      replaced_by_name: by?.name || null,
    })
    if (error) console.error('deal_history insert failed', error)
  } catch (e) {
    console.error('deal_history insert threw', e)
  }
}

// ---------------------------------------------------------------------------
// LOOKING AT WHAT WAS KEPT, AND PUTTING ONE BACK.
// ---------------------------------------------------------------------------

export type Version = {
  id: number
  data: any
  filled: number | null
  replacedAt: string
  replacedByName: string | null
}

export async function listVersions(
  supabase: any, dealId: string, column: string, limit = 25,
): Promise<Version[]> {
  const { data, error } = await supabase
    .from('deal_history')
    .select('id, data, filled, replaced_at, replaced_by_name')
    .eq('deal_id', dealId).eq('column_name', column)
    .order('replaced_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('deal_history read failed', error); return [] }
  return (data || []).map((r: any) => ({
    id: r.id, data: r.data, filled: r.filled,
    replacedAt: r.replaced_at, replacedByName: r.replaced_by_name,
  }))
}

// "Today at 2:36pm — Mellissa Sedin — 41 things filled in"
export function describeVersion(v: Version, now = new Date()): string {
  const at = new Date(v.replacedAt)
  const sameDay = at.toDateString() === now.toDateString()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  const when = sameDay ? 'Today' : at.toDateString() === yesterday.toDateString() ? 'Yesterday'
    : at.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  const time = at.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
  const who = String(v.replacedByName || '').trim()
  const filled = typeof v.filled === 'number' ? `${v.filled} things filled in` : ''
  return [`${when} at ${time}`, who, filled].filter(Boolean).join(' — ')
}
