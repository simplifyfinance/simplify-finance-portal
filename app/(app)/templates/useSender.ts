'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { type Brand, DEFAULT_BRAND, normaliseBrand } from '@/lib/brand'

// Who the email goes out as. Every template needs this and none of them should
// ask the broker to retype what public.brokers already holds, so it lives in one
// hook rather than once per form.
//
// The broker is chosen rather than taken from the login: anyone on the team may
// be the one sending, and the client must still book into the right calendar.

export type Broker = { key: string; name: string; calendly: string; brandIds: string[] }

export function useSender(storageKey: string) {
  const supabase = createSupabaseBrowser()
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [brokerKey, setBrokerKey] = useState('')
  const [calendlyOverride, setCalendlyOverride] = useState('')
  // Which trading name the email goes out under. The borrowing capacity email
  // has had this for a long time; the templates were hardcoded to Simplify.
  const [brandList, setBrandList] = useState<Brand[]>([])
  const [brandId, setBrandId] = useState('')
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
        .select('broker_key, name, calendly, active, brand_ids').order('name')
      const { data: st } = await supabase.from('settings').select('brands').eq('id', 'singleton').maybeSingle()
      const brandRows: Brand[] = Array.isArray((st as any)?.brands) && (st as any).brands.length
        ? (st as any).brands.map(normaliseBrand)
        : [DEFAULT_BRAND]
      setBrandList(brandRows)
      const list: Broker[] = (rows || [])
        .filter((r: any) => r.active !== false)
        .map((r: any) => ({
          key: String(r.broker_key).toLowerCase(),
          name: r.name || r.broker_key,
          calendly: r.calendly || '',
          brandIds: Array.isArray(r.brand_ids) ? r.brand_ids.map(String) : [],
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

  // Only the brands this broker actually trades under, the same rule the
  // borrowing capacity form uses. A broker with none set sees them all rather
  // than an empty list they cannot send from.
  const allowed = broker && broker.brandIds.length
    ? brandList.filter(b => broker.brandIds.includes(b.id))
    : brandList
  const availableBrands = allowed.length ? allowed : brandList

  useEffect(() => {
    if (!availableBrands.length) return
    if (!availableBrands.some(b => b.id === brandId)) setBrandId(availableBrands[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brokerKey, brandList])

  const brand = availableBrands.find(b => b.id === brandId) || availableBrands[0] || DEFAULT_BRAND
  const calendlyUrl = calendlyOverride.trim() || broker?.calendly || ''

  return { brokers, brokerKey, setBrokerKey, broker, calendlyUrl, setCalendlyOverride,
           brands: availableBrands, brandId: brand.id, setBrandId, brand }
}
