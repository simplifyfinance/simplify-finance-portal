'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import CreditOfficerAssignment from './CreditOfficerAssignment'
import BrokerAssignment from './BrokerAssignment'

function annualizeAmount(amount: string | undefined, frequency: string | undefined): number {
  const n = Number(amount) || 0
  if (frequency === 'Weekly') return n * 52
  if (frequency === 'Fortnightly') return n * 26
  if (frequency === 'Monthly') return n * 12
  return n
}

function seYearTotal(inc: any, year: 1 | 2): number {
  const p = year === 1 ? 'seYear1' : 'seYear2'
  return (Number(inc[`${p}Salary`]) || 0) + (Number(inc[`${p}NetProfit`]) || 0) +
    (Number(inc[`${p}Depreciation`]) || 0) + (Number(inc[`${p}Interest`]) || 0) +
    (Number(inc[`${p}Super`]) || 0) + (Number(inc[`${p}OneOff`]) || 0) + (Number(inc[`${p}Other`]) || 0)
}

function calculateIncomeEntryAnnual(inc: any, seBasis: string): number {
  if (inc.incomeType === 'PAYG') {
    return annualizeAmount(inc.grossSalary, inc.grossSalaryFrequency) +
      annualizeAmount(inc.bonusAmount, inc.bonusFrequency) +
      annualizeAmount(inc.overtimeEssentialAmount, inc.overtimeEssentialFrequency) +
      annualizeAmount(inc.overtimeNonEssentialAmount, inc.overtimeNonEssentialFrequency) +
      annualizeAmount(inc.commissionAmount, inc.commissionFrequency) +
      annualizeAmount(inc.allowanceAmount, inc.allowanceFrequency)
  }
  if (inc.incomeType === 'Self-employed') {
    if (inc.seAssessmentMethod === "Director's salary") {
      return annualizeAmount(inc.seDirectorSalary, inc.seDirectorSalaryFrequency)
    }
    const year1 = seYearTotal(inc, 1)
    if (inc.seAssessmentMethod === 'One year in isolation') return year1
    const year2 = seYearTotal(inc, 2)
    if (seBasis === 'latest') return year1
    if (seBasis === 'lower') return Math.min(year1, year2)
    return (year1 + year2) / 2
  }
  if (inc.incomeType === 'Other taxable' || inc.incomeType === 'Other non-taxable') {
    return Number(inc.otherIncomeAmount) || 0
  }
  return 0
}

function calculateApplicantTotalIncome(app: any, seBasis: string): number {
  const incomeList: any[] = app?.income || []
  return Math.round(incomeList.reduce((sum, inc) => sum + calculateIncomeEntryAnnual(inc, seBasis), 0))
}

function buildIncomeBreakdown(app: any, applicantLabel: string, seBasis: string): { label: string; amount: number | null }[] {
  const incomeList: any[] = app?.income || []
  return incomeList
    .filter(inc => inc.incomeType === 'PAYG' || inc.incomeType === 'Self-employed' || inc.incomeType === 'Other taxable' || inc.incomeType === 'Other non-taxable')
    .map(inc => {
      if (inc.incomeType === 'Self-employed') {
        return { label: `${applicantLabel} \u2014 Self-employed income`, amount: null }
      }
      const amount = Math.round(calculateIncomeEntryAnnual(inc, seBasis))
      const typeLabel = inc.incomeType === 'PAYG' ? 'PAYG income' : (inc.otherIncomeType || inc.incomeType)
      return { label: `${applicantLabel} \u2014 ${typeLabel}`, amount }
    })
}

const TEMPLATES = [
  { id: 'refinance_equity', label: 'Refinance + equity release' },
  { id: 'refinance_only', label: 'Refinance only' },
  { id: 'oo_purchase', label: 'OO purchase' },
  { id: 'oo_lvr_compare', label: 'OO purchase — LVR comparison' },
  { id: 'investment_purchase', label: 'Investment purchase' },
  { id: 'investment_equity', label: 'Equity release + purchase' },
  { id: 'buy_sell', label: 'Buy / sell' },
  { id: 'fhb', label: 'First home buyer' },
  { id: 'bridging', label: 'Bridging loan' },
  { id: 'family_pledge', label: 'Family pledge' },
  { id: 'smsf', label: 'SMSF purchase' },
  { id: 'construction', label: 'Construction loan' },
  { id: 'custom', label: 'Custom (all fields)' },
]

const TEMPLATE_DEFAULTS: Record<string, any> = {
  refinance_equity: { splits: [{ label: 'Existing loan refinanced', amount: '', rate: '6.14', type: 'P&I' }, { label: 'Equity access', amount: '', rate: '6.14', type: 'P&I' }] },
  refinance_only: { splits: [{ label: 'Refinanced loan', amount: '', rate: '6.14', type: 'P&I' }] },
  oo_purchase: { splits: [{ label: 'Owner-occupied loan', amount: '', rate: '6.14', type: 'P&I' }] },
  oo_lvr_compare: { splits: [{ label: '80% LVR option', amount: '', rate: '6.14', type: 'P&I' }, { label: '90% LVR option', amount: '', rate: '6.39', type: 'P&I' }] },
  investment_purchase: { splits: [{ label: 'Investment loan', amount: '', rate: '6.39', type: 'P&I' }] },
  investment_equity: { splits: [{ label: 'Existing loan refinanced', amount: '', rate: '6.14', type: 'P&I' }, { label: 'Equity access', amount: '', rate: '6.14', type: 'P&I' }, { label: 'New purchase', amount: '', rate: '6.39', type: 'P&I' }] },
  buy_sell: { splits: [{ label: 'New purchase loan', amount: '', rate: '6.14', type: 'P&I' }, { label: 'Bridging facility', amount: '', rate: '7.50', type: 'Interest only' }] },
  fhb: { splits: [{ label: 'Owner-occupied loan', amount: '', rate: '6.14', type: 'P&I' }] },
  bridging: { splits: [{ label: 'Bridging loan', amount: '', rate: '7.50', type: 'Interest only' }, { label: 'End loan', amount: '', rate: '6.14', type: 'P&I' }] },
  family_pledge: { splits: [{ label: 'Main loan', amount: '', rate: '6.14', type: 'P&I' }, { label: 'Guarantee portion', amount: '', rate: '6.14', type: 'P&I' }] },
  smsf: { splits: [{ label: 'SMSF loan', amount: '', rate: '7.20', type: 'P&I' }] },
  construction: { splits: [{ label: 'Land loan', amount: '', rate: '6.14', type: 'P&I' }, { label: 'Construction loan', amount: '', rate: '6.39', type: 'Interest only' }] },
}

type Split = { label: string; amount: string; rate: string; type: string; deposit?: string }

const TEMPLATE_NOTES: Record<string, string[]> = {
  refinance_equity: [],
  refinance_only: [],
  oo_purchase: [],
  oo_lvr_compare: [],
  investment_purchase: ['We have assumed a minimum rental yield of 4% p.a. Please note, rental yield is a key component in determining your borrowing capacity for an investment purchase.'],
  investment_equity: ['We have assumed a minimum rental yield of 4% p.a. Please note, rental yield is a key component in determining your borrowing capacity for an investment purchase.'],
  buy_sell: [
    'This is your estimated borrowing capacity as of today and it can change by the time you are ready to apply.',
    'The figures used for the proposed sale are only estimated amounts. If you were to sell the property for less we would need to re-work your numbers.',
    'You will also need to ascertain if there are any further fees on the finalisation of your sale (e.g. Capital Gains Tax).',
  ],
  fhb: [],
  bridging: [
    'These are only estimates — if the valuation on your current property comes in lower than the expected sale price, we will need to re-work your numbers.',
    'Bridging loan interest is capitalised during the bridging period and will increase the total loan balance.',
  ],
  family_pledge: ['Family guarantee arrangements are subject to lender eligibility criteria and guarantor assessment.'],
  smsf: [
    'We have assumed a minimum rental yield of 4% p.a. Rental yield is a key component in determining your borrowing capacity for an investment purchase.',
    'Confirmation of your rollover amount to your SMSF is required.',
    'Please advise if you did NOT receive financial advice when setting up your SMSF.',
    'Please note, lenders will require you to obtain independent financial and legal advice at your own cost as you will be a guarantor on the application.',
  ],
  construction: ['Construction cost estimates are indicative only and subject to builder contracts and council approvals.'],
  custom: [],
}

const inputCls = "px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2DBEFF] bg-white w-full"
function fieldCls(value: string) {
  return value && value.trim() && value !== '0'
    ? "px-2.5 py-1.5 text-sm border border-green-200 rounded-lg focus:outline-none focus:border-[#2DBEFF] bg-white w-full"
    : "px-2.5 py-1.5 text-sm border border-amber-200 rounded-lg focus:outline-none focus:border-[#2DBEFF] bg-[#FEFBF5] w-full"
}
const selectCls = "px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2DBEFF] bg-white w-full"

function formatNumber(val: string): string {
  const digits = val.replace(/[^0-9]/g, '')
  if (!digits) return ''
  return parseInt(digits).toLocaleString('en-AU')
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500">{label}</label>
      {children}
    </div>
  )
}

function NumberInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const cls = value && value.trim() && value !== '0'
    ? "px-2.5 py-1.5 text-sm border border-green-200 rounded-lg focus:outline-none focus:border-[#2DBEFF] bg-white w-full"
    : "px-2.5 py-1.5 text-sm border border-amber-200 rounded-lg focus:outline-none focus:border-[#2DBEFF] bg-[#FEFBF5] w-full"
  return (
    <input className={cls} placeholder={placeholder} value={value}
      onChange={e => onChange(formatNumber(e.target.value))} />
  )
}

export default function BCForm({ deal }: { deal: any }) {
  const saveKey = `bc-form-${deal.id}`

  const getSaved = () => {
    try { return JSON.parse(localStorage.getItem(saveKey) || '{}') } catch { return {} }
  }

  useEffect(() => {
    async function loadFromSupabase() {
      const { data } = await supabase.from('deals').select('bc_data').eq('id', deal.id).single()
      if (data?.bc_data && Object.keys(data.bc_data).length > 0) {
        localStorage.setItem(saveKey, JSON.stringify(data.bc_data))
      }
    }
    loadFromSupabase()
  }, [deal.id])

  const s = getSaved()
  const ff = deal.fact_find_data || {}
  const ffApp = (ff.applicants || [])[0] || {}
  const ffApp2 = (ff.applicants || [])[1] || {}
  const ffLiabs: any[] = ff.liabilities || []

  const [activeTab, setActiveTab] = useState<'factfind' | 'form' | 'preview'>('form')
  const [template, setTemplate] = useState(s.template || 'oo_purchase')
  const [splits, setSplits] = useState<Split[]>(s.splits || TEMPLATE_DEFAULTS['oo_purchase'].splits)
  const [firstName, setFirstName] = useState(s.firstName || ffApp.firstName || deal.clients?.first_name || '')
  const [lastName, setLastName] = useState(s.lastName || ffApp.lastName || deal.clients?.last_name || '')
  const dependants = ff.dependants || '0'
  const [joint, setJoint] = useState(s.joint || (ff.applicants?.length > 1 ? 'Yes' : 'No'))
  const [seIncomeBasis, setSeIncomeBasis] = useState(s.seIncomeBasis || 'average')
  const [incomeApplicant1, setIncomeApplicant1] = useState(s.incomeApplicant1 || (calculateApplicantTotalIncome(ffApp, s.seIncomeBasis || 'average') || '').toString())
  const [incomeApplicant2, setIncomeApplicant2] = useState(s.incomeApplicant2 || (calculateApplicantTotalIncome(ffApp2, s.seIncomeBasis || 'average') || '').toString())
  const incomeBase = (Number(incomeApplicant1) || 0) + (joint === 'Yes' ? (Number(incomeApplicant2) || 0) : 0)
  const [incomeOther, setIncomeOther] = useState(s.incomeOther || '')
  const [incomeRental, setIncomeRental] = useState(s.incomeRental || '')
  const [ccLimit, setCcLimit] = useState(s.ccLimit || ffLiabs.find((l:any) => l.liabilityType === 'Credit card')?.limitAmount || '')
  const [personalLoan, setPersonalLoan] = useState(s.personalLoan || ffLiabs.find((l:any) => l.liabilityType === 'Personal loan')?.repaymentAmount || '')
  const [carLoan, setCarLoan] = useState(s.carLoan || ffLiabs.find((l:any) => l.liabilityType === 'Car loan')?.repaymentAmount || '')
  const [hecs, setHecs] = useState(s.hecs || ffLiabs.find((l:any) => l.liabilityType === 'HECS')?.repaymentAmount || '')
  const [health, setHealth] = useState(s.health || '')
  const [living, setLiving] = useState(s.living || '')
  const [suburb, setSuburb] = useState(s.suburb || '')
  const [propertyType, setPropertyType] = useState(s.propertyType || 'Owner-occupied')
  const [purchasePrice, setPurchasePrice] = useState(s.purchasePrice || '')
  const [deposit, setDeposit] = useState(s.deposit || '')
  const [depositSource, setDepositSource] = useState(s.depositSource || '')
  const [stampDuty, setStampDuty] = useState(s.stampDuty || '')
  const [existingLoanBal, setExistingLoanBal] = useState(s.existingLoanBal || '')
  const [equityRelease, setEquityRelease] = useState(s.equityRelease || '')
  const [lvr, setLvr] = useState(s.lvr || '80%')
  const [lvrCustom, setLvrCustom] = useState(s.lvrCustom || '')
  const [lmi, setLmi] = useState(s.lmi || '')
  const [loanTerm, setLoanTerm] = useState(s.loanTerm || '30')
  const [fhog, setFhog] = useState(s.fhog || '')
  const [guarantorName, setGuarantorName] = useState(s.guarantorName || '')
  const [bridgingPeriod, setBridgingPeriod] = useState(s.bridgingPeriod || '')
  const [constructionCost, setConstructionCost] = useState(s.constructionCost || '')
  const [landValue, setLandValue] = useState(s.landValue || '')
  const [brokerNotes, setBrokerNotes] = useState(s.brokerNotes || '')
  const [templateNotes, setTemplateNotes] = useState(
    s.templateNotes !== undefined ? s.templateNotes : (TEMPLATE_NOTES[s.template || 'oo_purchase'] || []).join('\n')
  )

  // Auto-calculate LVR from purchase price and deposit
  useEffect(() => {
    const price = parseFloat(String(purchasePrice).replace(/,/g, ''))
    const dep = parseFloat(String(deposit).replace(/,/g, ''))
    if (price > 0 && dep >= 0) {
      const calc = ((price - dep) / price) * 100
      const rounded = Math.round(calc)
      if (rounded <= 80) setLvr('80%')
      else if (rounded <= 90) setLvr('90%')
      else if (rounded <= 95) setLvr('95%')
      else { setLvr('Other'); setLvrCustom(rounded + '%') }
    }
  }, [purchasePrice, deposit])
  const [internalNotes, setInternalNotes] = useState(s.internalNotes || '')
  const [brokerSig, setBrokerSig] = useState(s.brokerSig || deal.assigned_broker || 'Fabio')
  const [checklist, setChecklist] = useState<string[]>(s.checklist || [])
  const [newCheck, setNewCheck] = useState('')
  const [generating, setGenerating] = useState(false)
  const [emailHtml, setEmailHtml] = useState(s.emailHtml || '')
  const [emailError, setEmailError] = useState('')
  const [savedAt, setSavedAt] = useState('')
  const [bcCompletedAt, setBcCompletedAt] = useState<string | null>(deal.bc_completed_at || null)
  const [markingComplete, setMarkingComplete] = useState(false)
  const [sendingToCreditTeam, setSendingToCreditTeam] = useState(false)
  const [creditTeamMsg, setCreditTeamMsg] = useState('')
  const [creditTeamErr, setCreditTeamErr] = useState('')
  const [assignmentRefreshKey, setAssignmentRefreshKey] = useState(0)
  const [saveError, setSaveError] = useState('')
  const [clientProceeded, setClientProceeded] = useState<boolean>(!!deal.client_proceeded)
  const [showMoveToLoPopup, setShowMoveToLoPopup] = useState(false)
  const [sendingMoveToLo, setSendingMoveToLo] = useState(false)
  const [moveToLoMsg, setMoveToLoMsg] = useState('')

  useEffect(() => {
    const data = { template, splits, firstName, lastName, dependants, joint, incomeBase, incomeOther, incomeRental, ccLimit, personalLoan, carLoan, hecs, health, living, suburb, propertyType, purchasePrice, deposit, stampDuty, lvr, lvrCustom, loanTerm, brokerNotes, templateNotes, internalNotes, brokerSig, checklist, emailHtml, existingLoanBal, equityRelease, depositSource, lmi, fhog, guarantorName, bridgingPeriod, constructionCost, landValue }
    localStorage.setItem(saveKey, JSON.stringify(data))
    const timeoutId = setTimeout(() => {
      supabase.from('deals').update({ bc_data: data }).eq('id', deal.id).then(({ error }) => {
        if (error) { console.error('BC autosave failed:', error); setSaveError(error.message) }
        else setSaveError('')
      })
      setSavedAt(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
    }, 700)
    return () => clearTimeout(timeoutId)
  }, [template, splits, firstName, lastName, dependants, joint, incomeBase, incomeOther, incomeRental, ccLimit, personalLoan, carLoan, hecs, health, living, suburb, propertyType, purchasePrice, deposit, stampDuty, lvr, lvrCustom, loanTerm, brokerNotes, templateNotes, internalNotes, brokerSig, checklist, emailHtml, existingLoanBal, equityRelease, depositSource, lmi, fhog, guarantorName, bridgingPeriod, constructionCost, landValue])

  function selectTemplate(id: string) {
    setTemplate(id)
    setSplits(TEMPLATE_DEFAULTS[id].splits.map((s: Split) => ({ ...s })))
    setTemplateNotes((TEMPLATE_NOTES[id] || []).join('\n'))
  }

  function updateSplit(i: number, key: keyof Split, val: string) {
    setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, [key]: val } : s))
  }

  function updateSplitAmount(i: number, val: string) {
    setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, amount: formatNumber(val) } : s))
  }

  function addSplit() {
    setSplits(prev => [...prev, { label: `Split ${prev.length + 1}`, amount: '', rate: '6.14', type: 'P&I' }])
  }

  function removeSplit(i: number) {
    setSplits(prev => prev.filter((_, idx) => idx !== i))
  }

  const effectiveLvr = lvr === 'Other' ? lvrCustom : lvr

  async function markBCComplete() {
    setMarkingComplete(true)
    const nowIso = new Date().toISOString()
    const { error } = await supabase.from('deals').update({ bc_completed_at: nowIso }).eq('id', deal.id)
    if (error) { setMarkingComplete(false); alert('Error marking BC complete: ' + error.message); return }
    setBcCompletedAt(nowIso)
    try {
      await fetch('/api/notify-broker-stage-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, stage: 'BC' })
      })
    } catch (e) {
      // Non-fatal — completion itself succeeded even if the notification failed
    }
    setMarkingComplete(false)
  }

  async function sendToCreditTeam() {
    setSendingToCreditTeam(true)
    setCreditTeamMsg('')
    setCreditTeamErr('')
    try {
      const res = await fetch('/api/allocate-credit-officer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id })
      })
      const data = await res.json()
      if (!data.ok) { setCreditTeamErr(data.error || 'Failed to allocate'); setSendingToCreditTeam(false); return }
      if (data.alreadyAssigned) setCreditTeamMsg('This deal is already assigned to a credit officer.')
      else setCreditTeamMsg(`Assigned to ${data.assignedTo}${data.emailSent ? ' — notified by email' : ''}`)
      setAssignmentRefreshKey(k => k + 1)
    } catch (e: any) {
      setCreditTeamErr(e.message)
    }
    setSendingToCreditTeam(false)
  }

  async function handleMoveToLo() {
    setSendingMoveToLo(true)
    setMoveToLoMsg('')
    try {
      const res = await fetch('/api/send-next-steps-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, stage: 'BC' })
      })
      const data = await res.json()
      if (!data.ok) { setMoveToLoMsg(data.error || 'Failed'); setSendingMoveToLo(false); return }
      setClientProceeded(true)
      setShowMoveToLoPopup(false)
      setMoveToLoMsg(data.alreadyProceeded ? 'Already moved to LO' : data.emailSent ? 'Moved to LO — client emailed' : 'Moved to LO — no email on file for client')
    } catch (e: any) {
      setMoveToLoMsg(e.message)
    }
    setSendingMoveToLo(false)
  }

  const [sendToClientMsg, setSendToClientMsg] = useState('')

  async function sendToClient() {
    try {
      const blob = new Blob([emailHtml], { type: 'text/html' })
      const textBlob = new Blob([emailHtml.replace(/<[^>]+>/g, '')], { type: 'text/plain' })
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': textBlob })])
      const subject = 'Your Borrowing Capacity'
      const to = deal.clients?.email || ''
      const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}`
      window.location.href = mailto
      setSendToClientMsg('Email copied — paste (Cmd+V) into the body in Outlook')
    } catch (e: any) {
      setSendToClientMsg('Could not copy — try "Copy HTML" instead')
    }
    setTimeout(() => setSendToClientMsg(''), 6000)
  }

  async function generateEmail() {
    setGenerating(true)
    setEmailError('')
    const templateLabel = TEMPLATES.find(t => t.id === template)?.label || template
    const splitsText = splits.map(s => `${s.label}: $${s.amount} @ ${s.rate}% p.a. (${s.type})`).join('\n')
    const checklistText = checklist.length
      ? checklist.join(', ')
      : `Income $${incomeBase} p.a., ${dependants} dependants${ccLimit ? `, CC limit $${ccLimit}` : ''}${carLoan ? `, car loan $${carLoan}/mo` : ''}`

    const prompt = `Client: ${firstName} ${lastName}${joint === 'Yes' ? ' & partner' : ''}
Template: ${templateLabel}
Suburb: ${suburb || 'not specified'}
Property type: ${propertyType}
Purchase price: $${purchasePrice}
Deposit: $${deposit}
LVR: ${effectiveLvr}
Loan term: ${loanTerm} years
Loan structure:
${splitsText}
Broker notes: ${brokerNotes || 'None'}
Key assumptions: ${checklistText}`

    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker: brokerSig, dealId: deal.id, formData: { template, splits, firstName, lastName, dependants, joint, incomeBase, incomeBreakdown: [
          ...buildIncomeBreakdown(ffApp, firstName || 'Applicant 1', seIncomeBasis),
          ...(joint === 'Yes' ? buildIncomeBreakdown(ffApp2, ffApp2.firstName || 'Applicant 2', seIncomeBasis) : [])
        ], incomeOther, incomeRental, ccLimit, personalLoan, carLoan, hecs, health, living, suburb, propertyType, purchasePrice, deposit, stampDuty, lvr, lvrCustom, loanTerm, brokerNotes, checklist, additionalNotes: templateNotes.split('\n').map((n: string) => n.trim()).filter(Boolean) } })
      })
      if (!res.ok) { setEmailError(`Server error: ${res.status}`); setGenerating(false); return }
      const data = await res.json()
      if (data.html) { setEmailHtml(data.html); if (data.brokerFirstName) { await supabase.from('deals').update({ broker_first_name: data.brokerFirstName }).eq('id', deal.id) } setActiveTab('preview') }
      else setEmailError('No email returned. Try again.')
    } catch (e: any) {
      setEmailError(`Error: ${e.message}`)
    }
    setGenerating(false)
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 items-center">
        {[['factfind','Fact find'],['form','BC form'],['preview','Preview & share']].map(([id,label]) => (
          <button key={id} onClick={() => setActiveTab(id as any)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${activeTab === id ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-500 bg-white'}`}>
            {label}
          </button>
        ))}
        {savedAt && <span className="text-xs text-gray-400 ml-auto">✓ Autosaved {savedAt}</span>}
        {saveError && <span className="text-xs text-red-500 ml-2">⚠ Save failed: {saveError}</span>}
      </div>

      {activeTab === 'factfind' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-gray-100 rounded-xl p-5 text-center">
            <div className="text-2xl mb-2">📎</div>
            <div className="text-sm font-medium mb-1">Upload fact find PDF</div>
            <div className="text-xs text-gray-400 mb-3">AI will extract client details and pre-fill the BC form</div>
            <button className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Upload & extract</button>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Attached documents</div>
            <div className="text-xs text-gray-400 mb-3">Fact finds, screenshots, rate sheets.</div>
            <button className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">+ Add document</button>
          </div>
        </div>
      )}

      {activeTab === 'form' && (
        <div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">BC template</div>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => selectTemplate(t.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${template === t.id ? 'bg-[#2DBEFF] border-[#2DBEFF] text-white' : 'border-gray-200 text-gray-600 hover:border-[#2DBEFF] hover:text-[#2DBEFF]'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-4">
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Applicant</div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <Field label="First name"><input className={inputCls} value={firstName} onChange={e => setFirstName(e.target.value)} /></Field>
                  <Field label="Last name"><input className={inputCls} value={lastName} onChange={e => setLastName(e.target.value)} /></Field>
                </div>
                <Field label="Joint application"><select className={selectCls} value={joint} onChange={e => setJoint(e.target.value)}><option>No</option><option>Yes</option></select></Field>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Notes</div>
                <div className="flex flex-col gap-2">
                  <Field label="Broker summary notes (included in email)">
                    <textarea className={`${brokerNotes ? "border-green-200 bg-white" : "border-amber-200 bg-[#FFFBF0]"} px-2.5 py-1.5 text-sm rounded-lg focus:outline-none focus:border-[#2DBEFF] w-full min-h-16 resize-y border`} value={brokerNotes} onChange={e => setBrokerNotes(e.target.value)} placeholder="✏ Add your personalised opening message — this goes directly into the client email..." />
                  </Field>
                  <Field label="Important things to note (included in email, one per line — pre-filled per template)">
                    <textarea className={`${inputCls} min-h-40 resize-y`} value={templateNotes} onChange={e => setTemplateNotes(e.target.value)} placeholder="One note per line..." />
                  </Field>
                  <Field label="Internal assessor notes (internal only)">
                    <textarea className={`${inputCls} min-h-16 resize-y`} value={internalNotes} onChange={e => setInternalNotes(e.target.value)} placeholder="Internal notes..." />
                  </Field>
                  <Field label="Broker signature">
                    <select className={selectCls} value={brokerSig} onChange={e => setBrokerSig(e.target.value)}>
                      <option value="Fabio">Fabio — Simplify Finance</option>
                      <option value="Mark">Mark — Simplify Finance</option>
                    </select>
                  </Field>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Scenario details</div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Suburb"><input className={inputCls} value={suburb} onChange={e => setSuburb(e.target.value)} /></Field>
                  <Field label="Property type"><select className={selectCls} value={propertyType} onChange={e => setPropertyType(e.target.value)}><option>Owner-occupied</option><option>Investment</option></select></Field>
                  {!["refinance_equity", "refinance_only"].includes(template) && <Field label="Purchase price"><NumberInput value={purchasePrice} onChange={setPurchasePrice} /></Field>}
                  {!["refinance_equity", "refinance_only", "oo_lvr_compare", "investment_equity", "family_pledge"].includes(template) && <Field label="Deposit"><NumberInput value={deposit} onChange={setDeposit} /></Field>}
              {!["refinance_equity", "refinance_only", "oo_lvr_compare", "investment_equity", "family_pledge"].includes(template) && (
                <Field label="Deposit source">
                  <select className={selectCls} value={depositSource} onChange={e => setDepositSource(e.target.value)}>
                    <option value="">Select source</option>
                    <option value="Savings">Savings</option>
                    <option value="Equity">Equity</option>
                    <option value="Gift">Gift</option>
                    <option value="Combination">Combination of savings &amp; equity</option>
                  </select>
                </Field>
              )}
                  {!["refinance_equity", "refinance_only"].includes(template) && <Field label="Stamp duty"><NumberInput value={stampDuty} onChange={setStampDuty} /></Field>}
              {["refinance_equity", "refinance_only", "investment_equity", "buy_sell", "bridging"].includes(template) && <Field label="Existing loan balance"><NumberInput value={existingLoanBal} onChange={setExistingLoanBal} /></Field>}
              {["refinance_equity", "investment_equity"].includes(template) && <Field label="Equity release amount"><NumberInput value={equityRelease} onChange={setEquityRelease} /></Field>}

                  {!["refinance_equity", "refinance_only"].includes(template) && <Field label="LVR">
                 <select className={selectCls} value={lvr} onChange={e => setLvr(e.target.value)}>
                      <option>80%</option>
                      <option>90%</option>
                      <option>95%</option>
                      <option>Other</option>
                    </select>
                  </Field>}
                  {!["refinance_equity", "refinance_only"].includes(template) && lvr === 'Other' && (
                <Field label="Custom LVR">
                      <input className={inputCls} placeholder="e.g. 85%" value={lvrCustom} onChange={e => setLvrCustom(e.target.value)} />
                    </Field>
                  )}
                  <Field label="Loan term (years)"><input className={inputCls} value={loanTerm} onChange={e => setLoanTerm(e.target.value)} /></Field>
              {template === 'fhb' && <Field label="First home owner grant"><NumberInput value={fhog} onChange={setFhog} /></Field>}
              {template === 'family_pledge' && <Field label="Guarantor name"><input className={inputCls} value={guarantorName} onChange={e => setGuarantorName(e.target.value)} placeholder="e.g. John Smith" /></Field>}
              {template === 'bridging' && <Field label="Bridging period (months)"><input className={inputCls} value={bridgingPeriod} onChange={e => setBridgingPeriod(e.target.value)} placeholder="e.g. 6" /></Field>}
              {template === 'construction' && <Field label="Land value"><NumberInput value={landValue} onChange={setLandValue} /></Field>}
              {template === 'construction' && <Field label="Construction cost"><NumberInput value={constructionCost} onChange={setConstructionCost} /></Field>}
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">{template === "oo_lvr_compare" ? "Loan Options — Multiple Deposits" : "Loan splits"}</div>
                <div className="flex flex-col gap-3">
                  {splits.map((s, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-[#2DBEFF]">{template === "oo_lvr_compare" ? `Option ${i + 1}` : `Split ${i + 1}`}</span>
                        {splits.length > 1 && <button onClick={() => removeSplit(i)} className="text-xs text-gray-400 hover:text-red-500">Remove</button>}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Label"><input className={inputCls} value={s.label} onChange={e => updateSplit(i, 'label', e.target.value)} /></Field>
                        <Field label="Amount"><input className={inputCls} value={s.amount} onChange={e => updateSplitAmount(i, e.target.value)} /></Field>
                        {template === "oo_lvr_compare" && <Field label="Deposit required"><NumberInput value={s.deposit || ""} onChange={v => updateSplit(i, 'deposit', v)} /></Field>}<Field label="Rate"><input className={inputCls} value={s.rate} onChange={e => updateSplit(i, 'rate', e.target.value)} /></Field>
                        <Field label="Type"><select className={selectCls} value={s.type} onChange={e => updateSplit(i, 'type', e.target.value)}><option>P&I</option><option>Interest only</option></select></Field>
                      </div>
                    </div>
                  ))}
                  <button onClick={addSplit} className="text-xs text-[#2DBEFF] hover:underline text-left">+ Add split</button>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">"Based on your numbers" checklist</div>
                <div className="flex flex-col gap-2 mb-2">
                  {checklist.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-green-500">✅</span>
                      <span className="flex-1">{item}</span>
                      <button onClick={() => setChecklist(c => c.filter((_,idx) => idx !== i))} className="text-xs text-gray-300 hover:text-red-400">✕</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className={`${inputCls} flex-1`} placeholder="Add item..." value={newCheck} onChange={e => setNewCheck(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newCheck) { setChecklist(c => [...c, newCheck]); setNewCheck('') }}} />
                  <button onClick={() => { if (newCheck) { setChecklist(c => [...c, newCheck]); setNewCheck('') }}}
                    className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">Add</button>
                </div>
              </div>

              {emailError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{emailError}</div>
              )}

              <div className="flex justify-end gap-2">
                <button onClick={generateEmail} disabled={generating}
                  className="px-4 py-2 text-sm bg-[#2DBEFF] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
                  {generating ? 'Generating...' : '✨ Generate email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <div>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {creditTeamMsg && <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">{creditTeamMsg}</span>}
              {creditTeamErr && <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{creditTeamErr}</span>}
              {moveToLoMsg && <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">{moveToLoMsg}</span>}
              {sendToClientMsg && <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">{sendToClientMsg}</span>}
            </div>
            <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <button onClick={sendToCreditTeam} disabled={sendingToCreditTeam}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  {sendingToCreditTeam ? 'Allocating...' : 'Allocate to credit team'}
                </button>
                <button onClick={markBCComplete} disabled={markingComplete || !!bcCompletedAt}
                  title="This notifies the broker that BC is ready for their final review and personalisation"
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium disabled:opacity-70 ${bcCompletedAt ? 'bg-green-50 text-green-600 border border-green-200' : 'border border-gray-200 hover:bg-gray-50'}`}>
                  {bcCompletedAt ? '✓ BC completed' : markingComplete ? 'Marking...' : 'Mark BC complete'}
                </button>
                {!clientProceeded && (
                  <button onClick={() => setShowMoveToLoPopup(true)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                    Client agreed — move to LO
                  </button>
                )}
              </div>

              <div className="w-px h-8 bg-gray-200" />

              <div className="flex items-center gap-3">
                <button onClick={sendToClient}
                  className="px-4 py-2 text-sm bg-[#2DBEFF] text-white rounded-lg font-medium hover:opacity-90">Send to client</button>
                <button onClick={() => { navigator.clipboard.writeText(emailHtml); alert('HTML copied!') }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline">Copy HTML instead</button>
              </div>

              <div className="w-px h-8 bg-gray-200 ml-auto" />

              <div className="flex items-center gap-4">
                <BrokerAssignment dealId={deal.id} currentBroker={deal.assigned_broker} />
                <div className="w-px h-6 bg-gray-200" />
                <CreditOfficerAssignment key={assignmentRefreshKey} dealId={deal.id} brokerName={deal.assigned_broker} />
              </div>
            </div>
          </div>
          {showMoveToLoPopup && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 w-[440px] shadow-xl">
                <div className="text-base font-semibold mb-1 text-[#343333]">Send the next-steps email to the client?</div>
                <p className="text-sm text-gray-500 mb-5">This moves the deal to LO and emails the client the same next-steps content (including the bank statement link, if entered) they'd see if they'd clicked "ready to proceed" themselves. Only use this if they agreed over a call rather than through the email.</p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowMoveToLoPopup(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={handleMoveToLo} disabled={sendingMoveToLo}
                    className="px-4 py-2 text-sm bg-[#343333] text-white rounded-lg font-medium hover:bg-[#2a2a2a] disabled:opacity-50">
                    {sendingMoveToLo ? 'Sending...' : 'Send and move to LO'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {emailHtml ? (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between">
                <span className="text-xs text-gray-500">Email preview — {deal.deal_name}</span>
                <span className="text-xs text-[#2DBEFF]">AI generated</span>
              </div>
              <div dangerouslySetInnerHTML={{ __html: emailHtml }} />
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
              <div className="text-2xl mb-2">✉️</div>
              <div className="text-sm font-medium text-gray-500 mb-1">No email generated yet</div>
              <div className="text-xs text-gray-400 mb-4">Fill in the BC form and click "Generate email"</div>
              <button onClick={() => setActiveTab('form')} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Go to BC form</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
