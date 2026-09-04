'use client'
import { useState, useEffect, useRef } from 'react'
import { formatAsTyped } from '@/lib/money'
import SaveConflict from '@/components/SaveConflict'
import { emptyGuard, adopt, saveGuarded } from '@/lib/save-conflict'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { docsStateOf, atTime, assessorMissing, NO_ASSESSOR_MESSAGE } from '@/lib/docs-received'
import { legalFeeLabel, rowLegalFeeLabel } from '@/lib/lender-fees'
import CreditOfficerAssignment from './CreditOfficerAssignment'
import BrokerAssignment from './BrokerAssignment'
import { can } from '@/lib/permissions'
import { templateLabel } from '@/lib/templates'
import { proceedCredit } from '@/lib/deal-status'
import { emailParagraphs, htmlToPlainText, copyHtmlAndPlain} from '@/lib/rich-text'
import { loMayWriteAmount, splitsTotal } from '@/lib/deal-phase'
import { resolveLenderSplits, seedFromGlobal, combineIntoOneLoan,
         lenderTotal, lenderLvr } from '@/lib/lo-splits'
import { emailFreshness, blocksSending, notesAfterScenarioChange } from '@/lib/email-freshness'
import { dealPurpose } from '@/lib/deal-facts'
import DealStructure from '@/components/DealStructure'

// A finished "client agreed" is not something to hide. It used to disappear the
// instant it was pressed, which made "already done" look exactly like "broken".
function agreedDay(v: any): string {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d.getTime()) ? '' : ' ' + d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })
}

function makeUid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

type RefinanceSplit = {
  id: string
  label: string
  amount: string
  // Owner occupied or investment, and - on a deal that both refinances and buys
  // - what this part of the money actually does. Recorded per split because a
  // refinance releasing equity for an investment is both, and deciding it from
  // the scenario's name filed those deals owner occupied.
  purpose?: string
  funds?: string
}

type LenderSplit = {
  id: string
  label: string
  amount: string
  lvr: string
  rate: string
  repayment: string
  repaymentType: string
}

type LenderProduct = {
  id: string
  lender_id: string
  lender_name: string
  product_name: string
  rate_type: string
  loan_purpose: string
  application_fee: string | null
  annual_fee: string | null
  valuation_fee: string | null
  legal_fee: string | null
  rate_lock_fee: string | null
  early_repayment_fee: string | null
  discharge_fee: string | null
  offset_account: boolean
  multiple_offsets: boolean
  notes: string | null
  is_draft: boolean
  active: boolean
}

type RateModule = { enabled: boolean; rate: string; repayment: string; loanTerm: string; ioYears?: string; fixedYears?: string }

type LenderOption = {
  lenderId: string
  lenderProductId: string
  lenderName: string
  productName: string
  approvalDays: string
  applicationFee: string
  annualFee: string
  valuationFee: string
  legalFee: string
  // What this bank calls it, copied at the moment the lender was chosen so a
  // document written last month keeps the wording it was written with.
  legalFeeLabel?: string
  rateLockFee: string
  earlyRepaymentFee: string
  dischargeFee: string
  offsetAccount: string
  libraryNotes: string
  maxEquity: string
  specialNote: string
  variablePI: RateModule
  variableIO: RateModule
  fixedPI: RateModule
  fixedIO: RateModule
  bridgingRate: string
  bridgingTerm: string
  bridgingLoanAmount: string
  estimatedInterest: string
  establishmentFee: string
  monthlyFee: string
  docProcessingFee: string
  lenderSplits: LenderSplit[]
}

type LOData = {
  template: string
  bcTemplate: string
  firstName: string
  lastName: string
  joint: string
  jointFirstName: string
  jointLastName: string
  loanAmount: string
  purchasePrice: string
  deposit: string
  stampDuty: string
  // Carried through from the BC so the email can name the state the duty
  // belongs to, rather than printing NSW for everybody.
  dutyState: string
  // And the trading name, so the LO cannot go out under a different brand from
  // the borrowing capacity email that preceded it on the same deal.
  brandId: string
  existingLoan: string
  // What the LVR is measured against. On a refinance it is the BC's property
  // value; on a purchase, the purchase price. Carried across for the same reason
  // the duty state and the brand are - so the LO does not have to be told again
  // something the BC already knows.
  propertyValue: string
  brokerPersonalisation: string
  documentsRequired: string[]
  criteriaUsed: string[]
  additionalNotes: string
  importantNotes: string
  lenders: LenderOption[]
  recommendedLender: string
  recommendationNote: string
  internalNotes: string
  emailHtml: string
  // Which scenario emailHtml was written for. Same shape as the BC - the saved
  // email cannot otherwise tell you whether it still matches the deal.
  emailHtmlTemplate: string
  refinanceSplits: RefinanceSplit[]
  brokerSig: string
  clientAgreedLender: string
  clientChosenLender: string
  clientChosenLenderOther: string
  clientChosenLenderReason: string
}

const defaultRateModule: RateModule = { enabled: false, rate: '', repayment: '', loanTerm: '30', ioYears: '5', fixedYears: '2' }

const defaultLenderOption = (): LenderOption => ({
  lenderId: '', lenderProductId: '', lenderName: '', productName: '', approvalDays: '',
  applicationFee: '', annualFee: '', valuationFee: '', legalFee: '', legalFeeLabel: '', rateLockFee: '',
  earlyRepaymentFee: '', dischargeFee: '', offsetAccount: '', libraryNotes: '',
  maxEquity: '', specialNote: '',
  variablePI: { ...defaultRateModule },
  variableIO: { ...defaultRateModule },
  fixedPI: { ...defaultRateModule },
  fixedIO: { ...defaultRateModule },
  bridgingRate: '', bridgingTerm: '12', bridgingLoanAmount: '', estimatedInterest: '',
  establishmentFee: '', monthlyFee: '', docProcessingFee: '',
  lenderSplits: []
})

const CRITERIA_OPTIONS = [
  'Competitive interest rate', 'Good turnaround times', 'Ability to have an offset account',
  'Fully assessed pre-approval applications', 'Flexible with last 12 months bonus income',
  'Flexible with bridging finance', 'Flexible loan term policy'
]

const TEMPLATES = [
  { id: 'lo_purchase', label: 'LO Purchase' },
  { id: 'lo_refinance', label: 'LO Refinance' },
  { id: 'lo_bridging', label: 'LO Bridging' },
]

const LO_TEMPLATE_NOTES: Record<string, string[]> = {
  lo_purchase: ['Any rates or fees quoted are subject to change', 'This email does not constitute as a formal approval'],
  lo_refinance: ['Any rates or fees quoted are subject to change', 'This email does not constitute as a formal approval'],
  lo_bridging: ['Any rates or fees quoted are subject to change', 'This email does not constitute as a formal approval'],
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
      {children}
    </div>
  )
}

// One copy, in lib/money.ts. This was written out identically here and in the
// other form.
const formatNumber = formatAsTyped

function NumberInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">$</span>
      <input className="w-full border border-gray-200 rounded-lg pl-5 pr-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF]" placeholder={placeholder} value={value}
        onChange={e => onChange(formatNumber(e.target.value))} />
    </div>
  )
}

function LibraryField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-xs font-medium text-gray-500">{label}</label>
        <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded font-medium">library</span>
      </div>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">$</span>
        <input className="w-full border border-gray-200 rounded-lg pl-5 pr-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF] bg-blue-50/30" value={value} onChange={e => onChange(formatNumber(e.target.value))} placeholder="—" />
      </div>
    </div>
  )
}

export default function LOForm({ deal, onStageChange, userRole, onSaveStatus, onDealFieldChange }: { deal: any; onStageChange?: (stage: string) => void; userRole?: string; onSaveStatus?: (s: { at?: string; error?: string }) => void; onDealFieldChange?: (field: string, value: any) => void }) {
  const supabase = createSupabaseBrowser()
  const saveKey = `lo_${deal.id}`
  const bc = deal.bc_data || {}
  const ff = deal.fact_find_data || {}
  const ffApp2 = (ff.applicants || [])[1] || {}

  const [allProducts, setAllProducts] = useState<LenderProduct[]>([])
  const [generating, setGenerating] = useState(false)
  const [generatingRec, setGeneratingRec] = useState(false)
  const [emailHtml, setEmailHtml] = useState('')
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form')
  const [savedAt, setSavedAt] = useState('')
  const [saveError, setSaveError] = useState('')
  // Mirror save state up to the deal header, which owns the single indicator.
  useEffect(() => { onSaveStatus?.({ at: savedAt, error: saveError }) }, [savedAt, saveError])
  const [newDoc, setNewDoc] = useState('')
  const [newCriteria, setNewCriteria] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState('')
  const [loCompletedAt, setLoCompletedAt] = useState<string | null>(deal.lo_completed_at || null)
  const [markingLoComplete, setMarkingLoComplete] = useState(false)
  const [sendingToCreditTeam, setSendingToCreditTeam] = useState(false)
  const [creditTeamMsg, setCreditTeamMsg] = useState('')
  const [creditTeamErr, setCreditTeamErr] = useState('')
  const [assignmentRefreshKey, setAssignmentRefreshKey] = useState(0)
  const [clientProceeded, setClientProceeded] = useState<boolean>(!!deal.lo_client_proceeded)

  // --- documents received ---------------------------------------------------
  //
  // The deal row carries the two timestamps; Settings carries the wait and who
  // files. Both are read here so the line under the buttons can say a real time
  // rather than "in 30 minutes", which a page left open would keep promising.
  const [docsDeal, setDocsDeal] = useState<any>({
    docs_received_at: deal.docs_received_at || null,
    docs_received_by: deal.docs_received_by || null,
    docs_assessor_due_at: deal.docs_assessor_due_at || null,
    assigned_credit_officer: deal.assigned_credit_officer || null,
  })
  const [docsFiler, setDocsFiler] = useState('')
  const [docsBusy, setDocsBusy] = useState(false)
  const [docsErr, setDocsErr] = useState('')
  const docs = docsStateOf(docsDeal)

  useEffect(() => {
    let live = true
    ;(async () => {
      const { data: st } = await supabase.from('settings')
        .select('docs_file_notification_user_id').eq('id', 'singleton').single()
      if (!live || !st) return
      if (st.docs_file_notification_user_id) {
        const { data: p } = await supabase.from('user_profiles').select('full_name')
          .eq('id', st.docs_file_notification_user_id).single()
        if (live && p?.full_name) setDocsFiler(p.full_name)
      }
    })()
    return () => { live = false }
  }, [])

  const docsDay = (iso?: string | null) => {
    if (!iso) return ''
    return ' \u00b7 ' + new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  }

  async function markDocsReceived() {
    setDocsBusy(true); setDocsErr('')
    try {
      const res = await fetch('/api/docs-received', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) { setDocsErr(data.error || 'Nothing was marked and no email was sent.'); return }
      setDocsDeal((prev: any) => ({
        ...prev,
        docs_received_at: data.receivedAt || new Date().toISOString(),
        docs_received_by: data.by || null,
        docs_assessor_due_at: data.dueAt || null,
      }))
      // Both emails away but something did not stick: said out loud rather than
      // left to look finished.
      if (data.warning) setDocsErr(data.warning)
    } catch (e: any) {
      setDocsErr(e?.message || 'Nothing was marked and no email was sent.')
    } finally { setDocsBusy(false) }
  }

  async function cancelDocsReceived() {
    setDocsBusy(true); setDocsErr('')
    try {
      const res = await fetch('/api/docs-received', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, cancel: true }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) { setDocsErr(data.error || 'Nothing was changed.'); return }
      setDocsDeal((prev: any) => ({ ...prev, docs_received_at: null, docs_received_by: null, docs_assessor_due_at: null }))
    } catch (e: any) {
      setDocsErr(e?.message || 'Nothing was changed.')
    } finally { setDocsBusy(false) }
  }
  const [proceedInfo, setProceedInfo] = useState(() => proceedCredit(deal, 'LO'))
  const [showMoveToCompliancePopup, setShowMoveToCompliancePopup] = useState(false)
  const [sendingMoveToCompliance, setSendingMoveToCompliance] = useState(false)
  const [moveToComplianceMsg, setMoveToComplianceMsg] = useState('')

  // What the BC says the whole loan is. A deal with a land loan and a
  // construction loan, or a refinance with an equity release, has more than one
  // split and the total is the loan - not whichever one happens to be first.
  const bcLoanAmount = (): string => {
    const total = splitsTotal(bc.splits)
    return total ? formatNumber(String(total)) : ''
  }

  const initRefinanceSplits = (): RefinanceSplit[] => {
    if (bc.splits?.length > 0) {
      return bc.splits.map((s: any, i: number) => ({
        id: makeUid(),
        label: s.label || (i === 0 ? 'Loan to be refinanced' : `Split ${i + 1}`),
        amount: s.amount || ''
      }))
    }
    return [{ id: makeUid(), label: 'Loan to be refinanced', amount: bc.existingLoanBal || '' }]
  }

  const initData = (): LOData => {
    // Database first, same as FactFindForm. Reading localStorage first meant two people
    // opening the same deal saw different data, and an empty cache built blank defaults
    // over the top of a real record.
    if (deal?.lo_data && Object.keys(deal.lo_data).length > 0) {
      const fromDb: any = deal.lo_data
      if (!fromDb.refinanceSplits) fromDb.refinanceSplits = initRefinanceSplits()
      return fromDb
    }
    const initialTemplate = bc.template?.startsWith('refinance') ? 'lo_refinance' : bc.template === 'bridging' ? 'lo_bridging' : 'lo_purchase'
    return {
      template: initialTemplate,
      bcTemplate: bc.template || '',
      firstName: bc.firstName || '',
      lastName: bc.lastName || '',
      joint: bc.joint || 'No',
      jointFirstName: ffApp2.firstName || '',
      jointLastName: ffApp2.lastName || '',
      // EVERY split, not the first. See the note on splitsTotal.
      loanAmount: bcLoanAmount(),
      purchasePrice: bc.purchasePrice || '',
      deposit: bc.deposit || '',
      stampDuty: bc.stampDuty || '',
      dutyState: bc.dutyState || '',
      brandId: bc.brand || '',
      existingLoan: bc.existingLoanBal || '',
      propertyValue: bc.propertyValue || bc.purchasePrice || '',
      brokerPersonalisation: '',
      documentsRequired: [],
      criteriaUsed: bc.template?.startsWith('refinance') ? ['Competitive interest rate', 'Good turnaround times', 'Ability to have an offset account'] :
        bc.template === 'bridging' ? ['Competitive interest rate', 'Good turnaround times', 'Flexible with bridging finance'] :
        ['Competitive interest rate', 'Good turnaround times', 'Ability to have an offset account', 'Fully assessed pre-approval applications'],
      additionalNotes: '',
      importantNotes: (LO_TEMPLATE_NOTES[initialTemplate] || []).join('\n'),
      lenders: [defaultLenderOption()],
      recommendedLender: '',
      recommendationNote: '',
      internalNotes: '',
      emailHtml: '',
      emailHtmlTemplate: '',
      refinanceSplits: initRefinanceSplits(),
      brokerSig: deal.assigned_broker || 'Fabio',
      clientAgreedLender: '',
      clientChosenLender: '',
      clientChosenLenderOther: '',
      clientChosenLenderReason: ''
    }
  }

  const [d, setD] = useState<LOData>(initData)
  // What the database last agreed with. Anything equal to this is not an edit,
  // so opening the form, or a re-render, never writes.
  const savedRef = useRef<string | null>(null)
  const canSendToClient = can(userRole, 'sendClientEmails')

  useEffect(() => {
    async function syncRateObservations() {
      // Same fix as the compliance form: read the deal, not the scenario's name.
      const purpose = dealPurpose(deal).binary === 'Investment' ? 'Investment' : 'Owner Occupied'
      const loanAmountNum = Number((d.loanAmount || '').toString().replace(/,/g, '')) || 0
      const purchasePriceNum = Number((d.purchasePrice || '').toString().replace(/,/g, '')) || 0
      const lvr = purchasePriceNum > 0 && loanAmountNum > 0 ? Math.round((loanAmountNum / purchasePriceNum) * 1000) / 10 : null

      for (const lender of d.lenders) {
        if (!lender.lenderName) continue

        const piRate = lender.variablePI?.enabled ? lender.variablePI.rate : (lender.fixedPI?.enabled ? lender.fixedPI.rate : null)
        const ioRate = lender.variableIO?.enabled ? lender.variableIO.rate : (lender.fixedIO?.enabled ? lender.fixedIO.rate : null)

        if (piRate) {
          // fire-and-forget: an observation log, written as a by-product of saving
          // the LO so the rate library fills itself up over time. The Lending
          // Options document itself is saved separately and IS checked. Losing a
          // row here costs one data point in a reference table; it changes nothing
          // the client sees and nothing the deal depends on. Reporting it would
          // make a perfectly saved LO look broken.
          await supabase.from('lender_rate_observations').upsert({
            deal_id: deal.id,
            lender_name: lender.lenderName,
            repayment_type: 'PI',
            purpose,
            rate: Number(piRate) || null,
            lvr,
            loan_amount: loanAmountNum || null,
            broker_name: d.brokerSig || deal.assigned_broker,
            updated_at: new Date().toISOString()
          }, { onConflict: 'deal_id,lender_name,repayment_type' })
        }
        if (ioRate) {
          // fire-and-forget: as above - the rate library, not the deal.
          await supabase.from('lender_rate_observations').upsert({
            deal_id: deal.id,
            lender_name: lender.lenderName,
            repayment_type: 'IO',
            purpose,
            rate: Number(ioRate) || null,
            lvr,
            loan_amount: loanAmountNum || null,
            broker_name: d.brokerSig || deal.assigned_broker,
            updated_at: new Date().toISOString()
          }, { onConflict: 'deal_id,lender_name,repayment_type' })
        }
      }
    }
    syncRateObservations()
  }, [d.lenders, d.loanAmount, d.purchasePrice, d.bcTemplate])
  const [lenderIdByName, setLenderIdByName] = useState<Record<string, string>>({})
  const [brokersList, setBrokersList] = useState<{ name: string }[]>([{ name: 'Fabio' }, { name: 'Mark' }])

  useEffect(() => {
    supabase.from('brokers').select('broker_key, name, active').order('name').then(({ data }: any) => {
      const rows = (data || []).filter((b: any) => b.active !== false).map((b: any) => ({ name: b.name }))
      if (rows.length) setBrokersList(rows)
    })
  }, [])

  useEffect(() => {
    const newTemplate = bc.template?.startsWith('refinance') ? 'lo_refinance' : bc.template === 'bridging' ? 'lo_bridging' : 'lo_purchase'
    setD(prev => ({
      ...prev,
      template: newTemplate,
      bcTemplate: bc.template || '',
      firstName: bc.firstName || '',
      lastName: bc.lastName || '',
      joint: bc.joint || 'No',
      jointFirstName: ffApp2.firstName || '',
      jointLastName: ffApp2.lastName || '',
      // EVERY split, not the first. See the note on splitsTotal.
      loanAmount: bcLoanAmount(),
      purchasePrice: bc.purchasePrice || '',
      deposit: bc.deposit || '',
      stampDuty: bc.stampDuty || '',
      dutyState: bc.dutyState || '',
      brandId: bc.brand || '',
      existingLoan: bc.existingLoanBal || '',
      propertyValue: bc.propertyValue || bc.purchasePrice || '',
      refinanceSplits: initRefinanceSplits(),
    }))
  }, [deal.bc_data])

  function selectTemplate(id: string) {
    // This used to overwrite the notes flat, which deleted whatever the broker
    // had typed. The BC never overwrote them at all, which left the old
    // scenario's wording in place. Neither was right and they disagreed with
    // each other; both now swap only untouched default wording.
    setD({
      ...d,
      template: id,
      importantNotes: notesAfterScenarioChange(d.importantNotes, LO_TEMPLATE_NOTES[d.template] || [], LO_TEMPLATE_NOTES[id] || []),
    })
  }

  useEffect(() => {
    Promise.all([
      supabase.from('lender_products').select('*'),
      supabase.from('lenders').select('id, name')
    ]).then(([{ data: products }, { data: lenders }]) => {
      if (products && lenders) {
        const lenderMap: Record<string, string> = {}
        lenders.forEach((l: any) => { lenderMap[l.id] = l.name })
        setAllProducts(products.map((p: any) => ({ ...p, lender_name: lenderMap[p.lender_id] || '' })))
        // Name to id, so the recommended lender can be recorded on the deal.
        const byName: Record<string, string> = {}
        lenders.forEach((l: any) => { byName[String(l.name || '').trim().toLowerCase()] = l.id })
        setLenderIdByName(byName)
      }
    })
    supabase.from('deals').select('lo_data').eq('id', deal.id).single().then(({ data }) => {
      if (data?.lo_data && Object.keys(data.lo_data).length > 0) {
        putOnScreen(data.lo_data)
      }
    })
  }, [])

  // WHOSE COPY IS ON SCREEN.
  //
  // This form autosaves the WHOLE lo_data blob. With two people on one deal that
  // is last-write-wins on a shared document: Katie fills in the rates, her
  // browser writes the blob; the next keystroke in anybody else's browser writes
  // THEIR blob, loaded before those rates existed, and the rates are gone with no
  // error and nothing on screen. Fabio, 4 Sep 2026: "Katie put all the rates and
  // repayments in but when it came to me some of the boxes were blank."
  //
  // So before every write it checks the record is still the one it loaded. If
  // somebody else has saved in the meantime it does NOT write - it says so and
  // offers to reload. Refusing to save is the safe failure here; overwriting
  // somebody's afternoon silently is not.
  const guardRef = useRef(emptyGuard())
  const [conflict, setConflict] = useState(false)

  // Put a stored lo_data on screen: the two defaults this form applies on load,
  // then the state, then the two refs that remember what it came from.
  //
  // savedRef and the guard hold DIFFERENT things on purpose. savedRef holds the
  // value AFTER the defaults, so applying them does not look like typing. The
  // guard holds EXACTLY what the database had, before them - otherwise it would
  // never match the stored record and every save would look like somebody
  // else's.
  //
  // Used both on first load and when somebody else has saved while nothing has
  // been typed here, which is the case that used to put the banner up in front
  // of people who were only looking.
  function putOnScreen(stored: any) {
    const loaded = { ...(stored as LOData) }
    if (!loaded.importantNotes) loaded.importantNotes = (LO_TEMPLATE_NOTES[loaded.template] || []).join('\n')
    if (!loaded.refinanceSplits) loaded.refinanceSplits = initRefinanceSplits()
    savedRef.current = JSON.stringify(loaded)
    adopt(guardRef.current, stored)
    setD(loaded)
    if (loaded.emailHtml) setEmailHtml(loaded.emailHtml)
  }

  useEffect(() => {
    // The database is the only store. No localStorage copy - a per-browser cache keyed only
    // by deal id showed one user another user's state, and let a blank form overwrite a real
    // record. Debounced because this previously wrote on every keystroke, which hammers the
    // database and lets an older payload land after a newer one.
    const t = setTimeout(() => {
      // Opening the form is not editing it. The state changes when the saved
      // record is loaded in, which looked identical to a keystroke - so every
      // visit wrote the record back, and on a lodged or settled deal that meant
      // overwriting the real amount with this form's estimate.
      const now = JSON.stringify(d)
      // The very first run is the form arriving on screen, never a person.
      if (savedRef.current === null) { savedRef.current = now; return }
      if (now === savedRef.current) return

      // The loan amount goes onto the DEAL, not just into lo_data.
      //
      // `deals.loan_amount` is read by the pipeline, the settlements board, the
      // cheat sheet, the commission panel and the deal board — and until now
      // nothing ever wrote it. The figure was typed here, saved into lo_data, and
      // every screen that wanted it looked at the empty column instead. Same for
      // the lender: the LO knows which one is recommended and the deal did not.
      const loanNum = Number(String(d.loanAmount || '').replace(/[^0-9.]/g, '')) || null
      const recId = lenderIdByName[String(d.recommendedLender || '').trim().toLowerCase()] || null
      const extraColumns: any = {}
      // Only while the deal is still being written. Once it is lodged, what was
      // lodged and what settled are the record; this figure is an estimate that
      // has been overtaken. See loMayWriteAmount.
      if (loanNum && loMayWriteAmount(deal)) extraColumns.loan_amount = loanNum
      if (recId) extraColumns.lender_id = recId

      ;(async () => {
        const out = await saveGuarded({
          supabase, dealId: deal.id, column: 'lo_data', guard: guardRef.current, value: d,
          patch: extraColumns,
          onAdopt: stored => { if (stored) putOnScreen(stored) },
        })
        if (out.kind === 'superseded') return
        setConflict(out.kind === 'conflict')
        if (out.kind === 'error') { console.error('LO autosave:', out.message); setSaveError(out.message); return }
        setSaveError('')
        if (out.kind === 'saved') {
          savedRef.current = now
          setSavedAt(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
        }
      })()
    }, 700)
    return () => clearTimeout(t)
  }, [d])

  const uniqueLenders = Array.from(new Map(allProducts.map(p => [p.lender_id, { id: p.lender_id, name: p.lender_name }])).values()).sort((a, b) => a.name.localeCompare(b.name))

  function getProductsForLender(lenderId: string) {
    return allProducts.filter(p => p.lender_id === lenderId)
  }

  function selectLenderName(i: number, lenderId: string) {
    const lender = uniqueLenders.find(l => l.id === lenderId)
    const updated = [...d.lenders]
    updated[i] = { ...updated[i], lenderId, lenderName: lender?.name || '', legalFeeLabel: legalFeeLabel(lender), lenderProductId: '', productName: '', applicationFee: '', annualFee: '', valuationFee: '', legalFee: '', rateLockFee: '', earlyRepaymentFee: '', dischargeFee: '', offsetAccount: '', libraryNotes: '' }
    setD({ ...d, lenders: updated })
  }

  function selectProduct(i: number, productId: string) {
    const product = allProducts.find(p => p.id === productId)
    if (!product) return
    const updated = [...d.lenders]
    updated[i] = { ...updated[i], lenderProductId: productId, productName: product.product_name, applicationFee: product.application_fee || '', annualFee: product.annual_fee || '', valuationFee: product.valuation_fee || '', legalFee: product.legal_fee || '', rateLockFee: product.rate_lock_fee || '', earlyRepaymentFee: product.early_repayment_fee || '', dischargeFee: product.discharge_fee || '', offsetAccount: product.offset_account ? (product.multiple_offsets ? 'Yes — multiple offsets' : 'Yes') : 'No', libraryNotes: product.notes || '' }
    setD({ ...d, lenders: updated })
  }

  function updateLender(i: number, field: keyof LenderOption, value: any) {
    const updated = [...d.lenders]
    updated[i] = { ...updated[i], [field]: value }
    setD({ ...d, lenders: updated })
  }

  function updateRateModule(lenderIdx: number, module: 'variablePI' | 'variableIO' | 'fixedPI' | 'fixedIO', field: keyof RateModule, value: any) {
    const updated = [...d.lenders]
    updated[lenderIdx] = { ...updated[lenderIdx], [module]: { ...updated[lenderIdx][module], [field]: value } }
    setD({ ...d, lenders: updated })
  }

  function addLender() {
    if (d.lenders.length >= 3) return
    setD({ ...d, lenders: [...d.lenders, { ...defaultLenderOption(), lenderSplits: seedFromGlobal(d.refinanceSplits) }] })
  }

  function removeLender(i: number) {
    setD({ ...d, lenders: d.lenders.filter((_, idx) => idx !== i) })
  }

  function toggleCriteria(c: string) {
    setD({ ...d, criteriaUsed: d.criteriaUsed.includes(c) ? d.criteriaUsed.filter(x => x !== c) : [...d.criteriaUsed, c] })
  }

  function addRefinanceSplit() {
    const newSplit: RefinanceSplit = { id: makeUid(), label: `Split ${d.refinanceSplits.length + 1}`, amount: '' }
    setD({ ...d, refinanceSplits: [...d.refinanceSplits, newSplit] })
  }

  function addEquityRelease() {
    const newSplit: RefinanceSplit = { id: makeUid(), label: 'Equity release', amount: '' }
    setD({ ...d, refinanceSplits: [...d.refinanceSplits, newSplit] })
  }

  // Written from the deal structure block at the top of this tab. It goes
  // through the LO's own state rather than straight to the database, because
  // this form autosaves the whole lo_data blob and a second writer would be
  // overwritten the next time somebody typed in here.
  function setSplitField(id: string, patch: { purpose?: string; funds?: string }) {
    setD(x => {
      const list = x.refinanceSplits || []
      const m = /^s(\d+)$/.exec(id)
      const found = list.findIndex(s => s.id === id)
      const at = found >= 0 ? found : m ? Number(m[1]) : -1
      if (at < 0 || at >= list.length) return x
      const next = [...list]
      next[at] = { ...next[at], ...patch }
      return { ...x, refinanceSplits: next }
    })
  }

  function removeRefinanceSplit(idx: number) {
    if (d.refinanceSplits.length <= 1) return
    setD({ ...d, refinanceSplits: d.refinanceSplits.filter((_, i) => i !== idx) })
  }

  function updateRefinanceSplit(idx: number, field: keyof RefinanceSplit, value: string) {
    const splits = [...d.refinanceSplits]
    splits[idx] = { ...splits[idx], [field]: value }
    setD({ ...d, refinanceSplits: splits })
  }

  function syncLenderSplits(lenderIdx: number) {
    const updated = [...d.lenders]
    updated[lenderIdx] = { ...updated[lenderIdx], lenderSplits: seedFromGlobal(d.refinanceSplits) }
    setD({ ...d, lenders: updated })
  }

  // Drop one split on ONE lender. There was no way to do this, so a lender that
  // wanted the money as a single loan could only have a split zeroed - which put
  // a "$0" line in the client's email. Sync from top puts them all back.
  function removeLenderSplit(lenderIdx: number, splitIdx: number) {
    const updated = [...d.lenders]
    const splits = resolveLenderSplits(updated[lenderIdx], d.refinanceSplits).filter((_, i) => i !== splitIdx)
    updated[lenderIdx] = { ...updated[lenderIdx], lenderSplits: splits }
    setD({ ...d, lenders: updated })
  }

  // Some lenders will not carve the deal up the way it is structured. One button,
  // one lender, nothing else on the deal touched.
  function combineLenderSplits(lenderIdx: number) {
    const updated = [...d.lenders]
    updated[lenderIdx] = {
      ...updated[lenderIdx],
      lenderSplits: combineIntoOneLoan(resolveLenderSplits(updated[lenderIdx], d.refinanceSplits)),
    }
    setD({ ...d, lenders: updated })
  }

  function updateLenderSplit(lenderIdx: number, splitIdx: number, field: keyof LenderSplit, value: string) {
    const updated = [...d.lenders]
    // Resolved, not raw. A lender showing the deal's splits by fallback has an
    // empty list of its own, so editing a row would otherwise write into nothing
    // and the typing would vanish. The first edit is what makes the copy real.
    const splits = [...resolveLenderSplits(updated[lenderIdx], d.refinanceSplits)]
    splits[splitIdx] = { ...splits[splitIdx], [field]: value }
    updated[lenderIdx] = { ...updated[lenderIdx], lenderSplits: splits }
    setD({ ...d, lenders: updated })
  }

  const [flagOpen, setFlagOpen] = useState(false)
  const [flagNote, setFlagNote] = useState('')
  const [flagSubmitting, setFlagSubmitting] = useState(false)
  const [flagMsg, setFlagMsg] = useState('')
  const [loStyleNotes, setLoStyleNotes] = useState<string[]>([])

  useEffect(() => {
    supabase.from('settings').select('lo_style_notes').eq('id', 'singleton').single()
      .then(({ data }) => { if (data?.lo_style_notes?.length) setLoStyleNotes(data.lo_style_notes) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submitFlag() {
    if (!flagNote.trim()) return
    setFlagSubmitting(true); setFlagMsg('')
    const { data: userData } = await supabase.auth.getUser()
    // A blocked policy returns no rows and no error, so the row is what proves it.
    const { data, error } = await supabase.from('compliance_flags').insert({
      deal_id: deal.id,
      stage: 'lo',
      field_key: 'lo_recommendation',
      field_label: 'LO recommendation paragraph',
      note: flagNote.trim(),
      flagged_by: userData?.user?.email || 'unknown',
    }).select('id')
    setFlagSubmitting(false)
    if (error || !data || data.length === 0) {
      setFlagMsg('NOT SENT — ' + (error?.message || 'the database refused it. Nothing was saved.'))
      return
    }
    setFlagOpen(false); setFlagNote('')
    setFlagMsg('Flag sent. It will appear in Settings → Compliance AI.')
    setTimeout(() => setFlagMsg(''), 6000)
  }

  async function generateRecommendation() {
    setGeneratingRec(true)
    const rec = d.lenders.find(l => l.lenderName === d.recommendedLender)
    const lenderSummaries = d.lenders.map(l => {
      const rate = l.variablePI.enabled ? `${l.variablePI.rate}% p.a. variable P&I` : (l.variableIO.enabled ? `${l.variableIO.rate}% p.a. variable IO` : (l.fixedPI.enabled ? `${l.fixedPI.rate}% p.a. fixed P&I` : 'rate not specified'))
      return `- ${l.lenderName} (${l.productName || 'product not specified'}): ${rate}, annual fee ${l.annualFee || 'nil'}, application fee ${l.applicationFee || 'nil'}, approval turnaround ${l.approvalDays || 'not specified'} days${l.lenderName === d.recommendedLender ? ' [RECOMMENDED]' : ''}`
    }).join('\n')
    const criteriaList = (d.criteriaUsed || []).join(', ') || 'not specified'
    const loanPurposeContext = ff.loanPurpose ? `\n\nThe client's stated purpose for this loan: "${ff.loanPurpose}". Where genuinely relevant, briefly connect the recommendation to this stated purpose — do not force it if there's no natural connection.` : ''
    const prompt = `You are a mortgage broker writing a recommendation for a client. Here are all the lending options reviewed:\n${lenderSummaries}\n\nThe research criteria that mattered for this client: ${criteriaList}.${loanPurposeContext}\n\nWrite 2-3 professional sentences recommending ${d.recommendedLender} (${rec?.productName}) for a loan amount of ${d.loanAmount}. Explicitly compare it against the other option(s) listed above — reference rate, fees, and approval turnaround days where the recommended lender is genuinely better, and mention which of the client's research criteria it satisfies. Be specific and factual, don't just describe the recommended lender in isolation. Do not use placeholder text.`
    try {
      const res = await fetch('/api/generate-lo-recommendation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, styleNotes: loStyleNotes }) })
      const data = await res.json()
      if (data.error) { alert('Error generating recommendation: ' + data.error); setGeneratingRec(false); return }
      const text = data.text || ''
      if (text) setD({ ...d, recommendationNote: text })
    } catch (e: any) { alert('Error generating recommendation: ' + e.message) }
    setGeneratingRec(false)
  }

  // The deposit is everything the client puts in, stamp duty included — the same
  // rule the BC form uses. Stamp duty is paid out of that money, so only what is
  // left over reduces the loan. Leaving stamp duty out here is what made a
  // $351,000 deposit arrive in LO as $320,000.
  const num = (v: unknown) => parseFloat(String(v ?? '0').replace(/,/g, '')) || 0
  const loanFrom = (price: number, deposit: number, stampDuty: number) =>
    formatNumber(Math.max(0, Math.round(price - Math.max(0, deposit - stampDuty))).toString())
  const depositFrom = (price: number, loan: number, stampDuty: number) =>
    formatNumber(Math.max(0, Math.round(price - loan + stampDuty)).toString())

  // Deals saved before the deposit rule changed still carry the old figure: the
  // handlers only recalculate when somebody retypes a field, so an untouched
  // deal keeps a deposit that is short by the stamp duty. The three numbers are
  // checked against each other on every render, and where they disagree it is
  // said out loud rather than quietly corrected — a broker may have set a figure
  // deliberately, and rewriting saved numbers under them is worse than a warning.
  const depositGap = (() => {
    const price = num(d.purchasePrice), dep = num(d.deposit)
    const loan = num(d.loanAmount), sd = num(d.stampDuty)
    if (!price || !dep || !loan) return null
    const expectedLoan = Math.max(0, Math.round(price - Math.max(0, dep - sd)))
    const gap = Math.round(loan - expectedLoan)
    if (Math.abs(gap) <= 1) return null
    return {
      gap,
      // Out by the stamp duty is the fingerprint of the old rule.
      looksLikeOldRule: sd > 0 && Math.abs(Math.abs(gap) - sd) <= 2,
      suggestedDeposit: formatNumber(Math.max(0, Math.round(price - loan + sd)).toString()),
    }
  })()

  function handleLoPurchasePriceChange(val: string) {
    const price = num(val), dep = num(d.deposit), sd = num(d.stampDuty)
    if (dep > 0) {
      setD(prev => ({ ...prev, purchasePrice: val, loanAmount: loanFrom(price, dep, sd) }))
    } else {
      const loanAmt = num(d.loanAmount)
      if (loanAmt > 0) {
        setD(prev => ({ ...prev, purchasePrice: val, deposit: depositFrom(price, loanAmt, sd) }))
      } else {
        setD(prev => ({ ...prev, purchasePrice: val }))
      }
    }
  }

  function handleLoDepositChange(val: string) {
    const price = num(d.purchasePrice), dep = num(val), sd = num(d.stampDuty)
    if (price > 0) {
      setD(prev => ({ ...prev, deposit: val, loanAmount: loanFrom(price, dep, sd) }))
    } else {
      setD(prev => ({ ...prev, deposit: val }))
    }
  }

  function handleLoLoanAmountChange(val: string) {
    const price = num(d.purchasePrice), loanAmt = num(val), sd = num(d.stampDuty)
    if (price > 0) {
      setD(prev => ({ ...prev, loanAmount: val, deposit: depositFrom(price, loanAmt, sd) }))
    } else {
      setD(prev => ({ ...prev, loanAmount: val }))
    }
  }

  // Typing the deposit before the stamp duty used to leave the loan on the old
  // figure. Changing either recalculates the loan, so the order does not matter.
  function handleLoStampDutyChange(val: string) {
    const price = num(d.purchasePrice), dep = num(d.deposit), sd = num(val)
    if (price > 0 && dep > 0) {
      setD(prev => ({ ...prev, stampDuty: val, loanAmount: loanFrom(price, dep, sd) }))
    } else {
      setD(prev => ({ ...prev, stampDuty: val }))
    }
  }

  // Does the saved email still match the scenario the deal is on?
  const freshness = emailFreshness({ emailHtml, emailHtmlTemplate: d.emailHtmlTemplate }, d.template)
  const emailIsStale = blocksSending(freshness)
  const loTemplateLabel = (id: string) => TEMPLATES.find(t => t.id === id)?.label || id

  function getCleanEmailHtml() {
    // Every path to the clipboard comes through here, so this is where the
    // wrong email gets refused rather than in each button.
    if (emailIsStale) {
      throw new Error(`This email was written for ${loTemplateLabel(d.emailHtmlTemplate)} and the deal is now ${loTemplateLabel(d.template)}. Regenerate it before sending.`)
    }
    const fn = (d.firstName || '[Client First Name]').trim()
    const jfn = (d.jointFirstName || '').trim()
    const greetingName = (d.joint === 'Yes' && jfn) ? `${fn} and ${jfn}` : fn
    let clean = `<p style="font-size:14px;color:#333;margin-bottom:14px;line-height:1.6">Hi ${greetingName},</p>`
    // Same as the BC: one <p> per paragraph, not one <p> for the lot.
    clean += emailParagraphs(d.brokerPersonalisation, { colour: '#333', trailing: true })
    // The broker-only block is marked in the generated HTML, so removing it does
    // not depend on how it is styled. If the marker is ever missing, fail loudly
    // rather than mail a client a box headed "Broker personalisation".
    if (!/<!--BROKER-BOX-->[\s\S]*?<!--\/BROKER-BOX-->/.test(emailHtml)) {
      throw new Error('The broker personalisation block could not be found in the generated email.')
    }
    return emailHtml.replace(/<!--BROKER-BOX-->[\s\S]*?<!--\/BROKER-BOX-->/, clean)
  }

  // One way to put the email on the clipboard, used by both buttons. Writing
  // only text/plain hands Outlook raw markup instead of a formatted email.
  // One copy, in lib/rich-text.ts.
  async function copyEmailToClipboard() {
    await copyHtmlAndPlain(getCleanEmailHtml())
  }

  async function sendEmail() {
    if (!emailHtml) return
    setSending(true); setSendError(''); setSent(false)
    try {
      await copyEmailToClipboard()
      const subject = 'Lending Options & Recommendation'
      const applicantEmails = (deal.fact_find_data?.applicants || [])
        .map((a: any) => a.emailPersonal)
        .filter((e: string) => !!e)
      const to = applicantEmails.length > 0 ? Array.from(new Set(applicantEmails)).join(',') : (deal.clients?.email || '')
      const bccParam = deal.salestrekker_bcc ? `&bcc=${encodeURIComponent(deal.salestrekker_bcc)}` : ''
      const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}${bccParam}`

      // Persist BEFORE navigating to mailto. Handing the browser a mailto: can
      // abort requests already in flight, and this write was fired unawaited
      // with .then(() => {}) - so "sent" was shown while lo_sent_at never
      // landed, and the deal sat on "Waiting on: Broker to review and send"
      // forever. BC was fixed for exactly this; LO never was.
      const wasNotYetCompleted = !loCompletedAt
      const nowIso = new Date().toISOString()
      const updates: any = { lo_sent_at: nowIso }
      if (!deal.assigned_credit_officer && !loCompletedAt) updates.lo_completed_at = nowIso

      // A blocked policy returns no rows and no error, so the row is what proves it.
      const { data: saved, error: updErr } = await supabase
        .from('deals').update(updates).eq('id', deal.id).select('id')
      if (updErr || !saved || saved.length === 0) {
        setSendError(updErr?.message
          || 'The email was copied, but the deal was not marked as sent — nothing was saved. Do not close this tab.')
        setSending(false)
        return
      }

      if (updates.lo_completed_at) setLoCompletedAt(nowIso)
      // Tell the page, so the badge at the top moves to "Waiting on: Client to
      // respond" now rather than at the next refresh.
      onDealFieldChange?.('lo_sent_at', nowIso)
      if (updates.lo_completed_at) onDealFieldChange?.('lo_completed_at', nowIso)

      if (wasNotYetCompleted) {
        // keepalive, because the mailto below can cut a normal fetch short
        fetch('/api/notify-salestrekker', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId: deal.id, trigger: 'lo_sent' }), keepalive: true,
        }).catch(() => {})
      }

      window.location.href = mailto
      setSent(true)
      setTimeout(() => setSent(false), 6000)
    } catch (e: any) { setSendError(e?.message || 'Could not copy the email — nothing was sent.') }
    setSending(false)
  }

  async function generateEmail() {
    setGenerating(true)
    const res = await fetch('/api/generate-lo-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ broker: d.brokerSig || deal.assigned_broker, dealId: deal.id, loData: { ...d, importantNotesList: (d.importantNotes || '').split('\n').map((n: string) => n.trim()).filter(Boolean) } })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      alert(err?.error || 'Could not generate the email.')
      setGenerating(false)
      return
    }
    const data = await res.json()
    if (data.html) { setEmailHtml(data.html); setD({ ...d, emailHtml: data.html, emailHtmlTemplate: d.template }); setActiveTab('preview') }
    else alert('No email was returned. Try again.')
    setGenerating(false)
  }

  async function handleMoveToCompliance() {
    setSendingMoveToCompliance(true); setMoveToComplianceMsg('')
    try {
      const res = await fetch('/api/send-next-steps-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealId: deal.id, stage: 'LO' }) })
      const data = await res.json()
      if (!data.ok) { setMoveToComplianceMsg(data.error || 'Failed'); setSendingMoveToCompliance(false); return }
      setClientProceeded(true)
      setProceedInfo({ when: new Date().toISOString(), who: data.by ? `recorded by ${data.by}` : 'recorded by our office' })
      setShowMoveToCompliancePopup(false)
      setMoveToComplianceMsg(data.alreadyProceeded ? 'Already moved to Compliance' : data.emailSent ? 'Moved to Compliance — client emailed' : 'Moved to Compliance — no email on file')
      onStageChange?.('Compliance')
    } catch (e: any) { setMoveToComplianceMsg(e.message) }
    setSendingMoveToCompliance(false)
  }

  async function markLOComplete() {
    setMarkingLoComplete(true)
    const nowIso = new Date().toISOString()
    const { error } = await supabase.from('deals').update({ lo_completed_at: nowIso }).eq('id', deal.id)
    if (error) { setMarkingLoComplete(false); alert('Error: ' + error.message); return }
    setLoCompletedAt(nowIso)
    try { await fetch('/api/notify-broker-stage-complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealId: deal.id, stage: 'LO' }) }) } catch (e) {}
    setMarkingLoComplete(false)
  }

  async function sendToCreditTeam() {
    setSendingToCreditTeam(true); setCreditTeamMsg(''); setCreditTeamErr('')
    try {
      const res = await fetch('/api/allocate-credit-officer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealId: deal.id }) })
      const data = await res.json()
      if (!data.ok) { setCreditTeamErr(data.error || 'Failed'); setSendingToCreditTeam(false); return }
      setCreditTeamMsg(data.alreadyAssigned ? 'Already assigned.' : `Assigned to ${data.assignedTo}${data.emailSent ? ' — notified by email' : ''}`)
      setAssignmentRefreshKey(k => k + 1)
    } catch (e: any) { setCreditTeamErr(e.message) }
    setSendingToCreditTeam(false)
  }

  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF]"
  const sel = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF]"
  const isBridging = d.template === 'lo_bridging'
  const isRefinance = d.template === 'lo_refinance'

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center flex-wrap">
        <div className="flex gap-2 bg-white border border-gray-100 rounded-xl p-1">
          {(['form', 'preview'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-2 rounded-lg text-sm font-medium transition ${activeTab === t ? 'bg-[#343333] text-white' : 'text-gray-400 hover:text-gray-600'}`}>
              {t === 'form' ? 'LO Form' : 'Email Preview'}
            </button>
          ))}
        </div>

        <span className="w-px h-7 bg-gray-200 mx-1" />

        {/* Documents received. One press, two emails, a gap between them - see
            lib/docs-received.ts. */}
        {docs.kind === 'none' && (
          assessorMissing(docsDeal) ? (
            // Nothing is sent and nothing is marked. The deal needs an assessor
            // before there is anybody for the second email to go to.
            <span title={NO_ASSESSOR_MESSAGE}
              className="px-3.5 py-2 text-sm rounded-lg border border-[#EFE2C8] bg-[#FDF6E7] text-[#8A6218]">
              Allocate a credit assessor first
            </span>
          ) : (
            <button onClick={markDocsReceived} disabled={docsBusy}
              className="px-3.5 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50">
              {docsBusy ? 'Marking…' : 'Docs received'}
            </button>
          )
        )}
        {docs.kind === 'waiting' && (
          <span className="px-3.5 py-2 text-sm rounded-lg font-medium bg-[#EAF6FD] text-[#0B5E8A] border border-[#CBE7F8]">
            Docs received{docsDay(docs.receivedAt)}
          </span>
        )}
        {docs.kind === 'done' && (
          <span className="px-3.5 py-2 text-sm rounded-lg font-medium bg-green-50 text-green-600 border border-green-200">
            {'\u2713'} Docs received{docsDay(docs.receivedAt)}
          </span>
        )}

        {clientProceeded ? (
          <>
            <span title={proceedInfo.when ? new Date(proceedInfo.when).toLocaleString('en-AU') : undefined}
              className="px-3.5 py-2 text-sm rounded-lg font-medium bg-green-50 text-green-600 border border-green-200">
              {'\u2713'} Client agreed{agreedDay(proceedInfo.when)}
            </span>
            <span className="text-xs text-gray-400">{proceedInfo.who}</span>
          </>
        ) : (
          <button onClick={() => setShowMoveToCompliancePopup(true)}
            className="px-3.5 py-2 text-sm rounded-lg font-semibold border border-[#141C24] bg-[#141C24] text-white hover:bg-[#28323c] transition">
            Client agreed — move to Compliance
          </button>
        )}
      </div>

      {/* What has happened and what is about to, in words. */}
      {docs.kind === 'waiting' && (
        <div className="border border-[#CBE7F8] bg-[#F5FBFE] rounded-xl px-4 py-3 text-[13px] text-[#0B5E8A] leading-relaxed">
          <b className="text-[#141C24]">{docsFiler || 'The filing team'} has been emailed now</b> to rename
          the documents and file them.{' '}
          <b className="text-[#141C24]">The credit assessor will be emailed at {atTime(docs.dueAt)}</b> to say
          the documents are ready and the lending options can be completed.
          <button onClick={cancelDocsReceived} disabled={docsBusy}
            className="ml-2 align-baseline text-[12.5px] text-[#3E4C59] border border-[#D7DCE1] bg-white rounded-md px-2.5 py-1 disabled:opacity-50">
            Cancel the {atTime(docs.dueAt)} email
          </button>
        </div>
      )}
      {docs.kind === 'done' && (
        <div className="border border-[#BFE3CC] bg-[#F6FDF8] rounded-xl px-4 py-3 text-[13px] text-[#15803D] leading-relaxed">
          <b className="text-[#0F5C33]">{docsFiler || 'The filing team'} was emailed at {atTime(new Date(docs.receivedAt))}</b> to
          rename and file the documents.{' '}
          <b className="text-[#0F5C33]">The credit assessor was emailed at {atTime(docs.dueAt)}</b> to
          say they are ready.
        </div>
      )}
      {docs.kind === 'unscheduled' && (
        <div className="border border-[#E5B7B2] bg-[#FDF0EF] rounded-xl px-4 py-3 text-[13px] text-[#B23A34] leading-relaxed">
          <b>{docsFiler || 'The filing team'} was emailed, but the credit assessor was not.</b> The
          delayed email could not be queued, so nobody is going to be told the documents are ready —
          tell the assessor yourself.
        </div>
      )}
      {docsErr && (
        <div className="border border-red-200 bg-red-50 rounded-xl px-4 py-3 text-[13px] text-red-600">{docsErr}</div>
      )}

      <SaveConflict tab="Lending options" show={conflict} />

      {activeTab === 'form' && (
        <div className="space-y-4">

          {/* THE DEAL, AS ONE BLOCK. Replaces the read-only "From BC" strip
              that used to sit here, and it is the same component the Compliance
              tab shows - one record, so a change made on either is the change.
              Fabio, 3 Sep 2026: "that will replace these 2 section in LO and
              Compliance (static across)". */}
          {/* The LIVE lo_data, not the copy the page loaded with. Handing over
              deal.lo_data meant a split amount typed below did not reach this
              block until the next save and refresh, so it sat there showing a
              dash next to a Scenario box that already had the number. */}
          <DealStructure deal={{ ...deal, lo_data: d }}
            onUpdated={(patch: any) => onDealFieldChange?.('compliance_data', patch.compliance_data)}
            onSplitChange={setSplitField}
            onAddSplit={addRefinanceSplit} />

          {/* Scenario */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Scenario</div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Field label="First name"><input className={inp} value={d.firstName} onChange={e => setD({ ...d, firstName: e.target.value })} /></Field>
              <Field label="Last name"><input className={inp} value={d.lastName} onChange={e => setD({ ...d, lastName: e.target.value })} /></Field>
            </div>
            {d.joint === 'Yes' && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Field label="Joint applicant first name"><input className={inp} value={d.jointFirstName} onChange={e => setD({ ...d, jointFirstName: e.target.value })} /></Field>
                <Field label="Joint applicant last name"><input className={inp} value={d.jointLastName} onChange={e => setD({ ...d, jointLastName: e.target.value })} /></Field>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Field label="Email template">
                <select className={sel} value={d.template} onChange={e => selectTemplate(e.target.value)}>
                  {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </Field>
              {!isRefinance && (
                <Field label="Loan amount">
                  <NumberInput value={d.loanAmount} onChange={handleLoLoanAmountChange} />
                </Field>
              )}
            </div>

            {/* Purchase-specific fields */}
            {!isRefinance && !isBridging && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Purchase price"><NumberInput value={d.purchasePrice} onChange={handleLoPurchasePriceChange} /></Field>
                <Field label="Deposit">
                  <NumberInput value={d.deposit} onChange={handleLoDepositChange} />
                  {(() => {
                    const dep = num(d.deposit), sd = num(d.stampDuty)
                    if (!dep || !sd) return null
                    if (sd >= dep) return <div className="text-[11px] text-red-500 mt-1">Stamp duty exceeds the deposit</div>
                    return <div className="text-[11px] text-gray-500 mt-1">
                      ${formatNumber(Math.round(dep - sd).toString())} into the property after stamp duty
                    </div>
                  })()}
                </Field>
                <Field label="Stamp duty"><NumberInput value={d.stampDuty} onChange={handleLoStampDutyChange} /></Field>
                {depositGap && (
                  <div className="col-span-2 rounded-lg border px-3 py-2.5 text-[12px] leading-[1.6]"
                       style={{ borderColor: '#EBD9BE', background: '#FDF6EC', color: '#7A5F17' }}>
                    <b>These three numbers do not agree.</b>{' '}
                    {depositGap.looksLikeOldRule
                      ? <>The deposit looks like it was worked out before stamp duty was included, so it is short
                          by about ${formatNumber(String(Math.round(num(d.stampDuty))))}. </>
                      : <>Purchase price less the deposit after stamp duty does not come to the loan amount, out
                          by ${formatNumber(String(Math.abs(depositGap.gap)))}. </>}
                    Setting the deposit to <b>${depositGap.suggestedDeposit}</b> makes them line up.
                    <button onClick={() => handleLoDepositChange(depositGap.suggestedDeposit)}
                            className="ml-2 rounded-md border px-2 py-[2px] bg-white"
                            style={{ borderColor: '#EBD9BE', color: '#7A5F17' }}>
                      Use ${depositGap.suggestedDeposit}
                    </button>
                  </div>
                )}
                {/* Comes across from the BC. Editable here so an LO built without
                    one, or corrected after the fact, still names the right state. */}
                <Field label="State">
                  <select className={inp} value={d.dutyState || ''}
                          onChange={e => setD(x => ({ ...x, dutyState: e.target.value }))}>
                    <option value="">Select</option>
                    {['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'].map(x => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label="LVR (calculated)">
                  <div className={inp + " bg-gray-50 text-gray-700"}>
                    {(() => {
                      const price = parseFloat((d.purchasePrice || '0').replace(/,/g, '')) || 0
                      const loanAmt = parseFloat((d.loanAmount || '0').replace(/,/g, '')) || 0
                      const pct = price > 0 ? Math.round((loanAmt / price) * 1000) / 10 : 0
                      return pct > 0 ? `${pct}%` : '\u2014'
                    })()}
                  </div>
                </Field>
              </div>
            )}

            {/* GLOBAL LOAN SPLITS - on every scenario, not just refinances.
                Gating this on the refinance template meant a purchase could only
                ever have the one split the BC gave it, and no way to add a
                second. Fabio, 3 Sep 2026: "I thought LO had the ability of
                adding multiple splits??" It always could - on refinances. */}
            {(
              <div className="border-t border-gray-100 pt-4">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">Global loan splits — define the deal structure</div>
                <div className="space-y-2 mb-3">
                  {d.refinanceSplits.map((split, idx) => (
                    <div key={split.id} className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                      <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 24px' }}>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Label</label>
                          <input className={inp} value={split.label} onChange={e => updateRefinanceSplit(idx, 'label', e.target.value)} placeholder="Loan to be refinanced" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Amount</label>
                          <input className={inp} value={split.amount} onChange={e => updateRefinanceSplit(idx, 'amount', e.target.value)} />
                        </div>
                        <div className="flex items-end pb-2">
                          {d.refinanceSplits.length > 1 && (
                            <button onClick={() => removeRefinanceSplit(idx)} className="text-gray-300 hover:text-red-400 text-sm transition">✕</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={addRefinanceSplit} className="text-sm text-[#2DBEFF] border border-dashed border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition">+ Add split</button>
                  <button onClick={addEquityRelease} className="text-sm text-[#2DBEFF] border border-dashed border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition">+ Add equity release</button>
                </div>
              </div>
            )}
          </div>

          {/* Broker personalisation */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Broker personalisation</div>
            <label className="text-xs text-gray-500 block mb-1">Broker signature</label>
            <select className="w-full rounded-lg px-3 py-2 text-sm border border-gray-200 focus:outline-none focus:border-[#2DBEFF] mb-3" value={d.brokerSig} onChange={e => setD({ ...d, brokerSig: e.target.value })}>
              {brokersList.map((b: any, i: number) => (
                <option key={i} value={b.name}>{b.name} — Simplify Finance</option>
              ))}
            </select>
            <textarea spellCheck="true" className={`${d.brokerPersonalisation ? "border-green-200 bg-white" : "border-amber-200 bg-[#FFFBF0]"} w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF] min-h-[80px] resize-y border`} value={d.brokerPersonalisation} onChange={e => setD({ ...d, brokerPersonalisation: e.target.value })} placeholder="✏ Add your personalised opening message..." />
          </div>

          {/* Documents required */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Documents required</div>
            <div className="space-y-2 mb-3">
              {d.documentsRequired.map((doc, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm flex-1">{doc}</span>
                  <button onClick={() => setD({ ...d, documentsRequired: d.documentsRequired.filter((_, idx) => idx !== i) })} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input className={inp} value={newDoc} onChange={e => setNewDoc(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newDoc.trim()) { setD({ ...d, documentsRequired: [...d.documentsRequired, newDoc.trim()] }); setNewDoc('') } }} placeholder="e.g. Latest payslips — add and press Enter" />
              <button onClick={() => { if (newDoc.trim()) { setD({ ...d, documentsRequired: [...d.documentsRequired, newDoc.trim()] }); setNewDoc('') } }} className="bg-[#343333] text-white text-sm px-4 rounded-lg">Add</button>
            </div>
          </div>

          {/* Recommendation warning */}
          {!d.recommendedLender && d.lenders.some(l => l.lenderName) && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <span className="text-amber-500 text-base">⚠</span>
              <div>
                <div className="text-xs font-medium text-amber-800">No recommended option set</div>
                <div className="text-xs text-amber-600">Click "Set as recommended" on your preferred option.</div>
              </div>
            </div>
          )}

          {/* Lender options */}
          {d.lenders.map((lender, i) => {
            const isRec = d.recommendedLender && lender.lenderName === d.recommendedLender
            const isEmpty = !lender.lenderId
            const lenderSplits = resolveLenderSplits(lender, d.refinanceSplits)
            return (
              <div key={i} className={`rounded-xl p-5 border transition-all ${isRec ? 'border-[#2DBEFF] bg-blue-50/30' : isEmpty ? 'border-dashed border-amber-200 bg-amber-50/20' : 'bg-white border-gray-100'}`}>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-widest">Option {i + 1}</div>
                    {isRec && <span className="text-[10px] bg-[#2DBEFF] text-white px-2 py-0.5 rounded-full font-medium">★ Recommended</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isRec && lender.lenderName && (
                      <button onClick={() => setD({ ...d, recommendedLender: lender.lenderName })} className="text-xs text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-2.5 py-1 hover:bg-blue-50 transition">★ Set as recommended</button>
                    )}
                    {d.lenders.length > 1 && <button onClick={() => removeLender(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Field label="Lender">
                    <select className={sel} value={lender.lenderId} onChange={e => selectLenderName(i, e.target.value)}>
                      <option value="">— select lender —</option>
                      {uniqueLenders.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Product">
                    <select className={sel} value={lender.lenderProductId} onChange={e => selectProduct(i, e.target.value)} disabled={!lender.lenderId}>
                      <option value="">— select product —</option>
                      {getProductsForLender(lender.lenderId).map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                    </select>
                  </Field>
                </div>

                {lender.lenderProductId && (
                  <div className="mb-4 p-4 bg-blue-50/20 border border-blue-100 rounded-xl">
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">
                      Fees
                      <span className="ml-2 normal-case text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded font-medium">auto-filled · editable</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <LibraryField label="Application fee" value={lender.applicationFee} onChange={v => updateLender(i, 'applicationFee', v)} />
                      <LibraryField label="Annual fee" value={lender.annualFee} onChange={v => updateLender(i, 'annualFee', v)} />
                      <LibraryField label="Valuation fee" value={lender.valuationFee} onChange={v => updateLender(i, 'valuationFee', v)} />
                      <LibraryField label={rowLegalFeeLabel(lender)} value={lender.legalFee} onChange={v => updateLender(i, 'legalFee', v)} />
                      <LibraryField label="Rate lock fee" value={lender.rateLockFee} onChange={v => updateLender(i, 'rateLockFee', v)} />
                      <LibraryField label="Early repayment fee" value={lender.earlyRepaymentFee} onChange={v => updateLender(i, 'earlyRepaymentFee', v)} />
                      <LibraryField label="Discharge fee" value={lender.dischargeFee} onChange={v => updateLender(i, 'dischargeFee', v)} />
                    </div>
                    <LibraryField label="Offset account" value={lender.offsetAccount} onChange={v => updateLender(i, 'offsetAccount', v)} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Field label="Approval days">
                    <select className={sel} value={lender.approvalDays} onChange={e => updateLender(i, 'approvalDays', e.target.value)}>
                      <option value="">— select —</option>
                      <option>1-2 business days</option><option>3-5 business days</option><option>5-7 business days</option><option>7-10 business days</option><option>10+ business days</option>
                    </select>
                  </Field>
                  <Field label="Special note (optional)">
                    <input className={inp} value={lender.specialNote} onChange={e => updateLender(i, 'specialNote', e.target.value)} placeholder="e.g. Rate increases after 3 months" />
                  </Field>
                </div>

                {/* Refinance: per-lender loan splits with LVR, rate, repayment */}
                {isRefinance && (
                  <div className="border-t border-gray-100 pt-4 mb-4">
                    <div className="flex justify-between items-center mb-3">
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-widest">
                        Loan splits
                        <span className="ml-2 normal-case text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded font-medium">pre-filled · editable per lender</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => syncLenderSplits(i)} className="text-xs text-gray-400 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50 transition">↺ Sync from top</button>
                        <button onClick={() => combineLenderSplits(i)} title="Merge this lender's splits into a single loan"
                          className="text-xs text-gray-400 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50 transition">Combine into one loan</button>
                      </div>
                    </div>
                    {lenderSplits.length === 0 && (
                      <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
                        No splits loaded — click "Sync from top" to pre-fill from the global splits above, or add splits there first.
                      </div>
                    )}
                    <div className="space-y-2">
                      {lenderSplits.map((split, sidx) => (
                        <div key={split.id} className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                          <div className="flex items-center mb-2">
                            <div className="text-xs font-medium text-gray-500">{split.label || `Split ${sidx + 1}`}</div>
                            <button onClick={() => removeLenderSplit(i, sidx)} title="Remove this split from this lender only"
                              className="ml-auto text-gray-300 hover:text-red-400 text-sm transition">✕</button>
                          </div>
                          {/* No LVR box. An LVR is the whole loan over the
                              property value, not a property of one split - three
                              typed boxes were three chances to disagree about a
                              question with one answer. It is calculated below. */}
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Amount</label>
                              <input className={inp} value={split.amount} onChange={e => updateLenderSplit(i, sidx, 'amount', e.target.value)} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Rate % p.a.</label>
                              <input className={inp} value={split.rate} onChange={e => updateLenderSplit(i, sidx, 'rate', e.target.value)} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Repayment</label>
                              <input className={inp} value={split.repayment} onChange={e => updateLenderSplit(i, sidx, 'repayment', e.target.value)} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Type</label>
                              <select className={sel} value={split.repaymentType} onChange={e => updateLenderSplit(i, sidx, 'repaymentType', e.target.value)}>
                                <option>P&I</option>
                                <option>IO</option>
                                <option>Fixed P&I</option>
                                <option>Fixed IO</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* One answer, calculated, so the form and the client's email
                        cannot say different things. */}
                    {lenderSplits.length > 0 && (() => {
                      const tot = lenderTotal(lenderSplits)
                      const lvr = lenderLvr(lenderSplits, d.propertyValue)
                      return (
                        <div className="mt-3 text-[12.5px] bg-[#F2F8FB] border border-[#D9ECF6] rounded-lg px-3 py-2 text-[#2C3E46]">
                          <strong>Total lending ${tot.toLocaleString('en-AU')}</strong>
                          {lvr > 0
                            ? <> &middot; LVR <strong>{lvr}%</strong>
                                <span className="text-[#7B8B93]"> &mdash; against the ${Number(String(d.propertyValue).replace(/[^0-9.]/g, '') || 0).toLocaleString('en-AU')} property value. Calculated, not typed.</span></>
                            : <span className="text-[#8A6218]"> &mdash; no property value on this deal yet, so there is no LVR to show.</span>}
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* Purchase/Bridging: existing rate modules */}
                {!isRefinance && (
                  isBridging ? (
                    <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-widest col-span-2 mb-1">Bridging structure</div>
                      <Field label="Variable rate % p.a."><input className={inp} value={lender.bridgingRate} onChange={e => updateLender(i, 'bridgingRate', e.target.value)} /></Field>
                      <Field label="Loan term (months)"><input className={inp} value={lender.bridgingTerm} onChange={e => updateLender(i, 'bridgingTerm', e.target.value)} /></Field>
                      <Field label="Bridging loan amount"><NumberInput value={lender.bridgingLoanAmount} onChange={v => updateLender(i, 'bridgingLoanAmount', v)} placeholder="e.g. 800,000" /></Field>
                      <Field label="Estimated interest"><input className={inp} value={lender.estimatedInterest} onChange={e => updateLender(i, 'estimatedInterest', e.target.value)} placeholder="e.g. $12,000" /></Field>
                      <Field label="Establishment fee"><NumberInput value={lender.establishmentFee} onChange={v => updateLender(i, 'establishmentFee', v)} /></Field>
                      <Field label="Monthly fee"><NumberInput value={lender.monthlyFee} onChange={v => updateLender(i, 'monthlyFee', v)} /></Field>
                      <Field label="Doc processing fee"><NumberInput value={lender.docProcessingFee} onChange={v => updateLender(i, 'docProcessingFee', v)} /></Field>
                    </div>
                  ) : (
                    <div className="border-t border-gray-100 pt-4 space-y-4">
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Rate modules — tick to include</div>
                      {([
                        { key: 'variablePI', label: 'Variable P&I', showIO: false, showFixed: false },
                        { key: 'variableIO', label: 'Variable IO', showIO: true, showFixed: false },
                        { key: 'fixedPI', label: 'Fixed P&I', showIO: false, showFixed: true },
                        { key: 'fixedIO', label: 'Fixed IO', showIO: true, showFixed: true },
                      ] as const).map(({ key, label, showIO, showFixed }) => (
                        <div key={key} className="border border-gray-100 rounded-lg p-3">
                          <label className="flex items-center gap-2 text-sm font-medium text-[#343333] cursor-pointer mb-2">
                            <input type="checkbox" checked={lender[key].enabled} onChange={e => updateRateModule(i, key, 'enabled', e.target.checked)} />
                            {label}
                          </label>
                          {lender[key].enabled && (
                            <div className="grid grid-cols-3 gap-2 mt-2">
                              <Field label="Rate % p.a."><input className={inp} value={lender[key].rate} onChange={e => updateRateModule(i, key, 'rate', e.target.value)} /></Field>
                              <Field label="Monthly repayment"><NumberInput value={lender[key].repayment} onChange={v => updateRateModule(i, key, 'repayment', v)} /></Field>
                              <Field label="Loan term (years)"><input className={inp} value={lender[key].loanTerm} onChange={e => updateRateModule(i, key, 'loanTerm', e.target.value)} /></Field>
                              {showIO && <Field label="IO period (years)"><select className={sel} value={lender[key].ioYears} onChange={e => updateRateModule(i, key, 'ioYears', e.target.value)}><option value="">— select —</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></Field>}
                              {showFixed && <Field label="Fixed for (years)"><select className={sel} value={lender[key].fixedYears} onChange={e => updateRateModule(i, key, 'fixedYears', e.target.value)}><option value="">— select —</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></Field>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            )
          })}

          {d.lenders.length < 3 && (
            <button onClick={addLender} className="w-full py-3 border border-dashed border-gray-300 rounded-xl text-sm text-gray-400 hover:border-[#2DBEFF] hover:text-[#2DBEFF] transition">
              + Add another lender option
            </button>
          )}

          {/* Recommendation */}
          <div className={`rounded-xl p-5 border-2 transition-all ${d.recommendedLender && d.recommendationNote ? "bg-white border-green-200" : "bg-[#FFF8E6] border-amber-400"}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-widest">Recommendation</div>
              {d.recommendedLender && !d.recommendationNote && (
                <span className="text-xs text-amber-700 bg-amber-100 border border-amber-300 rounded-lg px-2.5 py-1">⚠ Add why this product is in the client&#39;s best interests</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Recommended lender">
                <select className={sel} value={d.recommendedLender} onChange={e => setD({ ...d, recommendedLender: e.target.value })}>
                  <option value="">Select recommended lender</option>
                  {d.lenders.filter(l => l.lenderName).map((l, i) => <option key={i} value={l.lenderName}>{l.lenderName} — {l.productName}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Recommendation paragraph">
              <textarea spellCheck="true" className={inp + ' min-h-[100px] resize-y'} value={d.recommendationNote} onChange={e => setD({ ...d, recommendationNote: e.target.value })} placeholder="Based on your situation, I would recommend proceeding with..." />
              {(() => {
                const mismatchedLender = d.lenders.find(l =>
                  l.lenderName &&
                  l.lenderName !== d.recommendedLender &&
                  d.recommendationNote.toLowerCase().includes(l.lenderName.toLowerCase()) &&
                  !d.recommendationNote.toLowerCase().includes(d.recommendedLender.toLowerCase())
                )
                return mismatchedLender && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
                    Your note mentions {mismatchedLender.lenderName}, but you've selected {d.recommendedLender} as the recommended lender — please confirm this is correct.
                  </div>
                )
              })()}
            </Field>
            <button onClick={generateRecommendation} disabled={generatingRec || !d.recommendedLender} className="mt-2 text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-4 py-2 hover:bg-blue-50 transition disabled:opacity-40">
              {generatingRec ? 'Generating...' : '✦ AI draft recommendation'}
            </button>
            <button onClick={() => { setFlagOpen(v => !v); setFlagNote('') }}
              className="mt-2 ml-2 text-xs text-gray-400 hover:text-amber-500 underline">Flag an issue</button>
            {loStyleNotes.length > 0 && (
              <span className="ml-2 text-[11px] text-gray-400">
                {loStyleNotes.length} style note{loStyleNotes.length === 1 ? '' : 's'} applied
              </span>
            )}
            {flagOpen && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <textarea spellCheck="true" className={inp + ' min-h-[60px] resize-y bg-white'} autoFocus
                  placeholder="What was wrong with this recommendation?"
                  value={flagNote} onChange={e => setFlagNote(e.target.value)} />
                <div className="flex gap-2 mt-2">
                  <button onClick={submitFlag} disabled={flagSubmitting || !flagNote.trim()}
                    className="text-xs bg-amber-500 text-white rounded-lg px-3 py-1.5 hover:bg-amber-600 disabled:opacity-40">
                    {flagSubmitting ? 'Submitting...' : 'Submit flag'}
                  </button>
                  <button onClick={() => { setFlagOpen(false); setFlagNote('') }}
                    className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              </div>
            )}
            {flagMsg && (
              <div className={`mt-2 text-xs ${flagMsg.startsWith('NOT SENT') ? 'text-red-600' : 'text-green-600'}`}>{flagMsg}</div>
            )}
          </div>

          {/* Research criteria */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Research criteria</div>
            <div className="space-y-2 mb-3">
              {CRITERIA_OPTIONS.map(c => (
                <label key={c} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={d.criteriaUsed.includes(c)} onChange={() => toggleCriteria(c)} />
                  {c}
                </label>
              ))}
              {d.criteriaUsed.filter(c => !CRITERIA_OPTIONS.includes(c)).map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="checkbox" checked readOnly />
                  <span className="text-sm flex-1">{c}</span>
                  <button onClick={() => setD({ ...d, criteriaUsed: d.criteriaUsed.filter(x => x !== c) })} className="text-xs text-red-400">Remove</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input className={inp} value={newCriteria} onChange={e => setNewCriteria(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newCriteria.trim()) { setD({ ...d, criteriaUsed: [...d.criteriaUsed, newCriteria.trim()] }); setNewCriteria('') } }} placeholder="Add custom criteria and press Enter" />
              <button onClick={() => { if (newCriteria.trim()) { setD({ ...d, criteriaUsed: [...d.criteriaUsed, newCriteria.trim()] }); setNewCriteria('') } }} className="bg-[#343333] text-white text-sm px-4 rounded-lg">Add</button>
            </div>
          </div>

          {/* Important notes */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Important things to note (included in email, one per line)</div>
            <textarea spellCheck="true" className={inp + ' min-h-40 resize-y'} value={d.importantNotes || ''} onChange={e => setD({ ...d, importantNotes: e.target.value })} placeholder="One note per line..." />
          </div>

          {/* Additional notes */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Additional notes</div>
            <textarea spellCheck="true" className={inp + ' min-h-[80px] resize-y'} value={d.additionalNotes} onChange={e => setD({ ...d, additionalNotes: e.target.value })} placeholder="e.g. Debt recycling wording, rate reduction requested..." />
          </div>

          {/* The internal notes box that used to sit here saved to the LO's own
              internalNotes field. The deal's notes are one field now, in the
              strip above the tabs. */}

          <div className="flex items-center justify-between">
            
            <button onClick={generateEmail} disabled={generating} className="bg-[#2DBEFF] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-400 transition disabled:opacity-50">
              {generating ? 'Generating email...' : 'Generate LO email'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <div>
          {emailHtml && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {creditTeamMsg && <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">{creditTeamMsg}</span>}
                {creditTeamErr && <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{creditTeamErr}</span>}
                {moveToComplianceMsg && <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">{moveToComplianceMsg}</span>}
                {sendError && <span className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{sendError}</span>}
              </div>
              <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  {deal.assigned_credit_officer && (
                    <button onClick={markLOComplete} disabled={markingLoComplete || !!loCompletedAt} className={`px-3 py-1.5 text-sm rounded-lg font-medium disabled:opacity-70 ${loCompletedAt ? 'bg-green-50 text-green-600 border border-green-200' : 'border border-gray-200 hover:bg-gray-50'}`}>
                      {loCompletedAt ? '✓ Sent to broker for review' : markingLoComplete ? 'Marking...' : 'Done — send to broker for review'}
                    </button>
                  )}
{/* "Client agreed" and "Docs received" moved up beside the tabs, so
                    the two actions that move a deal on are not behind the tab
                    you would only open to email. Alan, 2 Sep 2026. */}
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="flex items-center gap-3">
                  {canSendToClient ? (
                    <button onClick={sendEmail} disabled={sending || !emailHtml || emailIsStale}
                      title={emailIsStale ? 'The saved email is for a different scenario. Regenerate it first.' : ''}
                      className="px-4 py-2 text-sm bg-[#2DBEFF] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-40">
                      {sending ? 'Copying...' : sent ? '✓ Copied — paste in Outlook' : 'Send to client'}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Only the broker can send this to the client — use "Done — send to broker for review" above.</span>
                  )}
                  <button disabled={emailIsStale}
                    onClick={() => { copyEmailToClipboard().then(() => setSent(true)).catch(e => setSendError(e?.message || 'Copy failed.')) }}
                    className="text-xs text-gray-400 hover:text-gray-600 underline disabled:opacity-40 disabled:no-underline">Copy without opening Outlook</button>
                </div>
                <div className="w-px h-8 bg-gray-200 ml-auto" />
                <div className="flex items-center gap-4">
                  <BrokerAssignment dealId={deal.id} currentBroker={deal.assigned_broker} userRole={userRole} />
                  <div className="w-px h-6 bg-gray-200" />
                  <CreditOfficerAssignment key={assignmentRefreshKey} dealId={deal.id} brokerName={deal.assigned_broker} userRole={userRole} />
                </div>
              </div>
            </div>
          )}
          {showMoveToCompliancePopup && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 w-[440px] shadow-xl">
                <div className="text-base font-semibold mb-1 text-[#343333]">Send the next-steps email to the client?</div>
                <p className="text-sm text-gray-500 mb-4">This moves the deal to Compliance and emails the client the next-steps content.</p>

                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <label className="text-xs font-medium text-gray-500 block mb-2">Did the client agree with the recommended lender ({d.recommendedLender || 'not yet recommended'})?</label>
                  <div className="flex gap-2">
                    <button onClick={() => setD(prev => ({ ...prev, clientAgreedLender: 'Yes', clientChosenLender: '', clientChosenLenderOther: '', clientChosenLenderReason: '' }))}
                      className={`px-3 py-1.5 text-xs rounded-lg border ${d.clientAgreedLender === 'Yes' ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-500'}`}>Yes</button>
                    <button onClick={() => setD(prev => ({ ...prev, clientAgreedLender: 'No' }))}
                      className={`px-3 py-1.5 text-xs rounded-lg border ${d.clientAgreedLender === 'No' ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-500'}`}>No</button>
                  </div>
                  {d.clientAgreedLender === 'No' && (
                    <div className="mt-3 flex flex-col gap-2">
                      <select className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg" value={d.clientChosenLender} onChange={e => setD(prev => ({ ...prev, clientChosenLender: e.target.value }))}>
                        <option value="">Select lender the client chose</option>
                        {d.lenders.map((l, i) => <option key={i} value={l.lenderName}>{l.lenderName}</option>)}
                        <option value="__other__">Other (not previously considered)</option>
                      </select>
                      {d.clientChosenLender === '__other__' && (
                        <input className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg" placeholder="Lender name" value={d.clientChosenLenderOther} onChange={e => setD(prev => ({ ...prev, clientChosenLenderOther: e.target.value }))} />
                      )}
                      <input className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg" placeholder="Why did they choose differently?" value={d.clientChosenLenderReason} onChange={e => setD(prev => ({ ...prev, clientChosenLenderReason: e.target.value }))} />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowMoveToCompliancePopup(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={handleMoveToCompliance} disabled={sendingMoveToCompliance} className="px-4 py-2 text-sm bg-[#343333] text-white rounded-lg font-medium hover:bg-[#2a2a2a] disabled:opacity-50">
                    {sendingMoveToCompliance ? 'Sending...' : 'Send and move to Compliance'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {freshness.state === 'stale' && (
            <div className="mb-3 border border-[#EBD9BE] bg-[#FDF6E7] rounded-xl px-4 py-3.5 flex items-start gap-3">
              <span className="text-[15px] leading-none mt-[2px]">⚠</span>
              <div className="text-[13px] text-[#8A6218] flex-1">
                <b className="text-[#141C24]">This email was written for {loTemplateLabel(freshness.wasFor)}.</b>
                {' '}The deal is now on <b className="text-[#141C24]">{loTemplateLabel(freshness.nowOn)}</b>, so what is
                below is out of date. Sending and copying are switched off until it is regenerated.
              </div>
              <button onClick={generateEmail} disabled={generating}
                className="flex-none px-3 py-1.5 text-[12.5px] font-semibold rounded-lg bg-[#141C24] text-white disabled:opacity-50">
                {generating ? 'Regenerating…' : 'Regenerate email'}
              </button>
            </div>
          )}
          <div className={`bg-white border border-gray-100 rounded-xl overflow-hidden ${freshness.state === 'stale' ? 'opacity-50' : ''}`}>
            {emailHtml ? (
              <iframe srcDoc={emailHtml} className="w-full h-[800px] border-0" title="LO Email Preview" />
            ) : (
              <div className="p-8 text-center text-sm text-gray-400">Generate the email first to see a preview</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
