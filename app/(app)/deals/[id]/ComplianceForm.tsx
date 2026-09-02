'use client'
import { useState, useEffect } from 'react'
import { isWithLender, splitsTotal } from '@/lib/deal-phase'
import { applicantsOf } from '@/lib/applicants'
import { hemStateOf, hemTotals, unansweredNote, type HemAnswer } from '@/lib/hem'

// The loan on this deal: what the LO settled on, or failing that the BC's splits
// added up. It used to fall back to the FIRST BC split, so a multi-split deal
// with no LO yet showed - and told the AI - half the loan.
const dealLoanAmount = (lo: any, bc: any): string => {
  if (lo?.loanAmount) return String(lo.loanAmount)
  const total = splitsTotal(bc?.splits)
  return total ? total.toLocaleString('en-AU') : ''
}
import { checkedWrite } from '@/lib/checked-write'
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
  clientAgreedLender: string
  clientChosenLender: string
  clientChosenLenderOther: string
  clientChosenLenderReason: string
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

// `askHem` puts a toggle on the row and leaves the answer to the person writing
// the file. Only two, because lenders only disagree about two - a switch on all
// twenty-three would be twenty-three more chances to get one wrong.
//
// The KEYS never change. `primaryResidenceBodyCorp` is written into every deal
// already assessed; renaming it to match the label would orphan all of them.
// Australia says strata, so only the words on screen change.
const EXPENSE_CATEGORIES: { key: string; label: string; inHem: boolean; askHem?: boolean }[] = [
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
  { key: 'healthInsurance', label: 'Health insurance', inHem: true, askHem: true },
  { key: 'generalBasicInsurances', label: 'General basic insurances', inHem: true },
  { key: 'transport', label: 'Transport', inHem: true },
  { key: 'secondaryResidenceRunningCosts', label: 'Secondary residence running costs', inHem: false },
  { key: 'primaryResidenceRunningCosts', label: 'Primary residence running costs', inHem: true },
  { key: 'investmentPropertyRunningCosts', label: 'Investment property running costs', inHem: true },
  { key: 'primaryResidenceBodyCorp', label: 'Strata (primary residence)', inHem: true, askHem: true },
  { key: 'childSpousalMaintenance', label: 'Child and spousal maintenance', inHem: false },
  { key: 'rent', label: 'Rent', inHem: true },
  { key: 'board', label: 'Board', inHem: true },
]

type ExpenseEntry = {
  monthlyAmount: string
  splits: Record<string, string>
  comment: string
  // 'in' | 'out'. Absent means nobody has answered, which is a third thing and
  // is shown as such - see lib/hem.ts.
  hem?: string
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
      className="mt-2 text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap">
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v4M9 17v4M3 9h4M17 9h4M9 9l6 6M15 9l-6 6" />
      </svg>
      <span>{loading ? 'Generating...' : label}</span>
    </button>
  )
}

export default function ComplianceForm({ deal, onSaveStatus }: { deal: any; onSaveStatus?: (s: { at?: string; error?: string }) => void }) {
  const supabase = createSupabaseBrowser()
  const [styleNotes, setStyleNotes] = useState<string[]>([])
  const [flaggingField, setFlaggingField] = useState<string | null>(null)
  const [flagNote, setFlagNote] = useState('')
  const [flagSubmitting, setFlagSubmitting] = useState(false)

  async function submitFlag(fieldKey: string, fieldLabel: string) {
    if (!flagNote.trim()) return
    setFlagSubmitting(true)
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('compliance_flags').insert({
      deal_id: deal.id,
      field_key: fieldKey,
      field_label: fieldLabel,
      note: flagNote.trim(),
      flagged_by: userData?.user?.email || 'unknown'
    })
    setFlagSubmitting(false)
    if (error) {
      alert('Error submitting flag: ' + error.message)
      return
    }
    setFlaggingField(null)
    setFlagNote('')
  }

  useEffect(() => {
    supabase.from('settings').select('compliance_style_notes').eq('id', 'singleton').single().then(({ data }) => {
      if (data?.compliance_style_notes?.length) setStyleNotes(data.compliance_style_notes)
    })
  }, [])
  const saveKey = `compliance_${deal.id}`
  const bc = deal.bc_data || {}
  const lo = deal.lo_data || {}

  // The fact find, not the BC. This used to require `bc.joint === 'Yes' &&
  // bc.jointFirstName` - and jointFirstName is built when the BC email is
  // generated and never written into bc_data, so the second applicant was never
  // added to ANY joint deal. See lib/applicants.ts.
  const getApplicants = (): Applicant[] => applicantsOf(deal, bc) as Applicant[]

  const initData = (): ComplianceData => {
    // Database first, same as FactFindForm.
    if (deal?.compliance_data && Object.keys(deal.compliance_data).length > 0) {
      return deal.compliance_data as ComplianceData
    }
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
      aiMeta: {},
      clientAgreedLender: '',
      clientChosenLender: '',
      clientChosenLenderOther: '',
      clientChosenLenderReason: ''
    }
  }

  const [d, setD] = useState<ComplianceData>(initData)

  useEffect(() => {
    const freshApps = getApplicants()
    const freshRequirementsType = bc.template?.includes('investment') ? 'Investment' : 'Owner occupied'
    const ffLive = deal.fact_find_data || {}
    const loLive = deal.lo_data || {}
    setD(prev => {
      const newRisks = { ...prev.risks }
      freshApps.forEach(a => { if (!newRisks[a.name]) newRisks[a.name] = defaultRisk() })
      return {
        ...prev,
        applicants: freshApps,
        requirementsType: freshRequirementsType,
        risks: newRisks,
        needsPrimary: prev.needsPrimary || ffLive.loanPurpose || '',
        needsImmediate: prev.needsImmediate || ffLive.goals2Years || '',
        needsLongTerm: prev.needsLongTerm || ffLive.goals10Years || '',
        clientAgreedLender: prev.clientAgreedLender || loLive.clientAgreedLender || '',
        clientChosenLender: prev.clientChosenLender || loLive.clientChosenLender || '',
        clientChosenLenderOther: prev.clientChosenLenderOther || loLive.clientChosenLenderOther || '',
        clientChosenLenderReason: prev.clientChosenLenderReason || loLive.clientChosenLenderReason || '',
      }
    })
  }, [deal.bc_data, deal.fact_find_data, deal.lo_data])
  const [activeApplicant, setActiveApplicant] = useState(0)
  const [generating, setGenerating] = useState<Record<string, boolean>>({})
  const [savedAt, setSavedAt] = useState('')
  const [saveError, setSaveError] = useState('')
  // Mirror save state up to the deal header, which owns the single indicator.
  useEffect(() => { onSaveStatus?.({ at: savedAt, error: saveError }) }, [savedAt, saveError])
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

  // Name to id, so the lender the client accepted can be recorded on the deal.
  const [lenderIdByName, setLenderIdByName] = useState<Record<string, string>>({})
  useEffect(() => {
    supabase.from('lenders').select('id, name').then(({ data }) => {
      const byName: Record<string, string> = {}
      ;(data || []).forEach((l: any) => { byName[String(l.name || '').trim().toLowerCase()] = l.id })
      setLenderIdByName(byName)
    })
  }, [])

  useEffect(() => {
    // The database is the only store - no localStorage copy. Debounced because this
    // previously wrote on every keystroke, and the row count is now checked because
    // a refused write returns zero rows with no error.
    const t = setTimeout(() => {
      // The lender the CLIENT actually accepted goes onto the deal.
      //
      // Compliance already asks whether they took the recommendation or chose
      // something else. Until now that answer stayed inside compliance_data, so
      // `deals.lender_id` — which the commission maths, the clawback window and
      // the settlement board all read — kept whatever the LO recommended, even
      // when the client went elsewhere.
      const chosenName = d.clientAgreedLender === 'No'
        ? (d.clientChosenLender === '__other__' ? d.clientChosenLenderOther : d.clientChosenLender)
        : ''
      const chosenId = chosenName ? lenderIdByName[String(chosenName).trim().toLowerCase()] : null
      const patch: any = { compliance_data: d }
      if (chosenId) patch.lender_id = chosenId

      supabase.from('deals').update(patch).eq('id', deal.id).select('id').then(({ data: rows, error }) => {
        if (error) { console.error('Compliance autosave failed:', error); setSaveError('NOT SAVED - ' + error.message); return }
        if (!rows || rows.length === 0) { console.error('Compliance autosave affected zero rows'); setSaveError('NOT SAVED - your changes did not reach the database. Do not close this tab.'); return }
        setSaveError('')
        setSavedAt(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
      })
    }, 700)
    return () => clearTimeout(t)
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

  function setExpenseHem(key: string, answer: HemAnswer | '') {
    setD(prev => ({ ...prev, expenses: { ...prev.expenses, [key]: { ...prev.expenses[key], hem: answer } } }))
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

  // Every question on the Risks tab. Used to tell "nobody has started this
  // applicant" apart from "somebody answered some of it".
  const RISK_KEYS = ['financialExperience', 'interestRateConcern', 'loanFlexibility', 'jobSecurity',
                     'propertyValueConcern', 'adverseChanges', 'beneficialChanges', 'retirementAge',
                     'repaymentMethod', 'emergencyFund', 'maintainLifestyle', 'adequateInsurance',
                     'hasWill', 'circumstancesImpact', 'problemsMeetingCommitments',
                     'officerInLiquidation', 'unsatisfiedJudgements', 'simultaneousApplications',
                     'declaredBankrupt']

  const riskStarted = (name: string): boolean => {
    const r: any = d.risks[name]
    return !!r && RISK_KEYS.some(k => String(r[k] || '').trim())
  }

  function validateBeforePush(): string[] {
    const errors: string[] = []
    if (!d.needsPrimary) errors.push('Needs & objectives — Primary reasons not filled')
    if (!d.needsImmediate) errors.push('Needs & objectives — Immediate needs not filled')
    if (!d.needsLongTerm) errors.push('Needs & objectives — Long term needs not filled')
    d.applicants.forEach(a => {
      const r = d.risks[a.name]
      if (!r || !RISK_KEYS.some(k => String((r as any)[k] || '').trim())) {
        errors.push(`${a.name} — no risk questions answered at all. Every applicant is asked, not one of them.`)
        return
      }
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
    const recLender = (lo.lenders || []).find((l: any) => l.lenderName === lo.recommendedLender) || lo.lenders?.[0] || {}
    const context = {
      clientName: d.applicants.map(a => a.name).join(' and '),
      loanAmount: dealLoanAmount(lo, bc),
      purchasePrice: bc.purchasePrice || '',
      deposit: bc.deposit || '',
      loanType: bc.template || '',
      incomeBase: bc.incomeBase || '',
      incomeOther: bc.incomeOther || '',
      incomeRental: bc.incomeRental || '',
      lender: recLender.lenderName || '',
      product: recLender.productName || '',
      rate: recLender.variablePI?.rate || recLender.fixedPI?.rate || '',
      recommendedLender: (() => {
        if (d.clientAgreedLender === 'No') {
          const chosen = d.clientChosenLender === '__other__' ? d.clientChosenLenderOther : d.clientChosenLender
          return chosen || lo.recommendedLender || ''
        }
        return lo.recommendedLender || ''
      })(),
      originalRecommendedLender: lo.recommendedLender || '',
      clientAgreedLender: d.clientAgreedLender || '',
      clientChosenLenderReason: d.clientChosenLenderReason || '',
      recommendationNote: lo.recommendationNote || '',
      allLenders: (lo.lenders || []).map((l: any) => `${l.lenderName} ${l.productName}`).join(', '),
      applicationFee: recLender.applicationFee || '',
      annualFee: recLender.annualFee || '',
      offsetAccount: recLender.offsetAccount || '',
      redraw: recLender.redraw || '',
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
      needsPrimary: `CRM FIELD: Primary reasons for seeking credit / your needs and objectives

Cover: purpose of the loan (owner occupied / investment) and why; loan amount and term and why; any specific features, lenders, interest rate types or repayment types requested and why; any flexibility on the client's stated needs and objectives; savings held / retention of savings and why; any personal circumstances that may affect the loan (financial circumstances, employment, family status); whether the client is a first home buyer.

Client: ${context.clientName}. Loan: $${context.loanAmount} for ${context.loanType}. Property location (may be a suburb or a state): ${context.suburb}. Income: $${context.incomeBase} base. Recommended lender: ${context.recommendedLender}, product: ${context.product}. Confirmed product features: Offset account = ${context.offsetAccount || 'not specified'}, Redraw = ${context.redraw || 'not specified'}. Client's own stated purpose for this loan: "${context.loanPurpose || 'not recorded'}". IMPORTANT: only reference a specific loan feature (e.g. offset account) as a benefit if it is confirmed present above — if a feature is not present, describe the general benefit (e.g. reducing debt through extra repayments) without naming a feature the product doesn't have. Write 4-6 sentences, no dot points.`,

      needsImmediate: `CRM FIELD: Immediate needs and objectives — within the next two years (e.g. holiday, purchases, renovations, savings, protect the family, etc)

Cover: what the client might want to achieve in the next 2 years and how it may affect the loan — overseas travel, starting a family, upgrading or changing property, investments.

Client: ${context.clientName}. Loan type: ${context.loanType}. Recommended product features: Offset account = ${context.offsetAccount || 'not specified'}, Redraw = ${context.redraw || 'not specified'}. Client's own stated 2-year goals: "${context.goals2Years || 'not recorded'}". IMPORTANT: only reference a specific loan feature as helping achieve a goal if it is confirmed present above — otherwise describe the general benefit without naming a feature the product doesn't have. Write 3-4 sentences, no dot points.`,

      needsLongTerm: `CRM FIELD: Longer term needs and objectives — between 2 to 10 years (e.g. repay mortgage, buy a new car, education expenses, purchase investment property, retirement planning, etc)

Cover: reducing the home loan and why/how quickly; dependants — commencing or finishing schooling, childcare costs, affordability; retiring before the end of the requested loan term and how this may affect the loan; vehicle or recreational vehicle upgrade and potential timing.

Client: ${context.clientName}. Dependants: ${context.dependants}. Recommended product features: Offset account = ${context.offsetAccount || 'not specified'}, Redraw = ${context.redraw || 'not specified'}. Client's own stated 2-10 year goals: "${context.goals10Years || 'not recorded'}". IMPORTANT: only reference a specific loan feature as helping achieve a goal if it is confirmed present above — otherwise describe the general benefit without naming a feature the product doesn't have. Write 3-4 sentences, no dot points.`,

      analysisComment: `CRM FIELD: Analysis, assessment and applicant education comments

Write three clearly labelled sections using bold subheadings:

ANALYSIS — cover: purpose of the loan and loan amount; what the client is hoping to achieve short and long term; overview of the client's situation; ages of applicants and whether an exit strategy is required; residential status (renting, boarding, and history); family status and ages of dependants; employment type, income, stability and any recent/upcoming changes; assets and liabilities including any changes (e.g. credit cards being closed or paid out); financial habits (savings held); financial awareness (loan terms, repayments, interest rates); credit history.

ASSESSMENT — cover: the client's personal and financial position including employment stability; the client's wants versus what they actually need; the client's goals, objectives, priorities and preferences; specific requirements (lender, features, repayment type); lender policy, serviceability and borrowing capacity; security type and any postcode restrictions; turnaround times and security property type considerations.

APPLICANT EDUCATION — cover: the level of financial understanding driving the education needed; any mitigants (e.g. the client's situation may limit what's available to them); client wants versus needs; how loan types and features work; repayment types and requirements; any complex scenarios (guarantor, exit strategy, foreseeable changes); applicable fees and charges; government schemes or promotional offers; cashback offers; costs of refinancing/extending loan term; professional packages; fixed rates and break costs; pre-approval requirements; seniors' loans if applicable.

Client: ${context.clientName}. Loan: $${context.loanAmount}. Income: $${context.incomeBase}. Dependants: ${context.dependants}. Lender: ${context.recommendedLender}. Product: ${context.product}. Rate: ${context.rate}%. Minimum 500 words total across the three sections.`,

      optionsComment: `CRM FIELD: Options presented and recommendation comments

Cover: how the recommended product is in the client's best interests; loan type, repayment type, interest rate type and why; specific lender request versus other cheaper options considered; alternative feature options to what was requested and why (e.g. offset vs redraw); if the cheapest option was not recommended, explain why; whether turnaround times, geographical location, lender policy, borrowing capacity or loan amount available played a part in the recommendation; fees and charges applicable, any fee waivers or professional packages; security or servicing guarantee if applicable; lender service/branch access; credit history if it affected the recommendation; property size; first home buyer scheme if applicable.

All lenders considered: ${context.allLenders}. Originally recommended: ${context.originalRecommendedLender} — ${context.product}. Rate: ${context.rate}%. Application fee: ${context.applicationFee}. Annual fee: ${context.annualFee}. Offset: ${context.offsetAccount}. Broker recommendation note: ${context.recommendationNote}. ${context.clientAgreedLender === 'No' ? `The client did not proceed with the original recommendation and instead selected ${context.recommendedLender}, for the following stated reason: "${context.clientChosenLenderReason || 'not recorded'}". Explain both why the original lender was recommended AND why the client's final choice is understood and documented, referencing their stated reason.` : `The client agreed with and proceeded with the recommended lender.`} Write in professional paragraphs.`,

      borrowingPowerComment: `CRM FIELD: Borrowing power comments

Explain the client's ability to repay the loan — reference maximum borrowing capacity, debt-to-income ratio, asset position, LVR, and overall serviceability assessment.

Client: ${context.clientName}. Loan: $${context.loanAmount}. Purchase price: $${context.purchasePrice}. Income: $${context.incomeBase} base, $${context.incomeRental} rental. CC limit: $${context.ccLimit}. Write 3-4 paragraphs.`,

      depositComment: `CRM FIELD: Deposit/Equity comments

Explain the deposit if this is a purchase, or the equity usage if this is a refinance/equity release/cashout — must reference the client's savings position and where funds for completion come from.

Client: ${context.clientName}. Purchase price: $${context.purchasePrice}. Loan: $${context.loanAmount}. Deposit: $${context.deposit}. Existing loan: $${context.existingLoan}. One sentence only.`,

      creditHistoryComment: `CRM FIELD: Credit history comments

Explain any potential credit history comments — must reference any comments about repayment history or conduct (payment history, bankruptcies, judgements, simultaneous credit applications). If all credit history answers are No, confirm a clean credit history and note that no Equifax credit score is currently available, so the credit team should confirm.

Client: ${context.clientName}. Risk answers: ${context.risks}. Write 2-3 paragraphs.`,

      securityComment: `CRM FIELD: Security (property) comments

Add the security if it is a refinance, or write TBA for a pre-approval — must reference the security in question.

Property type: ${context.propertyType}. Location (may be a suburb or a state): ${context.suburb}. One sentence only. If no address confirmed yet, write "TBA — [property type] [location]".`,
    }

    try {
      const res = await fetch('/api/generate-compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompts[field] || '', styleNotes })
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

  async function generateNeeds() {
    const fields = ['needsPrimary', 'needsImmediate', 'needsLongTerm']
    for (const f of fields) { await generateField(f) }
  }

  async function markComplianceComplete() {
    const nowIso = new Date().toISOString()
    const { data: rows, error } = await supabase.from('deals')
      .update({ compliance_completed_at: nowIso }).eq('id', deal.id).select('id')
    if (error) { alert('Error marking compliance complete: ' + error.message); return }
    if (!rows || rows.length === 0) {
      alert('NOT SAVED - compliance was not marked complete and the notification was not sent. Do not close this tab.')
      return
    }
    setComplianceCompletedAt(nowIso)
    // The notification is awaited and checked. If it fails the user is told, because
    // otherwise the message claims an email went out that never left the building.
    try {
      const res = await fetch('/api/notify-salestrekker', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, trigger: 'push_to_salestrekker' })
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        alert('Compliance is marked complete, but the notification email FAILED to send'
          + (detail ? ' (' + detail.slice(0, 200) + ')' : '')
          + '. Please tell the compliance team directly.')
        return
      }
      alert('Compliance complete - the compliance team has been notified that this deal is ready to be issued.')
    } catch (e: any) {
      alert('Compliance is marked complete, but the notification email FAILED to send ('
        + (e?.message || 'network error') + '). Please tell the compliance team directly.')
    }
  }

  const [downloading, setDownloading] = useState('')
  const pdfBaseName = String((deal as any).deal_name || (deal as any).name || (deal as any).title || 'deal').replace(/[^A-Za-z0-9_-]+/g, '_')

  async function downloadPdf(kind: 'summary' | 'compliance') {
    setDownloading(kind)
    try {
      const res = await fetch(kind === 'summary' ? '/api/generate-summary-pdf' : '/api/generate-compliance-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealId: deal.id })
      })
      if (!res.ok) { alert('Could not generate the ' + kind + ' PDF. Nothing was downloaded.'); return }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = pdfBaseName + '-' + kind + '.pdf'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      alert('Could not generate the ' + kind + ' PDF: ' + (e?.message || 'network error'))
    } finally {
      setDownloading('')
    }
  }

  const [showPositionPrompt, setShowPositionPrompt] = useState(false)
  const [positionChoices, setPositionChoices] = useState<Record<string, boolean>>({})
  const linkableApplicants = ((deal.fact_find_data || {}).applicants || []).filter((a: any) => a.clientId)

  async function updateClientPosition(applicant: any) {
    const ffLive = deal.fact_find_data || {}
    const ownedProperties = (ffLive.properties || []).filter((p: any) => !!p.ownership?.[applicant.id])
    const ownedLiabilities = (ffLive.liabilities || []).filter((l: any) => !!l.ownership?.[applicant.id])
    const ownedAssets = (ffLive.assets || []).filter((a: any) => !!a.ownership?.[applicant.id])
    return await checkedWrite(supabase.from('clients').update({
      position_properties: ownedProperties,
      position_liabilities: ownedLiabilities,
      position_assets: ownedAssets,
      position_updated_at: new Date().toISOString(),
      position_updated_from_deal_id: deal.id
    }).eq('id', applicant.clientId), `${applicant.firstName || 'That applicant'}'s position`)
  }

  async function finalizePush() {
    // The position carried onto the client record is what the next deal for this
    // person starts from. Failing silently here means the next fact find quietly
    // begins from stale figures, so compliance is NOT marked complete until it
    // has actually been written.
    for (const applicant of linkableApplicants) {
      if (positionChoices[applicant.id]) {
        const problem = await updateClientPosition(applicant)
        if (problem) { alert(problem + ' Compliance has not been marked complete.'); return }
      }
    }
    setShowPositionPrompt(false)
    markComplianceComplete()
  }

  function handlePushToSalesTrekker() {
    const errors = validateBeforePush()
    if (errors.length > 0) {
      setValidationErrors(errors)
      setShowValidation(true)
    } else if (linkableApplicants.length > 0) {
      setPositionChoices(Object.fromEntries(linkableApplicants.map((a: any) => [a.id, true])))
      setShowPositionPrompt(true)
    } else {
      markComplianceComplete()
    }
  }

  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF]"
  const currentApplicant = d.applicants[activeApplicant]
  const currentRisk = d.risks[currentApplicant?.name] || defaultRisk()

  // Once the deal is LODGED this tab is a record, not a workbench. Generating a
  // write-up with AI, or pushing to SalesTrekker again, is offering to redo
  // something that already happened - and the push re-emails both PDFs to the
  // compliance team for a deal that is already with the lender.
  //
  // Folded, not removed. The write-up is a regulated document and it does get
  // corrected after the fact, so it stays one click away and stays editable.
  const past = isWithLender(deal)
  const [showWriteUp, setShowWriteUp] = useState(!past)
  const sentOn = deal.compliance_sent_at || deal.compliance_completed_at || complianceCompletedAt

  const stages = ['needs', 'risks', 'product', 'comments', 'expenses'] as const
  const stageLabels = { needs: 'Needs & objectives', risks: 'Risks', product: 'Product requirements', comments: 'Broker comments', expenses: 'Living expenses' }

  return (
    <div className="space-y-4">
      {past && (
        <div className="bg-white border border-[#CFE6D5] rounded-xl px-4 py-3.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-[.06em] bg-[#F1F7F3] border border-[#CFE6D5] text-[#25794C] rounded-full px-2.5 py-[3px]">
              Compliance sent
            </span>
            <span className="text-[13px] text-[#6E665C]">
              {sentOn ? new Date(sentOn).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
              {' '}&middot; both PDFs emailed to the compliance team
            </span>
            <button onClick={() => setShowWriteUp(v => !v)}
              className="ml-auto text-[12.5px] text-[#2DBEFF] hover:underline">
              {showWriteUp ? 'Hide the write-up' : 'Show the write-up'}
            </button>
          </div>
          <p className="text-[11.5px] text-[#A29889] mt-2 mb-0">
            This deal is lodged. The write-up is kept here and can still be corrected, but nothing
            on this tab moves the deal along any more &mdash; it is tracked in After compliance and
            Settlement above.
          </p>
        </div>
      )}

      {(!past || showWriteUp) && (<>
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
            ['Loan amount', `$${dealLoanAmount(lo, bc) || '—'}`],
            ['Lender', (d.clientAgreedLender === 'No' ? ((d.clientChosenLender === '__other__' ? d.clientChosenLenderOther : d.clientChosenLender) || lo.recommendedLender) : lo.recommendedLender) || lo.lenders?.[0]?.lenderName || '—'],
            ['Loan type', bc.template?.replace(/_/g, ' ') || '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-xs text-gray-400">{label}</div>
              <div className="text-sm font-medium text-[#343333] truncate">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance actions */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            {past ? (
              /* The deal is already with the lender. Pressing this would re-email
                 both PDFs to the compliance team for something that went weeks
                 ago, so it is not a button any more. */
              <div className="text-[13px] text-[#6E665C]">
                <span className="font-semibold text-[#2E2A26]">Already pushed to SalesTrekker.</span>
                <div className="text-[11.5px] text-[#A29889] mt-1 max-w-[52ch]">
                  This deal is lodged. If the write-up genuinely has to go again, send it from the
                  PDFs rather than pushing the deal a second time.
                </div>
              </div>
            ) : (
              <>
                <button onClick={handlePushToSalesTrekker}
                  className="bg-[#343333] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#2a2a2a] transition inline-flex items-center gap-2">
                  Push to SalesTrekker
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                </button>
                <div className="text-[11.5px] text-[#A29889] mt-2.5 max-w-[46ch]">Marks compliance complete and emails both PDFs to the compliance team.</div>
                {complianceCompletedAt && <div className="text-[11.5px] text-green-600 mt-1">✓ Compliance completed</div>}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => downloadPdf('summary')} disabled={!!downloading}
              className="bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-lg px-3.5 py-2 text-[12.5px] font-medium hover:bg-[#F4EEE4] hover:text-[#2E2A26] transition inline-flex items-center gap-1.5 disabled:opacity-40">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8M4.5 7l3.5 3.5L11.5 7M3 13h10"/></svg>
              {downloading === 'summary' ? 'Preparing...' : 'Summary PDF'}
            </button>
            <button onClick={() => downloadPdf('compliance')} disabled={!!downloading}
              className="bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-lg px-3.5 py-2 text-[12.5px] font-medium hover:bg-[#F4EEE4] hover:text-[#2E2A26] transition inline-flex items-center gap-1.5 disabled:opacity-40">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8M4.5 7l3.5 3.5L11.5 7M3 13h10"/></svg>
              {downloading === 'compliance' ? 'Preparing...' : 'Compliance PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* STAGE: Needs & Objectives */}
      {stage === 'needs' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <SectionHeader title="Needs & objectives" />
              <AIButton onClick={generateNeeds} loading={['needsPrimary', 'needsImmediate', 'needsLongTerm'].some(f => generating[f])} label="Generate all fields" />
            </div>
            {[
              { key: 'needsPrimary', label: 'Primary reasons for seeking credit' },
              { key: 'needsImmediate', label: 'Immediate needs & objectives — next 2 years' },
              { key: 'needsLongTerm', label: 'Longer term — 2 to 10 years' },
            ].map(({ key, label }) => (
              <div key={key} className="mb-4">
                <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
                <textarea spellCheck="true" className={inp + ' min-h-[100px] resize-y'} value={(d as any)[key]}
                  onChange={e => setD(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder="Click Generate with AI or type manually..." />
                <AIButton onClick={() => generateField(key)} loading={generating[key]} />
                <button onClick={() => { setFlaggingField(flaggingField === key ? null : key); setFlagNote('') }} className="mt-2 ml-2 text-xs text-gray-400 hover:text-amber-500 underline">Flag an issue</button>
                {flaggingField === key && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <textarea spellCheck="true" className={inp + ' min-h-[60px] resize-y bg-white'} placeholder="What's wrong with this field?" value={flagNote} onChange={e => setFlagNote(e.target.value)} autoFocus />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => submitFlag(key, label)} disabled={flagSubmitting || !flagNote.trim()} className="text-xs bg-amber-500 text-white rounded-lg px-3 py-1.5 hover:bg-amber-600 disabled:opacity-40">{flagSubmitting ? 'Submitting...' : 'Submit flag'}</button>
                      <button onClick={() => { setFlaggingField(null); setFlagNote('') }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  </div>
                )}
                {d.aiMeta?.[key] && (d.aiMeta[key].confidence || d.aiMeta[key].source) && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {d.aiMeta[key].confidence && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        d.aiMeta[key].confidence.toLowerCase().includes('high') ? 'bg-green-50 text-green-600' :
                        d.aiMeta[key].confidence.toLowerCase().includes('low') ? 'bg-red-50 text-red-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>{d.aiMeta[key].confidence} confidence</span>
                    )}
                    {d.aiMeta[key].source && <span className="text-[10px] text-gray-400">Source: {d.aiMeta[key].source}</span>}
                  </div>
                )}
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
          <div className="flex gap-2 items-center flex-wrap">
            {d.applicants.map((a, i) => {
              const started = riskStarted(a.name)
              return (
                <button key={i} onClick={() => setActiveApplicant(i)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition flex items-center gap-2 ${
                    activeApplicant === i ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5'
                    : started ? 'border-gray-200 text-gray-400'
                    : 'border-[#EFD3CB] text-[#AD4227] bg-[#FBEDE9]'}`}>
                  {a.name}
                  {!started && <span className="text-[10px] font-bold uppercase tracking-[.05em]">not started</span>}
                </button>
              )
            })}
          </div>
          {/* These questions are asked of every applicant, never one of them.
              On a joint deal the second tab is the one that gets forgotten. */}
          {d.applicants.length > 1 && d.applicants.some(a => !riskStarted(a.name)) && (
            <div className="text-[12.5px] rounded-lg border border-[#EFD3CB] bg-[#FBEDE9] text-[#8A3A2A] px-3 py-2">
              These questions are asked of <b>every</b> applicant.
              {' '}{d.applicants.filter(a => !riskStarted(a.name)).map(a => a.name).join(' and ')}
              {' '}{d.applicants.filter(a => !riskStarted(a.name)).length === 1 ? 'has' : 'have'} not been started.
            </div>
          )}

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
            <textarea spellCheck="true" className={inp + ' min-h-[80px] resize-y'} value={d.productReqs.otherRequirements}
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

            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-4">
              <label className="text-xs font-medium text-gray-500 block mb-2">Client agreement (captured when moving from LO to Compliance)</label>
              {d.clientAgreedLender ? (
                <div className="text-sm text-[#343333]">
                  {d.clientAgreedLender === 'Yes' ? (
                    <span>✓ Client agreed with the recommended lender ({lo.recommendedLender || 'not yet recommended'})</span>
                  ) : (
                    <div className="space-y-1">
                      <p>Client chose a different lender: <span className="font-medium">{d.clientChosenLender === '__other__' ? d.clientChosenLenderOther : d.clientChosenLender}</span></p>
                      {d.clientChosenLenderReason && <p className="text-gray-500">Reason: {d.clientChosenLenderReason}</p>}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Not yet captured — this is recorded automatically when the deal moves from LO to Compliance.</p>
              )}
            </div>

            {[
              { key: 'analysisComment', label: 'Analysis, assessment & applicant education' },
              { key: 'optionsComment', label: 'Options presented & recommendation' },
              { key: 'borrowingPowerComment', label: 'Borrowing power' },
            ].map(({ key, label }) => (
              <div key={key} className="mb-4">
                <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
                <textarea spellCheck="true" className={inp + ' min-h-[120px] resize-y'} value={(d as any)[key]}
                  onChange={e => setD(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder="Click Generate with AI or type manually..." />
                <AIButton onClick={() => generateField(key)} loading={generating[key]} />
                <button onClick={() => { setFlaggingField(flaggingField === key ? null : key); setFlagNote('') }} className="mt-2 ml-2 text-xs text-gray-400 hover:text-amber-500 underline">Flag an issue</button>
                {flaggingField === key && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <textarea spellCheck="true" className={inp + ' min-h-[60px] resize-y bg-white'} placeholder="What's wrong with this field?" value={flagNote} onChange={e => setFlagNote(e.target.value)} autoFocus />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => submitFlag(key, label)} disabled={flagSubmitting || !flagNote.trim()} className="text-xs bg-amber-500 text-white rounded-lg px-3 py-1.5 hover:bg-amber-600 disabled:opacity-40">{flagSubmitting ? 'Submitting...' : 'Submit flag'}</button>
                      <button onClick={() => { setFlaggingField(null); setFlagNote('') }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  </div>
                )}
                {d.aiMeta?.[key] && (d.aiMeta[key].confidence || d.aiMeta[key].source) && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {d.aiMeta[key].confidence && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        d.aiMeta[key].confidence.toLowerCase().includes('high') ? 'bg-green-50 text-green-600' :
                        d.aiMeta[key].confidence.toLowerCase().includes('low') ? 'bg-red-50 text-red-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>{d.aiMeta[key].confidence} confidence</span>
                    )}
                    {d.aiMeta[key].source && <span className="text-[10px] text-gray-400">Source: {d.aiMeta[key].source}</span>}
                  </div>
                )}
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
                  <textarea spellCheck="true" className={inp + ' min-h-[100px] resize-y'} value={(d as any)[key]}
                    onChange={e => setD(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder="Click Generate..." />
                  <AIButton onClick={() => generateField(key)} loading={generating[key]} />
                <button onClick={() => { setFlaggingField(flaggingField === key ? null : key); setFlagNote('') }} className="mt-2 ml-2 text-xs text-gray-400 hover:text-amber-500 underline">Flag an issue</button>
                {flaggingField === key && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <textarea spellCheck="true" className={inp + ' min-h-[60px] resize-y bg-white'} placeholder="What's wrong with this field?" value={flagNote} onChange={e => setFlagNote(e.target.value)} autoFocus />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => submitFlag(key, label)} disabled={flagSubmitting || !flagNote.trim()} className="text-xs bg-amber-500 text-white rounded-lg px-3 py-1.5 hover:bg-amber-600 disabled:opacity-40">{flagSubmitting ? 'Submitting...' : 'Submit flag'}</button>
                      <button onClick={() => { setFlaggingField(null); setFlagNote('') }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  </div>
                )}
                {d.aiMeta?.[key] && (d.aiMeta[key].confidence || d.aiMeta[key].source) && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {d.aiMeta[key].confidence && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        d.aiMeta[key].confidence.toLowerCase().includes('high') ? 'bg-green-50 text-green-600' :
                        d.aiMeta[key].confidence.toLowerCase().includes('low') ? 'bg-red-50 text-red-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>{d.aiMeta[key].confidence} confidence</span>
                    )}
                    {d.aiMeta[key].source && <span className="text-[10px] text-gray-400">Source: {d.aiMeta[key].source}</span>}
                  </div>
                )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Security (property)</label>
                <textarea spellCheck="true" className={inp + ' min-h-[80px] resize-y'} value={d.securityComment}
                  onChange={e => setD(prev => ({ ...prev, securityComment: e.target.value }))}
                  placeholder="TBA or enter address..." />
                <AIButton onClick={() => generateField('securityComment')} loading={generating['securityComment']} />
                <button onClick={() => { setFlaggingField(flaggingField === 'securityComment' ? null : 'securityComment'); setFlagNote('') }} className="mt-2 ml-2 text-xs text-gray-400 hover:text-amber-500 underline">Flag an issue</button>
                {flaggingField === 'securityComment' && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <textarea spellCheck="true" className={inp + ' min-h-[60px] resize-y bg-white'} placeholder="What's wrong with this field?" value={flagNote} onChange={e => setFlagNote(e.target.value)} autoFocus />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => submitFlag('securityComment', 'Security (property)')} disabled={flagSubmitting || !flagNote.trim()} className="text-xs bg-amber-500 text-white rounded-lg px-3 py-1.5 hover:bg-amber-600 disabled:opacity-40">{flagSubmitting ? 'Submitting...' : 'Submit flag'}</button>
                      <button onClick={() => { setFlaggingField(null); setFlagNote('') }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  </div>
                )}
                {d.aiMeta?.['securityComment'] && (d.aiMeta['securityComment'].confidence || d.aiMeta['securityComment'].source) && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {d.aiMeta['securityComment'].confidence && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        d.aiMeta['securityComment'].confidence.toLowerCase().includes('high') ? 'bg-green-50 text-green-600' :
                        d.aiMeta['securityComment'].confidence.toLowerCase().includes('low') ? 'bg-red-50 text-red-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>{d.aiMeta['securityComment'].confidence} confidence</span>
                    )}
                    {d.aiMeta['securityComment'].source && <span className="text-[10px] text-gray-400">Source: {d.aiMeta['securityComment'].source}</span>}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Application submission notes</label>
                <textarea spellCheck="true" className={inp + ' min-h-[80px] resize-y'} value={d.applicationSubmissionComment}
                  onChange={e => setD(prev => ({ ...prev, applicationSubmissionComment: e.target.value }))}
                  placeholder="Lender-specific notes, broker contact details..." />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              
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
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-[#DC5B5B] bg-white inline-block" />Not answered yet</span>
            </div>
            <div className="flex flex-col gap-2">
              {EXPENSE_CATEGORIES.map(cat => {
                const entry = d.expenses?.[cat.key] || { monthlyAmount: '', splits: {}, comment: '' }
                const hem = hemStateOf(cat, entry)
                const open = hem === 'unanswered'
                return (
                  <div key={cat.key} className={`border rounded-lg p-3 ${
                    open ? 'border-[#F5C2C2] bg-[#FDF0EF]' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 ${
                        open ? 'border-2 border-[#DC5B5B] bg-white'
                        : hem === 'in' ? 'bg-green-500' : 'bg-red-400'}`} />
                      <span className="text-sm font-medium text-[#343333]">{cat.label}</span>
                      {open && <span className="text-[11px] font-semibold text-[#B04A4A]">needs an answer</span>}
                      {/* Only the two rows lenders disagree about. Everything else
                          is settled and shows nothing, so the toggles that ARE
                          here mean something. */}
                      {cat.askHem && (
                        <span className="ml-auto inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
                          {([['', 'Not answered'], ['in', 'In HEM'], ['out', 'Outside HEM']] as const).map(([value, label], vi) => (
                            <button key={label} type="button"
                              onClick={() => setExpenseHem(cat.key, value as HemAnswer | '')}
                              className={`text-[11.5px] px-2.5 py-1 transition ${vi ? 'border-l border-gray-200' : ''} ${
                                (value === '' ? open : entry.hem === value)
                                  ? 'bg-[#343333] text-white font-semibold'
                                  : 'text-[#8a9099] hover:bg-gray-50'}`}>
                              {label}
                            </button>
                          ))}
                        </span>
                      )}
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
            // One reader, in lib/hem.ts, so the dots on the rows and the money in
            // the boxes cannot tell different stories.
            const { all: totalAll, inHem: totalHem, notInHem: totalNotHem, unanswered } =
              hemTotals(EXPENSE_CATEGORIES, d.expenses as any)
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
                {unanswered > 0 && (
                  <div className="mt-3 rounded-lg border border-[#F5C2C2] bg-[#FDF0EF] px-3 py-2 text-[12.5px] text-[#8A3A3A]">
                    {unansweredNote(unanswered)}
                  </div>
                )}
              </div>
            )
          })()}
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
              <button onClick={() => {
                setShowValidation(false)
                if (linkableApplicants.length > 0) {
                  setPositionChoices(Object.fromEntries(linkableApplicants.map((a: any) => [a.id, true])))
                  setShowPositionPrompt(true)
                } else {
                  markComplianceComplete()
                }
              }}
                className="px-4 py-2 text-sm bg-[#343333] text-white rounded-lg font-medium hover:bg-[#2a2a2a]">
                Proceed anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {showPositionPrompt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[460px] shadow-xl">
            <div className="text-base font-semibold mb-1 text-[#343333]">Update client financial position?</div>
            <p className="text-sm text-gray-500 mb-4">This refreshes each applicant's saved assets, liabilities, and properties based on this deal's Fact Find.</p>
            <div className="flex flex-col gap-3 mb-5">
              {linkableApplicants.map((a: any) => (
                <div key={a.id} className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-[#343333]">{a.firstName} {a.lastName}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setPositionChoices(prev => ({ ...prev, [a.id]: true }))}
                      className={`px-3 py-1 text-xs rounded-lg border ${positionChoices[a.id] ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-500'}`}>
                      Yes
                    </button>
                    <button onClick={() => setPositionChoices(prev => ({ ...prev, [a.id]: false }))}
                      className={`px-3 py-1 text-xs rounded-lg border ${positionChoices[a.id] === false ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-500'}`}>
                      No
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={finalizePush}
                className="px-4 py-2 text-sm bg-[#343333] text-white rounded-lg font-medium hover:bg-[#2a2a2a]">
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  )
}
