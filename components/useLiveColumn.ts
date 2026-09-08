'use client'
import { useEffect } from 'react'
import { foldIn, isMine, type DealColumn } from '@/lib/live-deal'
import { adopt, type SaveGuard } from '@/lib/save-conflict'

// ONE COPY OF "SOMEBODY ELSE JUST SAVED", FOR ALL FOUR TABS.
//
// Written once rather than four times, because four copies of a rule is four
// places for it to be subtly different - which is how a field can quietly stop
// being merged on one tab and nobody notices for a month.
//
// The rule, in full: take the fields they changed and this person has not
// touched. Leave everything else exactly as it is. If they both changed the
// same field, leave the screen completely alone - the person is looking at
// their own version and about to save it, and yanking it out from under them
// mid-sentence is worse than the disagreement.
export function useLiveColumn({ live, column, meId, guard, current, apply }: {
  live?: { row: any; at: number } | null
  column: DealColumn
  meId?: string | null
  guard: SaveGuard
  // What is on screen right now, including anything half typed.
  current: () => any
  // Put the folded record back on screen. Each tab holds its state differently.
  apply: (value: any) => void
}) {
  // Deliberately keyed on the moment the update arrived, not on the row. Two
  // saves a second apart can carry identical data for this column - a stamp is
  // the only honest "this is a new event".
  useEffect(() => {
    const row = live?.row
    if (!row) return

    // My own save coming back. Folding it onto myself is at best wasted work,
    // and on a slow connection it lands after the next keystroke and eats it.
    if (isMine({ incoming: null, byId: row.last_saved_by, byName: row.last_saved_name,
                 version: row.row_version ?? null }, meId)) return

    const incoming = row[column]
    if (incoming === undefined) return

    // What the database held when this screen last agreed with it.
    let base: any = null
    try { base = guard.db ? JSON.parse(guard.db) : null } catch { base = null }

    const fold = foldIn(base, incoming, current())
    if (fold.kind !== 'take') return

    apply(fold.value)
    // The record now says what they saved, whatever is additionally on screen.
    adopt(guard, incoming)
  }, [live?.at])
}
