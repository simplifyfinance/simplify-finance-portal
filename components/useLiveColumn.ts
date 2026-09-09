'use client'
import { useEffect, useRef } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { foldIn, isMine, LIVE_EDITING, type DealColumn } from '@/lib/live-deal'
import { adopt, type SaveGuard } from '@/lib/save-conflict'

// SOMEBODY ELSE JUST SAVED.
//
// Two rules, both learned the hard way on 9 Sep 2026.
//
// ONE: THE LISTENING LIVES HERE, NOT ON THE PAGE.
//
// The first version kept the incoming save in a piece of state on the deal
// page. Every save from anybody - including your own coming back - set that
// state, and setting state there re-renders the whole page: the header, the
// pipeline, the documents strip, and the box being typed into. A keystroke
// that lands during that render is swallowed, which is a letter vanishing out
// of a finished sentence with nothing to explain it. Kylie: "it is deleting
// letters, and spaces, and dots."
//
// Only the tab on screen is mounted, so this is one subscription either way -
// it just no longer drags the entire page through a render to deliver it.
//
// TWO: NEVER WHILE SOMEBODY IS TYPING.
//
// The merge only takes fields this person has not changed, but "has not
// changed" is judged against the last version the screen agreed with the
// database on, and between a keystroke and the render that records it there is
// a gap. An update landing inside that gap compares against the box as it was
// before the letter. So nothing is folded onto a screen typed on in the last
// second and a half; it waits for a pause.
const QUIET_MS = 1500
const RETRY_MS = 400

export function useLiveColumn({ dealId, column, meId, guard, current, apply }: {
  dealId: string
  column: DealColumn
  meId?: string | null
  guard: SaveGuard
  // What is on screen right now, including anything half typed.
  current: () => any
  // Put the folded record back on screen. Each tab holds its state differently.
  apply: (value: any) => void
}) {
  const lastTyped = useRef(0)
  const pending = useRef<any>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Any real input counts. Somebody reading the screen is not somebody who
  // would lose a letter.
  useEffect(() => {
    const typed = () => { lastTyped.current = Date.now() }
    window.addEventListener('keydown', typed, { passive: true })
    window.addEventListener('paste', typed, { passive: true })
    return () => {
      window.removeEventListener('keydown', typed)
      window.removeEventListener('paste', typed)
    }
  }, [])

  // Read through a ref so the waiting timer always folds against what is on
  // screen NOW, never against what it was when the update arrived.
  const latest = useRef({ current, apply, guard, meId })
  latest.current = { current, apply, guard, meId }

  useEffect(() => {
    if (!LIVE_EDITING) return
    const supabase = createSupabaseBrowser()

    const tryApply = () => {
      timer.current = null
      const waiting = pending.current
      if (waiting === null) return

      // Still going. Come back rather than reaching into the box they are in.
      if (Date.now() - lastTyped.current < QUIET_MS) {
        timer.current = setTimeout(tryApply, RETRY_MS)
        return
      }

      pending.current = null
      const { current: now, apply: put, guard: g } = latest.current
      let base: any = null
      try { base = g.db ? JSON.parse(g.db) : null } catch { base = null }

      const fold = foldIn(base, waiting, now())
      if (fold.kind !== 'take') return
      put(fold.value)
      // The record now says what they saved, whatever else is on screen. This
      // is also what stops a save going straight back out: with nothing of our
      // own on top, the next autosave finds the database already agrees and
      // writes nothing. See saveGuarded.
      adopt(g, waiting)
    }

    const channel = supabase
      .channel(`deal-live-${dealId}-${column}`)
      .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'deals', filter: `id=eq.${dealId}` },
          (payload: any) => {
            const row = payload?.new
            if (!row) return
            // My own save coming back is not news.
            if (isMine({ incoming: null, byId: row.last_saved_by, byName: row.last_saved_name,
                         version: row.row_version ?? null }, latest.current.meId)) return
            if (row[column] === undefined) return
            pending.current = row[column]
            if (timer.current) clearTimeout(timer.current)
            timer.current = setTimeout(tryApply, QUIET_MS)
          })
      .subscribe()

    return () => {
      if (timer.current) { clearTimeout(timer.current); timer.current = null }
      supabase.removeChannel(channel)
    }
  }, [dealId, column])
}
