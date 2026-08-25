'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { TONE, money } from '@/lib/tone'
import { sameBroker } from '@/lib/broker-key'

// Trail is a book, not a payment. Two questions matter: is it growing or
// leaking, and which loans left.
//
// A loan going quiet is not the same as a loan being lost. Measured across
// this book, 56 of 65 returns came back after a single silent month and 60
// within two; past two months only five loans ever came back. So a loan is
// only called gone after three consecutive silent months — and silence is
// counted in months actually loaded, so a statement you have not uploaded is
// never mistaken for a month the bank did not pay.
const GONE_AFTER = 3

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const mLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`

type MonthRow = { broker_key: string; period_month: string; loans: number; trail_ex_gst: number; book_balance: number }
type LoanState = {
  broker_key: string; loan_ref: string; last_paid: string; annual_trail: number
  balance: number | null; lender: string | null
  months_paid: number; months_skipped: number; months_absent: number
}

function nextMonth(m: string): string {
  let y = Number(m.slice(0, 4)), n = Number(m.slice(5, 7)) + 1
  if (n > 12) { n = 1; y += 1 }
  return `${y}-${String(n).padStart(2, '0')}`
}

export default function TrailBook({ brokers }: { brokers: { key: string; name: string }[] }) {
  const supabase = createSupabaseBrowser()
  const [months, setMonths] = useState<MonthRow[]>([])
  const [silent, setSilent] = useState<LoanState[]>([])
  const [returns, setReturns] = useState<{ months_away: number }[]>([])
  const [upfront, setUpfront] = useState<Record<string, number>>({})
  const [who, setWho] = useState('all')
  const [tab, setTab] = useState<'gone' | 'quiet'>('gone')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    (async () => {
      const [m, l, r, s] = await Promise.all([
        supabase.from('commission_trail_months').select('*').order('period_month'),
        // only loans that have stopped paying — the ones still paying are
        // thousands of rows and are already counted in the monthly view
        supabase.from('commission_trail_loan_state').select('*')
          .gt('months_absent', 0).order('annual_trail', { ascending: false }).limit(2000),
        supabase.from('commission_trail_returns').select('months_away'),
        supabase.from('commission_statements').select('kind, period_month, gross_ex_gst'),
      ])
      setMonths((m.data || []) as MonthRow[])
      setSilent((l.data || []) as LoanState[])
      setReturns((r.data || []) as any[])
      const up: Record<string, number> = {}
      for (const row of (s.data || []) as any[]) {
        if (row.kind !== 'upfront') continue
        const k = String(row.period_month).slice(0, 7)
        up[k] = (up[k] || 0) + Number(row.gross_ex_gst || 0)
      }
      setUpfront(up)
      setReady(true)
    })()
  }, [])

  const mine = useMemo(() => who === 'all' ? months : months.filter(r => sameBroker(r.broker_key, who)), [months, who])
  const mySilent = useMemo(() => who === 'all' ? silent : silent.filter(r => sameBroker(r.broker_key, who)), [silent, who])

  const series = useMemo(() => {
    const by = new Map<string, { trail: number; loans: number }>()
    for (const r of mine) {
      const k = String(r.period_month).slice(0, 7)
      const cur = by.get(k) || { trail: 0, loans: 0 }
      by.set(k, { trail: cur.trail + Number(r.trail_ex_gst || 0), loans: cur.loans + Number(r.loans || 0) })
    }
    return Array.from(by.entries()).map(([m, v]) => ({ m, ...v, up: upfront[m] || 0 }))
      .sort((a, b) => a.m.localeCompare(b.m))
  }, [mine, upfront])

  const holes = useMemo(() => {
    const have = new Set(series.map(s => s.m))
    const out: string[] = []
    if (series.length < 2) return out
    for (let m = nextMonth(series[0].m); m < series[series.length - 1].m; m = nextMonth(m)) {
      if (!have.has(m)) out.push(m)
    }
    return out
  }, [series])

  const last = series[series.length - 1]
  const prev = series.length > 1 ? series[series.length - 2] : null
  const adjacent = !!prev && nextMonth(prev.m) === last?.m
  const move = last && prev && adjacent ? last.trail - prev.trail : null

  const gone = useMemo(() => mySilent.filter(l => l.months_absent >= GONE_AFTER), [mySilent])
  const quiet = useMemo(() => mySilent.filter(l => l.months_absent > 0 && l.months_absent < GONE_AFTER), [mySilent])
  const sum = (rows: LoanState[]) => rows.reduce((t, l) => t + Number(l.annual_trail || 0), 0)
  const cameBackFast = returns.filter(r => r.months_away <= 2).length
  const rows = tab === 'gone' ? gone : quiet

  const card = 'bg-white border rounded-xl'
  const cardS = { borderColor: TONE.line }
  const kk = 'text-[9.5px] font-bold tracking-[.1em] uppercase mb-[3px]'
  const th = 'px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[.09em] whitespace-nowrap border-b'
  const td = 'px-3 py-[9px] text-[13px] text-right tabular-nums whitespace-nowrap border-b'

  if (!ready) return null
  if (series.length === 0) return (
    <div className={card + ' px-4 py-6 text-[13px] mb-6'} style={{ ...cardS, color: TONE.label }}>
      No trail statements loaded yet.
    </div>
  )

  const W = 900, H = 210, X0 = 66, X1 = 878, Y0 = 20, Y1 = 190
  const peak = Math.max(...series.map(s => Math.max(s.trail, s.up)), 1)
  const step = Math.pow(10, Math.floor(Math.log10(peak / 4)))
  const tick = Math.ceil(peak / 4 / step) * step
  const top = tick * 4
  const slot = (X1 - X0) / series.length
  const bw = Math.min(17, Math.max(4, (slot - 12) / 2))
  const yOf = (v: number) => Y1 - (v / top) * (Y1 - Y0)

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <select value={who} onChange={e => setWho(e.target.value)}
          className="border rounded-lg px-2.5 py-[5px] text-[12.5px] bg-white"
          style={{ borderColor: TONE.line, color: TONE.ink }}>
          <option value="all">Whole business</option>
          {brokers.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
        </select>
        <span className="text-[12px]" style={{ color: TONE.label }}>
          {mLabel(series[0].m)} – {mLabel(last.m)}
        </span>
      </div>

      {holes.length > 0 && (
        <div className="rounded-xl px-4 py-3 mb-3 text-[12.5px] border"
             style={{ background: '#FDF6E7', borderColor: '#EFE0BC', color: '#7A5F17' }}>
          <b>{holes.length === 1 ? 'One trail month is missing' : `${holes.length} trail months are missing`}</b>
          {' — '}{holes.map(mLabel).join(', ')}. Load {holes.length === 1 ? 'it' : 'them'} and every figure below
          sharpens. Nothing is being blamed on a month you have not uploaded: silence is counted only in months
          actually loaded.
        </div>
      )}

      <div className="grid grid-cols-4 gap-[11px] mb-3.5 max-[860px]:grid-cols-2">
        <div className={card + ' px-[15px] py-[13px]'} style={cardS}>
          <div className={kk} style={{ color: TONE.label }}>Book at {mLabel(last.m)}</div>
          <div className="text-[27px] font-[640] tracking-[-.02em] leading-[1.15]" style={{ color: TONE.ink }}>
            {money(last.trail)}
          </div>
          <div className="text-[11.5px] mt-[1px]" style={{ color: TONE.label }}>
            {last.loans.toLocaleString('en-AU')} loans paying trail
          </div>
        </div>
        <div className={card + ' px-[15px] py-[13px]'} style={cardS}>
          <div className={kk} style={{ color: TONE.label }}>Month on month</div>
          <div className="text-[27px] font-[640] tracking-[-.02em] leading-[1.15]"
               style={{ color: move === null ? TONE.faint : move >= 0 ? TONE.pos : TONE.neg }}>
            {move === null ? '—' : (move >= 0 ? '+' : '') + money(move)}
          </div>
          <div className="text-[11.5px] mt-[1px]" style={{ color: TONE.label }}>
            {move === null ? 'needs two consecutive months'
              : `${prev && prev.trail ? ((move / prev.trail) * 100).toFixed(1) : '0.0'}% after normalising for days`}
          </div>
        </div>
        <div className={card + ' px-[15px] py-[13px] cursor-pointer'} style={cardS} onClick={() => setTab('gone')}>
          <div className={kk} style={{ color: TONE.label }}>Gone</div>
          <div className="text-[27px] font-[640] tracking-[-.02em] leading-[1.15]" style={{ color: TONE.neg }}>
            {money(-sum(gone))}
          </div>
          <div className="text-[11.5px] mt-[1px]" style={{ color: TONE.label }}>
            {gone.length} loans, silent {GONE_AFTER}+ months
          </div>
        </div>
        <div className={card + ' px-[15px] py-[13px] cursor-pointer'} style={cardS} onClick={() => setTab('quiet')}>
          <div className={kk} style={{ color: TONE.label }}>Quiet, may return</div>
          <div className="text-[27px] font-[640] tracking-[-.02em] leading-[1.15]" style={{ color: '#B4761F' }}>
            {money(-sum(quiet))}
          </div>
          <div className="text-[11.5px] mt-[1px]" style={{ color: TONE.label }}>
            {quiet.length} loans, silent 1–2 months
          </div>
        </div>
      </div>

      <div className={card} style={cardS}>
        <div className="px-3.5 pt-3.5 pb-1.5">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
               aria-label="Trail and upfront commission by month">
            {[1, 2, 3, 4].map(i => (
              <g key={i}>
                <line x1={X0 - 8} y1={yOf(tick * i)} x2={X1} y2={yOf(tick * i)} stroke={TONE.hair} />
                <text x={X0 - 14} y={yOf(tick * i) + 4} textAnchor="end"
                      fontSize="10.5" fill={TONE.label}>{money(tick * i)}</text>
              </g>
            ))}
            {series.map((s, i) => {
              const cx = X0 + slot * i + slot / 2
              const ht = Math.max(2, Y1 - yOf(s.trail))
              const hu = Math.max(2, Y1 - yOf(s.up))
              return (
                <g key={s.m}>
                  <title>{`${mLabel(s.m)} — trail ${money(s.trail)}, upfront ${money(s.up)}, ${s.loans.toLocaleString('en-AU')} loans`}</title>
                  <rect x={cx - bw - 1} y={Y1 - ht} width={bw} height={ht} rx="4" fill="#0E8FCB" />
                  <rect x={cx + 1} y={Y1 - hu} width={bw} height={hu} rx="4" fill="#C4762B" />
                  <text x={cx} y={Y1 + 15} textAnchor="middle" fontSize="10.5" fill={TONE.label}>
                    {mLabel(s.m).split(' ')[0]}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
        <div className="flex gap-4 px-3.5 pb-3 text-[12px]" style={{ color: TONE.body }}>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: '#0E8FCB' }} />Trail
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: '#C4762B' }} />Upfront
          </span>
          <span style={{ color: TONE.label }}>Hover a month for the figures</span>
        </div>
        <div className="px-3.5 py-2.5 border-t text-[11.5px]" style={{ borderColor: TONE.hair, color: TONE.label }}>
          Trail is day-normalised to a 30.44-day month, so a short February never reads as a collapse. Loan counts
          are never normalised — a month has the clients it has. Side by side rather than stacked, because upfront
          is lumpy and trail is not.
        </div>
      </div>

      <div className="flex items-center gap-2.5 mt-4 mb-2 flex-wrap">
        <div className="inline-flex rounded-lg p-[2px] border" style={{ background: TONE.hair, borderColor: TONE.line }}>
          {([['gone', `Gone (${gone.length})`], ['quiet', `Quiet (${quiet.length})`]] as const).map(([id, lab]) => (
            <button key={id} onClick={() => setTab(id)}
              className="px-3 py-1 text-[12.5px] rounded-[6px]"
              style={tab === id
                ? { background: '#fff', color: TONE.ink, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,.07)' }
                : { color: TONE.body }}>{lab}</button>
          ))}
        </div>
        <span className="text-[12px]" style={{ color: TONE.label }}>
          {tab === 'gone'
            ? `Silent ${GONE_AFTER} months or more. Treated as lost.`
            : `Silent one or two months. ${cameBackFast} loans in this book have come back from exactly that.`}
        </span>
      </div>

      <div className={card + ' overflow-x-auto'} style={cardS}>
        <table className="w-full min-w-[700px]">
          <thead>
            <tr>
              {['Loan', 'Broker', 'Lender', 'Balance last seen', 'Trail a year', 'Last paid', 'Silent'].map((h, i) => (
                <th key={h} className={th + (i < 3 ? ' text-left' : ' text-right')}
                    style={{ color: TONE.label, borderColor: TONE.hair }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-[13px]" style={{ color: TONE.label }}>
                Nothing in this state{who === 'all' ? '' : ' for this broker'}.
              </td></tr>
            )}
            {rows.slice(0, 40).map((l, i) => (
              <tr key={l.broker_key + l.loan_ref} style={{ background: i % 2 ? TONE.zebra : '#fff' }}>
                <td className="px-3 py-[9px] text-[13px] border-b"
                    style={{ color: TONE.ink, fontWeight: 520, borderColor: TONE.hair }}>
                  {l.loan_ref}
                  {l.months_skipped > 0 && (
                    <span className="ml-2 text-[10px] rounded-full px-2 py-[1px] border"
                          style={{ background: '#FDF6E7', borderColor: '#EFE0BC', color: '#9A7B2E' }}
                          title="This loan has gone quiet and come back before">skipped before</span>
                  )}
                </td>
                <td className="px-3 py-[9px] text-[13px] border-b" style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {brokers.find(b => sameBroker(b.key, l.broker_key))?.name.split(' ')[0] || l.broker_key}
                </td>
                <td className="px-3 py-[9px] text-[13px] border-b" style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {l.lender || '—'}
                </td>
                <td className={td} style={{ color: TONE.ink, borderColor: TONE.hair }}>{money(l.balance || 0)}</td>
                <td className={td} style={{ color: tab === 'gone' ? TONE.neg : '#B4761F', borderColor: TONE.hair }}>
                  {money(-Math.abs(Number(l.annual_trail || 0)))}
                </td>
                <td className={td} style={{ color: TONE.label, borderColor: TONE.hair }}>
                  {mLabel(String(l.last_paid).slice(0, 7))}
                </td>
                <td className={td} style={{ color: TONE.label, borderColor: TONE.hair }}>
                  {l.months_absent} {l.months_absent === 1 ? 'month' : 'months'}
                </td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr style={{ background: TONE.hair }}>
                <td className="px-3 py-[9px] text-[13px] font-[640] border-t"
                    style={{ color: TONE.ink, borderColor: TONE.line }}>{rows.length} loans</td>
                <td className="border-t" style={{ borderColor: TONE.line }} />
                <td className="border-t" style={{ borderColor: TONE.line }} />
                <td className={td + ' font-[640] border-b-0 border-t'} style={{ color: TONE.ink, borderColor: TONE.line }}>
                  {money(rows.reduce((t, l) => t + Number(l.balance || 0), 0))}
                </td>
                <td className={td + ' font-[640] border-b-0 border-t'}
                    style={{ color: tab === 'gone' ? TONE.neg : '#B4761F', borderColor: TONE.line }}>
                  {money(-sum(rows))}
                </td>
                <td className="border-t" style={{ borderColor: TONE.line }} />
                <td className="border-t" style={{ borderColor: TONE.line }} />
              </tr>
            )}
          </tbody>
        </table>
        <div className="px-3 py-2.5 border-t text-[11.5px]" style={{ borderColor: TONE.hair, color: TONE.label }}>
          {rows.length > 40 ? `Largest 40 shown of ${rows.length}. ` : ''}
          A loan is called gone only after {GONE_AFTER} consecutive silent months, measured from your own book:
          56 of 65 returns came back after one silent month, 60 within two. Loan references only — no borrower
          names leave the aggregator file.
        </div>
      </div>
    </div>
  )
}
