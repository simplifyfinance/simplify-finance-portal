'use client'
import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import AddressAutocomplete from './AddressAutocomplete'
import AbnAutocomplete from './AbnAutocomplete'

type Address = {
  id: string
  address: string
  residentialStatus: string
  isCurrent: boolean
  startDate: string
}

type Employment = {
  id: string
  isCurrent: boolean
  employmentPriority: string
  employmentBasis: string
  occupation: string
  startDate: string
  onProbation: boolean
  employerName: string
  employerAbn: string
  employerAcn: string
  employerType: string
  employerAddress: string
  contactPersonName: string
  contactPersonDetails: string
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
  addresses: Address[]
  employment: Employment[]
  income: Income[]
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
}

function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

const defaultAddress = (isCurrent: boolean): Address => ({
  id: uid(), address: '', residentialStatus: '', isCurrent, startDate: ''
})

const defaultEmployment = (isCurrent: boolean): Employment => ({
  id: uid(), isCurrent, employmentPriority: 'Primary', employmentBasis: 'Full time',
  occupation: '', startDate: '', onProbation: false, employerName: '', employerAbn: '',
  employerAcn: '', employerType: '', employerAddress: '',
  contactPersonName: '', contactPersonDetails: ''
})

const defaultIncome = (): Income => ({
  id: uid(), incomeType: 'PAYG', employmentId: '',
  grossSalary: '', grossSalaryFrequency: 'Annually',
  bonusAmount: '', bonusFrequency: 'Annually',
  overtimeEssentialAmount: '', overtimeEssentialFrequency: 'Annually',
  overtimeNonEssentialAmount: '', overtimeNonEssentialFrequency: 'Annually',
  commissionAmount: '', commissionFrequency: 'Annually',
  allowanceAmount: '', allowanceFrequency: 'Annually',
  seBusinessName: '', seAbn: '', seAssessmentMethod: 'Last 2 financial years',
  seYear1FY: '2024/25', seYear1Salary: '', seYear1NetProfit: '',
  seYear1Depreciation: '', seYear1Interest: '', seYear1Super: '', seYear1OneOff: '', seYear1Other: '',
  seYear2FY: '2023/24', seYear2Salary: '', seYear2NetProfit: '',
  seYear2Depreciation: '', seYear2Interest: '', seYear2Super: '', seYear2OneOff: '', seYear2Other: '',
  seDirectorSalary: '', seDirectorSalaryFrequency: 'Annually', seDirectorProfitable: 'Yes'
})

const defaultApplicant = (): FactFindApplicant => ({
  id: uid(), title: '', firstName: '', middleName: '', lastName: '', preferredName: '',
  previousName: '', gender: '', dob: '', phoneMobile: '', emailPersonal: '',
  addresses: [defaultAddress(true)],
  employment: [defaultEmployment(true)],
  income: [defaultIncome()]
})

const defaultAsset = (): Asset => ({
  id: uid(), assetType: 'Bank account', description: '', value: '',
  bsb: '', accountNumber: '', regNumber: '', membershipNumber: '', ownership: {}
})

const defaultPropertyLoan = (): PropertyLoan => ({
  id: uid(), lenderName: '', bsb: '', accountNumber: '', mortgageType: 'Owner occupied',
  limitAmount: '', balance: '', interestRate: '', repaymentAmount: '', repaymentFrequency: 'Monthly',
  repaymentType: 'Interest only', interestOnlyExpiryDate: '', rateType: 'Variable',
  loanTermExpiryDate: '', status: 'Ongoing', ownership: {}
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
  status: 'Ongoing', ownership: {}
})

function defaultOwnershipSplit(applicants: FactFindApplicant[]): Record<string, string> {
  const n = applicants.length
  if (n === 0) return {}
  const pct = n === 1 ? '100' : (100 / n).toFixed(2).replace(/\.00$/, '')
  const result: Record<string, string> = {}
  applicants.forEach(a => { result[a.id] = pct })
  return result
}

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">{title}</span>
      {badge && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded font-medium">{badge}</span>}
    </div>
  )
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

export default function FactFindForm({ deal, onDataChange }: { deal: any; onDataChange?: (d: FactFindData) => void }) {
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
    const saved = typeof window !== 'undefined' ? localStorage.getItem(saveKey) : null
    if (saved) return JSON.parse(saved)
    return {
      applicants: getInitialApplicants(),
      assets: [],
      properties: [],
      liabilities: []
    }
  }

  const [d, setD] = useState<FactFindData>(initData)
  const [stage, setStage] = useState<'personal' | 'employment' | 'income' | 'assets' | 'properties' | 'liabilities'>('personal')
  const [activeApplicant, setActiveApplicant] = useState(0)
  const [savedAt, setSavedAt] = useState('')

  useEffect(() => {
    supabase.from('deals').select('fact_find_data').eq('id', deal.id).single().then(({ data }) => {
      if (data?.fact_find_data && Object.keys(data.fact_find_data).length > 0) {
        setD(data.fact_find_data as FactFindData)
      }
    })
  }, [])

  useEffect(() => {
    localStorage.setItem(saveKey, JSON.stringify(d))
    supabase.from('deals').update({ fact_find_data: d }).eq('id', deal.id).then(() => {})
    setSavedAt(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
    onDataChange?.(d)
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

  function addApplicant() {
    setD(prev => ({ ...prev, applicants: [...prev.applicants, defaultApplicant()] }))
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
  function removeEmployment(id: string) {
    updateApplicant('employment', applicant.employment.filter(e => e.id !== id))
  }

  function updateIncome(id: string, field: keyof Income, value: any) {
    updateApplicant('income', applicant.income.map(i => i.id === id ? { ...i, [field]: value } : i))
  }
  function addIncome() {
    updateApplicant('income', [...applicant.income, defaultIncome()])
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
      <button onClick={addApplicant} className="px-4 py-2 rounded-lg text-sm font-medium border border-dashed border-gray-300 text-gray-500 hover:border-gray-400">
        + Add applicant
      </button>
    </div>
  )

  return (
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

      {stage === 'personal' && applicant && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <SectionHeader title="Personal details" />
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Title</label>
              <input className={inp} value={applicant.title} onChange={e => updateApplicant('title', e.target.value)} />
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
              <input className={inp} value={applicant.gender} onChange={e => updateApplicant('gender', e.target.value)} />
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
          </div>

          <SectionHeader title="Address history" />
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
                <input type="date" className={inp} value={addr.startDate} onChange={e => updateAddress(addr.id, 'startDate', e.target.value)} />
              </div>
            </div>
          ))}
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
                <select className={inp} value={emp.employmentBasis} onChange={e => updateEmployment(emp.id, 'employmentBasis', e.target.value)}>
                  <option>Full time</option><option>Part time</option><option>Casual</option>
                </select>
                <input className={inp} placeholder="Occupation" value={emp.occupation} onChange={e => updateEmployment(emp.id, 'occupation', e.target.value)} />
                <input type="date" className={inp} value={emp.startDate} onChange={e => updateEmployment(emp.id, 'startDate', e.target.value)} />
              </div>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <input className={inp} placeholder="Employer name" value={emp.employerName} onChange={e => updateEmployment(emp.id, 'employerName', e.target.value)} />
                <input className={inp} placeholder="ABN" value={emp.employerAbn} onChange={e => updateEmployment(emp.id, 'employerAbn', e.target.value)} />
                <input className={inp} placeholder="ACN" value={emp.employerAcn} onChange={e => updateEmployment(emp.id, 'employerAcn', e.target.value)} />
                <select className={inp} value={emp.employerType} onChange={e => updateEmployment(emp.id, 'employerType', e.target.value)}>
                  <option value="">Employer type</option><option>Public</option><option>Private</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <input className={inp} placeholder="Employer address" value={emp.employerAddress} onChange={e => updateEmployment(emp.id, 'employerAddress', e.target.value)} />
              </div>
              <label className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                <input type="checkbox" checked={emp.onProbation} onChange={e => updateEmployment(emp.id, 'onProbation', e.target.checked)} />
                On probation
              </label>
            </div>
          ))}
          <button onClick={addEmployment} className="text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition">
            + Add previous employment
          </button>
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
                  <option value="Rental">Rental income</option>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Business name</label>
                      <input className={inp} value={inc.seBusinessName} onChange={e => updateIncome(inc.id, 'seBusinessName', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">ABN</label>
                      <AbnAutocomplete
                        value={inc.seAbn}
                        onChange={val => updateIncome(inc.id, 'seAbn', val)}
                        onSelect={result => {
                          updateIncome(inc.id, 'seAbn', result.abn)
                          updateIncome(inc.id, 'seBusinessName', result.businessName)
                        }}
                      />
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

                  {(inc.seAssessmentMethod === 'Last 2 financial years' || inc.seAssessmentMethod === 'One year in isolation') && (
                    <div className="space-y-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium text-gray-600">Financial year 1</span>
                          <select className="text-xs border border-gray-200 rounded px-2 py-1" value={inc.seYear1FY} onChange={e => updateIncome(inc.id, 'seYear1FY', e.target.value)}>
                            <option>2024/25</option><option>2023/24</option><option>2022/23</option><option>2021/22</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-2">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Salary</label>
                            <input className={inp} value={inc.seYear1Salary} onChange={e => updateIncome(inc.id, 'seYear1Salary', e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Net profit</label>
                            <input className={inp} value={inc.seYear1NetProfit} onChange={e => updateIncome(inc.id, 'seYear1NetProfit', e.target.value)} />
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mb-1">Add backs</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Depreciation</label>
                            <input className={inp} value={inc.seYear1Depreciation} onChange={e => updateIncome(inc.id, 'seYear1Depreciation', e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Interest on business loans</label>
                            <input className={inp} value={inc.seYear1Interest} onChange={e => updateIncome(inc.id, 'seYear1Interest', e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Superannuation</label>
                            <input className={inp} value={inc.seYear1Super} onChange={e => updateIncome(inc.id, 'seYear1Super', e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">One-off expenses</label>
                            <input className={inp} value={inc.seYear1OneOff} onChange={e => updateIncome(inc.id, 'seYear1OneOff', e.target.value)} />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-gray-400 block mb-1">Other add backs</label>
                            <input className={inp} value={inc.seYear1Other} onChange={e => updateIncome(inc.id, 'seYear1Other', e.target.value)} />
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
                              <input className={inp} value={inc.seYear2Salary} onChange={e => updateIncome(inc.id, 'seYear2Salary', e.target.value)} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Net profit</label>
                              <input className={inp} value={inc.seYear2NetProfit} onChange={e => updateIncome(inc.id, 'seYear2NetProfit', e.target.value)} />
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mb-1">Add backs</div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Depreciation</label>
                              <input className={inp} value={inc.seYear2Depreciation} onChange={e => updateIncome(inc.id, 'seYear2Depreciation', e.target.value)} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Interest on business loans</label>
                              <input className={inp} value={inc.seYear2Interest} onChange={e => updateIncome(inc.id, 'seYear2Interest', e.target.value)} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Superannuation</label>
                              <input className={inp} value={inc.seYear2Super} onChange={e => updateIncome(inc.id, 'seYear2Super', e.target.value)} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">One-off expenses</label>
                              <input className={inp} value={inc.seYear2OneOff} onChange={e => updateIncome(inc.id, 'seYear2OneOff', e.target.value)} />
                            </div>
                            <div className="col-span-2">
                              <label className="text-xs text-gray-400 block mb-1">Other add backs</label>
                              <input className={inp} value={inc.seYear2Other} onChange={e => updateIncome(inc.id, 'seYear2Other', e.target.value)} />
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
                        <input className={inp} value={inc.seDirectorSalary} onChange={e => updateIncome(inc.id, 'seDirectorSalary', e.target.value)} />
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
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Gross salary</label>
                  <input className={inp} value={inc.grossSalary} onChange={e => updateIncome(inc.id, 'grossSalary', e.target.value)} />
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
                  <input className={inp} value={inc.bonusAmount} onChange={e => updateIncome(inc.id, 'bonusAmount', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Overtime essential</label>
                  <input className={inp} value={inc.overtimeEssentialAmount} onChange={e => updateIncome(inc.id, 'overtimeEssentialAmount', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Overtime non-essential</label>
                  <input className={inp} value={inc.overtimeNonEssentialAmount} onChange={e => updateIncome(inc.id, 'overtimeNonEssentialAmount', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Commission</label>
                  <input className={inp} value={inc.commissionAmount} onChange={e => updateIncome(inc.id, 'commissionAmount', e.target.value)} />
                </div>
              </div>
              <div className="mt-2 w-1/4">
                <label className="text-xs text-gray-500 block mb-1">Allowance</label>
                <input className={inp} value={inc.allowanceAmount} onChange={e => updateIncome(inc.id, 'allowanceAmount', e.target.value)} />
              </div>
            </div>
          ))}
          <button onClick={addIncome} className="text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition">
            + Add income source
          </button>
        </div>
      )}

      {stage === 'assets' && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
          <SectionHeader title="Other assets" />
          {d.assets.map(asset => (
            <div key={asset.id} className="border border-gray-100 rounded-lg p-4 mb-2">
              <div className="flex justify-between items-center mb-3">
                <select className="text-xs font-medium text-gray-500 border-0" value={asset.assetType} onChange={e => updateAsset(asset.id, 'assetType', e.target.value)}>
                  <option>Bank account</option><option>Vehicle</option><option>Home content</option><option>Super</option><option>Other</option>
                </select>
                <button onClick={() => removeAsset(asset.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <input className={inp} placeholder="Description" value={asset.description} onChange={e => updateAsset(asset.id, 'description', e.target.value)} />
                <input className={inp} placeholder="Value" value={asset.value} onChange={e => updateAsset(asset.id, 'value', e.target.value)} />
                {asset.assetType === 'Bank account' && (
                  <input className={inp} placeholder="BSB" value={asset.bsb} onChange={e => updateAsset(asset.id, 'bsb', e.target.value)} />
                )}
                {asset.assetType === 'Vehicle' && (
                  <input className={inp} placeholder="Reg. number" value={asset.regNumber} onChange={e => updateAsset(asset.id, 'regNumber', e.target.value)} />
                )}
                {asset.assetType === 'Super' && (
                  <input className={inp} placeholder="Membership number" value={asset.membershipNumber} onChange={e => updateAsset(asset.id, 'membershipNumber', e.target.value)} />
                )}
              </div>
              <OwnershipSplit applicants={d.applicants} ownership={asset.ownership} onChange={v => updateAsset(asset.id, 'ownership', v)} />
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
                <input className={inp} placeholder="Value" value={prop.value} onChange={e => updateProperty(prop.id, 'value', e.target.value)} />
              </div>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <select className={inp} value={prop.zoning} onChange={e => updateProperty(prop.id, 'zoning', e.target.value)}>
                  <option>Residential</option><option>Commercial</option><option>Rural</option>
                </select>
                <input className={inp} placeholder="Property type" value={prop.propertySubtype} onChange={e => updateProperty(prop.id, 'propertySubtype', e.target.value)} />
                <select className={inp} value={prop.futureUse} onChange={e => updateProperty(prop.id, 'futureUse', e.target.value)}>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Will become investment">Will become investment after settlement</option>
                  <option value="Will become owner occupied">Will become owner occupied after settlement</option>
                  <option value="To be sold">To be sold</option>
                </select>
                {prop.ownershipType === 'Owner occupied' ? (
                  <input className={inp} placeholder="Body corp (monthly)" value={prop.bodyCorpAmount} onChange={e => updateProperty(prop.id, 'bodyCorpAmount', e.target.value)} />
                ) : (
                  <input className={inp} placeholder="Rental income (weekly)" value={prop.rentalIncome} onChange={e => updateProperty(prop.id, 'rentalIncome', e.target.value)} />
                )}
              </div>
              <div className="mb-3 w-1/3">
                <input className={inp} placeholder="Running costs (monthly)" value={prop.runningCosts} onChange={e => updateProperty(prop.id, 'runningCosts', e.target.value)} />
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
                      <input className={inp} placeholder="Bank" value={loan.lenderName} onChange={e => updatePropertyLoan(prop.id, loan.id, 'lenderName', e.target.value)} />
                      <input className={inp} placeholder="BSB" value={loan.bsb} onChange={e => updatePropertyLoan(prop.id, loan.id, 'bsb', e.target.value)} />
                      <input className={inp} placeholder="Account number" value={loan.accountNumber} onChange={e => updatePropertyLoan(prop.id, loan.id, 'accountNumber', e.target.value)} />
                      <input className={inp} placeholder="Interest rate %" value={loan.interestRate} onChange={e => updatePropertyLoan(prop.id, loan.id, 'interestRate', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-4 gap-3 mb-2">
                      <input className={inp} placeholder="Limit" value={loan.limitAmount} onChange={e => updatePropertyLoan(prop.id, loan.id, 'limitAmount', e.target.value)} />
                      <input className={inp} placeholder="Balance" value={loan.balance} onChange={e => updatePropertyLoan(prop.id, loan.id, 'balance', e.target.value)} />
                      <input className={inp} placeholder="Repayment" value={loan.repaymentAmount} onChange={e => updatePropertyLoan(prop.id, loan.id, 'repaymentAmount', e.target.value)} />
                      <select className={inp} value={loan.repaymentType} onChange={e => updatePropertyLoan(prop.id, loan.id, 'repaymentType', e.target.value)}>
                        <option>Interest only</option><option>Principal and interest</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <select className={inp} value={loan.rateType} onChange={e => updatePropertyLoan(prop.id, loan.id, 'rateType', e.target.value)}>
                        <option>Variable</option><option>Fixed</option>
                      </select>
                      <input type="date" className={inp} placeholder="Interest only expiry" value={loan.interestOnlyExpiryDate} onChange={e => updatePropertyLoan(prop.id, loan.id, 'interestOnlyExpiryDate', e.target.value)} />
                      <input type="month" className={inp} placeholder="Loan term expiry" value={loan.loanTermExpiryDate} onChange={e => updatePropertyLoan(prop.id, loan.id, 'loanTermExpiryDate', e.target.value)} />
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
                  <option>Credit card</option><option>Car loan</option><option>Personal loan</option><option>HECS</option><option>Other</option>
                </select>
                <button onClick={() => removeLiability(liab.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <input className={inp} placeholder="Bank / lender" value={liab.lenderName} onChange={e => updateLiability(liab.id, 'lenderName', e.target.value)} />
                <input className={inp} placeholder="Account number" value={liab.accountNumber} onChange={e => updateLiability(liab.id, 'accountNumber', e.target.value)} />
                <input className={inp} placeholder="Limit" value={liab.limitAmount} onChange={e => updateLiability(liab.id, 'limitAmount', e.target.value)} />
                <input className={inp} placeholder="Balance" value={liab.balance} onChange={e => updateLiability(liab.id, 'balance', e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <input className={inp} placeholder="Repayment" value={liab.repaymentAmount} onChange={e => updateLiability(liab.id, 'repaymentAmount', e.target.value)} />
                <select className={inp} value={liab.repaymentFrequency} onChange={e => updateLiability(liab.id, 'repaymentFrequency', e.target.value)}>
                  <option>Monthly</option><option>Fortnightly</option><option>Weekly</option>
                </select>
                <select className={inp} value={liab.status} onChange={e => updateLiability(liab.id, 'status', e.target.value)}>
                  <option value="Ongoing">Ongoing</option><option value="Refinance">Refinance</option><option value="To be paid out">To be paid out</option>
                </select>
              </div>
              <OwnershipSplit applicants={d.applicants} ownership={liab.ownership} onChange={v => updateLiability(liab.id, 'ownership', v)} />
            </div>
          ))}
          <button onClick={addLiability} className="text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition">
            + Add liability
          </button>
        </div>
      )}

      <div className="text-xs text-gray-400 text-right">{savedAt ? `Autosaved at ${savedAt}` : ''}</div>
    </div>
  )
}
