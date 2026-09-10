'use client'
import { brokerLabel } from '@/lib/broker-key'
import DealPresence from '@/components/DealPresence'
import DealHistory from '@/components/DealHistory'
import { canSeeHistory } from '@/lib/permissions'
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
import DealProgress, { currentStage } from './DealProgress'
import DealSettlement from './DealSettlement'
import DealSettlementPanel from './DealSettlementPanel'
import DealCommission from './DealCommission'
import CloseDeal from './CloseDeal'
import { templateLabel } from '@/lib/templates'
import StatementAnalysis from '@/components/StatementAnalysis'
import InternalNotesStrip from '@/components/InternalNotesStrip'
import TabLock from '@/components/TabLock'
import { DealAlerts, FileNotes, AlertChips, useDealFile } from '@/components/DealFile'
import { isLocked } from '@/lib/deal-lock'
import { isWithLender } from '@/lib/deal-phase'
import DocumentsBox from '@/components/DocumentsBox'

export default function DealPageClient({ deal, initialStage, userRole }: { deal: any; initialStage?: string; userRole?: string }) {
  const validStages = ['FactFind', 'Statements', 'BC', 'LO', 'Compliance']
  // Always open on the stage the progress bar marks as current, so whoever opens the deal
  // lands where the work actually is rather than on whichever tab was viewed last.
  const startStage = currentStage(deal)
  const [stage, setStage] = useState(startStage)
  const [dealData, setDealData] = useState(deal)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(deal.deal_name)
  // One save indicator for the whole deal, so it sits in the same place on every tab.
  // Each form reports up rather than rendering its own label wherever that form ends.
  const [saveStatus, setSaveStatus] = useState<{ at?: string; error?: string }>({})
  // True only once the browser has taken this page over from the server.
  const [pageReady, setPageReady] = useState(false)
  useEffect(() => { setPageReady(true) }, [])
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

  // The live file: alerts and the note log, plus who is writing them. `me` is
  // also what signs a save, so the next person to collide with it can be told a
  // name rather than "somebody else" - see docs/deal-last-saved-by.sql.
  const { notes, alerts, reload: reloadFile } = useDealFile(deal.id)
  const [me, setMe] = useState<{ id: string | null; name: string }>({ id: null, name: '' })
  // Kept apart from the name: who may look at previous versions is decided by
  // address, not by job title. See canSeeHistory in lib/permissions.ts.
  const [myEmail, setMyEmail] = useState('')
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user
      if (!u) return
      setMyEmail(u.email || '')
      supabase.from('user_profiles').select('full_name').eq('id', u.id).single()
        .then(({ data: p }) => setMe({ id: u.id, name: (p as any)?.full_name || u.email || '' }))
    })
  }, [])

  // Unlocking is per tab and per visit: leaving the deal, or moving to another
  // tab, locks it again. Nothing is stored, so nothing can be left unlocked.
  const [unlockedTab, setUnlockedTab] = useState('')

  // The milestone columns the progress bar is built from - and NOTHING else.
  //
  // The bar reads dealData. Moving from LO to Compliance writes lo_client_proceeded
  // on the server and then only changed which tab was showing, so the bar sat on
  // the old stage until the page was reloaded. Re-reading these on every tab
  // change fixes it wherever it happens, including handoffs added later.
  //
  // The JSON blobs - fact_find_data, bc_data, lo_data, compliance_data - are
  // deliberately NOT re-read. They are being edited on screen and autosave is
  // debounced, so pulling the server's copy back mid-edit could wipe out the
  // last thing somebody typed.
  const MILESTONE_COLUMNS = [
    'id', 'stage', 'status', 'last_tab', 'assigned_credit_officer',
    'client_proceeded', 'proceeded_at', 'proceeded_by', 'proceeded_source',
    'bc_completed_at', 'bc_sent_at',
    'lo_completed_at', 'lo_sent_at', 'lo_client_proceeded',
    'lo_proceeded_at', 'lo_proceeded_by', 'lo_proceeded_source',
    'compliance_completed_at', 'compliance_sent_at',
    'lodged_at', 'preapproval_at', 'offer_accepted_at', 'formal_approval_at',
    'contracts_returned_at', 'settlement_booked_at', 'settlement_step', 'settled_at',
    'lodged_total', 'lodged_splits', 'settled_total', 'settled_splits',
    'lender_id', 'loan_amount',
  ].join(', ')

  async function refreshMilestones() {
    const { data } = await supabase.from('deals').select(MILESTONE_COLUMNS).eq('id', deal.id).maybeSingle()
    if (data) setDealData((prev: any) => ({ ...prev, ...(data as any) }))
  }

  // WHO ELSE IS ON THE TAB YOU ARE LOOKING AT.
  //
  // Presence knows. The save banner inside each form does not, and so it could
  // only ever say "somebody else is editing this" - which on BC told nobody
  // anything. Fabio, 7 Sep 2026: "BC says there's someone there and we don't
  // know who??" One name, passed down from the one place that has it.
  const [whoElseHere, setWhoElseHere] = useState('')

  // The incoming-save subscription used to live here, in page state. It does
  // not any more: setting state on this page re-renders the header, the
  // pipeline, the documents strip and the form somebody is typing into, and a
  // keystroke landing during that render is lost. Each tab listens for itself
  // now - see components/useLiveColumn.ts.

  function changeStage(newStage: string) {
    setStage(newStage)
    setUnlockedTab('')
    // The last tab is no longer remembered. A deal opens on the Fact Find every
    // time - see the note in page.tsx - so writing this down had nothing left
    // reading it, and a column that is written but never read is how a record
    // ends up meaning something nobody intended.
    refreshMilestones()
  }

  const tabs = [
    { key: 'FactFind', label: 'Fact Find' },
    { key: 'Statements', label: 'Statements' },
    { key: 'BC', label: 'BC — Borrowing capacity' },
    { key: 'LO', label: 'Lending options' },
    { key: 'Compliance', label: 'Compliance' },
  ]

  return (
    // WHEN IS THIS PAGE ACTUALLY ALIVE?
    //
    // Next sends the finished HTML first and attaches the button handlers a
    // moment later. In between, every button on this page is a picture of a
    // button: it can be clicked, and nothing happens. On 10 Sep 2026 the robot
    // pressed "Write from the deal" on a freshly loaded deal and the box stayed
    // empty for three and a half seconds, then filled on the second press - and
    // I spent a while looking for a bug in the button.
    //
    // A person hits this too. They open a deal, press something straight away,
    // and it does not respond; they press again and it does. It looks like the
    // portal being flaky.
    //
    // This flag flips the moment the handlers are live, so the robot can wait
    // for the page to be real rather than racing it - and so the next person to
    // chase a "the button did nothing" report can see the race is a known one.
    <div className="p-6" data-ready={pageReady ? '1' : undefined}>
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
                {/* Next to the autosave line, because that is where somebody
                    looks the moment they wonder what happened to their work.
                    Two named people only - see canSeeHistory. */}
                {canSeeHistory(myEmail) && <DealHistory dealId={dealData.id} tab={stage} me={me} />}
                {/* WHO ELSE IS IN HERE, as circles. It used to be up to three
                    banners stacked above the form, each on its own timer, and
                    every time one appeared or vanished the whole form moved
                    under whoever was typing. Fabio, 8 Sep 2026: "the fields
                    were moving." A fixed-height row in the header cannot do
                    that. It locks nothing and warns about nothing. */}
                <DealPresence dealId={dealData.id} tab={tabs.find(t => t.key === stage)?.label || stage} onSameTab={setWhoElseHere} />
              </div>
              <button onClick={() => setEditingName(true)} className="text-xs text-[#2DBEFF] hover:underline">✎ Edit</button>
            </div>
          )}
          {/* Client and loan type are not repeated here - the deal name already contains both. */}
          <div className="flex gap-2 items-center flex-wrap">
            <span className="inline-flex items-baseline gap-1.5 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg px-2.5 py-1">
              <span className="text-[9.5px] font-bold tracking-wider uppercase text-[#A29889]">Broker</span>
              <span className="text-[13px] font-semibold text-[#2E2A26]">{brokerLabel(deal.assigned_broker)}</span>
            </span>
            <CreditOfficerAssignment dealId={deal.id} brokerName={deal.assigned_broker} userRole={userRole} />
            {templateLabel(dealData.bc_data?.template) && (
              <span className="inline-flex items-baseline gap-1.5 bg-[#F4FCFF] border border-[#CDEBF8] rounded-lg px-2.5 py-1">
                <span className="text-[9.5px] font-bold tracking-wider uppercase text-[#7BB8D2]">Scenario</span>
                <span className="text-[13px] font-semibold text-[#0E86B8]">{templateLabel(dealData.bc_data?.template)}</span>
              </span>
            )}
            {(() => {
              const waitingOn = getWaitingOnLabel(dealData)
              return waitingOn ? (
                <span className="inline-flex items-baseline gap-2 bg-[#F3E9D7] border border-[#E7D8BC] rounded-lg px-3 py-1">
                  <span className="text-[9.5px] font-bold tracking-wider uppercase text-[#A98B52]">Waiting on</span>
                  <span className="text-[13px] font-semibold text-[#8A6A2F]">{waitingOn.text.replace(/^Waiting on:\s*/i, '')}</span>
                </span>
              ) : null
            })()}
            {/* Alerts belong in the header, not in a panel further down. An alert
                is only worth calling urgent if somebody who was not going to
                scroll sees it anyway. */}
            <AlertChips alerts={alerts} />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {(dealData.onedrive_link || dealData.salestrekker_link) && (
            <div className="flex items-center gap-2">
              <span className="text-[9.5px] font-bold tracking-wider uppercase text-[#A29889]">Open</span>
              <div className="inline-flex border border-[#E8E1D6] rounded-[10px] overflow-hidden">
                {dealData.onedrive_link && (
                  <a href={dealData.onedrive_link} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-[#6E665C] bg-[#FAF7F2] px-3.5 py-2 hover:bg-[#F4EEE4] transition inline-flex items-center gap-2 border-r border-[#E8E1D6]">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12V5.5A1.5 1.5 0 0 1 3.5 4h3l1.5 2h4.5A1.5 1.5 0 0 1 14 7.5V12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12z"/></svg>
                    OneDrive
                  </a>
                )}
                {dealData.salestrekker_link && (
                  <a href={dealData.salestrekker_link} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-semibold text-white bg-[#2DBEFF] px-3.5 py-2 hover:bg-[#25AEEC] transition inline-flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h4v4"/><path d="M13 3 7.5 8.5"/><path d="M12 10v3H3V4h3"/></svg>
                    SalesTrekker
                  </a>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[9.5px] font-bold tracking-wider uppercase text-[#A29889]">Deal</span>
            <div className="inline-flex border border-[#E8E1D6] rounded-[10px] overflow-hidden">
              <a href={`/deals/${deal.id}/summary`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-[#6E665C] bg-[#FAF7F2] px-3.5 py-2 hover:bg-[#F4EEE4] transition inline-flex items-center gap-2 border-r border-[#E8E1D6]">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2h5l3 3v9H4z"/><path d="M9 2v3h3"/></svg>
                Summary
              </a>
              <button onClick={cloneThisDeal} disabled={cloning} className="text-xs text-[#6E665C] bg-[#FAF7F2] px-3.5 py-2 hover:bg-[#F4EEE4] transition inline-flex items-center gap-2 disabled:opacity-40">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="5" width="8" height="9" rx="1.4"/><path d="M11 5V3.4A1.4 1.4 0 0 0 9.6 2H4.4A1.4 1.4 0 0 0 3 3.4v7.2A1.4 1.4 0 0 0 4.4 12H5"/></svg>
                {cloning ? 'Cloning...' : 'Clone'}
              </button>
              <CloseDeal deal={dealData} onUpdated={(patch: any) => setDealData((prev: any) => ({ ...prev, ...patch }))} />
            </div>
          </div>
        </div>
      </div>

      <DealProgress deal={dealData} />

      {/* A lodged deal is being TRACKED, not written, and the tracking blocks
          stacked one under another put the tabs 1300px down the page. Two
          columns: the deal's own progress and money on the left, what is on fire
          and what has happened on the right. Before lodgement none of this
          exists and the page is unchanged. */}
      {isWithLender(dealData) ? (
        <div className="grid grid-cols-[1.15fr_1fr] gap-3 max-[900px]:grid-cols-1">
          <div>
            <DealSettlement deal={dealData} onUpdated={(patch) => setDealData((prev: any) => ({ ...prev, ...patch }))} />
            <DealSettlementPanel deal={dealData} onUpdated={(patch) => setDealData((prev: any) => ({ ...prev, ...patch }))} />
            <DealCommission deal={dealData} />
          </div>
          <div>
            <DealAlerts dealId={dealData.id} me={me} alerts={alerts} onChanged={reloadFile} />
            <FileNotes dealId={dealData.id} me={me} notes={notes} onChanged={reloadFile} />
          </div>
        </div>
      ) : (
        <>
          <DealSettlement deal={dealData} onUpdated={(patch) => setDealData((prev: any) => ({ ...prev, ...patch }))} />
          <DealSettlementPanel deal={dealData} onUpdated={(patch) => setDealData((prev: any) => ({ ...prev, ...patch }))} />
          <DealCommission deal={dealData} />
        </>
      )}

      {/* Pinned context, above the tabs. This is what is always true about the
          deal - "partner is on a visa, loan in her name only" - so it belongs in
          view before you choose a tab, not inside one. Same single field
          (deals.internal_notes) it has always been; Fact Find keeps its own left
          column so it is never shown twice on one screen. */}
      {stage !== 'FactFind' && (
        <InternalNotesStrip dealId={dealData.id} initial={dealData.internal_notes || ''}
          openByDefault={stage === 'Compliance'} />
      )}

      {/* THE DOCUMENT LIST. Same place on every stage, above the tabs, because
          documents are not a stage of the deal - they run alongside all of
          them. Fabio, 3 Sep 2026: "It's always the same button. Make it across
          all stages. It's static across next to the deal card information." */}
      <DocumentsBox deal={dealData} me={me}
        onUpdated={(patch: any) => setDealData((prev: any) => ({ ...prev, ...patch }))} />

      <div className="flex gap-2 mb-6">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => changeStage(key)}
            className={`flex-1 text-center py-2.5 px-3 rounded-lg text-sm font-medium border transition-colors ${stage === key ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-400 bg-white hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      <TabLock locked={isLocked(dealData) && unlockedTab !== stage} tab={stage} dealId={dealData.id}
        role={userRole} me={me}
        onUnlocked={() => { setUnlockedTab(stage); reloadFile() }}>
        {stage === 'FactFind' && <FactFindForm whoElseHere={whoElseHere} me={me} deal={dealData} onDataChange={(data) => setDealData((prev: any) => ({ ...prev, fact_find_data: data }))} onDealFieldChange={(field, value) => setDealData((prev: any) => ({ ...prev, [field]: value }))} onSaveStatus={setSaveStatus} />}
        {stage === 'Statements' && <StatementAnalysis deal={dealData} />}
        {stage === 'BC' && <BCForm whoElseHere={whoElseHere} me={me} deal={dealData} onDataChange={(data) => setDealData((prev: any) => ({ ...prev, bc_data: data }))} onStageChange={changeStage} userRole={userRole} onSaveStatus={setSaveStatus} />}
        {stage === 'LO' && <LOForm whoElseHere={whoElseHere} me={me} deal={dealData} onStageChange={changeStage} userRole={userRole} onSaveStatus={setSaveStatus} onDealFieldChange={(field, value) => setDealData((prev: any) => ({ ...prev, [field]: value }))} />}
        {stage === 'Compliance' && <ComplianceForm whoElseHere={whoElseHere} me={me} deal={dealData} onSaveStatus={setSaveStatus}
          onDealPatched={(patch: any) => setDealData((prev: any) => ({ ...prev, ...patch }))} />}
      </TabLock>
    </div>
  )
}
