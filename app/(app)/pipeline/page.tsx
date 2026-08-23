'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { listPeriods, inPeriod, toAuDate, todayYmd, fyEndYear, type Period, type PeriodKind } from '@/lib/periods'
import { ContextChart, FyProgressChart } from '@/components/PipelineCharts'
import MonthlyActuals from '@/components/MonthlyActuals'

/* ---------- formatting ---------- */
function num(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? null : n
}
function fmt(v: any): string {
  const n = num(v)
  if (n === null) return '-'
  return '$' + Math.round(n).toLocaleString('en-AU')
}
function compact(n: number | null): string {
  if (n === null) return '-'
  const a = Math.abs(n)
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'm'
  if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'k'
  return '$' + Math.round(n)
}
function pct(now: number, base: number): number { return (now - base) / base * 100 }
function signed(p: number): string { return (p > 0 ? '+' : p < 0 ? '\u2212' : '') + Math.abs(p).toFixed(1) + '%' }
function dmy(ymd: string): string {
  if (!ymd) return '-'
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}
function splitsTotal(splits: any): number | null {
  if (!Array.isArray(splits) || splits.length === 0) return null
  let t = 0, seen = false
  for (const s of splits) { const n = num(s?.amount); if (n !== null) { t += n; seen = true } }
  return seen ? t : null
}
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

type Metric = 'lodged' | 'settled'

export default function PipelinePage() {
  const supabase = createSupabaseBrowser()
  const [metric, setMetric] = useState<Metric>('lodged')
  const [kind, setKind] = useState<PeriodKind>('month')
  const [periodKey, setPeriodKey] = useState('')
  const [reg, setReg] = useState<any[]>([])
  const [scope, setScope] = useState('')            // '' is the whole business
  const [brokers, setBrokers] = useState<{ key: string; name: string }[]>([])
  const [hist, setHist] = useState<any[]>([])
  const [targets, setTargets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [view, setView] = useState('report')
  useEffect(() => {
    const read = () => setView(window.location.hash.slice(1) === 'actuals' ? 'actuals' : 'report')
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])
  const [pickOpen, setPickOpen] = useState(false)
  const pickRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [r, h, t, b] = await Promise.all([
        supabase.rpc('pipeline_register'),
        supabase.from('pipeline_history').select('month, deals_lodged, lodged_amount, deals_settled, settled_amount'),
        supabase.from('pipeline_targets').select('metric, month, amount, broker_key'),
        supabase.from('user_profiles').select('full_name, broker_key').not('broker_key', 'is', null),
      ])
      if (cancelled) return
      // A failed read must never look like a quiet business.
      if (r.error || h.error) {
        setLoadError(r.error?.message || h.error?.message || 'Could not load the pipeline.')
        setLoading(false)
        return
      }
      setReg(r.data || [])
      setHist(h.data || [])
      setTargets(t.error ? [] : (t.data || []))   // targets are optional until they are set
      const seen = new Set<string>()
      const bs: { key: string; name: string }[] = []
      for (const r2 of (b.data || [])) {
        const key = String(r2.broker_key || '').toLowerCase()
        if (!key || seen.has(key)) continue
        seen.add(key)
        bs.push({ key, name: r2.full_name || key })
      }
      setBrokers(bs.sort((x, y) => x.name.localeCompare(y.name)))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    function away(e: MouseEvent) {
      if (pickRef.current && !pickRef.current.contains(e.target as Node)) setPickOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])

  /* ---------- deal-level rows from the portal ---------- */
  const dealRows = useMemo(() => reg.map(d => {
    const lodgedAmount  = num(d.lodged_total)  ?? splitsTotal(d.lodged_splits)  ?? num(d.loan_amount)
    const settledAmount = num(d.settled_total) ?? splitsTotal(d.settled_splits) ?? num(d.loan_amount)
    return {
      id: d.deal_id,
      name: d.deal_name || '(unnamed deal)',
      broker: d.assigned_broker || '-',
      lodgedLender: d.lodged_lender || d.lender || '-',
      settledLender: d.settled_lender || d.formal_lender || d.lodged_lender || d.lender || '-',
      lodgedDate:  toAuDate(d.lodged_date  || d.lodged_at),
      settledDate: toAuDate(d.settled_date || d.settled_at),
      lodgedAmount, settledAmount,
      lodgedSplits:  Array.isArray(d.lodged_splits)  ? d.lodged_splits.length  : 0,
      settledSplits: Array.isArray(d.settled_splits) ? d.settled_splits.length : 0,
      upfront: num(d.expected_upfront),
      status: d.settled_at ? 'Settled' : d.formal_approval_at ? 'Formal approval'
            : d.preapproval_at ? 'Preapproved' : d.lodged_at ? 'Lodged' : '-',
    }
  }), [reg])

  /* ---------- one monthly actual per month, spreadsheet first ---------- */
  // The spreadsheet is authoritative for any month it holds, because the team is
  // not yet marking deals through the portal. As soon as a month has no history
  // row, the portal's own deals become the figure - and the page says which.
  const monthly = useMemo(() => {
    const m: Record<string, { amount: number; deals: number; source: 'spreadsheet' | 'portal' }> = {}
    if (scope) {
      for (const r of dealRows) {
        if ((r.broker || '').toLowerCase() !== scope) continue
        const date = metric === 'lodged' ? r.lodgedDate : r.settledDate
        if (!date) continue
        const key = date.slice(0, 7)
        if (!m[key]) m[key] = { amount: 0, deals: 0, source: 'portal' }
        m[key].amount += (metric === 'lodged' ? r.lodgedAmount : r.settledAmount) || 0
        m[key].deals += 1
      }
      return m
    }
    for (const h of hist) {
      const key = String(h.month).slice(0, 7)
      const amount = num(metric === 'lodged' ? h.lodged_amount : h.settled_amount)
      const deals  = num(metric === 'lodged' ? h.deals_lodged  : h.deals_settled)
      if (amount !== null) m[key] = { amount, deals: deals || 0, source: 'spreadsheet' }
    }
    for (const r of dealRows) {
      const date = metric === 'lodged' ? r.lodgedDate : r.settledDate
      if (!date) continue
      const key = date.slice(0, 7)
      if (m[key]?.source === 'spreadsheet') continue
      const amt = metric === 'lodged' ? r.lodgedAmount : r.settledAmount
      if (!m[key]) m[key] = { amount: 0, deals: 0, source: 'portal' }
      m[key].amount += amt || 0
      m[key].deals += 1
    }
    return m
  }, [hist, dealRows, metric, scope])

  const targetByMonth = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of targets) if (t.metric === metric && (t.broker_key || '') === scope) {
      const a = num(t.amount)
      if (a !== null) m[String(t.month).slice(0, 7)] = a
    }
    return m
  }, [targets, metric, scope])

  /* ---------- periods ---------- */
  const COUNT: Record<PeriodKind, number> = { week: 26, month: 144, quarter: 48, fy: 12 }
  const periods = useMemo(() => listPeriods(kind, COUNT[kind]), [kind])
  const period: Period | undefined = useMemo(
    () => periods.find(p => p.key === periodKey) || periods[0], [periods, periodKey])

  // Value of any period = the months inside it. Weeks are smaller than the data
  // we hold, so weekly views carry no history and no comparisons.
  function periodValue(p: Period): { amount: number; deals: number; sources: Set<string>; months: number } {
    let amount = 0, deals = 0, months = 0
    const sources = new Set<string>()
    for (const [key, v] of Object.entries(monthly)) {
      if (key + '-01' >= p.start && key + '-01' <= p.end) {
        amount += v.amount; deals += v.deals; months += 1; sources.add(v.source)
      }
    }
    return { amount, deals, sources, months }
  }
  function periodTarget(p: Period): number | null {
    let t = 0, seen = false
    for (const [key, v] of Object.entries(targetByMonth)) {
      if (key + '-01' >= p.start && key + '-01' <= p.end) { t += v; seen = true }
    }
    return seen ? t : null
  }

  const idx = useMemo(() => periods.findIndex(p => p.key === period?.key), [periods, period])
  const backOneYear = kind === 'month' ? 12 : kind === 'quarter' ? 4 : kind === 'fy' ? 1 : 0

  const current = period ? periodValue(period) : { amount: 0, deals: 0, sources: new Set<string>(), months: 0 }
  const target = period ? periodTarget(period) : null
  const inProgress = !!period && todayYmd() >= period.start && todayYmd() <= period.end

  // The calendar months a period spans, in order.
  function monthKeysIn(pp: Period): string[] {
    const out: string[] = []
    let y = Number(pp.start.slice(0, 4)), m = Number(pp.start.slice(5, 7))
    for (let guard = 0; guard < 24; guard++) {
      const key = `${y}-${String(m).padStart(2, '0')}`
      if (key + '-01' > pp.end) break
      out.push(key)
      m += 1
      if (m > 12) { m = 1; y += 1 }
    }
    return out
  }

  // A part-finished period must never be measured against finished ones. A financial
  // year holding one month of data is compared against the FIRST MONTH of earlier
  // years, not their full twelve; a month still running is compared against the same
  // share of earlier months. Otherwise every comparison reads as a collapse.
  const shape = useMemo(() => {
    if (!period || !backOneYear) return null
    const keys = monthKeysIn(period)
    const withData = keys.filter(k => monthly[k])
    if (withData.length === 0) return null
    const todayKey = todayYmd().slice(0, 7)
    const lastKey = withData[withData.length - 1]
    const partial = inProgress && lastKey === todayKey
    let frac = 1
    if (partial) {
      const y = Number(todayKey.slice(0, 4)), m = Number(todayKey.slice(5, 7))
      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
      frac = Number(todayYmd().slice(8, 10)) / daysInMonth
    }
    return { n: withData.length, total: keys.length, frac, partial,
             clipped: withData.length < keys.length || partial }
  }, [period, monthly, inProgress, backOneYear])

  // Any other period, cut to the same shape as the one on screen.
  function baseline(pp: Period): number {
    const keys = shape ? monthKeysIn(pp).slice(0, shape.n) : monthKeysIn(pp)
    let t = 0
    keys.forEach((k, i) => {
      const v = monthly[k]?.amount || 0
      t += (shape && i === keys.length - 1) ? v * shape.frac : v
    })
    return t
  }

  // The selected period keeps its real figure; everything it is measured against is
  // cut down to match it.
  const series = useMemo(
    () => periods.map(pp => ({ p: pp, value: pp.key === period?.key ? current.amount : baseline(pp) })),
    [periods, shape, monthly, period, current.amount])

  const lastYear = backOneYear && series[idx + backOneYear]?.value ? series[idx + backOneYear] : null
  const threeYear = useMemo(() => {
    if (!backOneYear) return null
    const vals = [1, 2, 3].map(n => series[idx + backOneYear * n]).filter(s => s && s.value > 0)
    if (vals.length === 0) return null
    return { avg: vals.reduce((t, s) => t + s.value, 0) / vals.length, n: vals.length }
  }, [series, idx, backOneYear])

  const record = useMemo(() => {
    const withData = series.filter(s => s.value > 0)
    if (withData.length === 0) return null
    const sorted = [...withData].sort((a, b) => b.value - a.value)
    const rank = sorted.findIndex(s => s.p.key === period?.key) + 1
    return { best: sorted[0], rank: rank || null, total: sorted.length, isBest: sorted[0].p.key === period?.key,
             second: sorted[1] || null }
  }, [series, period])

  // FY to date, and the same span a year ago.
  const fytd = useMemo(() => {
    if (!period) return null
    const fy = fyEndYear(period.end)
    const start = `${fy - 1}-07-01`
    let now = 0, then = 0
    for (const [key, v] of Object.entries(monthly)) {
      const d = key + '-01'
      if (d >= start && d <= period.end) now += v.amount
      const shifted = `${Number(key.slice(0, 4)) + 1}-${key.slice(5)}-01`
      if (shifted >= start && shifted <= period.end) then += v.amount
    }
    return { now, then }
  }, [monthly, period])

  /* ---------- chart data ---------- */
  const FY_MONTHS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]

  // The selected period against the ones before it, with the same-period average of
  // the three prior years drawn behind them. Raw totals here, not the clipped
  // baselines - a chart of whole periods is honest as long as the running one is marked.
  const contextChart = useMemo(() => {
    if (kind === 'week' || !period || idx < 0) return null
    const n = kind === 'fy' ? 5 : kind === 'quarter' ? 8 : 12
    const bars: any[] = []
    for (let k = n - 1; k >= 0; k--) {
      const pp = periods[idx + k]
      if (!pp) continue
      const priors = [1, 2, 3]
        .map(j => periods[idx + k + backOneYear * j])
        .filter(Boolean)
        .map(q => periodValue(q).amount)
        .filter(x => x > 0)
      bars.push({
        label: pp.label,
        value: periodValue(pp).amount,
        avg: priors.length ? priors.reduce((a, b) => a + b, 0) / priors.length : null,
        selected: pp.key === period.key,
        partial: todayYmd() >= pp.start && todayYmd() <= pp.end,
      })
    }
    return bars.some(b => b.value > 0) ? bars : null
  }, [kind, periods, idx, period, monthly, backOneYear])

  // Cumulative, so a part-finished year draws a shorter line rather than a smaller one.
  const fyChart = useMemo(() => {
    if (kind !== 'fy' || !period) return null
    const fy = fyEndYear(period.end)
    const monthsOf = (end: number) => FY_MONTHS.map(mi => {
      const y = mi >= 7 ? end - 1 : end
      return monthly[`${y}-${String(mi).padStart(2, '0')}`]?.amount ?? null
    })
    const now = monthsOf(fy), prev = monthsOf(fy - 1)
    const avg = FY_MONTHS.map((_, i) => {
      const vals = [1, 2, 3].map(j => monthsOf(fy - j)[i]).filter(v => v !== null) as number[]
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    })
    if (!now.some(v => v !== null)) return null
    return { now, prev, avg, nowLabel: period.label, prevLabel: `FY${String(fy - 1).slice(2)}` }
  }, [kind, period, monthly])

  /* ---------- deal rows inside the selected period ---------- */
  const rows = useMemo(() => {
    if (!period) return []
    return dealRows
      .filter(r => !scope || (r.broker || '').toLowerCase() === scope)
      .filter(r => inPeriod(metric === 'lodged' ? r.lodgedDate : r.settledDate, period))
      .map(r => ({
        ...r,
        date: metric === 'lodged' ? r.lodgedDate : r.settledDate,
        amount: metric === 'lodged' ? r.lodgedAmount : r.settledAmount,
        lender: metric === 'lodged' ? r.lodgedLender : r.settledLender,
        splits: metric === 'lodged' ? r.lodgedSplits : r.settledSplits,
        variance: (metric === 'settled' && r.settledAmount !== null && r.lodgedAmount !== null)
          ? r.settledAmount - r.lodgedAmount : null,
      }))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [dealRows, period, metric, scope])

  const byBroker = useMemo(() => {
    const m: Record<string, { count: number; amount: number }> = {}
    for (const r of rows) {
      if (!m[r.broker]) m[r.broker] = { count: 0, amount: 0 }
      m[r.broker].count += 1
      m[r.broker].amount += r.amount || 0
    }
    return Object.entries(m).sort((a, b) => b[1].amount - a[1].amount)
  }, [rows])

  function exportCsv() {
    if (!period || rows.length === 0) return
    const head = ['Deal', 'Broker', 'Lender', metric === 'settled' ? 'Settled' : 'Lodged', 'Amount', 'Splits', 'Status']
    const body = rows.map(r => [r.name, r.broker, r.lender, dmy(r.date), r.amount ?? '', r.splits, r.status])
    const esc = (c: any) => `"${String(c ?? '').replace(/"/g, '""')}"`
    const csv = [head, ...body].map(l => l.map(esc).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${metric}-${period.key}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  /* ---------- picker ---------- */
  const [pickYear, setPickYear] = useState(() => Number(todayYmd().slice(0, 4)))
  function choose(key: string) {
    if (periods.some(p => p.key === key)) { setPeriodKey(key); setPickOpen(false) }
  }
  function quick(k: PeriodKind, offset = 0) {
    const list = listPeriods(k, COUNT[k])
    setKind(k); setPeriodKey(list[offset]?.key || ''); setPickOpen(false)
  }

  const sandBtn = 'bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-lg px-3.5 py-2 text-[12.5px] font-medium hover:bg-[#F4EEE4] hover:text-[#2E2A26] transition inline-flex items-center gap-1.5 disabled:opacity-40'
  const kinds: { k: PeriodKind; label: string }[] = [
    { k: 'week', label: 'Week' }, { k: 'month', label: 'Month' },
    { k: 'quarter', label: 'Quarter' }, { k: 'fy', label: 'Financial year' },
  ]

  // Every hook above has already run, so switching the whole view here is safe.
  if (view === 'actuals') return <MonthlyActuals />

  return (
    <div className="max-w-6xl mx-auto p-6">
      <p className="text-lg font-medium text-[#343333] mb-4">Pipeline</p>

      {/* toolbar */}
      <div className="bg-[#FAF7F2] border border-[#E8E1D6] rounded-xl p-3 flex items-center gap-3 flex-wrap mb-4">
        <div className="flex gap-1 bg-[#F1EDE6] rounded-lg p-[3px]">
          {(['lodged', 'settled'] as const).map(v => (
            <button key={v} onClick={() => setMetric(v)}
              className={`px-4 py-1.5 text-[13px] rounded-md font-medium transition ${metric === v ? 'bg-white text-[#2E2A26] shadow-sm' : 'text-[#6E665C]'}`}>
              {v === 'lodged' ? 'Lodgements' : 'Settlements'}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-[#E8E1D6]" />

        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setScope('')}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium border transition-colors ${scope === '' ? 'bg-[#343333] border-[#343333] text-white font-semibold' : 'border-[#E8E1D6] bg-white text-[#6E665C] hover:bg-[#FAF7F2] hover:text-[#2E2A26]'}`}>
            Business
          </button>
          {brokers.map(b => (
            <button key={b.key} onClick={() => setScope(b.key)}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium border transition-colors ${scope === b.key ? 'bg-[#343333] border-[#343333] text-white font-semibold' : 'border-[#E8E1D6] bg-white text-[#6E665C] hover:bg-[#FAF7F2] hover:text-[#2E2A26]'}`}>
              {b.name}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-[#E8E1D6]" />

        <div className="flex gap-3.5">
          {kinds.map(({ k, label }) => (
            <button key={k} onClick={() => { setKind(k); setPeriodKey('') }}
              className={`text-[12.5px] font-medium pb-1 border-b-2 transition ${kind === k ? 'text-[#2E2A26] border-[#343333]' : 'text-[#A29889] border-transparent hover:text-[#6E665C]'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-[#E8E1D6]" />

        <div className="relative" ref={pickRef}>
          <button onClick={() => setPickOpen(o => !o)}
            className="bg-white border border-[#E8E1D6] rounded-lg px-3 py-1.5 flex items-center gap-2.5 hover:border-[#C9C0B1] transition text-left">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#A29889" strokeWidth="1.5" strokeLinecap="round"><rect x="2.2" y="3.2" width="11.6" height="10.6" rx="2"/><path d="M2.2 6.4h11.6M5.4 2v2.4M10.6 2v2.4"/></svg>
            <span>
              <span className="block text-[13px] font-semibold text-[#2E2A26] leading-tight">{period?.label}</span>
              <span className="block text-[10.5px] text-[#A29889]">{period?.range}</span>
            </span>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="#A29889" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={pickOpen ? 'M12 10L8 6l-4 4' : 'M4 6l4 4 4-4'}/></svg>
          </button>

          {pickOpen && (
            <div className="absolute top-[calc(100%+8px)] left-0 z-20 w-[300px] bg-white border border-[#E8E1D6] rounded-xl shadow-[0_10px_30px_rgba(46,42,38,.13)] p-3">
              {kind !== 'fy' && kind !== 'week' && (
                <div className="flex items-center justify-between mb-2.5">
                  <button onClick={() => setPickYear(y => y - 1)} className="w-[26px] h-[26px] rounded-lg border border-[#E8E1D6] flex items-center justify-center text-[#6E665C] hover:bg-[#FAF7F2]">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5"/></svg>
                  </button>
                  <span className="text-[13px] font-semibold">{kind === 'quarter' ? `FY${String(pickYear).slice(2)}` : pickYear}</span>
                  <button onClick={() => setPickYear(y => y + 1)} className="w-[26px] h-[26px] rounded-lg border border-[#E8E1D6] flex items-center justify-center text-[#6E665C] hover:bg-[#FAF7F2]">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5"/></svg>
                  </button>
                </div>
              )}

              <div className={`grid gap-1.5 ${kind === 'week' ? 'grid-cols-2' : 'grid-cols-4'}`}>
                {kind === 'month' && MONTHS.map((mn, i) => {
                  const key = `m-${pickYear}-${i + 1}`
                  const exists = periods.some(p => p.key === key)
                  return (
                    <button key={mn} disabled={!exists} onClick={() => choose(key)}
                      className={`py-2 rounded-lg text-[12.5px] font-medium transition ${period?.key === key ? 'bg-[#343333] text-white font-semibold' : exists ? 'text-[#6E665C] hover:bg-[#F4EEE4]' : 'text-[#D3CCC0] cursor-not-allowed'}`}>
                      {mn}
                    </button>
                  )
                })}
                {kind === 'quarter' && [1, 2, 3, 4].map(q => {
                  const key = `q-${pickYear}-${q}`
                  const exists = periods.some(p => p.key === key)
                  return (
                    <button key={q} disabled={!exists} onClick={() => choose(key)}
                      className={`py-2 rounded-lg text-[12.5px] font-medium transition ${period?.key === key ? 'bg-[#343333] text-white font-semibold' : exists ? 'text-[#6E665C] hover:bg-[#F4EEE4]' : 'text-[#D3CCC0] cursor-not-allowed'}`}>
                      Q{q}
                    </button>
                  )
                })}
                {kind === 'fy' && periods.map(p => (
                  <button key={p.key} onClick={() => choose(p.key)}
                    className={`py-2 rounded-lg text-[12.5px] font-medium transition ${period?.key === p.key ? 'bg-[#343333] text-white font-semibold' : 'text-[#6E665C] hover:bg-[#F4EEE4]'}`}>
                    {p.label}
                  </button>
                ))}
                {kind === 'week' && periods.slice(0, 12).map(p => (
                  <button key={p.key} onClick={() => choose(p.key)}
                    className={`py-2 px-2 rounded-lg text-[12px] font-medium transition text-left ${period?.key === p.key ? 'bg-[#343333] text-white font-semibold' : 'text-[#6E665C] hover:bg-[#F4EEE4]'}`}>
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-1.5 flex-wrap border-t border-[#EDE7DD] mt-3 pt-2.5">
                <button onClick={() => quick('month', 0)} className="bg-[#FAF7F2] border border-[#E8E1D6] rounded-full px-2.5 py-1 text-[11.5px] text-[#6E665C] hover:bg-[#F4EEE4]">This month</button>
                <button onClick={() => quick('month', 1)} className="bg-[#FAF7F2] border border-[#E8E1D6] rounded-full px-2.5 py-1 text-[11.5px] text-[#6E665C] hover:bg-[#F4EEE4]">Last month</button>
                <button onClick={() => quick('quarter', 0)} className="bg-[#FAF7F2] border border-[#E8E1D6] rounded-full px-2.5 py-1 text-[11.5px] text-[#6E665C] hover:bg-[#F4EEE4]">This quarter</button>
                <button onClick={() => quick('fy', 0)} className="bg-[#FAF7F2] border border-[#E8E1D6] rounded-full px-2.5 py-1 text-[11.5px] text-[#6E665C] hover:bg-[#F4EEE4]">This FY</button>
                <button onClick={() => quick('fy', 1)} className="bg-[#FAF7F2] border border-[#E8E1D6] rounded-full px-2.5 py-1 text-[11.5px] text-[#6E665C] hover:bg-[#F4EEE4]">Last FY</button>
              </div>
            </div>
          )}
        </div>

        <button onClick={exportCsv} disabled={rows.length === 0} className={sandBtn + ' ml-auto'}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8M4.5 7l3.5 3.5L11.5 7M3 13h10"/></svg>
          Export CSV
        </button>
      </div>

      {loadError ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          Could not load the pipeline: {loadError}. Nothing below is reliable - reload before acting on it.
        </div>
      ) : loading ? (
        <div className="text-sm text-gray-400">Loading...</div>
      ) : (
        <>
          {/* comparison */}
          {!scope && kind !== 'week' && current.amount > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-4">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
                <span className="text-[13px] font-semibold text-[#2E2A26]">
                  How {period?.label} compares
                  {inProgress && <span className="text-[#A29889] font-normal"> · still in progress{shape?.clipped ? `, compared on the first ${shape.n} month${shape.n === 1 ? '' : 's'} of each year` : ''}</span>}
                </span>
                {record?.isBest ? (
                  <span className="inline-flex items-center gap-1.5 bg-[#F3F9F4] border border-[#CFE6D5] text-[#25794C] rounded-full px-2.5 py-1 text-[11.5px] font-semibold">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 11.6 4.3 13.5l.8-4.2L2 6.4l4.2-.5z"/></svg>
                    {shape?.clipped ? 'Best start on record' : 'Best on record'}
                  </span>
                ) : record?.rank && record.rank <= 5 ? (
                  <span className="inline-flex items-center gap-1.5 bg-[#FBF4E3] border border-[#EFE0BC] text-[#9A7B2E] rounded-full px-2.5 py-1 text-[11.5px] font-semibold">
                    {record.rank === 2 ? '2nd' : record.rank === 3 ? '3rd' : record.rank + 'th'} best on record
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-4">
                <Cmp label={shape?.clipped ? 'vs same point last year' : 'vs same period last year'}
                     value={lastYear ? signed(pct(current.amount, lastYear.value)) : '-'}
                     tone={lastYear ? (current.amount >= lastYear.value ? 'up' : 'down') : 'flat'}
                     base={lastYear ? `${lastYear.p.label}${shape?.clipped ? ' at this point' : ''} · ${compact(lastYear.value)} \u2192 ${compact(current.amount)}` : 'no comparable period held'} />
                <Cmp label="vs target"
                     value={target ? Math.round(current.amount / target * 100) + '%' : 'not set'}
                     tone={target ? (current.amount >= target ? 'up' : 'down') : 'flat'}
                     base={target ? `${compact(Math.abs(current.amount - target))} ${current.amount >= target ? 'ahead of' : 'short of'} ${compact(target)}` : 'no target loaded for this period'}
                     meter={target ? Math.min(100, current.amount / target * 100) : null}
                     meterFull={!!target && current.amount >= target} />
                <Cmp label={shape?.clipped ? 'vs 3-year average at this point' : 'vs 3-year average'}
                     value={threeYear ? signed(pct(current.amount, threeYear.avg)) : '-'}
                     tone={threeYear ? (current.amount >= threeYear.avg ? 'up' : 'down') : 'flat'}
                     base={threeYear ? `${compact(threeYear.avg)} · average of ${threeYear.n} prior year${threeYear.n === 1 ? '' : 's'}${shape?.clipped ? ' at this point' : ''}` : 'not enough history yet'} />
                <Cmp label={record?.isBest ? 'Previous best' : shape?.clipped ? 'Best start on record' : 'Best on record'}
                     value={record ? compact(record.isBest ? (record.second?.value ?? null) : record.best.value) : '-'}
                     tone="flat"
                     base={record
                       ? (record.isBest
                          ? (record.second ? `${record.second.p.label} · beaten by ${compact(current.amount - record.second.value)}` : 'first period on record')
                          : `${record.best.p.label} · ${compact(record.best.value - current.amount)} ahead of ${period?.label}`)
                       : ''} />
              </div>
            </div>
          )}

          {/* tiles */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <Tile label={metric === 'settled' ? 'Deals settled' : 'Deals lodged'} value={String(current.deals || 0)} />
            <Tile label={metric === 'settled' ? 'Settled volume' : 'Lodged volume'} value={compact(current.amount || null)} />
            <Tile label="Average size" value={current.deals ? compact(current.amount / current.deals) : '-'} />
            {scope ? (
              <Tile label="Against target"
                    value={target ? Math.round(current.amount / target * 100) + '%' : 'not set'}
                    sub={target ? `${compact(Math.abs(current.amount - target))} ${current.amount >= target ? 'ahead of' : 'short of'} ${compact(target)}` : 'no target set for this period'}
                    subTone={target ? (current.amount >= target ? 'up' : 'down') : undefined} />
            ) : (
              <Tile label="Financial year to date" value={compact(fytd?.now || null)}
                    sub={fytd && fytd.then > 0 ? `${signed(pct(fytd.now, fytd.then))} on the same point last year` : undefined}
                    subTone={fytd && fytd.then > 0 ? (fytd.now >= fytd.then ? 'up' : 'down') : undefined} />
            )}
          </div>

          {contextChart && <ContextChart bars={contextChart} metric={metric} kind={kind} />}
          {!scope && fyChart && <FyProgressChart {...fyChart} metric={metric} />}

          {scope && (
            <div className="bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-xl px-4 py-2.5 text-[12.5px] mb-4">
              {brokers.find(b => b.key === scope)?.name || scope} is measured against target and against the
              business. There is no year-on-year here - the ten years of history is a business total, not a split by broker.
            </div>
          )}

          {!scope && current.sources.has('spreadsheet') && (
            <div className="bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-xl px-4 py-2.5 text-[12.5px] mb-4">
              These figures come from the business spreadsheet, not from deals recorded in the portal.
              Deal-by-deal detail below starts once the team marks lodgements and settlements here.
            </div>
          )}

          {byBroker.length > 1 && (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-4">
              <div className="grid grid-cols-[2fr_1fr_1fr] px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <span>Broker</span><span>Deals</span><span>Volume</span>
              </div>
              {byBroker.map(([broker, v]) => (
                <div key={broker} className="grid grid-cols-[2fr_1fr_1fr] px-4 py-2.5 text-sm border-b border-gray-50 last:border-0">
                  <span className="text-[#343333]">{broker}</span>
                  <span className="text-gray-600">{v.count}</span>
                  <span className="font-medium text-[#343333]">{fmt(v.amount)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[2.2fr_1fr_1.2fr_.8fr_1fr_.6fr_1.1fr] px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
              <span>Deal</span><span>Broker</span><span>Lender</span>
              <span>{metric === 'settled' ? 'Settled' : 'Lodged'}</span><span>Amount</span><span>Splits</span><span>Status</span>
            </div>
            {rows.length === 0 ? (
              <div className="px-4 py-8 text-sm text-gray-400 text-center">
                {current.amount > 0
                  ? `No deal-level detail for ${period?.label} - the total above came from the spreadsheet.`
                  : `No deals ${metric === 'settled' ? 'settled' : 'lodged'} in ${period?.label}.`}
              </div>
            ) : rows.map(r => (
              <Link key={r.id} href={`/deals/${r.id}`}
                className="grid grid-cols-[2.2fr_1fr_1.2fr_.8fr_1fr_.6fr_1.1fr] px-4 py-3 text-sm border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                <span className="text-[#343333] truncate pr-3">{r.name}</span>
                <span className="text-gray-600 truncate pr-3">{r.broker}</span>
                <span className="text-gray-600 truncate pr-3">{r.lender}</span>
                <span className="text-gray-600">{dmy(r.date)}</span>
                <span className={`font-medium ${r.amount === null ? 'text-amber-600' : 'text-[#343333]'}`}>
                  {r.amount === null ? 'not recorded' : fmt(r.amount)}
                </span>
                <span className="text-gray-500">{r.splits || '-'}</span>
                <span className="text-gray-600">{r.status}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Tile({ label, value, sub, subTone }: { label: string; value: string; sub?: string; subTone?: 'up' | 'down' }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="text-[10px] font-semibold tracking-[.09em] uppercase text-[#A29889] mb-1.5">{label}</div>
      <div className="text-2xl font-semibold text-[#343333] tracking-tight">{value}</div>
      {sub && <div className={`text-[11.5px] mt-0.5 ${subTone === 'up' ? 'text-[#2E9E63]' : subTone === 'down' ? 'text-[#C4553B]' : 'text-[#A29889]'}`}>{sub}</div>}
    </div>
  )
}

function Cmp({ label, value, base, tone, meter, meterFull }:
  { label: string; value: string; base: string; tone: 'up' | 'down' | 'flat'; meter?: number | null; meterFull?: boolean }) {
  return (
    <div className="px-4 py-3.5 border-r border-gray-100 last:border-r-0">
      <div className="text-[10px] font-semibold tracking-[.085em] uppercase text-[#A29889]">{label}</div>
      <div className={`text-[19px] font-semibold tracking-tight mt-1.5 ${tone === 'up' ? 'text-[#2E9E63]' : tone === 'down' ? 'text-[#C4553B]' : 'text-[#2E2A26]'}`}>{value}</div>
      <div className="text-[11.5px] text-[#A29889] mt-0.5">{base}</div>
      {meter !== null && meter !== undefined && (
        <div className="h-[5px] bg-[#F4EEE4] rounded-full mt-2 overflow-hidden">
          <div className={`h-full rounded-full ${meterFull ? 'bg-[#2E9E63]' : 'bg-[#8C8375]'}`} style={{ width: meter + '%' }} />
        </div>
      )}
    </div>
  )
}
