'use client'
import Image from 'next/image'
import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import BCForm from './BCForm'

export default function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [deal, setDeal] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stage, setStage] = useState('BC')
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
      <div className="bg-white border border-gray-100 rounded-3xl p-6 mb-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-slate-50 p-3">
              <Image src="/file.svg" alt="Simplify Finance logo" width={56} height={56} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.32em] text-slate-500 font-semibold">Finance, Simplified</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">Simplify Finance</div>
            </div>
          </div>
          <div className="space-y-1 text-right text-xs text-slate-500">
            <div>© 2026 Simplify Finance, St Leonards, Sydney</div>
            <div>Australian Credit Licence: 387025</div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Subject to loan approval, credit criteria and lender terms. All information is indicative only.
        </div>
      </div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft size={14} /> Back to deals
      </button>
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="text-lg font-semibold mb-1">{deal.deal_name}</div>
            <div className="flex flex-wrap gap-3 text-sm text-gray-500">
              <span>{deal.clients?.first_name} {deal.clients?.last_name}</span>
              <span>·</span><span>{deal.deal_type}</span>
            </div>
          </div>
          <div className="rounded-3xl border border-[#2DBEFF]/20 bg-[#F0FBFF] p-4 max-w-md">
            <div className="text-xs uppercase tracking-[0.24em] text-[#2B6CB0] font-semibold mb-2">Broker</div>
            <div className="text-sm font-semibold text-slate-900">{deal.assigned_broker || 'Broker name not assigned'}</div>
            <div className="text-sm text-slate-500 mt-1">{deal.broker_rep_number ? `Credit Rep #${deal.broker_rep_number}` : 'Credit Rep #N/A'}</div>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mb-6">
        {['BC','LO','Compliance'].map(s => (
          <button key={s} onClick={() => setStage(s)}
            className={`flex-1 text-center py-2.5 rounded-lg text-sm font-medium border transition-colors ${stage === s ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-400 bg-white hover:bg-gray-50'}`}>
            {s === 'BC' ? 'BC — Borrowing capacity' : s === 'LO' ? 'LO — Lending options' : 'Compliance'}
          </button>
        ))}
      </div>
      {stage === 'BC' && <BCForm deal={deal} />}
      {stage === 'LO' && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
          <div className="text-sm font-medium text-gray-500 mb-1">Lending options</div>
          <div className="text-xs text-gray-400">Coming after BC is complete.</div>
        </div>
      )}
      {stage === 'Compliance' && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
          <div className="text-sm font-medium text-gray-500 mb-1">Compliance</div>
          <div className="text-xs text-gray-400">Coming after LO is complete.</div>
        </div>
      )}
    </div>
  )
}
