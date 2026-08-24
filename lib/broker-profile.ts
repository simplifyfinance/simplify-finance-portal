import { createSupabaseAdmin } from '@/lib/supabase-admin'

export type BrokerProfile = {
  id?: string; brokerKey?: string; name: string; title?: string; crn?: string
  email?: string; calendly?: string; brandIds?: string[]
}

// The team is not a list in the code. Broker profiles are maintained in
// Settings, and that is the only place a name, title or credit representative
// number should come from - those go on client-facing documents, so a stale
// hardcoded map is a compliance problem, not a cosmetic one.
export async function resolveBrokerProfile(key: string | null | undefined): Promise<BrokerProfile | null> {
  if (!key) return null
  const wanted = String(key).trim().toLowerCase()
  if (!wanted) return null
  try {
    const supabase = createSupabaseAdmin()
    const { data } = await supabase.from('settings').select('brokers').eq('id', 'singleton').maybeSingle()
    const list: BrokerProfile[] = Array.isArray((data as any)?.brokers) ? (data as any).brokers : []
    // The explicit key wins. Name matching stays as a fallback for profiles saved
    // before the key existed, but it is the thing that used to go wrong.
    const hit = list.find(b => String((b as any)?.brokerKey || '').trim().toLowerCase() === wanted)
      || list.find(b => {
        const name = String(b?.name || '').trim().toLowerCase()
        const id = String(b?.id || '').trim().toLowerCase()
        return id === wanted || name === wanted || name.split(' ')[0] === wanted
      })
    return hit || null
  } catch {
    return null
  }
}

export function noBrokerMessage(key: string | null | undefined): string {
  return `No broker profile on file for "${key || 'unknown'}". Add one in Settings, Broker profiles, then try again. Nothing was sent.`
}
