'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { Plus, Search, Briefcase, Trash2 } from 'lucide-react'
import Link from 'next/link'
type Client = { id: string; first_name: string; last_name: string }
type Deal = {
  id: string; deal_name: string; deal_type: string; stage: string; status: string; assigned_broker: string;
  created_at: string; clients: Client; client_proceeded?: boolean
  bc_completed_at?: string | null; lo_completed_at?: string | null; compliance_completed_at?: string | null
}
const BROKER_DISPLAY: Record<string, string> = { Fabio: 'Fabio De Castro', Mark: 'Mark Gallo' }
export default function DealsPage() {
  const browser = createSupabaseBrowser()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [brokerKey, setBrokerKey] = useState<string | null>(null)
  useEffect(() => {
    browser.auth.getUser().then(({ data: { user } }) => {
      if (!user) { fetchDeals(); return }
      browser.from('user_profiles').select('role, broker_key').eq('id', user.id).single()
        .then(async ({ data }) => {
          const role = data?.role || 'staff'
          const broker = data?.broker_key || null
          setUserRole(role)
          setBrokerKey(broker)
          if (role === 'staff') {
            const { data: officer } = await browser.from('credit_officers').select('id').eq('user_id', user.id).single()
            fetchDeals(role, broker, officer?.id || null)
          } else {
            fetchDeals(role, broker)
          }
        })
    })
  }, [])
  async function fetchDeals(role?: string, broker?: string | null, creditOfficerId?: string | null) {
    let query = browser.from('deals').select('*, clients(first_name, last_name)').order('created_at', { ascending: false })
    if (role === 'broker' && broker) {
      query = query.eq('assigned_broker', broker)
    } else if (role === 'staff' && creditOfficerId) {
      query = query.eq('assigned_credit_officer', creditOfficerId)
    }
    const { data, error } = await query
    if (!error && data) setDeals(data)
    setLoading(false)
  }
  async function deleteDeal(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await browser.from('deals').delete().eq('id', id)
    setDeals(prev => prev.filter(d => d.id !== id))
  }
  const filtered = deals.filter(d =>
    d.deal_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.clients?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.clients?.last_name?.toLowerCase().includes(search.toLowerCase())
  )
  const totalAssigned = deals.length
  const isBrokerViewer = !!brokerKey
  const myBrokerDeals = deals.filter(d => d.assigned_broker === brokerKey)
  const bcReady = myBrokerDeals.filter(d => d.bc_completed_at && !d.lo_completed_at && !d.compliance_completed_at).length
  const loReady = myBrokerDeals.filter(d => d.lo_completed_at && !d.compliance_completed_at).length
  const complianceReady = myBrokerDeals.filter(d => d.compliance_completed_at).length
  const activeForStaff = deals.filter(d => !d.compliance_completed_at).length
  function readyStageFor(deal: Deal): 'BC' | 'LO' | null {
    if (deal.lo_completed_at && !deal.compliance_completed_at) return 'LO'
    if (deal.bc_completed_at && !deal.lo_completed_at && !deal.compliance_completed_at) return 'BC'
    return null
  }
  return (
    <div className="p-6">
      {isBrokerViewer && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Your deals</div>
            <div className="text-2xl font-semibold text-[#343333]">{myBrokerDeals.length}</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="text-xs text-amber-600 mb-1">BC ready for review</div>
            <div className="text-2xl font-semibold text-amber-700">{bcReady}</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="text-xs text-amber-600 mb-1">LO ready for review</div>
            <div className="text-2xl font-semibold text-amber-700">{loReady}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="text-xs text-green-600 mb-1">Compliance completed</div>
            <div className="text-2xl font-semibold text-green-700">{complianceReady}</div>
          </div>
        </div>
      )}
      {userRole === 'staff' && (
        <div className="flex gap-3 mb-4">
          <div className="flex-1 bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Deals assigned to you</div>
            <div className="text-2xl font-semibold text-[#343333]">{totalAssigned}</div>
          </div>
          <div className="flex-1 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-xs text-[#2DBEFF] mb-1">Active (not yet complete)</div>
            <div className="text-2xl font-semibold text-[#2DBEFF]">{activeForStaff}</div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by name, client, purpose..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-[#2DBEFF]" />
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-3 py-2 bg-[#2DBEFF] text-white text-sm font-medium rounded-lg hover:opacity-90">
          <Plus size={14} />New deal
        </button>
      </div>
      {loading ? (
        <div className="text-sm text-gray-400 text-center py-12">Loading deals...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Briefcase size={32} className="text-gray-300 mx-auto mb-3" />
          <div className="text-sm font-medium text-gray-500 mb-1">No deals yet</div>
          <div className="text-xs text-gray-400">Click "New deal" to create your first one</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(deal => {
            const readyStage = readyStageFor(deal)
            return (
            <div key={deal.id} className="flex items-center gap-2">
              <Link href={readyStage ? `/deals/${deal.id}?stage=${readyStage}` : `/deals/${deal.id}`} className={`flex-1 bg-white border rounded-xl px-4 py-3 flex items-center gap-4 transition-all ${readyStage ? 'border-amber-300 hover:border-amber-400' : 'border-gray-100 hover:border-[#2DBEFF]'}`}>
                <div className="w-9 h-9 rounded-full bg-[#2DBEFF]/10 text-[#2DBEFF] flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {deal.clients?.first_name?.[0]}{deal.clients?.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{deal.deal_name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {deal.clients?.first_name} {deal.clients?.last_name}
                    {deal.deal_type && <> · {deal.deal_type}</>}
                    {deal.assigned_broker && <> · {BROKER_DISPLAY[deal.assigned_broker] || deal.assigned_broker}</>}
                  </div>
                </div>
                {readyStage && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">{readyStage} ready for review</span>
                )}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${deal.status === 'in_progress' ? 'bg-[#2DBEFF]/10 text-[#2DBEFF]' : 'bg-gray-100 text-gray-500'}`}>
                  {deal.status === 'in_progress' ? 'In progress' : deal.status}
                </span>
              </Link>
              <button onClick={e => deleteDeal(e, deal.id, deal.deal_name)}
                className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-300 hover:text-red-400 hover:border-red-200 hover:bg-red-50 flex-shrink-0 transition">
                <Trash2 size={13} />
              </button>
            </div>
          )})}
        </div>
      )}
      {showModal && <NewDealModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); fetchDeals(userRole, brokerKey) }} brokerKey={brokerKey} userRole={userRole} />}
    </div>
  )
}

function makeUid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}
function makeApplicant(first_name: string, last_name: string, email: string, phone: string) {
  const id = makeUid()
  return {
    id, title: '', firstName: first_name, middleName: '', lastName: last_name,
    preferredName: '', previousName: '', gender: '', dob: '',
    phoneMobile: phone, emailPersonal: email,
    addresses: [{ id: makeUid(), address: '', residentialStatus: '', isCurrent: true, startDate: '' }],
    employment: [{ id: makeUid(), isCurrent: true, employmentPriority: 'Primary', employmentBasis: 'Full time', occupation: '', startDate: '', onProbation: false, employerName: '', employerAbn: '', employerAcn: '', employerType: '', employerAddress: '', contactPersonName: '', contactPersonDetails: '' }],
    income: [{ id: makeUid(), incomeType: 'PAYG', employmentId: '', grossSalary: '', grossSalaryFrequency: 'Annually', bonusAmount: '', bonusFrequency: 'Annually', overtimeEssentialAmount: '', overtimeEssentialFrequency: 'Annually', overtimeNonEssentialAmount: '', overtimeNonEssentialFrequency: 'Annually', commissionAmount: '', commissionFrequency: 'Annually', allowanceAmount: '', allowanceFrequency: 'Annually' }]
  }
}

function NewDealModal({ onClose, onCreated, brokerKey, userRole }: { onClose: () => void; onCreated: () => void; brokerKey: string | null; userRole: string }) {
  const browser = createSupabaseBrowser()
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [showSecondApplicant, setShowSecondApplicant] = useState(false)
  const [form2, setForm2] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [deal, setDeal] = useState({ deal_type: 'Purchase', assigned_broker: brokerKey || 'Fabio' })
  const [saving, setSaving] = useState(false)
  const [brokerList, setBrokerList] = useState<string[]>([])

  useEffect(() => {
    browser.from('clients').select('*').order('first_name').then(({ data }) => { if (data) setClients(data) })
    browser.from('user_profiles').select('broker_key').not('broker_key', 'is', null)
      .then(({ data }) => {
        if (data && data.length > 0) setBrokerList(data.map((d: any) => d.broker_key).filter(Boolean))
        else setBrokerList(['Fabio', 'Mark'])
      })
  }, [])

  const primaryLastName = selectedClient?.last_name || form.last_name
  const dealName = `${primaryLastName}_${deal.deal_type}_${new Date().getFullYear()}`

  async function handleCreate() {
    setSaving(true)
    let clientId = selectedClient?.id
    if (!clientId) {
      const { data, error: clientError } = await browser.from('clients').insert([form]).select().single()
      if (clientError || !data?.id) {
        alert('Failed to create client record. Please try again.')
        setSaving(false)
        return
      }
      clientId = data.id
    }

    // Seed fact_find_data with applicant(s) from modal
    const primaryFirstName = selectedClient?.first_name || form.first_name
    const primaryLastNameVal = selectedClient?.last_name || form.last_name
    const primaryEmail = mode === 'existing' ? '' : form.email
    const primaryPhone = mode === 'existing' ? '' : form.phone
    const applicants = [makeApplicant(primaryFirstName, primaryLastNameVal, primaryEmail, primaryPhone)]
    if (showSecondApplicant && (form2.first_name || form2.last_name)) {
      applicants.push(makeApplicant(form2.first_name, form2.last_name, form2.email, form2.phone))
    }
    const fact_find_data = { applicants, assets: [], properties: [], liabilities: [] }

    await browser.from('deals').insert([{
      deal_name: dealName,
      client_id: clientId,
      deal_type: deal.deal_type,
      assigned_broker: deal.assigned_broker,
      stage: 'BC',
      status: 'in_progress',
      fact_find_data
    }])
    setSaving(false)
    onCreated()
  }

  const filteredClients = clients.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(clientSearch.toLowerCase()))
  const inp = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2DBEFF]"
  const sel = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2DBEFF]"

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-[520px] max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="text-base font-semibold mb-1">New deal</div>
        <div className="text-xs text-gray-400 mb-5">Deal name format: ClientName_Purpose_Year</div>

        <div className="flex gap-2 mb-5">
          <button onClick={() => { setMode('new'); setSelectedClient(null) }} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${mode==='new' ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-500'}`}>New client</button>
          <button onClick={() => setMode('existing')} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${mode==='existing' ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-500'}`}>Existing client</button>
        </div>

        {mode === 'existing' ? (
          <div className="mb-4">
            <input type="text" placeholder="Search clients..." value={clientSearch} onChange={e => setClientSearch(e.target.value)}
              className={`${inp} mb-2`} />
            <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
              {filteredClients.map(c => (
                <div key={c.id} onClick={() => setSelectedClient(c)}
                  className={`px-3 py-2 rounded-lg text-sm cursor-pointer ${selectedClient?.id === c.id ? 'bg-[#2DBEFF]/10 text-[#2DBEFF] font-medium' : 'hover:bg-gray-50'}`}>
                  {c.first_name} {c.last_name}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Applicant 1</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[['first_name','First name'],['last_name','Last name'],['email','Email'],['phone','Phone']].map(([k,l]) => (
                <div key={k}>
                  <label className="text-xs text-gray-500 mb-1 block">{l}</label>
                  <input type="text" value={form[k as keyof typeof form]} onChange={e => setForm({...form, [k]: e.target.value})}
                    className={inp} />
                </div>
              ))}
            </div>

            {!showSecondApplicant ? (
              <button onClick={() => setShowSecondApplicant(true)}
                className="text-sm text-[#2DBEFF] border border-dashed border-[#2DBEFF] rounded-lg px-4 py-1.5 hover:bg-blue-50 transition w-full">
                + Add second applicant
              </button>
            ) : (
              <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/30">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-medium text-gray-500">Applicant 2</p>
                  <button onClick={() => { setShowSecondApplicant(false); setForm2({ first_name: '', last_name: '', email: '', phone: '' }) }}
                    className="text-xs text-gray-400 hover:text-red-400">Remove</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[['first_name','First name'],['last_name','Last name'],['email','Email'],['phone','Phone']].map(([k,l]) => (
                    <div key={k}>
                      <label className="text-xs text-gray-500 mb-1 block">{l}</label>
                      <input type="text" value={form2[k as keyof typeof form2]} onChange={e => setForm2({...form2, [k]: e.target.value})}
                        className={inp} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4 mt-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Deal type</label>
            <select value={deal.deal_type} onChange={e => setDeal({...deal, deal_type: e.target.value})} className={sel}>
              {['Purchase','Refinance','Investment','Bridging','Construction','SMSF'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {userRole !== 'broker' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Assigned broker</label>
              <select value={deal.assigned_broker} onChange={e => setDeal({...deal, assigned_broker: e.target.value})} className={sel}>
                {brokerList.map(b => <option key={b} value={b}>{BROKER_DISPLAY[b] || b}</option>)}
              </select>
            </div>
          )}
        </div>

        {(form.last_name || selectedClient) && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 mb-4 text-xs text-gray-500">
            Deal name: <span className="font-medium text-gray-700">{dealName}</span>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleCreate} disabled={saving || (!selectedClient && !form.first_name)}
            className="px-4 py-2 text-sm bg-[#2DBEFF] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-40">
            {saving ? 'Creating...' : 'Create deal'}
          </button>
        </div>
      </div>
    </div>
  )
}
