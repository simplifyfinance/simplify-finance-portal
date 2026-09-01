import { notFound, redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import DealNoAccess from '@/components/DealNoAccess'
import DealPageClient from './DealPageClient'
import { phaseOf, tabForPhase } from '@/lib/deal-phase'

type DealWithClient = {
  id: string
  deal_name: string
  deal_type: string
  assigned_broker: string
  assigned_credit_officer?: string | null
  clients: { first_name: string; last_name: string; email?: string }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServer()
  const { data } = await supabase.from('deals').select('deal_name').eq('id', id).single()
  return { title: data?.deal_name ? `${data.deal_name} — Simplify Finance` : 'Simplify Finance Portal' }
}

export default async function DealPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ stage?: string }> }) {
  const { id } = await params
  const { stage } = await searchParams
  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const userRole = profile?.role || ''

  // The database is the only judge of who may see a deal. This query runs as the
  // signed-in user, so row level security has already applied the flags and the
  // broker grants. There is deliberately no second copy of those rules here - a
  // hardcoded copy is how the app and the database drift apart.
  const { data: deal } = await supabase
    .from('deals')
    .select('*, clients(first_name, last_name, email)')
    .eq('id', id)
    .maybeSingle()

  if (!deal) {
    // Nothing came back. Either the deal does not exist, or it does and this person
    // may not open it. Those need different answers, so ask.
    const { data: exists } = await supabase.rpc('deal_exists', { p_deal_id: id })
    if (exists) return <DealNoAccess />
    return notFound()
  }

  return <DealPageClient deal={deal as DealWithClient} initialStage={stage || deal.last_tab || tabForPhase(phaseOf(deal))} userRole={userRole} />
}
