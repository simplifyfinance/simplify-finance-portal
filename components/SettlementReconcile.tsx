'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { TONE, money } from '@/lib/tone'
import { sameBroker, brokerKey as normKey } from '@/lib/broker-key'
import { calcCommission, lvrOf, type CommissionRate } from '@/lib/commission'
import { todayYmd } from '@/lib/periods'
import { COMMISSION_START, isIssued, stepMonth } from '@/lib/commission-schedule'
import { reconcile, type PortalDeal, type PaidLine } from '@/lib/settlement-match'
import { downloadCsv, stamp } from '@/lib/csv'
import RowLimit, { STEPS } from '@/components/RowLimit'

// What the portal says settled, against what SFG actually paid.
//
// Two lists, and they answer different questions:
//
//   Never paid  — the portal has a settled deal and no upfront ever arrived for
//                 it. Money possibly owed, and the reason this screen exists.
//   No deal     — SFG paid an upfront for a loan the portal has never heard of.
//                 Usually a deal that predates the portal, sometimes one nobody
//                 entered. Not money missing, but it shows where the records
//                 have holes.
//
// A deal is only asked about once its upfront was actually due: settlement
// month plus one, paid on the 26th. Anything more recent is not late, it is
// simply not paid yet.

export default function SettlementReconcile({ brokers }: {
  brokers: { key: string; name: string; from: string }[]
}) {
  const supabase = createSupabaseBrowser()
  const [deals, setDeals] = useState<PortalDeal[]>([])
  const [lines, setLines] = useState<PaidLine[]>([])
  const [tab, setTab] = useState<'unpaid' | 'nodeal'>('unpaid')
  const [who, setWho] = useState('all')
  const [limit, setLimit] = useState<number>(STEPS[0])
  const [ready, setReady] = useState(false)
  // Settled deals whose upfront statement has not been loaded, so nothing can
  // be said about them either way.
  const [unchecked, setUnchecked] = useState(0)

  useEffect(() => {
    (async () => {
      const today = todayYmd()
      const [d, r, l, c, st] = await Promise.all([
        supabase.from('deals').select('*').not('settled_at', 'is', null),
        supabase.from('commission_rates').select('*'),
        supabase.from('lenders').select('id, name'),
        supabase.from('commission_lines').select('*').eq('kind', 'upfront').limit(5000),
        supabase.from('commission_statements').select('broker_key, kind, period_month').eq('kind', 'upfront'),
      ])
      // Which upfront statements we actually hold. Without the statement that
      // would have carried a deal's upfront, we cannot say it was never paid —
      // only that we have not looked. An empty statement still counts: it was
      // loaded, and it said nothing was paid.
      const haveStatement = new Set(((st.data || []) as any[]).map(
        x => `${normKey(x.broker_key)}|${String(x.period_month).slice(0, 7)}`))
      const rateBy = new Map<string, CommissionRate>()
      for (const x of (r.data || []) as any[]) rateBy.set(String(x.lender_id), x)
      const nameBy = new Map<string, string>()
      for (const x of (l.data || []) as any[]) nameBy.set(String(x.id), x.name)

      const pd: PortalDeal[] = []
      let blind = 0
      for (const deal of (d.data || []) as any[]) {
        const settledOn = String(deal.settled_at || '').slice(0, 10)
        const month = settledOn.slice(0, 7)
        if (!month || month < COMMISSION_START) continue        // before the records start
        if (!isIssued('upfront', month, today)) continue        // not due yet, so not missing

        const bKey = String(deal.assigned_broker || deal.broker_key || '')
        const from = brokers.find(b => sameBroker(b.key, bKey))?.from || ''
        if (from && month < from) continue                      // earned elsewhere at the time

        // The upfront for a settlement in month M lands on the statement for
        // M+1. Without that statement loaded we have not looked, so the deal
        // cannot be called unpaid — it is counted as unknown instead.
        if (!haveStatement.has(`${normKey(bKey)}|${stepMonth(month, 1)}`)) { blind += 1; continue }

        const rate = rateBy.get(String(deal.lender_id)) || null
        const amount = deal.settled_total ?? deal.lodged_total ?? deal.loan_amount ?? null
        const comm = calcCommission({ amount, rate, lvr: lvrOf(deal), settledOn })
        pd.push({
          id: String(deal.id),
          client: deal.client_name || deal.name || '',
          brokerKey: bKey,
          lenderId: deal.lender_id ? String(deal.lender_id) : null,
          lender: nameBy.get(String(deal.lender_id)) || '—',
          settledOn,
          amount,
          expectedUpfront: comm.ok ? comm.upfront : null,
          expectedReason: comm.ok ? null : comm.reason,
        })
      }

      const pl: PaidLine[] = ((c.data || []) as any[]).map(x => ({
        id: String(x.id),
        client: x.client_name || '',
        brokerKey: String(x.broker_key || ''),
        lenderId: x.lender_id ? String(x.lender_id) : null,
        lender: x.lender_raw || nameBy.get(String(x.lender_id)) || '—',
        loanRef: x.loan_ref || '',
        settlementDate: x.settlement_date ? String(x.settlement_date).slice(0, 10) : null,
        settlementAmount: x.settlement_amount ?? null,
        paidExGst: Number(x.gross_ex_gst || 0),
        periodMonth: String(x.period_month || '').slice(0, 7),
      }))

      setDeals(pd)
      setLines(pl)
      setUnchecked(blind)
      setReady(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brokers.length])

  const result = useMemo(() => reconcile(deals, lines), [deals, lines])

  const unpaid = useMemo(() => (who === 'all'
    ? result.unpaidDeals
    : result.unpaidDeals.filter(d => sameBroker(d.brokerKey, who))
  ).sort((a, b) => (b.expectedUpfront || 0) - (a.expectedUpfront || 0)), [result, who])

  const nodeal = useMemo(() => (who === 'all'
    ? result.unmatchedLines
    : result.unmatchedLines.filter(l => sameBroker(l.brokerKey, who))
  ).sort((a, b) => b.paidExGst - a.paidExGst), [result, who])

  useEffect(() => setLimit(STEPS[0]), [tab, who])

  const owed = unpaid.reduce((t, d) => t + (d.expectedUpfront || 0), 0)
  const unknownCount = unpaid.filter(d => d.expectedUpfront === null).length
  const paidOut = nodeal.reduce((t, l) => t + l.paidExGst, 0)
  const total = tab === 'unpaid' ? unpaid.length : nodeal.length
  const shownUnpaid = unpaid.slice(0, limit)
  const shownNodeal = nodeal.slice(0, limit)

  function exportCsv() {
    const name = who === 'all' ? 'all-brokers' : who
    if (tab === 'unpaid') {
      downloadCsv(`settled-never-paid-${name}-${stamp()}`,
        ['Client', 'Broker', 'Lender', 'Settled', 'Loan amount', 'Upfront expected', 'Why not known'],
        unpaid.map(d => [
          d.client,
          brokers.find(b => sameBroker(d.brokerKey, b.key))?.name || d.brokerKey,
          d.lender, d.settledOn, d.amount ?? '',
          d.expectedUpfront === null ? '' : d.expectedUpfront.toFixed(2),
          d.expectedReason || '',
        ]))
    } else {
      downloadCsv(`paid-with-no-deal-${name}-${stamp()}`,
        ['Client', 'Broker', 'Lender', 'Loan reference', 'Settled', 'Settlement amount', 'Upfront paid', 'Statement'],
        nodeal.map(l => [
          l.client,
          brokers.find(b => sameBroker(l.brokerKey, b.key))?.name || l.brokerKey,
          l.lender, l.loanRef, l.settlementDate || '', l.settlementAmount ?? '',
          l.paidExGst.toFixed(2), l.periodMonth,
        ]))
    }
  }

  if (!ready || (deals.length === 0 && lines.length === 0)) return null

  const card = 'bg-white border rounded-xl'
  const cardS = { borderColor: TONE.line }
  const th = 'px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[.09em] whitespace-nowrap border-b'
  const td = 'px-3 py-[9px] text-[13px] text-right tabular-nums whitespace-nowrap border-b'

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
        <div className="inline-flex rounded-lg p-[2px] border" style={{ background: TONE.hair, borderColor: TONE.line }}>
          {([['unpaid', `Settled, never paid (${unpaid.length})`],
             ['nodeal', `Paid, no deal (${nodeal.length})`]] as const).map(([id, lab]) => (
            <button key={id} onClick={() => setTab(id)}
              className="px-3 py-1 text-[12.5px] rounded-[6px]"
              style={tab === id
                ? { background: '#fff', color: TONE.ink, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,.07)' }
                : { color: TONE.body }}>{lab}</button>
          ))}
        </div>
        <select value={who} onChange={e => setWho(e.target.value)}
          className="border rounded-lg px-2.5 py-[5px] text-[12.5px] bg-white"
          style={{ borderColor: TONE.line, color: TONE.ink }}>
          <option value="all">Whole business</option>
          {brokers.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
        </select>
        <span className="text-[12px]" style={{ color: TONE.label }}>
          {tab === 'unpaid'
            ? <>The portal says these settled and no upfront ever arrived.{' '}
                <b style={{ color: TONE.ink }}>{money(owed)}</b> expected
                {unknownCount > 0 && <>, plus {unknownCount} where the rate is unknown</>}.</>
            : <>SFG paid these and the portal has no matching deal.{' '}
                <b style={{ color: TONE.ink }}>{money(paidOut)}</b> received.</>}
        </span>
      </div>

      <div className={card + ' overflow-x-auto'} style={cardS}>
        <table className="w-full min-w-[860px]">
          <thead>
            <tr>
              {(tab === 'unpaid'
                ? ['Client', 'Broker', 'Lender', 'Settled', 'Loan', 'Upfront expected']
                : ['Client', 'Broker', 'Lender', 'Loan reference', 'Settled', 'Upfront paid', 'Statement']
              ).map((h, i) => (
                <th key={h} className={th + (i < 4 ? ' text-left' : ' text-right')}
                    style={{ color: TONE.label, borderColor: TONE.hair }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {total === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-[13px]" style={{ color: TONE.label }}>
                Nothing here{who === 'all' ? '' : ' for this broker'}. Everything lines up.
              </td></tr>
            )}
            {tab === 'unpaid' && shownUnpaid.map((d, i) => (
              <tr key={d.id} style={{ background: i % 2 ? TONE.zebra : '#fff' }}>
                <td className="px-3 py-[9px] text-[13px] border-b"
                    style={{ color: TONE.ink, fontWeight: 520, borderColor: TONE.hair }}>{d.client || '—'}</td>
                <td className="px-3 py-[9px] text-[13px] border-b" style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {brokers.find(b => sameBroker(b.key, d.brokerKey))?.name.split(' ')[0] || d.brokerKey || '—'}
                </td>
                <td className="px-3 py-[9px] text-[13px] border-b" style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {d.lender}
                </td>
                <td className={td} style={{ color: TONE.label, borderColor: TONE.hair }}>{d.settledOn}</td>
                <td className={td} style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {d.amount === null ? '—' : money(d.amount)}
                </td>
                <td className={td} style={{ color: TONE.neg, fontWeight: 640, borderColor: TONE.hair }}
                    title={d.expectedReason || ''}>
                  {d.expectedUpfront === null ? 'not known' : money(d.expectedUpfront)}
                </td>
              </tr>
            ))}
            {tab === 'nodeal' && shownNodeal.map((l, i) => (
              <tr key={l.id} style={{ background: i % 2 ? TONE.zebra : '#fff' }}>
                <td className="px-3 py-[9px] text-[13px] border-b"
                    style={{ color: TONE.ink, fontWeight: 520, borderColor: TONE.hair }}>{l.client || '—'}</td>
                <td className="px-3 py-[9px] text-[13px] border-b" style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {brokers.find(b => sameBroker(b.key, l.brokerKey))?.name.split(' ')[0] || l.brokerKey || '—'}
                </td>
                <td className="px-3 py-[9px] text-[13px] border-b" style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {l.lender}
                </td>
                <td className="px-3 py-[9px] text-[13px] border-b" style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {l.loanRef || '—'}
                </td>
                <td className={td} style={{ color: TONE.label, borderColor: TONE.hair }}>{l.settlementDate || '—'}</td>
                <td className={td} style={{ color: TONE.pos, fontWeight: 640, borderColor: TONE.hair }}>
                  {money(l.paidExGst)}
                </td>
                <td className={td} style={{ color: TONE.label, borderColor: TONE.hair }}>{l.periodMonth}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2 flex-wrap">
          <RowLimit shown={tab === 'unpaid' ? shownUnpaid.length : shownNodeal.length}
                    total={total} limit={limit} onChange={setLimit} />
          <button onClick={exportCsv} disabled={!total}
                  className="text-[11.5px] border rounded-md px-2.5 py-[3px] bg-white disabled:opacity-40 mr-3"
                  style={{ borderColor: TONE.line, color: TONE.label }}>
            Export {total} to Excel
          </button>
        </div>
        <div className="px-3 py-2.5 border-t text-[11.5px]" style={{ borderColor: TONE.hair, color: TONE.label }}>
          {unchecked > 0 && (
            <><b style={{ color: TONE.ink }}>{unchecked} settled {unchecked === 1 ? 'deal is' : 'deals are'} not
            checked</b> — the upfront statement that would have carried them has not been loaded, so nothing can be
            said either way. Load it and they will appear here or disappear.{' '}</>
          )}
          The two sides share no reference number, so deals and payments are paired on the client&rsquo;s name and
          the lender, with the settlement amount as a second opinion. Pairing is deliberately generous: a wrong
          pair would hide money, a missed pair only shows up as a row worth checking. A deal is not asked about
          until its upfront was actually due, on the 26th of the month after settlement.
        </div>
      </div>
    </div>
  )
}
