'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

// Who the email goes out as. Every template needs this and none of them should
// ask the broker to retype what public.brokers already holds, so it lives in one
// hook rather than once per form.
//
// The broker is chosen rather than taken from the login: anyone on the team may
// be the one sending, and the client must still book into the right calendar.

export type Broker = { key: string; name: string; calendly: string }

export function useSender(storageKey: string) {
  const supabase = createSupabaseBrowser()
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [brokerKey, setBrokerKey] = useState('')
  const [calendlyOverride, setCalendlyOverride] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) {
        const d = JSON.parse(raw)
        if (d.brokerKey) setBrokerKey(String(d.brokerKey))
      }
    } catch { /* corrupt storage is not worth failing the page over */ }
    setLoaded(true)
  }, [storageKey])

  useEffect(() => {
    if (!loaded) return
    ;(async () => {
      const { data: rows } = await supabase.from('brokers')
        .select('broker_key, name, calendly, active').order('name')
      const list: Broker[] = (rows || [])
        .filter((r: any) => r.active !== false)
        .map((r: any) => ({
          key: String(r.broker_key).toLowerCase(),
          name: r.name || r.broker_key,
          calendly: r.calendly || '',
        }))
      setBrokers(list)
      if (brokerKey) return
      const { data: u } = await supabase.auth.getUser()
      if (u?.user) {
        const { data: prof } = await supabase.from('user_profiles')
          .select('broker_key').eq('id', u.user.id).maybeSingle()
        const mine = String((prof as any)?.broker_key || '').toLowerCase()
        if (mine && list.some(b => b.key === mine)) { setBrokerKey(mine); return }
      }
      if (list.length) setBrokerKey(list[0].key)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  useEffect(() => {
    if (!loaded) return
    try { window.localStorage.setItem(storageKey, JSON.stringify({ brokerKey })) } catch { /* ignore */ }
  }, [brokerKey, loaded, storageKey])

  // A broker with no Calendly on file can still send — the link is typed for
  // that one email rather than the send being blocked.
  useEffect(() => setCalendlyOverride(''), [brokerKey])

  const broker = brokers.find(b => b.key === brokerKey) || null
  const calendlyUrl = calendlyOverride.trim() || broker?.calendly || ''

  return { brokers, brokerKey, setBrokerKey, broker, calendlyUrl, setCalendlyOverride }
}
