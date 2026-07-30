'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

export default function DealSummaryPage() {
  const params = useParams()
  const dealId = params.id as string
  const supabase = createSupabaseBrowser()
  const [deal, setDeal] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function loadDeal() {
    const { data } = await supabase.from('deals').select('*').eq('id', dealId).single()
    if (data) setDeal(data)
    setLoading(false)
  }

  useEffect(() => {
    loadDeal()

    const channel = supabase
      .channel(`deal-summary-${dealId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deals', filter: `id=eq.${dealId}` }, () => {
        loadDeal()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [dealId])

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading summary...</div>
  if (!deal) return <div className="p-8 text-sm text-gray-400">Deal not found</div>

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <p className="text-lg font-medium text-[#343333]">Deal summary — {deal.deal_name}</p>
        <span className="text-xs text-gray-400">Live data, always current</span>
      </div>
      <div className="text-sm text-gray-400">Sections coming next...</div>
    </div>
  )
}
