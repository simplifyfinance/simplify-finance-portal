'use client'
import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import CreditOfficerAssignment from './CreditOfficerAssignment'
import BrokerAssignment from './BrokerAssignment'

function makeUid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

type RefinanceSplit = {
  id: string
  label: string
  amount: string
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
  rate_lock_fee: string | null
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
  rateLockFee: string
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
  existingLoan: string
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
  refinanceSplits: RefinanceSplit[]
}

const defaultRateModule: RateModule = { enabled: false, rate: '', repayment: '', loanTerm: '30', ioYears: '5', fixedYears: '2' }

const defaultLenderOption = (): LenderOption => ({
  lenderId: '', lenderProductId: '', lenderName: '', productName: '', approvalDays: '',
  applicationFee: '', annualFee: '', valuationFee: '', rateLockFee: '', offsetAccount: '', libraryNotes: '',
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

function formatNumber(val: string): string {
  const digits = val.replace(/[^0-9]/g, '')
  if (!digits) return ''
  return parseInt(digits).toLocaleString('en-AU')
}

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

export default function LOForm({ deal }: { deal: any }) {
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
  const [showMoveToCompliancePopup, setShowMoveToCompliancePopup] = useState(false)
  const [sendingMoveToCompliance, setSendingMoveToCompliance] = useState(false)
  const [moveToComplianceMsg, setMoveToComplianceMsg] = useState('')

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
    const saved = typeof window !== 'undefined' ? localStorage.getItem(saveKey) : null
    if (saved) {
      const parsed = JSON.parse(saved)
      if (!parsed.refinanceSplits) parsed.refinanceSplits = initRefinanceSplits()
      return parsed
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
      loanAmount: bc.splits?.[0]?.amount || '',
      purchasePrice: bc.purchasePrice || '',
      deposit: bc.deposit || '',
      stampDuty: bc.stampDuty || '',
      existingLoan: bc.existingLoanBal || '',
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
      refinanceSplits: initRefinanceSplits()
    }
  }

  const [d, setD] = useState<LOData>(initData)

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
      loanAmount: bc.splits?.[0]?.amount || '',
      purchasePrice: bc.purchasePrice || '',
      deposit: bc.deposit || '',
      stampDuty: bc.stampDuty || '',
      existingLoan: bc.existingLoanBal || '',
      refinanceSplits: initRefinanceSplits(),
    }))
  }, [deal.bc_data])

  function selectTemplate(id: string) {
    setD({ ...d, template: id, importantNotes: (LO_TEMPLATE_NOTES[id] || []).join('\n') })
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
      }
    })
    supabase.from('deals').select('lo_data').eq('id', deal.id).single().then(({ data }) => {
      if (data?.lo_data && Object.keys(data.lo_data).length > 0) {
        const loaded = data.lo_data as LOData
        if (!loaded.importantNotes) loaded.importantNotes = (LO_TEMPLATE_NOTES[loaded.template] || []).join('\n')
        if (!loaded.refinanceSplits) loaded.refinanceSplits = initRefinanceSplits()
        setD(loaded)
        if (loaded.emailHtml) setEmailHtml(loaded.emailHtml)
      }
    })
  }, [])

  useEffect(() => {
    localStorage.setItem(saveKey, JSON.stringify(d))
    supabase.from('deals').update({ lo_data: d }).eq('id', deal.id).then(() => {})
    setSavedAt(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
  }, [d])

  const uniqueLenders = Array.from(new Map(allProducts.map(p => [p.lender_id, { id: p.lender_id, name: p.lender_name }])).values()).sort((a, b) => a.name.localeCompare(b.name))

  function getProductsForLender(lenderId: string) {
    return allProducts.filter(p => p.lender_id === lenderId)
  }

  function selectLenderName(i: number, lenderId: string) {
    const lender = uniqueLenders.find(l => l.id === lenderId)
    const updated = [...d.lenders]
    updated[i] = { ...updated[i], lenderId, lenderName: lender?.name || '', lenderProductId: '', productName: '', applicationFee: '', annualFee: '', valuationFee: '', rateLockFee: '', offsetAccount: '', libraryNotes: '' }
    setD({ ...d, lenders: updated })
  }

  function selectProduct(i: number, productId: string) {
    const product = allProducts.find(p => p.id === productId)
    if (!product) return
    const updated = [...d.lenders]
    updated[i] = { ...updated[i], lenderProductId: productId, productName: product.product_name, applicationFee: product.application_fee || '', annualFee: product.annual_fee || '', valuationFee: product.valuation_fee || '', rateLockFee: product.rate_lock_fee || '', offsetAccount: product.offset_account ? (product.multiple_offsets ? 'Yes — multiple offsets' : 'Yes') : 'No', libraryNotes: product.notes || '' }
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
    const seededSplits: LenderSplit[] = d.refinanceSplits.map(s => ({
      id: s.id, label: s.label, amount: s.amount, lvr: '', rate: '', repayment: '', repaymentType: 'P&I'
    }))
    setD({ ...d, lenders: [...d.lenders, { ...defaultLenderOption(), lenderSplits: seededSplits }] })
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
    const synced: LenderSplit[] = d.refinanceSplits.map(s => ({
      id: s.id, label: s.label, amount: s.amount, lvr: '', rate: '', repayment: '', repaymentType: 'P&I'
    }))
    const updated = [...d.lenders]
    updated[lenderIdx] = { ...updated[lenderIdx], lenderSplits: synced }
    setD({ ...d, lenders: updated })
  }

  function updateLenderSplit(lenderIdx: number, splitIdx: number, field: keyof LenderSplit, value: string) {
    const updated = [...d.lenders]
    const splits = [...(updated[lenderIdx].lenderSplits || [])]
    splits[splitIdx] = { ...splits[splitIdx], [field]: value }
    updated[lenderIdx] = { ...updated[lenderIdx], lenderSplits: splits }
    setD({ ...d, lenders: updated })
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
      const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 300, messages: [{ role: 'user', content: prompt }] }) })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      if (text) setD({ ...d, recommendationNote: text })
    } catch (e) { console.error(e) }
    setGeneratingRec(false)
  }

  function handleLoPurchasePriceChange(val: string) {
    const price = parseFloat(val.replace(/,/g, '')) || 0
    const dep = parseFloat((d.deposit || '0').replace(/,/g, '')) || 0
    if (dep > 0) {
      setD(prev => ({ ...prev, purchasePrice: val, loanAmount: formatNumber(Math.max(0, Math.round(price - dep)).toString()) }))
    } else {
      const loanAmt = parseFloat((d.loanAmount || '0').replace(/,/g, '')) || 0
      if (loanAmt > 0) {
        setD(prev => ({ ...prev, purchasePrice: val, deposit: formatNumber(Math.max(0, Math.round(price - loanAmt)).toString()) }))
      } else {
        setD(prev => ({ ...prev, purchasePrice: val }))
      }
    }
  }

  function handleLoDepositChange(val: string) {
    const price = parseFloat((d.purchasePrice || '0').replace(/,/g, '')) || 0
    const dep = parseFloat(val.replace(/,/g, '')) || 0
    if (price > 0) {
      setD(prev => ({ ...prev, deposit: val, loanAmount: formatNumber(Math.max(0, Math.round(price - dep)).toString()) }))
    } else {
      setD(prev => ({ ...prev, deposit: val }))
    }
  }

  function handleLoLoanAmountChange(val: string) {
    const price = parseFloat((d.purchasePrice || '0').replace(/,/g, '')) || 0
    const loanAmt = parseFloat(val.replace(/,/g, '')) || 0
    if (price > 0) {
      setD(prev => ({ ...prev, loanAmount: val, deposit: formatNumber(Math.max(0, Math.round(price - loanAmt)).toString()) }))
    } else {
      setD(prev => ({ ...prev, loanAmount: val }))
    }
  }

  function getCleanEmailHtml() {
    const fn = (d.firstName || '[Client First Name]').trim()
    const jfn = (d.jointFirstName || '').trim()
    const greetingName = (d.joint === 'Yes' && jfn) ? `${fn} and ${jfn}` : fn
    let clean = `<p style="font-size:14px;color:#333;margin-bottom:14px;line-height:1.6">Hi ${greetingName},</p>`
    if (d.brokerPersonalisation && d.brokerPersonalisation.trim()) {
      clean += `<p style="font-size:14px;color:#333;margin-bottom:14px;line-height:1.6">${d.brokerPersonalisation}</p>`
    }
    return emailHtml.replace(/<div style="background:#FFF8E7[\s\S]*?<\/div>/, clean)
  }

  async function sendEmail() {
    if (!emailHtml) return
    setSending(true); setSendError(''); setSent(false)
    try {
      const cleanHtml = getCleanEmailHtml()
      const blob = new Blob([cleanHtml], { type: 'text/html' })
      const textBlob = new Blob([cleanHtml.replace(/<[^>]+>/g, '')], { type: 'text/plain' })
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': textBlob })])
      const subject = 'Lending Options & Recommendation'
      const to = deal.clients?.email || ''
      window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}`
      setSent(true)
      setTimeout(() => setSent(false), 6000)
    } catch (e: any) { setSendError('Could not copy — try "Copy HTML" instead') }
    setSending(false)
  }

  async function generateEmail() {
    setGenerating(true)
    const res = await fetch('/api/generate-lo-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ broker: deal.assigned_broker, dealId: deal.id, loData: { ...d, importantNotesList: (d.importantNotes || '').split('\n').map((n: string) => n.trim()).filter(Boolean) } })
    })
    const data = await res.json()
    if (data.html) { setEmailHtml(data.html); setD({ ...d, emailHtml: data.html }); setActiveTab('preview') }
    setGenerating(false)
  }

  async function handleMoveToCompliance() {
    setSendingMoveToCompliance(true); setMoveToComplianceMsg('')
    try {
      const res = await fetch('/api/send-next-steps-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealId: deal.id, stage: 'LO' }) })
      const data = await res.json()
      if (!data.ok) { setMoveToComplianceMsg(data.error || 'Failed'); setSendingMoveToCompliance(false); return }
      setClientProceeded(true); setShowMoveToCompliancePopup(false)
      setMoveToComplianceMsg(data.alreadyProceeded ? 'Already moved to Compliance' : data.emailSent ? 'Moved to Compliance — client emailed' : 'Moved to Compliance — no email on file')
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
      <div className="flex gap-2 bg-white border border-gray-100 rounded-xl p-1">
        {(['form', 'preview'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${activeTab === t ? 'bg-[#343333] text-white' : 'text-gray-400 hover:text-gray-600'}`}>
            {t === 'form' ? 'LO Form' : 'Email Preview'}
          </button>
        ))}
      </div>

      {activeTab === 'form' && (
        <div className="space-y-4">

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
                <Field label="Deposit"><NumberInput value={d.deposit} onChange={handleLoDepositChange} /></Field>
                <Field label="Stamp duty"><NumberInput value={d.stampDuty} onChange={v => setD({ ...d, stampDuty: v })} /></Field>
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

            {/* Refinance — global loan splits */}
            {isRefinance && (
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
            <textarea className={`${d.brokerPersonalisation ? "border-green-200 bg-white" : "border-amber-200 bg-[#FFFBF0]"} w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF] min-h-[80px] resize-y border`} value={d.brokerPersonalisation} onChange={e => setD({ ...d, brokerPersonalisation: e.target.value })} placeholder="✏ Add your personalised opening message..." />
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
            const lenderSplits = lender.lenderSplits || []
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
                      <LibraryField label="Rate lock fee" value={lender.rateLockFee} onChange={v => updateLender(i, 'rateLockFee', v)} />
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
                      <button onClick={() => syncLenderSplits(i)} className="text-xs text-gray-400 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50 transition">↺ Sync from top</button>
                    </div>
                    {lenderSplits.length === 0 && (
                      <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
                        No splits loaded — click "Sync from top" to pre-fill from the global splits above, or add splits there first.
                      </div>
                    )}
                    <div className="space-y-2">
                      {lenderSplits.map((split, sidx) => (
                        <div key={split.id} className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                          <div className="text-xs font-medium text-gray-500 mb-2">{split.label || `Split ${sidx + 1}`}</div>
                          <div className="grid grid-cols-5 gap-2">
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Amount</label>
                              <input className={inp} value={split.amount} onChange={e => updateLenderSplit(i, sidx, 'amount', e.target.value)} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">LVR</label>
                              <input className={inp} value={split.lvr} onChange={e => updateLenderSplit(i, sidx, 'lvr', e.target.value)} placeholder="65%" />
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
              <textarea className={inp + ' min-h-[100px] resize-y'} value={d.recommendationNote} onChange={e => setD({ ...d, recommendationNote: e.target.value })} placeholder="Based on your situation, I would recommend proceeding with..." />
            </Field>
            <button onClick={generateRecommendation} disabled={generatingRec || !d.recommendedLender} className="mt-2 text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-4 py-2 hover:bg-blue-50 transition disabled:opacity-40">
              {generatingRec ? 'Generating...' : '✦ AI draft recommendation'}
            </button>
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
            <textarea className={inp + ' min-h-40 resize-y'} value={d.importantNotes || ''} onChange={e => setD({ ...d, importantNotes: e.target.value })} placeholder="One note per line..." />
          </div>

          {/* Additional notes */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Additional notes</div>
            <textarea className={inp + ' min-h-[80px] resize-y'} value={d.additionalNotes} onChange={e => setD({ ...d, additionalNotes: e.target.value })} placeholder="e.g. Debt recycling wording, rate reduction requested..." />
          </div>

          {/* Internal notes */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Internal notes</div>
            <textarea className={inp + ' min-h-[80px] resize-y'} value={d.internalNotes} onChange={e => setD({ ...d, internalNotes: e.target.value })} placeholder="Internal notes — not included in the email" />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{savedAt ? `Autosaved at ${savedAt}` : ''}</span>
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
                  <button onClick={sendToCreditTeam} disabled={sendingToCreditTeam} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                    {sendingToCreditTeam ? 'Allocating...' : 'Allocate to credit team'}
                  </button>
                  <button onClick={markLOComplete} disabled={markingLoComplete || !!loCompletedAt} className={`px-3 py-1.5 text-sm rounded-lg font-medium disabled:opacity-70 ${loCompletedAt ? 'bg-green-50 text-green-600 border border-green-200' : 'border border-gray-200 hover:bg-gray-50'}`}>
                    {loCompletedAt ? '✓ LO completed' : markingLoComplete ? 'Marking...' : 'Mark LO complete'}
                  </button>
                  {!clientProceeded && (
                    <button onClick={() => setShowMoveToCompliancePopup(true)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                      Client agreed — move to Compliance
                    </button>
                  )}
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="flex items-center gap-3">
                  <button onClick={sendEmail} disabled={sending || !emailHtml} className="px-4 py-2 text-sm bg-[#2DBEFF] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-40">
                    {sending ? 'Copying...' : sent ? '✓ Copied — paste in Outlook' : 'Send to client'}
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(getCleanEmailHtml()); alert('HTML copied!') }} className="text-xs text-gray-400 hover:text-gray-600 underline">Copy HTML instead</button>
                </div>
                <div className="w-px h-8 bg-gray-200 ml-auto" />
                <div className="flex items-center gap-4">
                  <BrokerAssignment dealId={deal.id} currentBroker={deal.assigned_broker} />
                  <div className="w-px h-6 bg-gray-200" />
                  <CreditOfficerAssignment key={assignmentRefreshKey} dealId={deal.id} brokerName={deal.assigned_broker} />
                </div>
              </div>
            </div>
          )}
          {showMoveToCompliancePopup && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 w-[440px] shadow-xl">
                <div className="text-base font-semibold mb-1 text-[#343333]">Send the next-steps email to the client?</div>
                <p className="text-sm text-gray-500 mb-5">This moves the deal to Compliance and emails the client the next-steps content.</p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowMoveToCompliancePopup(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={handleMoveToCompliance} disabled={sendingMoveToCompliance} className="px-4 py-2 text-sm bg-[#343333] text-white rounded-lg font-medium hover:bg-[#2a2a2a] disabled:opacity-50">
                    {sendingMoveToCompliance ? 'Sending...' : 'Send and move to Compliance'}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
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
