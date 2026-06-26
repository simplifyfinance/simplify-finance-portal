'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const TEMPLATES = [
  { id: 'refinance_equity', label: 'Refinance + equity release' },
  { id: 'refinance_only', label: 'Refinance only' },
  { id: 'oo_purchase', label: 'OO purchase' },
  { id: 'oo_lvr_compare', label: 'OO purchase — LVR comparison' },
  { id: 'investment_purchase', label: 'Investment purchase' },
  { id: 'investment_equity', label: 'Investment + equity release' },
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
  investment_equity: { splits: [{ label: 'Investment loan', amount: '', rate: '6.39', type: 'P&I' }, { label: 'Equity release', amount: '', rate: '6.14', type: 'P&I' }] },
  buy_sell: { splits: [{ label: 'New purchase loan', amount: '', rate: '6.14', type: 'P&I' }, { label: 'Bridging facility', amount: '', rate: '7.50', type: 'Interest only' }] },
  fhb: { splits: [{ label: 'Owner-occupied loan', amount: '', rate: '6.14', type: 'P&I' }] },
  bridging: { splits: [{ label: 'Bridging loan', amount: '', rate: '7.50', type: 'Interest only' }, { label: 'End loan', amount: '', rate: '6.14', type: 'P&I' }] },
  family_pledge: { splits: [{ label: 'Main loan', amount: '', rate: '6.14', type: 'P&I' }, { label: 'Guarantee portion', amount: '', rate: '6.14', type: 'P&I' }] },
  smsf: { splits: [{ label: 'SMSF loan', amount: '', rate: '7.20', type: 'P&I' }] },
  construction: { splits: [{ label: 'Land loan', amount: '', rate: '6.14', type: 'P&I' }, { label: 'Construction loan', amount: '', rate: '6.39', type: 'Interest only' }] },
}

type Split = { label: string; amount: string; rate: string; type: string; deposit?: string }

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

  const [activeTab, setActiveTab] = useState<'factfind' | 'form' | 'preview'>('form')
  const [template, setTemplate] = useState(s.template || 'oo_purchase')
  const [splits, setSplits] = useState<Split[]>(s.splits || TEMPLATE_DEFAULTS['oo_purchase'].splits)
  const [firstName, setFirstName] = useState(s.firstName || deal.clients?.first_name || '')
  const [lastName, setLastName] = useState(s.lastName || deal.clients?.last_name || '')
  const [dependants, setDependants] = useState(s.dependants || '0')
  const [joint, setJoint] = useState(s.joint || 'No')
  const [incomeBase, setIncomeBase] = useState(s.incomeBase || '')
  const [incomeOther, setIncomeOther] = useState(s.incomeOther || '')
  const [incomeRental, setIncomeRental] = useState(s.incomeRental || '')
  const [ccLimit, setCcLimit] = useState(s.ccLimit || '')
  const [personalLoan, setPersonalLoan] = useState(s.personalLoan || '')
  const [carLoan, setCarLoan] = useState(s.carLoan || '')
  const [hecs, setHecs] = useState(s.hecs || '')
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

  useEffect(() => {
    const data = { template, splits, firstName, lastName, dependants, joint, incomeBase, incomeOther, incomeRental, ccLimit, personalLoan, carLoan, hecs, health, living, suburb, propertyType, purchasePrice, deposit, stampDuty, lvr, lvrCustom, loanTerm, brokerNotes, internalNotes, brokerSig, checklist, emailHtml, existingLoanBal, equityRelease, depositSource, lmi, fhog, guarantorName, bridgingPeriod, constructionCost, landValue }
    localStorage.setItem(saveKey, JSON.stringify(data)); supabase.from('deals').update({ bc_data: data }).eq('id', deal.id).then(() => {})
    setSavedAt(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
  }, [template, splits, firstName, lastName, dependants, joint, incomeBase, incomeOther, incomeRental, ccLimit, personalLoan, carLoan, hecs, health, living, suburb, propertyType, purchasePrice, deposit, stampDuty, lvr, lvrCustom, loanTerm, brokerNotes, internalNotes, brokerSig, checklist, emailHtml, existingLoanBal, equityRelease, depositSource, lmi, fhog, guarantorName, bridgingPeriod, constructionCost, landValue])

  function selectTemplate(id: string) {
    setTemplate(id)
    setSplits(TEMPLATE_DEFAULTS[id].splits.map((s: Split) => ({ ...s })))
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
        body: JSON.stringify({ broker: brokerSig, dealId: deal.id, formData: { template, splits, firstName, lastName, dependants, joint, incomeBase, incomeOther, incomeRental, ccLimit, personalLoan, carLoan, hecs, health, living, suburb, propertyType, purchasePrice, deposit, stampDuty, lvr, lvrCustom, loanTerm, brokerNotes, checklist } })
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
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Dependants"><input className={inputCls} type="number" value={dependants} onChange={e => setDependants(e.target.value)} /></Field>
                  <Field label="Joint application"><select className={selectCls} value={joint} onChange={e => setJoint(e.target.value)}><option>No</option><option>Yes</option></select></Field>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Income</div>
                <div className="flex flex-col gap-2">
                  <Field label="Base income (p.a.)"><NumberInput value={incomeBase} onChange={setIncomeBase} placeholder="120,000" /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Other income"><NumberInput value={incomeOther} onChange={setIncomeOther} placeholder="0" /></Field>
                    <Field label="Rental income"><NumberInput value={incomeRental} onChange={setIncomeRental} placeholder="0" /></Field>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Liabilities</div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Credit card limit"><NumberInput value={ccLimit} onChange={setCcLimit} placeholder="10,000" /></Field>
                  <Field label="Personal loan (mo.)"><NumberInput value={personalLoan} onChange={setPersonalLoan} placeholder="0" /></Field>
                  <Field label="Car loan (mo.)"><NumberInput value={carLoan} onChange={setCarLoan} placeholder="0" /></Field>
                  <Field label="HECS (p.a.)"><NumberInput value={hecs} onChange={setHecs} placeholder="0" /></Field>
                  <Field label="Health insurance (mo.)"><NumberInput value={health} onChange={setHealth} placeholder="0" /></Field>
                  <Field label="Living expenses / HEM"><NumberInput value={living} onChange={setLiving} placeholder="3,800" /></Field>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Notes</div>
                <div className="flex flex-col gap-2">
                  <Field label="Broker summary notes (included in email)">
                    <textarea className={`${brokerNotes ? "border-green-200 bg-white" : "border-amber-200 bg-[#FFFBF0]"} px-2.5 py-1.5 text-sm rounded-lg focus:outline-none focus:border-[#2DBEFF] w-full min-h-16 resize-y border`} value={brokerNotes} onChange={e => setBrokerNotes(e.target.value)} placeholder="✏ Add your personalised opening message — this goes directly into the client email..." />
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
                  {!["refinance_equity", "refinance_only"].includes(template) && <Field label="Purchase price"><NumberInput value={purchasePrice} onChange={setPurchasePrice} placeholder="750,000" /></Field>}
                  {!["refinance_equity", "refinance_only", "oo_lvr_compare", "investment_equity", "family_pledge"].includes(template) && <Field label="Deposit"><NumberInput value={deposit} onChange={setDeposit} placeholder="150,000" /></Field>}
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
                  {!["refinance_equity", "refinance_only"].includes(template) && <Field label="Stamp duty"><NumberInput value={stampDuty} onChange={setStampDuty} placeholder="40,000" /></Field>}
              {["refinance_equity", "refinance_only", "investment_equity", "buy_sell", "bridging"].includes(template) && <Field label="Existing loan balance"><NumberInput value={existingLoanBal} onChange={setExistingLoanBal} placeholder="500,000" /></Field>}
              {["refinance_equity", "investment_equity"].includes(template) && <Field label="Equity release amount"><NumberInput value={equityRelease} onChange={setEquityRelease} placeholder="100,000" /></Field>}

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
              {template === 'fhb' && <Field label="First home owner grant"><NumberInput value={fhog} onChange={setFhog} placeholder="30,000" /></Field>}
              {template === 'family_pledge' && <Field label="Guarantor name"><input className={inputCls} value={guarantorName} onChange={e => setGuarantorName(e.target.value)} placeholder="e.g. John Smith" /></Field>}
              {template === 'bridging' && <Field label="Bridging period (months)"><input className={inputCls} value={bridgingPeriod} onChange={e => setBridgingPeriod(e.target.value)} placeholder="e.g. 6" /></Field>}
              {template === 'construction' && <Field label="Land value"><NumberInput value={landValue} onChange={setLandValue} placeholder="400,000" /></Field>}
              {template === 'construction' && <Field label="Construction cost"><NumberInput value={constructionCost} onChange={setConstructionCost} placeholder="350,000" /></Field>}
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
                        <Field label="Amount"><input className={inputCls} placeholder="600,000" value={s.amount} onChange={e => updateSplitAmount(i, e.target.value)} /></Field>
                        {template === "oo_lvr_compare" && <Field label="Deposit required"><NumberInput value={s.deposit || ""} onChange={v => updateSplit(i, 'deposit', v)} placeholder="150,000" /></Field>}<Field label="Rate"><input className={inputCls} value={s.rate} onChange={e => updateSplit(i, 'rate', e.target.value)} /></Field>
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
          <div className="flex justify-end gap-2 mb-4">
            <button className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Assign broker</button>
            <button onClick={() => { navigator.clipboard.writeText(emailHtml); alert('HTML copied!') }}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Copy HTML</button>
            <button className="px-3 py-1.5 text-sm bg-[#2DBEFF] text-white rounded-lg font-medium hover:opacity-90">Mark BC complete</button>
          </div>
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
