import { createSupabaseServer } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import WorkloadClient from './WorkloadClient'

export default async function CreditTeamWorkloadPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/deals')

  return <WorkloadClient />
}
