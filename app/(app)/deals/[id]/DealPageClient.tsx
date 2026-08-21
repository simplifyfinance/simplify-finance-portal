'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import FactFindForm from './FactFindForm'
import BCForm from './BCForm'
import LOForm from './LOForm'
import ComplianceForm from './ComplianceForm'
import CreditOfficerAssignment from './CreditOfficerAssignment'
import { getWaitingOnLabel, WAITING_ON_STYLES } from '@/lib/deal-status'
import DealProgress from './DealProgress'

export default function DealPageClient({ deal, initialStage, userRole }: { deal: any; initialStage?: string; userRole?: string }) {
  const validStages = ['FactFind', 'BC', 'LO', 'Compliance']
  const startStage = validStages.includes(initialStage || '') ? initialStage! : 'FactFind'
  const [stage, setStage] = useState(startStage)
  const [dealData, setDealData] = useState(deal)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(deal.deal_name)
  // One save indicator for the whole deal, so it sits in the same place on every tab.
  // Each form reports up rather than rendering its own label wherever that form ends.
  const [saveStatus, setSaveStatus] = useState<{ at?: string; error?: string }>({})
  const [cloning, setCloning] = useState(false)

  async function saveDealName() {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    const { error } = await supabase.from('deals').update({ deal_name: trimmed }).eq('id', deal.id)
    if (error) { alert('Error saving name: ' + error.message); return }
    setDealData((prev: any) => ({ ...prev, deal_name: trimmed }))
    setEditingName(false)
  }

  async function cloneThisDeal() {
    if (!confirm(`Clone "${dealData.deal_name}"? This copies Fact Find only — BC, LO, and Compliance start fresh.`)) return
    setCloning(true)
    const { data: fullDeal } = await supabase.from('deals').select('fact_find_data, client_id, deal_type, assigned_broker').eq('id', deal.id).single()
    if (!fullDeal) { alert('Could not load deal to clone'); setCloning(false); return }

    const namePart = dealData.deal_name.replace(/_\d{4}$/, '')
    const newDealName = `${namePart}_${new Date().getFullYear()}_Copy`

    const { data: inserted, error } = await supabase.from('deals').insert([{
      deal_name: newDealName,
      client_id: fullDeal.client_id,
      deal_type: fullDeal.deal_type,
      assigned_broker: fullDeal.assigned_broker,
      stage: 'BC',
      status: 'in_progress',
      fact_find_data: fullDeal.fact_find_data
    }]).select().single()

    if (error || !inserted) { alert('Error cloning deal: ' + (error?.message || 'unknown error')); setCloning(false); return }
    router.push(`/deals/${inserted.id}`)
  }
  const router = useRouter()
  const supabase = createSupabaseBrowser()

  function changeStage(newStage: string) {
    setStage(newStage)
    supabase.from('deals').update({ last_tab: newStage }).eq('id', deal.id).then(() => {})
  }

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
          {editingName ? (
            <div className="flex items-center gap-2 mb-1">
              <input value={nameInput} onChange={e => setNameInput(e.target.value)}
                className="text-lg font-semibold border border-[#2DBEFF] rounded-lg px-2 py-0.5" autoFocus />
              <button onClick={saveDealName} className="text-xs font-medium text-white bg-[#2DBEFF] px-3 py-1.5 rounded-lg">Save</button>
              <button onClick={() => { setEditingName(false); setNameInput(dealData.deal_name) }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center gap-3">
                <div className="text-lg font-semibold">{dealData.deal_name}</div>
                {saveStatus.error
                  ? <span className="text-xs font-semibold text-red-600">{saveStatus.error}</span>
                  : saveStatus.at ? <span className="text-xs text-gray-400 whitespace-nowrap">Autosaved {saveStatus.at}</span> : null}
              </div>
              <button onClick={() => setEditingName(true)} className="text-xs text-[#2DBEFF] hover:underline">✎ Edit</button>
            </div>
          )}
          <div className="flex gap-3 text-sm text-gray-500 items-center flex-wrap">
            <span>{deal.clients?.first_name} {deal.clients?.last_name}</span>
            <span>·</span><span>{deal.deal_type}</span>
            <span>·</span><span>Broker: {deal.assigned_broker}</span>
            <CreditOfficerAssignment dealId={deal.id} brokerName={deal.assigned_broker} userRole={userRole} />
            {(() => {
              const waitingOn = getWaitingOnLabel(dealData)
              return waitingOn ? (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${WAITING_ON_STYLES[waitingOn.color]}`}>{waitingOn.text}</span>
              ) : null
            })()}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <a href={`/deals/${deal.id}/summary`} target="_blank" rel="noopener noreferrer"
            className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
            View summary →
          </a>
          <button onClick={cloneThisDeal} disabled={cloning}
            className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition disabled:opacity-40">
            {cloning ? 'Cloning...' : '📋 Clone deal'}
          </button>
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

      <DealProgress deal={dealData} />

      <div className="flex gap-2 mb-6">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => changeStage(key)}
            className={`flex-1 text-center py-2.5 px-3 rounded-lg text-sm font-medium border transition-colors ${stage === key ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-400 bg-white hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {stage === 'FactFind' && <FactFindForm deal={dealData} onDataChange={(data) => setDealData((prev: any) => ({ ...prev, fact_find_data: data }))} onDealFieldChange={(field, value) => setDealData((prev: any) => ({ ...prev, [field]: value }))} onSaveStatus={setSaveStatus} />}
      {stage === 'BC' && <BCForm deal={dealData} onDataChange={(data) => setDealData((prev: any) => ({ ...prev, bc_data: data }))} onStageChange={changeStage} userRole={userRole} onSaveStatus={setSaveStatus} />}
      {stage === 'LO' && <LOForm deal={dealData} onStageChange={changeStage} userRole={userRole} onSaveStatus={setSaveStatus} />}
      {stage === 'Compliance' && <ComplianceForm deal={dealData} onSaveStatus={setSaveStatus} />}
    </div>
  )
}
