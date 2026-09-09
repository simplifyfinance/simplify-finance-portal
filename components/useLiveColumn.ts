'use client'
import { useEffect, useRef } from 'react'
import { foldIn, isMine, LIVE_EDITING, type DealColumn } from '@/lib/live-deal'
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

// LIVE EDITING IS OFF.
//
// Turned off 9 Sep 2026, after it ate Kylie's writing twice in two days.
//
// The first fault was a race and I fixed it. This is a different thing and it
// is structural: applying somebody else's save changes this screen, a changed
// screen autosaves, and that save arrives on THEIR screen, which changes, which
// autosaves back. Two browsers hand the same text back and forth, and every lap
// carries a copy of it that is a second or two old. Type into it during a lap
// and the older copy lands on top - which is Kylie watching letters, spaces and
// full stops vanish out of a sentence she had already written.
//
// A screen must not save what it was just handed BY the database. That is the
// fix, it is not difficult, and it is not going in blind for a third time: it
// goes back on when somebody has sat with two windows open and watched it
// behave. One line, here.
//
// Until then the deal page works exactly as it did on Monday morning - each
// browser knows what it loaded, and the save guard, the history and the wipe
// guard all carry on as they are. Nothing that protects data is switched off by
// this.
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
    if (!LIVE_EDITING) return
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
