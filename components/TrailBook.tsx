'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { TONE, money } from '@/lib/tone'
import { sameBroker } from '@/lib/broker-key'
import { stepMonth } from '@/lib/commission-schedule'
import RowLimit, { STEPS } from '@/components/RowLimit'
import { downloadCsv, stamp } from '@/lib/csv'
import { nameMatches } from '@/lib/settlement-match'

// Trail is a book, not a payment. Two questions matter: is it growing or
// leaking, and which loans have actually left.
//
// A loan going quiet is not a loan being lost. Measured across this book, most
// returns came back after a single silent month. So a loan is only called gone
// after three consecutive silent months — and silence is counted in months
// actually loaded, so a statement you have not uploaded is never mistaken for
// a month the bank did not pay. Everything shorter lives in the missed-trail
// box, where it can be queried rather than written off.
const GONE_AFTER = 3

// Why a loan left. A loan that moved to a new loan of ours has not been lost at
// all — the trail simply started again somewhere else in the book, and counting
// it as attrition both overstates the loss and hides the real one.
type Reason = 'moved_to_us' | 'refinanced_away' | 'sold' | 'paid_out' | 'unknown'
const REASON_LABEL: Record<Reason, string> = {
  moved_to_us: 'Moved to us',
  refinanced_away: 'Refinanced away',
  sold: 'Sold',
  paid_out: 'Paid out',
  unknown: 'Unknown',
}
// A new loan for the same client counts as the same client moving if it settled
// anywhere from shortly before the trail stopped to a year after.
const MOVE_FROM = -3
const MOVE_TO = 12

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const mLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`

type MonthRow = { broker_key: string; period_month: string; loans: number; trail_ex_gst: number }
type NewLoan = { client: string; loanRef: string; lender: string; started: string }

type LoanState = {
  broker_key: string; loan_ref: string; client_name: string | null; last_paid: string
  annual_trail: number; balance: number | null; lender: string | null
  months_skipped: number; months_absent: number
}

export default function TrailBook({ brokers }: { brokers: { key: string; name: string }[] }) {
  const supabase = createSupabaseBrowser()
  const [months, setMonths] = useState<MonthRow[]>([])
  const [silent, setSilent] = useState<LoanState[]>([])
  const [upfront, setUpfront] = useState<Record<string, number>>({})
  const [who, setWho] = useState('all')
  const [lookback, setLookback] = useState(12)
  const [limit, setLimit] = useState<number>(STEPS[0])
  const [ready, setReady] = useState(false)
  const [newLoans, setNewLoans] = useState<NewLoan[]>([])
  const [reasons, setReasons] = useState<Map<string, Reason>>(new Map())
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  async function loadReasons() {
    const { data, error } = await supabase.from('commission_trail_gone_reason')
      .select('broker_key, loan_ref, reason')
    if (error) { setSaveError('Could not read the reasons already recorded.'); return }
    const m = new Map<string, Reason>()
    for (const r of (data || []) as any[]) m.set(`${r.broker_key}|${r.loan_ref}`, r.reason)
    setReasons(m)
  }

  useEffect(() => {
    (async () => {
      const [m, l, s, u] = await Promise.all([
        supabase.from('commission_trail_months').select('*').order('period_month'),
        supabase.from('commission_trail_loan_state').select('*')
          .gte('months_absent', GONE_AFTER).order('annual_trail', { ascending: false }).limit(2000),
        supabase.from('commission_statements').select('kind, period_month, gross_ex_gst'),
        // Every upfront we have been paid: proof that a loan actually started.
        supabase.from('commission_lines')
          .select('client_name, loan_ref, lender_raw, settlement_date, period_month')
          .eq('kind', 'upfront').limit(5000),
      ])
      setMonths((m.data || []) as MonthRow[])
      setSilent((l.data || []) as LoanState[])
      setNewLoans(((u.data || []) as any[]).map(x => ({
        client: x.client_name || '',
        loanRef: x.loan_ref || '',
        lender: x.lender_raw || '',
        started: String(x.settlement_date || `${String(x.period_month).slice(0, 7)}-01`).slice(0, 7),
      })))
      loadReasons()
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

  const mine = useMemo(
    () => who === 'all' ? months : months.filter(r => sameBroker(r.broker_key, who)), [months, who])
  const mineGone = useMemo(
    () => who === 'all' ? silent : silent.filter(r => sameBroker(r.broker_key, who)), [silent, who])

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

  const last = series[series.length - 1]
  const prev = series.length > 1 ? series[series.length - 2] : null
  const adjacent = !!prev && stepMonth(prev.m, 1) === last?.m
  const move = last && prev && adjacent ? last.trail - prev.trail : null

  // A loan counts against a window by WHEN IT STOPPED, not by the fact that it
  // is still silent. Otherwise the figure only ever grows and stops being a
  // rate of loss.
  const windowStart = useMemo(
    () => last ? stepMonth(last.m, -(lookback - 1)) : '', [last, lookback])
  const gone = useMemo(
    () => lookback >= 999 ? mineGone : mineGone.filter(l => String(l.last_paid).slice(0, 7) >= windowStart),
    [mineGone, windowStart, lookback])
  // A new loan of ours for the same client, started around the time this one
  // went quiet, at a different account. That is the client moving, not leaving.
  const movedTo = useMemo(() => {
    const out = new Map<string, NewLoan>()
    for (const l of gone) {
      const from = stepMonth(String(l.last_paid).slice(0, 7), MOVE_FROM)
      const to = stepMonth(String(l.last_paid).slice(0, 7), MOVE_TO)
      const hit = newLoans.find(n =>
        n.loanRef && n.loanRef !== l.loan_ref &&
        n.started >= from && n.started <= to &&
        nameMatches(n.client, l.client_name || ''))
      if (hit) out.set(`${l.broker_key}|${l.loan_ref}`, hit)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gone, newLoans])

  const keyOf = (l: LoanState) => `${l.broker_key}|${l.loan_ref}`
  // A person's answer always beats the guess.
  const reasonFor = (l: LoanState): Reason | null =>
    reasons.get(keyOf(l)) || (movedTo.has(keyOf(l)) ? 'moved_to_us' : null)

  // Loans that moved to another of our own loans are not a loss.
  const lost = gone.filter(l => reasonFor(l) !== 'moved_to_us')
  const moved = gone.length - lost.length
  const goneValue = lost.reduce((t, l) => t + Number(l.annual_trail || 0), 0)
  const movedValue = gone.filter(l => reasonFor(l) === 'moved_to_us')
    .reduce((t, l) => t + Number(l.annual_trail || 0), 0)

  const chosen = gone.filter(l => picked.has(keyOf(l)))

  async function setReason(reason: Reason) {
    if (!chosen.length || saving) return
    setSaving(true); setSaveError('')
    const { data: u } = await supabase.auth.getUser()
    const payload = chosen.map(l => ({
      broker_key: l.broker_key, loan_ref: l.loan_ref, reason,
      marked_by: u?.user?.id || null,
    }))
    // A blocked write returns no rows and no error, so the rows back are the proof.
    const { data, error } = await supabase.from('commission_trail_gone_reason')
      .upsert(payload, { onConflict: 'broker_key,loan_ref' }).select()
    if (error || !data || data.length !== payload.length) {
      setSaveError(error?.message || 'Nothing was saved.')
    } else {
      await loadReasons()
      setPicked(new Set())
    }
    setSaving(false)
  }

  // Only offer a window the data can actually fill.
  const windows = useMemo(() => {
    const out = [{ n: 12, label: 'Last 12 months' }]
    if (series.length > 24) out.push({ n: 24, label: 'Last 2 years' })
    if (series.length > 36) out.push({ n: 36, label: 'Last 3 years' })
    out.push({ n: 999, label: 'All time' })
    return out
  }, [series.length])

  useEffect(() => setLimit(STEPS[0]), [who, lookback])

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
  const shown = gone.slice(0, limit)

  // Every gone loan in the chosen window and broker, not the twenty on screen.
  function exportCsv() {
    const name = who === 'all' ? 'all-brokers' : who
    const win = lookback >= 999 ? 'all-time' : `last-${lookback}-months`
    downloadCsv(
      `trail-gone-${name}-${win}-${stamp()}`,
      ['Broker', 'Client', 'Loan reference', 'Lender', 'Balance', 'Trail a year',
       'Last paid', 'Months silent', 'Why it went', 'Confirmed'],
      gone.map(l => [
        brokers.find(b => sameBroker(l.broker_key, b.key))?.name || l.broker_key,
        l.client_name || '',
        l.loan_ref,
        l.lender || '',
        l.balance ?? '',
        Number(l.annual_trail || 0).toFixed(2),
        l.last_paid,
        l.months_absent,
        (() => { const r = reasonFor(l); return r ? REASON_LABEL[r] : '' })(),
        reasons.has(keyOf(l)) ? 'Yes' : (reasonFor(l) ? 'Likely, not confirmed' : ''),
      ]))
  }

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

      <div className="grid grid-cols-3 gap-[11px] mb-3.5 max-[860px]:grid-cols-1">
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
        <div className={card + ' px-[15px] py-[13px]'} style={cardS}>
          <div className="flex items-start justify-between gap-2">
            <div className={kk} style={{ color: TONE.label }}>Gone</div>
            <select value={lookback} onChange={e => setLookback(Number(e.target.value))}
              className="border rounded-md px-1.5 py-[1px] text-[11px] bg-white -mt-[2px]"
              style={{ borderColor: TONE.line, color: TONE.body }}>
              {windows.map(w => <option key={w.n} value={w.n}>{w.label}</option>)}
            </select>
          </div>
          <div className="text-[27px] font-[640] tracking-[-.02em] leading-[1.15]" style={{ color: TONE.neg }}>
            {money(-goneValue)}
          </div>
          <div className="text-[11.5px] mt-[1px]" style={{ color: TONE.label }}>
            {/* The figure above leaves transfers out, so the count must too, or
                the card contradicts itself. */}
            {lost.length} loans lost, silent {GONE_AFTER}+ months
            {moved > 0 && <>; {moved} moved to us</>}
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

      <div className="flex items-baseline gap-2.5 mt-5 mb-2 flex-wrap">
        <div className="text-[11px] font-bold uppercase tracking-[.08em]" style={{ color: TONE.label }}>
          Loans gone — {windows.find(w => w.n === lookback)?.label.toLowerCase()}
        </div>
        {moved > 0 && (
          <span className="text-[12px]" style={{ color: TONE.label }}>
            <b style={{ color: TONE.pos }}>{moved}</b> of these moved to another of our own loans, worth{' '}
            {money(movedValue)} a year — not counted as lost.
          </span>
        )}
        {saveError && <span className="text-[12px]" style={{ color: TONE.neg }}>{saveError}</span>}
      </div>

      {/* Only once rows are ticked, so the list stays plain the rest of the time. */}
      {chosen.length > 0 && (
        <div className="flex items-center gap-2 mb-2 flex-wrap border rounded-xl px-3 py-2"
             style={{ borderColor: TONE.accentLine, background: TONE.accentSoft }}>
          <span className="text-[12.5px]" style={{ color: TONE.ink }}>{chosen.length} selected — why did it go?</span>
          {(['refinanced_away', 'sold', 'paid_out', 'moved_to_us', 'unknown'] as Reason[]).map(r => (
            <button key={r} onClick={() => setReason(r)} disabled={saving}
              className="rounded-lg px-3 py-[5px] text-[12px] font-medium border bg-white disabled:opacity-40"
              style={{ borderColor: r === 'moved_to_us' ? '#CFE6D5' : TONE.line,
                       color: r === 'moved_to_us' ? TONE.pos : TONE.body }}>
              {REASON_LABEL[r]}
            </button>
          ))}
          <span className="text-[11.5px]" style={{ color: TONE.label }}>
            {saving ? 'Saving…' : 'Only “moved to us” changes the loss figure.'}
          </span>
        </div>
      )}
      <div className={card + ' overflow-x-auto'} style={cardS}>
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <th className={th + ' text-left w-[34px]'} style={{ color: TONE.label, borderColor: TONE.hair }}>
                <input type="checkbox"
                       checked={gone.length > 0 && chosen.length === gone.length}
                       onChange={() => setPicked(chosen.length === gone.length ? new Set() : new Set(gone.map(keyOf)))}
                       aria-label="Select all" />
              </th>
              {['Client', 'Loan', 'Broker', 'Lender', 'Why it went', 'Balance last seen', 'Trail a year',
                'Last paid', 'Silent'].map((h, i) => (
                  <th key={h} className={th + (i < 5 ? ' text-left' : ' text-right')}
                      style={{ color: TONE.label, borderColor: TONE.hair }}>{h}</th>
                ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-6 text-[13px]" style={{ color: TONE.label }}>
                No loans have stopped paying in this window.
              </td></tr>
            )}
            {shown.map((l, i) => (
              <tr key={l.broker_key + l.loan_ref}
                  style={{ background: picked.has(keyOf(l)) ? TONE.accentSoft : i % 2 ? TONE.zebra : '#fff' }}>
                <td className="px-3 py-[9px] border-b" style={{ borderColor: TONE.hair }}>
                  <input type="checkbox" checked={picked.has(keyOf(l))}
                         onChange={() => setPicked(p => {
                           const next = new Set(p)
                           next.has(keyOf(l)) ? next.delete(keyOf(l)) : next.add(keyOf(l))
                           return next
                         })}
                         aria-label={`Select loan ${l.loan_ref}`} />
                </td>
                <td className="px-3 py-[9px] text-[13px] border-b"
                    style={{ color: TONE.ink, fontWeight: 520, borderColor: TONE.hair }}>
                  {l.client_name || '—'}
                  {l.months_skipped > 0 && (
                    <span className="ml-2 text-[10px] rounded-full px-2 py-[1px] border"
                          style={{ background: TONE.accentSoft, borderColor: TONE.accentLine, color: '#0B6F9E' }}
                          title="This loan has gone quiet and come back before">skipped before</span>
                  )}
                </td>
                <td className="px-3 py-[9px] text-[13px] border-b" style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {l.loan_ref}
                </td>
                <td className="px-3 py-[9px] text-[13px] border-b" style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {brokers.find(b => sameBroker(b.key, l.broker_key))?.name.split(' ')[0] || l.broker_key}
                </td>
                <td className="px-3 py-[9px] text-[13px] border-b" style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {l.lender || '—'}
                </td>
                {/* The guess is shown as a guess until somebody says otherwise. */}
                <td className="px-3 py-[9px] text-[12.5px] border-b" style={{ borderColor: TONE.hair }}>
                  {(() => {
                    const r = reasonFor(l)
                    if (!r) return <span style={{ color: TONE.faint }}>—</span>
                    const said = reasons.has(keyOf(l))
                    const hit = movedTo.get(keyOf(l))
                    return (
                      <span style={{ color: r === 'moved_to_us' ? TONE.pos : TONE.body }}
                            title={!said && hit
                              ? `Looks like it: ${hit.client} started ${hit.loanRef} with ${hit.lender} around then`
                              : ''}>
                        {REASON_LABEL[r]}{!said && ' (likely)'}
                      </span>
                    )
                  })()}
                </td>
                <td className={td} style={{ color: TONE.ink, borderColor: TONE.hair }}>{money(l.balance || 0)}</td>
                <td className={td} style={{ color: TONE.neg, borderColor: TONE.hair }}>
                  {money(-Math.abs(Number(l.annual_trail || 0)))}
                </td>
                <td className={td} style={{ color: TONE.label, borderColor: TONE.hair }}>
                  {mLabel(String(l.last_paid).slice(0, 7))}
                </td>
                <td className={td} style={{ color: TONE.label, borderColor: TONE.hair }}>
                  {l.months_absent} months
                </td>
              </tr>
            ))}
            {gone.length > 0 && (
              <tr style={{ background: TONE.hair }}>
                <td className="border-t" style={{ borderColor: TONE.line }} />
                <td className="px-3 py-[9px] text-[13px] font-[640] border-t"
                    style={{ color: TONE.ink, borderColor: TONE.line }}>
                  {/* The total counts what was actually lost, so it has to say so. */}
                  {lost.length} lost{moved > 0 && `, ${moved} moved`}
                </td>
                <td className="border-t" style={{ borderColor: TONE.line }} />
                <td className="border-t" style={{ borderColor: TONE.line }} />
                <td className="border-t" style={{ borderColor: TONE.line }} />
                <td className="border-t" style={{ borderColor: TONE.line }} />
                <td className={td + ' font-[640] border-b-0 border-t'} style={{ color: TONE.ink, borderColor: TONE.line }}>
                  {money(lost.reduce((t, l) => t + Number(l.balance || 0), 0))}
                </td>
                <td className={td + ' font-[640] border-b-0 border-t'} style={{ color: TONE.neg, borderColor: TONE.line }}>
                  {money(-goneValue)}
                </td>
                <td className="border-t" style={{ borderColor: TONE.line }} />
                <td className="border-t" style={{ borderColor: TONE.line }} />
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center gap-2 flex-wrap">
          <RowLimit shown={shown.length} total={gone.length} limit={limit} onChange={setLimit} />
          <button onClick={exportCsv} disabled={!gone.length}
                  className="text-[11.5px] border rounded-md px-2.5 py-[3px] bg-white disabled:opacity-40 mr-3"
                  style={{ borderColor: TONE.line, color: TONE.label }}>
            Export {gone.length} to Excel
          </button>
        </div>
        <div className="px-3 py-2.5 border-t text-[11.5px]" style={{ borderColor: TONE.hair, color: TONE.label }}>
          A loan counts here by the month it stopped paying, so the figure stays a rate of loss rather than a pile
          that only ever grows. Trail a year is the monthly rate it was last paying, annualised. The export takes
          every loan in the window above, not just the ones on screen.
        </div>
      </div>
    </div>
  )
}
