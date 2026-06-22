'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

type Lender = {
  id: string
  name: string
  product_name: string
  annual_fee: number
  monthly_fee: number
  settlement_fee: number
  offset_account: boolean
  multiple_offsets: boolean
  offset_count: number
  active: boolean
}

const empty = { name: '', product_name: '', annual_fee: 0, monthly_fee: 0, settlement_fee: 0, offset_account: false, multiple_offsets: false, offset_count: 0 }

export default function LenderLibrary() {
  const [lenders, setLenders] = useState<Lender[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ ...empty })
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const supabase = createSupabaseBrowser()

  useEffect(() => { fetchLenders() }, [])

  async function fetchLenders() {
    const { data } = await supabase.from('lenders').select('*').order('name')
    if (data) setLenders(data)
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    if (editId) {
      await supabase.from('lenders').update(form).eq('id', editId)
    } else {
      await supabase.from('lenders').insert({ ...form, active: true })
    }
    await fetchLenders()
    setShowAdd(false)
    setEditId(null)
    setForm({ ...empty })
    setSaving(false)
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('lenders').update({ active: !active }).eq('id', id)
    setLenders(lenders.map(l => l.id === id ? { ...l, active: !active } : l))
  }

  function startEdit(lender: Lender) {
    setForm({ name: lender.name, product_name: lender.product_name, annual_fee: lender.annual_fee, monthly_fee: lender.monthly_fee, settlement_fee: lender.settlement_fee, offset_account: lender.offset_account, multiple_offsets: lender.multiple_offsets, offset_count: lender.offset_count })
    setEditId(lender.id)
    setShowAdd(true)
  }

  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF]"

  return (
    <section className="mb-10">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Lender Library</h2>
        <button onClick={() => { setShowAdd(!showAdd); setEditId(null); setForm({ ...empty }) }}
          className="text-sm text-[#2DBEFF] border border-dashed border-[#2DBEFF] rounded-lg px-4 py-1.5 hover:bg-blue-50 transition">
          + Add lender
        </button>
      </div>

      {showAdd && (
        <div className="border border-gray-200 rounded-xl p-5 mb-4 bg-blue-50/20">
          <p className="text-sm font-medium text-[#343333] mb-4">{editId ? 'Edit lender' : 'Add new lender'}</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className="text-xs text-gray-400 block mb-1">Lender name</label><input className={inp} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Westpac" /></div>
            <div><label className="text-xs text-gray-400 block mb-1">Product name</label><input className={inp} value={form.product_name} onChange={e => setForm({...form, product_name: e.target.value})} placeholder="e.g. Premier Advantage" /></div>
            <div><label className="text-xs text-gray-400 block mb-1">Annual fee ($)</label><input type="number" className={inp} value={form.annual_fee} onChange={e => setForm({...form, annual_fee: +e.target.value})} /></div>
            <div><label className="text-xs text-gray-400 block mb-1">Monthly fee ($)</label><input type="number" className={inp} value={form.monthly_fee} onChange={e => setForm({...form, monthly_fee: +e.target.value})} /></div>
            <div><label className="text-xs text-gray-400 block mb-1">Settlement fee ($)</label><input type="number" className={inp} value={form.settlement_fee} onChange={e => setForm({...form, settlement_fee: +e.target.value})} /></div>
            <div><label className="text-xs text-gray-400 block mb-1">Number of offset accounts</label><input type="number" className={inp} value={form.offset_count} onChange={e => setForm({...form, offset_count: +e.target.value})} placeholder="0 = none" /></div>
          </div>
          <div className="flex gap-6 mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={form.offset_account} onChange={e => setForm({...form, offset_account: e.target.checked})} />Offset account</label>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={form.multiple_offsets} onChange={e => setForm({...form, multiple_offsets: e.target.checked})} />Multiple offsets</label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="bg-[#343333] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#2a2a2a] transition disabled:opacity-50">{saving ? 'Saving...' : editId ? 'Update lender' : 'Add lender'}</button>
            <button onClick={() => { setShowAdd(false); setEditId(null); setForm({...empty}) }} className="text-sm text-gray-400 hover:text-gray-600 px-3">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-sm text-gray-400">Loading lenders...</p> : (
        <div className="space-y-2">
          {lenders.map(lender => (
            <div key={lender.id} className={`border border-gray-200 rounded-xl px-5 py-3 bg-white flex items-center justify-between gap-4 ${!lender.active ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#343333]">{lender.name} — {lender.product_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {lender.annual_fee > 0 ? `Annual $${lender.annual_fee} · ` : ''}
                  {lender.monthly_fee > 0 ? `Monthly $${lender.monthly_fee} · ` : ''}
                  {lender.settlement_fee > 0 ? `Settlement $${lender.settlement_fee} · ` : ''}
                  {lender.offset_account ? `${lender.offset_count > 1 ? lender.offset_count + ' offsets' : '1 offset'}` : 'No offset'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => startEdit(lender)} className="text-xs text-[#2DBEFF] hover:underline">Edit</button>
                <button onClick={() => toggleActive(lender.id, lender.active)}
                  className={`text-xs px-3 py-1 rounded-lg border transition ${lender.active ? 'border-red-200 text-red-400 hover:bg-red-50' : 'border-green-200 text-green-500 hover:bg-green-50'}`}>
                  {lender.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
