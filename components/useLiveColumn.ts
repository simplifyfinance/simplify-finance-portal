'use client'
import { useEffect, useRef } from 'react'
import { foldIn, isMine, type DealColumn } from '@/lib/live-deal'
import { adopt, type SaveGuard } from '@/lib/save-conflict'

// NEVER WHILE SOMEBODY IS TYPING.
//
// The first version of this folded somebody else's save onto the screen the
// instant it arrived. Kylie, 9 Sep 2026, writing the broker summary notes with
// Mellissa sitting idle in the same deal: "the letters disappear so I have to
// go back and type it. So I'm typing it outside of the portal to then just
// paste it in."
//
// Which is the worst possible outcome - it drove somebody out of the portal to
// write in Notepad.
//
// The merge itself is careful: it only takes fields this person has not
// changed. But "has not changed" is judged against the last version the screen
// agreed with the database on, and between a keystroke and the render that
// records it there is a gap. An update landing inside that gap compares against
// a copy of the box from before the letter, decides nobody has touched it, and
// writes the older text back.
//
// The gap is small and it does not need closing cleverly. It needs not being
// stood in. Nothing is folded onto a screen that has been typed on in the last
// second and a half - the update waits, and goes in the moment there is a
// pause. Nobody loses a letter, and the worst case is that somebody else's
// figure appears a second later than it might have.
const QUIET_MS = 1500

// How often to look again while somebody is still going.
const RETRY_MS = 400

export function useLiveColumn({ live, column, meId, guard, current, apply }: {
  live?: { row: any; at: number } | null
  column: DealColumn
  meId?: string | null
  guard: SaveGuard
  current: () => any
  apply: (value: any) => void
}) {
  const lastTyped = useRef(0)
  const pending = useRef<any>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Any real input counts. Not mouse movement, not scrolling - somebody reading
  // the screen is not somebody who would lose a letter.
  useEffect(() => {
    const typed = () => { lastTyped.current = Date.now() }
    window.addEventListener('keydown', typed, { passive: true })
    window.addEventListener('paste', typed, { passive: true })
    return () => {
      window.removeEventListener('keydown', typed)
      window.removeEventListener('paste', typed)
    }
  }, [])

  // Held in a ref so the waiting timer always folds against what is on screen
  // NOW, not against whatever it was when the update arrived. That difference
  // is the entire bug above.
  const latest = useRef({ current, apply, guard, meId })
  latest.current = { current, apply, guard, meId }

  useEffect(() => {
    const row = live?.row
    if (!row) return

    // My own save coming back is not news.
    if (isMine({ incoming: null, byId: row.last_saved_by, byName: row.last_saved_name,
                 version: row.row_version ?? null }, meId)) return
    if (row[column] === undefined) return

    pending.current = row[column]

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
      adopt(g, waiting)
    }

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(tryApply, QUIET_MS)

    return () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }
  }, [live?.at])
}
