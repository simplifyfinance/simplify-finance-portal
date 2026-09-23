"use client"
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { clientIdsOn, otherDealsForSameClients, type DealLike } from '@/lib/same-clients'

// THE OTHER DEALS THESE CLIENTS HAVE.
//
// Two reads per client id, because a client reaches a deal two different ways
// and only one of them is a column: `deals.client_id` holds the first
// applicant, and everybody else lives inside `fact_find_data->applicants`. The
// client page has always looked both ways; nothing else did.
//
// A failure here is silent on purpose. This draws a helpful line next to a deal
// name - it is not allowed to put an error in front of somebody over that.
export function useOtherDeals(deal: DealLike | null | undefined): DealLike[] {
  const supabase = createSupabaseBrowser()
  const [others, setOthers] = useState<DealLike[]>([])
  const dealId = deal?.id

  useEffect(() => {
    let alive = true
    setOthers([])
    if (!deal || !dealId) return

    const ids = clientIdsOn(deal)
    if (ids.length === 0) return

    const COLS = 'id, deal_name, client_id, status, is_test, fact_find_data'
    ;(async () => {
      try {
        const found = new Map<string, DealLike>()
        for (const id of ids) {
          const [mine, joint] = await Promise.all([
            supabase.from('deals').select(COLS).eq('client_id', id),
            supabase.from('deals').select(COLS).contains('fact_find_data->applicants', [{ clientId: id }]),
          ])
          for (const d of [...(mine.data || []), ...(joint.data || [])]) {
            if (d && (d as any).id) found.set((d as any).id, d as DealLike)
          }
        }
        if (alive) setOthers(otherDealsForSameClients(deal as any, [...found.values()] as any))
      } catch { /* a name label never interrupts anybody */ }
    })()

    return () => { alive = false }
  }, [dealId])

  return others
}
