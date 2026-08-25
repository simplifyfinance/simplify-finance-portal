'use client'
import { Fragment, useMemo, useState } from 'react'
import RowLimit, { STEPS } from '@/components/RowLimit'
import { TONE, money } from '@/lib/tone'
import { COMMISSION_START } from '@/lib/commission-schedule'

// Month by month, with upfront and trail on their own lines. Added together
// the arithmetic looks wrong — July banked more than it grossed — until the
// referrals column is there to explain it. All six columns, so every row
// reconciles on its face.

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const mLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`

type Fig = { gross: number; third: number; net: number; claw: number; ref: number; banked: number }
const ZERO = (): Fig => ({ gross: 0, third: 0, net: 0, claw: 0, ref: 0, banked: 0 })

function fold(f: Fig, s: any): Fig {
  const n = (v: any) => Number(v || 0)
  const gross = n(s.gross_ex_gst), third = Math.abs(n(s.third_party_ex_gst))
  const net = s.net_commission_ex_gst === null || s.net_commission_ex_gst === undefined
    ? gross - third : n(s.net_commission_ex_gst)
  return {
    gross: f.gross + gross, third: f.third + third, net: f.net + net,
    claw: f.claw + n(s.clawback_ex_gst), ref: f.ref + n(s.referrals_ex_gst),
    banked: f.banked + n(s.banked_ex_gst),
  }
}

export default function CommissionByMonth({ statements }: { statements: any[] }) {
  // newest first, a handful at a time — a year of statements is three rows a month
  const [limit, setLimit] = useState<number>(STEPS[0])
  const months = useMemo(() => {
    const by = new Map<string, { upfront: Fig; trail: Fig }>()
    for (const s of statements) {
      const m = String(s.period_month).slice(0, 7)
      if (m < COMMISSION_START) continue
      const cur = by.get(m) || { upfront: ZERO(), trail: ZERO() }
      if (s.kind === 'trail') cur.trail = fold(cur.trail, s)
      else cur.upfront = fold(cur.upfront, s)
      by.set(m, cur)
    }
    return Array.from(by.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [statements])

  if (months.length === 0) return null

  const th = 'px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[.09em] whitespace-nowrap border-b'
  const td = 'px-3 py-[7px] text-[13px] text-right tabular-nums whitespace-nowrap'
  const val = (v: number, colour?: string) => ({
    className: td, style: { color: v === 0 ? TONE.faint : (colour || TONE.ink) },
  })

  const line = (label: string, f: Fig, strong: boolean, bg: string, border?: string) => (
    <tr style={{ background: bg }}>
      <td className={'px-3 py-[7px] text-[13px] whitespace-nowrap' + (border ? ' border-t' : '')}
          style={{ color: strong ? TONE.ink : TONE.body, fontWeight: strong ? 640 : 400, borderColor: TONE.line }}>
        {label}
      </td>
      <td {...val(f.gross)}>{money(f.gross)}</td>
      <td {...val(-f.third, TONE.label)}>{money(-f.third)}</td>
      <td {...val(f.net)}>{money(f.net)}</td>
      <td {...val(f.claw, TONE.neg)}>{money(f.claw)}</td>
      <td {...val(f.ref, TONE.label)}>{money(f.ref)}</td>
      <td className={td} style={{ color: TONE.ink, fontWeight: strong ? 680 : 560 }}>{money(f.banked)}</td>
    </tr>
  )

  return (
    <div className="bg-white border rounded-xl overflow-x-auto mb-6" style={{ borderColor: TONE.line }}>
      <table className="w-full min-w-[760px]">
        <thead>
          <tr>
            {['Month', 'Gross', 'Third parties', 'Net commission', 'Clawback', 'Referrals', 'Banked']
              .map((h, i) => (
                <th key={h} className={th + (i === 0 ? ' text-left' : ' text-right')}
                    style={{ color: TONE.label, borderColor: TONE.hair }}>{h}</th>
              ))}
          </tr>
        </thead>
        <tbody>
          {months.slice(0, limit).map(([m, f]) => {
            const total: Fig = {
              gross: f.upfront.gross + f.trail.gross, third: f.upfront.third + f.trail.third,
              net: f.upfront.net + f.trail.net, claw: f.upfront.claw + f.trail.claw,
              ref: f.upfront.ref + f.trail.ref, banked: f.upfront.banked + f.trail.banked,
            }
            return (
              <Fragment key={m}>
                {line(`${mLabel(m)} upfront`, f.upfront, false, '#fff')}
                {line(`${mLabel(m)} trail`, f.trail, false, '#fff')}
                {line(mLabel(m), total, true, TONE.zebra, 'top')}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      <RowLimit shown={Math.min(limit, months.length)} total={months.length} limit={limit} onChange={setLimit} unit="months" />
      <div className="px-3 py-2.5 border-t text-[11.5px]" style={{ borderColor: TONE.hair, color: TONE.label }}>
        Banked is net commission plus clawback plus referrals. Where banked exceeds gross — July 2025 — referral
        income is the reason, not an error.
      </div>
    </div>
  )
}
