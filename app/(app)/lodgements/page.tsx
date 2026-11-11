import { createSupabaseServer } from '@/lib/supabase-server'
import { everyRow } from '@/lib/the-whole-book'
import { realDealsOnly, REAL_DEALS_OR } from '@/lib/test-deal'
import { redirect } from 'next/navigation'
import Lodgements from '@/components/Lodgements'

export const metadata = { title: 'Lodged and settled' }

export default async function LodgementsPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // THE WHOLE BOOK, A PAGE AT A TIME. A report built on the newest thousand
  // deals is a report that quietly stops counting the year. See
  // lib/the-whole-book.ts.
  const { rows } = await everyRow<any>((from, to) => supabase
    .from('deals').select('*').or(REAL_DEALS_OR)
    .order('created_at', { ascending: false }).order('id').range(from, to))

  const { data: brokerRows } = await supabase.from('brokers').select('broker_key, name')
  const brokerNames: Record<string, string> = {}
  for (const b of (brokerRows || []) as any[]) {
    const k = String(b.broker_key || '').toLowerCase()
    const n = String(b.name || '').trim()
    if (k && n) brokerNames[k] = n
  }

  return <Lodgements deals={realDealsOnly(rows as any[])} brokerNames={brokerNames} />
}
