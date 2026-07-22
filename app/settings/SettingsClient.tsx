'use client'
import LenderLibrary from '@/components/LenderLibrary'
import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

const supabase = createSupabaseBrowser()

const defaultBrands = [{ id: 'simplify', name: 'Simplify Finance', isDefault: true, headerColor: '#343333', accentColor: '#2DBEFF', acl: '387025', footerAddress: 'St Leonards, Sydney' }]
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
  const [complianceStyleNotes, setComplianceStyleNotes] = useState<string[]>([])
  const [newStyleNote, setNewStyleNote] = useState('')
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
        if (data.compliance_style_notes?.length) setComplianceStyleNotes(data.compliance_style_notes)
      }
      setLoading(false)
    }
    load()
    loadCreditTeam()
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
        brokers: (links || []).filter((l: any) => l.credit_officer_id === o.id).map((l: any) => l.broker_slug)
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
    if (data) setCreditOfficers([...creditOfficers, { id: data.id, name: data.name, active: data.active, userId: null, brokers: [] }])
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

  if (loading) return <div className="p-8 max-w-3xl mx-auto text-sm text-gray-400">Loading settings...</div>

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-1">
        <h1 className="text-2xl font-bold text-[#343333]">Settings</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm bg-[#2DBEFF] text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-400 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save settings'}
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-8">Manage your brands and broker profiles</p>
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Brands</h2>
        {brands.map((brand) => (
          <div key={brand.id} className="border border-gray-200 rounded-xl p-5 mb-4 bg-white">
            <div className="flex justify-between items-start mb-4">
              <div><p className="font-semibold text-[#343333]">{brand.name}</p><p className="text-xs text-gray-400">{brand.isDefault ? 'Default brand' : 'Additional brand'}</p></div>
              {brand.isDefault && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Default</span>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-400 block mb-1">Header colour</label><div className="flex items-center gap-2"><input type="color" value={brand.headerColor} className="w-8 h-8 rounded cursor-pointer border border-gray-200" onChange={(e) => setBrands(brands.map(b => b.id === brand.id ? {...b, headerColor: e.target.value} : b))} /><span className="text-sm font-mono text-gray-600">{brand.headerColor}</span></div></div>
              <div><label className="text-xs text-gray-400 block mb-1">Accent colour</label><div className="flex items-center gap-2"><input type="color" value={brand.accentColor} className="w-8 h-8 rounded cursor-pointer border border-gray-200" onChange={(e) => setBrands(brands.map(b => b.id === brand.id ? {...b, accentColor: e.target.value} : b))} /><span className="text-sm font-mono text-gray-600">{brand.accentColor}</span></div></div>
              <div><label className="text-xs text-gray-400 block mb-1">ACL number</label><input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" value={brand.acl} onChange={(e) => setBrands(brands.map(b => b.id === brand.id ? {...b, acl: e.target.value} : b))} /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Footer address</label><input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" value={brand.footerAddress} onChange={(e) => setBrands(brands.map(b => b.id === brand.id ? {...b, footerAddress: e.target.value} : b))} /></div>
            </div>
          </div>
        ))}
        <button onClick={() => setBrands([...brands, {id: Date.now().toString(), name: 'New Brand', isDefault: false, headerColor: '#343333', accentColor: '#2DBEFF', acl: '387025', footerAddress: 'St Leonards, Sydney'}])} className="text-sm text-[#2DBEFF] border border-dashed border-[#2DBEFF] rounded-lg px-4 py-2 hover:bg-blue-50 transition">+ Add another brand</button>
      </section>
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Broker Profiles</h2>
        {brokers.map((broker) => (
          <div key={broker.id} className="border border-gray-200 rounded-xl p-5 mb-4 bg-white">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <input className="font-semibold text-[#343333] w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#2DBEFF] mb-1" value={broker.name} onChange={(e) => setBrokers(brokers.map(b => b.id === broker.id ? {...b, name: e.target.value} : b))} placeholder="Broker name" />
              </div>
              <button onClick={() => setBrokers(brokers.filter(b => b.id !== broker.id))} className="text-xs text-red-400 hover:text-red-600">Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-400 block mb-1">Title</label><input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" value={broker.title} onChange={(e) => setBrokers(brokers.map(b => b.id === broker.id ? {...b, title: e.target.value} : b))} /></div>
              <div><label className="text-xs text-gray-400 block mb-1">CR number</label><input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" value={broker.crn} onChange={(e) => setBrokers(brokers.map(b => b.id === broker.id ? {...b, crn: e.target.value} : b))} placeholder="e.g. 123456 — placeholder until confirmed" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Calendly link</label><input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono" value={broker.calendly} onChange={(e) => setBrokers(brokers.map(b => b.id === broker.id ? {...b, calendly: e.target.value} : b))} /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Email</label><input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" value={broker.email} onChange={(e) => setBrokers(brokers.map(b => b.id === broker.id ? {...b, email: e.target.value} : b))} /></div>
            </div>
            <div className="mt-3">
              <label className="text-xs text-gray-400 block mb-2">Brands (a broker can work under multiple brands)</label>
              <div className="flex flex-wrap gap-2">
                {brands.map((brand) => {
                  const has = ((broker as any).brandIds || []).includes(brand.id)
                  return (
                    <button key={brand.id} onClick={() => toggleBrokerBrand(broker.id, brand.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${has ? 'bg-[#2DBEFF] border-[#2DBEFF] text-white' : 'border-gray-200 text-gray-500 hover:border-[#2DBEFF] hover:text-[#2DBEFF]'}`}>
                      {brand.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
        <button onClick={() => setBrokers([...brokers, {id: Date.now().toString(), name: 'New Broker', title: 'Mortgage Broker', crn: '', email: '', calendly: '', brandIds: ['simplify']}])} className="text-sm text-[#2DBEFF] border border-dashed border-[#2DBEFF] rounded-lg px-4 py-2 hover:bg-blue-50 transition">+ Add another broker</button>
        <p className="text-xs text-gray-400 mt-2">Note: broker names should start with the first name used elsewhere in the portal (e.g. "Fabio", "Justin") — this is what links a broker to their deals and credit team coverage below.</p>
      </section>
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Bank Statement Collection (WealthDesk)</h2>
        <div className="border border-gray-200 rounded-xl p-5 bg-white">
          <p className="text-xs text-gray-400 mb-3">This is the same static link shared with every client to collect bank statements. It's used on the client "ready to proceed" page and in the manual next-steps email.</p>
          <label className="text-xs text-gray-400 block mb-1">WealthDesk link</label>
          <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono" value={wealthDeskLink} onChange={(e) => setWealthDeskLink(e.target.value)} placeholder="https://simplify.wealthdesk.com.au/iv/tk/..." />
        </div>
      </section>
      <section className="mb-10">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Credit Team</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">Manage who's on the credit team and which brokers' deals each person covers. This drives automatic allocation when a deal is sent to the credit team.</p>
        {creditTeamError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600 mb-4">{creditTeamError}</div>
        )}
        {loadingCreditTeam ? (
          <div className="text-sm text-gray-400">Loading credit team...</div>
        ) : (
          <>
            {creditOfficers.map((officer) => (
              <div key={officer.id} className="border border-gray-200 rounded-xl p-5 mb-4 bg-white">
                <div className="flex justify-between items-start mb-4">
                  <input className="font-semibold text-[#343333] flex-1 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#2DBEFF]" value={officer.name} onChange={(e) => updateCreditOfficerName(officer.id, e.target.value)} placeholder="Credit officer name" />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                      <input type="checkbox" checked={officer.active} onChange={(e) => toggleCreditOfficerActive(officer.id, e.target.checked)} />
                      Active
                    </label>
                    <button onClick={() => removeCreditOfficer(officer.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-xs text-gray-400 block mb-1">Linked portal account (used for assignment notification emails)</label>
                  <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" value={officer.userId || ''} onChange={(e) => linkCreditOfficerUser(officer.id, e.target.value)}>
                    <option value="">— not linked —</option>
                    {userProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>)}
                  </select>
                  {!officer.userId && <p className="text-xs text-amber-600 mt-1">⚠ No portal account linked — this person won't receive assignment emails until linked.</p>}
                </div>
                <label className="text-xs text-gray-400 block mb-2">Covers deals for:</label>
                <div className="flex flex-wrap gap-2">
                  {brokers.map((b) => {
                    const slug = brokerSlug(b.name)
                    const covers = officer.brokers.includes(slug)
                    return (
                      <button key={b.id} onClick={() => toggleBrokerCoverage(officer.id, slug)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${covers ? 'bg-[#2DBEFF] border-[#2DBEFF] text-white' : 'border-gray-200 text-gray-500 hover:border-[#2DBEFF] hover:text-[#2DBEFF]'}`}>
                        {slug}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            <button onClick={addCreditOfficer} className="text-sm text-[#2DBEFF] border border-dashed border-[#2DBEFF] rounded-lg px-4 py-2 hover:bg-blue-50 transition">+ Add credit officer</button>
          </>
        )}
      </section>
      <LenderLibrary />
    </div>
  )
}
