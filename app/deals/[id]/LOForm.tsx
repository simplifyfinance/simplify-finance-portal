'use client'
import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

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
}

type LOData = {
  template: string
  loanAmount: string
  purchasePrice: string
  deposit: string
  stampDuty: string
  existingLoan: string
  brokerPersonalisation: string
  documentsRequired: string[]
  criteriaUsed: string[]
  additionalNotes: string
  lenders: LenderOption[]
  recommendedLender: string
  recommendationNote: string
  internalNotes: string
  emailHtml: string
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
  establishmentFee: '', monthlyFee: '', docProcessingFee: ''
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
      {children}
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
      <input
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF] bg-blue-50/30"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
      />
    </div>
  )
}

export default function LOForm({ deal }: { deal: any }) {
  const supabase = createSupabaseBrowser()
  const saveKey = `lo_${deal.id}`
  const bc = deal.bc_data || {}

  const [allProducts, setAllProducts] = useState<LenderProduct[]>([])
  const [generating, setGenerating] = useState(false)
  const [generatingRec, setGeneratingRec] = useState(false)
  const [emailHtml, setEmailHtml] = useState('')
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form')
  const [savedAt, setSavedAt] = useState('')
  const [newDoc, setNewDoc] = useState('')
  const [newCriteria, setNewCriteria] = useState('')

  const initData = (): LOData => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(saveKey) : null
    if (saved) return JSON.parse(saved)
    return {
      template: bc.template?.startsWith('refinance') ? 'lo_refinance' : bc.template === 'bridging' ? 'lo_bridging' : 'lo_purchase',
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
      lenders: [defaultLenderOption()],
      recommendedLender: '',
      recommendationNote: '',
      internalNotes: '',
      emailHtml: ''
    }
  }

  const [d, setD] = useState<LOData>(initData)

  useEffect(() => {
    Promise.all([
      supabase.from('lender_products').select('*'),
      supabase.from('lenders').select('id, name')
    ]).then(([{ data: products }, { data: lenders }]) => {
      if (products && lenders) {
        const lenderMap: Record<string, string> = {}
        lenders.forEach((l: any) => { lenderMap[l.id] = l.name })
        const shaped = products.map((p: any) => ({ ...p, lender_name: lenderMap[p.lender_id] || '' }))
        setAllProducts(shaped)
      }
    })
    supabase.from('deals').select('lo_data').eq('id', deal.id).single().then(({ data }) => {
      if (data?.lo_data && Object.keys(data.lo_data).length > 0) {
        setD(data.lo_data as LOData)
        if ((data.lo_data as LOData).emailHtml) setEmailHtml((data.lo_data as LOData).emailHtml)
      }
    })
  }, [])

  useEffect(() => {
    localStorage.setItem(saveKey, JSON.stringify(d))
    supabase.from('deals').update({ lo_data: d }).eq('id', deal.id).then(() => {})
    setSavedAt(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
  }, [d])

  const uniqueLenders = Array.from(new Map(allProducts.map(p => [p.lender_id, { id: p.lender_id, name: p.lender_name }])).values())
    .sort((a, b) => a.name.localeCompare(b.name))

  function getProductsForLender(lenderId: string) {
    return allProducts.filter(p => p.lender_id === lenderId)
  }

  function selectLenderName(i: number, lenderId: string) {
    const lender = uniqueLenders.find(l => l.id === lenderId)
    const updated = [...d.lenders]
    updated[i] = {
      ...updated[i],
      lenderId,
      lenderName: lender?.name || '',
      lenderProductId: '',
      productName: '',
      applicationFee: '',
      annualFee: '',
      valuationFee: '',
      rateLockFee: '',
      offsetAccount: '',
      libraryNotes: '',
    }
    setD({ ...d, lenders: updated })
  }

  function selectProduct(i: number, productId: string) {
    const product = allProducts.find(p => p.id === productId)
    if (!product) return
    const updated = [...d.lenders]
    updated[i] = {
      ...updated[i],
      lenderProductId: productId,
      productName: product.product_name,
      applicationFee: product.application_fee || '',
      annualFee: product.annual_fee || '',
      valuationFee: product.valuation_fee || '',
      rateLockFee: product.rate_lock_fee || '',
      offsetAccount: product.offset_account ? (product.multiple_offsets ? 'Yes — multiple offsets' : 'Yes') : 'No',
      libraryNotes: product.notes || '',
    }
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
    setD({ ...d, lenders: [...d.lenders, defaultLenderOption()] })
  }

  function removeLender(i: number) {
    setD({ ...d, lenders: d.lenders.filter((_, idx) => idx !== i) })
  }

  function toggleCriteria(c: string) {
    setD({ ...d, criteriaUsed: d.criteriaUsed.includes(c) ? d.criteriaUsed.filter(x => x !== c) : [...d.criteriaUsed, c] })
  }

  async function generateRecommendation() {
    setGeneratingRec(true)
    const rec = d.lenders.find(l => l.lenderName === d.recommendedLender)
    const prompt = `You are a mortgage broker writing a recommendation for a client. Write 2-3 professional sentences recommending ${d.recommendedLender} (${rec?.productName}). Loan amount: ${d.loanAmount}. Variable P&I rate: ${rec?.variablePI.enabled ? rec.variablePI.rate + '% p.a.' : 'not offered'}. Annual fee: ${rec?.annualFee || 'nil'}. Application fee: ${rec?.applicationFee || 'nil'}. Be specific and focus on value. Do not use placeholder text.`
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 300, messages: [{ role: 'user', content: prompt }] })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      if (text) setD({ ...d, recommendationNote: text })
    } catch (e) { console.error(e) }
    setGeneratingRec(false)
  }

  async function generateEmail() {
    setGenerating(true)
    const res = await fetch('/api/generate-lo-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ broker: deal.assigned_broker, dealId: deal.id, loData: d })
    })
    const data = await res.json()
    if (data.html) {
      setEmailHtml(data.html)
      setD({ ...d, emailHtml: data.html })
      setActiveTab('preview')
    }
    setGenerating(false)
  }

  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF]"
  const sel = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF]"
  const isBridging = d.template === 'lo_bridging'

  return (
    <div className="space-y-4">
      <div className="flex gap-2 bg-white border border-gray-100 rounded-xl p-1">
        {(['form', 'preview'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${activeTab === t ? 'bg-[#343333] text-white' : 'text-gray-400 hover:text-gray-600'}`}>
            {t === 'form' ? 'LO Form' : 'Email Preview'}
          </button>
        ))}
      </div>

      {activeTab === 'form' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Scenario</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email template">
                <select className={sel} value={d.template} onChange={e => setD({ ...d, template: e.target.value })}>
                  {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Loan amount">
                <input className={inp} value={d.loanAmount} onChange={e => setD({ ...d, loanAmount: e.target.value })} placeholder="750,000" />
              </Field>
              {!isBridging && <>
                <Field label="Purchase price"><input className={inp} value={d.purchasePrice} onChange={e => setD({ ...d, purchasePrice: e.target.value })} /></Field>
                <Field label="Deposit"><input className={inp} value={d.deposit} onChange={e => setD({ ...d, deposit: e.target.value })} /></Field>
                <Field label="Stamp duty"><input className={inp} value={d.stampDuty} onChange={e => setD({ ...d, stampDuty: e.target.value })} /></Field>
              </>}
              {d.template === 'lo_refinance' && <Field label="Existing loan balance"><input className={inp} value={d.existingLoan} onChange={e => setD({ ...d, existingLoan: e.target.value })} /></Field>}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Broker personalisation</div>
            <textarea className={`${d.brokerPersonalisation ? "border-green-200 bg-white" : "border-amber-200 bg-[#FFFBF0]"} w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF] min-h-[80px] resize-y border`} value={d.brokerPersonalisation}
              onChange={e => setD({ ...d, brokerPersonalisation: e.target.value })}
              placeholder="✏ Add your personalised opening message — this appears at the top of the client email..." />
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Documents required</div>
            <div className="space-y-2 mb-3">
              {d.documentsRequired.map((doc, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm flex-1">{doc}</span>
                  <button onClick={() => setD({ ...d, documentsRequired: d.documentsRequired.filter((_, idx) => idx !== i) })}
                    className="text-xs text-red-400 hover:text-red-600">Remove</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input className={inp} value={newDoc} onChange={e => setNewDoc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newDoc.trim()) { setD({ ...d, documentsRequired: [...d.documentsRequired, newDoc.trim()] }); setNewDoc('') } }}
                placeholder="e.g. Latest payslips — add and press Enter" />
              <button onClick={() => { if (newDoc.trim()) { setD({ ...d, documentsRequired: [...d.documentsRequired, newDoc.trim()] }); setNewDoc('') } }}
                className="bg-[#343333] text-white text-sm px-4 rounded-lg">Add</button>
            </div>
          </div>

          {d.lenders.map((lender, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-5">
              <div className="flex justify-between items-center mb-4">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-widest">Option {i + 1}</div>
                {d.lenders.length > 1 && <button onClick={() => removeLender(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>}
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
                    <span className="ml-2 normal-case text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded font-medium">auto-filled from library — editable</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <LibraryField label="Application fee" value={lender.applicationFee} onChange={v => updateLender(i, 'applicationFee', v)} />
                    <LibraryField label="Annual fee" value={lender.annualFee} onChange={v => updateLender(i, 'annualFee', v)} />
                    <LibraryField label="Valuation fee" value={lender.valuationFee} onChange={v => updateLender(i, 'valuationFee', v)} />
                    <LibraryField label="Rate lock fee" value={lender.rateLockFee} onChange={v => updateLender(i, 'rateLockFee', v)} />
                  </div>
                  <LibraryField label="Offset account" value={lender.offsetAccount} onChange={v => updateLender(i, 'offsetAccount', v)} />
                  {lender.libraryNotes && (
                    <div className="mt-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <label className="text-xs font-medium text-gray-500">Internal notes</label>
                        <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded font-medium">library</span>
                      </div>
                      <textarea
                        className="w-full border border-blue-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF] bg-blue-50/30 resize-y min-h-[60px]"
                        value={lender.libraryNotes}
                        onChange={e => updateLender(i, 'libraryNotes', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-4">
                <Field label="Approval days"><select className={sel} value={lender.approvalDays} onChange={e => updateLender(i, 'approvalDays', e.target.value)}><option value="">— select —</option><option>1-2 business days</option><option>3-5 business days</option><option>5-7 business days</option><option>7-10 business days</option><option>10+ business days</option></select></Field>
                {!isBridging && <Field label="Max equity"><input className={inp} value={lender.maxEquity} onChange={e => updateLender(i, 'maxEquity', e.target.value)} placeholder="e.g. $500,000" /></Field>}
                <Field label="Special note (optional)">
                  <input className={inp} value={lender.specialNote} onChange={e => updateLender(i, 'specialNote', e.target.value)} placeholder="e.g. Rate increases after 3 months" />
                </Field>
              </div>

              {isBridging ? (
                <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-widest col-span-2 mb-1">Bridging structure</div>
                  <Field label="Variable rate % p.a."><input className={inp} value={lender.bridgingRate} onChange={e => updateLender(i, 'bridgingRate', e.target.value)} placeholder="8.67" /></Field>
                  <Field label="Loan term (months)"><input className={inp} value={lender.bridgingTerm} onChange={e => updateLender(i, 'bridgingTerm', e.target.value)} placeholder="12" /></Field>
                  <Field label="Bridging loan amount"><input className={inp} value={lender.bridgingLoanAmount} onChange={e => updateLender(i, 'bridgingLoanAmount', e.target.value)} placeholder="e.g. $800,000" /></Field>
                  <Field label="Estimated interest"><input className={inp} value={lender.estimatedInterest} onChange={e => updateLender(i, 'estimatedInterest', e.target.value)} placeholder="e.g. $12,000" /></Field>
                  <Field label="Establishment fee"><input className={inp} value={lender.establishmentFee} onChange={e => updateLender(i, 'establishmentFee', e.target.value)} placeholder="e.g. $900" /></Field>
                  <Field label="Monthly fee"><input className={inp} value={lender.monthlyFee} onChange={e => updateLender(i, 'monthlyFee', e.target.value)} placeholder="8" /></Field>
                  <Field label="Doc processing fee"><input className={inp} value={lender.docProcessingFee} onChange={e => updateLender(i, 'docProcessingFee', e.target.value)} placeholder="150" /></Field>
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
                        <input type="checkbox" checked={lender[key].enabled}
                          onChange={e => updateRateModule(i, key, 'enabled', e.target.checked)} />
                        {label}
                      </label>
                      {lender[key].enabled && (
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <Field label="Rate % p.a."><input className={inp} value={lender[key].rate} onChange={e => updateRateModule(i, key, 'rate', e.target.value)} placeholder="6.14" /></Field>
                          <Field label="Monthly repayment"><input className={inp} value={lender[key].repayment} onChange={e => updateRateModule(i, key, 'repayment', e.target.value)} placeholder="3,200" /></Field>
                          <Field label="Loan term (years)"><input className={inp} value={lender[key].loanTerm} onChange={e => updateRateModule(i, key, 'loanTerm', e.target.value)} placeholder="30" /></Field>
                          {showIO && <Field label="IO period (years)"><select className={sel} value={lender[key].ioYears} onChange={e => updateRateModule(i, key, 'ioYears', e.target.value)}><option value="">— select —</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></Field>}
                          {showFixed && <Field label="Fixed for (years)"><select className={sel} value={lender[key].fixedYears} onChange={e => updateRateModule(i, key, 'fixedYears', e.target.value)}><option value="">— select —</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></Field>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {d.lenders.length < 3 && (
            <button onClick={addLender}
              className="w-full py-3 border border-dashed border-gray-300 rounded-xl text-sm text-gray-400 hover:border-[#2DBEFF] hover:text-[#2DBEFF] transition">
              + Add another lender option
            </button>
          )}

          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Recommendation</div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Recommended lender">
                <select className={sel} value={d.recommendedLender} onChange={e => setD({ ...d, recommendedLender: e.target.value })}>
                  <option value="">Select recommended lender</option>
                  {d.lenders.filter(l => l.lenderName).map((l, i) => <option key={i} value={l.lenderName}>{l.lenderName} — {l.productName}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Recommendation paragraph">
              <textarea className={inp + ' min-h-[100px] resize-y'} value={d.recommendationNote}
                onChange={e => setD({ ...d, recommendationNote: e.target.value })}
                placeholder="Based on your situation, I would recommend proceeding with..." />
            </Field>
            <button onClick={generateRecommendation} disabled={generatingRec || !d.recommendedLender}
              className="mt-2 text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-4 py-2 hover:bg-blue-50 transition disabled:opacity-40">
              {generatingRec ? 'Generating...' : '✦ AI draft recommendation'}
            </button>
          </div>

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
              <input className={inp} value={newCriteria} onChange={e => setNewCriteria(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newCriteria.trim()) { setD({ ...d, criteriaUsed: [...d.criteriaUsed, newCriteria.trim()] }); setNewCriteria('') } }}
                placeholder="Add custom criteria and press Enter" />
              <button onClick={() => { if (newCriteria.trim()) { setD({ ...d, criteriaUsed: [...d.criteriaUsed, newCriteria.trim()] }); setNewCriteria('') } }}
                className="bg-[#343333] text-white text-sm px-4 rounded-lg">Add</button>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Additional notes</div>
            <textarea className={inp + ' min-h-[80px] resize-y'} value={d.additionalNotes}
              onChange={e => setD({ ...d, additionalNotes: e.target.value })}
              placeholder="e.g. Debt recycling wording, rate reduction requested, credit card limit notes..." />
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Internal notes</div>
            <textarea className={inp + ' min-h-[80px] resize-y'} value={d.internalNotes}
              onChange={e => setD({ ...d, internalNotes: e.target.value })}
              placeholder="Internal notes — not included in the email" />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{savedAt ? `Autosaved at ${savedAt}` : ''}</span>
            <button onClick={generateEmail} disabled={generating}
              className="bg-[#2DBEFF] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-400 transition disabled:opacity-50">
              {generating ? 'Generating email...' : 'Generate LO email'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          {emailHtml ? (
            <>
              <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Email preview</span>
                <button onClick={() => navigator.clipboard.writeText(emailHtml)}
                  className="text-xs text-[#2DBEFF] hover:underline">Copy HTML</button>
              </div>
              <iframe srcDoc={emailHtml} className="w-full h-[800px] border-0" title="LO Email Preview" />
            </>
          ) : (
            <div className="p-8 text-center text-sm text-gray-400">Generate the email first to see a preview</div>
          )}
        </div>
      )}
    </div>
  )
}
