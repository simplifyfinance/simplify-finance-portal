'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createSupabaseBrowser } from './supabase-browser'
import { PHASE_ORDER } from './deal-phase'
import { LANE_KEYS, GROUP_FOLD_KEYS } from './the-board-columns'

// Which board columns this person has folded away, remembered against their login.
//
// The board went from nine columns to twelve on 2 Sep 2026 and it scrolls, which
// is fine - Fabio, 2 Sep 2026: "the boards needs all boxes ans 12 no issues same
// sixe just make sure we cna go back and forwards oin the screen". But the
// settlements team never look at Fact Find and the credit team never look at
// Settlement booked, so each of them can shut the columns they do not use, and
// it is still shut next time they log in.
//
// Per person, deliberately. A fold is a view, not a setting: one person hiding a
// column must never hide it for anybody else.
//
// It degrades. If user_profiles has no board_folds column yet the query comes
// back empty, nothing is folded, and the board is exactly the board - the same
// rule the rest of the board settings follow. Nothing here should break a screen
// because a migration has not been run.

// A COLUMN IS A LANE NOW, NOT A STAGE.
//
// 18 Nov 2026. BC became two columns and Compliance sent became the client
// half of Compliance, so the keys changed. The old stage keys are still
// accepted, because somebody who folded "bc" away last week should not log in
// to a board that quietly unfolded itself - and an old key that no longer
// matches a column simply folds nothing, which is what it already did.
// 17 Nov 2026: A WHOLE STAGE CAN BE FOLDED NOW, not only a column.
//
// Fabio: "when settlements is looking at one, they don't care about new
// inquiries, BC, LO... and credit don't care about settlements. I want to be
// able to press a button on the black bar and that black bar will fold." So
// the group keys join the list, prefixed - see GROUP_FOLD_KEYS.
//
// Per person, per browser, any combination. Fabio, asked whether there should
// be named views for Credit and Settlements: "I don't want any rules... they
// choose what they want to fold, they do whatever they want."
const REAL_COLUMNS: string[] = [...LANE_KEYS, 'lost', ...PHASE_ORDER, ...GROUP_FOLD_KEYS]

export function useColumnFolds() {
  const [folds, setFolds] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const userId = useRef<string | null>(null)

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    let alive = true
    supabase.auth.getUser().then(({ data }) => {
      const id = data?.user?.id || null
      userId.current = id
      if (!id) { if (alive) setReady(true); return }
      supabase.from('user_profiles').select('board_folds').eq('id', id).maybeSingle()
        .then(({ data: row }: any) => {
          if (!alive) return
          // Checked against the real columns rather than trusted. A column
          // renamed or removed later leaves a key behind that means nothing, and
          // a stale key must not quietly fold something else.
          const raw = row?.board_folds
          setFolds(Array.isArray(raw) ? raw.filter((x: any): x is string => REAL_COLUMNS.includes(x)) : [])
          setReady(true)
        })
    })
    return () => { alive = false }
  }, [])

  const toggle = useCallback((key: string) => {
    setFolds(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      const id = userId.current
      if (id) {
        // fire-and-forget: this is one person's view of their own board, not a
        // record of anything. If the write is refused the column is still folded
        // for the rest of this session and comes back open at the next login,
        // which is the same as never having folded it. Blocking the fold on a
        // round trip, or throwing an error banner across the board because a
        // preference did not save, would both be worse than that.
        createSupabaseBrowser().from('user_profiles')
          .update({ board_folds: next }).eq('id', id).then(() => {})
      }
      return next
    })
  }, [])

  return { folds, toggle, ready }
}
