'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { TONE, money } from '@/lib/tone'
import { sameBroker } from '@/lib/broker-key'
import { buildClawback, daysBetween } from '@/lib/clawback'
import { todayYmd } from '@/lib/periods'
import { downloadCsv, stamp } from '@/lib/csv'
import RowLimit, { STEPS } from '@/components/RowLimit'

// Settled loans still inside the lender's clawback window.
//
// This is exposure, not a loss: if one of these discharges or refinances away
// before the window closes, the upfront comes back off a future statement. The
// point of the list is to know which clients those are while there is still
// time to talk to them.
//
// It reads the commission statements, not the deals table. It used to read
// `deals` filtered on settled_at, which is the portal's own pipeline - and not
// one deal in it has ever been ticked as settled, so the screen was blank while
// the statements held 766 upfronts with real settlement dates on them. The
// settled book lives in the statements; that is where this looks.
//
// Because it reads the statements, the figure at risk is the upfront that was
// actually paid, not one worked out from the rate library. The library is only
// asked how long each lender's window is.

type Row = {
  id: string; client: string; broker_key: string; lender: string; loanRef: string
  settled_on: string; ends_on: string; days_left: number
  amount: number | null; upfront: number
}

export default function ClawbackWatch({ brokers }: { brokers: { key: string; name: string }[] }) {
  const supabase = createSupabaseBrowser()
  const [rows, setRows] = useState<Row[]>([])
  const [unknown, setUnknown] = useState<{ client: string; lender: string; reason: string }[]>([])
  const [who, setWho] = useState('all')
  const [limit, setLimit] = useState<number>(STEPS[0])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    (async () => {
      const [u, cb, r, l] = await Promise.all([
        // The settled book. Every upfront the group has ever paid us.
        supabase.from('commission_lines')
          .select('id, loan_ref, client_name, broker_key, lender_id, lender_raw, settlement_date, settlement_amount, gross_ex_gst')
          .eq('kind', 'upfront').limit(20000),
        // Loans already clawed back are not at risk of it happening again.
        supabase.from('commission_lines').select('loan_ref').eq('kind', 'clawback').limit(20000),
        supabase.from('commission_rates').select('lender_id, clawback_months'),
        supabase.from('lenders').select('id, name'),
      ])

      const monthsByLender = new Map<string, number>()
      for (const x of (r.data || []) as any[]) {
        const m = Number(x.clawback_months)
        if (Number.isFinite(m) && m > 0) monthsByLender.set(String(x.lender_id), m)
      }
      const nameByLender = new Map<string, string>()
      for (const x of (l.data || []) as any[]) nameByLender.set(String(x.id), x.name)

      const { rows: live, unknown: cannotTell } = buildClawback({
        upfronts: (u.data || []) as any[],
        clawedBackRefs: ((cb.data || []) as any[]).map(x => x.loan_ref),
        monthsByLender, nameByLender, today: todayYmd(),
      })

      setRows(live)
      setUnknown(cannotTell)
      setReady(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mine = useMemo(
    () => who === 'all' ? rows : rows.filter(r => sameBroker(r.broker_key, who)), [rows, who])
  const shown = mine.slice(0, limit)
  const atRisk = mine.reduce((t, r) => t + r.upfront, 0)
  const soon = mine.filter(r => r.days_left <= 90)
  const soonValue = soon.reduce((t, r) => t + r.upfront, 0)
  const lent = mine.reduce((t, r) => t + Number(r.amount || 0), 0)
  // Settled inside the last year. Not a claim about what a lender would take
  // back - the library holds the window, not the taper - just the newest and
  // therefore most exposed part of the book.
  const fresh = mine.filter(r => daysBetween(r.settled_on, todayYmd()) <= 365)
  const freshValue = fresh.reduce((t, r) => t + r.upfront, 0)

  // What stops being clawable, month by month, for the next year. One series,
  // so no legend: the heading names it.
  const runway = useMemo(() => {
    const today = todayYmd()
    const out: { key: string; label: string; value: number; count: number }[] = []
    const d = new Date(today + 'T00:00:00Z')
    for (let i = 0; i < 12; i++) {
      const y = d.getUTCFullYear(), m = d.getUTCMonth()
      const key = `${y}-${String(m + 1).padStart(2, '0')}`
      const hits = mine.filter(r => r.ends_on.slice(0, 7) === key)
      out.push({
        key,
        label: new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-AU', { month: 'short', timeZone: 'UTC' }),
        value: hits.reduce((t, r) => t + r.upfront, 0),
        count: hits.length,
      })
      d.setUTCMonth(m + 1)
    }
    return out
  }, [mine])
  const runwayMax = Math.max(1, ...runway.map(r => r.value))

  // By lender, worst exposure first. The window comes from the dates themselves,
  // so it cannot disagree with the figure beside it.
  const byLender = useMemo(() => {
    const g = new Map<string, { lender: string; loans: number; lent: number; risk: number; months: number; longest: number }>()
    for (const r of mine) {
      const cur = g.get(r.lender) || { lender: r.lender, loans: 0, lent: 0, risk: 0, months: 0, longest: 0 }
      cur.loans += 1
      cur.lent += Number(r.amount || 0)
      cur.risk += r.upfront
      cur.months = Math.max(cur.months, Math.round(daysBetween(r.settled_on, r.ends_on) / 30.44))
      cur.longest = Math.max(cur.longest, r.days_left)
      g.set(r.lender, cur)
    }
    return [...g.values()].sort((a, b) => b.risk - a.risk)
  }, [mine])

  useEffect(() => setLimit(STEPS[0]), [who])

  function exportCsv() {
    downloadCsv(
      `clawback-window-${who === 'all' ? 'all-brokers' : who}-${stamp()}`,
      ['Client', 'Loan account', 'Broker', 'Lender', 'Settled', 'Window closes', 'Days left', 'Loan amount', 'Upfront at risk'],
      mine.map(r => [
        r.client, r.loanRef,
        brokers.find(b => sameBroker(r.broker_key, b.key))?.name || r.broker_key,
        r.lender, r.settled_on, r.ends_on, r.days_left,
        r.amount ?? '', r.upfront.toFixed(2),
      ]))
  }

  if (!ready) return null
  if (rows.length === 0) return (
    <div className="border rounded-xl bg-white px-4 py-6 text-[13px]"
         style={{ borderColor: TONE.line, color: TONE.label }}>
      No settled loan is inside a clawback window right now. This reads the upfronts on the
      commission statements, so if it looks empty and should not, the statements for those
      settlements have not been loaded.
    </div>
  )

  const card = 'bg-white border rounded-xl'
  const cardS = { borderColor: TONE.line }
  const th = 'px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[.09em] whitespace-nowrap border-b'
  const td = 'px-3 py-[9px] text-[13px] text-right tabular-nums whitespace-nowrap border-b'

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
        <h2 className="text-[11px] font-bold tracking-[.09em] uppercase" style={{ color: TONE.label }}>
          Inside the clawback window
        </h2>
        <select value={who} onChange={e => setWho(e.target.value)}
          className="border rounded-lg px-2.5 py-[5px] text-[12.5px] bg-white"
          style={{ borderColor: TONE.line, color: TONE.ink }}>
          <option value="all">Whole business</option>
          {brokers.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
        </select>
      </div>

      {/* The shape of it, before the list. */}
      <div className="grid gap-2.5 mb-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        {[
          { lab: 'Loans still in a window', v: String(mine.length), ink: TONE.ink,
            s: `${money(lent)} lent` },
          { lab: 'Upfront that could come back', v: money(atRisk), ink: TONE.neg,
            s: 'if every one of them discharged today' },
          { lab: 'Settled in the last 12 months', v: money(freshValue), ink: TONE.warn,
            s: `${fresh.length} ${fresh.length === 1 ? 'loan' : 'loans'} · the newest and most exposed` },
          { lab: 'Clears in the next 90 days', v: money(soonValue), ink: TONE.pos,
            s: `${soon.length} ${soon.length === 1 ? 'loan passes' : 'loans pass'} out of risk` },
        ].map(k => (
          <div key={k.lab} className={card} style={{ ...cardS, padding: '13px 15px 15px' }}>
            <p className="text-[10px] font-bold tracking-[.08em] uppercase m-0 mb-2" style={{ color: TONE.label }}>{k.lab}</p>
            <p className="text-[24px] font-[660] tracking-[-.025em] leading-[1.12] m-0 mb-1.5" style={{ color: k.ink }}>{k.v}</p>
            <p className="text-[11.5px] leading-[1.45] m-0" style={{ color: TONE.label }}>{k.s}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border px-4 py-3 mb-2.5 text-[12.5px] leading-[1.65]"
           style={{ borderColor: '#EBD9BE', background: '#FDF6EC', color: TONE.body }}>
        <b style={{ color: TONE.ink }}>Read these as the worst case, not a forecast.</b> The figure is the
        upfront that was actually paid on the statement, counted in full for as long as the loan sits inside
        its window. Most lenders take all of it back in the first year and only part of it in the second, so
        anything past twelve months is overstated here — the rate library holds the length of each window but
        not what a lender claws in year two, and it is not guessed at. Any referral share already paid out on
        these loans is on top and is not shown. None of it is a loss: it only becomes real if the loan
        discharges or refinances away before its window closes.
      </div>

      {/* When it clears. One series, so the heading is the legend. */}
      <div className={card + ' mb-2.5'} style={cardS}>
        <div className="px-3.5 py-2 border-b text-[10.5px] font-bold tracking-[.08em] uppercase flex gap-2.5 items-center flex-wrap"
             style={{ borderColor: TONE.hair, background: TONE.zebra, color: TONE.label }}>
          Upfront leaving the window
          <span className="font-normal tracking-normal normal-case text-[11.5px]">
            Next 12 months · hover a month for the figure
          </span>
        </div>
        <div className="flex items-end gap-[5px] px-3.5 pt-3.5" style={{ height: 104 }}>
          {runway.map(m => (
            <div key={m.key} className="flex-1 flex flex-col justify-end h-full"
                 title={`${m.count} ${m.count === 1 ? 'loan' : 'loans'} clear in ${m.label} — ${money(m.value)} stops being clawable`}>
              <div style={{
                height: `${Math.max(m.value > 0 ? 3 : 0, (m.value / runwayMax) * 100)}%`,
                background: TONE.accent, borderRadius: '4px 4px 0 0', minHeight: m.value > 0 ? 3 : 0,
              }} />
            </div>
          ))}
        </div>
        <div className="flex gap-[5px] px-3.5 pt-1.5 pb-3">
          {runway.map(m => (
            <div key={m.key} className="flex-1 text-center text-[9.5px]" style={{ color: TONE.label }}>{m.label}</div>
          ))}
        </div>
      </div>

      {/* By lender, worst first. */}
      <div className={card + ' mb-2.5 overflow-x-auto'} style={cardS}>
        <table className="w-full min-w-[640px]">
          <thead><tr>
            {['Lender', 'Window', 'Loans', 'Lent', 'Upfront at risk', 'Last one clears'].map((h, i) => (
              <th key={h} className={th + (i < 2 ? ' text-left' : ' text-right')}
                  style={{ color: TONE.label, borderColor: TONE.hair }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {byLender.map((l, i) => (
              <tr key={l.lender} style={{ background: i % 2 ? TONE.zebra : '#fff' }}>
                <td className="px-3 py-[9px] text-[13px] border-b"
                    style={{ color: TONE.ink, fontWeight: 520, borderColor: TONE.hair }}>{l.lender}</td>
                <td className="px-3 py-[9px] text-[13px] border-b"
                    style={{ color: TONE.body, borderColor: TONE.hair }}>{l.months} months</td>
                <td className={td} style={{ color: TONE.body, borderColor: TONE.hair }}>{l.loans}</td>
                <td className={td} style={{ color: TONE.body, borderColor: TONE.hair }}>{money(l.lent)}</td>
                <td className={td} style={{ color: TONE.neg, fontWeight: 640, borderColor: TONE.hair }}>{money(l.risk)}</td>
                <td className={td} style={{ color: TONE.label, borderColor: TONE.hair }}>
                  {Math.round(l.longest / 30.44)} months
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={card + ' overflow-x-auto'} style={cardS}>
        <table className="w-full min-w-[840px]">
          <thead>
            <tr>
              {['Client', 'Broker', 'Lender', 'Settled', 'Window closes', 'Days left', 'Loan', 'Upfront at risk']
                .map((h, i) => (
                  <th key={h} className={th + (i < 3 ? ' text-left' : ' text-right')}
                      style={{ color: TONE.label, borderColor: TONE.hair }}>{h}</th>
                ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id} style={{ background: i % 2 ? TONE.zebra : '#fff' }}>
                <td className="px-3 py-[9px] text-[13px] border-b"
                    style={{ color: TONE.ink, fontWeight: 520, borderColor: TONE.hair }}>{r.client}</td>
                <td className="px-3 py-[9px] text-[13px] border-b" style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {brokers.find(b => sameBroker(b.key, r.broker_key))?.name.split(' ')[0] || r.broker_key || '—'}
                </td>
                <td className="px-3 py-[9px] text-[13px] border-b" style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {r.lender}
                </td>
                <td className={td} style={{ color: TONE.label, borderColor: TONE.hair }}>{r.settled_on}</td>
                <td className={td} style={{ color: TONE.body, borderColor: TONE.hair }}>{r.ends_on}</td>
                {/* The nearer the window is to closing, the less there is to worry about. */}
                <td className={td} style={{ color: r.days_left <= 90 ? TONE.pos : TONE.body, borderColor: TONE.hair }}>
                  {r.days_left}
                </td>
                <td className={td} style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {r.amount === null ? '—' : money(r.amount)}
                </td>
                <td className={td} style={{ color: TONE.neg, fontWeight: 640, borderColor: TONE.hair }}>
                  {money(r.upfront)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2 flex-wrap">
          <RowLimit shown={shown.length} total={mine.length} limit={limit} onChange={setLimit} />
          <button onClick={exportCsv} disabled={!mine.length}
                  className="text-[11.5px] border rounded-md px-2.5 py-[3px] bg-white disabled:opacity-40 mr-3"
                  style={{ borderColor: TONE.line, color: TONE.label }}>
            Export {mine.length} to Excel
          </button>
        </div>
        <div className="px-3 py-2.5 border-t text-[11.5px]" style={{ borderColor: TONE.hair, color: TONE.label }}>
          Every upfront on the commission statements, grouped by loan account, with loans already clawed back
          left out. The window runs from the settlement date on the statement for as long as the lender's rate
          says. Where a lender claws back only part of it in the second year this overstates the exposure,
          because the rate library holds one clawback period and no taper.
          {unknown.length > 0 && (
            <> {' '}<b style={{ color: TONE.ink }}>{unknown.length}{' '}
            {unknown.length === 1 ? 'loan is' : 'loans are'} not shown</b> — either the lender on the statement is
            not in the rate register, so its window is unknown, or the line carried no settlement date. Unknown,
            not zero.</>
          )}
        </div>
      </div>
    </div>
  )
}
