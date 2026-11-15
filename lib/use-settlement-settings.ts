'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { settlementSettings, SETTLEMENT_DEFAULTS, type SettlementSettings } from './settlement-settings'

// THE SETTLEMENT NUMBERS, READ ONCE PER SCREEN.
//
// Same shape as useBoardSettings. It starts on the defaults rather than on
// nothing, so a screen draws correctly on its first frame and never flickers
// from "no chase times" to "chase times" while the row comes back.
export function useSettlementSettings(): SettlementSettings {
  const supabase = createSupabaseBrowser()
  const [s, setS] = useState<SettlementSettings>(SETTLEMENT_DEFAULTS)
  useEffect(() => {
    let alive = true
    supabase.from('settings').select('settlements').eq('id', 'singleton').maybeSingle()
      .then(({ data }: any) => { if (alive && data) setS(settlementSettings(data.settlements)) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return s
}
