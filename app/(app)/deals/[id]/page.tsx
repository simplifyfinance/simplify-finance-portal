import { notFound, redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import DealNoAccess from '@/components/DealNoAccess'
import DealPageClient from './DealPageClient'


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

  // A DEAL OPENS ON THE FACT FIND. ALWAYS.
  //
  // It used to open on whichever tab the deal's phase said it had reached, or on
  // whichever tab anybody last clicked. Both meant that opening a deal to read
  // it landed you in the BC - and the fact find is where the internal notes, the
  // purpose and the client's goals are. That is what somebody opening a deal
  // wants to see first, whatever stage the deal has reached.
  //
  // Fabio, 7 Sep 2026: "I wanted to open on the first tab, which is the fact find
  // tab. The fact find tab that has internal notes, the purpose and the goals of
  // the deal. That's the point of opening the deal for the first time."
  //
  // A link that names a tab still wins - the board's "open at compliance", the
  // ready-to-proceed emails, "Open BC tab" - because that is somebody asking for
  // a particular tab rather than opening the deal.
  return <DealPageClient deal={deal as DealWithClient} initialStage={stage || 'FactFind'} userRole={userRole} />
}
