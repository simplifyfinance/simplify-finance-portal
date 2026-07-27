'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import FactFindForm from './FactFindForm'
import BCForm from './BCForm'
import LOForm from './LOForm'
import ComplianceForm from './ComplianceForm'

export default function DealPageClient({ deal, initialStage }: { deal: any; initialStage?: string }) {
  const validStages = ['FactFind', 'BC', 'LO', 'Compliance']
  const startStage = validStages.includes(initialStage || '') ? initialStage! : 'FactFind'
  const [stage, setStage] = useState(startStage)
  const [dealData, setDealData] = useState(deal)
  const router = useRouter()

  const tabs = [
    { key: 'FactFind', label: 'Fact Find' },
    { key: 'BC', label: 'BC — Borrowing capacity' },
    { key: 'LO', label: 'Lending options' },
    { key: 'Compliance', label: 'Compliance' },
  ]

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
        <div className="flex gap-2 flex-shrink-0">
          {dealData.onedrive_link && (
            <a href={dealData.onedrive_link} target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
              Open OneDrive →
            </a>
          )}
          {dealData.salestrekker_link && (
            <a href={dealData.salestrekker_link} target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
              Open SalesTrekker →
            </a>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setStage(key)}
            className={`flex-1 text-center py-2.5 px-3 rounded-lg text-sm font-medium border transition-colors ${stage === key ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-400 bg-white hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {stage === 'FactFind' && <FactFindForm deal={dealData} onDataChange={(data) => setDealData((prev: any) => ({ ...prev, fact_find_data: data }))} onDealFieldChange={(field, value) => setDealData((prev: any) => ({ ...prev, [field]: value }))} />}
      {stage === 'BC' && <BCForm deal={dealData} onDataChange={(data) => setDealData((prev: any) => ({ ...prev, bc_data: data }))} onStageChange={setStage} />}
      {stage === 'LO' && <LOForm deal={dealData} onStageChange={setStage} />}
      {stage === 'Compliance' && <ComplianceForm deal={dealData} />}
    </div>
  )
}
