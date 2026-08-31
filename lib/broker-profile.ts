import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { sameBroker } from '@/lib/broker-key'

export type BrokerProfile = {
  id?: string; brokerKey?: string; name: string; title?: string; crn?: string
  email?: string; calendly?: string; brandIds?: string[]
}

// One broker record, in public.brokers, keyed by broker_key. It exists whether or
// not the person has a login. The old settings.brokers list is still read as a
// fallback so a document can never lose a credit representative number during the
// changeover - those go on client-facing documents, so a stale or missing value is
// a compliance problem, not a cosmetic one.
export async function resolveBrokerProfile(key: string | null | undefined): Promise<BrokerProfile | null> {
  if (!key) return null
  const wanted = String(key).trim().toLowerCase()
  if (!wanted) return null
  try {
    const supabase = createSupabaseAdmin()

    // Deals store whatever the broker was called when the deal was made - a key,
    // a first name, or a full name. Matching on the key alone would silently lose
    // people, so the same three-way match the old list used is kept here.
    const { data: all } = await supabase
      .from('brokers')
      .select('broker_key, name, title, crn, calendly, brand_ids, user_id')

    const rows = (all || []) as any[]
    const row = rows.find(b => sameBroker(b.broker_key, wanted))
      || rows.find(b => String(b.name || '').trim().toLowerCase() === wanted)
      || rows.find(b => String(b.name || '').trim().toLowerCase().split(' ')[0] === wanted)

    if (row) {
      // The email is not a broker fact - it belongs to their login.
      let email: string | undefined
      if ((row as any).user_id) {
        const { data: u } = await supabase.from('user_profiles').select('email').eq('id', (row as any).user_id).maybeSingle()
        email = (u as any)?.email || undefined
      }
      return {
        id: (row as any).broker_key,
        brokerKey: (row as any).broker_key,
        name: (row as any).name,
        title: (row as any).title || undefined,
        crn: (row as any).crn || undefined,
        calendly: (row as any).calendly || undefined,
        brandIds: Array.isArray((row as any).brand_ids) ? (row as any).brand_ids : undefined,
        email,
      }
    }

    const { data } = await supabase.from('settings').select('brokers').eq('id', 'singleton').maybeSingle()
    const list: BrokerProfile[] = Array.isArray((data as any)?.brokers) ? (data as any).brokers : []
    return list.find(b => String((b as any)?.brokerKey || '').trim().toLowerCase() === wanted)
      || list.find(b => {
        const name = String(b?.name || '').trim().toLowerCase()
        const id = String(b?.id || '').trim().toLowerCase()
        return id === wanted || name === wanted || name.split(' ')[0] === wanted
      })
      || null
  } catch {
    return null
  }
}

export function noBrokerMessage(key: string | null | undefined): string {
  return `No broker profile on file for "${key || 'unknown'}". Add one in Settings, Broker profiles, then try again. Nothing was sent.`
}
