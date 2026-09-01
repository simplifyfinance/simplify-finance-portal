'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from './supabase-browser'
import { readBoardSettings, brokerColourMap, type BoardSettings } from './board-settings'

// One loader for everything the board needs to look right: the label colours,
// the stale thresholds, and which broker is which colour.
//
// It degrades on purpose. If the settings row has no deal_board column yet, or
// the brokers table has no colour column, the queries come back empty and every
// read falls through to the defaults in code - which is exactly how the board
// behaved before any of this existed. Nothing on this screen should ever break
// because a migration has not been run.

export type BoardLook = BoardSettings & { broker: Record<string, string> }

const DEFAULTS: BoardLook = { ...readBoardSettings(null), broker: {} }

export function useBoardSettings(): { look: BoardLook; ready: boolean } {
  const [look, setLook] = useState<BoardLook>(DEFAULTS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    let alive = true
    Promise.all([
      supabase.from('settings').select('deal_board').eq('id', 'singleton').maybeSingle(),
      supabase.from('brokers').select('*'),
    ]).then(([s, b]: any[]) => {
      if (!alive) return
      setLook({
        ...readBoardSettings(s?.data?.deal_board),
        broker: brokerColourMap(b?.data || []),
      })
      setReady(true)
    })
    return () => { alive = false }
  }, [])

  return { look, ready }
}
