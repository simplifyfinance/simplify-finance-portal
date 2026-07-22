'use client'
import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

type Applicant = { name: string; type: 'applicant' | 'guarantor' | 'company' | 'smsf' }

type RiskData = {
  adverseChanges: string
  beneficialChanges: string
  retirementAge: string
  repaymentMethod: string
  financialExperience: string
  interestRateConcern: string
  loanFlexibility: string
  jobSecurity: string
  propertyValueConcern: string
  emergencyFund: string
  maintainLifestyle: string
  adequateInsurance: string
  hasWill: string
  circumstancesImpact: string
  problemsMeetingCommitments: string
  officerInLiquidation: string
  unsatisfiedJudgements: string
  simultaneousApplications: string
  declaredBankrupt: string
}

type ProductReqs = {
  fixedRate: string
  variableRate: string
  fixedAndVariable: string
  principalAndInterest: string
  interestOnly: string
  interestInAdvance: string
  lineOfCredit: string
  offsetAccount: string
  redraw: string
  otherRequirements: string
  lowestCost: string
  approvedQuickly: string
  specificFeatures: string
  lenderPolicy: string
  branchFrequency: string
}

type ComplianceData = {
  entityType: string
  applicants: Applicant[]
  needsPrimary: string
  needsImmediate: string
  needsLongTerm: string
  requirementsType: string
  risks: Record<string, RiskData>
  productReqs: ProductReqs
  analysisComment: string
  optionsComment: string
  borrowingPowerComment: string
  depositComment: string
  creditHistoryComment: string
  securityComment: string
  applicationSubmissionComment: string
  expenses: Record<string, ExpenseEntry>
  aiMeta: Record<string, { confidence: string; source: string }>
}

const defaultRisk = (): RiskData => ({
  adverseChanges: 'No', beneficialChanges: 'No', retirementAge: '', repaymentMethod: '',
  financialExperience: 'Medium', interestRateConcern: 'Medium', loanFlexibility: 'Medium',
  jobSecurity: 'Medium', propertyValueConcern: 'Medium',
  emergencyFund: 'Yes', maintainLifestyle: 'Yes', adequateInsurance: 'Yes', hasWill: 'Yes', circumstancesImpact: 'No',
  problemsMeetingCommitments: 'No', officerInLiquidation: 'No', unsatisfiedJudgements: 'No',
  simultaneousApplications: 'No', declaredBankrupt: 'No'
})

const defaultProductReqs = (): ProductReqs => ({
  fixedRate: '', variableRate: '', fixedAndVariable: 'Important',
  principalAndInterest: '', interestOnly: '', interestInAdvance: 'Do not want', lineOfCredit: 'Do not want',
  offsetAccount: '', redraw: '', otherRequirements: '',
  lowestCost: 'Somewhat important', approvedQuickly: 'Somewhat important',
  specificFeatures: 'Somewhat important', lenderPolicy: 'Somewhat important',
  branchFrequency: 'Rarely'
})

const EXPENSE_CATEGORIES: { key: string; label: string; inHem: boolean }[] = [
  { key: 'groceries', label: 'Groceries', inHem: true },
  { key: 'clothingPersonalCare', label: 'Clothing and personal care', inHem: true },
  { key: 'petCare', label: 'Pet care', inHem: true },
  { key: 'phoneInternetSubscriptions', label: 'Phone, internet and subscriptions', inHem: true },
  { key: 'other', label: 'Other', inHem: true },
  { key: 'privateSchoolingTuition', label: 'Private schooling and tuition', inHem: false },
  { key: 'childcare', label: 'Childcare', inHem: true },
  { key: 'publicEducation', label: 'Public education', inHem: true },
  { key: 'higherEducationTraining', label: 'Higher education and training', inHem: true },
  { key: 'recreationEntertainment', label: 'Recreation and entertainment', inHem: true },
  { key: 'sicknessAccidentLifeInsurance', label: 'Sickness, accident and life insurance', inHem: false },
  { key: 'medicalHealth', label: 'Medical and health', inHem: true },
  { key: 'healthInsurance', label: 'Health insurance', inHem: true },
  { key: 'generalBasicInsurances', label: 'General basic insurances', inHem: true },
  { key: 'transport', label: 'Transport', inHem: true },
  { key: 'secondaryResidenceRunningCosts', label: 'Secondary residence running costs', inHem: false },
  { key: 'primaryResidenceRunningCosts', label: 'Primary residence running costs', inHem: true },
  { key: 'investmentPropertyRunningCosts', label: 'Investment property running costs', inHem: true },
  { key: 'primaryResidenceBodyCorp', label: 'Primary residence body corp', inHem: true },
  { key: 'childSpousalMaintenance', label: 'Child and spousal maintenance', inHem: false },
  { key: 'rent', label: 'Rent', inHem: true },
  { key: 'board', label: 'Board', inHem: true },
]

type ExpenseEntry = {
  monthlyAmount: string
  splits: Record<string, string>
  comment: string
}

function defaultExpenseSplit(applicants: Applicant[]): Record<string, string> {
  const n = applicants.length
  if (n === 0) return {}
  const pct = n === 1 ? '100' : (100 / n).toFixed(2).replace(/\.00$/, '')
  const result: Record<string, string> = {}
  applicants.forEach(a => { result[a.name] = pct })
  return result
}

function defaultExpenses(applicants: Applicant[], rentMonthlyAmount?: string): Record<string, ExpenseEntry> {
  const result: Record<string, ExpenseEntry> = {}
  EXPENSE_CATEGORIES.forEach(c => {
    const prefill = c.key === 'rent' && rentMonthlyAmount ? rentMonthlyAmount : ''
    result[c.key] = { monthlyAmount: prefill, splits: defaultExpenseSplit(applicants), comment: '' }
  })
  return result
}

function Toggle({ value, onChange, options, colors }: { value: string; onChange: (v: string) => void; options: string[]; colors?: string[] }) {
  return (
    <div className="flex gap-1">
      {options.map((opt, i) => {
        const isActive = value === opt
        const color = colors?.[i] || 'default'
        let cls = 'px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer '
        if (isActive) {
          if (color === 'green') cls += 'bg-green-50 text-green-700 border-green-300'
          else if (color === 'red') cls += 'bg-red-50 text-red-600 border-red-300'
          else if (color === 'amber') cls += 'bg-amber-50 text-amber-700 border-amber-300'
          else if (color === 'blue') cls += 'bg-blue-50 text-[#2DBEFF] border-blue-300'
          else cls += 'bg-[#343333] text-white border-[#343333]'
        } else {
          cls += 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
        }
        return <button key={opt} onClick={() => onChange(opt)} className={cls}>{opt}</button>
      })}
    </div>
  )
}

function ToggleRow({ label, value, onChange, options, colors, required }: { label: string; value: string; onChange: (v: string) => void; options: string[]; colors?: string[]; required?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-700 flex-1 pr-4">{label}{required && !value && <span className="text-red-400 ml-1">*</span>}</span>
      <Toggle value={value} onChange={onChange} options={options} colors={colors} />
    </div>
  )
}

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">{title}</span>
      {badge && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded font-medium">{badge}</span>}
    </div>
  )
}

function AIButton({ onClick, loading, label = 'Generate with AI' }: { onClick: () => void; loading?: boolean; label?: string }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="mt-2 text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition disabled:opacity-40 flex items-center gap-1.5">
      <span>✦</span> {loading ? 'Generating...' : label}
    </button>
  )
}

export default function ComplianceForm({ deal }: { deal: any }) {
  const supabase = createSupabaseBrowser()
  const saveKey = `compliance_${deal.id}`
  const bc = deal.bc_data || {}
  const lo = deal.lo_data || {}

  const getApplicants = (): Applicant[] => {
    const apps: Applicant[] = []
    const first = bc.firstName || deal.clients?.first_name || ''
    const last = bc.lastName || deal.clients?.last_name || ''
    if (first || last) apps.push({ name: `${first} ${last}`.trim(), type: 'applicant' })
    if (bc.joint === 'Yes' && bc.jointFirstName) apps.push({ name: `${bc.jointFirstName} ${bc.jointLastName || ''}`.trim(), type: 'applicant' })
    return apps.length > 0 ? apps : [{ name: 'Applicant 1', type: 'applicant' }]
  }

  const initData = (): ComplianceData => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(saveKey) : null
    if (saved) return JSON.parse(saved)
    const apps = getApplicants()
    const risks: Record<string, RiskData> = {}
    apps.forEach(a => { risks[a.name] = defaultRisk() })

    const loLenders = lo.lenders || []
    const hasVariable = loLenders.some((l: any) => l.variablePI?.enabled || l.variableIO?.enabled)
    const hasFixed = loLenders.some((l: any) => l.fixedPI?.enabled || l.fixedIO?.enabled)
    const hasOffset = loLenders.some((l: any) => l.offsetAccount && l.offsetAccount !== 'No')
    const approvalMentioned = (lo.additionalNotes || '').toLowerCase().includes('turnaround') || (lo.additionalNotes || '').toLowerCase().includes('approval')

    const pReqs = defaultProductReqs()
    if (hasVariable) pReqs.variableRate = 'Important'
    if (hasFixed) pReqs.fixedRate = 'Important'
    if (!hasFixed && hasVariable) pReqs.fixedRate = 'Not important'
    if (hasOffset) pReqs.offsetAccount = 'Important'
    pReqs.redraw = 'Important'
    pReqs.principalAndInterest = loLenders.some((l: any) => l.variablePI?.enabled || l.fixedPI?.enabled) ? 'Important' : 'Not important'
    pReqs.interestOnly = loLenders.some((l: any) => l.variableIO?.enabled || l.fixedIO?.enabled) ? 'Important' : 'Not important'
    if (approvalMentioned) pReqs.approvedQuickly = 'Most important'

    const ff = deal.fact_find_data || {}
    const ffApp = (ff.applicants || [])[0] || {}
    const currentAddress = (ffApp.addresses || []).find((a: any) => a.isCurrent)
    let rentMonthlyAmount = ''
    if (currentAddress && (currentAddress.residentialStatus === 'Renting' || currentAddress.residentialStatus === 'Boarding') && currentAddress.housingExpenseAmount) {
      const amount = Number(currentAddress.housingExpenseAmount) || 0
      rentMonthlyAmount = currentAddress.housingExpenseFrequency === 'Weekly'
        ? Math.round(amount * 52 / 12).toString()
        : amount.toString()
    }

    return {
      entityType: 'Individual(s)',
      applicants: apps,
      needsPrimary: '', needsImmediate: '', needsLongTerm: '',
      requirementsType: bc.template?.includes('investment') ? 'Investment' : 'Owner occupied',
      risks,
      productReqs: pReqs,
      analysisComment: '', optionsComment: '', borrowingPowerComment: '',
      depositComment: '', creditHistoryComment: '', securityComment: '',
      applicationSubmissionComment: '',
      expenses: defaultExpenses(apps, rentMonthlyAmount),
      aiMeta: {}
    }
  }

  const [d, setD] = useState<ComplianceData>(initData)

  useEffect(() => {
    const freshApps = getApplicants()
    const freshRequirementsType = bc.template?.includes('investment') ? 'Investment' : 'Owner occupied'
    setD(prev => {
      const newRisks = { ...prev.risks }
      freshApps.forEach(a => { if (!newRisks[a.name]) newRisks[a.name] = defaultRisk() })
      return { ...prev, applicants: freshApps, requirementsType: freshRequirementsType, risks: newRisks }
    })
  }, [deal.bc_data])
  const [activeApplicant, setActiveApplicant] = useState(0)
  const [generating, setGenerating] = useState<Record<string, boolean>>({})
  const [savedAt, setSavedAt] = useState('')
  const [showValidation, setShowValidation] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [stage, setStage] = useState<'needs' | 'risks' | 'product' | 'comments' | 'expenses'>('needs')
  const [complianceCompletedAt, setComplianceCompletedAt] = useState<string | null>(deal.compliance_completed_at || null)

  useEffect(() => {
    supabase.from('deals').select('compliance_data').eq('id', deal.id).single().then(({ data }) => {
      if (data?.compliance_data && Object.keys(data.compliance_data).length > 0) {
        const loaded = data.compliance_data as ComplianceData
        if (!loaded.expenses) loaded.expenses = defaultExpenses(loaded.applicants || [])
        setD(loaded)
      }
    })
  }, [])

  useEffect(() => {
    localStorage.setItem(saveKey, JSON.stringify(d))
    supabase.from('deals').update({ compliance_data: d }).eq('id', deal.id).then(() => {})
    setSavedAt(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
  }, [d])

  function updateRisk(applicant: string, field: keyof RiskData, value: string) {
    setD(prev => ({ ...prev, risks: { ...prev.risks, [applicant]: { ...prev.risks[applicant], [field]: value } } }))
  }

  function updateProductReqs(field: keyof ProductReqs, value: string) {
    setD(prev => ({ ...prev, productReqs: { ...prev.productReqs, [field]: value } }))
  }

  function updateExpense(key: string, field: 'monthlyAmount' | 'comment', value: string) {
    setD(prev => ({ ...prev, expenses: { ...prev.expenses, [key]: { ...prev.expenses[key], [field]: value } } }))
  }

  function updateExpenseSplit(key: string, applicantName: string, value: string) {
    setD(prev => ({
      ...prev,
      expenses: {
        ...prev.expenses,
        [key]: { ...prev.expenses[key], splits: { ...prev.expenses[key].splits, [applicantName]: value } }
      }
    }))
  }

  function validateBeforePush(): string[] {
    const errors: string[] = []
    if (!d.needsPrimary) errors.push('Needs & objectives — Primary reasons not filled')
    if (!d.needsImmediate) errors.push('Needs & objectives — Immediate needs not filled')
    if (!d.needsLongTerm) errors.push('Needs & objectives — Long term needs not filled')
    d.applicants.forEach(a => {
      const r = d.risks[a.name]
      if (!r) return
      if (!r.adverseChanges) errors.push(`${a.name} — Adverse changes not answered`)
      if (!r.beneficialChanges) errors.push(`${a.name} — Beneficial changes not answered`)
      if (!r.retirementAge) errors.push(`${a.name} — Retirement age not filled`)
      if (!r.problemsMeetingCommitments) errors.push(`${a.name} — Credit history: problems meeting commitments not answered`)
      if (!r.officerInLiquidation) errors.push(`${a.name} — Credit history: officer in liquidation not answered`)
      if (!r.unsatisfiedJudgements) errors.push(`${a.name} — Credit history: unsatisfied judgements not answered`)
      if (!r.simultaneousApplications) errors.push(`${a.name} — Credit history: simultaneous applications not answered`)
      if (!r.declaredBankrupt) errors.push(`${a.name} — Credit history: declared bankrupt not answered`)
    })
    if (!d.analysisComment) errors.push('Broker comments — Analysis & assessment not filled')
    if (!d.optionsComment) errors.push('Broker comments — Options & recommendation not filled')
    if (!d.borrowingPowerComment) errors.push('Broker comments — Borrowing power not filled')
    if (!d.depositComment) errors.push('Broker comments — Deposit/equity not filled')
    if (!d.creditHistoryComment) errors.push('Broker comments — Credit history not filled')
    if (!d.securityComment) errors.push('Broker comments — Security not filled')
    return errors
  }

  async function generateField(field: string) {
    setGenerating(prev => ({ ...prev, [field]: true }))
    const context = {
      clientName: d.applicants.map(a => a.name).join(' and '),
      loanAmount: lo.loanAmount || bc.splits?.[0]?.amount || '',
      purchasePrice: bc.purchasePrice || '',
      deposit: bc.deposit || '',
      loanType: bc.template || '',
      incomeBase: bc.incomeBase || '',
      incomeOther: bc.incomeOther || '',
      incomeRental: bc.incomeRental || '',
      lender: lo.lenders?.[0]?.lenderName || '',
      product: lo.lenders?.[0]?.productName || '',
      rate: lo.lenders?.[0]?.variablePI?.rate || lo.lenders?.[0]?.fixedPI?.rate || '',
      recommendedLender: lo.recommendedLender || '',
      recommendationNote: lo.recommendationNote || '',
      allLenders: (lo.lenders || []).map((l: any) => `${l.lenderName} ${l.productName}`).join(', '),
      applicationFee: lo.lenders?.[0]?.applicationFee || '',
      annualFee: lo.lenders?.[0]?.annualFee || '',
      offsetAccount: lo.lenders?.[0]?.offsetAccount || '',
      needsPrimary: d.needsPrimary,
      needsImmediate: d.needsImmediate,
      needsLongTerm: d.needsLongTerm,
      risks: JSON.stringify(d.risks),
      productReqs: JSON.stringify(d.productReqs),
      criteriaUsed: (lo.criteriaUsed || []).join(', '),
      additionalNotes: lo.additionalNotes || '',
      existingLoan: bc.existingLoanBal || '',
      dependants: bc.dependants || '0',
      ccLimit: bc.ccLimit || '',
      suburb: bc.suburb || '',
      propertyType: bc.propertyType || '',
      loanPurpose: (deal.fact_find_data || {}).loanPurpose || '',
      goals2Years: (deal.fact_find_data || {}).goals2Years || '',
      goals10Years: (deal.fact_find_data || {}).goals10Years || '',
    }

    const prompts: Record<string, string> = {
      needsPrimary: `You are a compliance officer for an Australian mortgage brokerage. Write the "Primary reasons for seeking credit / needs and objectives" field for SalesTrekker CRM. Client: ${context.clientName}. Loan: $${context.loanAmount} for ${context.loanType}. Property: ${context.suburb}. Income: $${context.incomeBase} base. Recommended lender: ${context.recommendedLender}. Client's own stated purpose for this loan: "${context.loanPurpose || 'not recorded — use loan type and property details only, do not invent a personal reason'}". Base the purpose section on what the client actually told the broker above rather than inventing circumstances. Also cover: loan amount and term, specific features requested, savings position. Write 4-6 professional sentences. No dot points. Australian mortgage broker tone. Must comply with SFG Best Interests Duty Policy.`,
      needsImmediate: `You are a compliance officer for an Australian mortgage brokerage. Write the "Immediate needs and objectives — within next 2 years" field. Client: ${context.clientName}. Loan type: ${context.loanType}. Client's own stated 2-year goals: "${context.goals2Years || 'not recorded — write a brief neutral statement that no specific short-term goals were disclosed, do not invent any'}". Base this field strictly on what the client actually told the broker. Write 3-4 professional sentences. No dot points.`,
      needsLongTerm: `You are a compliance officer for an Australian mortgage brokerage. Write the "Longer term needs and objectives — 2 to 10 years" field. Client: ${context.clientName}. Dependants: ${context.dependants}. Client's own stated 2-10 year goals: "${context.goals10Years || 'not recorded — write a brief neutral statement that no specific long-term goals were disclosed, do not invent any'}". Base this field strictly on what the client actually told the broker. Write 3-4 professional sentences. No dot points.`,
      analysisComment: `You are a compliance officer for an Australian mortgage brokerage writing a credit note for SalesTrekker. Write the "Analysis, assessment and applicant education" broker comment. Client: ${context.clientName}. Loan: $${context.loanAmount}. Income: $${context.incomeBase}. Dependants: ${context.dependants}. Lender: ${context.recommendedLender}. Product: ${context.product}. Rate: ${context.rate}%. Cover ALL of these: purpose of loan, client situation overview, ages/exit strategy, employment type and stability, assets and liabilities, financial habits, financial awareness, client wants vs needs, goals and priorities, specific requirements, lender policy/serviceability, security assessment, applicant education. Must reference Best Interests Duty and NCCP obligations. Write in professional paragraphs with bold subheadings. Minimum 500 words.`,
      optionsComment: `You are a compliance officer for an Australian mortgage brokerage. Write the "Options presented and recommendation" broker comment. All lenders considered: ${context.allLenders}. Recommended: ${context.recommendedLender} — ${context.product}. Rate: ${context.rate}%. Application fee: ${context.applicationFee}. Annual fee: ${context.annualFee}. Offset: ${context.offsetAccount}. Broker recommendation note: ${context.recommendationNote}. Cover: why recommended product is in client's best interests, alternatives considered, fees and charges, rate comparisons, why cheaper options may not have been selected. Reference SFG Best Interests Duty — must justify recommendation. Write in professional paragraphs.`,
      borrowingPowerComment: `You are a compliance officer for an Australian mortgage brokerage. Write the "Borrowing power" broker comment. Client: ${context.clientName}. Loan: $${context.loanAmount}. Purchase price: $${context.purchasePrice}. Income: $${context.incomeBase} base, $${context.incomeRental} rental. CC limit: $${context.ccLimit}. Cover: maximum borrowing capacity, DTI ratio, asset position, LVR, serviceability assessment. Write 3-4 professional paragraphs.`,
      depositComment: `You are a compliance officer for an Australian mortgage brokerage. Write the "Deposit/Equity" broker comment in 1-2 sentences. Client: ${context.clientName}. Purchase price: $${context.purchasePrice}. Loan: $${context.loanAmount}. Deposit: $${context.deposit}. Existing loan: $${context.existingLoan}. State where funds for completion come from.`,
      creditHistoryComment: `You are a compliance officer for an Australian mortgage brokerage. Write the "Credit history" broker comment. Client: ${context.clientName}. Risk answers: ${context.risks}. Note: No Equifax credit score currently available — prompt credit team to confirm. Cover: payment history, bankruptcies, judgements, simultaneous applications. If all credit history answers are No, confirm clean credit history. Reference NCCP responsible lending obligations. Write 2-3 professional paragraphs.`,
      securityComment: `Write one sentence for the "Security (property)" field. Property type: ${context.propertyType}. Suburb: ${context.suburb}. If no address confirmed yet write "TBA — [property type] [suburb]".`,
    }

    try {
      const res = await fetch('/api/generate-compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompts[field] || '' })
      })
      const data = await res.json()
      const raw = data.text || ''
      if (raw) {
        const answerMatch = raw.match(/ANSWER:\s*([\s\S]*?)(?:\n\s*CONFIDENCE:|$)/i)
        const confidenceMatch = raw.match(/CONFIDENCE:\s*([\s\S]*?)(?:\n\s*SOURCE:|$)/i)
        const sourceMatch = raw.match(/SOURCE:\s*([\s\S]*?)$/i)
        const answer = answerMatch ? answerMatch[1].trim() : raw.trim()
        const confidence = confidenceMatch ? confidenceMatch[1].trim() : ''
        const source = sourceMatch ? sourceMatch[1].trim() : ''
        setD(prev => ({ ...prev, [field]: answer, aiMeta: { ...prev.aiMeta, [field]: { confidence, source } } }))
      }
    } catch (e) { console.error(e) }
    setGenerating(prev => ({ ...prev, [field]: false }))
  }

  async function generateAll() {
    const fields = ['needsPrimary', 'needsImmediate', 'needsLongTerm', 'analysisComment', 'optionsComment', 'borrowingPowerComment', 'depositComment', 'creditHistoryComment', 'securityComment']
    for (const f of fields) { await generateField(f) }
  }

  async function markComplianceComplete() {
    const nowIso = new Date().toISOString()
    const { error } = await supabase.from('deals').update({ compliance_completed_at: nowIso }).eq('id', deal.id)
    if (error) { alert('Error marking compliance complete: ' + error.message); return }
    setComplianceCompletedAt(nowIso)
  }

  function handlePushToSalesTrekker() {
    const errors = validateBeforePush()
    if (errors.length > 0) {
      setValidationErrors(errors)
      setShowValidation(true)
    } else {
      markComplianceComplete()
      alert('All fields complete — SalesTrekker automation coming soon!')
    }
  }

  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF]"
  const currentApplicant = d.applicants[activeApplicant]
  const currentRisk = d.risks[currentApplicant?.name] || defaultRisk()

  const stages = ['needs', 'risks', 'product', 'comments', 'expenses'] as const
  const stageLabels = { needs: 'Needs & objectives', risks: 'Risks', product: 'Product requirements', comments: 'Broker comments', expenses: 'Living expenses' }

  return (
    <div className="space-y-4">
      {/* Stage tabs */}
      <div className="flex bg-white border border-gray-100 rounded-xl p-1 gap-1">
        {stages.map(s => (
          <button key={s} onClick={() => setStage(s)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${stage === s ? 'bg-[#343333] text-white' : 'text-gray-400 hover:text-gray-600'}`}>
            {stageLabels[s]}
          </button>
        ))}
      </div>

      {/* Pre-filled summary */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">Deal summary <span className="normal-case text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium ml-1">pre-filled from BC & LO</span></div>
        <div className="grid grid-cols-4 gap-3">
          {[
            ['Client', d.applicants.map(a => a.name).join(', ')],
            ['Loan amount', `$${lo.loanAmount || bc.splits?.[0]?.amount || '—'}`],
            ['Lender', lo.lenders?.[0]?.lenderName || '—'],
            ['Loan type', bc.template?.replace(/_/g, ' ') || '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-xs text-gray-400">{label}</div>
              <div className="text-sm font-medium text-[#343333] truncate">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* STAGE: Needs & Objectives */}
      {stage === 'needs' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <SectionHeader title="Needs & objectives" />
            {[
              { key: 'needsPrimary', label: 'Primary reasons for seeking credit' },
              { key: 'needsImmediate', label: 'Immediate needs & objectives — next 2 years' },
              { key: 'needsLongTerm', label: 'Longer term — 2 to 10 years' },
            ].map(({ key, label }) => (
              <div key={key} className="mb-4">
                <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
                <textarea className={inp + ' min-h-[100px] resize-y'} value={(d as any)[key]}
                  onChange={e => setD(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder="Click Generate with AI or type manually..." />
                <AIButton onClick={() => generateField(key)} loading={generating[key]} />
              </div>
            ))}
            <div className="mt-2">
              <label className="text-xs font-medium text-gray-500 block mb-2">Requirements type</label>
              <Toggle value={d.requirementsType} onChange={v => setD(prev => ({ ...prev, requirementsType: v }))}
                options={['Owner occupied', 'Investment']} colors={['blue', 'blue']} />
            </div>
          </div>
        </div>
      )}

      {/* STAGE: Risks */}
      {stage === 'risks' && (
        <div className="space-y-4">
          {/* Applicant tabs */}
          <div className="flex gap-2">
            {d.applicants.map((a, i) => (
              <button key={i} onClick={() => setActiveApplicant(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${activeApplicant === i ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-400'}`}>
                {a.name}
              </button>
            ))}
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
            <SectionHeader title={`Risks — ${currentApplicant?.name}`} />

            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Financial situation</div>
              <ToggleRow label="Adverse changes to financial situation?" value={currentRisk.adverseChanges}
                onChange={v => updateRisk(currentApplicant.name, 'adverseChanges', v)}
                options={['Yes', 'No']} colors={['red', 'green']} required />
              <ToggleRow label="Beneficial changes to financial situation?" value={currentRisk.beneficialChanges}
                onChange={v => updateRisk(currentApplicant.name, 'beneficialChanges', v)}
                options={['Yes', 'No']} colors={['green', 'green']} required />
            </div>

            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Exit strategy</div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Retirement age</label>
                  <input className={inp} value={currentRisk.retirementAge} onChange={e => updateRisk(currentApplicant.name, 'retirementAge', e.target.value)} placeholder="e.g. 65" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Repayment method</label>
                  <select className={inp} value={currentRisk.repaymentMethod} onChange={e => updateRisk(currentApplicant.name, 'repaymentMethod', e.target.value)}>
                    <option value="">— select —</option>
                    <option>Repayment of loan prior to retirement</option>
                    <option>Downsizing home</option>
                    <option>Sale of assets</option>
                    <option>Recurring income from superannuation</option>
                    <option>Superannuation lump sum following retirement</option>
                    <option>Savings</option>
                    <option>Income from other investments</option>
                    <option>Co-applicants income</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Financial security</div>
              {[
                { key: 'financialExperience', label: 'Level of financial experience' },
                { key: 'interestRateConcern', label: 'Concern about interest rate movements' },
                { key: 'loanFlexibility', label: 'Importance of loan flexibility (offset/redraw)' },
                { key: 'jobSecurity', label: 'Concern about job security' },
                { key: 'propertyValueConcern', label: 'Concern about property value fluctuations' },
              ].map(({ key, label }) => (
                <ToggleRow key={key} label={label} value={(currentRisk as any)[key]}
                  onChange={v => updateRisk(currentApplicant.name, key as keyof RiskData, v)}
                  options={['Low', 'Medium', 'High']} colors={['green', 'amber', 'red']} />
              ))}
              {[
                { key: 'emergencyFund', label: 'Emergency fund / liquid asset or insurance for loss of income?' },
                { key: 'maintainLifestyle', label: 'Maintain commitments if partner unable to earn?' },
                { key: 'adequateInsurance', label: 'Adequate insurance for loan repayments if unable to work?' },
                { key: 'hasWill', label: 'Do you have a will?' },
                { key: 'circumstancesImpact', label: 'Any circumstances that may impact financial commitments?' },
              ].map(({ key, label }) => (
                <ToggleRow key={key} label={label} value={(currentRisk as any)[key]}
                  onChange={v => updateRisk(currentApplicant.name, key as keyof RiskData, v)}
                  options={['Yes', 'No']} colors={['green', 'red']} />
              ))}
            </div>

            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Credit history <span className="normal-case text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium ml-1">⚠ Team must answer — Equifax not integrated</span></div>
              {[
                { key: 'problemsMeetingCommitments', label: 'Problems meeting fixed commitments including mobile payments?' },
                { key: 'officerInLiquidation', label: 'Officer/shareholder of company where liquidator appointed?' },
                { key: 'unsatisfiedJudgements', label: 'Unsatisfied judgements in court?' },
                { key: 'simultaneousApplications', label: 'Simultaneously applied to other credit providers?' },
              ].map(({ key, label }) => (
                <ToggleRow key={key} label={label} value={(currentRisk as any)[key]}
                  onChange={v => updateRisk(currentApplicant.name, key as keyof RiskData, v)}
                  options={['Yes', 'No']} colors={['red', 'green']} required />
              ))}
              <ToggleRow label="Ever declared bankrupt?" value={currentRisk.declaredBankrupt}
                onChange={v => updateRisk(currentApplicant.name, 'declaredBankrupt', v)}
                options={['Yes', 'No', 'Yes discharged']} colors={['red', 'green', 'amber']} required />
            </div>
          </div>
        </div>
      )}

      {/* STAGE: Product Requirements */}
      {stage === 'product' && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <SectionHeader title="Product requirements" badge="AI pre-filled from LO" />

          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Rate type</div>
            {[
              { key: 'variableRate', label: 'Variable rate' },
              { key: 'fixedRate', label: 'Fixed rate' },
              { key: 'fixedAndVariable', label: 'Fixed and variable rate' },
            ].map(({ key, label }) => (
              <ToggleRow key={key} label={label} value={(d.productReqs as any)[key]}
                onChange={v => updateProductReqs(key as keyof ProductReqs, v)}
                options={['Important', 'Not important', 'Do not want']} colors={['blue', 'default', 'red']} />
            ))}
          </div>

          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Repayment type</div>
            {[
              { key: 'principalAndInterest', label: 'Principal and interest' },
              { key: 'interestOnly', label: 'Interest only' },
              { key: 'interestInAdvance', label: 'Interest in advance' },
              { key: 'lineOfCredit', label: 'Line of credit' },
            ].map(({ key, label }) => (
              <ToggleRow key={key} label={label} value={(d.productReqs as any)[key]}
                onChange={v => updateProductReqs(key as keyof ProductReqs, v)}
                options={['Important', 'Not important', 'Do not want']} colors={['blue', 'default', 'red']} />
            ))}
          </div>

          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Product type</div>
            {[
              { key: 'offsetAccount', label: 'Offset account' },
              { key: 'redraw', label: 'Redraw' },
            ].map(({ key, label }) => (
              <ToggleRow key={key} label={label} value={(d.productReqs as any)[key]}
                onChange={v => updateProductReqs(key as keyof ProductReqs, v)}
                options={['Important', 'Not important', 'Do not want']} colors={['blue', 'default', 'red']} />
            ))}
          </div>

          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">What is important to you</div>
            {[
              { key: 'lowestCost', label: 'Lowest overall loan cost' },
              { key: 'approvedQuickly', label: 'Loan approved quickly' },
              { key: 'specificFeatures', label: 'Specific loan features' },
              { key: 'lenderPolicy', label: 'Lender policy / borrowing capacity' },
            ].map(({ key, label }) => (
              <ToggleRow key={key} label={label} value={(d.productReqs as any)[key]}
                onChange={v => updateProductReqs(key as keyof ProductReqs, v)}
                options={['Most important', 'Somewhat important', 'Least important']} colors={['blue', 'default', 'default']} />
            ))}
          </div>

          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Branch access</div>
            <ToggleRow label="How often do you go to a branch?" value={d.productReqs.branchFrequency}
              onChange={v => updateProductReqs('branchFrequency', v)}
              options={['All the time', 'Sometimes', 'Rarely']} colors={['blue', 'blue', 'default']} />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Other requirements</label>
            <textarea className={inp + ' min-h-[80px] resize-y'} value={d.productReqs.otherRequirements}
              onChange={e => updateProductReqs('otherRequirements', e.target.value)}
              placeholder="Any other requirements not already stated..." />
          </div>
        </div>
      )}

      {/* STAGE: Broker Comments */}
      {stage === 'comments' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader title="Broker comments" badge="AI generated" />
              <AIButton onClick={generateAll} loading={Object.values(generating).some(Boolean)} label="Generate all fields" />
            </div>

            {[
              { key: 'analysisComment', label: 'Analysis, assessment & applicant education' },
              { key: 'optionsComment', label: 'Options presented & recommendation' },
              { key: 'borrowingPowerComment', label: 'Borrowing power' },
            ].map(({ key, label }) => (
              <div key={key} className="mb-4">
                <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
                <textarea className={inp + ' min-h-[120px] resize-y'} value={(d as any)[key]}
                  onChange={e => setD(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder="Click Generate with AI or type manually..." />
                <AIButton onClick={() => generateField(key)} loading={generating[key]} />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'depositComment', label: 'Deposit / equity' },
                { key: 'creditHistoryComment', label: 'Credit history', warning: '⚠ Confirm Equifax with client' },
              ].map(({ key, label, warning }) => (
                <div key={key} className="mb-4">
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    {label} {warning && <span className="text-[10px] text-amber-500">{warning}</span>}
                  </label>
                  <textarea className={inp + ' min-h-[100px] resize-y'} value={(d as any)[key]}
                    onChange={e => setD(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder="Click Generate..." />
                  <AIButton onClick={() => generateField(key)} loading={generating[key]} />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Security (property)</label>
                <textarea className={inp + ' min-h-[80px] resize-y'} value={d.securityComment}
                  onChange={e => setD(prev => ({ ...prev, securityComment: e.target.value }))}
                  placeholder="TBA or enter address..." />
                <AIButton onClick={() => generateField('securityComment')} loading={generating['securityComment']} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Application submission notes</label>
                <textarea className={inp + ' min-h-[80px] resize-y'} value={d.applicationSubmissionComment}
                  onChange={e => setD(prev => ({ ...prev, applicationSubmissionComment: e.target.value }))}
                  placeholder="Lender-specific notes, broker contact details..." />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {savedAt ? `Autosaved at ${savedAt}` : ''}
              {complianceCompletedAt && <span className="ml-3 text-green-600">✓ Compliance completed</span>}
            </span>
          </div>
        </div>
      )}

      {/* STAGE: Living Expenses */}
      {stage === 'expenses' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <SectionHeader title="Living expenses" badge="household monthly" />
            <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />In HEM</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />Not in HEM</span>
            </div>
            <div className="flex flex-col gap-2">
              {EXPENSE_CATEGORIES.map(cat => {
                const entry = d.expenses?.[cat.key] || { monthlyAmount: '', splits: {}, comment: '' }
                return (
                  <div key={cat.key} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 ${cat.inHem ? 'bg-green-500' : 'bg-red-400'}`} />
                      <span className="text-sm font-medium text-[#343333]">{cat.label}</span>
                    </div>
                    <div className="grid gap-2 items-end" style={{ gridTemplateColumns: `160px repeat(${d.applicants.length}, 1fr) 1fr` }}>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Monthly amount</label>
                        <input className={inp} value={entry.monthlyAmount} onChange={e => updateExpense(cat.key, 'monthlyAmount', e.target.value)} />
                      </div>
                      {d.applicants.map(a => (
                        <div key={a.name}>
                          <label className="text-xs text-gray-400 block mb-1">{a.name} %</label>
                          <input className={inp} value={entry.splits?.[a.name] || ''} onChange={e => updateExpenseSplit(cat.key, a.name, e.target.value)} />
                        </div>
                      ))}
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Comment</label>
                        <input className={inp} value={entry.comment} onChange={e => updateExpense(cat.key, 'comment', e.target.value)} placeholder="Optional note..." />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {(() => {
            const toNum = (v: string) => parseFloat(String(v).replace(/,/g, '')) || 0
            const totalAll = EXPENSE_CATEGORIES.reduce((sum, c) => sum + toNum(d.expenses?.[c.key]?.monthlyAmount || ''), 0)
            const totalHem = EXPENSE_CATEGORIES.filter(c => c.inHem).reduce((sum, c) => sum + toNum(d.expenses?.[c.key]?.monthlyAmount || ''), 0)
            const totalNotHem = EXPENSE_CATEGORIES.filter(c => !c.inHem).reduce((sum, c) => sum + toNum(d.expenses?.[c.key]?.monthlyAmount || ''), 0)
            return (
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <SectionHeader title="Totals (monthly)" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Total expenses</div>
                    <div className="text-xl font-semibold text-[#343333]">${totalAll.toLocaleString('en-AU')}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-green-600 mb-1">Total living expenses (in HEM)</div>
                    <div className="text-xl font-semibold text-green-700">${totalHem.toLocaleString('en-AU')}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-xs text-red-500 mb-1">Total living expenses (not in HEM)</div>
                    <div className="text-xl font-semibold text-red-600">${totalNotHem.toLocaleString('en-AU')}</div>
                  </div>
                </div>
              </div>
            )
          })()}

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {savedAt ? `Autosaved at ${savedAt}` : ''}
              {complianceCompletedAt && <span className="ml-3 text-green-600">✓ Compliance completed</span>}
            </span>
            <button onClick={handlePushToSalesTrekker}
              className="bg-[#343333] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#2a2a2a] transition">
              Push to SalesTrekker →
            </button>
          </div>
        </div>
      )}

      {/* Validation Modal */}
      {showValidation && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[500px] shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="text-base font-semibold mb-1 text-[#343333]">⚠ Fields require attention</div>
            <p className="text-sm text-gray-500 mb-4">The following fields are empty. Please complete them before pushing to SalesTrekker, or confirm to proceed anyway.</p>
            <div className="space-y-2 mb-5">
              {validationErrors.map((err, i) => (
                <div key={i} className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowValidation(false)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                Go back & complete
              </button>
              <button onClick={() => { setShowValidation(false); markComplianceComplete(); alert('SalesTrekker automation coming soon!') }}
                className="px-4 py-2 text-sm bg-[#343333] text-white rounded-lg font-medium hover:bg-[#2a2a2a]">
                Proceed anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
