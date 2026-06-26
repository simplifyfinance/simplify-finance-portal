'use client'
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import BCForm from './BCForm'
import LOForm from './LOForm'
import ComplianceForm from './ComplianceForm'

export default function DealPageClient({ deal }: { deal: any }) {
  const [stage, setStage] = useState('BC')
  const router = useRouter()

  return (
    <div className="p-6">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft size={14} /> Back to deals
      </button>

      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4 flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold mb-1">{deal.deal_name}</div>
          <div className="flex gap-3 text-sm text-gray-500">
            <span>{deal.clients?.first_name} {deal.clients?.last_name}</span>
            <span>·</span><span>{deal.deal_type}</span>
            <span>·</span><span>Broker: {deal.assigned_broker}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {['BC','LO','Compliance'].map(s => (
          <button key={s} onClick={() => setStage(s)}
            className={`flex-1 text-center py-2.5 rounded-lg text-sm font-medium border transition-colors ${stage === s ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-400 bg-white hover:bg-gray-50'}`}>
            {s === 'BC' ? 'BC — Borrowing capacity' : s === 'LO' ? 'Lending options' : 'Compliance'}
          </button>
        ))}
      </div>

      {stage === 'BC' && <BCForm deal={deal} />}
      {stage === 'LO' && <LOForm deal={deal} />}
      {stage === 'Compliance' && <ComplianceForm deal={deal} />}
    </div>
  )
}
