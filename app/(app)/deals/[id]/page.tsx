import { notFound, redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { hasTeamViewAccess } from '@/lib/access-control'
import DealPageClient from './DealPageClient'

type DealWithClient = {
  id: string
  deal_name: string
  deal_type: string
  assigned_broker: string
  assigned_credit_officer?: string | null
  clients: { first_name: string; last_name: string; email?: string }
}

export default async function DealPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ stage?: string }> }) {
  const { id } = await params
  const { stage } = await searchParams
  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('broker_key')
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

  const { data: deal, error } = await supabase
    .from('deals')
    .select('*, clients(first_name, last_name, email)')
    .eq('id', id)
    .single()

  if (error || !deal) return notFound()

  // Access check: team-access brokers (Fabio, Mark) and admin/staff with no
  // broker_key (Kylie, Alan) can open any deal. Everyone else must either be
  // the deal's assigned broker or its assigned credit officer.
  const isOwnDeal = !!brokerKey && deal.assigned_broker?.toLowerCase() === brokerKey.toLowerCase()
  const isOwnAllocation = !!creditOfficerId && deal.assigned_credit_officer === creditOfficerId
  const canView = hasTeamViewAccess(brokerKey) || isOwnDeal || isOwnAllocation

  if (!canView) return notFound()

  return <DealPageClient deal={deal as DealWithClient} initialStage={stage || deal.last_tab || deal.stage} />
}
