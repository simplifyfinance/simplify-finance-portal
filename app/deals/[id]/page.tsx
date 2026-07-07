import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import DealPageClient from './DealPageClient'

type DealWithClient = {
  id: string
  deal_name: string
  deal_type: string
  assigned_broker: string
  clients: { first_name: string; last_name: string; email?: string }
}

export default async function DealPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ stage?: string }> }) {
  const { id } = await params
  const { stage } = await searchParams
  const supabase = await createSupabaseServer()
  const { data: deal, error } = await supabase
    .from('deals')
    .select('*, clients(first_name, last_name, email)')
    .eq('id', id)
    .single()

  if (error || !deal) return notFound()

  return <DealPageClient deal={deal as DealWithClient} initialStage={stage} />
}
