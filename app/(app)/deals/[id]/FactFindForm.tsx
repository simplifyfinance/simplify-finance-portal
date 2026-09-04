'use client'
import DropZone from '@/components/DropZone'
import SectionHeader from '@/components/SectionHeader'
import { checkedWrite } from '@/lib/checked-write'
import { copyPlan, copyAddresses, recorded } from '@/lib/copy-history'
import { useState, useEffect, useRef } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import AddressAutocomplete from './AddressAutocomplete'
import AbnAutocomplete from './AbnAutocomplete'
import CurrencyInput from './CurrencyInput'
import BankSelect from './BankSelect'

import { seYearTotalFF, calculateSeAssessableIncome } from '@/lib/income-calculations'
import InternalNotes from '@/components/InternalNotes'
import { SELF_EMPLOYED_STRUCTURES, RESIDENCY_STATUSES, OTHER_INCOME_TYPES, ASSET_TYPES, DEPOSIT_SOURCES, optionsFor } from '@/lib/fact-find-options'
import { RELATIONSHIP_STATUSES, needsPartner, partnerOptions, applyRelationship } from '@/lib/relationship'
import { totalHistoryMonths, REQUIRED_HISTORY_MONTHS } from '@/lib/fact-find'
import SaveConflict from '@/components/SaveConflict'
import SaveMerged from '@/components/SaveMerged'
import { newGuard, saveGuarded, mergeMessage } from '@/lib/save-conflict'

function incrementFY(fy: string): string {
  const match = fy.match(/^(\d{4})\/(\d{2})$/)
  if (!match) return fy
  const startYear = parseInt(match[1], 10) + 1
  const endYY = ((startYear + 1) % 100).toString().padStart(2, '0')
  return `${startYear}/${endYY}`
}

type Address = {
  id: string
  address: string
  residentialStatus: string
  isCurrent: boolean
  startDate: string
  endDate: string
  housingExpenseAmount: string
  housingExpenseFrequency: string
}

type Employment = {
  id: string
  isCurrent: boolean
  employmentPriority: string
  employmentBasis: string
  occupation: string
  startDate: string
  endDate: string
  onProbation: boolean
  employerName: string
  employerAbn: string
  employerAcn: string
  employerType: string
  employerAddress: string
  contactPersonName: string
  contactPersonDetails: string
  employmentType: string
  // Sole trader or company. Decides five of the documents on the request list -
  // a sole trader needs personal returns and notices of assessment, a company
  // needs company returns, financials and BAS on top. The fact find could not
  // tell them apart before, so neither could anything downstream.
  selfEmployedStructure: string
}

type Income = {
  id: string
  incomeType: string
  employmentId: string
  grossSalary: string
  grossSalaryFrequency: string
  bonusAmount: string
  bonusFrequency: string
  overtimeEssentialAmount: string
  overtimeEssentialFrequency: string
  overtimeNonEssentialAmount: string
  overtimeNonEssentialFrequency: string
  commissionAmount: string
  commissionFrequency: string
  allowanceAmount: string
  allowanceFrequency: string
  seBusinessName: string
  seAbn: string
  seAssessmentMethod: string
  seGrowthMethod: string
  seGrowthPercentOption: string
  seGrowthPercentCustom: string
  seYear1FY: string
  seYear1Salary: string
  seYear1NetProfit: string
  seYear1Depreciation: string
  seYear1Interest: string
  seYear1Super: string
  seYear1OneOff: string
  seYear1Other: string
  seYear2FY: string
  seYear2Salary: string
  seYear2NetProfit: string
  seYear2Depreciation: string
  seYear2Interest: string
  seYear2Super: string
  seYear2OneOff: string
  seYear2Other: string
  seDirectorSalary: string
  seDirectorSalaryFrequency: string
  seDirectorProfitable: string
  otherIncomeType: string
  otherIncomeAmount: string
}

type FactFindApplicant = {
  id: string
  title: string
  firstName: string
  middleName: string
  lastName: string
  preferredName: string
  previousName: string
  gender: string
  dob: string
  phoneMobile: string
  emailPersonal: string
  // Citizen, resident or on a visa. Non-resident and visa deals carry their own
  // document requirements, and nothing on the fact find could say which.
  residencyStatus: string
  // Who these people are to each other. Printed on the broker notes that go to
  // the lender. The id of the other applicant, never a copy of their name - see
  // lib/relationship.ts.
  relationshipStatus: string
  relatedToApplicantId: string
  addresses: Address[]
  employment: Employment[]
  income: Income[]
  clientId?: string
}

type Asset = {
  id: string
  assetType: string
  description: string
  value: string
  bsb: string
  accountNumber: string
  regNumber: string
  membershipNumber: string
  ownership: Record<string, string>
}

type PropertyLoan = {
  id: string
  lenderName: string
  bsb: string
  accountNumber: string
  mortgageType: string
  limitAmount: string
  balance: string
  interestRate: string
  repaymentAmount: string
  repaymentFrequency: string
  repaymentType: string
  interestOnlyExpiryDate: string
  rateType: string
  loanTermExpiryDate: string
  remainingLoanTermYears: string
  status: string
  ownership: Record<string, string>
}

type FactFindProperty = {
  id: string
  address: string
  ownershipType: string
  futureUse: string
  zoning: string
  propertySubtype: string
  value: string
  valuationMethod: string
  rpDataEstimatedValue: string
  runningCosts: string
  runningCostsFrequency: string
  bodyCorpAmount: string
  bodyCorpFrequency: string
  rentalIncome: string
  rentalIncomeFrequency: string
  ownership: Record<string, string>
  loans: PropertyLoan[]
}

type Liability = {
  id: string
  liabilityType: string
  lenderName: string
  accountNumber: string
  limitAmount: string
  balance: string
  repaymentAmount: string
  repaymentFrequency: string
  status: string
  ownership: Record<string, string>
}

type FactFindData = {
  applicants: FactFindApplicant[]
  assets: Asset[]
  properties: FactFindProperty[]
  liabilities: Liability[]
  dependants: string
  internalNotes: string
  // Where the deposit is coming from. A gift needs a gift letter on file, and
  // this only existed on the BC - by which point the documents have already
  // been asked for.
  depositSource: string
  loanPurpose: string
  goals2Years: string
  goals10Years: string
}

function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

// monthsBetween and totalHistoryMonths used to be written out here as well as
// in lib/fact-find.ts, so the warning on screen and the still-to-confirm list
// could disagree about the same 24 months. One copy. See lib/fact-find.ts.

const defaultAddress = (isCurrent: boolean): Address => ({
  id: uid(), address: '', residentialStatus: '', isCurrent, startDate: '', endDate: '',
  housingExpenseAmount: '', housingExpenseFrequency: 'Weekly'
})

const defaultEmployment = (isCurrent: boolean): Employment => ({
  id: uid(), isCurrent, employmentPriority: 'Primary', employmentBasis: 'Full time', employmentType: 'PAYG', endDate: '',
  occupation: '', startDate: '', onProbation: false, employerName: '', employerAbn: '',
  employerAcn: '', employerType: '', employerAddress: '',
  contactPersonName: '', contactPersonDetails: '', selfEmployedStructure: ''
})

const defaultIncome = (type: string = 'PAYG'): Income => ({
  id: uid(), incomeType: type, employmentId: '',
  grossSalary: '', grossSalaryFrequency: 'Annually',
  bonusAmount: '', bonusFrequency: 'Annually',
  overtimeEssentialAmount: '', overtimeEssentialFrequency: 'Annually',
  overtimeNonEssentialAmount: '', overtimeNonEssentialFrequency: 'Annually',
  commissionAmount: '', commissionFrequency: 'Annually',
  allowanceAmount: '', allowanceFrequency: 'Annually',
  seBusinessName: '', seAbn: '', seAssessmentMethod: 'Last 2 financial years',
  seGrowthMethod: 'average', seGrowthPercentOption: '20', seGrowthPercentCustom: '',
  seYear1FY: '2023/24', seYear1Salary: '', seYear1NetProfit: '',
  seYear1Depreciation: '', seYear1Interest: '', seYear1Super: '', seYear1OneOff: '', seYear1Other: '',
  seYear2FY: '2024/25', seYear2Salary: '', seYear2NetProfit: '',
  seYear2Depreciation: '', seYear2Interest: '', seYear2Super: '', seYear2OneOff: '', seYear2Other: '',
  seDirectorSalary: '', seDirectorSalaryFrequency: 'Annually', seDirectorProfitable: 'Yes',
  otherIncomeType: '', otherIncomeAmount: ''
})

const defaultApplicant = (): FactFindApplicant => ({
  id: uid(), title: '', firstName: '', middleName: '', lastName: '', preferredName: '',
  previousName: '', gender: '', dob: '', phoneMobile: '', emailPersonal: '',
  residencyStatus: '', relationshipStatus: '', relatedToApplicantId: '',
  addresses: [defaultAddress(true)],
  employment: [defaultEmployment(true)],
  income: []
})

const defaultAsset = (): Asset => ({
  id: uid(), assetType: 'Bank account', description: '', value: '',
  bsb: '', accountNumber: '', regNumber: '', membershipNumber: '', ownership: {}
})

const defaultPropertyLoan = (): PropertyLoan => ({
  id: uid(), lenderName: '', bsb: '', accountNumber: '', mortgageType: 'Owner occupied',
  limitAmount: '', balance: '', interestRate: '', repaymentAmount: '', repaymentFrequency: 'Monthly',
  repaymentType: 'Interest only', interestOnlyExpiryDate: '', rateType: 'Variable',
  loanTermExpiryDate: '', remainingLoanTermYears: '30', status: 'Ongoing', ownership: {}
})

const defaultProperty = (): FactFindProperty => ({
  id: uid(), address: '', ownershipType: 'Owner occupied', futureUse: 'Ongoing',
  zoning: 'Residential', propertySubtype: 'Fully detached house', value: '',
  valuationMethod: 'Applicant estimate', rpDataEstimatedValue: '',
  runningCosts: '', runningCostsFrequency: 'Monthly',
  bodyCorpAmount: '', bodyCorpFrequency: 'Monthly',
  rentalIncome: '', rentalIncomeFrequency: 'Weekly',
  ownership: {}, loans: []
})

const defaultLiability = (): Liability => ({
  id: uid(), liabilityType: 'Credit card', lenderName: '', accountNumber: '',
  limitAmount: '', balance: '', repaymentAmount: '', repaymentFrequency: 'Monthly',
  status: 'Remain open', ownership: {}
})

function defaultOwnershipSplit(applicants: FactFindApplicant[]): Record<string, string> {
  const n = applicants.length
  if (n === 0) return {}
  const pct = n === 1 ? '100' : (100 / n).toFixed(2).replace(/\.00$/, '')
  const result: Record<string, string> = {}
  applicants.forEach(a => { result[a.id] = pct })
  return result
}


function OwnershipSplit({ applicants, ownership, onChange }: { applicants: FactFindApplicant[]; ownership: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  return (
    <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${applicants.length}, minmax(0,1fr))` }}>
      {applicants.map(a => (
        <div key={a.id}>
          <label className="text-xs text-gray-500 block mb-1">{a.firstName || 'Applicant'} ownership %</label>
          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF]"
            value={ownership[a.id] || ''} onChange={e => onChange({ ...ownership, [a.id]: e.target.value })} />
        </div>
      ))}
    </div>
  )
}

function OwnershipCheckboxes({ applicants, ownership, onChange, label = 'Responsible for this liability' }: { applicants: FactFindApplicant[]; ownership: Record<string, string>; onChange: (v: Record<string, string>) => void; label?: string }) {
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-2">{label}</label>
      <div className="flex flex-wrap gap-4">
        {applicants.map(a => (
          <label key={a.id} className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={ownership[a.id] === 'Yes'}
              onChange={e => onChange({ ...ownership, [a.id]: e.target.checked ? 'Yes' : '' })}
            />
            {a.firstName || 'Applicant'}
          </label>
        ))}
      </div>
    </div>
  )
}

export default function FactFindForm({ deal, onDataChange, onDealFieldChange, onSaveStatus }: { deal: any; onDataChange?: (d: FactFindData) => void; onDealFieldChange?: (field: string, value: string) => void; onSaveStatus?: (s: { at?: string; error?: string }) => void }) {
  const supabase = createSupabaseBrowser()
  const saveKey = `fact_find_${deal.id}`
  const bc = deal.bc_data || {}

  const getInitialApplicants = (): FactFindApplicant[] => {
    const apps: FactFindApplicant[] = []
    const first = bc.firstName || deal.clients?.first_name || ''
    const last = bc.lastName || deal.clients?.last_name || ''
    if (first || last) {
      const a = defaultApplicant()
      a.firstName = first
      a.lastName = last
      apps.push(a)
    }
    if (bc.joint === 'Yes' && bc.jointFirstName) {
      const a = defaultApplicant()
      a.firstName = bc.jointFirstName
      a.lastName = bc.jointLastName || ''
      apps.push(a)
    }
    return apps.length > 0 ? apps : [defaultApplicant()]
  }

  const initData = (): FactFindData => {
    if (deal?.fact_find_data && Object.keys(deal.fact_find_data).length > 0) {
      return deal.fact_find_data as FactFindData
    }
    return {
      applicants: getInitialApplicants(),
      assets: [],
      properties: [],
      liabilities: [],
      dependants: '0',
      internalNotes: '',
      depositSource: '',
      loanPurpose: '',
      goals2Years: '',
      goals10Years: ''
    }
  }

  const [d, setD] = useState<FactFindData>(initData)
  const [stage, setStage] = useState<'personal' | 'employment' | 'income' | 'assets' | 'properties' | 'liabilities'>('personal')
  const [addIncomeMenuOpen, setAddIncomeMenuOpen] = useState(false)
  const [activeApplicant, setActiveApplicant] = useState(0)
  // Copying an address history across: whether the "this will delete something"
  // question is showing, what was just copied, and what to put back on Undo.
  const [confirmCopy, setConfirmCopy] = useState(false)
  const [copiedCount, setCopiedCount] = useState(0)
  const [undoAddresses, setUndoAddresses] = useState<Address[]>([])
  // Moving to another applicant starts the question again.
  // A fact about a PAIR, so it is written to both. Fabio, 3 Sep 2026:
  // "applicant two, we don't have to worry about it."
  function setRelationship(status: string, partnerId: string) {
    setD(prev => ({ ...prev,
      applicants: applyRelationship(prev.applicants, prev.applicants[activeApplicant]?.id, status, partnerId) }))
  }

  useEffect(() => { setConfirmCopy(false); setCopiedCount(0) }, [activeApplicant])
  const [savedAt, setSavedAt] = useState('')
  const [saveError, setSaveError] = useState('')
  // Mirror save state up to the deal header, which owns the single indicator.
  useEffect(() => { onSaveStatus?.({ at: savedAt, error: saveError }) }, [savedAt, saveError])

  // Whose copy is on screen, and whether writing it would cost anybody
  // anything — the whole decision lives in lib/save-conflict.ts so all four
  // tabs cannot drift into judging it differently.
  const guardRef = useRef(newGuard(deal.fact_find_data))
  // The field both people changed, or null when there is nothing to say.
  const [conflictFields, setConflictFields] = useState<string | null>(null)
  const [mergedNote, setMergedNote] = useState('')

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    // The database is the only store - no localStorage copy.
    onDataChange?.(d)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      ;(async () => {
        const out = await saveGuarded({
          supabase, dealId: deal.id, column: 'fact_find_data', guard: guardRef.current, value: d,
          // Nothing typed here yet and somebody else has saved: take their
          // version rather than telling this person off for looking at a deal.
          // initData returns fact_find_data verbatim, so this is exactly what a
          // fresh load would have put on screen.
          onAdopt: stored => { if (stored) setD(stored as FactFindData) },
          // Somebody else saved different fields while this person was typing.
          // Their fields go on screen without rebuilding the form, so the caret
          // stays where it is and the field being typed into is untouched.
          onMerge: merged => setD(merged as FactFindData),
        })
        // A newer save is already queued behind this one. Saying anything here
        // would be about a payload that has been overtaken.
        if (out.kind === 'superseded') return
        setConflictFields(out.kind === 'conflict' ? out.fields : null)
        if (out.kind === 'error') { console.error('Fact find autosave:', out.message); setSaveError(out.message); return }
        setSaveError('')
        if (out.kind === 'merged') setMergedNote(mergeMessage(out.fields))
        if (out.kind === 'saved' || out.kind === 'merged') setSavedAt(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
      })()
    }, 600)
  }, [d])

  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF]"
  const applicant = d.applicants[activeApplicant]

  function updateApplicant(field: keyof FactFindApplicant, value: any) {
    setD(prev => {
      const apps = [...prev.applicants]
      apps[activeApplicant] = { ...apps[activeApplicant], [field]: value }
      return { ...prev, applicants: apps }
    })
  }

  useEffect(() => {
    if (!applicant) return
    const eligible = applicant.employment.filter(e => e.isCurrent && (e.employmentType === 'PAYG' || e.employmentType === 'Self-employed'))
    const eligibleIds = new Set(eligible.map(e => e.id))
    let income = applicant.income
    let changed = false

    eligible.forEach(emp => {
      const existing = income.find(inc => inc.employmentId === emp.id)
      if (!existing) {
        const orphan = income.find(inc => !inc.employmentId && (inc.incomeType === 'PAYG' || inc.incomeType === 'Self-employed'))
        if (orphan) {
          income = income.map(inc => inc.id === orphan.id ? { ...inc, employmentId: emp.id, incomeType: emp.employmentType } : inc)
          changed = true
        } else {
          // A DERIVED ID, NOT A RANDOM ONE.
          //
          // This row is created by housekeeping, not by a person - it appears
          // the moment somebody opens a fact find where a job has no income line
          // against it. With a random id, two people opening the same deal each
          // invented a DIFFERENT row, so their two copies of the record could
          // never agree and each was told the other had saved underneath them.
          // Derived from the job it belongs to, everybody's housekeeping arrives
          // at exactly the same row and there is nothing to disagree about.
          income = [...income, { ...defaultIncome(emp.employmentType), id: `inc-${emp.id}`, employmentId: emp.id }]
          changed = true
        }
      } else if (existing.incomeType !== emp.employmentType) {
        income = income.map(inc => inc.id === existing.id ? { ...inc, incomeType: emp.employmentType } : inc)
        changed = true
      }
    })

    const filtered = income.filter(inc => !inc.employmentId || eligibleIds.has(inc.employmentId))
    if (filtered.length !== income.length) {
      income = filtered
      changed = true
    }

    if (changed) {
      updateApplicant('income', income)
    }
  }, [applicant?.employment])

  const [extracting, setExtracting] = useState(false)
  const [extractedData, setExtractedData] = useState<any>(null)
  const [showExtractReview, setShowExtractReview] = useState(false)

  async function extractFactFindPdf(file: File) {
    setExtracting(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/extract-fact-find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64 })
      })
      const data = await res.json()
      if (data.error) {
        alert('Extraction failed: ' + data.error)
      } else {
        setExtractedData(data.extracted)
        setShowExtractReview(true)
      }
      await uploadDocument(file)
    } catch (e: any) {
      alert('Error extracting PDF: ' + e.message)
    }
    setExtracting(false)
  }

  function processExtractedAddresses(addresses: any[]) {
    if (!addresses?.length) return [defaultAddress(true)]
    // Only one address can genuinely be "current" - sort by start date (most recent first)
    // and mark just that one current, regardless of what the AI extraction returned.
    const sorted = [...addresses].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
    return sorted.map((addr, i) => ({ ...defaultAddress(i === 0), ...addr, isCurrent: i === 0 }))
  }

  function applyExtractedData() {
    if (!extractedData) return
    setD(prev => {
      const updated = { ...prev }
      if (extractedData.applicants?.length) {
        updated.applicants = extractedData.applicants.map((a: any) => ({
          ...defaultApplicant(),
          ...a,
          addresses: processExtractedAddresses(a.addresses),
          employment: a.employment?.length ? a.employment.map((e: any) => ({ ...defaultEmployment(true), ...e })) : [defaultEmployment(true)],
          income: a.income || []
        }))
      }
      if (extractedData.dependants) updated.dependants = extractedData.dependants
      if (extractedData.assets?.length) updated.assets = extractedData.assets.map((x: any) => ({ ...defaultAsset(), ...x }))
      if (extractedData.properties?.length) updated.properties = extractedData.properties.map((x: any) => ({
        ...defaultProperty(), ...x,
        loans: x.loans?.length ? x.loans.map((l: any) => ({ ...defaultPropertyLoan(), ...l })) : []
      }))
      if (extractedData.liabilities?.length) updated.liabilities = extractedData.liabilities.map((x: any) => ({ ...defaultLiability(), ...x }))
      renameDealForApplicants(updated.applicants)
      return updated
    })
    setShowExtractReview(false)
    setExtractedData(null)
  }

  const [onedriveLink, setOnedriveLink] = useState(deal.onedrive_link || '')
  const [salestrekkerLink, setSalestrekkerLink] = useState(deal.salestrekker_link || '')
  const [salestrekkerBcc, setSalestrekkerBcc] = useState(deal.salestrekker_bcc || '')

  async function saveDealLinks(field: string, value: string) {
    const problem = await checkedWrite(
      supabase.from('deals').update({ [field]: value }).eq('id', deal.id), 'That link')
    if (problem) { setSaveError(problem); return }
    setSaveError('')
    onDealFieldChange?.(field, value)
  }

  const [documents, setDocuments] = useState<any[]>([])
  const [uploadingDoc, setUploadingDoc] = useState(false)

  useEffect(() => {
    supabase.from('deal_documents').select('*').eq('deal_id', deal.id).order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setDocuments(data)
    })
  }, [])

  // Several at a time, one after another so a failure names the file that failed.
  async function uploadDocuments(files: File[]) {
    for (const f of files) await uploadDocument(f)
  }

  async function uploadDocument(file: File) {
    setUploadingDoc(true)
    const filePath = `${deal.id}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('deal-documents').upload(filePath, file)
    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setUploadingDoc(false)
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    const { data: inserted, error: insertError } = await supabase.from('deal_documents').insert({
      deal_id: deal.id,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type,
      uploaded_by: userData?.user?.email || 'unknown'
    }).select().single()
    if (insertError) {
      alert('Error saving document record: ' + insertError.message)
    } else if (inserted) {
      setDocuments(prev => [inserted, ...prev])
    }
    setUploadingDoc(false)
  }

  async function downloadDocument(filePath: string) {
    const { data, error } = await supabase.storage.from('deal-documents').createSignedUrl(filePath, 60)
    if (error) { alert('Error generating download link: ' + error.message); return }
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function deleteDocument(id: string, filePath: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return
    await supabase.storage.from('deal-documents').remove([filePath])
    const problem = await checkedWrite(
      supabase.from('deal_documents').delete().eq('id', id), 'That document')
    // The file itself is already gone from storage. Leaving the row on screen
    // when the row is still in the database is the honest thing to show.
    if (problem) { setSaveError(problem); return }
    setSaveError('')
    setDocuments(prev => prev.filter(doc => doc.id !== id))
  }

  const [showAddApplicantModal, setShowAddApplicantModal] = useState(false)
  const [applicantSearch, setApplicantSearch] = useState('')
  const [existingClients, setExistingClients] = useState<any[]>([])

  useEffect(() => {
    if (showAddApplicantModal && existingClients.length === 0) {
      supabase.from('clients').select('id, first_name, last_name, email, phone').order('last_name').then(({ data }) => {
        if (data) setExistingClients(data)
      })
    }
  }, [showAddApplicantModal])

  async function renameDealForApplicants(applicants: FactFindApplicant[]) {
    const app1 = applicants[0]
    const app2 = applicants[1]
    // First Last & First Last Year - the same format the New deal box uses.
    // This still built the retired underscore name, and stuck the deal type in
    // the middle of it: adding a second applicant renamed a deal back to
    // "Jane_Smith_Purchase_2026" long after that format was dropped. New deals
    // have no deal type at all now, so it would have written the word
    // "Purchase" onto a refinance.
    const person = (f: any, l: any) => [f, l].map(x => String(x || '').trim()).filter(Boolean).join(' ')
    const namePart = (app2 && (app2.firstName || app2.lastName))
      ? [person(app1?.firstName, app1?.lastName), person(app2.firstName, app2.lastName)].filter(Boolean).join(' & ')
      : person(app1?.firstName, app1?.lastName)
    // Keep the year the deal was created in, wherever it sits in the old name.
    const found = String(deal.deal_name || '').match(/(19|20)\d{2}/)
    const year = found ? found[0] : new Date().getFullYear().toString()
    const newDealName = `${namePart} ${year}`.replace(/\s+/g, ' ').trim()
    const problem = await checkedWrite(
      supabase.from('deals').update({ deal_name: newDealName }).eq('id', deal.id), 'The deal name')
    if (problem) { setSaveError(problem); return }
    setSaveError('')
    onDealFieldChange?.('deal_name', newDealName)
  }

  function addApplicant() {
    const updatedApplicants = [...d.applicants, defaultApplicant()]
    setD(prev => ({ ...prev, applicants: updatedApplicants }))
    renameDealForApplicants(updatedApplicants)
    setShowAddApplicantModal(false)
  }

  function addExistingApplicant(client: any) {
    const newApplicant: FactFindApplicant = {
      ...defaultApplicant(),
      firstName: client.first_name || '',
      lastName: client.last_name || '',
      emailPersonal: client.email || '',
      phoneMobile: client.phone || '',
      clientId: client.id,
    }
    const updatedApplicants = [...d.applicants, newApplicant]
    setD(prev => ({ ...prev, applicants: updatedApplicants }))
    renameDealForApplicants(updatedApplicants)
    setShowAddApplicantModal(false)
    setApplicantSearch('')
  }

  function removeApplicant(index: number) {
    if (d.applicants.length <= 1) return
    setD(prev => ({ ...prev, applicants: prev.applicants.filter((_, i) => i !== index) }))
    if (activeApplicant >= index && activeApplicant > 0) setActiveApplicant(activeApplicant - 1)
  }

  function updateAddress(id: string, field: keyof Address, value: any) {
    updateApplicant('addresses', applicant.addresses.map(a => a.id === id ? { ...a, [field]: value } : a))
  }
  function addAddress() {
    updateApplicant('addresses', [...applicant.addresses, defaultAddress(false)])
  }
  function removeAddress(id: string) {
    updateApplicant('addresses', applicant.addresses.filter(a => a.id !== id))
  }

  function updateEmployment(id: string, field: keyof Employment, value: any) {
    updateApplicant('employment', applicant.employment.map(e => e.id === id ? { ...e, [field]: value } : e))
  }
  function addEmployment() {
    updateApplicant('employment', [...applicant.employment, defaultEmployment(false)])
  }
  function addSecondaryEmployment() {
    const secondary = { ...defaultEmployment(true), employmentPriority: 'Secondary' }
    updateApplicant('employment', [...applicant.employment, secondary])
  }
  function removeEmployment(id: string) {
    updateApplicant('employment', applicant.employment.filter(e => e.id !== id))
  }

  function updateIncome(id: string, field: keyof Income, value: any) {
    updateApplicant('income', applicant.income.map(i => i.id === id ? { ...i, [field]: value } : i))
  }
  function addIncome(type: string = 'PAYG') {
    updateApplicant('income', [...applicant.income, defaultIncome(type)])
    setAddIncomeMenuOpen(false)
  }
  function removeIncome(id: string) {
    updateApplicant('income', applicant.income.filter(i => i.id !== id))
  }

  function updateAsset(id: string, field: keyof Asset, value: any) {
    setD(prev => ({ ...prev, assets: prev.assets.map(a => a.id === id ? { ...a, [field]: value } : a) }))
  }
  function addAsset() {
    setD(prev => ({ ...prev, assets: [...prev.assets, { ...defaultAsset(), ownership: defaultOwnershipSplit(prev.applicants) }] }))
  }
  function removeAsset(id: string) {
    setD(prev => ({ ...prev, assets: prev.assets.filter(a => a.id !== id) }))
  }

  function updateProperty(id: string, field: keyof FactFindProperty, value: any) {
    setD(prev => ({ ...prev, properties: prev.properties.map(p => p.id === id ? { ...p, [field]: value } : p) }))
  }
  function addProperty() {
    setD(prev => ({ ...prev, properties: [...prev.properties, { ...defaultProperty(), ownership: defaultOwnershipSplit(prev.applicants) }] }))
  }
  function removeProperty(id: string) {
    setD(prev => ({ ...prev, properties: prev.properties.filter(p => p.id !== id) }))
  }
  function addPropertyLoan(propertyId: string) {
    setD(prev => ({
      ...prev,
      properties: prev.properties.map(p => p.id === propertyId ? { ...p, loans: [...p.loans, { ...defaultPropertyLoan(), ownership: defaultOwnershipSplit(prev.applicants) }] } : p)
    }))
  }
  function updatePropertyLoan(propertyId: string, loanId: string, field: keyof PropertyLoan, value: any) {
    setD(prev => ({
      ...prev,
      properties: prev.properties.map(p => p.id === propertyId
        ? { ...p, loans: p.loans.map(l => l.id === loanId ? { ...l, [field]: value } : l) }
        : p)
    }))
  }
  function removePropertyLoan(propertyId: string, loanId: string) {
    setD(prev => ({
      ...prev,
      properties: prev.properties.map(p => p.id === propertyId ? { ...p, loans: p.loans.filter(l => l.id !== loanId) } : p)
    }))
  }

  function updateLiability(id: string, field: keyof Liability, value: any) {
    setD(prev => ({ ...prev, liabilities: prev.liabilities.map(l => l.id === id ? { ...l, [field]: value } : l) }))
  }
  function addLiability() {
    setD(prev => ({ ...prev, liabilities: [...prev.liabilities, { ...defaultLiability(), ownership: defaultOwnershipSplit(prev.applicants) }] }))
  }
  function removeLiability(id: string) {
    setD(prev => ({ ...prev, liabilities: prev.liabilities.filter(l => l.id !== id) }))
  }

  const stages = ['personal', 'employment', 'income', 'assets', 'properties', 'liabilities'] as const
  const stageLabels = {
    personal: 'Personal & address', employment: 'Employment', income: 'Income',
    assets: 'Other assets', properties: 'Properties', liabilities: 'Liabilities'
  }

  const applicantTabs = (
    <div className="flex gap-2 mb-4 flex-wrap">
      {d.applicants.map((a, i) => (
        <div key={a.id} className="flex items-center">
          <button onClick={() => setActiveApplicant(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${activeApplicant === i ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-400'}`}>
            {a.firstName || `Applicant ${i + 1}`}
          </button>
          {d.applicants.length > 1 && (
            <button onClick={() => removeApplicant(i)} className="ml-1 text-xs text-red-400 hover:text-red-600">✕</button>
          )}
        </div>
      ))}
      <button onClick={() => setShowAddApplicantModal(true)} className="px-4 py-2 rounded-lg text-sm font-medium border border-dashed border-gray-300 text-gray-500 hover:border-gray-400">
        + Add applicant
      </button>

      {showAddApplicantModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAddApplicantModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-[420px] max-h-[80vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-base font-semibold mb-4">Add applicant</div>
            <button onClick={addApplicant} className="w-full text-left px-4 py-3 rounded-lg border border-dashed border-[#2DBEFF] text-[#2DBEFF] hover:bg-blue-50 transition mb-4 text-sm font-medium">
              + New applicant
            </button>
            <p className="text-xs font-medium text-gray-500 mb-2">Or select an existing customer</p>
            <input type="text" placeholder="Search clients..." value={applicantSearch} onChange={e => setApplicantSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2DBEFF] mb-2" />
            <div className="max-h-56 overflow-y-auto flex flex-col gap-1">
              {existingClients
                .filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(applicantSearch.toLowerCase()))
                .map(c => (
                  <div key={c.id} onClick={() => addExistingApplicant(c)}
                    className="px-3 py-2 rounded-lg text-sm cursor-pointer hover:bg-gray-50">
                    <p className="font-medium text-[#343333]">{c.first_name} {c.last_name}</p>
                    {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                  </div>
                ))}
            </div>
            <button onClick={() => setShowAddApplicantModal(false)} className="w-full mt-4 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5 ml-1">
        <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 4-4h1m5-8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm6 4a4 4 0 1 0-8 0" />
        </svg>
        <span className="text-xs text-gray-500 whitespace-nowrap">Dependants</span>
        <input type="number" className="w-12 text-center text-sm border-0 focus:outline-none p-0" value={d.dependants || '0'} onChange={e => setD(prev => ({ ...prev, dependants: e.target.value }))} />
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-[480px_1fr] gap-4 items-start">
      <SaveConflict tab="Fact Find" fields={conflictFields} />
      <SaveMerged message={mergedNote} onDismiss={() => setMergedNote('')} />
      <div>
        {/* One notes field for the whole deal. This used to be a box of its own
            saving to fact_find_data.internalNotes, with two more like it on BC
            and Lending Options and none at all on Compliance. */}
        <InternalNotes dealId={deal.id} initial={deal.internal_notes || ''} />

        {showExtractReview && extractedData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowExtractReview(false)}>
          <div className="bg-white rounded-2xl p-6 w-[480px] max-h-[80vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-base font-semibold mb-1">Review extracted data</div>
            <p className="text-xs text-gray-400 mb-4">Check this looks right before applying — you can fine-tune any field afterwards in the normal form.</p>

            {extractedData.applicants?.map((a: any, i: number) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 mb-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">Applicant {i + 1}</p>
                <p className="text-sm text-[#343333]">{a.firstName} {a.lastName}{a.dob ? ` · DOB ${a.dob}` : ''}</p>
                {(a.phoneMobile || a.emailPersonal) && <p className="text-xs text-gray-400">{a.phoneMobile}{a.phoneMobile && a.emailPersonal ? ' · ' : ''}{a.emailPersonal}</p>}
                {a.employment?.[0]?.employerName && <p className="text-xs text-gray-500 mt-1">{a.employment[0].occupation} at {a.employment[0].employerName}</p>}
                {a.income?.[0]?.grossSalary && <p className="text-xs text-gray-500">Income: ${a.income[0].grossSalary} {a.income[0].grossSalaryFrequency}</p>}
                {a.addresses?.[0]?.address && <p className="text-xs text-gray-500">{a.addresses[0].address}</p>}
              </div>
            ))}

            {extractedData.assets?.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">Assets ({extractedData.assets.length})</p>
                {extractedData.assets.map((x: any, i: number) => (
                  <p key={i} className="text-xs text-gray-500">{x.assetType}{x.description ? ` — ${x.description}` : ''}{x.value ? ` — $${x.value}` : ''}</p>
                ))}
              </div>
            )}

            {extractedData.properties?.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">Properties ({extractedData.properties.length})</p>
                {extractedData.properties.map((x: any, i: number) => (
                  <div key={i} className="mb-1">
                    <p className="text-xs text-gray-500">{x.address || 'Address not found'}{x.ownershipType ? ` — ${x.ownershipType}` : ''}{x.value ? ` — $${x.value}` : ''}</p>
                    {x.loans?.map((l: any, li: number) => (
                      <p key={li} className="text-xs text-gray-400 ml-3">↳ {l.lenderName || 'Lender not found'}{l.balance ? ` — balance $${l.balance}` : ''}{l.limitAmount ? ` — limit $${l.limitAmount}` : ''}</p>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {extractedData.liabilities?.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">Liabilities ({extractedData.liabilities.length})</p>
                {extractedData.liabilities.map((x: any, i: number) => (
                  <p key={i} className="text-xs text-gray-500">{x.liabilityType}{x.lenderName ? ` (${x.lenderName})` : ''}{x.balance ? ` — balance $${x.balance}` : ''}{x.limitAmount ? ` — limit $${x.limitAmount}` : ''}</p>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={applyExtractedData} className="flex-1 px-4 py-2 text-sm bg-[#2DBEFF] text-white rounded-lg font-medium hover:opacity-90">
                Apply to Fact Find
              </button>
              <button onClick={() => { setShowExtractReview(false); setExtractedData(null) }} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="mb-4">
            <DropZone compact multiple={false} accept="application/pdf" busy={extracting}
              title={extracting ? 'Extracting…' : 'Drop the fact find PDF here'}
              hint="AI will extract the client details"
              onFiles={files => { if (files[0]) extractFactFindPdf(files[0]) }} />
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Attached documents</span>
            <label className={`text-xs text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-2.5 py-1 hover:bg-blue-50 transition cursor-pointer ${uploadingDoc ? 'opacity-40 pointer-events-none' : ''}`}>
              {uploadingDoc ? 'Uploading...' : '+ Add'}
              <input type="file" multiple className="hidden"
                onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length) uploadDocuments(fs) }} />
            </label>
          </div>
          <p className="text-xs text-gray-400 mb-2">Fact finds, screenshots, rate sheets.</p>
          <div className="mb-2">
            <DropZone compact busy={uploadingDoc}
              title="Drop documents here"
              hint="as many at once as you like"
              onFiles={files => uploadDocuments(files)} />
          </div>
          {documents.length === 0 ? (
            <p className="text-xs text-gray-300">No documents yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-2.5 py-1.5">
                  <button onClick={() => downloadDocument(doc.file_path)} className="text-xs text-[#343333] hover:text-[#2DBEFF] truncate text-left flex-1">
                    {doc.file_name}
                  </button>
                  <button onClick={() => deleteDocument(doc.id, doc.file_path)} className="text-xs text-gray-300 hover:text-red-400 ml-2 flex-shrink-0">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2">Deal links</span>
          <label className="text-xs text-gray-500 block mb-1">OneDrive folder</label>
          <input type="text" className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2"
            value={onedriveLink} onChange={e => setOnedriveLink(e.target.value)}
            onBlur={() => saveDealLinks('onedrive_link', onedriveLink)}
            placeholder="Paste OneDrive folder URL..." />
          <label className="text-xs text-gray-500 block mb-1">SalesTrekker card</label>
          <input type="text" className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2"
            value={salestrekkerLink} onChange={e => setSalestrekkerLink(e.target.value)}
            onBlur={() => saveDealLinks('salestrekker_link', salestrekkerLink)}
            placeholder="Paste SalesTrekker deal URL..." />
          <label className="text-xs text-gray-500 block mb-1">SalesTrekker BCC code</label>
          <input type="text" className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5"
            value={salestrekkerBcc} onChange={e => setSalestrekkerBcc(e.target.value)}
            onBlur={() => saveDealLinks('salestrekker_bcc', salestrekkerBcc)}
            placeholder="e.g. deal-12345@salestrekker.com" />
        </div>
      </div>

      <div className="space-y-4">
      <div className="flex bg-white border border-gray-100 rounded-xl p-1 gap-1 flex-wrap">
        {stages.map(s => (
          <button key={s} onClick={() => setStage(s)}
            className={`flex-1 min-w-[110px] py-2 rounded-lg text-xs font-medium transition ${stage === s ? 'bg-[#343333] text-white' : 'text-gray-400 hover:text-gray-600'}`}>
            {stageLabels[s]}
          </button>
        ))}
      </div>

      {(stage === 'personal' || stage === 'employment' || stage === 'income') && applicantTabs}

      {stage === 'personal' && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Purpose and goals</div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Where is the deposit coming from?</label>
              <select className={inp} value={d.depositSource || ''}
                onChange={e => setD(prev => ({ ...prev, depositSource: e.target.value }))}>
                <option value="">Select</option>
                {optionsFor(d.depositSource, DEPOSIT_SOURCES).map(x => <option key={x}>{x}</option>)}
              </select>
              {d.depositSource === 'Gift' && (
                <p className="text-[11.5px] text-[#8A6218] mt-1 mb-0">A gift letter will be needed on file.</p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Purpose of loan / primary reason for finance</label>
              <textarea spellCheck="true" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF] min-h-16 resize-y" placeholder="What the client told you they want this loan for..." value={d.loanPurpose} onChange={e => setD(prev => ({ ...prev, loanPurpose: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Goals — next 2 years</label>
              <textarea spellCheck="true" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF] min-h-16 resize-y" placeholder="Client's own stated short-term plans..." value={d.goals2Years} onChange={e => setD(prev => ({ ...prev, goals2Years: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Goals — 2 to 10 years</label>
              <textarea spellCheck="true" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF] min-h-16 resize-y" placeholder="Client's own stated long-term plans..." value={d.goals10Years} onChange={e => setD(prev => ({ ...prev, goals10Years: e.target.value }))} />
            </div>
          </div>
        </div>
      )}

      {stage === 'personal' && applicant && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <SectionHeader title="Personal details" />
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Title</label>
              <select className={inp} value={applicant.title} onChange={e => updateApplicant('title', e.target.value)}>
                <option value="">— select —</option>
                <option value="Mr">Mr</option>
                <option value="Mrs">Mrs</option>
                <option value="Ms">Ms</option>
                <option value="Miss">Miss</option>
                <option value="Dr">Dr</option>
                <option value="Prof">Prof</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">First name</label>
              <input className={inp} value={applicant.firstName} onChange={e => updateApplicant('firstName', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Middle name</label>
              <input className={inp} value={applicant.middleName} onChange={e => updateApplicant('middleName', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Last name</label>
              <input className={inp} value={applicant.lastName} onChange={e => updateApplicant('lastName', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Preferred name</label>
              <input className={inp} value={applicant.preferredName} onChange={e => updateApplicant('preferredName', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Previous name</label>
              <input className={inp} value={applicant.previousName} onChange={e => updateApplicant('previousName', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Gender</label>
              <select className={inp} value={applicant.gender} onChange={e => updateApplicant('gender', e.target.value)}>
                <option value="">Select</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date of birth</label>
              <input type="date" className={inp} value={applicant.dob} onChange={e => updateApplicant('dob', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Phone mobile</label>
              <input className={inp} value={applicant.phoneMobile} onChange={e => updateApplicant('phoneMobile', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Email</label>
              <input className={inp} value={applicant.emailPersonal} onChange={e => updateApplicant('emailPersonal', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Residency status</label>
              <select className={inp} value={applicant.residencyStatus || ''} onChange={e => updateApplicant('residencyStatus', e.target.value)}>
                <option value="">Select</option>
                {optionsFor(applicant.residencyStatus, RESIDENCY_STATUSES).map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
            {/* WHO THESE PEOPLE ARE TO EACH OTHER. Printed on the broker notes
                that go to the lender, under "Relationship of applicants". */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Relationship status</label>
              <select className={inp} value={applicant.relationshipStatus || ''}
                onChange={e => setRelationship(e.target.value, applicant.relatedToApplicantId || '')}>
                <option value="">Select</option>
                {optionsFor(applicant.relationshipStatus, RELATIONSHIP_STATUSES).map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
            {/* Only for a status that is about somebody else, and only when
                there is somebody else on the deal to name. */}
            {needsPartner(applicant.relationshipStatus) && d.applicants.length > 1 && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  {applicant.relationshipStatus} to
                </label>
                <select className={inp + (applicant.relatedToApplicantId ? '' : ' border-amber-300 bg-[#FFFBF0]')}
                  value={applicant.relatedToApplicantId || ''}
                  onChange={e => setRelationship(applicant.relationshipStatus, e.target.value)}>
                  <option value="">Select</option>
                  {partnerOptions(d.applicants, applicant.id).map(o => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Recorded on both of them, so you do not have to answer it twice.
                </p>
              </div>
            )}
          </div>

          <SectionHeader title="Address history" />
          {/* COPYING THE ADDRESS HISTORY ACROSS.
              This was a bare "Copy address from Applicant 1" that named nobody,
              said nothing about what it would do, and replaced whatever was
              already typed with no warning and no undo. It now names the person,
              says how many addresses are coming, asks before deleting anything,
              and can be undone. See lib/copy-history.ts. */}
          {activeApplicant > 0 && (() => {
            const primary = d.applicants[0]
            if (!primary) return null
            const who = primary.firstName || 'Applicant 1'
            const plan = copyPlan(primary.addresses, applicant.addresses)
            const months = totalHistoryMonths(recorded(primary.addresses) as any)
            const span = months >= 24 ? ` covering ${Math.floor(months / 12)} years`
              : months > 0 ? ` covering ${months} months` : ''
            const doCopy = () => {
              setUndoAddresses(applicant.addresses)
              updateApplicant('addresses', copyAddresses(primary.addresses, uid))
              setConfirmCopy(false)
              setCopiedCount(recorded(primary.addresses).length)
            }

            if (copiedCount > 0) return (
              <div className="border border-[#BFE3CC] bg-[#EFF9F2] rounded-lg px-3.5 py-2.5 mb-3 flex items-center gap-2.5 flex-wrap">
                <span className="text-[13px] text-[#15803D]">
                  <b className="text-[#0F5C33]">Copied {copiedCount} {copiedCount === 1 ? 'address' : 'addresses'} from {who}.</b>
                  {' '}Edit anything below that is different for {applicant.firstName || 'this applicant'}.
                </span>
                <button
                  onClick={() => { updateApplicant('addresses', undoAddresses); setCopiedCount(0) }}
                  className="ml-auto text-[12.5px] text-[#3E4C59] border border-[#D7DCE1] bg-white rounded-md px-2.5 py-1">
                  Undo
                </button>
              </div>
            )

            if (plan.kind === 'nothing') return (
              <div className="border border-[#E1E5E9] bg-[#F4F6F8] rounded-lg px-3.5 py-2.5 mb-3 text-[12.5px] text-[#5B646D]">
                Nothing to copy yet — {who} has no addresses recorded either. Fill in {who}&rsquo;s first
                if they live together.
              </div>
            )

            if (plan.kind === 'replace' && confirmCopy) return (
              <div className="border border-[#EBD9BE] bg-[#FDF6E7] rounded-lg px-3.5 py-3 mb-3 text-[13px] text-[#8A6218]">
                <b className="text-[#141C24]">
                  {applicant.firstName || 'This applicant'} already has {plan.removing.length}
                  {' '}{plan.removing.length === 1 ? 'address' : 'addresses'} recorded.
                </b><br />
                Copying {who}&rsquo;s {plan.count} will replace {plan.removing.length === 1 ? 'it' : 'them'}.
                {' '}{plan.removing.length === 1 ? 'The address' : 'The addresses'} currently here —{' '}
                <b className="text-[#141C24]">{plan.removing.join(', ')}</b> — will be removed.
                <div className="flex gap-2 flex-wrap mt-2.5">
                  <button onClick={doCopy}
                    className="bg-[#B23A34] border border-[#B23A34] text-white rounded-lg px-3 py-1.5 text-[12.5px] font-semibold">
                    Replace {plan.removing.length === 1 ? 'it' : 'them'} with {who}&rsquo;s
                  </button>
                  <button onClick={() => setConfirmCopy(false)}
                    className="bg-white border border-[#D7DCE1] text-[#3E4C59] rounded-lg px-3 py-1.5 text-[12.5px]">
                    Keep what is here
                  </button>
                </div>
              </div>
            )

            return (
              <div className="border border-[#CBE7F8] bg-[#EAF6FD] rounded-lg px-3.5 py-3 mb-3">
                <div className="text-[13px] text-[#0B5E8A] mb-2.5">
                  <b className="text-[#141C24]">
                    Does {applicant.firstName || 'this applicant'} live at the same addresses as {who}?
                  </b><br />
                  {who} has {plan.count} {plan.count === 1 ? 'address' : 'addresses'} recorded{span}.
                  Copying brings {plan.count === 1 ? 'it' : 'them all'} across, and you can edit
                  {plan.count === 1 ? ' it' : ' any of them'} afterwards.
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <button onClick={() => (plan.kind === 'replace' ? setConfirmCopy(true) : doCopy())}
                    className="bg-[#141C24] border border-[#141C24] text-white rounded-lg px-3 py-1.5 text-[12.5px] font-semibold hover:bg-[#28323c]">
                    Copy {plan.count} {plan.count === 1 ? 'address' : 'addresses'} from {who}
                  </button>
                  <span className="text-[11.5px] text-[#7C8894]">or fill them in below</span>
                </div>
              </div>
            )
          })()}
          {applicant.addresses.map((addr, i) => (
            <div key={addr.id} className="border border-gray-100 rounded-lg p-3 mb-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-gray-500">{addr.isCurrent ? 'Current address' : `Previous address #${i}`}</span>
                {applicant.addresses.length > 1 && (
                  <button onClick={() => removeAddress(addr.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <AddressAutocomplete className={inp + ' col-span-2'} value={addr.address} onChange={v => updateAddress(addr.id, 'address', v)} />
                <select className={inp} value={addr.residentialStatus} onChange={e => updateAddress(addr.id, 'residentialStatus', e.target.value)}>
                  <option value="">Residential status</option>
                  <option>Renting</option>
                  <option>Owner</option>
                  <option>Boarding</option>
                  <option>Living with family</option>
                </select>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">{addr.isCurrent ? 'Move-in date' : 'Start date'}</label>
                  <input type="date" className={inp} value={addr.startDate} onChange={e => updateAddress(addr.id, 'startDate', e.target.value)} />
                </div>
                {!addr.isCurrent && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">End date</label>
                    <input type="date" className={inp} value={addr.endDate} onChange={e => updateAddress(addr.id, 'endDate', e.target.value)} />
                  </div>
                )}
              </div>
              {addr.isCurrent && addr.residentialStatus && addr.residentialStatus !== 'Owner' && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      {addr.residentialStatus === 'Renting' && 'Rent amount'}
                      {addr.residentialStatus === 'Boarding' && 'Board amount'}
                      {addr.residentialStatus === 'Living with family' && 'Housing expense (optional)'}
                    </label>
                    <CurrencyInput className={inp} value={addr.housingExpenseAmount} onChange={val => updateAddress(addr.id, 'housingExpenseAmount', val)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Frequency</label>
                    <select className={inp} value={addr.housingExpenseFrequency} onChange={e => updateAddress(addr.id, 'housingExpenseFrequency', e.target.value)}>
                      <option>Weekly</option>
                      <option>Monthly</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
          {totalHistoryMonths(applicant.addresses) < REQUIRED_HISTORY_MONTHS && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 mb-2">
              {totalHistoryMonths(applicant.addresses)} months of address history recorded — add a previous address to reach the required {REQUIRED_HISTORY_MONTHS} months.
            </div>
          )}
          <button onClick={addAddress} className="text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition">
            + Add previous address
          </button>
        </div>
      )}

      {stage === 'employment' && applicant && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
          <SectionHeader title={`Employment — ${applicant.firstName || 'applicant'}`} />
          {applicant.employment.map((emp, i) => (
            <div key={emp.id} className="border border-gray-100 rounded-lg p-4 mb-2">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-medium text-gray-500">{emp.isCurrent ? 'Current employer' : `Previous employer #${i}`}</span>
                {applicant.employment.length > 1 && (
                  <button onClick={() => removeEmployment(emp.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <select className={inp} value={emp.employmentPriority} onChange={e => updateEmployment(emp.id, 'employmentPriority', e.target.value)}>
                  <option>Primary</option><option>Secondary</option>
                </select>
                <select className={inp} value={emp.employmentType} onChange={e => updateEmployment(emp.id, 'employmentType', e.target.value)}>
                  <option value="PAYG">PAYG</option>
                  <option value="Self-employed">Self-employed</option>
                  <option value="Not working">Not working</option>
                </select>
                {emp.employmentType === 'PAYG' && (
                  <select className={inp} value={emp.employmentBasis} onChange={e => updateEmployment(emp.id, 'employmentBasis', e.target.value)}>
                    <option>Full time</option><option>Part time</option><option>Casual</option>
                  </select>
                )}
                {emp.employmentType === 'Self-employed' && (
                  <select className={inp} value={emp.selfEmployedStructure || ''}
                    onChange={e => updateEmployment(emp.id, 'selfEmployedStructure', e.target.value)}>
                    <option value="">Structure — sole trader or company?</option>
                    {optionsFor(emp.selfEmployedStructure, SELF_EMPLOYED_STRUCTURES).map(x => <option key={x}>{x}</option>)}
                  </select>
                )}
                {emp.employmentType !== 'Not working' && (
                  <input className={inp} placeholder="Occupation" value={emp.occupation} onChange={e => updateEmployment(emp.id, 'occupation', e.target.value)} />
                )}
              </div>
              {/* THE DATES BELONG TO EVERY KIND OF ENTRY, INCLUDING NOT WORKING.
                  These used to sit inside the "not Not working" branch with the
                  employer fields, so a period of not working carried no dates,
                  counted as nought months, and the 24-month warning sat at
                  "0 months of employment history recorded" with no way to
                  satisfy it. Fabio, 3 Sep 2026: "when someone is not working
                  there's no date, we need to establish 24 months of history not
                  working as well."
                  A lender wants two years of history whatever it consists of.
                  What does NOT apply to a period of not working is the employer,
                  the ABN and the probation tick - those stay hidden. */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    {emp.employmentType === 'Not working' ? 'Not working since' : 'Start date'}
                  </label>
                  <input type="date" className={inp + (emp.startDate ? '' : ' border-amber-300 bg-[#FFFBF0]')}
                    value={emp.startDate} onChange={e => updateEmployment(emp.id, 'startDate', e.target.value)} />
                </div>
                {!emp.isCurrent && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">End date</label>
                    <input type="date" className={inp} value={emp.endDate} onChange={e => updateEmployment(emp.id, 'endDate', e.target.value)} />
                  </div>
                )}
                {emp.employmentType !== 'Not working' && (
                  <>
                    <input className={inp} placeholder="Employer / business name" value={emp.employerName} onChange={e => updateEmployment(emp.id, 'employerName', e.target.value)} />
                    <AbnAutocomplete
                      value={emp.employerAbn}
                      onChange={val => updateEmployment(emp.id, 'employerAbn', val)}
                      onSelect={result => {
                        updateEmployment(emp.id, 'employerAbn', result.abn)
                        updateEmployment(emp.id, 'employerName', result.businessName)
                      }}
                    />
                  </>
                )}
              </div>
              {emp.employmentType !== 'Not working' && (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {emp.employmentType === 'PAYG' && (
                      <select className={inp} value={emp.employerType} onChange={e => updateEmployment(emp.id, 'employerType', e.target.value)}>
                        <option value="">Employer type</option><option>Public</option><option>Private</option>
                      </select>
                    )}
                    <input className={inp} placeholder="Employer address" value={emp.employerAddress} onChange={e => updateEmployment(emp.id, 'employerAddress', e.target.value)} />
                  </div>
                  <label className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                    <input type="checkbox" checked={emp.onProbation} onChange={e => updateEmployment(emp.id, 'onProbation', e.target.checked)} />
                    On probation
                  </label>
                </>
              )}
            </div>
          ))}
          {/* TWO YEARS, WHATEVER IT IS MADE OF.
              A period of not working counts, and so does the job before it.
              Fabio, 3 Sep 2026, on an applicant who stopped work twelve months
              ago: "make sure you ask for previous employment, though." Twelve
              months of not working is twelve months of history and twelve months
              short - so the line says how short, and what covers the rest. */}
          {(() => {
            // 'Secondary' rather than 'Primary' so an older record with no
            // priority set still counts towards its own history.
            const primary = applicant.employment.filter(e => e.employmentPriority !== 'Secondary')
            const months = totalHistoryMonths(primary)
            if (months >= REQUIRED_HISTORY_MONTHS) return null
            const short = REQUIRED_HISTORY_MONTHS - months
            const mth = (n: number) => `${n} ${n === 1 ? 'month' : 'months'}`
            const current = primary.find(e => e.isCurrent)
            const idle = current && current.employmentType === 'Not working' && current.startDate
              ? totalHistoryMonths([current]) : 0
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 mb-2">
                <b>{mth(months)} of the {REQUIRED_HISTORY_MONTHS} a lender needs.</b>{' '}
                {idle > 0
                  ? <>Not working accounts for {mth(idle)} of that. Add the employment
                     before that to cover the remaining {mth(short)}.</>
                  : <>Add previous employment to cover the remaining {mth(short)}.</>}
              </div>
            )
          })()}
          <div className="flex gap-2">
            <button onClick={addSecondaryEmployment} className="text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition">
              + Add secondary employment
            </button>
            <button onClick={addEmployment} className="text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition">
              + Add previous employment
            </button>
          </div>
        </div>
      )}

      {stage === 'income' && applicant && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
          <SectionHeader title={`Income — ${applicant.firstName || 'applicant'}`} />
          {applicant.income.map(inc => (
            <div key={inc.id} className="border border-gray-100 rounded-lg p-4 mb-2">
              <div className="flex justify-between items-center mb-3">
                <select className="text-xs font-medium text-gray-500 border-0" value={inc.incomeType} onChange={e => updateIncome(inc.id, 'incomeType', e.target.value)}>
                  <option value="PAYG">PAYG income</option>
                  <option value="Self-employed">Self-employed income</option>
                  <option value="Other taxable">Other taxable income</option>
                  <option value="Other non-taxable">Other non-taxable income</option>
                </select>
                {applicant.income.length > 1 && (
                  <button onClick={() => removeIncome(inc.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                )}
              </div>
              {inc.incomeType === 'PAYG' && (
                <select className={inp + ' mb-3'} value={inc.employmentId} onChange={e => updateIncome(inc.id, 'employmentId', e.target.value)}>
                  <option value="">Linked employer</option>
                  {applicant.employment.map(e => <option key={e.id} value={e.id}>{e.employerName || 'Unnamed employer'}</option>)}
                </select>
              )}
              {inc.incomeType === 'Self-employed' && (
                <div className="mb-3 space-y-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <div className="text-xs text-gray-500 mb-1">Business (from Employment tab)</div>
                    <div className="font-medium">
                      {applicant.employment.find(e => e.id === inc.employmentId)?.employerName || 'Not linked \u2014 set business details on the Employment tab'}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      ABN: {applicant.employment.find(e => e.id === inc.employmentId)?.employerAbn || '\u2014'}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Assessment method</label>
                    <select className={inp} value={inc.seAssessmentMethod} onChange={e => updateIncome(inc.id, 'seAssessmentMethod', e.target.value)}>
                      <option value="Last 2 financial years">Last 2 financial years</option>
                      <option value="One year in isolation">One year in isolation</option>
                      <option value="Director's salary">Director's salary</option>
                    </select>
                  </div>

                  {inc.seAssessmentMethod === 'Last 2 financial years' && (
                    <div className="mb-3">
                      <label className="text-xs text-gray-500 block mb-1">Income calculation method</label>
                      <select className={inp} value={inc.seGrowthMethod} onChange={e => updateIncome(inc.id, 'seGrowthMethod', e.target.value)}>
                        <option value="average">Average of the Last Two Years</option>
                        <option value="latest_lower">Latest Year Because Lower Than Previous Year</option>
                        <option value="previous_plus_growth">Previous Year Plus Growth Percentage</option>
                      </select>
                      {inc.seGrowthMethod === 'previous_plus_growth' && (
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <select className={inp} value={inc.seGrowthPercentOption} onChange={e => updateIncome(inc.id, 'seGrowthPercentOption', e.target.value)}>
                            <option value="20">20%</option>
                            <option value="50">50%</option>
                            <option value="Other">Other</option>
                          </select>
                          {inc.seGrowthPercentOption === 'Other' && (
                            <input className={inp} type="number" placeholder="Custom %" value={inc.seGrowthPercentCustom} onChange={e => updateIncome(inc.id, 'seGrowthPercentCustom', e.target.value)} />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {Number.isNaN(calculateSeAssessableIncome(inc)) ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                      <div className="text-sm font-semibold text-red-700">Latest year not lower</div>
                      <div className="text-xs text-red-500 mt-1">FY {inc.seYear2FY} (${Math.round(seYearTotalFF(inc, 2)).toLocaleString()}) is not lower than FY {inc.seYear1FY} (${Math.round(seYearTotalFF(inc, 1)).toLocaleString()}). Choose a different calculation method.</div>
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3">
                      <div className="text-xs text-gray-500 mb-1">Assessable income (calculated)</div>
                      <div className="text-sm font-semibold text-gray-800">
                        ${Math.round(calculateSeAssessableIncome(inc)).toLocaleString()} p.a.
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {inc.seAssessmentMethod === 'Last 2 financial years' && inc.seGrowthMethod === 'average' && `FY ${inc.seYear1FY}: $${Math.round(seYearTotalFF(inc, 1)).toLocaleString()} + FY ${inc.seYear2FY}: $${Math.round(seYearTotalFF(inc, 2)).toLocaleString()}, averaged`}
                        {inc.seAssessmentMethod === 'Last 2 financial years' && inc.seGrowthMethod === 'latest_lower' && `Using FY ${inc.seYear2FY}: $${Math.round(seYearTotalFF(inc, 2)).toLocaleString()}`}
                        {inc.seAssessmentMethod === 'Last 2 financial years' && inc.seGrowthMethod === 'previous_plus_growth' && `FY ${inc.seYear1FY}: $${Math.round(seYearTotalFF(inc, 1)).toLocaleString()} + ${inc.seGrowthPercentOption === 'Other' ? inc.seGrowthPercentCustom : inc.seGrowthPercentOption}% growth`}
                        {inc.seAssessmentMethod === 'One year in isolation' && `FY ${inc.seYear1FY} total, including add-backs`}
                        {inc.seAssessmentMethod === "Director's salary" && `Director's salary, annualized`}
                      </div>
                    </div>
                  )}

                  {(inc.seAssessmentMethod === 'Last 2 financial years' || inc.seAssessmentMethod === 'One year in isolation') && (
                    <div className="space-y-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium text-gray-600">Financial year 1</span>
                          <select className="text-xs border border-gray-200 rounded px-2 py-1" value={inc.seYear1FY} onChange={e => {
                            const newYear1 = e.target.value
                            updateApplicant('income', applicant.income.map(i => i.id === inc.id ? { ...i, seYear1FY: newYear1, seYear2FY: incrementFY(newYear1) } : i))
                          }}>
                            <option>2021/22</option><option>2022/23</option><option>2023/24</option><option>2024/25</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-2">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Salary</label>
                            <CurrencyInput className={inp} value={inc.seYear1Salary} onChange={val => updateIncome(inc.id, 'seYear1Salary', val)} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Net profit</label>
                            <CurrencyInput className={inp} value={inc.seYear1NetProfit} onChange={val => updateIncome(inc.id, 'seYear1NetProfit', val)} />
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mb-1">Add backs</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Depreciation</label>
                            <CurrencyInput className={inp} value={inc.seYear1Depreciation} onChange={val => updateIncome(inc.id, 'seYear1Depreciation', val)} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Interest on business loans</label>
                            <CurrencyInput className={inp} value={inc.seYear1Interest} onChange={val => updateIncome(inc.id, 'seYear1Interest', val)} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Superannuation</label>
                            <CurrencyInput className={inp} value={inc.seYear1Super} onChange={val => updateIncome(inc.id, 'seYear1Super', val)} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">One-off expenses</label>
                            <CurrencyInput className={inp} value={inc.seYear1OneOff} onChange={val => updateIncome(inc.id, 'seYear1OneOff', val)} />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-gray-400 block mb-1">Other add backs</label>
                            <CurrencyInput className={inp} value={inc.seYear1Other} onChange={val => updateIncome(inc.id, 'seYear1Other', val)} />
                          </div>
                        </div>
                      </div>

                      {inc.seAssessmentMethod === 'Last 2 financial years' && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-medium text-gray-600">Financial year 2</span>
                            <select className="text-xs border border-gray-200 rounded px-2 py-1" value={inc.seYear2FY} onChange={e => updateIncome(inc.id, 'seYear2FY', e.target.value)}>
                              <option>2024/25</option><option>2023/24</option><option>2022/23</option><option>2021/22</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Salary</label>
                              <CurrencyInput className={inp} value={inc.seYear2Salary} onChange={val => updateIncome(inc.id, 'seYear2Salary', val)} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Net profit</label>
                              <CurrencyInput className={inp} value={inc.seYear2NetProfit} onChange={val => updateIncome(inc.id, 'seYear2NetProfit', val)} />
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mb-1">Add backs</div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Depreciation</label>
                              <CurrencyInput className={inp} value={inc.seYear2Depreciation} onChange={val => updateIncome(inc.id, 'seYear2Depreciation', val)} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Interest on business loans</label>
                              <CurrencyInput className={inp} value={inc.seYear2Interest} onChange={val => updateIncome(inc.id, 'seYear2Interest', val)} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Superannuation</label>
                              <CurrencyInput className={inp} value={inc.seYear2Super} onChange={val => updateIncome(inc.id, 'seYear2Super', val)} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">One-off expenses</label>
                              <CurrencyInput className={inp} value={inc.seYear2OneOff} onChange={val => updateIncome(inc.id, 'seYear2OneOff', val)} />
                            </div>
                            <div className="col-span-2">
                              <label className="text-xs text-gray-400 block mb-1">Other add backs</label>
                              <CurrencyInput className={inp} value={inc.seYear2Other} onChange={val => updateIncome(inc.id, 'seYear2Other', val)} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {inc.seAssessmentMethod === "Director's salary" && (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Salary amount</label>
                        <CurrencyInput className={inp} value={inc.seDirectorSalary} onChange={val => updateIncome(inc.id, 'seDirectorSalary', val)} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Frequency</label>
                        <select className={inp} value={inc.seDirectorSalaryFrequency} onChange={e => updateIncome(inc.id, 'seDirectorSalaryFrequency', e.target.value)}>
                          <option>Weekly</option><option>Fortnightly</option><option>Monthly</option><option>Annually</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Business profitable?</label>
                        <select className={inp} value={inc.seDirectorProfitable} onChange={e => updateIncome(inc.id, 'seDirectorProfitable', e.target.value)}>
                          <option>Yes</option><option>No</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {(inc.incomeType === 'Other taxable' || inc.incomeType === 'Other non-taxable') && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Income type</label>
                    {/* Typed by hand, this could never be counted or acted on -
                        "centrelink", "Centrelink FTB" and "family tax" were three
                        different things to everything downstream. Anything already
                        typed is kept and still offered; see optionsFor(). */}
                    <select className={inp} value={inc.otherIncomeType || ''}
                      onChange={e => updateIncome(inc.id, 'otherIncomeType', e.target.value)}>
                      <option value="">Select</option>
                      {optionsFor(inc.otherIncomeType, OTHER_INCOME_TYPES).map(x => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Annual income</label>
                    <CurrencyInput className={inp} value={inc.otherIncomeAmount} onChange={val => updateIncome(inc.id, 'otherIncomeAmount', val)} />
                  </div>
                </div>
              )}
              {inc.incomeType === 'PAYG' && (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-2">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Gross salary</label>
                      <CurrencyInput className={inp} value={inc.grossSalary} onChange={val => updateIncome(inc.id, 'grossSalary', val)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Frequency</label>
                      <select className={inp} value={inc.grossSalaryFrequency} onChange={e => updateIncome(inc.id, 'grossSalaryFrequency', e.target.value)}>
                        <option>Weekly</option><option>Fortnightly</option><option>Monthly</option><option>Annually</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Bonus</label>
                      <CurrencyInput className={inp} value={inc.bonusAmount} onChange={val => updateIncome(inc.id, 'bonusAmount', val)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Overtime essential</label>
                      <CurrencyInput className={inp} value={inc.overtimeEssentialAmount} onChange={val => updateIncome(inc.id, 'overtimeEssentialAmount', val)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Overtime non-essential</label>
                      <CurrencyInput className={inp} value={inc.overtimeNonEssentialAmount} onChange={val => updateIncome(inc.id, 'overtimeNonEssentialAmount', val)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Commission</label>
                      <CurrencyInput className={inp} value={inc.commissionAmount} onChange={val => updateIncome(inc.id, 'commissionAmount', val)} />
                    </div>
                  </div>
                  <div className="mt-2 w-1/4">
                    <label className="text-xs text-gray-500 block mb-1">Allowance</label>
                    <CurrencyInput className={inp} value={inc.allowanceAmount} onChange={val => updateIncome(inc.id, 'allowanceAmount', val)} />
                  </div>
                </>
              )}
            </div>
          ))}
          <div className="relative inline-block">
            <button onClick={() => setAddIncomeMenuOpen(!addIncomeMenuOpen)} className="text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition">
              + Add income source
            </button>
            {addIncomeMenuOpen && (
              <div className="absolute z-10 mt-1 bg-white border border-gray-100 rounded-lg shadow-md w-56 overflow-hidden">
                <button onClick={() => addIncome('PAYG')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 border-b border-gray-50">PAYG income</button>
                <button onClick={() => addIncome('Self-employed')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 border-b border-gray-50">Self-employed income</button>
                <button onClick={() => addIncome('Other taxable')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 border-b border-gray-50">Other taxable income</button>
                <button onClick={() => addIncome('Other non-taxable')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Other non-taxable income</button>
              </div>
            )}
          </div>
        </div>
      )}

      {stage === 'assets' && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
          <SectionHeader title="Other assets" />
          {d.assets.map(asset => (
            <div key={asset.id} className="border border-gray-100 rounded-lg p-4 mb-2">
              <div className="flex justify-between items-center mb-3">
                <select className="text-xs font-medium text-gray-500 border-0" value={asset.assetType} onChange={e => updateAsset(asset.id, 'assetType', e.target.value)}>
                  {optionsFor(asset.assetType, ASSET_TYPES).map(x => <option key={x}>{x}</option>)}
                </select>
                <button onClick={() => removeAsset(asset.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {asset.assetType === 'Bank account' && (
                  <BankSelect className={inp} value={asset.description} onChange={v => updateAsset(asset.id, 'description', v)} />
                )}
                {asset.assetType === 'Super' && (
                  <input className={inp} placeholder="Fund Name" value={asset.description} onChange={e => updateAsset(asset.id, 'description', e.target.value)} />
                )}
                {asset.assetType === 'Shares' && (
                  <input className={inp} placeholder="Holding — company or fund" value={asset.description} onChange={e => updateAsset(asset.id, 'description', e.target.value)} />
                )}
                {asset.assetType === 'Vehicle' && (
                  <input className={inp} placeholder="Description" value={asset.description} onChange={e => updateAsset(asset.id, 'description', e.target.value)} />
                )}
                {asset.assetType === 'Other' && (
                  <input className={inp} placeholder="Description" value={asset.description} onChange={e => updateAsset(asset.id, 'description', e.target.value)} />
                )}
                <CurrencyInput className={inp} placeholder="Value" value={asset.value} onChange={v => updateAsset(asset.id, 'value', v)} />
              </div>
              <OwnershipCheckboxes applicants={d.applicants} ownership={asset.ownership} onChange={v => updateAsset(asset.id, 'ownership', v)} label="Owned by" />
            </div>
          ))}
          <button onClick={addAsset} className="text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition">
            + Add asset
          </button>
        </div>
      )}

      {stage === 'properties' && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
          <SectionHeader title="Properties" />
          {d.properties.map(prop => (
            <div key={prop.id} className="border border-gray-100 rounded-lg p-4 mb-3">
              <div className="flex justify-between items-center mb-3">
                <select className="text-xs font-medium text-gray-500 border-0" value={prop.ownershipType} onChange={e => updateProperty(prop.id, 'ownershipType', e.target.value)}>
                  <option>Owner occupied</option><option>Investment</option>
                </select>
                <button onClick={() => removeProperty(prop.id)} className="text-xs text-red-400 hover:text-red-600">Remove property</button>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <AddressAutocomplete className={inp + ' col-span-2'} value={prop.address} onChange={v => updateProperty(prop.id, 'address', v)} />
                <CurrencyInput className={inp} placeholder="Value" value={prop.value} onChange={val => updateProperty(prop.id, 'value', val)} />
              </div>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <select className={inp} value={prop.zoning} onChange={e => updateProperty(prop.id, 'zoning', e.target.value)}>
                  <option>Residential</option><option>Commercial</option><option>Rural</option>
                </select>
                <select className={inp} value={prop.propertySubtype} onChange={e => updateProperty(prop.id, 'propertySubtype', e.target.value)}>
                  <option value="">Property type</option>
                  <option>House</option>
                  <option>Unit</option>
                  <option>Townhouse</option>
                  <option>Land</option>
                  <option>Commercial</option>
                  <option>Rural</option>
                  <option>Other</option>
                </select>
                <select className={inp} value={prop.futureUse} onChange={e => updateProperty(prop.id, 'futureUse', e.target.value)}>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Will become investment">Will become investment after settlement</option>
                  <option value="Will become owner occupied">Will become owner occupied after settlement</option>
                  <option value="To be sold">To be sold</option>
                </select>
                {prop.ownershipType !== 'Owner occupied' && (
                  <CurrencyInput className={inp} placeholder="Rental income (weekly)" value={prop.rentalIncome} onChange={val => updateProperty(prop.id, 'rentalIncome', val)} />
                )}
              </div>
              {(prop.propertySubtype === 'Unit' || prop.propertySubtype === 'Townhouse') && (
                <div className="mb-3 w-1/4">
                  <CurrencyInput className={inp} placeholder="Strata costs (quarterly)" value={prop.bodyCorpAmount} onChange={val => updateProperty(prop.id, 'bodyCorpAmount', val)} />
                </div>
              )}
              <div className="mb-3 w-1/3">
                <CurrencyInput className={inp} placeholder="Running costs (monthly)" value={prop.runningCosts} onChange={val => updateProperty(prop.id, 'runningCosts', val)} />
              </div>
              <OwnershipSplit applicants={d.applicants} ownership={prop.ownership} onChange={v => updateProperty(prop.id, 'ownership', v)} />

              <div className="mt-4 bg-[#F2E8DB]/40 rounded-lg p-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Linked loans</div>
                {prop.loans.map(loan => (
                  <div key={loan.id} className="border border-gray-100 bg-white rounded-lg p-3 mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-gray-500">{loan.lenderName || 'New loan'}</span>
                      <button onClick={() => removePropertyLoan(prop.id, loan.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mb-2">
                      <BankSelect className={inp} value={loan.lenderName} onChange={v => updatePropertyLoan(prop.id, loan.id, 'lenderName', v)} />
                      <input className={inp} placeholder="BSB" value={loan.bsb} onChange={e => updatePropertyLoan(prop.id, loan.id, 'bsb', e.target.value)} />
                      <input className={inp} placeholder="Account number" value={loan.accountNumber} onChange={e => updatePropertyLoan(prop.id, loan.id, 'accountNumber', e.target.value)} />
                      <input className={inp} placeholder="Interest rate %" value={loan.interestRate} onChange={e => updatePropertyLoan(prop.id, loan.id, 'interestRate', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-4 gap-3 mb-2">
                      <CurrencyInput className={inp} placeholder="Limit" value={loan.limitAmount} onChange={val => updatePropertyLoan(prop.id, loan.id, 'limitAmount', val)} />
                      <CurrencyInput className={inp} placeholder="Balance" value={loan.balance} onChange={val => updatePropertyLoan(prop.id, loan.id, 'balance', val)} />
                      <CurrencyInput className={inp} placeholder="Repayment" value={loan.repaymentAmount} onChange={val => updatePropertyLoan(prop.id, loan.id, 'repaymentAmount', val)} />
                      <select className={inp} value={loan.repaymentType} onChange={e => updatePropertyLoan(prop.id, loan.id, 'repaymentType', e.target.value)}>
                        <option>Interest only</option><option>Principal and interest</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <select className={inp} value={loan.rateType} onChange={e => updatePropertyLoan(prop.id, loan.id, 'rateType', e.target.value)}>
                        <option>Variable</option><option>Fixed</option>
                      </select>
                      <input type="date" className={inp} placeholder="Interest only expiry" value={loan.interestOnlyExpiryDate} onChange={e => updatePropertyLoan(prop.id, loan.id, 'interestOnlyExpiryDate', e.target.value)} />
                      <select className={inp} value={loan.remainingLoanTermYears} onChange={e => updatePropertyLoan(prop.id, loan.id, 'remainingLoanTermYears', e.target.value)}>
                        {Array.from({ length: 40 }, (_, i) => i + 1).map(y => <option key={y} value={y}>{y} year{y > 1 ? 's' : ''}</option>)}
                      </select>
                      <select className={inp} value={loan.status} onChange={e => updatePropertyLoan(prop.id, loan.id, 'status', e.target.value)}>
                        <option value="Ongoing">Ongoing</option><option value="Refinance">Refinance</option><option value="To be paid out">To be paid out</option>
                      </select>
                    </div>
                    <OwnershipSplit applicants={d.applicants} ownership={loan.ownership} onChange={v => updatePropertyLoan(prop.id, loan.id, 'ownership', v)} />
                  </div>
                ))}
                <button onClick={() => addPropertyLoan(prop.id)} className="text-xs text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition">
                  + Add loan against this property
                </button>
              </div>
            </div>
          ))}
          <button onClick={addProperty} className="text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition">
            + Add property
          </button>
        </div>
      )}

      {stage === 'liabilities' && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
          <SectionHeader title="Liabilities" badge="excludes property-linked loans" />
          {d.liabilities.map(liab => (
            <div key={liab.id} className="border border-gray-100 rounded-lg p-4 mb-2">
              <div className="flex justify-between items-center mb-3">
                <select className="text-xs font-medium text-gray-500 border-0" value={liab.liabilityType} onChange={e => updateLiability(liab.id, 'liabilityType', e.target.value)}>
                  <option>Credit card</option><option>Car loan</option><option>Personal loan</option><option>HECS</option><option>Health Insurance</option><option>Other</option>
                </select>
                <button onClick={() => removeLiability(liab.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
              </div>
              {liab.liabilityType === 'HECS' && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <CurrencyInput className={inp} placeholder="Balance" value={liab.balance} onChange={val => updateLiability(liab.id, 'balance', val)} />
                  <select className={inp} value={liab.status} onChange={e => updateLiability(liab.id, 'status', e.target.value)}>
                    <option value="Remain open">Remain open</option><option value="To be refinanced">To be refinanced</option><option value="To be closed">To be closed</option><option value="To be consolidated">To be consolidated</option>
                  </select>
                </div>
              )}
              {liab.liabilityType === 'Health Insurance' && (
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <CurrencyInput className={inp} placeholder="Value" value={liab.repaymentAmount} onChange={val => updateLiability(liab.id, 'repaymentAmount', val)} />
                  <select className={inp} value={liab.repaymentFrequency} onChange={e => updateLiability(liab.id, 'repaymentFrequency', e.target.value)}>
                    <option>Monthly</option><option>Fortnightly</option><option>Weekly</option>
                  </select>
                  <select className={inp} value={liab.status} onChange={e => updateLiability(liab.id, 'status', e.target.value)}>
                    <option value="Remain open">Remain open</option><option value="To be refinanced">To be refinanced</option><option value="To be closed">To be closed</option><option value="To be consolidated">To be consolidated</option>
                  </select>
                </div>
              )}
              {liab.liabilityType === 'Credit card' && (
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <BankSelect className={inp} value={liab.lenderName} onChange={v => updateLiability(liab.id, 'lenderName', v)} />
                  <CurrencyInput className={inp} placeholder="Credit limit" value={liab.limitAmount} onChange={val => updateLiability(liab.id, 'limitAmount', val)} />
                  <CurrencyInput className={inp} placeholder="Current balance" value={liab.balance} onChange={val => updateLiability(liab.id, 'balance', val)} />
                  <select className={inp} value={liab.status} onChange={e => updateLiability(liab.id, 'status', e.target.value)}>
                    <option value="Remain open">Remain open</option><option value="To be refinanced">To be refinanced</option><option value="To be closed">To be closed</option><option value="To be consolidated">To be consolidated</option>
                  </select>
                </div>
              )}
              {(liab.liabilityType === 'Car loan' || liab.liabilityType === 'Personal loan' || liab.liabilityType === 'Other') && (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <BankSelect className={inp} value={liab.lenderName} onChange={v => updateLiability(liab.id, 'lenderName', v)} />
                    <CurrencyInput className={inp} placeholder="Balance" value={liab.balance} onChange={val => updateLiability(liab.id, 'balance', val)} />
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <CurrencyInput className={inp} placeholder="Repayment" value={liab.repaymentAmount} onChange={val => updateLiability(liab.id, 'repaymentAmount', val)} />
                    <select className={inp} value={liab.repaymentFrequency} onChange={e => updateLiability(liab.id, 'repaymentFrequency', e.target.value)}>
                      <option>Monthly</option><option>Fortnightly</option><option>Weekly</option>
                    </select>
                    <select className={inp} value={liab.status} onChange={e => updateLiability(liab.id, 'status', e.target.value)}>
                      <option value="Remain open">Remain open</option><option value="To be refinanced">To be refinanced</option><option value="To be closed">To be closed</option><option value="To be consolidated">To be consolidated</option>
                    </select>
                  </div>
                </>
              )}
              <OwnershipCheckboxes applicants={d.applicants} ownership={liab.ownership} onChange={v => updateLiability(liab.id, 'ownership', v)} />
            </div>
          ))}
          <button onClick={addLiability} className="text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition">
            + Add liability
          </button>
        </div>
      )}

      
      </div>
    </div>
  )
}
