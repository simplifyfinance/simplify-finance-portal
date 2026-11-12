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

  // WHO IS LOOKING. The role already on their login decides what the page
  // draws - see lib/who-sees-the-numbers.ts. Read on the server, so it cannot
  // be changed by anybody's browser.
  const { data: profile } = await supabase.from('user_profiles')
    .select('role, broker_key, full_name').eq('id', user.id).maybeSingle()

  // `team` comes with the names: the reports add Simplify Finance and Simplify
  // Finance Brokers up off the group dropdown in Settings -> Broker profiles.
  // It is NOT a brand - a brand is a credit licence. See lib/which-team.ts.
  const { data: brokerRows } = await supabase.from('brokers')
    .select('broker_key, name, team, active')
  const brokerNames: Record<string, string> = {}
  for (const b of (brokerRows || []) as any[]) {
    const k = String(b.broker_key || '').toLowerCase()
    const n = String(b.name || '').trim()
    if (k && n) brokerNames[k] = n
  }

  // THE REFERRAL PARTNERS, their contact and the note he saved last time, and
  // the brands - only the banner on the partner note uses those. See
  // components/PartnerNote.tsx.
  const [{ data: splitRows }, { data: settings }] = await Promise.all([
    supabase.from('commission_splits')
      .select('id, name, kind, who, contact_email, note_template, last_sent_at, last_sent_by, active'),
    supabase.from('settings').select('brands').eq('id', 'singleton').maybeSingle(),
  ])

  return (
    <Lodgements
      deals={realDealsOnly(rows as any[])}
      brokerNames={brokerNames}
      brokerRows={(brokerRows || []) as any[]}
      splits={(splitRows || []) as any[]}
      brands={((settings as any)?.brands || []) as any[]}
      role={(profile as any)?.role || ''}
      brokerKey={(profile as any)?.broker_key || ''}
      meName={(profile as any)?.full_name || ''}
    />
  )
}
