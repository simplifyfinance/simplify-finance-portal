'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

type Rate = {
  id: string; lender: string; effective_from: string
  upfront_pct: number | null; upfront_bands: any[]; trail_bands: any[]
  clawback_months: number | null; clawback_text: string | null
  notes: string | null; confirmed: boolean
}
type Sched = {
  lender: string; record_type: string; source_row: number | null
  commission_text: string | null; trail_text: string | null
  clawback_text: string | null; notes_text: string | null
}

function norm(s: string) {
  return s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[.\-/]/g, ' ').replace(/\s+/g, ' ').trim()
}
function pctText(r: Rate): string {
  if (Array.isArray(r.upfront_bands) && r.upfront_bands.length) {
    return r.upfront_bands.map((b: any) =>
      (b.max_lvr ? `\u2264${b.max_lvr}% LVR` : 'above') + ` ${b.pct}%`).join(' · ')
  }
  return r.upfront_pct === null ? 'not recorded' : r.upfront_pct + '%'
}
function trailText(r: Rate): string {
  if (!Array.isArray(r.trail_bands) || !r.trail_bands.length) return 'nil'
  return r.trail_bands.map((b: any) =>
    (b.to_year ? (b.from_year === b.to_year ? `yr ${b.from_year}` : `yr ${b.from_year}-${b.to_year}`) : `yr ${b.from_year}+`)
    + ` ${b.pct}%`).join(' · ')
}

export default function CommissionLibrary() {
  const supabase = createSupabaseBrowser()
  const [rates, setRates] = useState<Rate[]>([])
  const [sched, setSched] = useState<Sched[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState<'ours' | 'all'>('ours')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [edit, setEdit] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const [r, s] = await Promise.all([
      supabase.from('commission_rates').select('*').order('lender'),
      supabase.from('commission_schedule').select('*').order('lender'),
    ])
    if (r.error || s.error) {
      setLoadError(r.error?.message || s.error?.message || 'Could not load the schedule.')
      setLoading(false); return
    }
    setRates((r.data || []) as Rate[])
    setSched((s.data || []) as Sched[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const unconfirmed = rates.filter(r => !r.confirmed).length
  const needsInput = rates.filter(r => r.notes && r.notes.includes('NEEDS CHECKING'))

  const shownRates = useMemo(() => {
    const t = q.trim().toLowerCase()
    return rates.filter(r => !t || r.lender.toLowerCase().includes(t))
  }, [rates, q])

  const shownSched = useMemo(() => {
    const t = q.trim().toLowerCase()
    return sched.filter(s => !t || s.lender.toLowerCase().includes(t))
  }, [sched, q])

  // The two layers use different lender names - ours on the rates, SFG's on the
  // schedule - so the source entry is matched by name rather than by a key.
  function sourceFor(lender: string): Sched[] {
    const n = norm(lender)
    return sched.filter(s => {
      const k = norm(s.lender)
      return k === n || k.includes(n) || n.includes(k)
    })
  }

  function field(r: Rate, name: string): string {
    const k = r.id + ':' + name
    if (k in edit) return edit[k]
    const v = (r as any)[name]
    return v === null || v === undefined ? '' : String(v)
  }
  function setField(r: Rate, name: string, v: string) {
    setEdit(p => ({ ...p, [r.id + ':' + name]: v }))
    setStatus('')
  }

  async function saveRow(r: Rate, alsoConfirm: boolean) {
    setBusy(true); setStatus('')
    const up = field(r, 'upfront_pct').trim()
    const cm = field(r, 'clawback_months').trim()
    const patch: any = {
      upfront_pct: up === '' ? null : Number(up),
      clawback_months: cm === '' ? null : Math.round(Number(cm)),
      notes: field(r, 'notes').trim() || null,
      updated_at: new Date().toISOString(),
    }
    if (alsoConfirm) patch.confirmed = true
    if (patch.upfront_pct !== null && isNaN(patch.upfront_pct)) { setStatus('NOT SAVED - upfront must be a number'); setBusy(false); return }
    const { data, error } = await supabase.from('commission_rates').update(patch).eq('id', r.id).select('id')
    if (error) setStatus('NOT SAVED - ' + error.message)
    else if (!data || data.length === 0) setStatus('NOT SAVED - the change did not reach the database')
    else {
      setEdit(p => {
        const next = { ...p }
        for (const k of Object.keys(next)) if (k.startsWith(r.id + ':')) delete next[k]
        return next
      })
      await load()
      setStatus((alsoConfirm ? 'Confirmed ' : 'Saved ') + r.lender)
    }
    setBusy(false)
  }

  async function unconfirm(r: Rate) {
    setBusy(true)
    const { error } = await supabase.from('commission_rates').update({ confirmed: false }).eq('id', r.id)
    if (error) setStatus('NOT SAVED - ' + error.message)
    else { await load(); setStatus('Marked ' + r.lender + ' unconfirmed') }
    setBusy(false)
  }

  if (loading) return <div className="text-[13px] text-[#A29889]">Loading the schedule...</div>
  if (loadError) return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
      Could not load the schedule: {loadError}
    </div>
  )
  if (rates.length === 0 && sched.length === 0) return (
    <div className="bg-white border border-[#EDE7DD] rounded-xl p-6">
      <div className="text-[13px] font-semibold text-[#2E2A26] mb-1">No commission schedule loaded yet</div>
      <p className="text-[12.5px] text-[#6E665C]">Once the SFG schedule is loaded, this is where it lives.</p>
    </div>
  )

  const failed = status.startsWith('NOT SAVED')
  const inp = 'text-[13px] border border-[#E8E1D6] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#2DBEFF]'

  return (
    <div>
      {/* nothing calculates money off an unchecked rate, so the count leads */}
      {unconfirmed > 0 && (
        <div className="flex items-start gap-3 bg-[#FDF6E7] border border-[#EFE0BC] rounded-xl px-4 py-3 mb-4">
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="#B4761F" strokeWidth="1.6" strokeLinecap="round" className="shrink-0 mt-[2px]"><circle cx="8" cy="8" r="6.2"/><path d="M8 5v3.4M8 10.8v.2"/></svg>
          <div className="text-[12.5px] text-[#7A5F17]">
            <strong className="text-[#5E4A11]">{unconfirmed} of {rates.length} rates are unconfirmed.</strong>{' '}
            They were read off the SFG schedule automatically. Check each one against the source text below and
            confirm it before any commission is calculated from it.
            {needsInput.length > 0 && <>
              {' '}<strong className="text-[#5E4A11]">{needsInput.map(r => r.lender).join(' and ')}</strong>
              {needsInput.length === 1 ? ' needs' : ' need'} a figure from you — the schedule does not give a clean one.
            </>}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 bg-[#F1EDE6] rounded-lg p-[3px]">
          <button onClick={() => setTab('ours')}
            className={`px-4 py-1.5 text-[13px] rounded-md font-medium transition ${tab === 'ours' ? 'bg-white text-[#2E2A26] shadow-sm' : 'text-[#6E665C]'}`}>
            Our lenders ({rates.length})
          </button>
          <button onClick={() => setTab('all')}
            className={`px-4 py-1.5 text-[13px] rounded-md font-medium transition ${tab === 'all' ? 'bg-white text-[#2E2A26] shadow-sm' : 'text-[#6E665C]'}`}>
            Full schedule ({new Set(sched.map(s => s.lender)).size})
          </button>
        </div>
        <span className="inline-flex items-center gap-2 border border-[#E8E1D6] rounded-lg px-3 py-1.5 bg-white">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#A29889" strokeWidth="1.7" strokeLinecap="round"><circle cx="7" cy="7" r="4.6"/><path d="M10.6 10.6L14 14"/></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a lender"
            className="text-[12.5px] outline-none w-[150px] text-[#2E2A26]" />
        </span>
        {status && <span className={`text-[12px] ${failed ? 'text-[#C4553B] font-medium' : 'text-[#A29889]'}`}>{status}</span>}
      </div>

      {tab === 'ours' ? (
        <div className="bg-white border border-[#EDE7DD] rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1.5fr_1.4fr_1.5fr_.9fr_1fr] px-4 py-2.5 text-[10px] font-semibold tracking-[.085em] uppercase text-[#A29889] border-b border-[#F6F2EA]">
            <span>Lender</span><span>Upfront</span><span>Trail</span><span>Clawback</span><span>Status</span>
          </div>
          {shownRates.map(r => {
            const isOpen = open === r.id
            const src = sourceFor(r.lender)
            const flagged = r.notes && r.notes.includes('NEEDS CHECKING')
            return (
              <div key={r.id} className="border-b border-[#F6F2EA] last:border-0">
                <button onClick={() => setOpen(isOpen ? null : r.id)}
                  className="w-full text-left grid grid-cols-[1.5fr_1.4fr_1.5fr_.9fr_1fr] px-4 py-3 text-[13px] hover:bg-[#FCFAF6] transition items-center">
                  <span className="font-medium text-[#2E2A26]">{r.lender}</span>
                  <span className={r.upfront_pct === null && !(r.upfront_bands || []).length ? 'text-[#C4553B]' : 'text-[#6E665C]'}>{pctText(r)}</span>
                  <span className="text-[#6E665C]">{trailText(r)}</span>
                  <span className="text-[#6E665C]">{r.clawback_months === null ? '—' : r.clawback_months === 0 ? 'nil' : r.clawback_months + ' mths'}</span>
                  <span>
                    {r.confirmed
                      ? <span className="text-[10px] font-bold uppercase tracking-[.05em] bg-[#F1F7F3] border border-[#CFE6D5] text-[#25794C] rounded-full px-2 py-[2px]">Confirmed</span>
                      : flagged
                        ? <span className="text-[10px] font-bold uppercase tracking-[.05em] bg-[#FBEDE9] border border-[#EFCFC5] text-[#C4553B] rounded-full px-2 py-[2px]">Needs a figure</span>
                        : <span className="text-[10px] font-bold uppercase tracking-[.05em] bg-[#FDF6E7] border border-[#EFE0BC] text-[#9A7B2E] rounded-full px-2 py-[2px]">Unconfirmed</span>}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 bg-[#FDFCFA] border-t border-[#F6F2EA]">
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#A29889] mb-1">Upfront %</label>
                        {(r.upfront_bands || []).length ? (
                          <div className="text-[12.5px] text-[#6E665C] py-1.5">{pctText(r)}
                            <div className="text-[11px] text-[#A29889]">LVR banded — tell me to change a band and I will</div></div>
                        ) : (
                          <input value={field(r, 'upfront_pct')} inputMode="decimal"
                            onChange={e => setField(r, 'upfront_pct', e.target.value)}
                            placeholder="not recorded" className={inp + ' w-[110px]'} />
                        )}
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#A29889] mb-1">Clawback window (months)</label>
                        <input value={field(r, 'clawback_months')} inputMode="numeric"
                          onChange={e => setField(r, 'clawback_months', e.target.value)}
                          placeholder="—" className={inp + ' w-[90px]'} />
                        <div className="text-[11px] text-[#A29889] mt-1">Drives the loans-at-risk report. 0 means nil.</div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#A29889] mb-1">Trail</label>
                        <div className="text-[12.5px] text-[#6E665C] py-1.5">{trailText(r)}</div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="block text-[11px] font-semibold text-[#A29889] mb-1">Notes</label>
                      <textarea value={field(r, 'notes')} onChange={e => setField(r, 'notes', e.target.value)}
                        rows={2} className={inp + ' w-full'} />
                    </div>

                    {r.clawback_text && (
                      <div className="bg-white border border-[#EDE7DD] rounded-lg px-3 py-2.5 mb-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A29889] mb-1">Clawback, as published</div>
                        <div className="text-[12px] text-[#6E665C]">{r.clawback_text}</div>
                      </div>
                    )}

                    {src.length > 0 && (
                      <div className="bg-white border border-[#EDE7DD] rounded-lg px-3 py-2.5 mb-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A29889] mb-2">
                          Source schedule — {src[0].lender}
                        </div>
                        {src.map((e, i) => (
                          <div key={i} className="text-[12px] text-[#6E665C] mb-2 last:mb-0">
                            <span className="text-[10px] font-bold uppercase tracking-[.05em] text-[#A29889] mr-2">{e.record_type}</span>
                            {e.commission_text && <div><strong className="text-[#2E2A26]">Commission:</strong> {e.commission_text}</div>}
                            {e.trail_text && <div><strong className="text-[#2E2A26]">Trail:</strong> {e.trail_text}</div>}
                            {e.notes_text && <div><strong className="text-[#2E2A26]">Note:</strong> {e.notes_text}</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 items-center">
                      <button onClick={() => saveRow(r, false)} disabled={busy}
                        className="text-[12.5px] font-semibold text-[#0E8FCB] bg-white border border-[#BFE6F9] rounded-lg px-3.5 py-2 hover:bg-[#EAF7FE] transition disabled:opacity-40">
                        Save
                      </button>
                      {r.confirmed ? (
                        <button onClick={() => unconfirm(r)} disabled={busy}
                          className="text-[12px] text-[#A29889] hover:text-[#C4553B]">Mark unconfirmed</button>
                      ) : (
                        <button onClick={() => saveRow(r, true)} disabled={busy}
                          className="bg-[#343333] text-white rounded-lg px-4 py-2 text-[12.5px] font-semibold hover:bg-[#2a2a2a] transition disabled:opacity-40">
                          Save and confirm
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {shownRates.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-[#A29889]">No lender matches that.</div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#EDE7DD] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 text-[11.5px] text-[#A29889] border-b border-[#F6F2EA]">
            Every entry as SFG published it, including product variations and eligibility notes. Nothing here is
            interpreted — it is the record behind the rates.
          </div>
          {shownSched.map((e, i) => (
            <div key={i} className="px-4 py-3 border-b border-[#F6F2EA] last:border-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[13px] font-medium text-[#2E2A26]">{e.lender}</span>
                <span className="text-[10px] font-bold uppercase tracking-[.05em] text-[#A29889]">{e.record_type}</span>
              </div>
              {e.commission_text && <div className="text-[12px] text-[#6E665C]"><strong className="text-[#2E2A26]">Commission:</strong> {e.commission_text}</div>}
              {e.trail_text && <div className="text-[12px] text-[#6E665C]"><strong className="text-[#2E2A26]">Trail:</strong> {e.trail_text}</div>}
              {e.clawback_text && <div className="text-[12px] text-[#6E665C]"><strong className="text-[#2E2A26]">Clawback:</strong> {e.clawback_text}</div>}
              {e.notes_text && <div className="text-[12px] text-[#A29889] mt-0.5">{e.notes_text}</div>}
            </div>
          ))}
          {shownSched.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-[#A29889]">No lender matches that.</div>
          )}
        </div>
      )}
    </div>
  )
}
