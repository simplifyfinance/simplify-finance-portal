'use client'
import { Fragment, useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { Plus, Search, Briefcase, Trash2, Copy } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getWaitingOnLabel, WAITING_ON_STYLES } from '@/lib/deal-status'
import { ageGroupOf, stageAge, GROUP_ORDER, GROUP_STYLE } from '@/lib/deal-age'
import { useBrokerNames } from '@/lib/broker-names'
import { phaseOf, isFinished, isInApplication, PHASE_LABEL } from '@/lib/deal-phase'
import DealBoard from '@/components/DealBoard'
import { useBoardSettings } from '@/lib/use-board-settings'
type Client = { id: string; first_name: string; last_name: string; email?: string; phone?: string }
type Deal = {
  id: string; deal_name: string; deal_type: string; stage: string; status: string; assigned_broker: string;
  created_at: string; clients: Client; client_proceeded?: boolean
  bc_completed_at?: string | null; lo_completed_at?: string | null; compliance_completed_at?: string | null
}
export default function DealsPage() {
  const browser = createSupabaseBrowser()
  const router = useRouter()
  const { nameFor } = useBrokerNames()
  // Label colours, broker colours and the stale thresholds, all from Settings.
  // Until somebody sets them this is exactly what the code used before there was
  // a screen for it, so the board looks the same on an unmigrated portal.
  const { look } = useBoardSettings()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [brokerKey, setBrokerKey] = useState<string | null>(null)
  const [creditOfficerId, setCreditOfficerId] = useState<string | null>(null)
  const [boxFilter, setBoxFilter] = useState<'all' | 'bc' | 'lo' | 'compliance'>('all')
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
            setCreditOfficerId(officer?.id || null)
            fetchDeals(role, broker, officer?.id || null)
          } else {
            fetchDeals(role, broker)
          }
        })
    })
  }, [])
  async function fetchDeals(role?: string, broker?: string | null, creditOfficerId?: string | null) {
    let query = browser.from('deals').select('*, clients(first_name, last_name), credit_officers(name), lenders(name)').order('created_at', { ascending: false })
    if (role === 'broker' && broker) {
      query = query.ilike('assigned_broker', broker)
    } else if (role === 'staff' && creditOfficerId) {
      query = query.eq('assigned_credit_officer', creditOfficerId)
    }
    const { data, error } = await query
    if (!error && data) setDeals(data)
    setLoading(false)
  }
  async function cloneDeal(e: React.MouseEvent, deal: any) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Clone "${deal.deal_name}"? This copies Fact Find only — BC, LO, and Compliance start fresh.`)) return

    const { data: fullDeal } = await browser.from('deals').select('fact_find_data, client_id, deal_type, assigned_broker').eq('id', deal.id).single()
    if (!fullDeal) { alert('Could not load deal to clone'); return }

    // A clone is marked as one and keeps the original's name otherwise, so the two
    // sit next to each other on the board and it is obvious which is which.
    const newDealName = `${deal.deal_name}_clone`

    const { data: inserted, error } = await browser.from('deals').insert([{
      deal_name: newDealName,
      client_id: fullDeal.client_id,
      deal_type: fullDeal.deal_type,
      assigned_broker: fullDeal.assigned_broker,
      stage: 'BC',
      status: 'in_progress',
      fact_find_data: fullDeal.fact_find_data
    }]).select().single()

    if (error || !inserted) { alert('Error cloning deal: ' + (error?.message || 'unknown error')); return }
    router.push(`/deals/${inserted.id}`)
  }

  async function deleteDeal(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${name}"? This will also delete its attached documents. This cannot be undone.`)) return

    const { data: docs } = await browser.from('deal_documents').select('id, file_path').eq('deal_id', id)
    if (docs && docs.length > 0) {
      const paths = docs.map((d: any) => d.file_path)
      await browser.storage.from('deal-documents').remove(paths)
      await browser.from('deal_documents').delete().eq('deal_id', id)
    }

    const { error } = await browser.from('deals').delete().eq('id', id)
    if (error) {
      alert('Error deleting deal: ' + error.message)
      return
    }
    setDeals(prev => prev.filter(d => d.id !== id))
  }
  // Two toggles, because settled and lost are two different things. There used to
  // be one, and it hid `completed` while permanently showing `lost` — so three
  // dead deals sat at the bottom of the list forever and nine live post-compliance
  // ones were invisible.
  // Two ways of looking at the same deals, never two sources of truth. The board
  // is the morning "where is everything"; the list is for searching, and reads
  // better on a phone.
  // The board is what everyone opens on. Fabio, 1 Sep 2026 — it is the morning
  // "where is everything and what is stuck", and a list of twenty-one rows does
  // not answer that. The List toggle is still there for searching.
  const [layout, setLayout] = useState<'list' | 'board'>('board')
  const [showSettled, setShowSettled] = useState(false)
  const [showLost, setShowLost] = useState(false)
  const filtered = deals.filter(d =>
    (showSettled || phaseOf(d) !== 'settled') &&
    (showLost || phaseOf(d) !== 'lost') &&
    (boxFilter === 'all' ||
      (boxFilter === 'bc' && d.bc_completed_at && !d.lo_completed_at && !d.compliance_completed_at) ||
      (boxFilter === 'lo' && d.lo_completed_at && !d.compliance_completed_at) ||
      (boxFilter === 'compliance' && isInApplication(d))) &&
    (d.deal_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.clients?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.clients?.last_name?.toLowerCase().includes(search.toLowerCase()))
  )
  // The board has a Settled column of its own, so it must not be handed a list
  // with settled deals already filtered out — it would draw an empty column and
  // look broken. Lost deals stay off it entirely; a dead deal is not work.
  const boardDeals = deals.filter(d =>
    phaseOf(d) !== 'lost' &&
    (boxFilter === 'all' ||
      (boxFilter === 'bc' && d.bc_completed_at && !d.lo_completed_at && !d.compliance_completed_at) ||
      (boxFilter === 'lo' && d.lo_completed_at && !d.compliance_completed_at) ||
      (boxFilter === 'compliance' && isInApplication(d))) &&
    (d.deal_name?.toLowerCase().includes(search.toLowerCase()) ||
     d.clients?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
     d.clients?.last_name?.toLowerCase().includes(search.toLowerCase())))

  const totalAssigned = deals.length
  const isPersonalViewer = !!brokerKey || (userRole === 'staff' && !!creditOfficerId)
  const summaryLabel = isPersonalViewer ? 'Your deals' : 'Total deals'
  // deals is already server-filtered to just this person's deals for brokers/staff-with-officer,
  // and unfiltered (team-wide) for admin or staff without a credit officer record
  const summaryDeals = deals
  // Stuck first, and oldest first inside each group. The top of the page is the
  // morning's work.
  // The same thresholds the board uses, so the two views can never disagree
  // about what is stuck.
  const grouped = [...filtered].sort((x, y) => {
    const g = GROUP_ORDER.indexOf(ageGroupOf(x, look.thresholds)) - GROUP_ORDER.indexOf(ageGroupOf(y, look.thresholds))
    if (g !== 0) return g
    return (stageAge(y, look.thresholds).days || 0) - (stageAge(x, look.thresholds).days || 0)
  })

  // The boxes count the same way the list groups, so clicking one can never open
  // an empty screen. The old "Compliance completed" box did exactly that: it
  // counted compliance-completed deals while the list excluded them, so a
  // headline of nine opened nothing.
  const live = summaryDeals.filter(d => !isFinished(d))
  const bcReady = live.filter(d => d.bc_completed_at && !d.lo_completed_at && !d.compliance_completed_at).length
  const loReady = live.filter(d => d.lo_completed_at && !d.compliance_completed_at).length
  const inApplication = live.filter(isInApplication).length
  const activeForStaff = live.length
  function readyStageFor(deal: Deal): 'BC' | 'LO' | null {
    if (deal.lo_completed_at && !deal.compliance_completed_at) return 'LO'
    if (deal.bc_completed_at && !deal.lo_completed_at && !deal.compliance_completed_at) return 'BC'
    return null
  }
  return (
    <div className="p-6">
      {!loading && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <button onClick={() => setBoxFilter('all')}
            className={`text-left bg-white border rounded-xl p-4 transition ${boxFilter === 'all' ? 'border-[#2DBEFF] ring-1 ring-[#2DBEFF]' : 'border-gray-100 hover:border-gray-200'}`}>
            <div className="text-xs text-gray-400 mb-1">{summaryLabel}</div>
            <div className="text-2xl font-semibold text-[#343333]">{live.length}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {summaryDeals.length - live.length > 0 ? `${summaryDeals.length - live.length} settled or lost` : 'none closed'}
            </div>
          </button>
          <button onClick={() => setBoxFilter('bc')}
            className={`text-left bg-amber-50 border rounded-xl p-4 transition ${boxFilter === 'bc' ? 'border-amber-500 ring-1 ring-amber-500' : 'border-amber-200 hover:border-amber-300'}`}>
            <div className="text-xs text-amber-600 mb-1">BC ready for review</div>
            <div className="text-2xl font-semibold text-amber-700">{bcReady}</div>
          </button>
          <button onClick={() => setBoxFilter('lo')}
            className={`text-left bg-amber-50 border rounded-xl p-4 transition ${boxFilter === 'lo' ? 'border-amber-500 ring-1 ring-amber-500' : 'border-amber-200 hover:border-amber-300'}`}>
            <div className="text-xs text-amber-600 mb-1">LO ready for review</div>
            <div className="text-2xl font-semibold text-amber-700">{loReady}</div>
          </button>
          <button onClick={() => setBoxFilter('compliance')}
            className={`text-left bg-green-50 border rounded-xl p-4 transition ${boxFilter === 'compliance' ? 'border-green-500 ring-1 ring-green-500' : 'border-green-200 hover:border-green-300'}`}>
            <div className="text-xs text-green-600 mb-1">In application</div>
            <div className="text-2xl font-semibold text-green-700">{inApplication}</div>
          </button>
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
        <div className="flex gap-0.5 border border-gray-200 rounded-lg overflow-hidden bg-white flex-none">
          {([['list', 'List'], ['board', 'Board']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setLayout(k)}
              className={`text-sm px-3 py-2 ${layout === k ? 'bg-[#2DBEFF] text-white font-medium' : 'text-gray-500 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by name, client, purpose..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-[#2DBEFF]" />
        </div>
        <button onClick={() => setShowSettled(!showSettled)}
          className={`px-3 py-2 text-sm rounded-lg border transition ${showSettled ? 'border-[#25794C] text-[#25794C] bg-[#F1F7F3]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          {showSettled ? '✓ Showing settled' : 'Show settled'}
        </button>
        <button onClick={() => setShowLost(!showLost)}
          className={`px-3 py-2 text-sm rounded-lg border transition ${showLost ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          {showLost ? '✓ Showing lost' : 'Show lost'}
        </button>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-3 py-2 bg-[#2DBEFF] text-white text-sm font-medium rounded-lg hover:opacity-90">
          <Plus size={14} />New deal
        </button>
      </div>
      {loading ? (
        <div className="text-sm text-gray-400 text-center py-12">Loading deals...</div>
      ) : layout === 'board' ? (
        <DealBoard deals={boardDeals} nameFor={nameFor}
          colours={{ type: look.type, use: look.use, broker: look.broker }}
          thresholds={look.thresholds} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Briefcase size={32} className="text-gray-300 mx-auto mb-3" />
          <div className="text-sm font-medium text-gray-500 mb-1">No deals yet</div>
          <div className="text-xs text-gray-400">Click "New deal" to create your first one</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {grouped.map((deal, gi) => {
            const readyStage = readyStageFor(deal)
            const grp = ageGroupOf(deal, look.thresholds)
            const age = stageAge(deal, look.thresholds)
            const showHeader = gi === 0 || ageGroupOf(grouped[gi - 1], look.thresholds) !== grp
            return (
            <Fragment key={deal.id}>
            {showHeader && (
              <div className={`flex items-center gap-2.5 px-1 mb-0.5 ${gi === 0 ? '' : 'mt-4'}`}>
                <span className={`text-[11px] font-bold tracking-[.08em] uppercase ${GROUP_STYLE[grp].text}`}>
                  {GROUP_STYLE[grp].label}
                </span>
                <span className="text-[11px] text-[#A29889]">
                  {grouped.filter(d => ageGroupOf(d) === grp).length}
                </span>
                <span className="flex-1 h-px bg-[#EDE7DD]" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Link href={readyStage ? `/deals/${deal.id}?stage=${readyStage}` : `/deals/${deal.id}`} className={`flex-1 bg-white border rounded-xl px-4 py-3 flex items-center gap-4 transition-all ${readyStage ? 'border-amber-300 hover:border-amber-400' : 'border-gray-100 hover:border-[#2DBEFF]'}`}>
                <div className="w-9 h-9 rounded-full bg-[#2DBEFF]/10 text-[#2DBEFF] flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {deal.clients?.first_name?.[0]}{deal.clients?.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{deal.deal_name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {deal.clients?.first_name} {deal.clients?.last_name}
                    {deal.deal_type && <> · {deal.deal_type}</>}
                    {deal.assigned_broker && <> · {nameFor(deal.assigned_broker)}</>}
                    {(deal as any).credit_officers?.name && <> · Credit: {(deal as any).credit_officers.name}</>}
                  </div>
                </div>
                {(() => {
                  const waitingOn = getWaitingOnLabel(deal, (deal as any).credit_officers?.name)
                  return waitingOn ? (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${WAITING_ON_STYLES[waitingOn.color]}`}>{waitingOn.text}</span>
                  ) : null
                })()}
                {readyStage && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">{readyStage} ready for review</span>
                )}
                {grp !== 'settled' && grp !== 'lost' && age.days !== null && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${GROUP_STYLE[grp].chip}`}
                        title={`In this stage for ${age.label} (business days)`}>{age.label}</span>
                )}
                {/* This printed deals.stage — the column that only ever moved when a
                    client clicked proceed, so it lied on most deals. It says which
                    phase the deal is actually in now. */}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                  isFinished(deal) ? 'bg-gray-100 text-gray-500' : 'bg-[#2DBEFF]/10 text-[#2DBEFF]'}`}>
                  {PHASE_LABEL[phaseOf(deal)]}
                </span>
              </Link>
              <button onClick={e => cloneDeal(e, deal)}
                className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-300 hover:text-[#2DBEFF] hover:border-blue-200 hover:bg-blue-50 flex-shrink-0 transition">
                <Copy size={13} />
              </button>
              <button onClick={e => deleteDeal(e, deal.id, deal.deal_name)}
                className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-300 hover:text-red-400 hover:border-red-200 hover:bg-red-50 flex-shrink-0 transition">
                <Trash2 size={13} />
              </button>
            </div>
            </Fragment>
          )})}
        </div>
      )}
      {showModal && <NewDealModal onClose={() => setShowModal(false)} onCreated={(id) => { setShowModal(false); router.push(`/deals/${id}?stage=FactFind`) }} brokerKey={brokerKey} userRole={userRole} />}
    </div>
  )
}

function makeUid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}
function makeApplicant(first_name: string, last_name: string, email: string, phone: string, clientId?: string) {
  const id = makeUid()
  return {
    id, title: '', firstName: first_name, middleName: '', lastName: last_name,
    preferredName: '', previousName: '', gender: '', dob: '',
    phoneMobile: phone, emailPersonal: email, clientId,
    addresses: [{ id: makeUid(), address: '', residentialStatus: '', isCurrent: true, startDate: '' }],
    employment: [{ id: makeUid(), isCurrent: true, employmentPriority: 'Primary', employmentBasis: 'Full time', occupation: '', startDate: '', onProbation: false, employerName: '', employerAbn: '', employerAcn: '', employerType: '', employerAddress: '', contactPersonName: '', contactPersonDetails: '' }],
    income: [{ id: makeUid(), incomeType: 'PAYG', employmentId: '', grossSalary: '', grossSalaryFrequency: 'Annually', bonusAmount: '', bonusFrequency: 'Annually', overtimeEssentialAmount: '', overtimeEssentialFrequency: 'Annually', overtimeNonEssentialAmount: '', overtimeNonEssentialFrequency: 'Annually', commissionAmount: '', commissionFrequency: 'Annually', allowanceAmount: '', allowanceFrequency: 'Annually' }]
  }
}

function NewDealModal({ onClose, onCreated, brokerKey, userRole }: { onClose: () => void; onCreated: (id: string) => void; brokerKey: string | null; userRole: string }) {
  const browser = createSupabaseBrowser()
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [showSecondApplicant, setShowSecondApplicant] = useState(false)
  const [form2, setForm2] = useState({ first_name: '', last_name: '', email: '', phone: '', client_id: '' })
  // No fallback to a named person. An unassigned deal is visible and fixable;
  // one quietly filed under the wrong broker is neither.
  const [deal, setDeal] = useState({ assigned_broker: brokerKey || '', lead_source: '' })
  const [createError, setCreateError] = useState('')
  const [saving, setSaving] = useState(false)
  const { options: brokerList } = useBrokerNames()

  useEffect(() => {
    browser.from('clients').select('*').order('first_name').then(({ data }) => { if (data) setClients(data) })
  }, [])

  const app1First = selectedClient?.first_name || form.first_name || ''
  const app1Last = selectedClient?.last_name || form.last_name || ''
  const app2First = form2.first_name || ''
  const app2Last = form2.last_name || ''
  // Deals used to be saved as ClientName_Purpose_Year. On a board the underscores
  // do not wrap so the name ran out of the card, and the purpose is already shown
  // as a chip beside it. Fabio, 2 Sep 2026: "First Name Last Name & First Name
  // Last Name Year Created".
  //
  // Two deals for the same client in the same year now collide, and that is fine —
  // the SalesTrekker card carries the identity for the API. Existing deals keep
  // the names they were saved with; this is the format for new ones only.
  const person = (f: string, l: string) => [f, l].map(x => String(x || '').trim()).filter(Boolean).join(' ')
  const namePart = showSecondApplicant && (app2First || app2Last)
    ? [person(app1First, app1Last), person(app2First, app2Last)].filter(Boolean).join(' & ')
    : person(app1First, app1Last)
  const dealName = `${namePart} ${new Date().getFullYear()}`.trim()

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
    const applicants = [makeApplicant(primaryFirstName, primaryLastNameVal, primaryEmail, primaryPhone, mode === 'existing' ? clientId : undefined)]
    if (showSecondApplicant && (form2.first_name || form2.last_name)) {
      applicants.push(makeApplicant(form2.first_name, form2.last_name, form2.email, form2.phone, form2.client_id || undefined))
    }
    const fact_find_data = { applicants, assets: [], properties: [], liabilities: [] }

    // Checked. This used to be a bare insert with no error handling and no
    // select, so a database refusal closed the modal and looked like success -
    // the deal simply never appeared.
    const { data: created, error } = await browser.from('deals').insert([{
      deal_name: dealName,
      client_id: clientId,
      lead_source: deal.lead_source,
      assigned_broker: deal.assigned_broker,
      stage: 'BC',
      status: 'in_progress',
      fact_find_data
    }]).select('id').single()
    setSaving(false)
    if (error) { setCreateError('NOT CREATED - ' + error.message); return }
    if (!created) { setCreateError('NOT CREATED - the database refused it.'); return }
    onCreated(created.id)
  }

  const filteredClients = clients.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(clientSearch.toLowerCase()))
  const [app2Mode, setApp2Mode] = useState<'new' | 'existing'>('new')
  const [app2Search, setApp2Search] = useState('')
  const filteredClientsApp2 = clients.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(app2Search.toLowerCase()))
  const inp = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2DBEFF]"
  const sel = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2DBEFF]"

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-[520px] max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="text-base font-semibold mb-1">New deal</div>
        <div className="text-xs text-gray-400 mb-5">Deal name format: First Last &amp; First Last Year</div>

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
          </div>
        )}

        {(mode === 'existing' ? !!selectedClient : true) && (
          !showSecondApplicant ? (
            <button onClick={() => setShowSecondApplicant(true)}
              className="text-sm text-[#2DBEFF] border border-dashed border-[#2DBEFF] rounded-lg px-4 py-1.5 hover:bg-blue-50 transition w-full mb-4">
              + Add second applicant
            </button>
          ) : (
            <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/30 mb-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-medium text-gray-500">Applicant 2</p>
                <button onClick={() => { setShowSecondApplicant(false); setForm2({ first_name: '', last_name: '', email: '', phone: '', client_id: '' }); setApp2Mode('new'); setApp2Search('') }}
                  className="text-xs text-gray-400 hover:text-red-400">Remove</button>
              </div>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setApp2Mode('new')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${app2Mode==='new' ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-500'}`}>New person</button>
                <button onClick={() => setApp2Mode('existing')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${app2Mode==='existing' ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-500'}`}>Existing client</button>
              </div>
              {app2Mode === 'existing' ? (
                <div>
                  <input type="text" placeholder="Search clients..." value={app2Search} onChange={e => setApp2Search(e.target.value)}
                    className={`${inp} mb-2`} />
                  <div className="max-h-32 overflow-y-auto flex flex-col gap-1">
                    {filteredClientsApp2.map(c => (
                      <div key={c.id} onClick={() => setForm2({ first_name: c.first_name, last_name: c.last_name, email: c.email || '', phone: c.phone || '', client_id: c.id })}
                        className={`px-3 py-2 rounded-lg text-sm cursor-pointer ${form2.first_name === c.first_name && form2.last_name === c.last_name ? 'bg-[#2DBEFF]/10 text-[#2DBEFF] font-medium' : 'hover:bg-gray-50'}`}>
                        {c.first_name} {c.last_name}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {[['first_name','First name'],['last_name','Last name'],['email','Email'],['phone','Phone']].map(([k,l]) => (
                    <div key={k}>
                      <label className="text-xs text-gray-500 mb-1 block">{l}</label>
                      <input type="text" value={form2[k as keyof typeof form2]} onChange={e => setForm2({...form2, [k]: e.target.value})}
                        className={inp} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {/* The Deal type dropdown used to live here. It was asked at the one
            moment nobody can answer it - before the fact find - and then it
            never changed again, so a deal that turned into a refinance was
            labelled a purchase forever. What kind of deal it is now comes from
            the BC template and the settlement fields, which are recorded as the
            deal actually happens. See lib/deal-labels.ts. */}
        <div className="grid grid-cols-2 gap-3 mb-4 mt-4">
          {userRole !== 'broker' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Assigned broker</label>
              <select value={deal.assigned_broker} onChange={e => setDeal({...deal, assigned_broker: e.target.value})} className={sel}>
                <option value="">— select broker —</option>
                {brokerList.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Lead source</label>
            <input type="text" value={deal.lead_source} onChange={e => setDeal({...deal, lead_source: e.target.value})} placeholder="e.g. Referral, Google, Facebook..." className={inp} />
          </div>
        </div>

        {(form.last_name || selectedClient) && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 mb-4 text-xs text-gray-500">
            Deal name: <span className="font-medium text-gray-700">{dealName}</span>
          </div>
        )}

        {createError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs mb-3">{createError}</div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleCreate} disabled={saving || (!selectedClient && !form.first_name) || !deal.assigned_broker}
            className="px-4 py-2 text-sm bg-[#2DBEFF] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-40">
            {saving ? 'Creating...' : 'Create deal'}
          </button>
        </div>
      </div>
    </div>
  )
}
