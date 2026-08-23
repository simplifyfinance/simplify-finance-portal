'use client'
import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import PipelineTargets from '@/components/PipelineTargets'

const supabase = createSupabaseBrowser()

const defaultBrands = [{ id: 'simplify', name: 'Simplify Finance', isDefault: true, headerColor: '#343333', accentColor: '#2DBEFF', acl: '387025', footerAddress: 'St Leonards, Sydney', logoUrl: '' }]
const defaultBrokers = [
  { id: 'fabio', name: 'Fabio de Castro', title: 'Director / Mortgage Broker', crn: '483807', email: 'fabio@simplifyfinance.com.au', calendly: 'https://calendly.com/fabiobroker', brandIds: ['simplify'] },
  { id: 'mark', name: 'Mark Gallo', title: 'Mortgage Broker', crn: '496195', email: 'mark@simplifyfinance.com.au', calendly: 'https://calendly.com/markgallo/phonecall', brandIds: ['simplify'] }
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
  const [brokers, setBrokers] = useState(defaultBrokers)
  const [wealthDeskLink, setWealthDeskLink] = useState('')
  const [newDealNotificationUserId, setNewDealNotificationUserId] = useState('')
  const [stageMoveNotificationUserId, setStageMoveNotificationUserId] = useState('')
  const [complianceStyleNotes, setComplianceStyleNotes] = useState<string[]>([])
  const [newStyleNote, setNewStyleNote] = useState('')
  const [complianceFlags, setComplianceFlags] = useState<any[]>([])
  const [loadingFlags, setLoadingFlags] = useState(true)

  async function loadComplianceFlags() {
    setLoadingFlags(true)
    const { data } = await supabase.from('compliance_flags').select('*, deals(deal_name)').eq('promoted', false).order('created_at', { ascending: false })
    if (data) setComplianceFlags(data)
    setLoadingFlags(false)
  }

  async function promoteFlag(flag: any) {
    const updatedNotes = [...complianceStyleNotes, flag.note]
    setComplianceStyleNotes(updatedNotes)
    await supabase.from('settings').upsert({ id: 'singleton', compliance_style_notes: updatedNotes, updated_at: new Date().toISOString() })
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
    const { error } = await supabase.from('settings').upsert({
      id: 'singleton',
      brands,
      brokers,
      wealth_desk_link: wealthDeskLink,
      new_deal_notification_user_id: newDealNotificationUserId || null,
      stage_move_notification_user_id: stageMoveNotificationUserId || null,
      compliance_style_notes: complianceStyleNotes,
      updated_at: new Date().toISOString()
    })
    setSaving(false)
    if (error) { alert('Error saving settings: ' + error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function brokerSlug(name: string) {
    return name.split(' ')[0]
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
      await supabase.from('credit_officer_brokers').delete().eq('credit_officer_id', officerId).eq('broker_slug', slug)
    } else {
      await supabase.from('credit_officer_brokers').insert({ credit_officer_id: officerId, broker_slug: slug })
    }
  }

  // Which pane is showing. Driven by the URL hash so the sidebar can steer it and a
  // link to a particular setting can be shared.
  const PANES: { key: string; label: string; blurb: string }[] = [
    { key: 'brands', label: 'Brands', blurb: 'Trading names used on deals and client emails.' },
    { key: 'brokers', label: 'Broker profiles', blurb: 'Credit representative numbers, signatures and contact details used on documents.' },
    { key: 'targets', label: 'Targets', blurb: 'Monthly lodged and settled targets by financial year. Drives the Pipeline comparison panel.' },
    { key: 'people', label: 'Credit team', blurb: 'Who covers which broker.' },
    { key: 'notifications', label: 'Notifications', blurb: 'Who is emailed as deals move through the pipeline.' },
    { key: 'compliance', label: 'Compliance AI', blurb: 'Style notes and flags fed into every Compliance generation.' },
    { key: 'connections', label: 'Connections', blurb: 'Bank statement collection and other outside services.' },
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
        <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-4">Brands</h2>
        {brands.map((brand) => (
          <div key={brand.id} className="border border-[#EDE7DD] rounded-xl p-5 mb-4 bg-white">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <input className="font-semibold text-[#2E2A26] text-[13.5px] border border-[#E8E1D6] rounded-lg px-3 py-1.5 w-full max-w-xs mb-1 focus:outline-none focus:border-[#2DBEFF]" value={brand.name} onChange={(e) => setBrands(brands.map(b => b.id === brand.id ? {...b, name: e.target.value} : b))} placeholder="Brand name" />
                <p className="text-[11.5px] text-[#A29889]">{brand.isDefault ? 'Default brand' : 'Additional brand'}</p>
              </div>
              <div className="flex items-center gap-2">
                {brand.isDefault && <span className="text-[10.5px] bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] px-2.5 py-1 rounded-full font-semibold">Default</span>}
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
        <button onClick={() => setBrands([...brands, {id: Date.now().toString(), name: 'New Brand', isDefault: false, headerColor: '#343333', accentColor: '#2DBEFF', acl: '387025', footerAddress: 'St Leonards, Sydney', logoUrl: ''}])} className="text-[12.5px] font-medium text-[#6E665C] bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg px-4 py-2 hover:bg-[#F4EEE4] hover:text-[#2E2A26] transition">+ Add another brand</button>
      </section>
      )}
      {pane === 'brokers' && (
      <section className="mb-10">
        <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-4">Broker Profiles</h2>
        {brokers.map((broker) => (
          <div key={broker.id} className="border border-[#EDE7DD] rounded-xl p-5 mb-4 bg-white">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <input className="font-semibold text-[#2E2A26] w-full border border-[#E8E1D6] rounded-lg px-3 py-2 focus:outline-none focus:border-[#2DBEFF] mb-1" value={broker.name} onChange={(e) => setBrokers(brokers.map(b => b.id === broker.id ? {...b, name: e.target.value} : b))} placeholder="Broker name" />
              </div>
              <button onClick={() => setBrokers(brokers.filter(b => b.id !== broker.id))} className="text-[11.5px] text-[#A29889] hover:text-[#C4553B] transition">Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[11px] font-semibold text-[#A29889] block mb-1">Title</label><input className="w-full text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF]" value={broker.title} onChange={(e) => setBrokers(brokers.map(b => b.id === broker.id ? {...b, title: e.target.value} : b))} /></div>
              <div><label className="text-[11px] font-semibold text-[#A29889] block mb-1">CR number</label><input className="w-full text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF]" value={broker.crn} onChange={(e) => setBrokers(brokers.map(b => b.id === broker.id ? {...b, crn: e.target.value} : b))} placeholder="e.g. 123456 — placeholder until confirmed" /></div>
              <div><label className="text-[11px] font-semibold text-[#A29889] block mb-1">Calendly link</label><input className="w-full text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF] font-mono" value={broker.calendly} onChange={(e) => setBrokers(brokers.map(b => b.id === broker.id ? {...b, calendly: e.target.value} : b))} /></div>
              <div><label className="text-[11px] font-semibold text-[#A29889] block mb-1">Email</label><input className="w-full text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF]" value={broker.email} onChange={(e) => setBrokers(brokers.map(b => b.id === broker.id ? {...b, email: e.target.value} : b))} /></div>
            </div>
            <div className="mt-3">
              <label className="text-[11px] font-semibold text-[#A29889] block mb-2">Brands (a broker can work under multiple brands)</label>
              <div className="flex flex-wrap gap-2">
                {brands.map((brand) => {
                  const has = ((broker as any).brandIds || []).includes(brand.id)
                  return (
                    <button key={brand.id} onClick={() => toggleBrokerBrand(broker.id, brand.id)}
                      className={`px-3 py-1.5 rounded-full text-[11.5px] font-medium border transition-colors ${has ? 'bg-[#343333] border-[#343333] text-white' : 'border-[#E8E1D6] text-[#6E665C] hover:bg-[#FAF7F2] hover:text-[#2E2A26]'}`}>
                      {brand.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
        <button onClick={() => setBrokers([...brokers, {id: Date.now().toString(), name: 'New Broker', title: 'Mortgage Broker', crn: '', email: '', calendly: '', brandIds: ['simplify']}])} className="text-[12.5px] font-medium text-[#6E665C] bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg px-4 py-2 hover:bg-[#F4EEE4] hover:text-[#2E2A26] transition">+ Add another broker</button>
        <p className="text-[11.5px] text-[#A29889] mt-2">Note: broker names should start with the first name used elsewhere in the portal (e.g. "Fabio", "Justin") — this is what links a broker to their deals and credit team coverage below.</p>
      </section>
      )}
      {pane === 'connections' && (
      <section className="mb-10">
        <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-4">Bank Statement Collection (WealthDesk)</h2>
        <div className="border border-[#EDE7DD] rounded-xl p-5 bg-white">
          <p className="text-[11.5px] text-[#A29889] mb-3">This is the same static link shared with every client to collect bank statements. It's used on the client "ready to proceed" page and in the manual next-steps email.</p>
          <label className="text-[11px] font-semibold text-[#A29889] block mb-1">WealthDesk link</label>
          <input className="w-full text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF] font-mono" value={wealthDeskLink} onChange={(e) => setWealthDeskLink(e.target.value)} placeholder="https://simplify.wealthdesk.com.au/iv/tk/..." />
        </div>
      </section>
      )}
      {pane === 'notifications' && (
      <section className="mb-10">
        <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-4">Notification Routing</h2>
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
      {pane === 'compliance' && (
      <section className="mb-10">
        <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-4">Compliance AI Style Notes</h2>
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
            <button onClick={() => { if (newStyleNote.trim()) { setComplianceStyleNotes(prev => [...prev, newStyleNote.trim()]); setNewStyleNote('') } }} className="text-[12.5px] font-medium text-[#6E665C] bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg px-4 py-2 hover:bg-[#F4EEE4] hover:text-[#2E2A26] transition">Add</button>
          </div>
        </div>
      </section>
      )}
      {pane === 'compliance' && (
      <section className="mb-10">
        <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-4">Compliance AI Flags {complianceFlags.length > 0 && <span className="bg-amber-100 text-amber-600 rounded-full px-2 py-0.5 ml-1">{complianceFlags.length}</span>}</h2>
        <div className="border border-[#EDE7DD] rounded-xl p-5 bg-white">
          <p className="text-[11.5px] text-[#A29889] mb-3">Issues flagged by the team on live deals. Promote a flag to turn it into a permanent Style Note applied to every future generation, or dismiss it if it doesn't need to become a standing rule.</p>
          {loadingFlags ? (
            <p className="text-[11.5px] text-[#A29889]">Loading...</p>
          ) : complianceFlags.length === 0 ? (
            <p className="text-[11.5px] text-[#A29889]">No open flags.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {complianceFlags.map((flag) => (
                <div key={flag.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11.5px] font-medium text-[#6E665C]">{flag.field_label} — {flag.deals?.deal_name || 'Unknown deal'}</span>
                    <span className="text-[10px] text-[#C9C1B4]">{flag.flagged_by} · {new Date(flag.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm mb-2">{flag.note}</p>
                  <div className="flex gap-2">
                    <button onClick={() => promoteFlag(flag)} className="text-[11.5px] bg-[#343333] text-white rounded-lg px-3 py-1.5 hover:bg-[#2a2a2a]">Promote to Style Note</button>
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
          <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em]">Credit Team</h2>
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
                  {brokers.map((b) => {
                    const slug = brokerSlug(b.name)
                    const covers = officer.brokers.includes(slug)
                    return (
                      <button key={b.id} onClick={() => toggleBrokerCoverage(officer.id, slug)}
                        className={`px-3 py-1.5 rounded-full text-[11.5px] font-medium border transition-colors ${covers ? 'bg-[#343333] border-[#343333] text-white' : 'border-[#E8E1D6] text-[#6E665C] hover:bg-[#FAF7F2] hover:text-[#2E2A26]'}`}>
                        {slug}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            <button onClick={addCreditOfficer} className="text-[12.5px] font-medium text-[#6E665C] bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg px-4 py-2 hover:bg-[#F4EEE4] hover:text-[#2E2A26] transition">+ Add credit officer</button>
          </>
        )}
      </section>
      )}
    </div>
  )
}
