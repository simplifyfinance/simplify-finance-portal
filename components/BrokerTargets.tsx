'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { fyEndYear, todayYmd } from '@/lib/periods'

const FY_MONTHS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]
const NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

type Row = { id: string; metric: string; month: string; amount: number }
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
function compact(n: number | null): string {
  if (n === null || n === undefined) return '—'
  const a = Math.abs(n)
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'm'
  if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'k'
  return '$' + Math.round(n)
}

// One broker's targets, sitting on their own profile rather than on a separate
// screen. The key below is what joins a profile to their deals, their login and
// these targets - it is the only thing tying the three together.
export default function BrokerTargets({ brokerKey, name }: { brokerKey: string; name: string }) {
  const supabase = createSupabaseBrowser()
  const key = (brokerKey || '').trim().toLowerCase()
  const [open, setOpen] = useState(false)
  const [fy, setFy] = useState(() => fyEndYear(todayYmd()))
  const [rows, setRows] = useState<Row[]>([])
  const [vals, setVals] = useState<Record<string, string>>({})
  const [login, setLogin] = useState<Login | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const k = (metric: string, month: string) => `${metric}:${month}`

  async function load() {
    if (!key) { setLoaded(true); return }
    const [t, u] = await Promise.all([
      supabase.from('pipeline_targets').select('id, metric, month, amount').ilike('broker_key', key),
      supabase.from('user_profiles').select('id, full_name, role, broker_key').ilike('broker_key', key),
    ])
    const rs: Row[] = (t.data || []).map((r: any) => ({
      id: r.id, metric: r.metric, month: String(r.month).slice(0, 10), amount: Number(r.amount),
    }))
    setRows(rs)
    setVals(Object.fromEntries(rs.map(r => [k(r.metric, r.month), r.amount.toLocaleString('en-AU')])))
    setLogin((u.data || [])[0] || null)
    setLoaded(true)
  }
  useEffect(() => { if (open && !loaded) load() }, [open])
  useEffect(() => { setLoaded(false); setRows([]); setVals({}); setLogin(null) }, [key])

  const months = useMemo(() => FY_MONTHS.map(mi => ({ name: NAMES[mi - 1], month: monthKey(fy, mi) })), [fy])
  const saved = useMemo(() => {
    const m: Record<string, Row> = {}
    for (const r of rows) m[k(r.metric, r.month)] = r
    return m
  }, [rows])

  const totals = useMemo(() => {
    let l = 0, s = 0, set = 0
    for (const m of months) {
      const lv = parseNum(vals[k('lodged', m.month)] || '')
      const sv = parseNum(vals[k('settled', m.month)] || '')
      if (lv !== null) { l += lv; set += 1 }
      if (sv !== null) s += sv
    }
    return { l, s, set }
  }, [months, vals])

  const dirty = useMemo(() => months.some(m => ['lodged', 'settled'].some(metric => {
    const kk = k(metric, m.month)
    return (parseNum(vals[kk] || '') ?? null) !== (saved[kk]?.amount ?? null)
  })), [months, vals, saved])

  async function save() {
    setBusy(true); setStatus('')
    const inserts: any[] = [], updates: { id: string; amount: number }[] = [], deletes: string[] = []
    for (const m of months) for (const metric of ['lodged', 'settled']) {
      const kk = k(metric, m.month)
      const n = parseNum(vals[kk] || '')
      const existing = saved[kk]
      if (n === null) { if (existing) deletes.push(existing.id) }
      else if (!existing) inserts.push({ metric, month: m.month, broker_key: key, amount: n })
      else if (existing.amount !== n) updates.push({ id: existing.id, amount: n })
    }
    try {
      // Row counts are checked. A blocked write returns no rows and no error.
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

  const inp = 'w-[112px] text-right text-[13px] border border-[#E8E1D6] rounded-lg px-2.5 py-1.5 tabular-nums focus:outline-none focus:border-[#2DBEFF]'
  const failed = status.startsWith('NOT SAVED')

  return (
    <div className="mt-4 border-t border-[#F6F2EA] pt-3">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-[12.5px] font-semibold text-[#0E8FCB] hover:underline">
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d={open ? 'M12 10L8 6l-4 4' : 'M4 6l4 4 4-4'} />
        </svg>
        Targets for {name.split(' ')[0]}
        {totals.set > 0 && !open && <span className="font-normal text-[#A29889]">· {compact(totals.l)} lodged set</span>}
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
                : 'bg-[#FDF6E7] border-[#EFE0BC] text-[#7A5F17]'}`}>
                {login
                  ? <>Wired up. Key <b>{key}</b> matches the login for <b>{login.full_name}</b>, so deals stamped
                      &ldquo;{key}&rdquo; count towards them and they appear on the Pipeline.</>
                  : <><strong className="text-[#5E4A11]">No login has this key.</strong> Targets set here will save,
                      but nobody appears on the Pipeline under &ldquo;{key}&rdquo; until a team member carries that
                      broker key. Set it in Settings, Team, Access.</>}
              </div>

              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <span className="text-[11px] font-semibold text-[#A29889] uppercase tracking-[.08em]">
                  Monthly targets · {totals.set} of 12 set
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

              <div className="border border-[#EDE7DD] rounded-xl overflow-hidden bg-white">
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 text-[10px] font-semibold tracking-[.085em] uppercase text-[#A29889] border-b border-[#F6F2EA]">
                  <span>Month</span><span className="text-right w-[112px]">Lodged</span><span className="text-right w-[112px]">Settled</span>
                </div>
                {months.map(m => (
                  <div key={m.month} className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-1.5 items-center border-b border-[#F6F2EA] last:border-0">
                    <span className="text-[13px] text-[#6E665C] font-medium">{m.name}</span>
                    {(['lodged', 'settled'] as const).map(metric => (
                      <input key={metric} inputMode="numeric" placeholder="not set"
                        value={vals[k(metric, m.month)] || ''}
                        onChange={e => { setVals(p => ({ ...p, [k(metric, m.month)]: e.target.value })); setStatus('') }}
                        onBlur={e => setVals(p => ({ ...p, [k(metric, m.month)]: commas(e.target.value) }))}
                        className={inp} />
                    ))}
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 items-center bg-[#FDFCFA] border-t border-[#E8E1D6]">
                  <span className="text-[13px] font-semibold">FY{String(fy).slice(2)} total</span>
                  <span className="text-[13px] font-semibold text-right w-[112px] tabular-nums">{totals.l ? compact(totals.l) : '—'}</span>
                  <span className="text-[13px] font-semibold text-right w-[112px] tabular-nums">{totals.s ? compact(totals.s) : '—'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 mt-2.5 flex-wrap">
                <span className={`text-[12px] ${failed ? 'text-[#C4553B] font-medium' : 'text-[#A29889]'}`}>
                  {status || (dirty ? 'Unsaved changes.' : 'Clearing a box and saving removes that target.')}
                </span>
                <button type="button" onClick={save} disabled={!dirty || busy}
                  className="bg-[#343333] text-white rounded-lg px-4 py-1.5 text-[12.5px] font-semibold hover:bg-[#2a2a2a] transition disabled:opacity-40">
                  {busy ? 'Saving...' : 'Save targets'}
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
