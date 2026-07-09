'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import FactFindForm from './FactFindForm'
import BCForm from './BCForm'
import LOForm from './LOForm'
import ComplianceForm from './ComplianceForm'

function calcFactFindCompletion(deal: any): number {
  const d = deal.fact_find_data || {}
  const a = d.applicants?.[0] || {}
  return (a.firstName && a.lastName) ? 100 : 0
}

function calcBCCompletion(deal: any): number {
  const d = deal.bc_data || {}
  const fields = [
    d.firstName, d.lastName, d.incomeBase, d.living,
    d.purchasePrice || d.existingLoanBal, d.deposit || d.equityRelease,
    d.suburb, d.splits?.[0]?.amount, d.brokerNotes
  ]
  const filled = fields.filter(f => f && String(f).trim() !== '').length
  return Math.round((filled / fields.length) * 100)
}

function calcLOCompletion(deal: any): number {
  const d = deal.lo_data || {}
  const lenders = d.lenders || []
  const fields = [
    d.loanAmount,
    lenders[0]?.lenderName,
    lenders[0]?.lenderProductId,
    lenders[0]?.approvalDays,
    lenders[0]?.variablePI?.enabled || lenders[0]?.fixedPI?.enabled ? '1' : '',
    d.recommendedLender,
    d.recommendationNote,
    d.criteriaUsed?.length > 0 ? '1' : '',
  ]
  const filled = fields.filter(f => f && String(f).trim() !== '').length
  return Math.round((filled / fields.length) * 100)
}

function calcComplianceCompletion(deal: any): number {
  const d = deal.compliance_data || {}
  const fields = [
    d.needsPrimary, d.needsImmediate, d.needsLongTerm,
    d.analysisComment, d.optionsComment, d.borrowingPowerComment,
    d.depositComment, d.creditHistoryComment, d.securityComment,
  ]
  const filled = fields.filter(f => f && String(f).trim() !== '').length
  return Math.round((filled / fields.length) * 100)
}

function ProgressBar({ pct, active }: { pct: number; active: boolean }) {
  const color = pct >= 80 ? '#639922' : pct >= 50 ? '#2DBEFF' : '#EF9F27'
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden max-w-[60px]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: active ? '#2DBEFF' : color }} />
      </div>
      <span className="text-[10px] text-gray-400">{pct}%</span>
    </div>
  )
}

export default function DealPageClient({ deal, initialStage }: { deal: any; initialStage?: string }) {
  const validStages = ['FactFind', 'BC', 'LO', 'Compliance']
  const startStage = validStages.includes(initialStage || '') ? initialStage! : 'FactFind'
  const [stage, setStage] = useState(startStage)
  const [dealData, setDealData] = useState(deal)
  const router = useRouter()

  const factFindPct = calcFactFindCompletion(dealData)
  const bcPct = calcBCCompletion(dealData)
  const loPct = calcLOCompletion(dealData)
  const compPct = calcComplianceCompletion(dealData)

  const tabs = [
    { key: 'FactFind', label: 'Fact Find', pct: -1 },
    { key: 'BC', label: 'BC — Borrowing capacity', pct: bcPct },
    { key: 'LO', label: 'Lending options', pct: loPct },
    { key: 'Compliance', label: 'Compliance', pct: compPct },
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
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map(({ key, label, pct }) => (
          <button key={key} onClick={() => setStage(key)}
            className={`flex-1 text-center py-2.5 px-3 rounded-lg text-sm font-medium border transition-colors ${stage === key ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-400 bg-white hover:bg-gray-50'}`}>
            <div>{label}</div>
            <ProgressBar pct={pct} active={stage === key} />
          </button>
        ))}
      </div>

      {stage === 'FactFind' && <FactFindForm deal={dealData} onDataChange={(data) => setDealData((prev: any) => ({ ...prev, fact_find_data: data }))} />}
      {stage === 'BC' && <BCForm deal={dealData} />}
      {stage === 'LO' && <LOForm deal={dealData} />}
      {stage === 'Compliance' && <ComplianceForm deal={dealData} />}
    </div>
  )
}
