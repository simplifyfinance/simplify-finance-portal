'use client'
import TeamSection from '@/components/TeamSection'
import LenderLibrary from '@/components/LenderLibrary'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const defaultBrands = [{ id: 'simplify', name: 'Simplify Finance', isDefault: true, headerColor: '#343333', accentColor: '#2DBEFF', acl: '387025', footerAddress: 'St Leonards, Sydney' }]
const defaultBrokers = [
  { id: 'fabio', name: 'Fabio de Castro', title: 'Director / Mortgage Broker', crn: '483807', email: 'fabio@simplifyfinance.com.au', calendly: 'https://calendly.com/fabiobroker' },
  { id: 'mark', name: 'Mark Gallo', title: 'Mortgage Broker', crn: '496195', email: 'mark@simplifyfinance.com.au', calendly: 'https://calendly.com/markgallo/phonecall' }
]

export default function SettingsPage() {
  const [brands, setBrands] = useState(defaultBrands)
  const [brokers, setBrokers] = useState(defaultBrokers)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('settings').select('*').eq('id', 'singleton').single()
      if (data) {
        if (data.brands?.length) setBrands(data.brands)
        if (data.brokers?.length) setBrokers(data.brokers)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    await supabase.from('settings').upsert({
      id: 'singleton',
      brands,
      brokers,
      updated_at: new Date().toISOString()
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
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
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Broker Profiles</h2>
        {brokers.map((broker) => (
          <div key={broker.id} className="border border-gray-200 rounded-xl p-5 mb-4 bg-white">
            <div className="flex justify-between items-start mb-4">
              <div><p className="font-semibold text-[#343333]">{broker.name}</p><p className="text-xs text-gray-400">{broker.title} — CR No. {broker.crn}</p></div>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Active</span>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div><label className="text-xs text-gray-400 block mb-1">Calendly link</label><input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono" value={broker.calendly} onChange={(e) => setBrokers(brokers.map(b => b.id === broker.id ? {...b, calendly: e.target.value} : b))} /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Email</label><input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" value={broker.email} onChange={(e) => setBrokers(brokers.map(b => b.id === broker.id ? {...b, email: e.target.value} : b))} /></div>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
