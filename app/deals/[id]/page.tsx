'use client'
import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [deal, setDeal] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase
      .from('deals')
      .select('*, clients(first_name, last_name, email, phone)')
      .eq('id', id)
      .single()
      .then(({ data }) => { setDeal(data); setLoading(false) })
  }, [id])

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading...</div>
  if (!deal) return <div className="p-6 text-sm text-gray-400">Deal not found.</div>

  return (
    <div className="p-6">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft size={14} /> Back to deals
      </button>
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
        <div className="text-lg font-semibold mb-1">{deal.deal_name}</div>
        <div className="flex gap-3 text-sm text-gray-500">
          <span>{deal.clients?.first_name} {deal.clients?.last_name}</span>
          <span>·</span><span>{deal.deal_type}</span>
          <span>·</span><span>Broker: {deal.assigned_broker}</span>
        </div>
      </div>
      <div className="flex gap-2 mb-6">
        {['BC','LO','Compliance'].map(s => (
          <div key={s} className={`flex-1 text-center py-2.5 rounded-lg text-sm font-medium border transition-colors ${deal.stage === s ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-400 bg-white'}`}>
            {s === 'BC' ? 'BC — Borrowing capacity' : s === 'LO' ? 'LO — Lending options' : 'Compliance'}
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="text-sm font-medium mb-4">BC form coming next</div>
        <div className="text-xs text-gray-400">All 12 templates with full field sets will load here.</div>
      </div>
    </div>
  )
}
