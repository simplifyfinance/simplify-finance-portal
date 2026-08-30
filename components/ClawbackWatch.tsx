'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { TONE, money } from '@/lib/tone'
import { sameBroker } from '@/lib/broker-key'
import { calcCommission, lvrOf, type CommissionRate } from '@/lib/commission'
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
// The figure is the whole upfront. Some lenders taper — full in the first year,
// half in the second — but the rate library holds a single clawback_months and
// no taper, so a tapered lender is overstated here. Said plainly under the
// table rather than quietly assumed away.

type Row = {
  id: string; client: string; broker_key: string; lender: string
  settled_on: string; ends_on: string; days_left: number
  amount: number | null; upfront: number
}

const DAY = 86400000
function daysBetween(a: string, b: string): number {
  const x = Date.parse(a + 'T00:00:00Z'), y = Date.parse(b + 'T00:00:00Z')
  if (isNaN(x) || isNaN(y)) return 0
  return Math.round((y - x) / DAY)
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
      const [d, r, l] = await Promise.all([
        supabase.from('deals').select('*').not('settled_at', 'is', null),
        supabase.from('commission_rates').select('*'),
        supabase.from('lenders').select('id, name'),
      ])
      const rateBy = new Map<string, CommissionRate>()
      for (const x of (r.data || []) as any[]) rateBy.set(String(x.lender_id), x)
      const nameBy = new Map<string, string>()
      for (const x of (l.data || []) as any[]) nameBy.set(String(x.id), x.name)

      const today = todayYmd()
      const live: Row[] = []
      const cannotTell: { client: string; lender: string; reason: string }[] = []

      for (const deal of (d.data || []) as any[]) {
        const settledOn = String(deal.settled_at || '').slice(0, 10)
        if (!settledOn) continue
        const lender = nameBy.get(String(deal.lender_id)) || '—'
        const rate = rateBy.get(String(deal.lender_id)) || null
        const amount = deal.settled_total ?? deal.lodged_total ?? deal.loan_amount ?? null
        const c = calcCommission({ amount, rate, lvr: lvrOf(deal), settledOn })

        // No clawback window means nothing to watch, not a problem to report.
        if (!c.clawbackEndsOn) {
          if (!c.ok && rate?.clawback_months) {
            cannotTell.push({
              client: deal.client_name || deal.name || 'Client not named',
              lender,
              reason: c.reason || 'The commission could not be worked out.',
            })
          }
          continue
        }
        if (today > c.clawbackEndsOn) continue          // window already closed

        live.push({
          id: String(deal.id),
          client: deal.client_name || deal.name || 'Client not named',
          broker_key: String(deal.assigned_broker || deal.broker_key || ''),
          lender,
          settled_on: settledOn,
          ends_on: c.clawbackEndsOn,
          days_left: daysBetween(today, c.clawbackEndsOn),
          amount,
          upfront: Number(c.upfront || 0),
        })
      }

      live.sort((a, b) => a.days_left - b.days_left)
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

  useEffect(() => setLimit(STEPS[0]), [who])

  function exportCsv() {
    downloadCsv(
      `clawback-window-${who === 'all' ? 'all-brokers' : who}-${stamp()}`,
      ['Client', 'Broker', 'Lender', 'Settled', 'Window closes', 'Days left', 'Loan amount', 'Upfront at risk'],
      mine.map(r => [
        r.client,
        brokers.find(b => sameBroker(r.broker_key, b.key))?.name || r.broker_key,
        r.lender, r.settled_on, r.ends_on, r.days_left,
        r.amount ?? '', r.upfront.toFixed(2),
      ]))
  }

  if (!ready || rows.length === 0) return null

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
        <span className="text-[12px]" style={{ color: TONE.label }}>
          <b style={{ color: TONE.ink }}>{money(atRisk)}</b> of upfront across {mine.length}{' '}
          {mine.length === 1 ? 'loan' : 'loans'} would come back if they discharged today.
          {soon.length > 0 && <> {money(soonValue)} of it clears within 90 days.</>}
        </span>
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
          Counted from the settlement date and the clawback months on the lender's rate. The figure is the whole
          upfront: where a lender claws back only part of it in the second year, this overstates the exposure,
          because the rate library holds one clawback period and no taper.
          {unknown.length > 0 && (
            <> {' '}<b style={{ color: TONE.ink }}>{unknown.length}{' '}
            {unknown.length === 1 ? 'loan is' : 'loans are'} not shown</b> — the lender has a clawback period but
            the commission itself could not be worked out, so the amount at risk is unknown rather than zero.</>
          )}
        </div>
      </div>
    </div>
  )
}
