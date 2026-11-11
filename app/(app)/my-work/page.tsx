import { createSupabaseServer } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import MyWork from '@/components/MyWork'

export const metadata = { title: 'My work' }

// A CREDIT OFFICER'S OWN LIST.
//
// Alan's item 3. Who this person is comes from the server, so the page cannot
// be pointed at somebody else's queue by changing a address bar.

export default async function MyWorkPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: officer }, { data: profile }, { data: brokerRows }] = await Promise.all([
    supabase.from('credit_officers').select('id, name').eq('user_id', user.id)
      .eq('active', true).maybeSingle(),
    supabase.from('user_profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase.from('brokers').select('broker_key, name'),
  ])

  const brokerNames: Record<string, string> = {}
  for (const b of (brokerRows || []) as any[]) {
    const k = String(b.broker_key || '').toLowerCase()
    const n = String(b.name || '').trim()
    if (k && n) brokerNames[k] = n
  }

  return (
    <MyWork
      officerId={(officer as any)?.id || null}
      officerName={(officer as any)?.name || (profile as any)?.full_name || ''}
      brokerNames={brokerNames}
    />
  )
}
