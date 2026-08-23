import { createSupabaseServer } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

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

  const { data: deals } = await dealsQuery

  const allowToggle = !!brokerKey && hasTeamAccess
  const defaultView: 'team' | 'mine' = creditOfficerId ? 'mine' : 'team'

  return (
    <DashboardClient
      deals={deals || []}
      fullName={profile?.full_name || null}
      brokerKey={brokerKey}
      creditOfficerId={creditOfficerId}
      allowToggle={allowToggle}
      defaultView={defaultView}
    />
  )
}
