'use client'
import { useState } from 'react'

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

type Split = { label: string; amount: string; rate: string; type: string }

export default function BCForm({ deal }: { deal: any }) {
  const [activeTab, setActiveTab] = useState<'factfind' | 'form' | 'preview'>('form')
  const [template, setTemplate] = useState('oo_purchase')
  const [splits, setSplits] = useState<Split[]>(TEMPLATE_DEFAULTS['oo_purchase'].splits)
  const [applicant, setApplicant] = useState({
    first_name: deal.clients?.first_name || '',
    last_name: deal.clients?.last_name || '',
    dependants: '0',
    joint: 'No',
  })
  const [income, setIncome] = useState({ base: '', other: '', rental: '' })
  const [liabilities, setLiabilities] = useState({ cc_limit: '', personal_loan: '', car_loan: '', hecs: '', health: '', living: '' })
  const [scenario, setScenario] = useState({ suburb: '', property_type: 'Owner-occupied', purchase_price: '', deposit: '', stamp_duty: '', lvr: '80%', loan_term: '30' })
  const [notes, setNotes] = useState({ broker: '', internal: '', broker_sig: deal.assigned_broker || 'Fabio' })
  const [checklist, setChecklist] = useState<string[]>([])
  const [newCheck, setNewCheck] = useState('')
  const [generating, setGenerating] = useState(false)
  const [emailHtml, setEmailHtml] = useState('')

  function selectTemplate(id: string) {
    setTemplate(id)
    setSplits(TEMPLATE_DEFAULTS[id].splits.map((s: Split) => ({ ...s })))
  }

  function updateSplit(i: number, key: keyof Split, val: string) {
    setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, [key]: val } : s))
  }

  function addSplit() {
    setSplits(prev => [...prev, { label: `Split ${prev.length + 1}`, amount: '', rate: '6.14', type: 'P&I' }])
  }

  function removeSplit(i: number) {
    setSplits(prev => prev.filter((_, idx) => idx !== i))
  }

  async function generateEmail() {
    setGenerating(true)
    const templateLabel = TEMPLATES.find(t => t.id === template)?.label || template
    const splitsText = splits.map(s => `${s.label}: $${s.amount} @ ${s.rate}% p.a. (${s.type})`).join('\n')
    const checklistText = checklist.length ? checklist.join(', ') : `Income $${income.base} p.a., ${applicant.dependants} dependants, CC limit $${liabilities.cc_limit}`

    const prompt = `You are writing a professional mortgage broker email for Simplify Finance.

Client: ${applicant.first_name} ${applicant.joint === 'Yes' ? '& partner' : ''}
Template: ${templateLabel}
Loan structure:
${splitsText}
Broker notes: ${notes.broker || 'None'}
Based on: ${checklistText}
Broker: ${notes.broker_sig}

Write a warm, professional borrowing capacity email. Include:
1. A brief personalised opening (2-3 sentences)
2. The loan structure summary (use the splits above)
3. A "Based on your numbers" section listing key assumptions
4. A brief next steps paragraph
5. Sign off from ${notes.broker_sig} at Simplify Finance

Format as clean HTML using inline styles. Use these brand colours: header background #343333, accent #2DBEFF, card background #F2E8DB. No markdown, just HTML.`

    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, broker: notes.broker_sig })
      })
      const data = await res.json()
      setEmailHtml(data.html)
      setActiveTab('preview')
    } catch (e) {
      alert('Error generating email. Check your API key.')
    }
    setGenerating(false)
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500">{label}</label>
      {children}
    </div>
  )

  const inputCls = "px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2DBEFF] bg-white"
  const selectCls = "px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2DBEFF] bg-white"

  return (
    <div>
      {/* Sub tabs */}
      <div className="flex gap-2 mb-5">
        {[['factfind','Fact find'],['form','BC form'],['preview','Preview & share']].map(([id,label]) => (
          <button key={id} onClick={() => setActiveTab(id as any)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${activeTab === id ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-500 bg-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* FACT FIND TAB */}
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
            <div className="text-xs text-gray-400 mb-3">Fact finds, screenshots, rate sheets. Rate sheet tagged files appear as reminders when sending in Outlook.</div>
            <button className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">+ Add document</button>
          </div>
        </div>
      )}

      {/* BC FORM TAB */}
      {activeTab === 'form' && (
        <div>
          {/* Template selector */}
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
            {/* LEFT COLUMN */}
            <div className="flex flex-col gap-4">

              {/* Applicant */}
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Applicant</div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <Field label="First name"><input className={inputCls} value={applicant.first_name} onChange={e => setApplicant({...applicant, first_name: e.target.value})} /></Field>
                  <Field label="Last name"><input className={inputCls} value={applicant.last_name} onChange={e => setApplicant({...applicant, last_name: e.target.value})} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Dependants"><input className={inputCls} type="number" value={applicant.dependants} onChange={e => setApplicant({...applicant, dependants: e.target.value})} /></Field>
                  <Field label="Joint application"><select className={selectCls} value={applicant.joint} onChange={e => setApplicant({...applicant, joint: e.target.value})}><option>No</option><option>Yes</option></select></Field>
                </div>
              </div>

              {/* Income */}
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Income</div>
                <div className="flex flex-col gap-2">
                  <Field label="Base income (p.a.)"><input className={inputCls} placeholder="$120,000" value={income.base} onChange={e => setIncome({...income, base: e.target.value})} /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Other income"><input className={inputCls} placeholder="$0" value={income.other} onChange={e => setIncome({...income, other: e.target.value})} /></Field>
                    <Field label="Rental income"><input className={inputCls} placeholder="$0" value={income.rental} onChange={e => setIncome({...income, rental: e.target.value})} /></Field>
                  </div>
                </div>
              </div>

              {/* Liabilities */}
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Liabilities</div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Credit card limit"><input className={inputCls} placeholder="$10,000" value={liabilities.cc_limit} onChange={e => setLiabilities({...liabilities, cc_limit: e.target.value})} /></Field>
                  <Field label="Personal loan (mo.)"><input className={inputCls} placeholder="$0" value={liabilities.personal_loan} onChange={e => setLiabilities({...liabilities, personal_loan: e.target.value})} /></Field>
                  <Field label="Car loan (mo.)"><input className={inputCls} placeholder="$0" value={liabilities.car_loan} onChange={e => setLiabilities({...liabilities, car_loan: e.target.value})} /></Field>
                  <Field label="HECS (p.a.)"><input className={inputCls} placeholder="$0" value={liabilities.hecs} onChange={e => setLiabilities({...liabilities, hecs: e.target.value})} /></Field>
                  <Field label="Health insurance (mo.)"><input className={inputCls} placeholder="$0" value={liabilities.health} onChange={e => setLiabilities({...liabilities, health: e.target.value})} /></Field>
                  <Field label="Living expenses / HEM"><input className={inputCls} placeholder="$3,800" value={liabilities.living} onChange={e => setLiabilities({...liabilities, living: e.target.value})} /></Field>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Notes</div>
                <div className="flex flex-col gap-2">
                  <Field label="Broker summary notes (included in email)">
                    <textarea className={`${inputCls} min-h-16 resize-y`} value={notes.broker} onChange={e => setNotes({...notes, broker: e.target.value})} placeholder="Add personalised notes for client..." />
                  </Field>
                  <Field label="Internal assessor notes (internal only)">
                    <textarea className={`${inputCls} min-h-16 resize-y`} value={notes.internal} onChange={e => setNotes({...notes, internal: e.target.value})} placeholder="Internal notes..." />
                  </Field>
                  <Field label="Broker signature">
                    <select className={selectCls} value={notes.broker_sig} onChange={e => setNotes({...notes, broker_sig: e.target.value})}>
                      <option>Fabio — Simplify Finance</option>
                      <option>Mark — Simplify Finance</option>
                    </select>
                  </Field>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="flex flex-col gap-4">

              {/* Scenario fields */}
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Scenario details</div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Suburb"><input className={inputCls} value={scenario.suburb} onChange={e => setScenario({...scenario, suburb: e.target.value})} /></Field>
                  <Field label="Property type"><select className={selectCls} value={scenario.property_type} onChange={e => setScenario({...scenario, property_type: e.target.value})}><option>Owner-occupied</option><option>Investment</option></select></Field>
                  <Field label="Purchase price"><input className={inputCls} placeholder="$750,000" value={scenario.purchase_price} onChange={e => setScenario({...scenario, purchase_price: e.target.value})} /></Field>
                  <Field label="Deposit"><input className={inputCls} placeholder="$150,000" value={scenario.deposit} onChange={e => setScenario({...scenario, deposit: e.target.value})} /></Field>
                  <Field label="Stamp duty"><input className={inputCls} placeholder="$40,000" value={scenario.stamp_duty} onChange={e => setScenario({...scenario, stamp_duty: e.target.value})} /></Field>
                  <Field label="LVR"><select className={selectCls} value={scenario.lvr} onChange={e => setScenario({...scenario, lvr: e.target.value})}><option>80%</option><option>90%</option><option>95%</option></select></Field>
                  <Field label="Loan term (years)"><input className={inputCls} value={scenario.loan_term} onChange={e => setScenario({...scenario, loan_term: e.target.value})} /></Field>
                </div>
              </div>

              {/* Loan splits */}
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Loan splits</div>
                <div className="flex flex-col gap-3">
                  {splits.map((s, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-[#2DBEFF]">Split {i + 1}</span>
                        {splits.length > 1 && <button onClick={() => removeSplit(i)} className="text-xs text-gray-400 hover:text-red-500">Remove</button>}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Label"><input className={inputCls} value={s.label} onChange={e => updateSplit(i, 'label', e.target.value)} /></Field>
                        <Field label="Amount"><input className={inputCls} placeholder="$600,000" value={s.amount} onChange={e => updateSplit(i, 'amount', e.target.value)} /></Field>
                        <Field label="Rate"><input className={inputCls} value={s.rate} onChange={e => updateSplit(i, 'rate', e.target.value)} /></Field>
                        <Field label="Type"><select className={selectCls} value={s.type} onChange={e => updateSplit(i, 'type', e.target.value)}><option>P&I</option><option>Interest only</option></select></Field>
                      </div>
                    </div>
                  ))}
                  <button onClick={addSplit} className="text-xs text-[#2DBEFF] hover:underline text-left">+ Add split</button>
                </div>
              </div>

              {/* Checklist */}
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

              {/* Generate button */}
              <div className="flex justify-end gap-2">
                <button onClick={() => setActiveTab('preview')} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Preview</button>
                <button onClick={generateEmail} disabled={generating}
                  className="px-4 py-2 text-sm bg-[#2DBEFF] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
                  {generating ? 'Generating...' : '✨ Generate email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW TAB */}
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
