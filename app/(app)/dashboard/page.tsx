import { createSupabaseServer } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'
import { TEAM_VIEW_BROKERS, hasTeamViewAccess } from '@/lib/access-control'

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

  // Three cases:
  // 1. No broker_key at all (Kylie, Alan — admin/staff with no personal book):
  //    always full team view, no toggle.
  // 2. broker_key is in the allowlist (Fabio, Mark): full team data fetched,
  //    toggle shown so they can switch between their own and everyone's.
  // 3. broker_key exists but is NOT in the allowlist (Justin, Keanen, future
  //    brokers): server-side filter restricts the fetch to their own deals
  //    only — this is an access-control boundary, not a display choice.
  const hasTeamAccess = hasTeamViewAccess(brokerKey)

  let dealsQuery = supabase
    .from('deals')
    .select('*, clients(first_name, last_name)')
    .order('created_at', { ascending: false })

  if (!hasTeamAccess && brokerKey) {
    dealsQuery = dealsQuery.eq('assigned_broker', brokerKey)
  }

  const { data: deals } = await dealsQuery

  const allowToggle = (!!brokerKey && TEAM_VIEW_BROKERS.includes(brokerKey.toLowerCase())) || !!creditOfficerId

  return (
    <DashboardClient
      deals={deals || []}
      fullName={profile?.full_name || null}
      brokerKey={brokerKey}
      creditOfficerId={creditOfficerId}
      allowToggle={allowToggle}
    />
  )
}
