'use client'
import { useMemo, useState } from 'react'
import { listPeriods, type Period, type PeriodKind } from '@/lib/periods'
import { TONE, money } from '@/lib/tone'

// What a statement contributes, whichever way it is sliced. Every figure is
// ex GST, because that is what the business actually keeps.
type Row = {
  gross: number       // what the lenders paid
  third: number       // paid away to third parties, held positive
  net: number         // the invoice's own commission line
  claw: number        // the invoice's own clawback line, already net of recoveries
  referrals: number
  banked: number      // what SFG says landed in the account
}

const ZERO: Row = { gross: 0, third: 0, net: 0, claw: 0, referrals: 0, banked: 0 }

function add(a: Row, b: Row): Row {
  return {
    gross: a.gross + b.gross, third: a.third + b.third, net: a.net + b.net,
    claw: a.claw + b.claw, referrals: a.referrals + b.referrals, banked: a.banked + b.banked,
  }
}

function rowOf(s: any): Row {
  const n = (v: any) => Number(v || 0)
  const gross = n(s.gross_ex_gst)
  const third = Math.abs(n(s.third_party_ex_gst))
  return {
    gross, third,
    // net_commission_ex_gst only exists on statements parsed by the current
    // importer. Deriving it keeps an older row readable rather than blank.
    net: s.net_commission_ex_gst === null || s.net_commission_ex_gst === undefined
      ? gross - third : n(s.net_commission_ex_gst),
    claw: n(s.clawback_ex_gst),
    referrals: n(s.referrals_ex_gst),
    banked: n(s.banked_ex_gst),
  }
}

export default function CommissionRevenue({
  statements, brokers,
}: {
  statements: any[]
  brokers: { key: string; name: string }[]
}) {
  const [kindFilter, setKindFilter] = useState<'both' | 'upfront' | 'trail'>('both')
  const [scope, setScope] = useState<string>('all')

  // Periods offered are the ones the Pipeline uses, so a month means the same
  // thing on both screens, plus an all-time option because the commission
  // history only starts in July 2025.
  const periods = useMemo(() => {
    const out: { key: string; label: string; range: string; p: Period | null }[] =
      [{ key: 'all', label: 'All time', range: 'every statement loaded', p: null }]
    for (const kind of ['fy', 'quarter', 'month'] as PeriodKind[]) {
      const count = kind === 'fy' ? 3 : kind === 'quarter' ? 4 : 12
      for (const p of listPeriods(kind, count)) out.push({ key: p.key, label: p.label, range: p.range, p })
    }
    return out
  }, [])

  const chosen = periods.find(p => p.key === scope) || periods[0]

  const inScope = useMemo(() => statements.filter(s => {
    if (kindFilter !== 'both' && s.kind !== kindFilter) return false
    if (!chosen.p) return true
    const d = String(s.period_month).slice(0, 10)
    return d >= chosen.p.start && d <= chosen.p.end
  }), [statements, kindFilter, chosen])

  // With no type filter a broker gets a line per type, because upfront and
  // trail behave nothing alike and averaging them hides which one moved.
  const { rows, total } = useMemo(() => {
    const bucket = new Map<string, Row>()
    let total = ZERO
    for (const s of inScope) {
      const bk = String(s.broker_key || '').toLowerCase()
      const id = kindFilter === 'both' ? `${bk}|${s.kind}` : bk
      const r = rowOf(s)
      bucket.set(id, add(bucket.get(id) || ZERO, r))
      total = add(total, r)
    }
    const order = new Map(brokers.map((b, i) => [b.key, i]))
    const rows = Array.from(bucket.entries())
      .map(([id, row]) => {
        const [bk, kind] = id.split('|')
        return { id, name: brokers.find(b => b.key === bk)?.name || bk, kind: kind || '', row, rank: order.get(bk) ?? 99 }
      })
      .sort((a, b) => a.rank - b.rank || a.kind.localeCompare(b.kind))
    return { rows, total }
  }, [inScope, brokers, kindFilter])

  const card = 'bg-white border rounded-xl'
  const cardS = { borderColor: TONE.line }
  const kk = 'text-[9.5px] font-bold tracking-[.1em] uppercase mb-[3px]'
  const th = 'px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[.09em] whitespace-nowrap border-b'
  const td = 'px-3 py-[9px] text-[13px] text-right tabular-nums whitespace-nowrap border-b'

  const tabs: { id: typeof kindFilter; label: string }[] = [
    { id: 'both', label: 'Everything' },
    { id: 'upfront', label: 'Upfront' },
    { id: 'trail', label: 'Trail' },
  ]

  // A zero is decoration, not information — it must not read as loudly as a figure.
  const fig = (v: number, colour?: string) => ({
    className: td + (v === 0 ? ' opacity-55' : ''),
    style: { borderColor: TONE.hair, color: v === 0 ? TONE.faint : (colour || TONE.ink) },
  })

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <div className="inline-flex rounded-lg p-[2px] border"
             style={{ background: TONE.hair, borderColor: TONE.line }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setKindFilter(t.id)}
              className="px-3 py-1 text-[12.5px] rounded-[6px] transition"
              style={kindFilter === t.id
                ? { background: '#fff', color: TONE.ink, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,.07)' }
                : { color: TONE.body }}>
              {t.label}
            </button>
          ))}
        </div>
        <select value={scope} onChange={e => setScope(e.target.value)}
          className="border rounded-lg px-2.5 py-[5px] text-[12.5px] bg-white"
          style={{ borderColor: TONE.line, color: TONE.ink }}>
          {periods.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <span className="text-[12px]" style={{ color: TONE.label }}>{chosen.range}</span>
      </div>

      {inScope.length === 0 ? (
        <div className={card + ' px-4 py-6 text-[13px]'} style={{ ...cardS, color: TONE.label }}>
          Nothing loaded for {chosen.label.toLowerCase()}{kindFilter !== 'both' ? ` on ${kindFilter}` : ''}.
        </div>
      ) : (
        <>
          {/* Five parts, because that is what the sum has. Showing four of them
              made the row look broken and cost an afternoon proving it was not:
              gross less third parties, less clawbacks, plus referrals, is banked. */}
          <div className="grid grid-cols-5 gap-[11px] mb-3.5 max-[1100px]:grid-cols-3 max-[720px]:grid-cols-2">
            {[
              { k: 'Gross', v: total.gross, s: 'what the lenders paid', c: TONE.ink },
              { k: 'To third parties', v: -total.third, s: 'referral and split arrangements', c: TONE.ink },
              { k: 'Clawbacks', v: total.claw, s: 'net of what came back', c: TONE.ink },
              { k: 'Referrals', v: total.referrals, s: 'paid to us on others\u2019 loans', c: TONE.ink },
              { k: 'Banked', v: total.banked, s: 'actually received, ex GST', c: TONE.pos },
            ].map(t => (
              <div key={t.k} className={card + ' px-[15px] py-[13px]'} style={cardS}>
                <div className={kk} style={{ color: TONE.label }}>{t.k}</div>
                <div className="text-[27px] font-[640] tracking-[-.02em] leading-[1.15]" style={{ color: t.c }}>
                  {money(t.v)}
                </div>
                <div className="text-[11.5px] mt-[1px]" style={{ color: TONE.label }}>{t.s}</div>
              </div>
            ))}
          </div>

          <div className={card + ' overflow-x-auto'} style={cardS}>
            <table className="w-full min-w-[760px]">
              <thead>
                <tr>
                  {['Broker', 'Gross', 'Third parties', 'Net commission', 'Clawback', 'Referrals', 'Banked', 'Share']
                    .map((h, i) => (
                      <th key={h} className={th + (i === 0 ? ' text-left' : ' text-right')}
                          style={{ color: TONE.label, borderColor: TONE.hair }}>{h}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 ? TONE.zebra : '#fff' }}>
                    <td className="px-3 py-[9px] text-[13px] whitespace-nowrap border-b"
                        style={{ color: TONE.ink, fontWeight: 520, borderColor: TONE.hair }}>
                      {r.name}{r.kind && <span className="ml-1.5" style={{ color: TONE.faint }}>{r.kind}</span>}
                    </td>
                    <td {...fig(r.row.gross)}>{money(r.row.gross)}</td>
                    <td {...fig(-r.row.third, TONE.label)}>{money(-r.row.third)}</td>
                    <td {...fig(r.row.net)}>{money(r.row.net)}</td>
                    <td {...fig(r.row.claw, TONE.neg)}>{money(r.row.claw)}</td>
                    <td {...fig(r.row.referrals, TONE.label)}>{money(r.row.referrals)}</td>
                    <td className={td + ' font-[680]'} style={{ color: TONE.ink, borderColor: TONE.hair }}>
                      {money(r.row.banked)}
                    </td>
                    <td className={td} style={{ color: TONE.label, borderColor: TONE.hair }}>
                      {total.banked ? Math.round((r.row.banked / total.banked) * 100) + '%' : '—'}
                    </td>
                  </tr>
                ))}
                {rows.length > 1 && (
                  <tr style={{ background: TONE.hair }}>
                    <td className="px-3 py-[9px] text-[13px] font-[640] border-t"
                        style={{ color: TONE.ink, borderColor: TONE.line }}>Business</td>
                    {[total.gross, -total.third, total.net, total.claw, total.referrals, total.banked].map((v, i) => (
                      <td key={i} className={td + ' font-[640] border-b-0 border-t'}
                          style={{ color: TONE.ink, borderColor: TONE.line }}>{money(v)}</td>
                    ))}
                    <td className={td + ' font-[640] border-b-0 border-t'}
                        style={{ color: TONE.ink, borderColor: TONE.line }}>100%</td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="px-3 py-2.5 border-t text-[11.5px]"
                 style={{ borderColor: TONE.hair, color: TONE.label }}>
              Net commission is gross less what was paid away. Banked is net plus clawback plus referrals — the
              same arithmetic the SFG invoice does, so every row ties back to a statement line for line.
            </div>
          </div>
        </>
      )}
    </div>
  )
}
