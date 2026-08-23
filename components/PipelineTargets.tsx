'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { fyEndYear, todayYmd } from '@/lib/periods'

const FY_MONTHS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]
const NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthKey(fyEnd: number, mi: number): string {
  const y = mi >= 7 ? fyEnd - 1 : fyEnd
  return `${y}-${String(mi).padStart(2, '0')}-01`
}
function parseNum(s: string): number | null {
  const digits = String(s).replace(/[^0-9]/g, '')
  if (digits === '') return null
  const n = Number(digits)
  return isNaN(n) ? null : n
}
function withCommas(s: string): string {
  const n = parseNum(s)
  return n === null ? '' : n.toLocaleString('en-AU')
}
function compact(n: number | null): string {
  if (n === null || n === undefined) return '-'
  const a = Math.abs(n)
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'm'
  if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'k'
  return '$' + Math.round(n)
}

type Row = { id: string; metric: string; month: string; broker_key: string | null; amount: number }

export default function PipelineTargets() {
  const supabase = createSupabaseBrowser()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [fy, setFy] = useState(() => fyEndYear(todayYmd()))
  const [scope, setScope] = useState('')                 // '' is the whole business
  const [brokers, setBrokers] = useState<{ key: string; name: string }[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [vals, setVals] = useState<Record<string, string>>({})
  const [hist, setHist] = useState<Record<string, { lodged: number | null; settled: number | null }>>({})
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  // "metric:month:scope" - scope is part of the key so switching broker never
  // writes one person's number onto another's.
  const k = (metric: string, month: string, sc: string) => `${metric}:${month}:${sc}`

  async function load() {
    const { data: u } = await supabase.auth.getUser()
    if (!u?.user) { setIsAdmin(false); return }
    const { data: prof } = await supabase.from('user_profiles').select('is_admin').eq('id', u.user.id).single()
    if (!prof?.is_admin) { setIsAdmin(false); return }
    setIsAdmin(true)

    const [t, h, b] = await Promise.all([
      supabase.from('pipeline_targets').select('id, metric, month, broker_key, amount'),
      supabase.from('pipeline_history').select('month, lodged_amount, settled_amount'),
      supabase.from('user_profiles').select('full_name, broker_key').not('broker_key', 'is', null),
    ])
    const rs: Row[] = (t.data || []).map((r: any) => ({
      id: r.id, metric: r.metric, month: String(r.month).slice(0, 10),
      broker_key: r.broker_key, amount: Number(r.amount),
    }))
    setRows(rs)
    setVals(Object.fromEntries(rs.map(r => [k(r.metric, r.month, r.broker_key || ''), r.amount.toLocaleString('en-AU')])))

    const hh: Record<string, { lodged: number | null; settled: number | null }> = {}
    for (const r of (h.data || [])) hh[String(r.month).slice(0, 10)] = {
      lodged: r.lodged_amount === null ? null : Number(r.lodged_amount),
      settled: r.settled_amount === null ? null : Number(r.settled_amount),
    }
    setHist(hh)

    const seen = new Set<string>()
    const bs: { key: string; name: string }[] = []
    for (const r of (b.data || [])) {
      const key = String(r.broker_key || '').toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      bs.push({ key, name: r.full_name || key })
    }
    setBrokers(bs.sort((x, y) => x.name.localeCompare(y.name)))
  }
  useEffect(() => { load() }, [])

  const monthRows = useMemo(() => FY_MONTHS.map(mi => {
    const key = monthKey(fy, mi)
    const prior = monthKey(fy - 1, mi)
    return {
      name: NAMES[mi - 1], key,
      lodgedActual: hist[prior]?.lodged ?? null,
      settledActual: hist[prior]?.settled ?? null,
    }
  }), [fy, hist])

  const saved = useMemo(() => {
    const m: Record<string, Row> = {}
    for (const r of rows) m[k(r.metric, r.month, r.broker_key || '')] = r
    return m
  }, [rows])

  const dirty = useMemo(() => {
    for (const r of monthRows) for (const m of ['lodged', 'settled']) {
      const key = k(m, r.key, scope)
      const now = parseNum(vals[key] || '')
      const was = saved[key]?.amount ?? null
      if ((now ?? null) !== was) return true
    }
    return false
  }, [monthRows, vals, saved, scope])

  const totals = useMemo(() => {
    let lt = 0, st = 0, la = 0, sa = 0, set = 0
    for (const r of monthRows) {
      const l = parseNum(vals[k('lodged', r.key, scope)] || '')
      const s = parseNum(vals[k('settled', r.key, scope)] || '')
      if (l !== null) { lt += l; set += 1 }
      if (s !== null) st += s
      la += r.lodgedActual || 0
      sa += r.settledActual || 0
    }
    return { lt, st, la, sa, set }
  }, [monthRows, vals, scope])

  function set(metric: string, month: string, v: string) {
    setVals(p => ({ ...p, [k(metric, month, scope)]: v }))
    setStatus('')
  }
  function fillFromLastYear(mult: number) {
    const next = { ...vals }
    for (const r of monthRows) {
      if (r.lodgedActual !== null) next[k('lodged', r.key, scope)] = Math.round(r.lodgedActual * mult).toLocaleString('en-AU')
      if (r.settledActual !== null) next[k('settled', r.key, scope)] = Math.round(r.settledActual * mult).toLocaleString('en-AU')
    }
    setVals(next)
    setStatus('Filled in from last year. Nothing is saved until you press Save.')
  }

  async function save() {
    setBusy(true); setStatus('')
    const inserts: any[] = [], updates: { id: string; amount: number }[] = [], deletes: string[] = []
    for (const r of monthRows) for (const metric of ['lodged', 'settled']) {
      const key = k(metric, r.key, scope)
      const n = parseNum(vals[key] || '')
      const existing = saved[key]
      if (n === null) { if (existing) deletes.push(existing.id) }
      else if (!existing) inserts.push({ metric, month: r.key, broker_key: scope || null, amount: n })
      else if (existing.amount !== n) updates.push({ id: existing.id, amount: n })
    }
    try {
      // Row counts are checked, not just the absence of an error - a blocked write
      // returns zero rows and no error at all.
      if (inserts.length) {
        const { data, error } = await supabase.from('pipeline_targets').insert(inserts).select('id')
        if (error) throw new Error(error.message)
        if ((data?.length || 0) !== inserts.length) throw new Error('the database accepted ' + (data?.length || 0) + ' of ' + inserts.length + ' new rows')
      }
      for (const u of updates) {
        const { data, error } = await supabase.from('pipeline_targets').update({ amount: u.amount }).eq('id', u.id).select('id')
        if (error) throw new Error(error.message)
        if (!data || data.length === 0) throw new Error('a change did not reach the database')
      }
      if (deletes.length) {
        const { error } = await supabase.from('pipeline_targets').delete().in('id', deletes)
        if (error) throw new Error(error.message)
      }
      await load()
      setStatus('Saved at ' + new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
    } catch (e: any) {
      setStatus('NOT SAVED - ' + (e?.message || 'the change did not reach the database'))
    } finally { setBusy(false) }
  }

  if (isAdmin !== true) return null

  const isBusiness = scope === ''
  const scopeName = isBusiness ? 'the business' : (brokers.find(b => b.key === scope)?.name || scope)
  const inp = 'w-[118px] text-right text-[13px] border rounded-lg px-2.5 py-1.5 tabular-nums focus:outline-none focus:border-[#2DBEFF]'
  const failed = status.startsWith('NOT SAVED')

  return (
    <section className="mb-10">
      <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-4 flex items-center gap-2">
        <span className="w-[5px] h-[5px] rounded-full bg-[#0E8FCB] inline-block shrink-0" />Business Targets
      </h2>

      <div className="border border-[#EDE7DD] rounded-xl bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#F6F2EA] flex-wrap">
          <div>
            <div className="text-[13px] font-semibold text-[#2E2A26]">Monthly targets</div>
            <div className="text-[11.5px] text-[#A29889]">
              Quarter and financial-year targets are these months added together. Last year sits
              alongside only as a reference while you set the number - results are compared on the Pipeline.
            </div>
          </div>
          <div className="inline-flex items-center gap-2">
            <button type="button" onClick={() => setFy(f => f - 1)}
              className="w-[26px] h-[26px] rounded-lg border border-[#E8E1D6] flex items-center justify-center text-[#6E665C] hover:bg-[#FAF7F2]">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5"/></svg>
            </button>
            <span className="text-[13px] font-semibold w-[52px] text-center">FY{String(fy).slice(2)}</span>
            <button type="button" onClick={() => setFy(f => f + 1)}
              className="w-[26px] h-[26px] rounded-lg border border-[#E8E1D6] flex items-center justify-center text-[#6E665C] hover:bg-[#FAF7F2]">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5"/></svg>
            </button>
          </div>
        </div>

        {/* whose targets these are */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#F6F2EA] flex-wrap">
          <span className="text-[11px] font-semibold text-[#A29889] mr-1">Targets for</span>
          <button type="button" onClick={() => setScope('')}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium border transition-colors ${isBusiness ? 'bg-[#343333] border-[#343333] text-white font-semibold' : 'border-[#E8E1D6] text-[#6E665C] hover:bg-[#FAF7F2] hover:text-[#2E2A26]'}`}>
            Whole business
          </button>
          {brokers.map(b => (
            <button key={b.key} type="button" onClick={() => setScope(b.key)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium border transition-colors ${scope === b.key ? 'bg-[#343333] border-[#343333] text-white font-semibold' : 'border-[#E8E1D6] text-[#6E665C] hover:bg-[#FAF7F2] hover:text-[#2E2A26]'}`}>
              {b.name}
            </button>
          ))}
        </div>

        {totals.set < 12 && (
          <div className="flex items-center gap-3 bg-[#FDF6E7] border-b border-[#EFE0BC] px-5 py-2.5">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#B4761F" strokeWidth="1.6" strokeLinecap="round"><circle cx="8" cy="8" r="6.2"/><path d="M8 5v3.4M8 10.8v.2"/></svg>
            <span className="text-[12.5px] text-[#7A5F17]">
              <strong className="text-[#5E4A11]">FY{String(fy).slice(2)} targets for {scopeName} are incomplete.</strong>{' '}
              {12 - totals.set} of 12 months still to set.
            </span>
          </div>
        )}

        {!isBusiness && (
          <div className="px-5 py-2.5 border-b border-[#F6F2EA] bg-[#FAF7F2]">
            <span className="text-[12px] text-[#6E665C]">
              The ten years of history are a business total, so a broker is measured against their target and
              their share of the business - never against last year.
            </span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-semibold tracking-[.085em] uppercase text-[#A29889]">
                <th className="text-left px-5 py-2.5 border-b border-[#F6F2EA]">Month</th>
                <th className="text-right px-3 py-2.5 border-b border-[#F6F2EA]">Lodged target</th>
                {isBusiness && <th className="text-right px-3 py-2.5 border-b border-[#F6F2EA] font-normal">FY{String(fy - 1).slice(2)}</th>}
                <th className="text-right px-3 py-2.5 border-b border-[#F6F2EA]">Settled target</th>
                {isBusiness && <th className="text-right px-5 py-2.5 border-b border-[#F6F2EA] font-normal">FY{String(fy - 1).slice(2)}</th>}
              </tr>
            </thead>
            <tbody>
              {monthRows.map(r => {
                const lv = parseNum(vals[k('lodged', r.key, scope)] || '')
                const sv = parseNum(vals[k('settled', r.key, scope)] || '')
                return (
                  <tr key={r.key} className="border-b border-[#F6F2EA] last:border-0 hover:bg-[#FCFAF6]">
                    <td className="px-5 py-2 text-[13px] font-medium text-[#6E665C]">{r.name}</td>
                    <td className="px-3 py-2 text-right">
                      <input value={vals[k('lodged', r.key, scope)] || ''} inputMode="numeric"
                        onChange={e => set('lodged', r.key, e.target.value)}
                        onBlur={e => set('lodged', r.key, withCommas(e.target.value))}
                        placeholder="not set"
                        className={inp + (lv === null ? ' bg-[#FFFCF5] border-[#EFE0BC]' : ' border-[#E8E1D6]')} />
                    </td>
                    {isBusiness && <td className="px-3 py-2 text-right text-[12.5px] text-[#C9C1B4] tabular-nums">{compact(r.lodgedActual)}</td>}
                    <td className="px-3 py-2 text-right">
                      <input value={vals[k('settled', r.key, scope)] || ''} inputMode="numeric"
                        onChange={e => set('settled', r.key, e.target.value)}
                        onBlur={e => set('settled', r.key, withCommas(e.target.value))}
                        placeholder="not set"
                        className={inp + (sv === null ? ' bg-[#FFFCF5] border-[#EFE0BC]' : ' border-[#E8E1D6]')} />
                    </td>
                    {isBusiness && <td className="px-5 py-2 text-right text-[12.5px] text-[#C9C1B4] tabular-nums">{compact(r.settledActual)}</td>}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#E8E1D6]">
                <td className="px-5 py-3 text-[13px] font-semibold">Financial year</td>
                <td className="px-3 py-3 text-right text-[13px] font-semibold tabular-nums">{totals.lt ? compact(totals.lt) : '—'}</td>
                {isBusiness && <td className="px-3 py-3 text-right text-[12.5px] text-[#C9C1B4] tabular-nums">{compact(totals.la)}</td>}
                <td className="px-3 py-3 text-right text-[13px] font-semibold tabular-nums">{totals.st ? compact(totals.st) : '—'}</td>
                {isBusiness && <td className="px-5 py-3 text-right text-[12.5px] text-[#C9C1B4] tabular-nums">{compact(totals.sa)}</td>}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-[#F6F2EA] bg-[#FDFCFA] flex-wrap">
          <span className={`text-[12px] ${failed ? 'text-[#C4553B] font-medium' : 'text-[#A29889]'}`}>
            {status || (dirty ? 'Unsaved changes.' : 'Nothing to save.')}
          </span>
          <span className="flex gap-2">
            {isBusiness && <>
              <button type="button" onClick={() => fillFromLastYear(1)}
                className="text-[12.5px] font-semibold text-[#0E8FCB] bg-white border border-[#BFE6F9] rounded-lg px-3.5 py-2 hover:bg-[#EAF7FE] transition">
                Copy FY{String(fy - 1).slice(2)} actuals
              </button>
              <button type="button" onClick={() => fillFromLastYear(1.1)}
                className="text-[12.5px] font-semibold text-[#0E8FCB] bg-white border border-[#BFE6F9] rounded-lg px-3.5 py-2 hover:bg-[#EAF7FE] transition">
                + 10%
              </button>
            </>}
            <button type="button" onClick={save} disabled={!dirty || busy}
              className="bg-[#343333] text-white rounded-lg px-5 py-2 text-[13px] font-semibold hover:bg-[#2a2a2a] transition disabled:opacity-40">
              {busy ? 'Saving...' : 'Save targets'}
            </button>
          </span>
        </div>
      </div>
    </section>
  )
}
