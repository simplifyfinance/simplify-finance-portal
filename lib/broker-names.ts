'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from './supabase-browser'
import { brokerKey, brokerLabel } from './broker-key'

// A broker's key is the join. Their name is what a person reads. Three screens
// each queried the register for both and then mapped to the key, throwing the
// name away, so brokers appeared as "fabio" and "kylie" all over the portal.
//
// One loader, so the next screen cannot repeat it.

export type BrokerOption = { key: string; name: string }

export function useBrokerNames(includeInactive = false) {
  const [options, setOptions] = useState<BrokerOption[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    supabase.from('brokers').select('broker_key, name, active').order('name')
      .then(({ data }) => {
        setOptions((data || [])
          .filter((b: any) => includeInactive || b.active !== false)
          .map((b: any) => ({
            key: brokerKey(b.broker_key),
            // A tidied key is the fallback, and only for a profile that has no
            // name recorded yet - never for a name we did not bother to fetch.
            name: String(b.name || '').trim() || brokerLabel(b.broker_key),
          }))
          .filter((b: BrokerOption) => b.key))
        setReady(true)
      })
  }, [includeInactive])

  function nameFor(v: unknown): string {
    const k = brokerKey(v)
    if (!k) return '—'
    return options.find(o => o.key === k)?.name || brokerLabel(k)
  }

  return { options, nameFor, ready }
}
