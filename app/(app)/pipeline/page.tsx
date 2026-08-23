'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { listPeriods, inPeriod, toAuDate, type Period, type PeriodKind } from '@/lib/periods'

function money(v: any): string {
  const n = num(v)
  if (n === null) return '-'
  return '$' + Math.round(n).toLocaleString('en-AU')
}
function num(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? null : n
}
function splitsTotal(splits: any): number | null {
  if (!Array.isArray(splits) || splits.length === 0) return null
  let t = 0, seen = false
  for (const s of splits) {
    const n = num(s?.amount)
    if (n !== null) { t += n; seen = true }
  }
  return seen ? t : null
}
function dmy(ymd: string): string {
  if (!ymd) return '-'
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

type Row = {
  id: string
  name: string
  broker: string
  lender: string
  date: string           // the date that put this row in the period
  amount: number | null  // amount at the stage this view reports on
  splits: number
  status: string
  lodgedAmount: number | null
  variance: number | null
  upfront: number | null
}

export default function PipelinePage() {
  const supabase = createSupabaseBrowser()
  const [view, setView] = useState<'lodged' | 'settled'>('lodged')
  const [kind, setKind] = useState<PeriodKind>('month')
  const [periodKey, setPeriodKey] = useState('')
  const [deals, setDeals] = useState<any[]>([])
  const [snaps, setSnaps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [dRes, sRes] = await Promise.all([
        supabase.from('deals').select('id, deal_name, assigned_broker, lender, loan_amount, expected_upfront, lodged_at, preapproval_at, formal_approval_at, settled_at'),
        supabase.from('deal_stage_snapshots').select('deal_id, stage, effective_date, lender, total_amount, splits'),
      ])
      if (cancelled) return
      // A failed read must not look like an empty pipeline. Those are very
      // different things and the team would act on them very differently.
      if (dRes.error || sRes.error) {
        setLoadError(dRes.error?.message || sRes.error?.message || 'Could not load the pipeline.')
        setLoading(false)
        return
      }
      setDeals(dRes.data || [])
      setSnaps(sRes.data || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const periods = useMemo(() => listPeriods(kind, kind === 'fy' ? 5 : 12), [kind])
  const period: Period | undefined = useMemo(
    () => periods.find(p => p.key === periodKey) || periods[0], [periods, periodKey])

  const snapIndex = useMemo(() => {
    const m: Record<string, Record<string, any>> = {}
    for (const s of snaps) {
      if (!m[s.deal_id]) m[s.deal_id] = {}
      m[s.deal_id][s.stage] = s
    }
    return m
  }, [snaps])

  const rows: Row[] = useMemo(() => {
    if (!period) return []
    const out: Row[] = []
    for (const d of deals) {
      const s = snapIndex[d.id] || {}
      const lodgedSnap = s.lodged, formalSnap = s.formal, settledSnap = s.settled
      const lodgedAmount = lodgedSnap ? (num(lodgedSnap.total_amount) ?? splitsTotal(lodgedSnap.splits)) : num(d.loan_amount)

      // The date a deal is reported on is the effective date recorded at the
      // stage, not when someone happened to click the button.
      const lodgedDate  = toAuDate(lodgedSnap?.effective_date  || d.lodged_at)
      const settledDate = toAuDate(settledSnap?.effective_date || d.settled_at)

      const isLodged  = view === 'lodged'  && inPeriod(lodgedDate, period)
      const isSettled = view === 'settled' && inPeriod(settledDate, period)
      if (!isLodged && !isSettled) continue

      const activeSnap = isSettled ? settledSnap : lodgedSnap
      const amount = isSettled
        ? (settledSnap ? (num(settledSnap.total_amount) ?? splitsTotal(settledSnap.splits)) : num(d.loan_amount))
        : lodgedAmount

      const status = d.settled_at ? 'Settled'
        : d.formal_approval_at ? 'Formal approval'
        : d.preapproval_at ? 'Preapproved'
        : d.lodged_at ? 'Lodged' : '-'

      out.push({
        id: d.id,
        name: d.deal_name || '(unnamed deal)',
        broker: d.assigned_broker || '-',
        lender: activeSnap?.lender || formalSnap?.lender || lodgedSnap?.lender || d.lender || '-',
        date: isSettled ? settledDate : lodgedDate,
        amount,
        splits: Array.isArray(activeSnap?.splits) ? activeSnap.splits.length : 0,
        status,
        lodgedAmount,
        variance: (isSettled && amount !== null && lodgedAmount !== null) ? amount - lodgedAmount : null,
        upfront: num(d.expected_upfront),
      })
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [deals, snapIndex, period, view])

  const totals = useMemo(() => {
    const amount = rows.reduce((t, r) => t + (r.amount || 0), 0)
    const upfront = rows.reduce((t, r) => t + (r.upfront || 0), 0)
    const variance = rows.reduce((t, r) => t + (r.variance || 0), 0)
    const missing = rows.filter(r => r.amount === null).length
    return { count: rows.length, amount, upfront, variance, missing,
             avg: rows.length ? amount / rows.length : 0 }
  }, [rows])

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
    if (!period) return
    const head = view === 'settled'
      ? ['Deal', 'Broker', 'Lender', 'Settled', 'Settled amount', 'Lodged amount', 'Variance', 'Expected upfront', 'Splits']
      : ['Deal', 'Broker', 'Lender', 'Lodged', 'Amount', 'Splits', 'Current status']
    const body = rows.map(r => view === 'settled'
      ? [r.name, r.broker, r.lender, dmy(r.date), r.amount ?? '', r.lodgedAmount ?? '', r.variance ?? '', r.upfront ?? '', r.splits]
      : [r.name, r.broker, r.lender, dmy(r.date), r.amount ?? '', r.splits, r.status])
    const esc = (c: any) => `"${String(c ?? '').replace(/"/g, '""')}"`
    const csv = [head, ...body].map(line => line.map(esc).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${view === 'settled' ? 'settlements' : 'lodgements'}-${period.key}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const kinds: { k: PeriodKind; label: string }[] = [
    { k: 'week', label: 'Week' }, { k: 'month', label: 'Month' },
    { k: 'quarter', label: 'Quarter' }, { k: 'fy', label: 'Financial year' },
  ]
  const cols = view === 'settled'
    ? 'grid-cols-[2.2fr_1fr_1.2fr_0.9fr_1fr_1fr_1fr]'
    : 'grid-cols-[2.2fr_1fr_1.2fr_0.9fr_1fr_0.6fr_1.1fr]'

  return (
    <div className="max-w-6xl mx-auto p-6">
      <p className="text-lg font-medium text-[#343333] mb-4">Pipeline</p>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(['lodged', 'settled'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 text-sm rounded-md font-medium transition ${view === v ? 'bg-white text-[#343333] shadow-sm' : 'text-gray-500'}`}>
              {v === 'lodged' ? 'Lodgements' : 'Settlements'}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {kinds.map(({ k, label }) => (
            <button key={k} onClick={() => { setKind(k); setPeriodKey('') }}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition ${kind === k ? 'bg-white text-[#343333] shadow-sm' : 'text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>

        <select value={period?.key || ''} onChange={e => setPeriodKey(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-[#343333]">
          {periods.map(p => <option key={p.key} value={p.key}>{p.label} - {p.range}</option>)}
        </select>

        <button onClick={exportCsv} disabled={rows.length === 0}
          className="ml-auto bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-lg px-3.5 py-2 text-[12.5px] font-medium hover:bg-[#F4EEE4] hover:text-[#2E2A26] transition inline-flex items-center gap-1.5 disabled:opacity-40">
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
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: view === 'settled' ? 'Deals settled' : 'Deals lodged', value: String(totals.count) },
              { label: view === 'settled' ? 'Settled volume' : 'Lodged volume', value: money(totals.amount) },
              { label: 'Average size', value: totals.count ? money(totals.avg) : '-' },
              view === 'settled'
                ? { label: 'Expected upfront', value: money(totals.upfront) }
                : { label: 'Brokers', value: String(byBroker.length) },
            ].map(c => (
              <div key={c.label} className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="text-[10.5px] font-medium text-gray-400 uppercase tracking-widest mb-1.5">{c.label}</div>
                <div className="text-2xl font-semibold text-[#343333]">{c.value}</div>
              </div>
            ))}
          </div>

          {totals.missing > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2.5 text-[12.5px] mb-4">
              {totals.missing} of {totals.count} deals have no recorded amount at this stage, so the volume above understates the period.
            </div>
          )}

          {view === 'settled' && totals.variance !== 0 && rows.length > 0 && (
            <div className="bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-xl px-4 py-2.5 text-[12.5px] mb-4">
              Settled volume is {money(Math.abs(totals.variance))} {totals.variance > 0 ? 'above' : 'below'} what was lodged for these deals.
            </div>
          )}

          {byBroker.length > 1 && (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-5">
              <div className="grid grid-cols-[2fr_1fr_1fr] px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <span>Broker</span><span>Deals</span><span>Volume</span>
              </div>
              {byBroker.map(([broker, v]) => (
                <div key={broker} className="grid grid-cols-[2fr_1fr_1fr] px-4 py-2.5 text-sm border-b border-gray-50 last:border-0">
                  <span className="text-[#343333]">{broker}</span>
                  <span className="text-gray-600">{v.count}</span>
                  <span className="font-medium text-[#343333]">{money(v.amount)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className={`grid ${cols} px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100`}>
              <span>Deal</span><span>Broker</span><span>Lender</span>
              <span>{view === 'settled' ? 'Settled' : 'Lodged'}</span>
              <span>{view === 'settled' ? 'Settled amount' : 'Amount'}</span>
              {view === 'settled'
                ? <><span>vs lodged</span><span>Expected upfront</span></>
                : <><span>Splits</span><span>Status</span></>}
            </div>
            {rows.length === 0 ? (
              <div className="px-4 py-8 text-sm text-gray-400 text-center">
                No deals {view === 'settled' ? 'settled' : 'lodged'} in {period?.label}.
              </div>
            ) : rows.map(r => (
              <Link key={r.id} href={`/deals/${r.id}`}
                className={`grid ${cols} px-4 py-3 text-sm border-b border-gray-50 last:border-0 hover:bg-gray-50 transition`}>
                <span className="text-[#343333] truncate pr-3">{r.name}</span>
                <span className="text-gray-600 truncate pr-3">{r.broker}</span>
                <span className="text-gray-600 truncate pr-3">{r.lender}</span>
                <span className="text-gray-600">{dmy(r.date)}</span>
                <span className={`font-medium ${r.amount === null ? 'text-amber-600' : 'text-[#343333]'}`}>
                  {r.amount === null ? 'not recorded' : money(r.amount)}
                </span>
                {view === 'settled' ? (
                  <>
                    <span className={r.variance === null ? 'text-gray-300' : r.variance === 0 ? 'text-gray-400' : r.variance > 0 ? 'text-green-600 font-medium' : 'text-amber-700 font-medium'}>
                      {r.variance === null ? '-' : r.variance === 0 ? 'no change' : (r.variance > 0 ? '+' : '-') + money(Math.abs(r.variance)).slice(1)}
                    </span>
                    <span className="text-gray-600">{r.upfront === null ? '-' : money(r.upfront)}</span>
                  </>
                ) : (
                  <>
                    <span className="text-gray-500">{r.splits || '-'}</span>
                    <span className="text-gray-600">{r.status}</span>
                  </>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
