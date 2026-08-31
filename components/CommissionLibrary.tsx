'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

type Rate = {
  id: string
  lender: string
  effective_from: string | null
  upfront_pct: number | null
  upfront_bands: any
  trail_pct: number | null
  trail_bands: any
  clawback_months: number | null
  clawback_text: string | null
  notes: string | null
  confirmed: boolean
}

type Sched = {
  id: string
  lender: string
  record_type: string | null
  source_row: number | null
  commission_text: string | null
  trail_text: string | null
  clawback_text: string | null
  notes_text: string | null
  amended_at: string | null
  amended_by: string | null
  original: any
}

type SchedDraft = {
  commission_text: string
  trail_text: string
  clawback_text: string
  notes_text: string
}

const SCHED_FIELDS: { key: keyof SchedDraft; label: string }[] = [
  { key: 'commission_text', label: 'Upfront commission' },
  { key: 'trail_text', label: 'Trail' },
  { key: 'clawback_text', label: 'Clawback' },
  { key: 'notes_text', label: 'Notes' },
]

const EMPTY_DRAFT = { upfront_pct: '', trail_pct: '', clawback_months: '', notes: '', confirmed: false }

function norm(s: string) {
  return (s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[.\-/]/g, ' ').replace(/\s+/g, ' ').trim()
}
function hasBands(r: Rate) {
  return Array.isArray(r.upfront_bands) && r.upfront_bands.length > 0
}
function bandsText(r: Rate) {
  if (!hasBands(r)) return ''
  return (r.upfront_bands as any[])
    .map(b => (b.max_lvr ? `≤${b.max_lvr}% LVR` : 'above') + ` ${b.pct}%`)
    .join(' · ')
}
function upfrontText(r: Rate) {
  if (hasBands(r)) return bandsText(r)
  return r.upfront_pct === null || r.upfront_pct === undefined ? '—' : `${r.upfront_pct}%`
}
function trailTextOf(r: Rate) {
  if (r.trail_pct === null || r.trail_pct === undefined) return '—'
  return Number(r.trail_pct) === 0 ? 'nil' : `${r.trail_pct}%`
}
function clawbackTextOf(r: Rate) {
  if (r.clawback_months === null || r.clawback_months === undefined) return '—'
  if (Number(r.clawback_months) === 0) return 'none'
  return `${r.clawback_months} months`
}
function toNum(v: string): number | null {
  const t = (v || '').trim().replace('%', '')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
function sd(s: Sched): SchedDraft {
  return {
    commission_text: s.commission_text || '',
    trail_text: s.trail_text || '',
    clawback_text: s.clawback_text || '',
    notes_text: s.notes_text || '',
  }
}

const GRID = 'grid grid-cols-[1.6fr_1.3fr_.8fr_1fr_1fr]'

export default function CommissionLibrary() {
  const supabase = createSupabaseBrowser()
  const [rates, setRates] = useState<Rate[]>([])
  const [sched, setSched] = useState<Sched[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [schedDraft, setSchedDraft] = useState<Record<string, SchedDraft>>({})
  const [showOrig, setShowOrig] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [adding, setAdding] = useState(false)
  const [newLender, setNewLender] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  async function load() {
    const [r, s] = await Promise.all([
      supabase.from('commission_rates').select('*').order('lender'),
      supabase.from('commission_schedule').select('*').order('lender'),
    ])
    if (r.error || s.error) {
      setLoadError(r.error?.message || s.error?.message || 'Could not load the commission library.')
      setLoading(false)
      return
    }
    setRates((r.data || []) as Rate[])
    setSched((s.data || []) as Sched[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const schedByLender = useMemo(() => {
    const m: Record<string, Sched[]> = {}
    for (const s of sched) {
      const k = norm(s.lender)
      if (!m[k]) m[k] = []
      m[k].push(s)
    }
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) => (a.source_row || 0) - (b.source_row || 0))
    }
    return m
  }, [sched])

  function schedFor(r: Rate): Sched[] {
    return schedByLender[norm(r.lender)] || []
  }

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return rates
    return rates.filter(r => r.lender.toLowerCase().includes(t))
  }, [rates, q])

  const unconfirmed = rates.filter(r => !r.confirmed).length

  function toggleRow(r: Rate) {
    setErr('')
    setStatus('')
    if (open === r.id) {
      setOpen(null)
      setEditing(false)
      return
    }
    setOpen(r.id)
    setEditing(false)
  }

  function startEdit(r: Rate) {
    setErr('')
    setStatus('')
    setDraft({
      upfront_pct: r.upfront_pct === null || r.upfront_pct === undefined ? '' : String(r.upfront_pct),
      trail_pct: r.trail_pct === null || r.trail_pct === undefined ? '' : String(r.trail_pct),
      clawback_months: r.clawback_months === null || r.clawback_months === undefined ? '' : String(r.clawback_months),
      notes: r.notes || '',
      confirmed: !!r.confirmed,
    })
    const sdMap: Record<string, SchedDraft> = {}
    for (const s of schedFor(r)) sdMap[s.id] = sd(s)
    setSchedDraft(sdMap)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft(EMPTY_DRAFT)
    setSchedDraft({})
    setErr('')
  }

  async function save(r: Rate) {
    setBusy(true)
    setErr('')
    setStatus('')
    try {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth?.user?.id || null
      const who = auth?.user?.email || uid || 'unknown'

      const patch: Record<string, any> = {
        trail_pct: toNum(draft.trail_pct),
        clawback_months: toNum(draft.clawback_months),
        notes: draft.notes.trim() === '' ? null : draft.notes.trim(),
        confirmed: draft.confirmed,
        updated_at: new Date().toISOString(),
        updated_by: uid,
      }
      if (!hasBands(r)) patch.upfront_pct = toNum(draft.upfront_pct)

      const { data: rows, error } = await supabase
        .from('commission_rates')
        .update(patch)
        .eq('id', r.id)
        .select('id')
      if (error) throw new Error(error.message)
      if (!rows || rows.length === 0) {
        throw new Error('The database refused the change — nothing was saved. You may not have finance admin access.')
      }

      for (const s of schedFor(r)) {
        const d = schedDraft[s.id]
        if (!d) continue
        const before = sd(s)
        const changed = SCHED_FIELDS.some(f => (d[f.key] || '') !== (before[f.key] || ''))
        if (!changed) continue

        const spatch: Record<string, any> = {
          commission_text: d.commission_text.trim() === '' ? null : d.commission_text,
          trail_text: d.trail_text.trim() === '' ? null : d.trail_text,
          clawback_text: d.clawback_text.trim() === '' ? null : d.clawback_text,
          notes_text: d.notes_text.trim() === '' ? null : d.notes_text,
          amended_at: new Date().toISOString(),
          amended_by: who,
        }
        if (!s.original) spatch.original = before

        const { data: srows, error: serr } = await supabase
          .from('commission_schedule')
          .update(spatch)
          .eq('id', s.id)
          .select('id')
        if (serr) throw new Error(serr.message)
        if (!srows || srows.length === 0) {
          throw new Error('The rate saved, but the schedule text was refused by the database.')
        }
      }

      await load()
      setEditing(false)
      setOpen(null)
      setSchedDraft({})
      setStatus(`${r.lender} saved.`)
    } catch (e: any) {
      setErr(e?.message || 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  // Deleting a lender removes OUR rate for them. The SFG schedule they came from
  // is left alone - it is the imported record, and losing it would mean a
  // re-import to get back.
  async function removeMany(ids: string[], names: string[]) {
    if (ids.length === 0) return
    const list = names.length <= 6 ? names.join(', ') : `${names.slice(0, 6).join(', ')} and ${names.length - 6} more`
    if (!confirm(`Delete ${ids.length} lender${ids.length === 1 ? '' : 's'}?\n\n${list}\n\nThe published SFG schedule is kept, so any of them can be added back.`)) return
    setBusy(true)
    setErr('')
    try {
      const { data, error } = await supabase.from('commission_rates').delete().in('id', ids).select('id')
      if (error) throw new Error(error.message)
      if (!data || data.length !== ids.length) {
        throw new Error(`The database removed ${data?.length || 0} of ${ids.length}. Nothing else was changed.`)
      }
      await load()
      setOpen(null)
      setEditing(false)
      setSelected([])
      setSelecting(false)
      setStatus(`${ids.length} lender${ids.length === 1 ? '' : 's'} deleted. The SFG schedule is untouched.`)
    } catch (e: any) {
      setErr(e?.message || 'Could not delete.')
    } finally {
      setBusy(false)
    }
  }

  async function removeRate(r: Rate) {
    if (!confirm(`Delete ${r.lender}? The published SFG schedule entry stays, so you can add it back.`)) return
    setBusy(true)
    setErr('')
    try {
      const { data, error } = await supabase.from('commission_rates').delete().eq('id', r.id).select('id')
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) throw new Error('The database refused the removal — nothing changed.')
      await load()
      setOpen(null)
      setEditing(false)
      setStatus(`${r.lender} removed from your rates.`)
    } catch (e: any) {
      setErr(e?.message || 'Could not remove.')
    } finally {
      setBusy(false)
    }
  }

  async function addLender() {
    const name = newLender.trim()
    if (!name) return
    setBusy(true)
    setErr('')
    try {
      const { data, error } = await supabase
        .from('commission_rates')
        .insert({ lender: name, effective_from: new Date().toISOString().slice(0, 10), confirmed: false })
        .select('id')
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) throw new Error('The database refused the new lender — nothing was added.')
      await load()
      setNewLender('')
      setAdding(false)
      setStatus(`${name} added. Open it to set the rates.`)
    } catch (e: any) {
      setErr(e?.message || 'Could not add the lender.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="px-4 py-8 text-center text-[13px] text-[#A29889]">Loading the commission library…</div>
  if (loadError) return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{loadError}</div>

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div>
          <div className="text-[13px] font-semibold text-[#2E2A26] mb-1">Our lenders</div>
          <div className="text-[11.5px] text-[#A29889]">
            {rates.length} lenders · {rates.length - unconfirmed} confirmed
          </div>
        </div>
        <div className="flex gap-2 items-center ml-auto flex-wrap">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search lenders"
            className="text-[13px] border border-[#E8E1D6] rounded-lg px-2.5 py-1.5 w-[240px] focus:outline-none focus:border-[#2DBEFF]"
          />
          {rates.length > 0 && (
            <button onClick={() => { setSelecting(v => !v); setSelected([]); setOpen(null); setEditing(false); setErr('') }}
              className={`text-[12.5px] font-semibold rounded-lg px-3.5 py-2 transition border ${selecting
                ? 'bg-[#343333] border-[#343333] text-white'
                : 'bg-white border-[#E8E1D6] text-[#6E665C] hover:bg-[#FAF7F2] hover:text-[#2E2A26]'}`}>
              {selecting ? 'Done' : 'Delete lenders'}
            </button>
          )}
          {adding ? (
            <span className="flex gap-2 items-center">
              <span className="inline-flex items-center gap-2 border border-[#E8E1D6] rounded-lg px-3 py-1.5 bg-white">
                <input
                  value={newLender}
                  onChange={e => setNewLender(e.target.value)}
                  placeholder="Lender name"
                  autoFocus
                  className="text-[12.5px] outline-none w-[150px] text-[#2E2A26]"
                />
              </span>
              <button onClick={addLender} disabled={busy} className="bg-[#343333] text-white rounded-lg px-4 py-2 text-[12.5px] font-semibold hover:bg-[#2a2a2a] transition disabled:opacity-40">Add</button>
              <button onClick={() => { setAdding(false); setNewLender('') }} className="text-[12px] text-[#A29889] hover:text-[#2E2A26]">Cancel</button>
            </span>
          ) : (
            <button onClick={() => setAdding(true)} className="text-[12.5px] font-semibold text-[#0E8FCB] bg-white border border-[#BFE6F9] rounded-lg px-3.5 py-2 hover:bg-[#EAF7FE] transition">Add a lender</button>
          )}
        </div>
      </div>

      {unconfirmed > 0 && (
        <div className="flex items-start gap-3 bg-[#FDF6E7] border border-[#EFE0BC] rounded-xl px-4 py-3 mb-4">
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="#946017" strokeWidth="1.6" strokeLinecap="round" className="shrink-0 mt-[2px]"><circle cx="8" cy="8" r="6.2" /><path d="M8 5v3.4M8 10.8v.2" /></svg>
          <span className="text-[12.5px] text-[#7A5F17]">
            <strong className="text-[#5E4A11]">{unconfirmed} of {rates.length} lenders are not confirmed.</strong>{' '}
            Commission is only calculated from confirmed rates — anything unconfirmed reads &ldquo;rate not confirmed&rdquo; rather than a number.
          </span>
        </div>
      )}

      {selecting && (
        <div className="flex items-center gap-3 bg-[#FAF7F2] border border-[#E8E1D6] rounded-xl px-4 py-2.5 mb-3 flex-wrap">
          <span className="text-[12.5px] text-[#6E665C]">
            Tick every lender you are not accredited with. The SFG schedule is kept either way.
          </span>
          <span className="flex gap-2 items-center ml-auto">
            {selected.length > 0 && (
              <button onClick={() => setSelected([])} className="text-[12px] text-[#A29889] hover:text-[#2E2A26]">Clear</button>
            )}
            <button
              onClick={() => removeMany(selected, rates.filter(r => selected.includes(r.id)).map(r => r.lender))}
              disabled={busy || selected.length === 0}
              className="bg-[#C4553B] text-white rounded-lg px-4 py-2 text-[12.5px] font-semibold hover:bg-[#a94631] transition disabled:opacity-40">
              {busy ? 'Deleting…' : `Delete ${selected.length || ''} selected`}
            </button>
          </span>
        </div>
      )}

      {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-3">{err}</div>}
      {status && <div className="bg-white border border-[#EDE7DD] rounded-lg px-3 py-2.5 mb-3 text-[12.5px] text-[#6E665C]">{status}</div>}

      <div className="bg-white border border-[#EDE7DD] rounded-xl overflow-hidden">
        <div className={`${GRID} px-4 py-2.5 text-[10px] font-semibold tracking-[.085em] uppercase text-[#A29889] border-b border-[#F6F2EA]`}>
          <span>Lender</span><span>Upfront</span><span>Trail</span><span>Out of clawback</span><span>Status</span>
        </div>

        {shown.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-[#A29889]">No lenders match &ldquo;{q}&rdquo;.</div>
        )}

        {shown.map(r => {
          const isOpen = open === r.id
          const rows = schedFor(r)
          return (
            <div key={r.id} className="border-b border-[#F6F2EA] last:border-0">
              {selecting ? (
                <label className={`w-full text-left ${GRID} px-4 py-3 text-[13px] hover:bg-[#FCFAF6] transition items-center cursor-pointer`}>
                  <span className="font-medium text-[#2E2A26] flex items-center gap-2.5">
                    <input type="checkbox" checked={selected.includes(r.id)}
                      onChange={e => setSelected(sel => e.target.checked ? [...sel, r.id] : sel.filter(x => x !== r.id))} />
                    {r.lender}
                  </span>
                  <span className="text-[#6E665C]">{upfrontText(r)}</span>
                  <span className="text-[#6E665C]">{trailTextOf(r)}</span>
                  <span className="text-[#6E665C]">{clawbackTextOf(r)}</span>
                  <span>
                    {r.confirmed
                      ? <span className="text-[10px] font-bold uppercase tracking-[.05em] bg-[#F1F7F3] border border-[#CFE6D5] text-[#25794C] rounded-full px-2 py-[2px]">Confirmed</span>
                      : <span className="text-[10px] font-bold uppercase tracking-[.05em] bg-[#FDF6E7] border border-[#EFE0BC] text-[#9A7B2E] rounded-full px-2 py-[2px]">Not confirmed</span>}
                  </span>
                </label>
              ) : (
              <button onClick={() => toggleRow(r)} className={`w-full text-left ${GRID} px-4 py-3 text-[13px] hover:bg-[#FCFAF6] transition items-center`}>
                <span className="font-medium text-[#2E2A26]">{r.lender}</span>
                <span className="text-[#6E665C]">{upfrontText(r)}</span>
                <span className="text-[#6E665C]">{trailTextOf(r)}</span>
                <span className="text-[#6E665C]">{clawbackTextOf(r)}</span>
                <span>
                  {r.confirmed
                    ? <span className="text-[10px] font-bold uppercase tracking-[.05em] bg-[#F1F7F3] border border-[#CFE6D5] text-[#25794C] rounded-full px-2 py-[2px]">Confirmed</span>
                    : <span className="text-[10px] font-bold uppercase tracking-[.05em] bg-[#FDF6E7] border border-[#EFE0BC] text-[#9A7B2E] rounded-full px-2 py-[2px]">Not confirmed</span>}
                </span>
              </button>
              )}

              {isOpen && !editing && (
                <div className="px-4 pb-4 pt-1 bg-[#FDFCFA] border-t border-[#F6F2EA]">
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A29889] mb-1">Upfront</div>
                      <div className="text-[13px] text-[#2E2A26]">{upfrontText(r)}</div>
                      {hasBands(r) && <div className="text-[11px] text-[#A29889] mt-1">Set by LVR band</div>}
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A29889] mb-1">Trail</div>
                      <div className="text-[13px] text-[#2E2A26]">{trailTextOf(r)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A29889] mb-1">Out of clawback</div>
                      <div className="text-[13px] text-[#2E2A26]">{clawbackTextOf(r)}</div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A29889] mb-1">Comments</div>
                    <div className="text-[12.5px] text-[#6E665C]">{r.notes || <span className="text-[#A29889]">None</span>}</div>
                  </div>

                  <div className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A29889] mb-2">SFG schedule</div>
                  {rows.length === 0 && <div className="text-[12px] text-[#A29889] mt-0.5">Not in the published schedule.</div>}
                  {rows.map(s => (
                    <div key={s.id} className="mb-3">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-[.05em] text-[#A29889]">{s.record_type || 'Schedule'}</span>
                        {s.amended_at && (
                          <>
                            <span className="text-[10px] font-bold uppercase tracking-[.05em] bg-[#FDF6E7] border border-[#EFE0BC] text-[#9A7B2E] rounded-full px-2 py-[2px]">Amended</span>
                            <button onClick={() => setShowOrig(o => ({ ...o, [s.id]: !o[s.id] }))} className="text-[12px] text-[#A29889] hover:text-[#2E2A26]">
                              {showOrig[s.id] ? 'Hide original' : 'Show original'}
                            </button>
                          </>
                        )}
                      </div>
                      {SCHED_FIELDS.map(f => (s as any)[f.key] ? (
                        <div key={f.key} className="text-[12px] text-[#6E665C] mb-2 last:mb-0">
                          <span className="text-[10px] font-bold uppercase tracking-[.05em] text-[#A29889] mr-2">{f.label}</span>
                          {(s as any)[f.key]}
                        </div>
                      ) : null)}
                      {showOrig[s.id] && s.original && (
                        <div className="bg-white border border-[#EDE7DD] rounded-lg px-3 py-2.5 mb-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A29889] mb-1">Original, as loaded</div>
                          {SCHED_FIELDS.map(f => (s.original as any)[f.key] ? (
                            <div key={f.key} className="text-[12px] text-[#6E665C] mb-2 last:mb-0">
                              <span className="text-[10px] font-bold uppercase tracking-[.05em] text-[#A29889] mr-2">{f.label}</span>
                              {(s.original as any)[f.key]}
                            </div>
                          ) : null)}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="flex gap-2 items-center flex-wrap">
                    <button onClick={() => startEdit(r)} className="text-[12.5px] font-semibold text-[#0E8FCB] bg-white border border-[#BFE6F9] rounded-lg px-4 py-2 hover:bg-[#EAF7FE] transition">Edit</button>
                    <button onClick={() => removeRate(r)} disabled={busy} className="text-[12px] text-[#A29889] hover:text-[#C4553B] ml-auto">Delete lender</button>
                  </div>
                </div>
              )}

              {isOpen && editing && (
                <div className="px-4 pb-4 pt-1 bg-[#FDFCFA] border-t border-[#F6F2EA]">
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#A29889] mb-1">Upfront %</label>
                      {hasBands(r) ? (
                        <>
                          <div className="text-[13px] text-[#2E2A26]">{bandsText(r)}</div>
                          <div className="text-[11px] text-[#A29889] mt-1">LVR banded — read only. Tell me if a band is wrong.</div>
                        </>
                      ) : (
                        <input value={draft.upfront_pct} onChange={e => setDraft({ ...draft, upfront_pct: e.target.value })} placeholder="0.65" className="text-[13px] border border-[#E8E1D6] rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:border-[#2DBEFF]" />
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#A29889] mb-1">Trail %</label>
                      <input value={draft.trail_pct} onChange={e => setDraft({ ...draft, trail_pct: e.target.value })} placeholder="0.15" className="text-[13px] border border-[#E8E1D6] rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:border-[#2DBEFF]" />
                      <div className="text-[11px] text-[#A29889] mt-1">One rate. Put any stepping in comments.</div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#A29889] mb-1">Out of clawback after (months)</label>
                      <input value={draft.clawback_months} onChange={e => setDraft({ ...draft, clawback_months: e.target.value })} placeholder="24" className="text-[13px] border border-[#E8E1D6] rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:border-[#2DBEFF]" />
                      <div className="text-[11px] text-[#A29889] mt-1">0 means no clawback.</div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="block text-[11px] font-semibold text-[#A29889] mb-1">Comments</label>
                    <textarea value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} rows={2} className="text-[13px] border border-[#E8E1D6] rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:border-[#2DBEFF]" />
                  </div>

                  {rows.length > 0 && (
                    <>
                      <div className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A29889] mb-2">SFG schedule — editable</div>
                      {rows.map(s => (
                        <div key={s.id} className="bg-white border border-[#EDE7DD] rounded-lg px-3 py-2.5 mb-3">
                          <div className="text-[10px] font-bold uppercase tracking-[.05em] text-[#A29889] mb-2">{s.record_type || 'Schedule'}</div>
                          {SCHED_FIELDS.map(f => (
                            <div key={f.key} className="mb-3">
                              <label className="block text-[11px] font-semibold text-[#A29889] mb-1">{f.label}</label>
                              <textarea
                                value={schedDraft[s.id]?.[f.key] || ''}
                                onChange={e => setSchedDraft(m => ({ ...m, [s.id]: { ...(m[s.id] || sd(s)), [f.key]: e.target.value } }))}
                                rows={2}
                                className="text-[13px] border border-[#E8E1D6] rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:border-[#2DBEFF]"
                              />
                            </div>
                          ))}
                          <div className="text-[11px] text-[#A29889]">Editing this tags the entry as amended. The original text is kept.</div>
                        </div>
                      ))}
                    </>
                  )}

                  <label className="inline-flex items-center gap-2 border border-[#E8E1D6] rounded-lg px-3 py-1.5 bg-white mb-3">
                    <input type="checkbox" checked={draft.confirmed} onChange={e => setDraft({ ...draft, confirmed: e.target.checked })} />
                    <span className="text-[12.5px] text-[#2E2A26]">These rates are confirmed correct</span>
                  </label>

                  <div className="flex gap-2 items-center flex-wrap">
                    <button onClick={() => save(r)} disabled={busy} className="bg-[#343333] text-white rounded-lg px-4 py-2 text-[12.5px] font-semibold hover:bg-[#2a2a2a] transition disabled:opacity-40">
                      {busy ? 'Saving…' : 'Save and close'}
                    </button>
                    <button onClick={cancelEdit} disabled={busy} className="text-[12px] text-[#A29889] hover:text-[#2E2A26]">Cancel</button>
                    <button onClick={() => removeRate(r)} disabled={busy} className="text-[12px] text-[#A29889] hover:text-[#C4553B] ml-auto">Delete lender</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
