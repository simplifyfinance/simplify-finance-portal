'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { fyEndYear, todayYmd, toAuDate } from '@/lib/periods'

const FY_MONTHS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]
const NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthKey(fyEnd: number, mi: number): string {
  const y = mi >= 7 ? fyEnd - 1 : fyEnd
  return `${y}-${String(mi).padStart(2, '0')}-01`
}
function parseNum(s: string): number | null {
  const d = String(s).replace(/[^0-9]/g, '')
  if (d === '') return null
  const n = Number(d)
  return isNaN(n) ? null : n
}
function commas(s: string): string {
  const n = parseNum(s)
  return n === null ? '' : n.toLocaleString('en-AU')
}
function num(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? null : n
}
function splitsTotal(sp: any): number | null {
  if (!Array.isArray(sp) || sp.length === 0) return null
  let t = 0, seen = false
  for (const x of sp) { const n = num(x?.amount); if (n !== null) { t += n; seen = true } }
  return seen ? t : null
}
function compact(n: number | null): string {
  if (n === null) return '-'
  const a = Math.abs(n)
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'm'
  if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'k'
  return '$' + Math.round(n)
}

export default function MonthlyActuals() {
  const supabase = createSupabaseBrowser()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [fy, setFy] = useState(() => fyEndYear(todayYmd()))
  const [hist, setHist] = useState<Record<string, any>>({})
  const [portal, setPortal] = useState<Record<string, { lodged: number; lodgedDeals: number; settled: number; settledDeals: number }>>({})
  const [vals, setVals] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const key = (field: string, month: string) => `${field}:${month}`

  async function load() {
    const { data: u } = await supabase.auth.getUser()
    if (!u?.user) { setIsAdmin(false); return }
    const { data: prof } = await supabase.from('user_profiles').select('is_admin').eq('id', u.user.id).single()
    if (!prof?.is_admin) { setIsAdmin(false); return }
    setIsAdmin(true)

    const [h, r] = await Promise.all([
      supabase.from('pipeline_history').select('*'),
      supabase.rpc('pipeline_register'),
    ])
    const hh: Record<string, any> = {}
    const v: Record<string, string> = {}
    for (const row of (h.data || [])) {
      const m = String(row.month).slice(0, 10)
      hh[m] = row
      if (row.deals_lodged !== null)   v[key('dl', m)] = Number(row.deals_lodged).toLocaleString('en-AU')
      if (row.lodged_amount !== null)  v[key('la', m)] = Math.round(Number(row.lodged_amount)).toLocaleString('en-AU')
      if (row.deals_settled !== null)  v[key('ds', m)] = Number(row.deals_settled).toLocaleString('en-AU')
      if (row.settled_amount !== null) v[key('sa', m)] = Math.round(Number(row.settled_amount)).toLocaleString('en-AU')
    }
    setHist(hh); setVals(v)

    // What the portal itself has recorded, so a month with no history row still
    // shows a figure and it is obvious where it came from.
    const pp: Record<string, any> = {}
    for (const d of (r.data || [])) {
      const ld = toAuDate(d.lodged_date || d.lodged_at)
      const sd = toAuDate(d.settled_date || d.settled_at)
      const la = num(d.lodged_total) ?? splitsTotal(d.lodged_splits) ?? num(d.loan_amount) ?? 0
      const sa = num(d.settled_total) ?? splitsTotal(d.settled_splits) ?? num(d.loan_amount) ?? 0
      if (ld) {
        const m = ld.slice(0, 7) + '-01'
        pp[m] = pp[m] || { lodged: 0, lodgedDeals: 0, settled: 0, settledDeals: 0 }
        pp[m].lodged += la; pp[m].lodgedDeals += 1
      }
      if (sd) {
        const m = sd.slice(0, 7) + '-01'
        pp[m] = pp[m] || { lodged: 0, lodgedDeals: 0, settled: 0, settledDeals: 0 }
        pp[m].settled += sa; pp[m].settledDeals += 1
      }
    }
    setPortal(pp)
  }
  useEffect(() => { load() }, [])

  const months = useMemo(() => FY_MONTHS.map(mi => {
    const m = monthKey(fy, mi)
    const row = hist[m]
    const p = portal[m]
    const src = row ? (row.source === 'manual' ? 'override' : 'spreadsheet') : (p ? 'portal' : 'none')
    return { mi, name: NAMES[mi - 1], month: m, row, p, src, future: m > todayYmd().slice(0, 7) + '-01' }
  }), [fy, hist, portal])

  const dirty = useMemo(() => months.some(mm => {
    for (const [f, col] of [['dl', 'deals_lodged'], ['la', 'lodged_amount'], ['ds', 'deals_settled'], ['sa', 'settled_amount']] as const) {
      const now = parseNum(vals[key(f, mm.month)] || '')
      const was = mm.row?.[col] === null || mm.row?.[col] === undefined ? null : Math.round(Number(mm.row[col]))
      if ((now === null ? null : Math.round(now)) !== was) return true
    }
    return false
  }), [months, vals])

  function set(field: string, month: string, v: string) {
    setVals(p => ({ ...p, [key(field, month)]: v }))
    setStatus('')
  }
  function pullFromPortal(month: string) {
    const p = portal[month]
    if (!p) return
    setVals(v => ({
      ...v,
      [key('dl', month)]: String(p.lodgedDeals),
      [key('la', month)]: Math.round(p.lodged).toLocaleString('en-AU'),
      [key('ds', month)]: String(p.settledDeals),
      [key('sa', month)]: Math.round(p.settled).toLocaleString('en-AU'),
    }))
    setStatus('Pulled the portal figures in. Nothing is saved until you press Save.')
  }

  async function release(month: string) {
    if (!confirm('Release ' + month.slice(0, 7) + '? The Pipeline will fall back to counting deals recorded in the portal for that month.')) return
    setBusy(true)
    const { error } = await supabase.from('pipeline_history').delete().eq('month', month)
    if (error) setStatus('NOT RELEASED - ' + error.message)
    else { await load(); setStatus('Released ' + month.slice(0, 7)) }
    setBusy(false)
  }

  async function save() {
    setBusy(true); setStatus('')
    const ups: any[] = [], dels: string[] = []
    for (const mm of months) {
      const dl = parseNum(vals[key('dl', mm.month)] || '')
      const la = parseNum(vals[key('la', mm.month)] || '')
      const ds = parseNum(vals[key('ds', mm.month)] || '')
      const sa = parseNum(vals[key('sa', mm.month)] || '')
      const empty = dl === null && la === null && ds === null && sa === null
      if (empty) { if (mm.row) dels.push(mm.month); continue }
      const changed = [['dl', 'deals_lodged', dl], ['la', 'lodged_amount', la], ['ds', 'deals_settled', ds], ['sa', 'settled_amount', sa]]
        .some(([, col, v]) => {
          const was = mm.row?.[col as string]
          const wasN = was === null || was === undefined ? null : Math.round(Number(was))
          return (v === null ? null : Math.round(v as number)) !== wasN
        })
      if (!changed) continue
      ups.push({
        month: mm.month, deals_lodged: dl, lodged_amount: la, deals_settled: ds, settled_amount: sa,
        // A figure a person typed is an override, and says so on the screen.
        source: 'manual', updated_at: new Date().toISOString(),
      })
    }
    try {
      if (ups.length) {
        const { data, error } = await supabase.from('pipeline_history')
          .upsert(ups, { onConflict: 'month' }).select('month')
        if (error) throw new Error(error.message)
        if ((data?.length || 0) !== ups.length) throw new Error('the database accepted ' + (data?.length || 0) + ' of ' + ups.length + ' months')
      }
      if (dels.length) {
        const { error } = await supabase.from('pipeline_history').delete().in('month', dels)
        if (error) throw new Error(error.message)
      }
      await load()
      setStatus(ups.length || dels.length
        ? 'Saved at ' + new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
        : 'Nothing changed.')
    } catch (e: any) {
      setStatus('NOT SAVED - ' + (e?.message || 'the change did not reach the database'))
    } finally { setBusy(false) }
  }

  if (isAdmin === null) return <div className="max-w-6xl mx-auto p-6 text-sm text-[#A29889]">Loading...</div>
  if (isAdmin === false) return (
    <div className="max-w-6xl mx-auto p-6">
      <p className="text-lg font-medium text-[#2E2A26] mb-2">Monthly actuals</p>
      <p className="text-sm text-[#6E665C]">Only an admin can change the monthly figures.</p>
    </div>
  )

  const inp = 'text-right text-[13px] border rounded-lg px-2.5 py-1.5 tabular-nums focus:outline-none focus:border-[#2DBEFF]'
  const tag = 'text-[10px] font-bold tracking-[.05em] uppercase rounded-full px-2 py-[2px]'
  const failed = status.startsWith('NOT ')

  return (
    <div className="max-w-6xl mx-auto p-6">
      <p className="text-lg font-medium text-[#2E2A26] mb-1">Monthly actuals</p>
      <p className="text-[12.5px] text-[#A29889] mb-5 max-w-[80ch]">
        What the Pipeline reports for each month. A figure typed here overrides whatever the portal would count,
        until you release it — which is how you keep reporting real numbers while the team is still learning to
        mark deals through.
      </p>

      <div className="border border-[#EDE7DD] rounded-xl bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#F6F2EA] flex-wrap">
          <div className="flex gap-2 items-center flex-wrap text-[11.5px] text-[#6E665C]">
            <span className={tag + ' bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C]'}>Spreadsheet</span> loaded from your file
            <span className={tag + ' bg-[#F1F7F3] border border-[#CFE6D5] text-[#25794C] ml-2'}>Portal</span> counted from deals here
            <span className={tag + ' bg-[#EAF7FE] border border-[#BFE6F9] text-[#0E8FCB] ml-2'}>Override</span> typed by hand
          </div>
          <div className="inline-flex items-center gap-2">
            <button onClick={() => setFy(f => f - 1)} className="w-[26px] h-[26px] rounded-lg border border-[#E8E1D6] flex items-center justify-center text-[#6E665C] hover:bg-[#FAF7F2]">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5"/></svg>
            </button>
            <span className="text-[13px] font-semibold w-[52px] text-center">FY{String(fy).slice(2)}</span>
            <button onClick={() => setFy(f => f + 1)} className="w-[26px] h-[26px] rounded-lg border border-[#E8E1D6] flex items-center justify-center text-[#6E665C] hover:bg-[#FAF7F2]">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5"/></svg>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-semibold tracking-[.085em] uppercase text-[#A29889]">
                <th className="text-left px-5 py-2.5 border-b border-[#F6F2EA]">Month</th>
                <th className="text-right px-3 py-2.5 border-b border-[#F6F2EA]">Deals lodged</th>
                <th className="text-right px-3 py-2.5 border-b border-[#F6F2EA]">Lodged</th>
                <th className="text-right px-3 py-2.5 border-b border-[#F6F2EA]">Deals settled</th>
                <th className="text-right px-3 py-2.5 border-b border-[#F6F2EA]">Settled</th>
                <th className="text-left px-3 py-2.5 border-b border-[#F6F2EA]">Source</th>
                <th className="text-right px-5 py-2.5 border-b border-[#F6F2EA]"></th>
              </tr>
            </thead>
            <tbody>
              {months.map(mm => {
                const over = mm.src === 'override'
                const ring = over ? ' border-[#BFE6F9] bg-[#EAF7FE]' : ' border-[#E8E1D6]'
                return (
                  <tr key={mm.month} className="border-b border-[#F6F2EA] last:border-0 hover:bg-[#FCFAF6]">
                    <td className="px-5 py-2 text-[13px] font-medium text-[#6E665C]">
                      {mm.name} {String(fy - (mm.mi >= 7 ? 1 : 0))}
                    </td>
                    {(['dl', 'la', 'ds', 'sa'] as const).map(f => (
                      <td key={f} className="px-3 py-2 text-right">
                        <input value={vals[key(f, mm.month)] || ''} inputMode="numeric"
                          onChange={e => set(f, mm.month, e.target.value)}
                          onBlur={e => set(f, mm.month, commas(e.target.value))}
                          placeholder={mm.future ? '' : '—'}
                          className={inp + ring + (f === 'dl' || f === 'ds' ? ' w-[74px]' : ' w-[118px]')} />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {mm.src === 'spreadsheet' && <span className={tag + ' bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C]'}>Spreadsheet</span>}
                      {mm.src === 'override' && <span className={tag + ' bg-[#EAF7FE] border border-[#BFE6F9] text-[#0E8FCB]'}>Override</span>}
                      {mm.src === 'portal' && <span className={tag + ' bg-[#F1F7F3] border border-[#CFE6D5] text-[#25794C]'}>Portal</span>}
                      {mm.src === 'none' && <span className="text-[11.5px] text-[#C9C1B4]">{mm.future ? 'not started' : 'nothing recorded'}</span>}
                    </td>
                    <td className="px-5 py-2 text-right whitespace-nowrap">
                      {mm.p && (
                        <button onClick={() => pullFromPortal(mm.month)} disabled={busy}
                          className="text-[11.5px] text-[#0E8FCB] hover:underline mr-3">
                          Use portal ({compact(mm.p.lodged)})
                        </button>
                      )}
                      {mm.row && (
                        <button onClick={() => release(mm.month)} disabled={busy}
                          className="text-[11.5px] text-[#A29889] hover:text-[#C4553B]">Release</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-[#F6F2EA] bg-[#FDFCFA] flex-wrap">
          <span className={`text-[12px] ${failed ? 'text-[#C4553B] font-medium' : 'text-[#A29889]'}`}>
            {status || (dirty ? 'Unsaved changes.' : 'Clearing every box on a row and saving releases that month.')}
          </span>
          <button onClick={save} disabled={!dirty || busy}
            className="bg-[#343333] text-white rounded-lg px-5 py-2 text-[13px] font-semibold hover:bg-[#2a2a2a] transition disabled:opacity-40">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
