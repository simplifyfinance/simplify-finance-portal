'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import BrokerTargets from '@/components/BrokerTargets'

type Broker = {
  broker_key: string
  name: string
  title: string | null
  crn: string | null
  calendly: string | null
  brand_ids: string[]
  active: boolean
  user_id: string | null
}
type Login = { id: string; full_name: string; broker_key: string | null }

function suggestKey(name: string): string {
  return (name || '').trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
}

// One record per broker. It exists whether or not they have a login - a broker can
// predate their account or outlast it, while their CRN still has to appear on
// documents.
export default function BrokerProfiles({ brands }: { brands: { id: string; name: string }[] }) {
  const supabase = createSupabaseBrowser()
  const [rows, setRows] = useState<Broker[]>([])
  const [logins, setLogins] = useState<Login[]>([])
  const [draft, setDraft] = useState<Record<string, Partial<Broker>>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKey, setNewKey] = useState('')
  const [err, setErr] = useState('')

  async function load() {
    const [b, u] = await Promise.all([
      supabase.from('brokers').select('*').order('name'),
      supabase.from('user_profiles').select('id, full_name, broker_key').not('broker_key', 'is', null),
    ])
    if (b.error) { setErr(b.error.message); setLoading(false); return }
    setRows((b.data || []).map((r: any) => ({ ...r, brand_ids: Array.isArray(r.brand_ids) ? r.brand_ids : [] })))
    setLogins((u.data || []) as Login[])
    setDraft({})
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function val<K extends keyof Broker>(r: Broker, field: K): any {
    const d = draft[r.broker_key]
    return d && field in d ? (d as any)[field] : r[field]
  }
  function edit(key: string, patch: Partial<Broker>) {
    setDraft(p => ({ ...p, [key]: { ...(p[key] || {}), ...patch } }))
    setMsg(m => ({ ...m, [key]: '' }))
  }
  const dirty = (key: string) => !!draft[key] && Object.keys(draft[key]).length > 0

  async function save(r: Broker) {
    setBusy(r.broker_key)
    setMsg(m => ({ ...m, [r.broker_key]: '' }))
    const patch: any = { ...draft[r.broker_key], updated_at: new Date().toISOString() }
    const { data, error } = await supabase.from('brokers').update(patch).eq('broker_key', r.broker_key).select('broker_key')
    setBusy('')
    if (error) { setMsg(m => ({ ...m, [r.broker_key]: 'NOT SAVED - ' + error.message })); return }
    if (!data || data.length === 0) { setMsg(m => ({ ...m, [r.broker_key]: 'NOT SAVED - the database refused the change.' })); return }
    await load()
    setMsg(m => ({ ...m, [r.broker_key]: 'Saved.' }))
  }

  async function addBroker() {
    const name = newName.trim()
    const key = (newKey.trim() || suggestKey(name)).toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!name || !key) return
    setErr('')
    if (rows.some(r => r.broker_key === key)) { setErr(`The key "${key}" is already taken by ${rows.find(r => r.broker_key === key)!.name}.`); return }
    const { data, error } = await supabase.from('brokers')
      .insert({ broker_key: key, name, title: 'Mortgage Broker', brand_ids: ['simplify'] }).select('broker_key')
    if (error) { setErr(error.message); return }
    if (!data || data.length === 0) { setErr('The database refused the new broker.'); return }
    await load()
    setAdding(false); setNewName(''); setNewKey('')
  }

  async function remove(r: Broker) {
    const { count } = await supabase.from('pipeline_targets')
      .select('id', { count: 'exact', head: true }).ilike('broker_key', r.broker_key)
    if ((count || 0) > 0) {
      setMsg(m => ({ ...m, [r.broker_key]: `Not deleted — ${r.name} has ${count} targets. Deactivate instead, which keeps the record and the history.` }))
      return
    }
    if (!confirm(`Delete ${r.name}? Their CR number goes with them, so any document that needs it can no longer render one.`)) return
    const { data, error } = await supabase.from('brokers').delete().eq('broker_key', r.broker_key).select('broker_key')
    if (error) { setMsg(m => ({ ...m, [r.broker_key]: 'NOT DELETED - ' + error.message })); return }
    if (!data || data.length === 0) { setMsg(m => ({ ...m, [r.broker_key]: 'NOT DELETED - the database refused it.' })); return }
    await load()
  }

  const field = 'w-full text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF]'
  const label = 'text-[11px] font-semibold text-[#A29889] block mb-1'

  if (loading) return <p className="text-[13px] text-[#A29889]">Loading brokers…</p>
  if (err) return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{err}</div>

  return (
    <section className="mb-10">
      <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-4 flex items-center gap-2">
        <span className="w-[5px] h-[5px] rounded-full bg-[#0E8FCB] inline-block shrink-0" />Broker Profiles
      </h2>

      {rows.map(r => {
        const login = logins.find(l => (l.broker_key || '').toLowerCase() === r.broker_key)
        const nameDrift = !!login && login.full_name.trim().toLowerCase() !== String(val(r, 'name')).trim().toLowerCase()
        const m = msg[r.broker_key] || ''
        const failed = m.startsWith('NOT ')
        return (
          <div key={r.broker_key} className={`border rounded-xl p-5 mb-4 bg-white ${val(r, 'active') ? 'border-[#EDE7DD]' : 'border-[#EDE7DD] opacity-60'}`}>
            <div className="flex justify-between items-start gap-3 mb-3 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <input className="font-semibold text-[#2E2A26] w-full border border-[#E8E1D6] rounded-lg px-3 py-2 focus:outline-none focus:border-[#2DBEFF]"
                  value={val(r, 'name')} onChange={e => edit(r.broker_key, { name: e.target.value })} placeholder="Broker name" />
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[11px] font-mono text-[#A29889]">key: {r.broker_key}</span>
                  {login
                    ? <span className="text-[10px] font-bold uppercase tracking-[.05em] bg-[#F1F7F3] border border-[#CFE6D5] text-[#25794C] rounded-full px-2 py-[2px]">Has a login</span>
                    : <span className="text-[10px] font-bold uppercase tracking-[.05em] bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-full px-2 py-[2px]">No login yet</span>}
                  {!val(r, 'crn') && <span className="text-[10px] font-bold uppercase tracking-[.05em] bg-[#FBEDE9] border border-[#EFCFC5] text-[#C4553B] rounded-full px-2 py-[2px]">No CR number</span>}
                </div>
              </div>
              <div className="flex gap-3 items-center shrink-0">
                <label className="inline-flex items-center gap-2 text-[12px] text-[#6E665C] cursor-pointer">
                  <input type="checkbox" checked={!!val(r, 'active')} onChange={e => edit(r.broker_key, { active: e.target.checked })} />
                  Active
                </label>
                <button onClick={() => remove(r)} className="text-[11.5px] text-[#A29889] hover:text-[#C4553B] transition">Delete</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Title</label>
                <input className={field} value={val(r, 'title') || ''} onChange={e => edit(r.broker_key, { title: e.target.value })} />
              </div>
              <div>
                <label className={label}>CR number</label>
                <input className={field + (!val(r, 'crn') ? ' border-[#EFCFC5] bg-[#FDF7F5]' : '')}
                  value={val(r, 'crn') || ''} onChange={e => edit(r.broker_key, { crn: e.target.value })}
                  placeholder="goes on client documents" />
              </div>
              <div>
                <label className={label}>Calendly link</label>
                <input className={field + ' font-mono'} value={val(r, 'calendly') || ''} onChange={e => edit(r.broker_key, { calendly: e.target.value })} />
              </div>
              <div>
                <label className={label}>Login</label>
                <div className="text-[13px] text-[#6E665C] py-2">
                  {login ? login.full_name : <span className="text-[#A29889]">none — invite them in Team with the key “{r.broker_key}”</span>}
                </div>
              </div>
            </div>

            {nameDrift && login && (
              <div className="flex items-start gap-3 bg-[#FDF6E7] border border-[#EFE0BC] rounded-lg px-3 py-2.5 mt-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#B4761F" strokeWidth="1.6" strokeLinecap="round" className="shrink-0 mt-[2px]"><circle cx="8" cy="8" r="6.2"/><path d="M8 5v3.4M8 10.8v.2"/></svg>
                <span className="text-[12px] text-[#7A5F17] flex-1">
                  Their login reads &ldquo;{login.full_name}&rdquo;. Saving here does not change it.
                </span>
                <button onClick={async () => {
                    const { data } = await supabase.from('user_profiles')
                      .update({ full_name: String(val(r, 'name')).trim() }).eq('id', login.id).select('id')
                    if (data && data.length) { await load(); setMsg(mm => ({ ...mm, [r.broker_key]: 'Login name updated too.' })) }
                    else setMsg(mm => ({ ...mm, [r.broker_key]: 'NOT SAVED - the database refused the login name change.' }))
                  }}
                  className="text-[12px] font-semibold text-[#0E8FCB] bg-white border border-[#BFE6F9] rounded-lg px-3 py-1.5 hover:bg-[#EAF7FE] transition whitespace-nowrap shrink-0">
                  Use this name everywhere
                </button>
              </div>
            )}

            <div className="mt-3">
              <label className={label + ' mb-2'}>Brands (a broker can work under multiple brands)</label>
              <div className="flex flex-wrap gap-2">
                {brands.map(brand => {
                  const list: string[] = val(r, 'brand_ids') || []
                  const has = list.includes(brand.id)
                  return (
                    <button key={brand.id}
                      onClick={() => edit(r.broker_key, { brand_ids: has ? list.filter(x => x !== brand.id) : [...list, brand.id] })}
                      className={`px-3 py-1.5 rounded-full text-[11.5px] font-medium border transition-colors ${has ? 'bg-[#343333] border-[#343333] text-white' : 'border-[#E8E1D6] text-[#6E665C] hover:bg-[#FAF7F2] hover:text-[#2E2A26]'}`}>
                      {brand.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
              <span className={`text-[12px] ${failed ? 'text-[#C4553B] font-medium' : 'text-[#A29889]'}`}>
                {m || (dirty(r.broker_key) ? 'Unsaved changes.' : '')}
              </span>
              <button onClick={() => save(r)} disabled={!dirty(r.broker_key) || busy === r.broker_key}
                className="bg-[#343333] text-white rounded-lg px-4 py-2 text-[12.5px] font-semibold hover:bg-[#2a2a2a] transition disabled:opacity-40">
                {busy === r.broker_key ? 'Saving…' : 'Save'}
              </button>
            </div>

            <BrokerTargets brokerKey={r.broker_key} name={String(val(r, 'name'))} />
          </div>
        )
      })}

      {adding ? (
        <div className="border border-[#EDE7DD] rounded-xl p-5 bg-white">
          <p className="text-[13px] font-semibold text-[#2E2A26] mb-3">Add a broker</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={label}>Full name</label>
              <input className={field} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Jane Smith" autoFocus />
            </div>
            <div>
              <label className={label}>Broker key</label>
              <input className={field + ' font-mono'} value={newKey} onChange={e => setNewKey(e.target.value)}
                placeholder={suggestKey(newName) || 'jane'} />
              <p className="text-[11px] text-[#A29889] mt-1">Set once. It links their deals, login and targets, so it cannot be changed afterwards.</p>
            </div>
          </div>
          {err && <p className="text-[12px] text-[#C4553B] mb-2">{err}</p>}
          <div className="flex gap-2 items-center">
            <button onClick={addBroker} className="bg-[#343333] text-white rounded-lg px-4 py-2 text-[12.5px] font-semibold hover:bg-[#2a2a2a] transition">Add broker</button>
            <button onClick={() => { setAdding(false); setErr('') }} className="text-[12px] text-[#A29889] hover:text-[#2E2A26]">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="text-[12.5px] font-semibold text-[#0E8FCB] bg-white border border-[#BFE6F9] rounded-lg px-4 py-2 hover:bg-[#EAF7FE] transition">
          + Add another broker
        </button>
      )}
    </section>
  )
}
