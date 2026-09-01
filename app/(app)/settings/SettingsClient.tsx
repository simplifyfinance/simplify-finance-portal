'use client'
import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import PipelineTargets from '@/components/PipelineTargets'
import BrokerProfiles from '@/components/BrokerProfiles'
import StatementRulesPane from '@/components/StatementRules'
import { removeRule, TREATMENT_LABEL, type TreatAs } from '@/lib/statement-overrides'
import CommissionLibrary from '@/components/CommissionLibrary'
import AiExpenses from '@/components/AiExpenses'
import DealBoardSettings from '@/components/DealBoardSettings'

const supabase = createSupabaseBrowser()

const defaultBrands = [{ id: 'simplify', name: 'Simplify Finance', isDefault: true, headerColor: '#343333', accentColor: '#2DBEFF', acl: '387025', footerAddress: 'St Leonards, Sydney', logoUrl: '' }]
type BrokerRow = {
  id: string
  name: string
  title: string
  crn: string
  email: string
  calendly: string
  brandIds: string[]
  brokerKey?: string
}

const defaultBrokers: BrokerRow[] = [
  { id: 'fabio', name: 'Fabio de Castro', title: 'Director / Mortgage Broker', crn: '483807', email: 'fabio@simplifyfinance.com.au', calendly: 'https://calendly.com/fabiobroker', brandIds: ['simplify'], brokerKey: 'fabio' },
  { id: 'mark', name: 'Mark Gallo', title: 'Mortgage Broker', crn: '496195', email: 'mark@simplifyfinance.com.au', calendly: 'https://calendly.com/markgallo/phonecall', brandIds: ['simplify'], brokerKey: 'mark' }
]

type CreditOfficer = {
  id: string
  name: string
  active: boolean
  userId: string | null
  brokers: string[] // broker slugs (first names) this officer covers
  onLeaveFrom: string | null
  onLeaveUntil: string | null
}

type UserProfile = {
  id: string
  email: string
  full_name: string
  role: string
}

export default function SettingsPage() {
  const [brands, setBrands] = useState(defaultBrands)
  const [brokers, setBrokers] = useState<BrokerRow[]>(defaultBrokers)
  const [wealthDeskLink, setWealthDeskLink] = useState('')
  const [newDealNotificationUserId, setNewDealNotificationUserId] = useState('')
  const [stageMoveNotificationUserId, setStageMoveNotificationUserId] = useState('')
  const [complianceStyleNotes, setComplianceStyleNotes] = useState<string[]>([])
  const [loStyleNotes, setLoStyleNotes] = useState<string[]>([])
  const [newLoStyleNote, setNewLoStyleNote] = useState('')
  const [newStyleNote, setNewStyleNote] = useState('')
  const [statementRules, setStatementRules] = useState<any>(null)
  // Label colours and stale thresholds for the deal board. Left as null until
  // somebody actually opens that pane and changes something, so a portal whose
  // deal_board column has not been created yet can still save every other
  // setting on this page.
  const [dealBoard, setDealBoard] = useState<any>(null)
  // Standing rules set from the Audit tab. They change how EVERY client's
  // statements are read, so they have to be visible somewhere central and
  // removable by anyone, not buried on the file that created them.
  const [payerRules, setPayerRules] = useState<any[]>([])
  const [rulesMsg, setRulesMsg] = useState('')
  const [complianceFlags, setComplianceFlags] = useState<any[]>([])
  const [loadingFlags, setLoadingFlags] = useState(true)

  async function loadComplianceFlags() {
    setLoadingFlags(true)
    const { data } = await supabase.from('compliance_flags').select('*, deals(deal_name)').eq('promoted', false).order('created_at', { ascending: false })
    if (data) setComplianceFlags(data)
    setLoadingFlags(false)
  }

  async function promoteFlag(flag: any) {
    const isLo = flag.stage === 'lo'
    const updated = isLo ? [...loStyleNotes, flag.note] : [...complianceStyleNotes, flag.note]
    if (isLo) setLoStyleNotes(updated); else setComplianceStyleNotes(updated)
    const patch: any = { id: 'singleton', updated_at: new Date().toISOString() }
    if (isLo) patch.lo_style_notes = updated; else patch.compliance_style_notes = updated
    const { data: wrote, error } = await supabase.from('settings').upsert(patch).select('id')
    if (error || !wrote?.length) {
      alert('The note was not saved: ' + (error?.message || 'the database refused it.'))
      if (isLo) setLoStyleNotes(loStyleNotes); else setComplianceStyleNotes(complianceStyleNotes)
      return
    }
    await supabase.from('compliance_flags').update({ promoted: true }).eq('id', flag.id)
    loadComplianceFlags()
  }

  async function dismissFlag(flagId: string) {
    await supabase.from('compliance_flags').update({ promoted: true }).eq('id', flagId)
    loadComplianceFlags()
  }
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Logins that carry a broker key. A key with no profile card is invisible
  // otherwise: their targets save and the Pipeline uses them, but there is
  // nowhere to open them.
  const [brokerList, setBrokerList] = useState<{ key: string; name: string }[]>([])
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('brokers').select('broker_key, name, active').order('name')
      setBrokerList((data || []).filter((r: any) => r.active !== false)
        .map((r: any) => ({ key: String(r.broker_key), name: r.name })))
    })()
  }, [])

  const [brokerLogins, setBrokerLogins] = useState<{ key: string; name: string }[]>([])
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('user_profiles')
        .select('full_name, broker_key').not('broker_key', 'is', null)
      const seen = new Set<string>()
      const out: { key: string; name: string }[] = []
      for (const r of (data || [])) {
        const key = String((r as any).broker_key || '').trim().toLowerCase()
        if (!key || seen.has(key)) continue
        seen.add(key)
        out.push({ key, name: (r as any).full_name || key })
      }
      setBrokerLogins(out.sort((a, b) => a.name.localeCompare(b.name)))
    })()
  }, [])

  const [creditOfficers, setCreditOfficers] = useState<CreditOfficer[]>([])
  const [loadingCreditTeam, setLoadingCreditTeam] = useState(true)
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([])
  const [creditTeamError, setCreditTeamError] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('settings').select('*').eq('id', 'singleton').single()
      if (data) {
        if (data.brands?.length) setBrands(data.brands)
        if (data.brokers?.length) setBrokers(data.brokers)
        if (data.wealth_desk_link) setWealthDeskLink(data.wealth_desk_link)
        if (data.new_deal_notification_user_id) setNewDealNotificationUserId(data.new_deal_notification_user_id)
        if (data.stage_move_notification_user_id) setStageMoveNotificationUserId(data.stage_move_notification_user_id)
        if (data.compliance_style_notes?.length) setComplianceStyleNotes(data.compliance_style_notes)
        if (data.lo_style_notes?.length) setLoStyleNotes(data.lo_style_notes)
        if (data.statement_rules) setStatementRules(data.statement_rules)
        if (data.deal_board) setDealBoard(data.deal_board)
        setPayerRules(Array.isArray(data.statement_payer_rules) ? data.statement_payer_rules : [])
      }
      setLoading(false)
    }
    load()
    loadCreditTeam()
    loadComplianceFlags()
  }, [])

  async function loadCreditTeam() {
    setLoadingCreditTeam(true)
    const { data: officers, error: officersError } = await supabase.from('credit_officers').select('*').order('created_at')
    const { data: links, error: linksError } = await supabase.from('credit_officer_brokers').select('*')
    const { data: profiles } = await supabase.from('user_profiles').select('id, email, full_name, role').eq('active', true).order('full_name')
    if (profiles) setUserProfiles(profiles as UserProfile[])
    if (officersError) setCreditTeamError(`Load error (credit_officers): ${officersError.message}`)
    else if (linksError) setCreditTeamError(`Load error (credit_officer_brokers): ${linksError.message}`)
    if (officers) {
      const shaped: CreditOfficer[] = officers.map((o: any) => ({
        id: o.id,
        name: o.name,
        active: o.active,
        userId: o.user_id || null,
        brokers: (links || []).filter((l: any) => l.credit_officer_id === o.id).map((l: any) => l.broker_slug),
        onLeaveFrom: o.on_leave_from || null,
        onLeaveUntil: o.on_leave_until || null
      }))
      setCreditOfficers(shaped)
    }
    setLoadingCreditTeam(false)
  }

  async function handleSave() {
    setSaving(true)
    const patch: any = {
      id: 'singleton',
      brands,
      wealth_desk_link: wealthDeskLink,
      new_deal_notification_user_id: newDealNotificationUserId || null,
      stage_move_notification_user_id: stageMoveNotificationUserId || null,
      compliance_style_notes: complianceStyleNotes,
      lo_style_notes: loStyleNotes,
      statement_rules: statementRules,
      statement_payer_rules: payerRules,
      updated_at: new Date().toISOString()
    }
    if (dealBoard) patch.deal_board = dealBoard
    const { error } = await supabase.from('settings').upsert(patch)
    setSaving(false)
    if (error) { alert('Error saving settings: ' + error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function brokerSlug(name: string) {
    return name.split(' ')[0]
  }

  // The one string joining a broker profile to their deals, their login and their
  // targets. It has always been the first name; it was just never shown.
  function brokerKeyOf(b: any): string {
    return String(b?.brokerKey || brokerSlug(b?.name || '') || '').trim().toLowerCase()
  }

  function toggleBrokerBrand(brokerId: string, brandId: string) {
    setBrokers(brokers.map(b => {
      if (b.id !== brokerId) return b
      const current: string[] = (b as any).brandIds || []
      const has = current.includes(brandId)
      return { ...b, brandIds: has ? current.filter(id => id !== brandId) : [...current, brandId] } as any
    }))
  }

  async function addCreditOfficer() {
    const { data, error } = await supabase.from('credit_officers').insert({ name: 'New credit officer', active: true }).select().single()
    if (error) { alert('Error adding credit officer: ' + error.message); return }
    if (data) setCreditOfficers([...creditOfficers, { id: data.id, name: data.name, active: data.active, userId: null, brokers: [], onLeaveFrom: null, onLeaveUntil: null }])
  }

  async function linkCreditOfficerUser(officerId: string, userId: string) {
    const profile = userProfiles.find(p => p.id === userId)
    setCreditOfficers(creditOfficers.map(o => o.id === officerId ? { ...o, userId: userId || null, name: profile ? profile.full_name : o.name } : o))
    const { error } = await supabase.from('credit_officers').update({ user_id: userId || null, name: profile ? profile.full_name : undefined, updated_at: new Date().toISOString() }).eq('id', officerId)
    if (error) alert('Error linking portal account: ' + error.message)
  }

  async function updateCreditOfficerName(id: string, name: string) {
    setCreditOfficers(creditOfficers.map(o => o.id === id ? { ...o, name } : o))
    await supabase.from('credit_officers').update({ name, updated_at: new Date().toISOString() }).eq('id', id)
  }

  async function updateCreditOfficerLeave(id: string, field: 'onLeaveFrom' | 'onLeaveUntil', value: string) {
    setCreditOfficers(creditOfficers.map(o => o.id === id ? { ...o, [field]: value || null } : o))
    await supabase.from('credit_officers').update({ [field === 'onLeaveFrom' ? 'on_leave_from' : 'on_leave_until']: value || null }).eq('id', id)
  }

  async function toggleCreditOfficerActive(id: string, active: boolean) {
    setCreditOfficers(creditOfficers.map(o => o.id === id ? { ...o, active } : o))
    await supabase.from('credit_officers').update({ active, updated_at: new Date().toISOString() }).eq('id', id)
  }

  async function removeCreditOfficer(id: string) {
    setCreditOfficers(creditOfficers.filter(o => o.id !== id))
    await supabase.from('credit_officers').delete().eq('id', id)
  }

  async function toggleBrokerCoverage(officerId: string, slug: string) {
    const officer = creditOfficers.find(o => o.id === officerId)
    if (!officer) return
    const covers = officer.brokers.includes(slug)
    setCreditOfficers(creditOfficers.map(o => o.id === officerId
      ? { ...o, brokers: covers ? o.brokers.filter(b => b !== slug) : [...o.brokers, slug] }
      : o))
    if (covers) {
      await supabase.from('credit_officer_brokers').delete().eq('credit_officer_id', officerId).ilike('broker_slug', slug)
    } else {
      await supabase.from('credit_officer_brokers').insert({ credit_officer_id: officerId, broker_slug: slug.toLowerCase() })
    }
  }

  // Which pane is showing. Driven by the URL hash so the sidebar can steer it and a
  // link to a particular setting can be shared.
  const PANES: { key: string; label: string; blurb: string }[] = [
    { key: 'brands', label: 'Brands', blurb: 'Trading names used on deals and client emails.' },
    { key: 'brokers', label: 'Broker profiles', blurb: 'Everything about one broker: their details for documents, the key that links them to their deals, and their targets.' },
    { key: 'board', label: 'Deal board', blurb: 'The colour of each label on a card, and how long a column may sit before it goes amber and then red.' },
    { key: 'targets', label: 'Business targets', blurb: 'Monthly lodged and settled targets for the business as a whole. A broker’s own targets live on their profile.' },
    { key: 'commissions', label: 'Commission library', blurb: 'What each lender pays, on what basis, and what they claw back.' },
    { key: 'ai', label: 'AI expenses', blurb: 'What the portal spends on Anthropic, by month, person and feature.' },
    { key: 'people', label: 'Credit team', blurb: 'Who covers which broker.' },
    { key: 'notifications', label: 'Notifications', blurb: 'Who is emailed as deals move through the pipeline.' },
    { key: 'compliance', label: 'Compliance AI', blurb: 'Style notes and flags fed into every Compliance generation.' },
    { key: 'connections', label: 'Connections', blurb: 'Bank statement collection and other outside services.' },
    { key: 'statements', label: 'Statement analysis', blurb: 'What the statement analysis looks for, and when it raises a flag.' },
  ]
  const [pane, setPane] = useState('brands')
  useEffect(() => {
    const read = () => {
      const h = (window.location.hash || '#brands').slice(1)
      setPane(PANES.some(x => x.key === h) ? h : 'brands')
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])
  const activePane = PANES.find(x => x.key === pane) || PANES[0]

  if (loading) return <div className="p-8 max-w-5xl mx-auto text-[13px] text-[#A29889]">Loading settings...</div>

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-1">
        <h1 className="text-2xl font-bold text-[#2E2A26]">Settings</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-[13px] bg-[#343333] text-white px-5 py-2 rounded-lg font-semibold hover:bg-[#2a2a2a] transition disabled:opacity-40"
        >
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save settings'}
        </button>
      </div>
      <p className="text-[13px] text-[#6E665C] mb-1">{activePane.label}</p>
      <p className="text-[11.5px] text-[#A29889] mb-8">{activePane.blurb}</p>
      {pane === 'brands' && (
      <section className="mb-10">
        <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-4 flex items-center gap-2"><span className="w-[5px] h-[5px] rounded-full bg-[#0E8FCB] inline-block shrink-0" />Brands</h2>
        {brands.map((brand) => (
          <div key={brand.id} className="border border-[#EDE7DD] rounded-xl p-5 mb-4 bg-white">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <input className="font-semibold text-[#2E2A26] text-[13.5px] border border-[#E8E1D6] rounded-lg px-3 py-1.5 w-full max-w-xs mb-1 focus:outline-none focus:border-[#2DBEFF]" value={brand.name} onChange={(e) => setBrands(brands.map(b => b.id === brand.id ? {...b, name: e.target.value} : b))} placeholder="Brand name" />
                <p className="text-[11.5px] text-[#A29889]">{brand.isDefault ? 'Default brand' : 'Additional brand'}</p>
              </div>
              <div className="flex items-center gap-2">
                {brand.isDefault && <span className="text-[10.5px] bg-[#EAF7FE] border border-[#BFE6F9] text-[#0E8FCB] px-2.5 py-1 rounded-full font-semibold">Default</span>}
                {!brand.isDefault && <button onClick={() => setBrands(brands.filter(b => b.id !== brand.id))} className="text-[11.5px] text-[#A29889] hover:text-[#C4553B] transition">Remove</button>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[11px] font-semibold text-[#A29889] block mb-1">Header colour</label><div className="flex items-center gap-2"><input type="color" value={brand.headerColor} className="w-8 h-8 rounded cursor-pointer border border-[#E8E1D6] flex-shrink-0" onChange={(e) => setBrands(brands.map(b => b.id === brand.id ? {...b, headerColor: e.target.value} : b))} /><input className="text-[12.5px] font-mono text-[#6E665C] border border-[#E8E1D6] rounded-lg px-2 py-1 w-24 focus:outline-none focus:border-[#2DBEFF]" value={brand.headerColor} onChange={(e) => setBrands(brands.map(b => b.id === brand.id ? {...b, headerColor: e.target.value} : b))} placeholder="#343333" /></div></div>
              <div><label className="text-[11px] font-semibold text-[#A29889] block mb-1">Accent colour</label><div className="flex items-center gap-2"><input type="color" value={brand.accentColor} className="w-8 h-8 rounded cursor-pointer border border-[#E8E1D6] flex-shrink-0" onChange={(e) => setBrands(brands.map(b => b.id === brand.id ? {...b, accentColor: e.target.value} : b))} /><input className="text-[12.5px] font-mono text-[#6E665C] border border-[#E8E1D6] rounded-lg px-2 py-1 w-24 focus:outline-none focus:border-[#2DBEFF]" value={brand.accentColor} onChange={(e) => setBrands(brands.map(b => b.id === brand.id ? {...b, accentColor: e.target.value} : b))} placeholder="#2DBEFF" /></div></div>
              <div><label className="text-[11px] font-semibold text-[#A29889] block mb-1">Logo URL</label><input className="w-full text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF]" value={brand.logoUrl || ''} onChange={(e) => setBrands(brands.map(b => b.id === brand.id ? {...b, logoUrl: e.target.value} : b))} placeholder="https://.../logo.png" /></div>
              <div><label className="text-[11px] font-semibold text-[#A29889] block mb-1">ACL number</label><input className="w-full text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF]" value={brand.acl} onChange={(e) => setBrands(brands.map(b => b.id === brand.id ? {...b, acl: e.target.value} : b))} /><div className="text-[11px] text-[#A29889] mt-1">Appears in the footer of client emails.</div></div>
              <div><label className="text-[11px] font-semibold text-[#A29889] block mb-1">Footer address</label><input className="w-full text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF]" value={brand.footerAddress} onChange={(e) => setBrands(brands.map(b => b.id === brand.id ? {...b, footerAddress: e.target.value} : b))} /></div>
            </div>
          </div>
        ))}
        <button onClick={() => setBrands([...brands, {id: Date.now().toString(), name: 'New Brand', isDefault: false, headerColor: '#343333', accentColor: '#2DBEFF', acl: '387025', footerAddress: 'St Leonards, Sydney', logoUrl: ''}])} className="text-[12.5px] font-semibold text-[#0E8FCB] bg-white border border-[#BFE6F9] rounded-lg px-4 py-2 hover:bg-[#EAF7FE] transition">+ Add another brand</button>
      </section>
      )}
      {pane === 'brokers' && <BrokerProfiles brands={brands} />}
      {pane === 'board' && <DealBoardSettings value={dealBoard} onChange={setDealBoard} />}
      {pane === 'statements' && (
        <>
          <StatementRulesPane value={statementRules} onChange={setStatementRules} />

          <div className="bg-white border border-[#E5DED2] rounded-xl p-5 mt-4">
            <h3 className="text-[13px] font-[640] text-[#221F1B] mb-1">Standing corrections</h3>
            <p className="text-[12.5px] text-[#575046] leading-[1.6] mb-3">
              Set from the Audit tab on a deal, by ticking “always treat this payer this way”.
              Each one changes how <b>every</b> client’s statements are read from the next
              re-analysis onwards. A correction made on a single file always beats these.
            </p>
            {rulesMsg && <p className="text-[12px] text-[#1E7A4A] mb-2">{rulesMsg}</p>}
            {payerRules.length === 0 ? (
              <p className="text-[12.5px] text-[#7A7266]">None. Nothing is being forced on any file.</p>
            ) : (
              <div className="border border-[#EFEAE0] rounded-lg overflow-hidden">
                {payerRules.map((r: any, i: number) => (
                  <div key={r.match + i} className="flex items-start gap-3 px-3 py-2.5 border-b border-[#EFEAE0] last:border-b-0">
                    <div className="flex-1">
                      <p className="text-[12.5px] text-[#221F1B] m-0">{r.label || r.match}</p>
                      <p className="text-[11px] text-[#7A7266] m-0">
                        counted as <b className="text-[#575046]">{TREATMENT_LABEL[r.treat_as as TreatAs] || r.treat_as}</b>
                        {r.added_by ? ` · added by ${r.added_by}` : ''}
                        {r.added_at ? ` · ${new Date(r.added_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => { setPayerRules(removeRule(payerRules as any, r.match) as any); setRulesMsg('Removed. Press Save, then re-analyse any file it was affecting.') }}
                      className="text-[11.5px] text-[#AD4227] underline">Remove</button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-[#7A7266] mt-2.5 leading-[1.5]">
              Removing a rule does not change a file that has already been analysed. Press Re-analyse on that deal.
            </p>
          </div>
        </>
      )}

      {pane === 'connections' && (
      <section className="mb-10">
        <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-4 flex items-center gap-2"><span className="w-[5px] h-[5px] rounded-full bg-[#0E8FCB] inline-block shrink-0" />Bank Statement Collection (WealthDesk)</h2>
        <div className="border border-[#EDE7DD] rounded-xl p-5 bg-white">
          <p className="text-[11.5px] text-[#A29889] mb-3">This is the same static link shared with every client to collect bank statements. It's used on the client "ready to proceed" page and in the manual next-steps email.</p>
          <label className="text-[11px] font-semibold text-[#A29889] block mb-1">WealthDesk link</label>
          <input className="w-full text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF] font-mono" value={wealthDeskLink} onChange={(e) => setWealthDeskLink(e.target.value)} placeholder="https://simplify.wealthdesk.com.au/iv/tk/..." />
        </div>
      </section>
      )}
      {pane === 'notifications' && (
      <section className="mb-10">
        <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-4 flex items-center gap-2"><span className="w-[5px] h-[5px] rounded-full bg-[#0E8FCB] inline-block shrink-0" />Notification Routing</h2>
        <div className="border border-[#EDE7DD] rounded-xl p-5 bg-white space-y-4">
          <p className="text-[11.5px] text-[#A29889] mb-3">Who receives internal notification emails as deals move through the pipeline. Change this anytime without needing a code change.</p>
          <div>
            <label className="text-[11px] font-semibold text-[#A29889] block mb-1">When a new deal is created — who is asked to create the SalesTrekker card</label>
            <select className="w-full text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF]" value={newDealNotificationUserId} onChange={(e) => setNewDealNotificationUserId(e.target.value)}>
              <option value="">— select team member —</option>
              {userProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#A29889] block mb-1">When a deal moves stage — who is asked to move the SalesTrekker card</label>
            <select className="w-full text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF]" value={stageMoveNotificationUserId} onChange={(e) => setStageMoveNotificationUserId(e.target.value)}>
              <option value="">— select team member —</option>
              {userProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
        </div>
      </section>
      )}
      {pane === 'targets' && <PipelineTargets />}
      {pane === 'ai' && (
      <section className="mb-10">
        <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-4 flex items-center gap-2"><span className="w-[5px] h-[5px] rounded-full bg-[#0E8FCB] inline-block shrink-0" />AI expenses</h2>
        <AiExpenses />
      </section>
      )}
      {pane === 'commissions' && (
      <section className="mb-10">
        <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-4 flex items-center gap-2"><span className="w-[5px] h-[5px] rounded-full bg-[#0E8FCB] inline-block shrink-0" />Commission library</h2>
        <CommissionLibrary />
      </section>
      )}
      {pane === 'compliance' && (
      <section className="mb-10">
        <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-4 flex items-center gap-2"><span className="w-[5px] h-[5px] rounded-full bg-[#0E8FCB] inline-block shrink-0" />Compliance AI Style Notes</h2>
        <div className="border border-[#EDE7DD] rounded-xl p-5 bg-white">
          <p className="text-[11.5px] text-[#A29889] mb-3">Corrections and preferences you've given before, fed into every future Compliance AI generation across all deals — e.g. "Always mention offset account benefits" or "Keep the deposit comment to one sentence, no exceptions."</p>
          <div className="flex flex-col gap-2 mb-3">
            {complianceStyleNotes.map((note, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                <span className="flex-1">{note}</span>
                <button onClick={() => setComplianceStyleNotes(prev => prev.filter((_, idx) => idx !== i))} className="text-xs text-[#C9C1B4] hover:text-red-400">✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="flex-1 text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF]" value={newStyleNote} onChange={e => setNewStyleNote(e.target.value)} placeholder="Add a style note..." onKeyDown={e => { if (e.key === 'Enter' && newStyleNote.trim()) { setComplianceStyleNotes(prev => [...prev, newStyleNote.trim()]); setNewStyleNote('') } }} />
            <button onClick={() => { if (newStyleNote.trim()) { setComplianceStyleNotes(prev => [...prev, newStyleNote.trim()]); setNewStyleNote('') } }} className="text-[12.5px] font-semibold text-[#0E8FCB] bg-white border border-[#BFE6F9] rounded-lg px-4 py-2 hover:bg-[#EAF7FE] transition">Add</button>
          </div>
        </div>
      </section>
      )}
      {pane === 'compliance' && (
      <section className="mb-10">
        <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-4 flex items-center gap-2"><span className="w-[5px] h-[5px] rounded-full bg-[#0E8FCB] inline-block shrink-0" />Lending Options AI Style Notes</h2>
        <div className="border border-[#EDE7DD] rounded-xl p-5 bg-white">
          <p className="text-[11.5px] text-[#A29889] mb-3">The same idea for the LO recommendation paragraph. Kept apart from the Compliance notes on purpose — a correction about how a recommendation should read has no business changing a Compliance answer.</p>
          <div className="flex flex-col gap-2 mb-3">
            {loStyleNotes.map((note, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                <span className="flex-1">{note}</span>
                <button onClick={() => setLoStyleNotes(prev => prev.filter((_, idx) => idx !== i))} className="text-xs text-[#C9C1B4] hover:text-red-400">✕</button>
              </div>
            ))}
            {loStyleNotes.length === 0 && <p className="text-[11.5px] text-[#A29889]">None yet.</p>}
          </div>
          <div className="flex gap-2">
            <input className="flex-1 text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF]" value={newLoStyleNote} onChange={e => setNewLoStyleNote(e.target.value)} placeholder="Add a style note..." onKeyDown={e => { if (e.key === 'Enter' && newLoStyleNote.trim()) { setLoStyleNotes(prev => [...prev, newLoStyleNote.trim()]); setNewLoStyleNote('') } }} />
            <button onClick={() => { if (newLoStyleNote.trim()) { setLoStyleNotes(prev => [...prev, newLoStyleNote.trim()]); setNewLoStyleNote('') } }} className="text-[12.5px] font-semibold text-[#0E8FCB] bg-white border border-[#BFE6F9] rounded-lg px-4 py-2 hover:bg-[#EAF7FE] transition">Add</button>
          </div>
        </div>
      </section>
      )}
      {pane === 'compliance' && (
      <section className="mb-10">
        <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-4 flex items-center gap-2"><span className="w-[5px] h-[5px] rounded-full bg-[#0E8FCB] inline-block shrink-0" />Open Flags {complianceFlags.length > 0 && <span className="bg-amber-100 text-amber-600 rounded-full px-2 py-0.5 ml-1">{complianceFlags.length}</span>}</h2>
        <div className="border border-[#EDE7DD] rounded-xl p-5 bg-white">
          <p className="text-[11.5px] text-[#A29889] mb-3">Issues flagged by the team on live deals, from both Compliance and Lending Options. Promote a flag to turn it into a permanent Style Note applied to every future generation, or dismiss it if it doesn't need to become a standing rule.</p>
          {loadingFlags ? (
            <p className="text-[11.5px] text-[#A29889]">Loading...</p>
          ) : complianceFlags.length === 0 ? (
            <p className="text-[11.5px] text-[#A29889]">No open flags.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {complianceFlags.map((flag) => (
                <div key={flag.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11.5px] font-medium text-[#6E665C]">
                      <span className={`text-[9.5px] font-bold uppercase tracking-[.05em] rounded-full px-2 py-[1px] border mr-1.5 ${flag.stage === 'lo' ? 'bg-[#EAF7FE] border-[#BFE6F9] text-[#0E8FCB]' : 'bg-[#FAF7F2] border-[#E8E1D6] text-[#6E665C]'}`}>
                        {flag.stage === 'lo' ? 'LO' : 'Compliance'}
                      </span>
                      {flag.field_label} — {flag.deals?.deal_name || 'Unknown deal'}
                    </span>
                    <span className="text-[10px] text-[#C9C1B4]">{flag.flagged_by} · {new Date(flag.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm mb-2">{flag.note}</p>
                  <div className="flex gap-2">
                    <button onClick={() => promoteFlag(flag)} className="text-[11.5px] bg-[#343333] text-white rounded-lg px-3 py-1.5 hover:bg-[#2a2a2a]">
                      Promote to {flag.stage === 'lo' ? 'LO' : 'Compliance'} Style Note
                    </button>
                    <button onClick={() => dismissFlag(flag.id)} className="text-[11.5px] text-[#A29889] hover:text-[#2E2A26]">Dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      )}
      {pane === 'people' && (
      <section className="mb-10">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] flex items-center gap-2"><span className="w-[5px] h-[5px] rounded-full bg-[#0E8FCB] inline-block shrink-0" />Credit Team</h2>
        </div>
        <p className="text-[11.5px] text-[#A29889] mb-4">Manage who's on the credit team and which brokers' deals each person covers. This drives automatic allocation when a deal is sent to the credit team.</p>
        {creditTeamError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600 mb-4">{creditTeamError}</div>
        )}
        {loadingCreditTeam ? (
          <div className="text-[13px] text-[#A29889]">Loading credit team...</div>
        ) : (
          <>
            {creditOfficers.map((officer) => (
              <div key={officer.id} className="border border-[#EDE7DD] rounded-xl p-5 mb-4 bg-white">
                <div className="flex justify-between items-start mb-4">
                  <input className="font-semibold text-[#2E2A26] flex-1 border border-[#E8E1D6] rounded-lg px-3 py-2 focus:outline-none focus:border-[#2DBEFF]" value={officer.name} onChange={(e) => updateCreditOfficerName(officer.id, e.target.value)} placeholder="Credit officer name" />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[11.5px] text-[#6E665C] cursor-pointer">
                      <input type="checkbox" checked={officer.active} onChange={(e) => toggleCreditOfficerActive(officer.id, e.target.checked)} />
                      Active
                    </label>
                    <button onClick={() => removeCreditOfficer(officer.id)} className="text-[11.5px] text-[#A29889] hover:text-[#C4553B] transition">Remove</button>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-[11px] font-semibold text-[#A29889] block mb-1">Linked portal account (used for assignment notification emails)</label>
                  <select className="w-full text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF]" value={officer.userId || ''} onChange={(e) => linkCreditOfficerUser(officer.id, e.target.value)}>
                    <option value="">— not linked —</option>
                    {userProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>)}
                  </select>
                  {!officer.userId && <p className="text-xs text-amber-600 mt-1">⚠ No portal account linked — this person won't receive assignment emails until linked.</p>}
                </div>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#A29889] block mb-1">On leave from</label>
                    <input type="date" className="w-full text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF]" value={officer.onLeaveFrom || ''} onChange={(e) => updateCreditOfficerLeave(officer.id, 'onLeaveFrom', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#A29889] block mb-1">Until</label>
                    <input type="date" className="w-full text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF]" value={officer.onLeaveUntil || ''} onChange={(e) => updateCreditOfficerLeave(officer.id, 'onLeaveUntil', e.target.value)} />
                  </div>
                  {officer.onLeaveFrom && officer.onLeaveUntil && (
                    <p className="text-xs text-amber-600 col-span-2">🏖 Excluded from auto-allocation between {officer.onLeaveFrom} and {officer.onLeaveUntil}</p>
                  )}
                </div>
                <label className="text-[11px] font-semibold text-[#A29889] block mb-2">Covers deals for:</label>
                <div className="flex flex-wrap gap-2">
                  {brokerList.map((b) => {
                    const slug = b.key
                    const covers = officer.brokers.some(x => String(x).toLowerCase() === slug)
                    return (
                      <button key={b.key} onClick={() => toggleBrokerCoverage(officer.id, slug)}
                        className={`px-3 py-1.5 rounded-full text-[11.5px] font-medium border transition-colors ${covers ? 'bg-[#343333] border-[#343333] text-white' : 'border-[#E8E1D6] text-[#6E665C] hover:bg-[#FAF7F2] hover:text-[#2E2A26]'}`}>
                        {slug}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            <button onClick={addCreditOfficer} className="text-[12.5px] font-semibold text-[#0E8FCB] bg-white border border-[#BFE6F9] rounded-lg px-4 py-2 hover:bg-[#EAF7FE] transition">+ Add credit officer</button>
          </>
        )}
      </section>
      )}
    </div>
  )
}
