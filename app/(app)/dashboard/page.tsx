import { createSupabaseServer } from '@/lib/supabase-server'
import { realDealsOnly } from '@/lib/test-deal'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'
import TodayPlan from '@/components/TodayPlan'
import { todayYmd } from '@/lib/periods'

export const metadata = { title: 'Today' }

export default async function Dashboard() {
  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, broker_key, full_name')
    .eq('id', user.id)
    .single()

  const brokerKey = profile?.broker_key || null

  const { data: creditOfficerRecord } = await supabase
    .from('credit_officers')
    .select('id')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle()
  const creditOfficerId = creditOfficerRecord?.id || null


  // Who this person can see is decided by the database, not by a list in the code.
  // auth_visible_broker_keys() returns their own broker key plus any they have been
  // granted; auth_sees_all_deals() is the explicit flag. Row level security has
  // already applied both to the query below - this only decides what the screen offers.
  const [{ data: visibleKeys }, { data: seesAll }] = await Promise.all([
    supabase.rpc('auth_visible_broker_keys'),
    supabase.rpc('auth_sees_all_deals'),
  ])
  const keys: string[] = (visibleKeys as string[]) || []
  const hasTeamAccess = !!seesAll || keys.length > 1

  let dealsQuery = supabase
    .from('deals')
    .select('*, clients(first_name, last_name)')
    .order('created_at', { ascending: false })

  const { data: rawDeals } = await dealsQuery
  // TEST DEALS ARE NOT THE BUSINESS. One rule, in lib/test-deal.ts, asked by
  // every screen that counts - so the dashboard, the workload page and the
  // settlements list can never disagree about what is in the book.
  const deals = realDealsOnly(rawDeals as any[])

  // Broker names come from the register, never from the key stored on a deal.
  // The key is lower case by design and was being printed straight onto the
  // screen, so every broker read as "fabio" or "kylie".
  const { data: brokerRows } = await supabase.from('brokers').select('broker_key, name')
  const brokerNames: Record<string, string> = {}
  for (const b of (brokerRows || []) as any[]) {
    const k = String(b.broker_key || '').toLowerCase()
    const n = String(b.name || '').trim()
    if (k && n) brokerNames[k] = n
  }

  const allowToggle = !!brokerKey && hasTeamAccess
  const defaultView: 'team' | 'mine' = creditOfficerId ? 'mine' : 'team'

  // TODAY, ABOVE EVERYTHING ELSE ON THIS PAGE.
  //
  // 22 Oct 2026. The morning email the credit team send, in the portal - see
  // components/TodayPlan.tsx. The date comes from the server so three people
  // in three places cannot disagree about which day it is.
  // THE SYDNEY DAY. toISOString() is the UTC day, and this server runs in UTC
  // - so for the first eleven hours of every Australian working day a plan
  // would have been filed against yesterday's date. Same fault as
  // lib/rate-notice.ts on 9 Oct. See todayYmd() in lib/periods.ts.
  const today = todayYmd()
  const [{ data: officerRows }, { data: planRows }] = await Promise.all([
    supabase.from('credit_officers').select('id, name').eq('active', true).order('name'),
    supabase.from('daily_plans').select('officer_id, deal_ids, confirmed_at').eq('plan_date', today),
  ])
  const officers = (officerRows || []).map((o: any) => ({ id: o.id, name: o.name }))
  const byOfficer = new Map((planRows || []).map((p: any) => [p.officer_id, p]))
  // One row per assessor whether they have a plan or not - the board is about
  // who HAS NOT, so somebody with no row has to appear on it.
  const plans = officers.map(o => ({
    officerId: o.id,
    officerName: o.name,
    confirmedAt: byOfficer.get(o.id)?.confirmed_at || null,
    deals: (byOfficer.get(o.id)?.deal_ids || []).map((id: string) => ({
      id, name: '', stage: '', since: null,
    })),
  }))

  return (
    <>
    <div className="px-6 pt-6">
      <TodayPlan
        deals={deals || []}
        officers={officers}
        plans={plans}
        meOfficerId={creditOfficerId}
        meName={profile?.full_name || ''}
        today={today}
      />
    </div>
    <DashboardClient
      deals={deals || []}
      fullName={profile?.full_name || null}
      brokerKey={brokerKey}
      creditOfficerId={creditOfficerId}
      allowToggle={allowToggle}
      defaultView={defaultView}
      brokerNames={brokerNames}
    />
    </>
  )
}
