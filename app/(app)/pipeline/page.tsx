'use client'
import { brokerLabel } from '@/lib/broker-key'
import { PAGE_WIDE } from '@/lib/page-width'
import { compactMoney } from '@/lib/money'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { listPeriods, inPeriod, toAuDate, todayYmd, fyEndYear, customPeriod, backOneYearYmd, monthEndYmd,
         type Period, type PeriodKind } from '@/lib/periods'
import { ContextChart, FyProgressChart, BrokerYearChart } from '@/components/PipelineCharts'
import MonthlyActuals from '@/components/MonthlyActuals'
import PipelineSnapshot from '@/components/PipelineSnapshot'
import { useBusyWhile } from '@/components/useBusy'
import { SkelPanel } from '@/components/Skeleton'

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
// One copy, in lib/money.ts.
const compact = compactMoney
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
  const [fromM, setFromM] = useState('')     // 'YYYY-MM'
  const [toM, setToM] = useState('')
  const [reg, setReg] = useState<any[]>([])
  const [scope, setScope] = useState('')            // '' is the whole business
  const [brokers, setBrokers] = useState<{ key: string; name: string }[]>([])
  const [hist, setHist] = useState<any[]>([])
  const [bhist, setBhist] = useState<any[]>([])
  const [targets, setTargets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  // THREE PANES, AND THE FIRST IS THE ONE PEOPLE OPEN THIS PAGE FOR.
  //
  // "report" was the whole thing on one page: a fixed snapshot of this year and
  // this month, then a toolbar, then a period report that answered the toolbar
  // while the snapshot above it did not. Two questions on one page and only one
  // of them listening to the controls.
  //
  // Now is the snapshot on its own - always today, no controls, so nothing can
  // be out of step with anything. Explore is the period report. The old #report
  // still works and lands on Explore, because that is the half it was.
  const [view, setView] = useState('now')
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1)
      setView(h === 'actuals' ? 'actuals' : (h === 'explore' || h === 'report') ? 'explore' : 'now')
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])
  const [pickOpen, setPickOpen] = useState(false)
  const pickRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [r, h, t, b, bh] = await Promise.all([
        supabase.rpc('pipeline_register'),
        supabase.from('pipeline_history').select('month, deals_lodged, lodged_amount, deals_settled, settled_amount'),
        supabase.from('pipeline_targets').select('metric, month, amount, broker_key'),
        supabase.from('brokers').select('broker_key, name, active').order('name'),
        supabase.from('pipeline_broker_history').select('broker_key, month, deals_lodged, lodged_amount, deals_settled, settled_amount'),
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
      setBhist(bh.error ? [] : (bh.data || []))  // so are a broker's typed actuals
      const seen = new Set<string>()
      const bs: { key: string; name: string }[] = []
      for (const r2 of (b.data || [])) {
        if (r2.active === false) continue
        const key = String(r2.broker_key || '').toLowerCase()
        if (!key || seen.has(key)) continue
        seen.add(key)
        bs.push({ key, name: r2.name || key })
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
      // The furthest thing that has happened, same rule as the board. Read in
      // this order so the three stages added on 2 Sep 2026 cannot be swallowed by
      // a deal that also has an earlier one recorded.
      status: d.settled_at ? 'Settled'
            : d.settlement_booked_at ? 'Settlement booked'
            : d.contracts_returned_at ? 'Contracts returned'
            : d.formal_approval_at ? 'Formal approval'
            : d.offer_accepted_at ? 'Offer accepted'
            : d.preapproval_at ? 'Preapproved'
            : d.lodged_at ? 'Lodged' : '-',
    }
  }), [reg])

  /* ---------- one monthly actual per month, spreadsheet first ---------- */
  // The spreadsheet is authoritative for any month it holds, because the team is
  // not yet marking deals through the portal. As soon as a month has no history
  // row, the portal's own deals become the figure - and the page says which.
  const businessMonthly = useMemo(() => {
    const m: Record<string, { amount: number; deals: number; source: 'spreadsheet' | 'portal' }> = {}
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
  }, [hist, dealRows, metric])

  // A broker's typed figure wins over deals counted in the portal for that month,
  // exactly as the business spreadsheet does for the business.
  const brokerMonthly = useMemo(() => {
    const m: Record<string, { amount: number; deals: number; source: 'spreadsheet' | 'portal' | 'override' }> = {}
    if (!scope) return m
    for (const row of bhist) {
      if (String(row.broker_key || '').toLowerCase() !== scope) continue
      const key = String(row.month).slice(0, 7)
      const amount = num(metric === 'lodged' ? row.lodged_amount : row.settled_amount)
      const deals = num(metric === 'lodged' ? row.deals_lodged : row.deals_settled)
      if (amount !== null) m[key] = { amount, deals: deals || 0, source: 'override' }
    }
    for (const r of dealRows) {
      if ((r.broker || '').toLowerCase() !== scope) continue
      const date = metric === 'lodged' ? r.lodgedDate : r.settledDate
      if (!date) continue
      const key = date.slice(0, 7)
      if (m[key]?.source === 'override') continue
      if (!m[key]) m[key] = { amount: 0, deals: 0, source: 'portal' }
      m[key].amount += (metric === 'lodged' ? r.lodgedAmount : r.settledAmount) || 0
      m[key].deals += 1
    }
    return m
  }, [dealRows, metric, scope, bhist])

  const monthly = scope ? brokerMonthly : businessMonthly

  const targetByMonth = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of targets) if (t.metric === metric && (t.broker_key || '') === scope) {
      const a = num(t.amount)
      if (a !== null) m[String(t.month).slice(0, 7)] = a
    }
    return m
  }, [targets, metric, scope])

  /* ---------- periods ---------- */
  const COUNT: Record<PeriodKind, number> = { week: 26, month: 144, quarter: 48, fy: 12, custom: 1 }
  const periods = useMemo(() => {
    if (kind === 'custom') {
      return (fromM && toM && fromM <= toM) ? [customPeriod(fromM + '-01', monthEndYmd(toM))] : []
    }
    return listPeriods(kind, COUNT[kind])
  }, [kind, fromM, toM])
  const period: Period | undefined = useMemo(
    () => periods.find(p => p.key === periodKey) || periods[0], [periods, periodKey])

  // Value of any period = the months inside it. Weeks are smaller than the data
  // we hold, so weekly views carry no history and no comparisons.
  function periodValueOf(m: Record<string, { amount: number; deals: number; source: string }>, p: Period):
    { amount: number; deals: number; sources: Set<string>; months: number } {
    let amount = 0, deals = 0, months = 0
    const sources = new Set<string>()
    for (const [key, v] of Object.entries(m)) {
      if (key + '-01' >= p.start && key + '-01' <= p.end) {
        amount += v.amount; deals += v.deals; months += 1; sources.add(v.source)
      }
    }
    return { amount, deals, sources, months }
  }
  function periodValue(p: Period) { return periodValueOf(monthly, p) }
  function periodTarget(p: Period): number | null {
    let t = 0, seen = false
    for (const [key, v] of Object.entries(targetByMonth)) {
      if (key + '-01' >= p.start && key + '-01' <= p.end) { t += v; seen = true }
    }
    return seen ? t : null
  }

  const idx = useMemo(() => periods.findIndex(p => p.key === period?.key), [periods, period])
  const backOneYear = kind === 'month' ? 12 : kind === 'quarter' ? 4 : kind === 'fy' ? 1 : 0   // week and custom have none

  const custom = kind === 'custom'
  const current = period ? periodValue(period) : { amount: 0, deals: 0, sources: new Set<string>(), months: 0 }
  const target = period ? periodTarget(period) : null

  // The same months a year earlier. Whole months either way, so it is like for like.
  const customPrior = useMemo(() => {
    if (!custom || !period) return null
    const prior = { ...period, start: backOneYearYmd(period.start), end: backOneYearYmd(period.end) }
    const v = periodValue(prior as Period)
    return v.amount > 0 ? v : null
  }, [custom, period, monthly])
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
  // Only the months actually recorded. A month nobody has entered is left out
  // rather than counted as a zero - otherwise a year reads as a collapse until
  // someone types the figure in, and last year gets compared on more months
  // than this year has.
  const fytd = useMemo(() => {
    if (!period) return null
    const fy = fyEndYear(period.end)
    const start = `${fy - 1}-07-01`
    const keys = Object.keys(monthly).filter(k => k + '-01' >= start && k + '-01' <= period.end).sort()
    let now = 0, then = 0, comparable = 0
    for (const k of keys) {
      now += monthly[k].amount
      const prior = `${Number(k.slice(0, 4)) - 1}-${k.slice(5)}`
      if (monthly[prior]) { then += monthly[prior].amount; comparable += 1 }
    }
    return { now, then, keys, comparable }
  }, [monthly, period])

  // Target to the same point in the year. A month still running counts only the
  // share of itself that has happened, so "behind" never just means "this month
  // has not finished yet".
  const fytdTarget = useMemo(() => {
    if (!fytd) return null
    const today = todayYmd()
    let t = 0, seen = false
    for (const k of fytd.keys) {
      const v = targetByMonth[k]
      if (!v) continue
      const y = Number(k.slice(0, 4)), mo = Number(k.slice(5, 7))
      const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate()
      const last = `${k}-${String(dim).padStart(2, '0')}`
      t += v * (last > today ? Number(today.slice(8, 10)) / dim : 1)
      seen = true
    }
    return seen ? t : null
  }, [targetByMonth, fytd])

  const pace = useMemo(() => {
    if (!fytd || fytdTarget === null || fytdTarget <= 0) return null
    const diff = fytd.now - fytdTarget
    return { diff, ahead: diff >= 0, target: fytdTarget }
  }, [fytd, fytdTarget])

  // A broker's share only means something while the business figure is the portal's
  // own. Against a spreadsheet total, which has no broker split, it would read as
  // near zero and be wrong.
  const share = useMemo(() => {
    if (!scope || !period) return null
    const biz = periodValueOf(businessMonthly, period)
    if (!biz.amount) return null
    if (biz.sources.has('spreadsheet')) return { pct: null as number | null, biz: biz.amount }
    return { pct: current.amount / biz.amount * 100 as number | null, biz: biz.amount }
  }, [scope, period, businessMonthly, current.amount])

  /* ---------- chart data ---------- */
  const FY_MONTHS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]

  // The selected period against the ones before it, with the same-period average of
  // the three prior years drawn behind them. Raw totals here, not the clipped
  // baselines - a chart of whole periods is honest as long as the running one is marked.
  const contextChart = useMemo(() => {
    if (kind === 'week' || kind === 'custom' || !period || idx < 0) return null
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

  // Twelve months of the selected financial year for whoever is scoped. Targets
  // alone are enough to draw it, so a broker with nothing recorded still gets a
  // year rather than an empty panel.
  const brokerYear = useMemo(() => {
    if (!scope || !period) return null
    const fy = fyEndYear(period.end)
    const todayKey = todayYmd().slice(0, 7)
    return FY_MONTHS.map(mi => {
      const y = mi >= 7 ? fy - 1 : fy
      const key = `${y}-${String(mi).padStart(2, '0')}`
      return {
        label: MONTHS[mi - 1],
        actual: monthly[key] ? monthly[key].amount : null,
        target: targetByMonth[key] ?? null,
        future: key > todayKey,
      }
    })
  }, [scope, period, monthly, targetByMonth])

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

  // THE TOTAL OF THE LIST, WHICH IS NOT ALWAYS THE FIGURE ABOVE IT.
  //
  // This is the thing Fabio could not place. Any month the business spreadsheet
  // holds, the spreadsheet wins - deliberate, because the team is not marking
  // every deal through the portal yet. But the list underneath has always been
  // portal deals. So the headline reads $6.9m, the rows under it add to $3.1m,
  // both are correct, and nothing on screen said why. Now the list carries its
  // own total and says so in words when the two cannot match.
  const rowsTotal = useMemo(() => rows.reduce((t, r) => t + (r.amount || 0), 0), [rows])

  // The same period a year earlier, whichever kind of period is selected. The
  // custom case had its own card and its own wording for the identical idea.
  const yearAgo = custom ? (customPrior?.amount ?? null) : (lastYear?.value ?? null)

  // WHAT A DEAL IS AT TODAY, WEARING THE BOARD'S OWN COLOURS.
  // The column used to be a bare word called Status, which read as wrong: a
  // list of September lodgements showing "Settled" looks like a mistake until
  // you work out it is the stage the deal is at NOW, two months later.
  const STAGE_TONE: Record<string, string> = {
    'Settled': 'bg-done-bg border-done-edge text-done',
    'Settlement booked': 'bg-info-bg border-info-edge text-info',
    'Contracts returned': 'bg-info-bg border-info-edge text-info',
    'Formal approval': 'bg-info-bg border-info-edge text-info',
    'Offer accepted': 'bg-info-bg border-info-edge text-info',
    'Preapproved': 'bg-waiting-bg border-waiting-edge text-waiting',
    'Lodged': 'bg-waiting-bg border-waiting-edge text-waiting',
  }

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

  useBusyWhile(loading)
  const sandBtn = 'bg-page border border-line text-muted rounded-lg px-3.5 py-2 text-[12.5px] font-medium hover:bg-line-soft hover:text-ink transition inline-flex items-center gap-1.5 disabled:opacity-40'
  const kinds: { k: PeriodKind; label: string }[] = [
    { k: 'week', label: 'Week' }, { k: 'month', label: 'Month' },
    { k: 'quarter', label: 'Quarter' }, { k: 'fy', label: 'Financial year' },
    { k: 'custom', label: 'Custom' },
  ]
  function pickKind(k: PeriodKind) {
    setKind(k)
    setPeriodKey('')
    if (k === 'custom' && (!fromM || !toM)) {
      const t = todayYmd().slice(0, 7)
      setFromM(t); setToM(t)
      setPickOpen(true)
    }
  }
  function setSpan(f: string, t: string) { setKind('custom'); setFromM(f); setToM(t); setPickOpen(false) }
  // n whole months back from this one, inclusive of it
  function monthsBack(n: number): string {
    const t = todayYmd()
    let y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7)) - n
    while (m < 1) { m += 12; y -= 1 }
    return `${y}-${String(m).padStart(2, '0')}`
  }
  const dateInput = 'text-[12.5px] border border-line rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:border-brand'

  // Every hook above has already run, so switching the whole view here is safe.
  if (view === 'actuals') return <MonthlyActuals />

  if (view === 'now') return (
    <div className={PAGE_WIDE}>
      <p className="text-lg font-medium text-ink">Now</p>
      <p className="text-[12.5px] text-muted mb-4">
        Where the business is against target, this month and this year. Nothing here is adjustable &mdash; it is always today.
      </p>
      {loadError ? (
        <div className="bg-chase-bg border border-chase-edge text-chase rounded-xl px-4 py-3 text-sm">
          Could not load the pipeline: {loadError}. Nothing here is reliable - reload before acting on it.
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
          <SkelPanel lines={3} head={false} /><SkelPanel lines={3} head={false} />
        </div>
      ) : (
        <PipelineSnapshot hist={hist} dealRows={dealRows} targets={targets} brokers={brokers} brokerHist={bhist}
                          onPickBroker={key => { setScope(key); window.location.hash = 'explore' }} />
      )}
    </div>
  )

  return (
    <div className={PAGE_WIDE}>
      <p className="text-lg font-medium text-ink">Explore</p>
      <p className="text-[12.5px] text-muted mb-4">
        Pick a period and a scope. Everything on this page answers that one question.
      </p>

      {/* toolbar */}
      <div className="bg-page border border-line rounded-xl p-3 flex items-center gap-3 flex-wrap mb-4">
        <div className="flex gap-1 bg-line-soft rounded-lg p-[3px]">
          {(['lodged', 'settled'] as const).map(v => (
            <button key={v} onClick={() => setMetric(v)}
              className={`px-4 py-1.5 text-[13px] rounded-md font-medium transition ${metric === v ? 'bg-card text-ink shadow-sm' : 'text-muted'}`}>
              {v === 'lodged' ? 'Lodgements' : 'Settlements'}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-line" />

        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setScope('')}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium border transition-colors ${scope === '' ? 'bg-ink border-ink text-page font-semibold' : 'border-line bg-card text-muted hover:bg-page hover:text-ink'}`}>
            Business
          </button>
          {brokers.map(b => (
            <button key={b.key} onClick={() => setScope(b.key)}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium border transition-colors ${scope === b.key ? 'bg-ink border-ink text-page font-semibold' : 'border-line bg-card text-muted hover:bg-page hover:text-ink'}`}>
              {b.name}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-line" />

        <div className="flex gap-3.5">
          {kinds.map(({ k, label }) => (
            <button key={k} onClick={() => pickKind(k)}
              className={`text-[12.5px] font-medium pb-1 border-b-2 transition ${kind === k ? 'text-ink border-ink' : 'text-faint border-transparent hover:text-muted'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-line" />

        <div className="relative" ref={pickRef}>
          <button onClick={() => setPickOpen(o => !o)}
            className="bg-card border border-line rounded-lg px-3 py-1.5 flex items-center gap-2.5 hover:border-gray-300 transition text-left">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--color-faint)" strokeWidth="1.5" strokeLinecap="round"><rect x="2.2" y="3.2" width="11.6" height="10.6" rx="2"/><path d="M2.2 6.4h11.6M5.4 2v2.4M10.6 2v2.4"/></svg>
            <span>
              <span className="block text-[13px] font-semibold text-ink leading-tight">{period?.label || 'Pick two dates'}</span>
              <span className="block text-[10.5px] text-faint">{period?.range || 'from and to'}</span>
            </span>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="var(--color-faint)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={pickOpen ? 'M12 10L8 6l-4 4' : 'M4 6l4 4 4-4'}/></svg>
          </button>

          {pickOpen && (
            <div className="absolute top-[calc(100%+8px)] left-0 z-20 w-[300px] bg-card border border-line rounded-xl shadow-[0_10px_30px_rgba(46,42,38,.13)] p-3">
              {kind === 'custom' && (
                <div className="grid gap-2 mb-1">
                  <label className="block">
                    <span className="block text-[10px] font-semibold uppercase tracking-[.08em] text-faint mb-1">From month</span>
                    <input type="month" value={fromM} max={toM || undefined}
                      onChange={e => setFromM(e.target.value)} className={dateInput} />
                  </label>
                  <label className="block">
                    <span className="block text-[10px] font-semibold uppercase tracking-[.08em] text-faint mb-1">To month</span>
                    <input type="month" value={toM} min={fromM || undefined}
                      onChange={e => setToM(e.target.value)} className={dateInput} />
                  </label>
                  <span className="text-[11px] text-faint">
                    Whole months only. Every figure held before the portal went live is a monthly total, so a
                    half month cannot be reported honestly.
                  </span>
                  {fromM && toM && fromM > toM && (
                    <span className="text-[11.5px] text-chase">The first month is after the last.</span>
                  )}
                </div>
              )}

              {kind !== 'fy' && kind !== 'week' && kind !== 'custom' && (
                <div className="flex items-center justify-between mb-2.5">
                  <button onClick={() => setPickYear(y => y - 1)} className="w-[26px] h-[26px] rounded-lg border border-line flex items-center justify-center text-muted hover:bg-page">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5"/></svg>
                  </button>
                  <span className="text-[13px] font-semibold">{kind === 'quarter' ? `FY${String(pickYear).slice(2)}` : pickYear}</span>
                  <button onClick={() => setPickYear(y => y + 1)} className="w-[26px] h-[26px] rounded-lg border border-line flex items-center justify-center text-muted hover:bg-page">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5"/></svg>
                  </button>
                </div>
              )}

              <div className={`grid gap-1.5 ${kind === 'custom' ? 'hidden' : kind === 'week' ? 'grid-cols-2' : 'grid-cols-4'}`}>
                {kind === 'month' && MONTHS.map((mn, i) => {
                  const key = `m-${pickYear}-${i + 1}`
                  const exists = periods.some(p => p.key === key)
                  return (
                    <button key={mn} disabled={!exists} onClick={() => choose(key)}
                      className={`py-2 rounded-lg text-[12.5px] font-medium transition ${period?.key === key ? 'bg-ink text-page font-semibold' : exists ? 'text-muted hover:bg-line-soft' : 'text-gray-300 cursor-not-allowed'}`}>
                      {mn}
                    </button>
                  )
                })}
                {kind === 'quarter' && [1, 2, 3, 4].map(q => {
                  const key = `q-${pickYear}-${q}`
                  const exists = periods.some(p => p.key === key)
                  return (
                    <button key={q} disabled={!exists} onClick={() => choose(key)}
                      className={`py-2 rounded-lg text-[12.5px] font-medium transition ${period?.key === key ? 'bg-ink text-page font-semibold' : exists ? 'text-muted hover:bg-line-soft' : 'text-gray-300 cursor-not-allowed'}`}>
                      Q{q}
                    </button>
                  )
                })}
                {kind === 'fy' && periods.map(p => (
                  <button key={p.key} onClick={() => choose(p.key)}
                    className={`py-2 rounded-lg text-[12.5px] font-medium transition ${period?.key === p.key ? 'bg-ink text-page font-semibold' : 'text-muted hover:bg-line-soft'}`}>
                    {p.label}
                  </button>
                ))}
                {kind === 'week' && periods.slice(0, 12).map(p => (
                  <button key={p.key} onClick={() => choose(p.key)}
                    className={`py-2 px-2 rounded-lg text-[12px] font-medium transition text-left ${period?.key === p.key ? 'bg-ink text-page font-semibold' : 'text-muted hover:bg-line-soft'}`}>
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-1.5 flex-wrap border-t border-card-line mt-3 pt-2.5">
                <button onClick={() => quick('month', 0)} className="bg-page border border-line rounded-full px-2.5 py-1 text-[11.5px] text-muted hover:bg-line-soft">This month</button>
                <button onClick={() => quick('month', 1)} className="bg-page border border-line rounded-full px-2.5 py-1 text-[11.5px] text-muted hover:bg-line-soft">Last month</button>
                <button onClick={() => quick('quarter', 0)} className="bg-page border border-line rounded-full px-2.5 py-1 text-[11.5px] text-muted hover:bg-line-soft">This quarter</button>
                <button onClick={() => quick('fy', 0)} className="bg-page border border-line rounded-full px-2.5 py-1 text-[11.5px] text-muted hover:bg-line-soft">This FY</button>
                <button onClick={() => quick('fy', 1)} className="bg-page border border-line rounded-full px-2.5 py-1 text-[11.5px] text-muted hover:bg-line-soft">Last FY</button>
                <button onClick={() => setSpan(monthsBack(2), todayYmd().slice(0, 7))}
                  className="bg-page border border-line rounded-full px-2.5 py-1 text-[11.5px] text-muted hover:bg-line-soft">Last 3 months</button>
                <button onClick={() => setSpan(monthsBack(5), todayYmd().slice(0, 7))}
                  className="bg-page border border-line rounded-full px-2.5 py-1 text-[11.5px] text-muted hover:bg-line-soft">Last 6 months</button>
                <button onClick={() => setSpan(monthsBack(11), todayYmd().slice(0, 7))}
                  className="bg-page border border-line rounded-full px-2.5 py-1 text-[11.5px] text-muted hover:bg-line-soft">Last 12 months</button>
                <button onClick={() => { const t = todayYmd(); setSpan(`${fyEndYear(t) - 1}-07`, t.slice(0, 7)) }}
                  className="bg-page border border-line rounded-full px-2.5 py-1 text-[11.5px] text-muted hover:bg-line-soft">FY to date</button>
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
        <div className="space-y-3">
          <SkelPanel lines={4} head={false} />
          <SkelPanel lines={5} head={false} />
        </div>
      ) : (
        <>
          {/* ONE HEADLINE AND ONE STRIP OF FOUR, WHATEVER IS SELECTED.
              *
              * There used to be three different cards here - four columns for
              * the business, three for a broker, three more for custom dates -
              * and four tiles underneath repeating two of the figures again.
              * Which card you got depended on what you had pressed, so the page
              * was a different shape every time you touched it and you never
              * learned where anything lived.
              *
              * Now it is the same card in the same place with the same four
              * cells. What changes is what a cell holds, and a cell with
              * nothing to show says why rather than vanishing. */}
          <div className="bg-card border border-card-line rounded-xl overflow-hidden mb-4">
            <div className="px-4 py-3.5 flex items-baseline gap-5 flex-wrap">
              <span>
                <span className="text-[10px] font-bold tracking-[.085em] uppercase text-faint">
                  {metric === 'settled' ? 'Settled' : 'Lodged'} in {period?.label}
                  {' \u00b7 '}{scope ? (brokers.find(b => b.key === scope)?.name || scope) : 'whole business'}
                </span>
                <span className="block text-[31px] font-semibold tracking-[-.025em] text-ink leading-[1.1] mt-1">
                  {compact(current.amount || null)}
                </span>
                {inProgress && <span className="block text-[11.5px] text-faint">still in progress</span>}
              </span>
              <span className="border-l border-line-soft pl-5">
                <span className="text-[10px] font-bold tracking-[.085em] uppercase text-faint">Deals</span>
                <span className="block text-[20px] font-semibold text-ink tracking-tight">{current.deals || 0}</span>
              </span>
              <span className="border-l border-line-soft pl-5">
                <span className="text-[10px] font-bold tracking-[.085em] uppercase text-faint">Average</span>
                <span className="block text-[20px] font-semibold text-ink tracking-tight">
                  {current.deals ? compact(current.amount / current.deals) : '\u2014'}
                </span>
              </span>
              <span className="flex-1" />
              {record?.isBest ? (
                <span className="inline-flex items-center gap-1.5 bg-done-bg border border-done-edge text-done rounded-full px-2.5 py-1 text-[11.5px] font-semibold">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 11.6 4.3 13.5l.8-4.2L2 6.4l4.2-.5z"/></svg>
                  {shape?.clipped ? 'Best start on record' : 'Best on record'}
                </span>
              ) : record?.rank && record.rank <= 5 ? (
                <span className="inline-flex items-center gap-1.5 bg-info-bg border border-info-edge text-info rounded-full px-2.5 py-1 text-[11.5px] font-semibold">
                  {record.rank === 2 ? '2nd' : record.rank === 3 ? '3rd' : record.rank + 'th'} best on record
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-4 border-t border-line-soft max-[1000px]:grid-cols-2">
              <Cmp label="vs target"
                   value={target ? Math.round(current.amount / target * 100) + '%' : 'not set'}
                   tone={target ? (current.amount >= target ? 'up' : 'down') : 'flat'}
                   base={target
                     ? `${compact(Math.abs(current.amount - target))} ${current.amount >= target ? 'ahead of' : 'short of'} ${compact(target)}`
                     : custom ? 'no whole month with a target sits inside these dates'
                     : 'no target loaded for this period'}
                   meter={target ? Math.min(100, current.amount / target * 100) : null}
                   meterFull={!!target && current.amount >= target} />

              <Cmp label={custom ? 'vs the same dates last year'
                        : shape?.clipped ? 'vs same point last year' : 'vs same period last year'}
                   value={yearAgo ? signed(pct(current.amount, yearAgo)) : '\u2014'}
                   tone={yearAgo ? (current.amount >= yearAgo ? 'up' : 'down') : 'flat'}
                   base={yearAgo
                     ? `${compact(yearAgo)} \u2192 ${compact(current.amount)}`
                     : kind === 'week' ? 'the history held is monthly, so a week has nothing to compare against'
                     : scope ? 'the years of history are a business total, not a split by broker'
                     : 'no comparable period held'} />

              {scope ? (
                <Cmp label="share of the business"
                     value={share && share.pct !== null ? share.pct.toFixed(0) + '%' : '\u2014'}
                     tone="flat"
                     base={!share ? 'no business figure for this period'
                       : share.pct === null ? 'the business figure here is the spreadsheet total, which has no broker split'
                       : `of ${compact(share.biz)} across the business`} />
              ) : (
                <Cmp label={shape?.clipped ? 'vs 3-year average at this point' : 'vs 3-year average'}
                     value={threeYear ? signed(pct(current.amount, threeYear.avg)) : '\u2014'}
                     tone={threeYear ? (current.amount >= threeYear.avg ? 'up' : 'down') : 'flat'}
                     base={threeYear
                       ? `${compact(threeYear.avg)} \u00b7 average of ${threeYear.n} prior year${threeYear.n === 1 ? '' : 's'}${shape?.clipped ? ' at this point' : ''}`
                       : custom ? 'not held for custom dates \u2014 pick a month, quarter or year'
                       : kind === 'week' ? 'the history held is monthly'
                       : 'not enough history yet'} />
              )}

              {scope ? (
                <Cmp label="financial year to date"
                     value={compact(fytd?.now || null)}
                     tone={pace ? (pace.ahead ? 'up' : 'down') : 'flat'}
                     base={pace
                       ? `${compact(Math.abs(pace.diff))} ${pace.ahead ? 'ahead of' : 'behind'} ${compact(pace.target)} to date`
                       : 'no targets set for this year'} />
              ) : (
                <Cmp label={record?.isBest ? 'Previous best' : shape?.clipped ? 'Best start on record' : 'Best on record'}
                     value={record ? compact(record.isBest ? (record.second?.value ?? null) : record.best.value) : '\u2014'}
                     tone="flat"
                     base={custom ? 'pick a month, quarter or year to see records'
                       : record
                         ? (record.isBest
                            ? (record.second ? `${record.second.p.label} \u00b7 beaten by ${compact(current.amount - record.second.value)}` : 'first period on record')
                            : `${record.best.p.label} \u00b7 ${compact(record.best.value - current.amount)} ahead of ${period?.label}`)
                         : 'no history held'} />
              )}
            </div>
          </div>

          {scope && brokerYear && brokerYear.some(m => m.target !== null || m.actual !== null) && (
            <BrokerYearChart months={brokerYear} metric={metric}
              name={brokers.find(b => b.key === scope)?.name || scope}
              fyLabel={`FY${String(fyEndYear(period?.end || todayYmd())).slice(2)}`} />
          )}

          {contextChart && <ContextChart bars={contextChart} metric={metric} kind={kind} />}
          {!scope && fyChart && <FyProgressChart {...fyChart} metric={metric} />}

          {scope && (
            <div className="bg-page border border-line text-muted rounded-xl px-4 py-2.5 text-[12.5px] mb-4">
              {brokers.find(b => b.key === scope)?.name || scope} is measured against target and against the
              business. There is no year-on-year here - the ten years of history is a business total, not a split by broker.
            </div>
          )}

          {!scope && current.sources.has('spreadsheet') && (
            <div className="bg-page border border-line text-muted rounded-xl px-4 py-2.5 text-[12.5px] mb-4">
              These figures come from the business spreadsheet, not from deals recorded in the portal.
              Deal-by-deal detail below starts once the team marks lodgements and settlements here.
            </div>
          )}

          {/* THE BROKER TABLE WENT, 7 Oct 2026.
              It was the broker cards from the top of the page again, cut down
              to one period - the third place the same two figures appeared.
              The broker pills in the toolbar do the same job properly: they
              scope the WHOLE page rather than adding a table to the bottom
              of it. */}

          {/* THE LIST SAYS WHAT IT IS A LIST OF.
              *
              * Fabio, 7 Oct 2026: "there's some random deals at the bottom. I
              * don't even know what the data is there."
              *
              * It never had a heading. It is every deal lodged - or settled -
              * inside the selected period, which is obvious once said and
              * impossible to guess when not. Three more things were wrong:
              *
              *   the total. The rows do not always add up to the headline, and
              *   nothing said so. See rowsTotal above.
              *
              *   "Splits" was a bare number. It is how many loans the deal was
              *   split into. It is Loans now, and a deal that was not split
              *   shows a dash rather than a 1, so the column only speaks when
              *   it has something to say.
              *
              *   "Status" is the stage the deal is at NOW, not the stage it was
              *   at in the period. A September lodgement reading "Settled"
              *   looks like a fault until you know that. It is "Now at", and it
              *   wears the board's colours. */}
          <div className="bg-card border border-card-line rounded-xl overflow-hidden">
            <div className="flex items-baseline justify-between gap-3 px-4 py-2.5 border-b border-line-soft flex-wrap">
              <span className="text-[12.5px] font-semibold text-ink">
                {rows.length === 0
                  ? `No deals ${metric === 'settled' ? 'settled' : 'lodged'} in ${period?.label}`
                  : `The ${rows.length} deal${rows.length === 1 ? '' : 's'} ${metric === 'settled' ? 'settled' : 'lodged'} in ${period?.label}`}
                {scope ? ` \u00b7 ${brokers.find(b => b.key === scope)?.name || scope}` : ''}
              </span>
              {rows.length > 0 && (
                <span className="text-[11.5px] text-faint">
                  {fmt(rowsTotal)}
                  {Math.round(rowsTotal) === Math.round(current.amount)
                    ? ' \u2014 the figure above, line by line'
                    : ' recorded deal by deal'}
                </span>
              )}
            </div>

            {/* WHY THE TWO FIGURES DISAGREE, SAID WHERE THEY DISAGREE.
                Only drawn when they actually differ - a note that is always
                there is a note nobody reads. */}
            {current.amount > 0 && Math.round(rowsTotal) !== Math.round(current.amount) && (
              <div className="bg-gray-50 border-b border-line-soft px-4 py-2.5 text-[12px] text-muted leading-relaxed">
                The <b className="text-ink">{compact(current.amount)}</b> above is the business spreadsheet figure
                for {period?.label}. {rows.length === 0
                  ? 'Nothing is recorded deal by deal for it yet.'
                  : <>These {rows.length} deal{rows.length === 1 ? '' : 's'} {metric === 'settled' ? 'settled' : 'lodged'} are
                     what the portal holds &mdash; <b className="text-ink">{compact(rowsTotal)}</b>. The rest is not recorded
                     deal by deal yet.</>}
              </div>
            )}

            {rows.length === 0 ? (
              <div className="px-4 py-8 text-sm text-faint text-center">
                Nothing to list for {period?.label}.
              </div>
            ) : (
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr className="text-[9.5px] font-bold uppercase tracking-[.075em] text-faint text-left">
                    <th className="font-bold px-3 py-2 border-b border-line-soft w-[26%]">Deal</th>
                    <th className="font-bold px-3 py-2 border-b border-line-soft w-[12%]">Broker</th>
                    <th className="font-bold px-3 py-2 border-b border-line-soft w-[15%]">Lender</th>
                    <th className="font-bold px-3 py-2 border-b border-line-soft w-[11%]">{metric === 'settled' ? 'Settled' : 'Lodged'}</th>
                    <th className="font-bold px-3 py-2 border-b border-line-soft w-[13%] text-right">Amount</th>
                    <th className="font-bold px-3 py-2 border-b border-line-soft w-[8%]">Loans</th>
                    <th className="font-bold px-3 py-2 border-b border-line-soft w-[15%]">Now at</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const td = 'px-3 py-2.5 border-b border-line-soft text-[12.5px] text-body whitespace-nowrap truncate'
                    return (
                      <tr key={r.id} className="hover:bg-gray-50 transition">
                        <td className={td + ' text-ink font-semibold'}>
                          <Link href={`/deals/${r.id}`} className="hover:underline">{r.name}</Link>
                        </td>
                        <td className={td}>{brokerLabel(r.broker)}</td>
                        <td className={td}>{r.lender}</td>
                        <td className={td}>{dmy(r.date)}</td>
                        <td className={td + ' text-right tabular-nums ' + (r.amount === null ? 'text-chase' : 'text-ink')}>
                          {r.amount === null ? 'not recorded' : fmt(r.amount)}
                        </td>
                        <td className={td}>{r.splits > 1 ? r.splits : '\u2014'}</td>
                        <td className={td}>
                          {r.status === '-' ? <span className="text-faint">&mdash;</span> : (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                              STAGE_TONE[r.status] || 'bg-gray-100 border-line text-muted'}`}>
                              {r.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Cmp({ label, value, base, tone, meter, meterFull }:
  { label: string; value: string; base: string; tone: 'up' | 'down' | 'flat'; meter?: number | null; meterFull?: boolean }) {
  return (
    <div className="px-4 py-3.5 border-r border-gray-100 last:border-r-0">
      <div className="text-[10px] font-semibold tracking-[.085em] uppercase text-faint">{label}</div>
      <div className={`text-[19px] font-semibold tracking-tight mt-1.5 ${tone === 'up' ? 'text-done' : tone === 'down' ? 'text-chase' : 'text-ink'}`}>{value}</div>
      <div className="text-[11.5px] text-faint mt-0.5">{base}</div>
      {meter !== null && meter !== undefined && (
        <div className="h-[5px] bg-line-soft rounded-full mt-2 overflow-hidden">
          <div className={`h-full rounded-full ${meterFull ? 'bg-done' : 'bg-faint'}`} style={{ width: meter + '%' }} />
        </div>
      )}
    </div>
  )
}
