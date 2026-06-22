'use client'
import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

type Lender = { id: string; name: string; product_name: string; annual_fee: number; monthly_fee: number; settlement_fee: number; offset_account: boolean; multiple_offsets: boolean; offset_count: number }

type RateModule = { enabled: boolean; rate: string; repayment: string; loanTerm: string; ioYears?: string; fixedYears?: string }

type LenderOption = {
  lenderId: string
  lenderName: string
  productName: string
  approvalDays: string
  valuationFee: string
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
  lenderId: '', lenderName: '', productName: '', approvalDays: '', valuationFee: '', maxEquity: '', specialNote: '',
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

export default function LOForm({ deal }: { deal: any }) {
  const supabase = createSupabaseBrowser()
  const saveKey = `lo_${deal.id}`
  const bc = deal.bc_data || {}

  const [lenderLibrary, setLenderLibrary] = useState<Lender[]>([])
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
    supabase.from('lenders').select('*').eq('active', true).order('name').then(({ data }) => { if (data) setLenderLibrary(data) })
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

  function selectLender(i: number, lenderId: string) {
    const lib = lenderLibrary.find(l => l.id === lenderId)
    if (!lib) return
    const updated = [...d.lenders]
    updated[i] = { ...updated[i], lenderId, lenderName: lib.name, productName: lib.product_name }
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
    const prompt = `You are a mortgage broker writing a recommendation for a client. The recommended lender is ${d.recommendedLender} with product ${rec?.productName}. The deal involves a loan amount of $${d.loanAmount}. Variable P&I rate: ${rec?.variablePI.enabled ? rec.variablePI.rate + '% p.a.' : 'not offered'}. Annual fee: ${rec ? (lenderLibrary.find(l => l.id === rec.lenderId)?.annual_fee || 0) : 0}. Write 2-3 sentences explaining why this lender is recommended. Be specific, professional, and focus on value to the client. Do not use placeholder text.`
    const res = await fetch('/api/generate-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, broker: deal.assigned_broker, formData: { template: 'recommendation_ai', ...d } })
    })
    const data = await res.json()
    if (data.recommendationNote) setD({ ...d, recommendationNote: data.recommendationNote })
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
      {/* Tab bar */}
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
          {/* Template + scenario */}
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

          {/* Broker personalisation */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Broker personalisation</div>
            <textarea className={inp + ' min-h-[80px] resize-y'} value={d.brokerPersonalisation}
              onChange={e => setD({ ...d, brokerPersonalisation: e.target.value })}
              placeholder="Hi [First Name], following our conversation..." />
          </div>

          {/* Documents required */}
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

          {/* Lender options */}
          {d.lenders.map((lender, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-5">
              <div className="flex justify-between items-center mb-4">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-widest">Option {i + 1}</div>
                {d.lenders.length > 1 && <button onClick={() => removeLender(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>}
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Field label="Lender">
                  <select className={sel} value={lender.lenderId} onChange={e => selectLender(i, e.target.value)}>
                    <option value="">Select lender</option>
                    {lenderLibrary.map(l => <option key={l.id} value={l.id}>{l.name} — {l.product_name}</option>)}
                  </select>
                </Field>
                <Field label="Approval days"><input className={inp} value={lender.approvalDays} onChange={e => updateLender(i, 'approvalDays', e.target.value)} placeholder="e.g. 3-4 business days" /></Field>
                {!isBridging && <>
                  <Field label="Valuation fee"><input className={inp} value={lender.valuationFee} onChange={e => updateLender(i, 'valuationFee', e.target.value)} placeholder="e.g. $300" /></Field>
                  <Field label="Max equity"><input className={inp} value={lender.maxEquity} onChange={e => updateLender(i, 'maxEquity', e.target.value)} placeholder="e.g. $500,000" /></Field>
                </>}
                <Field label="Special note (optional)">
                  <input className={inp} value={lender.specialNote} onChange={e => updateLender(i, 'specialNote', e.target.value)} placeholder="e.g. Rate increases after 3 months" />
                </Field>
              </div>

              {isBridging ? (
                <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-widest col-span-2 mb-1">Bridging structure</div>
                  <Field label="Variable rate % p.a."><input className={inp} value={lender.bridgingRate} onChange={e => updateLender(i, 'bridgingRate', e.target.value)} placeholder="8.67" /></Field>
                  <Field label="Loan term (months)"><input className={inp} value={lender.bridgingTerm} onChange={e => updateLender(i, 'bridgingTerm', e.target.value)} placeholder="12" /></Field>
                  <Field label="Bridging loan amount"><input className={inp} value={lender.bridgingLoanAmount} onChange={e => updateLender(i, 'bridgingLoanAmount', e.target.value)} placeholder="500,000" /></Field>
                  <Field label="Est. interest capitalised"><input className={inp} value={lender.estimatedInterest} onChange={e => updateLender(i, 'estimatedInterest', e.target.value)} placeholder="40,000" /></Field>
                  <Field label="Establishment fee"><input className={inp} value={lender.establishmentFee} onChange={e => updateLender(i, 'establishmentFee', e.target.value)} placeholder="600" /></Field>
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
                          {showIO && <Field label="IO period (years)"><input className={inp} value={lender[key].ioYears} onChange={e => updateRateModule(i, key, 'ioYears', e.target.value)} placeholder="5" /></Field>}
                          {showFixed && <Field label="Fixed for (years)"><input className={inp} value={lender[key].fixedYears} onChange={e => updateRateModule(i, key, 'fixedYears', e.target.value)} placeholder="2" /></Field>}
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

          {/* Recommendation */}
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

          {/* Criteria used */}
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

          {/* Additional notes */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Additional notes</div>
            <textarea className={inp + ' min-h-[80px] resize-y'} value={d.additionalNotes}
              onChange={e => setD({ ...d, additionalNotes: e.target.value })}
              placeholder="e.g. Debt recycling wording, rate reduction requested, credit card limit notes..." />
          </div>

          {/* Internal notes */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Internal notes</div>
            <textarea className={inp + ' min-h-[80px] resize-y'} value={d.internalNotes}
              onChange={e => setD({ ...d, internalNotes: e.target.value })}
              placeholder="Internal notes — not included in the email" />
          </div>

          {/* Generate button */}
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
