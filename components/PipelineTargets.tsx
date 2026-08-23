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

export default function PipelineTargets() {
  const supabase = createSupabaseBrowser()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [fy, setFy] = useState(() => fyEndYear(todayYmd()))
  const [saved, setSaved] = useState<Record<string, number>>({})   // "metric:YYYY-MM-01" -> amount
  const [vals, setVals] = useState<Record<string, string>>({})
  const [hist, setHist] = useState<Record<string, { lodged: number | null; settled: number | null }>>({})
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: u } = await supabase.auth.getUser()
      if (!u?.user) { setIsAdmin(false); return }
      const { data: prof } = await supabase.from('user_profiles').select('is_admin').eq('id', u.user.id).single()
      if (cancelled) return
      if (!prof?.is_admin) { setIsAdmin(false); return }
      setIsAdmin(true)
      const [t, h] = await Promise.all([
        supabase.from('pipeline_targets').select('metric, month, amount'),
        supabase.from('pipeline_history').select('month, lodged_amount, settled_amount'),
      ])
      if (cancelled) return
      const s: Record<string, number> = {}
      for (const r of (t.data || [])) s[`${r.metric}:${String(r.month).slice(0, 10)}`] = Number(r.amount)
      setSaved(s)
      setVals(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Number(v).toLocaleString('en-AU')])))
      const hh: Record<string, { lodged: number | null; settled: number | null }> = {}
      for (const r of (h.data || [])) hh[String(r.month).slice(0, 10)] = {
        lodged: r.lodged_amount === null ? null : Number(r.lodged_amount),
        settled: r.settled_amount === null ? null : Number(r.settled_amount),
      }
      setHist(hh)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const rows = useMemo(() => FY_MONTHS.map(mi => {
    const key = monthKey(fy, mi)
    const prior = monthKey(fy - 1, mi)
    return {
      mi, name: NAMES[mi - 1], key,
      lodgedActual: hist[prior]?.lodged ?? null,
      settledActual: hist[prior]?.settled ?? null,
    }
  }), [fy, hist])

  const dirty = useMemo(() => {
    for (const r of rows) for (const m of ['lodged', 'settled']) {
      const k = `${m}:${r.key}`
      const now = parseNum(vals[k] || '')
      const was = saved[k] ?? null
      if ((now ?? null) !== (was ?? null)) return true
    }
    return false
  }, [rows, vals, saved])

  const totals = useMemo(() => {
    let lt = 0, st = 0, la = 0, sa = 0, setCount = 0
    for (const r of rows) {
      const l = parseNum(vals[`lodged:${r.key}`] || '')
      const s = parseNum(vals[`settled:${r.key}`] || '')
      if (l !== null) { lt += l; setCount += 1 }
      if (s !== null) st += s
      la += r.lodgedActual || 0
      sa += r.settledActual || 0
    }
    const monthsSet = rows.filter(r => parseNum(vals[`lodged:${r.key}`] || '') !== null).length
    return { lt, st, la, sa, monthsSet }
  }, [rows, vals])

  function set(metric: string, key: string, v: string) {
    setVals(p => ({ ...p, [`${metric}:${key}`]: v }))
    setStatus('')
  }
  function fillFromLastYear(multiplier: number) {
    const next = { ...vals }
    for (const r of rows) {
      if (r.lodgedActual !== null) next[`lodged:${r.key}`] = Math.round(r.lodgedActual * multiplier).toLocaleString('en-AU')
      if (r.settledActual !== null) next[`settled:${r.key}`] = Math.round(r.settledActual * multiplier).toLocaleString('en-AU')
    }
    setVals(next)
    setStatus('Filled in from last year. Nothing is saved until you press Save.')
  }

  async function save() {
    setBusy(true)
    setStatus('')
    const upserts: any[] = []
    const deletes: { metric: string; month: string }[] = []
    for (const r of rows) for (const metric of ['lodged', 'settled']) {
      const k = `${metric}:${r.key}`
      const n = parseNum(vals[k] || '')
      if (n === null) { if (saved[k] !== undefined) deletes.push({ metric, month: r.key }) }
      else if (saved[k] !== n) upserts.push({ metric, month: r.key, amount: n })
    }
    try {
      if (upserts.length) {
        // Postgres returns zero rows with no error when a policy blocks the write, so
        // the row count is checked rather than trusting the absence of an error.
        const { data, error } = await supabase.from('pipeline_targets')
          .upsert(upserts, { onConflict: 'metric,month' }).select('metric, month')
        if (error) throw new Error(error.message)
        if (!data || data.length !== upserts.length) {
          throw new Error('the database accepted ' + (data?.length || 0) + ' of ' + upserts.length + ' rows')
        }
      }
      for (const d of deletes) {
        const { error } = await supabase.from('pipeline_targets')
          .delete().eq('metric', d.metric).eq('month', d.month)
        if (error) throw new Error(error.message)
      }
      const next = { ...saved }
      for (const u of upserts) next[`${u.metric}:${u.month}`] = u.amount
      for (const d of deletes) delete next[`${d.metric}:${d.month}`]
      setSaved(next)
      setStatus('Saved at ' + new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
    } catch (e: any) {
      setStatus('NOT SAVED - ' + (e?.message || 'the change did not reach the database'))
    } finally {
      setBusy(false)
    }
  }

  if (isAdmin !== true) return null

  const inp = 'w-[118px] text-right text-[13px] border rounded-lg px-2.5 py-1.5 tabular-nums focus:outline-none focus:border-[#2DBEFF]'
  const failed = status.startsWith('NOT SAVED')

  return (
    <section className="mb-10">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Business Targets</h2>
      <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100 flex-wrap">
          <div>
            <div className="text-[13px] font-semibold text-[#2E2A26]">Monthly targets</div>
            <div className="text-[11.5px] text-[#A29889]">
              Quarter and financial-year targets are these months added together. The Pipeline shows "not set" for any period without one.
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

        {totals.monthsSet < 12 && (
          <div className="flex items-center gap-3 bg-[#FDF6E7] border-b border-[#EFE0BC] px-5 py-2.5">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#B4761F" strokeWidth="1.6" strokeLinecap="round"><circle cx="8" cy="8" r="6.2"/><path d="M8 5v3.4M8 10.8v.2"/></svg>
            <span className="text-[12.5px] text-[#7A5F17]">
              <strong className="text-[#5E4A11]">FY{String(fy).slice(2)} targets are incomplete.</strong>{' '}
              {12 - totals.monthsSet} of 12 months still to set.
            </span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-semibold tracking-[.085em] uppercase text-[#A29889]">
                <th className="text-left px-5 py-2.5 border-b border-gray-100">Month</th>
                <th className="text-right px-3 py-2.5 border-b border-gray-100">Lodged target</th>
                <th className="text-right px-3 py-2.5 border-b border-gray-100">FY{String(fy - 1).slice(2)} actual</th>
                <th className="text-right px-3 py-2.5 border-b border-gray-100">Change</th>
                <th className="text-right px-3 py-2.5 border-b border-gray-100">Settled target</th>
                <th className="text-right px-3 py-2.5 border-b border-gray-100">FY{String(fy - 1).slice(2)} actual</th>
                <th className="text-right px-5 py-2.5 border-b border-gray-100">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const lv = parseNum(vals[`lodged:${r.key}`] || '')
                const sv = parseNum(vals[`settled:${r.key}`] || '')
                const ld = lv !== null && r.lodgedActual ? (lv - r.lodgedActual) / r.lodgedActual * 100 : null
                const sd = sv !== null && r.settledActual ? (sv - r.settledActual) / r.settledActual * 100 : null
                const pctCell = (d: number | null) => d === null ? <span className="text-gray-300">—</span>
                  : <span className={`text-[11.5px] tabular-nums ${d >= 0 ? 'text-[#2E9E63]' : 'text-[#C4553B]'}`}>
                      {(d >= 0 ? '+' : '\u2212') + Math.abs(d).toFixed(1)}%
                    </span>
                return (
                  <tr key={r.key} className="border-b border-[#F6F2EA] last:border-0 hover:bg-[#FCFAF6]">
                    <td className="px-5 py-2 text-[13px] font-medium text-[#6E665C]">{r.name}</td>
                    <td className="px-3 py-2 text-right">
                      <input value={vals[`lodged:${r.key}`] || ''} inputMode="numeric"
                        onChange={e => set('lodged', r.key, e.target.value)}
                        onBlur={e => set('lodged', r.key, withCommas(e.target.value))}
                        placeholder="not set"
                        className={inp + (lv === null ? ' bg-[#FFFCF5] border-[#EFE0BC]' : ' border-gray-200')} />
                    </td>
                    <td className="px-3 py-2 text-right text-[12.5px] text-[#A29889] tabular-nums">{compact(r.lodgedActual)}</td>
                    <td className="px-3 py-2 text-right">{pctCell(ld)}</td>
                    <td className="px-3 py-2 text-right">
                      <input value={vals[`settled:${r.key}`] || ''} inputMode="numeric"
                        onChange={e => set('settled', r.key, e.target.value)}
                        onBlur={e => set('settled', r.key, withCommas(e.target.value))}
                        placeholder="not set"
                        className={inp + (sv === null ? ' bg-[#FFFCF5] border-[#EFE0BC]' : ' border-gray-200')} />
                    </td>
                    <td className="px-3 py-2 text-right text-[12.5px] text-[#A29889] tabular-nums">{compact(r.settledActual)}</td>
                    <td className="px-5 py-2 text-right">{pctCell(sd)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200">
                <td className="px-5 py-3 text-[13px] font-semibold">Financial year</td>
                <td className="px-3 py-3 text-right text-[13px] font-semibold tabular-nums">{totals.lt ? compact(totals.lt) : '—'}</td>
                <td className="px-3 py-3 text-right text-[12.5px] text-[#A29889] tabular-nums">{compact(totals.la)}</td>
                <td className="px-3 py-3 text-right text-[11.5px] text-[#A29889]">{totals.monthsSet} of 12</td>
                <td className="px-3 py-3 text-right text-[13px] font-semibold tabular-nums">{totals.st ? compact(totals.st) : '—'}</td>
                <td className="px-3 py-3 text-right text-[12.5px] text-[#A29889] tabular-nums">{compact(totals.sa)}</td>
                <td className="px-5 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-100 bg-[#FDFCFA] flex-wrap">
          <span className={`text-[12px] ${failed ? 'text-red-600 font-medium' : 'text-[#A29889]'}`}>
            {status || (dirty ? 'Unsaved changes.' : 'Nothing to save.')}
          </span>
          <span className="flex gap-2">
            <button type="button" onClick={() => fillFromLastYear(1)}
              className="bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-lg px-3.5 py-2 text-[12.5px] font-medium hover:bg-[#F4EEE4] hover:text-[#2E2A26] transition">
              Copy FY{String(fy - 1).slice(2)} actuals
            </button>
            <button type="button" onClick={() => fillFromLastYear(1.1)}
              className="bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-lg px-3.5 py-2 text-[12.5px] font-medium hover:bg-[#F4EEE4] hover:text-[#2E2A26] transition">
              Copy FY{String(fy - 1).slice(2)} actuals + 10%
            </button>
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
