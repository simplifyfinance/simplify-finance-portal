'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createSupabaseBrowser } from './supabase-browser'
import { NO_FILTERS, readFilters, toggleValue, type BoardFilters, type FilterKey } from './board-filters'

// THE FILTERS THIS PERSON LEFT ON, remembered against their login.
//
// Same shape as useColumnFolds beside it, and for the same reason: a filter is
// one person's view of their own board, never a setting. Fabio, 30 Sep 2026,
// choosing between sticky and fresh: "Remember them, but say so loudly."
//
// The loud half is the bar in components/BoardFilters.tsx. This half is the
// remembering, and it degrades exactly the way the folds do - no column in
// user_profiles yet means nothing comes back, nothing is filtered, and the board
// is the board. Nothing here may break a screen because a migration has not run.
//
// THE WRITE IS FIRE AND FORGET. A refused write leaves the filter on for this
// session and gone at the next login, which is no worse than never having set
// it. Blocking the click on a round trip, or throwing a banner across the board
// because a preference did not save, would both be worse than that.
export function useBoardFilters() {
  const [filters, setFilters] = useState<BoardFilters>(NO_FILTERS)
  const [ready, setReady] = useState(false)
  const userId = useRef<string | null>(null)

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    let alive = true
    supabase.auth.getUser().then(({ data }) => {
      const id = data?.user?.id || null
      userId.current = id
      if (!id) { if (alive) setReady(true); return }
      supabase.from('user_profiles').select('board_filters').eq('id', id).maybeSingle()
        .then(({ data: row }: any) => {
          if (!alive) return
          // Checked into shape rather than trusted - see readFilters.
          setFilters(readFilters(row?.board_filters))
          setReady(true)
        })
    })
    return () => { alive = false }
  }, [])

  // ONE PLACE WRITES IT, so there is one thing to reason about rather than
  // three copies of the same round trip.
  //
  // fire-and-forget: this is one person's view of their own board, not a record
  // of anything. A refused write leaves the filter on for the rest of this
  // session and gone at the next login, which is no worse than never having set
  // it. Blocking the click on a round trip, or throwing an error banner across
  // the board because a preference did not save, would both be worse than that.
  // The bar above the board always says what is on, so nothing can be hidden by
  // a filter that failed to save either way.
  const remember = useCallback((next: BoardFilters) => {
    const id = userId.current
    if (!id) return
    createSupabaseBrowser().from('user_profiles')
      .update({ board_filters: next }).eq('id', id).then(() => {})
  }, [])

  const change = useCallback((make: (prev: BoardFilters) => BoardFilters) => {
    setFilters(prev => {
      const next = make(prev)
      remember(next)
      return next
    })
  }, [remember])

  const toggle = useCallback((which: FilterKey, value: string) => {
    change(prev => toggleValue(prev, which, value))
  }, [change])

  const toggleNudge = useCallback(() => {
    change(prev => ({ ...prev, nudge: !prev.nudge }))
  }, [change])

  const clear = useCallback(() => change(() => NO_FILTERS), [change])

  return { filters, toggle, toggleNudge, clear, ready }
}
