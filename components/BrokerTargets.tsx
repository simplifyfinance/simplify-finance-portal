'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { fyEndYear, todayYmd, toAuDate } from '@/lib/periods'

const FY_MONTHS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]
const NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

type TRow = { id: string; metric: string; month: string; amount: number }
type HRow = { id: string; month: string; deals_lodged: number | null; lodged_amount: number | null
              deals_settled: number | null; settled_amount: number | null }
type Login = { id: string; full_name: string; role: string; broker_key: string | null }

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
  if (n === null || n === undefined) return '—'
  const a = Math.abs(n)
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'm'
  if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'k'
  return '$' + Math.round(n)
}

// One broker, in one place: the key that links them to their deals, their targets
// and what they actually did. A figure typed here wins over deals counted in the
// portal for that month, exactly as the business screen works.
export default function BrokerTargets({ brokerKey, name }: { brokerKey: string; name: string }) {
  const supabase = createSupabaseBrowser()
  const key = (brokerKey || '').trim().toLowerCase()
  const [open, setOpen] = useState(false)
  const [fy, setFy] = useState(() => fyEndYear(todayYmd()))
  const [targets, setTargets] = useState<TRow[]>([])
  const [hist, setHist] = useState<HRow[]>([])
  const [portal, setPortal] = useState<Record<string, { lodged: number; lodgedDeals: number; settled: number; settledDeals: number }>>({})
  const [vals, setVals] = useState<Record<string, string>>({})
  const [login, setLogin] = useState<Login | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [nameMsg, setNameMsg] = useState('')

  const k = (field: string, month: string) => `${field}:${month}`

  async function load() {
    if (!key) { setLoaded(true); return }
    const [t, h, u, r] = await Promise.all([
      supabase.from('pipeline_targets').select('id, metric, month, amount').ilike('broker_key', key),
      supabase.from('pipeline_broker_history').select('*').ilike('broker_key', key),
      supabase.from('user_profiles').select('id, full_name, role, broker_key').ilike('broker_key', key),
      supabase.rpc('pipeline_register'),
    ])
    const ts: TRow[] = (t.data || []).map((x: any) => ({
      id: x.id, metric: x.metric, month: String(x.month).slice(0, 10), amount: Number(x.amount),
    }))
    const hs: HRow[] = (h.data || []).map((x: any) => ({
      id: x.id, month: String(x.month).slice(0, 10),
      deals_lodged: x.deals_lodged, lodged_amount: x.lodged_amount,
      deals_settled: x.deals_settled, settled_amount: x.settled_amount,
    }))
    setTargets(ts); setHist(hs)
    setLogin((u.data || [])[0] || null)

    const v: Record<string, string> = {}
    for (const x of ts) v[k(x.metric === 'lodged' ? 'tl' : 'ts', x.month)] = x.amount.toLocaleString('en-AU')
    for (const x of hs) {
      if (x.lodged_amount !== null)   v[k('al', x.month)] = Math.round(Number(x.lodged_amount)).toLocaleString('en-AU')
      if (x.settled_amount !== null)  v[k('as', x.month)] = Math.round(Number(x.settled_amount)).toLocaleString('en-AU')
    }
    setVals(v)

    // What the portal itself holds for this broker, so a month with no typed
    // figure still shows something and it is obvious where it came from.
    const pp: Record<string, any> = {}
    for (const d of (r.data || [])) {
      if (String(d.assigned_broker || '').trim().toLowerCase() !== key) continue
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
    setLoaded(true)
  }
  useEffect(() => { if (open && !loaded) load() }, [open])
  useEffect(() => {
    if (!key) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('user_profiles')
        .select('id, full_name, role, broker_key').ilike('broker_key', key)
      if (!cancelled) setLogin((data || [])[0] || null)
    })()
    return () => { cancelled = true }
  }, [key])

  // The name on this profile goes on client documents. The name on their login is
  // what the Pipeline, the snapshot and every broker chip shows. Two fields, and
  // nothing kept them together until now.
  const nameDrift = !!login && login.full_name.trim().toLowerCase() !== name.trim().toLowerCase()

  async function pushName() {
    if (!login) return
    setNameMsg('')
    const { data, error } = await supabase.from('user_profiles')
      .update({ full_name: name.trim() }).eq('id', login.id).select('id')
    if (error) { setNameMsg('NOT SAVED - ' + error.message); return }
    if (!data || data.length === 0) { setNameMsg('NOT SAVED - the database refused the change.'); return }
    setLogin({ ...login, full_name: name.trim() })
    setNameMsg(`Their login now reads "${name.trim()}" everywhere.`)
  }
  useEffect(() => { setLoaded(false); setTargets([]); setHist([]); setVals({}); setLogin(null) }, [key])

  const months = useMemo(() => FY_MONTHS.map(mi => {
    const month = monthKey(fy, mi)
    return { name: NAMES[mi - 1], month, h: hist.find(x => x.month === month), p: portal[month] }
  }), [fy, hist, portal])

  const savedT = useMemo(() => {
    const m: Record<string, TRow> = {}
    for (const r of targets) m[k(r.metric === 'lodged' ? 'tl' : 'ts', r.month)] = r
    return m
  }, [targets])

  const totals = useMemo(() => {
    let tl = 0, ts = 0, al = 0, as_ = 0, set = 0, rec = 0, tlRec = 0, tsRec = 0
    for (const m of months) {
      const a = parseNum(vals[k('tl', m.month)] || ''), b = parseNum(vals[k('ts', m.month)] || '')
      const c = parseNum(vals[k('al', m.month)] || ''), d = parseNum(vals[k('as', m.month)] || '')
      if (a !== null) { tl += a; set += 1 }
      if (b !== null) ts += b
      if (c !== null) { al += c; rec += 1; if (a !== null) tlRec += a }
      if (d !== null) { as_ += d; if (b !== null) tsRec += b }
    }
    return { tl, ts, al, as: as_, set, rec, tlRec, tsRec }
  }, [months, vals])

  const dirty = useMemo(() => months.some(m => {
    for (const f of ['tl', 'ts'] as const) {
      if ((parseNum(vals[k(f, m.month)] || '') ?? null) !== (savedT[k(f, m.month)]?.amount ?? null)) return true
    }
    const al = parseNum(vals[k('al', m.month)] || '')
    const as_ = parseNum(vals[k('as', m.month)] || '')
    const wasL = m.h?.lodged_amount === null || m.h?.lodged_amount === undefined ? null : Math.round(Number(m.h.lodged_amount))
    const wasS = m.h?.settled_amount === null || m.h?.settled_amount === undefined ? null : Math.round(Number(m.h.settled_amount))
    return (al === null ? null : Math.round(al)) !== wasL || (as_ === null ? null : Math.round(as_)) !== wasS
  }), [months, vals, savedT])

  function set(field: string, month: string, v: string) {
    setVals(p => ({ ...p, [k(field, month)]: v }))
    setStatus('')
  }
  function usedPortal(month: string) {
    const p = portal[month]
    if (!p) return
    setVals(v => ({
      ...v,
      [k('al', month)]: Math.round(p.lodged).toLocaleString('en-AU'),
      [k('as', month)]: Math.round(p.settled).toLocaleString('en-AU'),
    }))
    setStatus('Pulled the portal figures in. Nothing is saved until you press Save.')
  }

  async function save() {
    setBusy(true); setStatus('')
    const tIns: any[] = [], tUpd: { id: string; amount: number }[] = [], tDel: string[] = []
    const hUps: any[] = [], hDel: string[] = []
    for (const m of months) {
      for (const [f, metric] of [['tl', 'lodged'], ['ts', 'settled']] as const) {
        const n = parseNum(vals[k(f, m.month)] || '')
        const existing = savedT[k(f, m.month)]
        if (n === null) { if (existing) tDel.push(existing.id) }
        else if (!existing) tIns.push({ metric, month: m.month, broker_key: key, amount: n })
        else if (existing.amount !== n) tUpd.push({ id: existing.id, amount: n })
      }
      const al = parseNum(vals[k('al', m.month)] || '')
      const as_ = parseNum(vals[k('as', m.month)] || '')
      if (al === null && as_ === null) { if (m.h) hDel.push(m.h.id) }
      else {
        const wasL = m.h?.lodged_amount === null || m.h?.lodged_amount === undefined ? null : Math.round(Number(m.h.lodged_amount))
        const wasS = m.h?.settled_amount === null || m.h?.settled_amount === undefined ? null : Math.round(Number(m.h.settled_amount))
        if ((al === null ? null : Math.round(al)) !== wasL || (as_ === null ? null : Math.round(as_)) !== wasS) {
          hUps.push({ broker_key: key, month: m.month, lodged_amount: al, settled_amount: as_,
                      deals_lodged: m.p && al !== null ? m.p.lodgedDeals : null,
                      deals_settled: m.p && as_ !== null ? m.p.settledDeals : null,
                      source: 'manual', updated_at: new Date().toISOString() })
        }
      }
    }
    try {
      // Row counts are checked. A blocked write returns no rows and no error.
      if (tIns.length) {
        const { data, error } = await supabase.from('pipeline_targets').insert(tIns).select('id')
        if (error) throw new Error(error.message)
        if ((data?.length || 0) !== tIns.length) throw new Error('the database accepted ' + (data?.length || 0) + ' of ' + tIns.length + ' new targets')
      }
      for (const u of tUpd) {
        const { data, error } = await supabase.from('pipeline_targets').update({ amount: u.amount }).eq('id', u.id).select('id')
        if (error) throw new Error(error.message)
        if (!data || data.length === 0) throw new Error('a target did not reach the database')
      }
      if (tDel.length) {
        const { error } = await supabase.from('pipeline_targets').delete().in('id', tDel)
        if (error) throw new Error(error.message)
      }
      if (hUps.length) {
        const { data, error } = await supabase.from('pipeline_broker_history')
          .upsert(hUps, { onConflict: 'broker_key,month' }).select('id')
        if (error) throw new Error(error.message)
        if ((data?.length || 0) !== hUps.length) throw new Error('the database accepted ' + (data?.length || 0) + ' of ' + hUps.length + ' months')
      }
      if (hDel.length) {
        const { error } = await supabase.from('pipeline_broker_history').delete().in('id', hDel)
        if (error) throw new Error(error.message)
      }
      await load()
      setStatus('Saved at ' + new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
    } catch (e: any) {
      setStatus('NOT SAVED - ' + (e?.message || 'the change did not reach the database'))
    } finally { setBusy(false) }
  }

  const inp = 'w-[104px] text-right text-[12.5px] border rounded-lg px-2 py-1.5 tabular-nums focus:outline-none focus:border-[#2DBEFF]'
  const failed = status.startsWith('NOT SAVED')
  const head = 'text-[10px] font-semibold tracking-[.085em] uppercase text-[#A29889]'

  function hit(actual: number | null, target: number | null) {
    if (actual === null || !target) return <span className="text-[#C9C1B4] text-[11.5px]">—</span>
    const p = actual / target * 100
    return <span className={`text-[11.5px] font-semibold tabular-nums ${p >= 100 ? 'text-[#2E9E63]' : 'text-[#C4553B]'}`}>{Math.round(p)}%</span>
  }

  return (
    <div className="mt-4 border-t border-[#F6F2EA] pt-3">
      {nameDrift && login && (
        <div className="flex items-start gap-3 bg-[#FDF6E7] border border-[#EFE0BC] rounded-lg px-3 py-2.5 mb-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#946017" strokeWidth="1.6" strokeLinecap="round" className="shrink-0 mt-[2px]"><circle cx="8" cy="8" r="6.2"/><path d="M8 5v3.4M8 10.8v.2"/></svg>
          <span className="text-[12px] text-[#7A5F17] flex-1">
            <strong className="text-[#5E4A11]">Two different names.</strong> This profile says
            &ldquo;{name}&rdquo;, their login says &ldquo;{login.full_name}&rdquo;. The login name is what the
            Pipeline, the snapshot and every broker chip shows; this one goes on client documents.
            {nameMsg && <span className={`block mt-1 ${nameMsg.startsWith('NOT SAVED') ? 'text-[#C4553B] font-medium' : 'text-[#25794C]'}`}>{nameMsg}</span>}
          </span>
          <button type="button" onClick={pushName}
            className="text-[12px] font-semibold text-[#0E8FCB] bg-white border border-[#BFE6F9] rounded-lg px-3 py-1.5 hover:bg-[#EAF7FE] transition whitespace-nowrap shrink-0">
            Use &ldquo;{name}&rdquo; everywhere
          </button>
        </div>
      )}

      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-[12.5px] font-semibold text-[#0E8FCB] hover:underline">
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d={open ? 'M12 10L8 6l-4 4' : 'M4 6l4 4 4-4'} />
        </svg>
        Targets and actuals for {name.split(' ')[0]}
        {!open && totals.set > 0 && <span className="font-normal text-[#A29889]">· {compact(totals.tl)} targeted</span>}
      </button>

      {open && (
        <div className="mt-3">
          {!key ? (
            <div className="bg-[#FDF6E7] border border-[#EFE0BC] rounded-lg px-3 py-2.5 text-[12px] text-[#7A5F17]">
              This profile has no broker key, so there is nothing to attach targets to. Give it one above.
            </div>
          ) : (
            <>
              <div className={`rounded-lg px-3 py-2.5 text-[12px] mb-3 border ${login
                ? 'bg-[#F1F7F3] border-[#CFE6D5] text-[#25794C]'
                : 'bg-[#FAF7F2] border-[#E8E1D6] text-[#6E665C]'}`}>
                {login
                  ? <>Wired up. Key <b>{key}</b> matches the login for <b>{login.full_name}</b>, so deals stamped
                      &ldquo;{key}&rdquo; count towards them and they appear on the Pipeline.</>
                  : <>No login yet. Their targets, actuals and Pipeline card all work regardless &mdash; they
                      simply cannot sign in. Invite them in Team with the key &ldquo;{key}&rdquo; when they need
                      access, and the two link up on their own.</>}
              </div>

              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <span className={head}>
                  {totals.set} of 12 targets set · {totals.rec} month{totals.rec === 1 ? '' : 's'} recorded
                </span>
                <span className="inline-flex items-center gap-2">
                  <button type="button" onClick={() => setFy(f => f - 1)}
                    className="w-[24px] h-[24px] rounded-lg border border-[#E8E1D6] flex items-center justify-center text-[#6E665C] hover:bg-[#FAF7F2]">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5"/></svg>
                  </button>
                  <span className="text-[12.5px] font-semibold w-[46px] text-center">FY{String(fy).slice(2)}</span>
                  <button type="button" onClick={() => setFy(f => f + 1)}
                    className="w-[24px] h-[24px] rounded-lg border border-[#E8E1D6] flex items-center justify-center text-[#6E665C] hover:bg-[#FAF7F2]">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5"/></svg>
                  </button>
                </span>
              </div>

              <div className="border border-[#EDE7DD] rounded-xl overflow-x-auto bg-white">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className={head + ' text-left px-4 py-2 border-b border-[#F6F2EA]'}>Month</th>
                      <th className={head + ' text-right px-2 py-2 border-b border-[#F6F2EA]'}>Lodged target</th>
                      <th className={head + ' text-right px-2 py-2 border-b border-[#F6F2EA]'}>Lodged actual</th>
                      <th className={head + ' text-right px-2 py-2 border-b border-[#F6F2EA]'}>vs</th>
                      <th className={head + ' text-right px-2 py-2 border-b border-[#F6F2EA]'}>Settled target</th>
                      <th className={head + ' text-right px-2 py-2 border-b border-[#F6F2EA]'}>Settled actual</th>
                      <th className={head + ' text-right px-2 py-2 border-b border-[#F6F2EA]'}>vs</th>
                      <th className={head + ' text-left px-3 py-2 border-b border-[#F6F2EA]'}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map(m => {
                      const tl = parseNum(vals[k('tl', m.month)] || '')
                      const ts = parseNum(vals[k('ts', m.month)] || '')
                      const al = parseNum(vals[k('al', m.month)] || '')
                      const as_ = parseNum(vals[k('as', m.month)] || '')
                      const over = !!m.h
                      const ring = over ? ' border-[#BFE6F9] bg-[#EAF7FE]' : ' border-[#E8E1D6]'
                      return (
                        <tr key={m.month} className="border-b border-[#F6F2EA] last:border-0 hover:bg-[#FCFAF6]">
                          <td className="px-4 py-1.5 text-[13px] font-medium text-[#6E665C]">{m.name}</td>
                          <td className="px-2 py-1.5 text-right">
                            <input inputMode="numeric" placeholder="not set" value={vals[k('tl', m.month)] || ''}
                              onChange={e => set('tl', m.month, e.target.value)}
                              onBlur={e => set('tl', m.month, commas(e.target.value))}
                              className={inp + ' border-[#E8E1D6]'} />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <input inputMode="numeric" placeholder="—" value={vals[k('al', m.month)] || ''}
                              onChange={e => set('al', m.month, e.target.value)}
                              onBlur={e => set('al', m.month, commas(e.target.value))}
                              className={inp + ring} />
                          </td>
                          <td className="px-2 py-1.5 text-right">{hit(al, tl)}</td>
                          <td className="px-2 py-1.5 text-right">
                            <input inputMode="numeric" placeholder="not set" value={vals[k('ts', m.month)] || ''}
                              onChange={e => set('ts', m.month, e.target.value)}
                              onBlur={e => set('ts', m.month, commas(e.target.value))}
                              className={inp + ' border-[#E8E1D6]'} />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <input inputMode="numeric" placeholder="—" value={vals[k('as', m.month)] || ''}
                              onChange={e => set('as', m.month, e.target.value)}
                              onBlur={e => set('as', m.month, commas(e.target.value))}
                              className={inp + ring} />
                          </td>
                          <td className="px-2 py-1.5 text-right">{hit(as_, ts)}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            {over && <span className="text-[10px] font-bold uppercase tracking-[.05em] bg-[#EAF7FE] border border-[#BFE6F9] text-[#0E8FCB] rounded-full px-2 py-[2px] mr-2">Typed</span>}
                            {m.p && (
                              <button type="button" onClick={() => usedPortal(m.month)}
                                className="text-[11.5px] text-[#0E8FCB] hover:underline">
                                Use portal ({compact(m.p.lodged)})
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#FDFCFA] border-t border-[#E8E1D6]">
                      <td className="px-4 py-2.5 text-[13px] font-semibold">FY{String(fy).slice(2)}</td>
                      <td className="px-2 py-2.5 text-right text-[13px] font-semibold tabular-nums">{totals.tl ? compact(totals.tl) : '—'}</td>
                      <td className="px-2 py-2.5 text-right text-[13px] font-semibold tabular-nums">{totals.al ? compact(totals.al) : '—'}</td>
                      <td className="px-2 py-2.5 text-right">{hit(totals.al || null, totals.tlRec || null)}</td>
                      <td className="px-2 py-2.5 text-right text-[13px] font-semibold tabular-nums">{totals.ts ? compact(totals.ts) : '—'}</td>
                      <td className="px-2 py-2.5 text-right text-[13px] font-semibold tabular-nums">{totals.as ? compact(totals.as) : '—'}</td>
                      <td className="px-2 py-2.5 text-right">{hit(totals.as || null, totals.tsRec || null)}</td>
                      <td className="px-3 py-2.5 text-[11px] text-[#A29889] whitespace-nowrap">
                        {totals.rec ? 'against the months recorded' : ''}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex items-center justify-between gap-3 mt-2.5 flex-wrap">
                <span className={`text-[12px] ${failed ? 'text-[#C4553B] font-medium' : 'text-[#A29889]'}`}>
                  {status || (dirty ? 'Unsaved changes.' : 'A typed actual wins over deals counted in the portal. Clear both boxes to release the month.')}
                </span>
                <button type="button" onClick={save} disabled={!dirty || busy}
                  className="bg-[#343333] text-white rounded-lg px-4 py-1.5 text-[12.5px] font-semibold hover:bg-[#2a2a2a] transition disabled:opacity-40">
                  {busy ? 'Saving...' : 'Save'}
                </button>
              </div>
              <p className="text-[11px] text-[#A29889] mt-2">
                Saved straight away, separately from the Save button at the bottom of this page.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
