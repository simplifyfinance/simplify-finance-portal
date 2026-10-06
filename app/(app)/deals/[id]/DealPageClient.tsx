'use client'
import Link from 'next/link'
import { brokerLabel } from '@/lib/broker-key'
import DealPresence from '@/components/DealPresence'
import DealTabCards, { DEAL_TABS } from '@/components/DealTabCards'
import DealRail, { RailCard, RailNotes } from '@/components/DealRail'
import DealLinks from '@/components/DealLinks'
import DealMore from '@/components/DealMore'
import DealHistory from '@/components/DealHistory'
import { SaveIndicator, SaveIndicatorNote } from '@/components/SaveIndicator'
import type { SaveStatus } from '@/lib/save-indicator'
import TabBoundary from '@/components/TabBoundary'
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
import OfferAccepted from '@/components/OfferAccepted'
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
import DealPrompts from '@/components/DealPrompts'
import Outstanding from '@/components/Outstanding'
import DealDocuments from '@/components/DealDocuments'
import MilestoneEmails from '@/components/MilestoneEmails'
import AnzAssessmentEmail from '@/components/AnzAssessmentEmail'
import BrokerAssignment from './BrokerAssignment'
import TestDealBand from '@/components/TestDealBand'
import DealName from '@/components/DealName'
import { splitOnCommonStart } from '@/lib/same-clients'
import { useOtherDeals } from '@/components/useOtherDeals'

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
  // THE SAVE LINE, for whichever tab is on screen. One indicator for the page -
  // see lib/save-indicator.ts for what it is allowed to say.
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ stage: 'clean' })
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
  // ANOTHER DEAL FOR THE SAME PEOPLE. See components/useOtherDeals.ts - 23 Sep
  // 2026, two Hameed deals whose names matched for 42 characters.
  const otherDeals = useOtherDeals(dealData)
  const [me, setMe] = useState<{ id: string | null; name: string }>({ id: null, name: '' })
  // Kept apart from the name: who may look at previous versions is decided by
  // address, not by job title. See canSeeHistory in lib/permissions.ts.
  const [myEmail, setMyEmail] = useState('')
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user
      if (!u) return
      setMyEmail(u.email || '')
      // THE ADDRESS FIRST, THE FULL NAME A MOMENT LATER.
      //
      // Waiting for the profile row before knowing who this is left a window
      // where a save was recorded against nobody - see lib/save-conflict.ts.
      // An email address is a worse label than a name and a far better one
      // than nothing, so it goes in straight away and is replaced the instant
      // the real name arrives.
      setMe({ id: u.id, name: u.email || '' })
      supabase.from('user_profiles').select('full_name').eq('id', u.id).single()
        .then(({ data: p }) => setMe({ id: u.id, name: (p as any)?.full_name || u.email || '' }))
    })
  }, [])

  // Unlocking is per tab and per visit: leaving the deal, or moving to another
  // tab, locks it again. Nothing is stored, so nothing can be left unlocked.
  // ONE UNLOCK FOR THE WHOLE DEAL, not one per tab. Fabio, 30 Sep 2026:
  // "i need to reqword a deal card I want one button unlock and it allows me to
  // evrythign on all tabs". Reworking a card is never one tab's worth of work.
  // See lib/deal-lock.ts.
  const [dealUnlocked, setDealUnlocked] = useState(false)
  // Bumped when a document is added on the Fact Find tab, so the list above the
  // tabs picks it up. The list moved out of that form - see DealDocuments.
  const [documentsVersion, setDocumentsVersion] = useState(0)

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
    // THE UNLOCK SURVIVES A TAB CHANGE, because it is the DEAL that is unlocked.
    //
    // This used to clear it, which is the behaviour Fabio ran into: unlock the
    // compliance tab, go to lending options to change the lender, come back and
    // it is locked again. Reworking a deal card crosses tabs by definition.
    // It still re-locks when you leave the deal.
    // The last tab is no longer remembered. A deal opens on the Fact Find every
    // time - see the note in page.tsx - so writing this down had nothing left
    // reading it, and a column that is written but never read is how a record
    // ends up meaning something nobody intended.
    refreshMilestones()
  }

  const tabs = DEAL_TABS

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
      {/* DEALS / THE SCENARIO - one-inside-the-deal-v4.html. It was a button
          reading "Back to deals" on a line of its own; this goes to the same
          place and also says which scenario of this deal you are looking at. */}
      <nav aria-label="Back to deals" className="flex items-center gap-1.5 text-sm mb-4">
        <button onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-muted hover:text-ink transition">
          <ArrowLeft size={13} /> Deals
        </button>
        {templateLabel(dealData.bc_data?.template) && (
          <>
            <span className="text-faint">/</span>
            <span className="font-semibold text-ink">{templateLabel(dealData.bc_data?.template)}</span>
          </>
        )}
      </nav>

      {/* Above the header and above every tab, because the thing it is
          preventing is somebody reading the deal and believing it. */}
      <TestDealBand deal={dealData} userRole={userRole} me={me}
        onChanged={(isTest) => setDealData((prev: any) => ({ ...prev, is_test: isTest }))} />

      <div className="bg-card border border-gray-100 rounded-xl p-5 mb-4 flex items-start justify-between">
        <div>
          {editingName ? (
            <div className="flex items-center gap-2 mb-1">
              <input value={nameInput} onChange={e => setNameInput(e.target.value)}
                className="text-lg font-semibold border border-brand rounded-lg px-2 py-0.5" autoFocus />
              <button onClick={saveDealName} className="text-xs font-medium text-on-brand bg-brand px-3 py-1.5 rounded-lg">Save</button>
              <button onClick={() => { setEditingName(false); setNameInput(dealData.deal_name) }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center gap-3">
                <DealName className="text-lg font-semibold" name={dealData.deal_name}
                  others={otherDeals.map(d => String(d.deal_name || ''))} />
                <SaveIndicator status={saveStatus} />
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
            </div>
          )}
          {/* Only there when a save has actually gone wrong, so it cannot push the
              form around on a normal day. */}
          <SaveIndicatorNote status={saveStatus} />
          {/* THE OTHER DEAL THESE CLIENTS HAVE, NAMED AND ONE CLICK AWAY.
              This is the line that would have ended 23 Sep 2026 in ten seconds
              instead of forty minutes. It shows only the part of the other
              name that differs, because the rest is the name above it. */}
          {otherDeals.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mt-1.5 mb-1">
              <span className="text-[9.5px] font-bold tracking-wider uppercase text-brand-ink/70">Also</span>
              {otherDeals.map(o => {
                const label = splitOnCommonStart(String(o.deal_name || ''), [String(dealData.deal_name || '')]).tail
                return (
                  <Link key={o.id} href={`/deals/${o.id}`}
                    className="text-[12.5px] font-semibold text-info bg-info-bg border border-info-edge rounded-lg px-2.5 py-1 hover:bg-info-bg">
                    {label} <span className="text-brand-ink/70">&rarr;</span>
                  </Link>
                )
              })}
            </div>
          )}
          {/* Client and loan type are not repeated here - the deal name already contains both. */}
          <div className="flex gap-2 items-center flex-wrap">
            {/* CHANGEABLE, like the credit officer beside it. Until 17 Sep 2026
                this was a label and the control that does the work was two tabs
                away, at the bottom of an email preview. */}
            <BrokerAssignment dealId={dealData.id} currentBroker={dealData.assigned_broker} userRole={userRole} chip />
            <CreditOfficerAssignment dealId={deal.id} brokerName={deal.assigned_broker} userRole={userRole} />
            {templateLabel(dealData.bc_data?.template) && (
              <span className="inline-flex items-baseline gap-1.5 bg-info-bg border border-info-edge rounded-lg px-2.5 py-1">
                <span className="text-[9.5px] font-bold tracking-wider uppercase text-brand-ink/70">Scenario</span>
                <span className="text-[13px] font-semibold text-info">{templateLabel(dealData.bc_data?.template)}</span>
              </span>
            )}
            {(() => {
              const waitingOn = getWaitingOnLabel(dealData)
              return waitingOn ? (
                <span className="inline-flex items-baseline gap-2 bg-waiting-bg border border-waiting-edge rounded-lg px-3 py-1">
                  <span className="text-[9.5px] font-bold tracking-wider uppercase text-waiting">Waiting on</span>
                  <span className="text-[13px] font-semibold text-waiting">{waitingOn.text.replace(/^Waiting on:\s*/i, '')}</span>
                </span>
              ) : null
            })()}
            {/* Alerts belong in the header, not in a panel further down. An alert
                is only worth calling urgent if somebody who was not going to
                scroll sees it anyway. */}
            <AlertChips alerts={alerts} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* OPEN BC, where the mock puts it: the thing you reach for most, on
              the row rather than two clicks in. It is the same stage change the
              tab cards make. */}
          <button onClick={() => changeStage('BC')}
            className="text-xs font-semibold text-info bg-info-bg border border-info-edge rounded-[10px] px-3.5 py-2
              hover:opacity-90 transition inline-flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h8" />
            </svg>
            Open BC
          </button>

          {/* THE CLIENT EMAILS, IN THE HEADER - one-inside-the-deal-v4.html.
              They were a full width band above the tabs. Telling a client their
              loan is approved happens when the bank says so, not when a
              particular tab is open, and a formally approved deal is usually
              lodged - which is exactly when a tab is locked. So it stays out
              here, outside the lock, just smaller. */}
          <MilestoneEmails deal={dealData} me={me}
            onUpdated={(patch: any) => setDealData((prev: any) => ({ ...prev, ...patch }))} />

          <button onClick={() => setEditingName(true)}
            className="text-xs text-muted bg-page border border-line rounded-[10px] px-3.5 py-2
              hover:bg-line-soft hover:text-ink transition">Edit</button>

          {/* EVERYTHING ELSE BEHIND ONE WORD. Fabio, 5 Oct 2026: "more is the
              right move we need to simplify the view so dont want them
              visible." OneDrive, SalesTrekker and Summary moved to the rail -
              see components/DealLinks.tsx - and these two live here. Same
              clone, same close. */}
          <DealMore>
            <button onClick={cloneThisDeal} disabled={cloning} className="text-xs text-muted rounded-lg px-2.5 py-2 hover:bg-page transition inline-flex items-center gap-2 text-left disabled:opacity-40">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="5" width="8" height="9" rx="1.4"/><path d="M11 5V3.4A1.4 1.4 0 0 0 9.6 2H4.4A1.4 1.4 0 0 0 3 3.4v7.2A1.4 1.4 0 0 0 4.4 12H5"/></svg>
                {cloning ? 'Cloning...' : 'Clone'}
              </button>
            <CloseDeal deal={dealData} onUpdated={(patch: any) => setDealData((prev: any) => ({ ...prev, ...patch }))} />
          </DealMore>
        </div>
      </div>

      {/* WHAT NOBODY HAS STARTED - one-inside-the-deal-v4.html, the band under
          the broker and credit officer line. The BC question used to sit lower
          down in a red box of its own; it is in here now, beside the documents
          nobody has asked for. It draws nothing when there is nothing to say.
          See components/DealPrompts.tsx. */}
      <DealPrompts deal={dealData}
        onUpdated={(patch: any) => setDealData((prev: any) => ({ ...prev, ...patch }))} />

      <DealProgress deal={dealData} />

      {/* A lodged deal is being TRACKED, not written, and the tracking blocks
          stacked one under another put the tabs 1300px down the page. Two
          columns: the deal's own progress and money on the left, what is on fire
          and what has happened on the right. Before lodgement none of this
          exists and the page is unchanged. */}
      {/* ONE SETTLEMENT PANEL, NOT TWO.
          
          24 Sep 2026. This was written twice - once inside the two-column grid
          for a deal that is with a lender, once on its own for a deal that is
          not - and a deal CROSSES that line the instant somebody marks it
          settled. React does not know the two are the same panel. It saw the
          shape of the page change underneath it, threw the old panel away and
          built a new one, and everything the old one was holding went with it.
          
          What it was holding was the prompt asking about the client's position.
          It appeared and died in the same breath, every single time, and the
          client's record stayed empty. Fabio, all day: "the pop up box was so
          quick I didnt see anyhting", "AND FUCKING AGAIN THE SAME RESULT".
          
          So the panel is written once and stays in one place. Only the layout
          around it changes: the grid class goes on when the deal is with a
          lender, and the second column appears beside it. React sees the same
          panel in the same place and leaves it alone - and the prompt stays on
          screen until somebody answers it.
          
          The rule this file now follows: NEVER render the same component in two
          branches of a condition that a deal can cross. */}
      <div>
        <div>
          <DealSettlement deal={dealData} onUpdated={(patch) => setDealData((prev: any) => ({ ...prev, ...patch }))} />
          {/* Written ONCE, inside the column that is always drawn - the rule
              above. Marking a deal offer-accepted is exactly the kind of line a
              deal crosses, and a panel rendered in two branches of one would be
              destroyed the moment it crossed it. It draws itself away when there
              is nothing to record. */}
          <OfferAccepted deal={dealData} me={me}
            onUpdated={(patch) => setDealData((prev: any) => ({ ...prev, ...patch }))} />
          <DealSettlementPanel deal={dealData} onUpdated={(patch) => setDealData((prev: any) => ({ ...prev, ...patch }))} />
          <DealCommission deal={dealData} />
        </div>

      </div>

      {/* Pinned context, above the tabs. This is what is always true about the
          deal - "partner is on a visa, loan in her name only" - so it belongs in
          view before you choose a tab, not inside one. Same single field
          (deals.internal_notes) it has always been; Fact Find keeps its own left
          column so it is never shown twice on one screen. */}

      {/* THE DOCUMENT LIST. Same place on every stage, above the tabs, because
          documents are not a stage of the deal - they run alongside all of
          them. Fabio, 3 Sep 2026: "It's always the same button. Make it across
          all stages. It's static across next to the deal card information." */}


      {/* THE LENDER CAME BACK WITH CONDITIONS. Same idea as the strip above: it
          does not exist before lodgement, it does not exist once the
          pre-approval lands, and in between it is the one thing on the deal
          worth chasing. See components/Outstanding.tsx. */}
      <Outstanding deal={dealData} me={me}
        onUpdated={(patch: any) => setDealData((prev: any) => ({ ...prev, ...patch }))} />

      {/* THE THREE PDFS, ABOVE THE TABS AND OUTSIDE THE LOCK.
          
          They used to live inside the Compliance tab, which a lodged deal
          disables wholesale - so the documents became unreachable exactly when
          they are wanted. Reading a deal changes nothing; see
          components/DealDocuments.tsx. */}

      {/* AND THE ONE EMAIL THAT IS NOT OURS TO SEND. ANZ deals only: it opens
          Outlook addressed to their assessment team with the reference in the
          subject. See components/AnzAssessmentEmail.tsx. */}
      <AnzAssessmentEmail deal={dealData} />

      {/* THE FIVE TABS, AS CARDS - one-inside-the-deal-v4.html.
          See components/DealTabCards.tsx. The row of pill buttons this
          replaces said nothing but its own name. */}
      <DealTabCards deal={dealData} stage={stage} onPick={changeStage} />

      {/* THE FORM, AND THE RAIL BESIDE IT - one-inside-the-deal-v4.html.
          Everything in the rail used to be stacked full width above the form,
          or - for Important and File notes - inside the settlement grid, which
          a Fact Find deal never draws. See components/DealRail.tsx. */}
      <div className={stage === 'Statements' ? '' :
        'grid grid-cols-[minmax(0,1.9fr)_minmax(0,330px)] gap-3 items-start max-[1100px]:grid-cols-1'}>
        <div className="min-w-0">
      <TabLock locked={isLocked(dealData) && !dealUnlocked} tab={stage} dealId={dealData.id}
        role={userRole} me={me}
        onUnlocked={() => { setDealUnlocked(true); reloadFile() }}>
        <TabBoundary tab={stage}>
          {stage === 'FactFind' && <FactFindForm whoElseHere={whoElseHere} me={me} deal={dealData} onDocumentsChanged={() => setDocumentsVersion(v => v + 1)} onDataChange={(data) => setDealData((prev: any) => ({ ...prev, fact_find_data: data }))} onDealFieldChange={(field, value) => setDealData((prev: any) => ({ ...prev, [field]: value }))} onSaveStatus={setSaveStatus} />}
          {stage === 'Statements' && <StatementAnalysis deal={dealData} />}
          {stage === 'BC' && <BCForm whoElseHere={whoElseHere} me={me} deal={dealData} onDataChange={(data) => setDealData((prev: any) => ({ ...prev, bc_data: data }))} onStageChange={changeStage} userRole={userRole} onSaveStatus={setSaveStatus} />}
          {stage === 'LO' && <LOForm whoElseHere={whoElseHere} me={me} deal={dealData} onStageChange={changeStage} userRole={userRole} onSaveStatus={setSaveStatus} onDataChange={(data) => setDealData((prev: any) => ({ ...prev, lo_data: data }))} onDealFieldChange={(field, value) => setDealData((prev: any) => ({ ...prev, [field]: value }))} />}
          {stage === 'Compliance' && <ComplianceForm whoElseHere={whoElseHere} me={me} deal={dealData} onSaveStatus={setSaveStatus}
            onDataChange={(data: any) => setDealData((prev: any) => ({ ...prev, compliance_data: data }))}
            onDealPatched={(patch: any) => setDealData((prev: any) => ({ ...prev, ...patch }))} />}
        </TabBoundary>
      </TabLock>
        </div>

        {stage !== 'Statements' && <DealRail>
          <DealAlerts dealId={dealData.id} me={me} alerts={alerts} onChanged={reloadFile} />
          <RailNotes dealId={dealData.id} initial={dealData.internal_notes || ''} meId={me?.id} />
          <DocumentsBox deal={dealData} me={me}
            onUpdated={(patch: any) => setDealData((prev: any) => ({ ...prev, ...patch }))} />
          <DealDocuments deal={dealData} me={me} version={documentsVersion}
            onUpdated={(patch: any) => setDealData((prev: any) => ({ ...prev, ...patch }))} />
          <DealLinks deal={dealData} />
          <FileNotes dealId={dealData.id} me={me} notes={notes} onChanged={reloadFile} />
        </DealRail>}
      </div>
    </div>
  )
}
