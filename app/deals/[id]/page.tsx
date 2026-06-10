import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DealPageClient from './DealPageClient'

type DealWithClient = {
  id: string
  deal_name: string
  deal_type: string
  assigned_broker: string
  clients: { first_name: string; last_name: string }
}

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: deal, error } = await supabase
    .from('deals')
    .select('*, clients(first_name, last_name)')
    .eq('id', id)
    .single()

  if (error || !deal) return notFound()

  return <DealPageClient deal={deal as DealWithClient} />
}
