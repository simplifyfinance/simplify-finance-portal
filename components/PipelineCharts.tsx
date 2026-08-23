'use client'
import { useState } from 'react'

// Colours checked with the palette validator: #0E8FCB against #B0567E is 12.1 dE
// apart under red-green colourblindness and 22.4 under normal vision, so the two
// years stay apart for everyone. The three-year average is a dashed neutral line
// because it is a reference, not a thing the business did.
const NOW = '#0E8FCB'
const PREV = '#B0567E'
const QUIET = '#8C8375'
const GRID = '#EDE7DD'
const INK3 = '#A29889'

function money(v: number): string {
  const a = Math.abs(v)
  if (a >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'm'
  if (a >= 1e3) return '$' + Math.round(v / 1e3) + 'k'
  return '$' + Math.round(v)
}
function niceMax(v: number): number {
  if (v <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  return Math.ceil(v / (mag / 2)) * (mag / 2)
}

function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null)
  const on = (text: string) => ({
    onMouseMove: (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, text }),
    onMouseLeave: () => setTip(null),
  })
  const node = tip ? (
    <div className="fixed z-50 pointer-events-none bg-[#343333] text-white text-[11.5px] px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg"
         style={{ left: Math.min(tip.x + 12, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 220), top: tip.y - 34 }}>
      {tip.text}
    </div>
  ) : null
  return { on, node }
}

function Frame({ title, sub, legend, children, table }:
  { title: string; sub: string; legend: React.ReactNode; children: React.ReactNode; table: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-1">
        <div>
          <div className="text-[13px] font-semibold text-[#2E2A26]">{title}</div>
          <div className="text-[11.5px] text-[#A29889]">{sub}</div>
        </div>
        <div className="flex gap-3.5 items-center flex-wrap">{legend}</div>
      </div>
      {children}
      <details className="mt-2">
        <summary className="text-[11.5px] text-[#A29889] cursor-pointer">Show the numbers</summary>
        {table}
      </details>
    </div>
  )
}

function Key({ color, label, dashed }: { color?: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#6E665C]">
      {dashed
        ? <i className="w-4 border-t-2 border-dashed" style={{ borderColor: QUIET }} />
        : <i className="w-[11px] h-[11px] rounded-[3px]" style={{ background: color }} />}
      {label}
    </span>
  )
}

/* ---------- where the selected period sits ---------- */
export function ContextChart({ bars, metric, kind }: {
  bars: { label: string; value: number; avg: number | null; selected: boolean; partial: boolean }[]
  metric: 'lodged' | 'settled'
  kind: string
}) {
  const { on, node } = useTip()
  const W = 700, base = 168, top = 16, xa = 46
  const max = niceMax(Math.max(...bars.map(b => Math.max(b.value, b.avg || 0))))
  const span = (W - xa - 8) / bars.length
  const bw = Math.min(38, span - 10)
  const y = (v: number) => base - (v / max) * (base - top)
  const noun = metric === 'settled' ? 'Settled' : 'Lodged'

  return (
    <Frame
      title={`${noun} volume by ${kind === 'fy' ? 'financial year' : kind}`}
      sub={`${bars[0]?.label} to ${bars[bars.length - 1]?.label} \u00b7 selected in blue`}
      legend={<>
        <Key color={NOW} label="Selected" />
        <Key color={QUIET} label="Earlier" />
        <Key dashed label="3-year average" />
      </>}
      table={
        <table className="w-full text-[12px] mt-2">
          <tbody>
            <tr className="text-[10px] uppercase tracking-wider text-[#A29889]">
              <th className="text-left font-semibold py-1">Period</th>
              <th className="text-right font-semibold py-1">{noun}</th>
              <th className="text-right font-semibold py-1">3-year avg</th>
            </tr>
            {bars.map(b => (
              <tr key={b.label} className="border-t border-[#F2EDE4]">
                <td className="py-1 text-[#6E665C]">{b.label}</td>
                <td className="py-1 text-right">{money(b.value)}</td>
                <td className="py-1 text-right text-[#A29889]">{b.avg === null ? '-' : money(b.avg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }>
      {node}
      <svg viewBox={`0 0 ${W} 200`} className="w-full h-auto" role="img"
           aria-label={`${noun} volume by ${kind}, with the selected period highlighted`}>
        {[0, 1, 2, 3, 4].map(i => {
          const v = max / 4 * i
          return (
            <g key={i}>
              <line x1={xa - 4} y1={y(v)} x2={W} y2={y(v)} stroke={GRID} strokeWidth={1} />
              <text x={xa - 10} y={y(v) + 3.5} textAnchor="end" fontSize={9.5} fill={INK3}>{money(v)}</text>
            </g>
          )
        })}
        {bars.map((b, i) => {
          const h = Math.max(0, base - y(b.value))
          const x = xa + i * span + (span - bw) / 2
          return (
            <g key={b.label}>
              <rect x={x} y={y(b.value)} width={bw} height={h} rx={4}
                    fill={b.selected ? NOW : QUIET} opacity={b.partial && !b.selected ? 0.45 : 1}
                    className="cursor-pointer"
                    {...on(`${b.label} \u2014 ${money(b.value)}${b.partial ? ' (still running)' : ''}`)} />
              <text x={x + bw / 2} y={base + 15} textAnchor="middle" fontSize={9.5}
                    fill={b.selected ? '#2E2A26' : INK3} fontWeight={b.selected ? 650 : 400}>
                {kind === 'month' ? b.label.split(' ')[0] : b.label}
              </text>
              {b.selected && b.value > 0 && (
                <text x={x + bw / 2} y={y(b.value) - 7} textAnchor="middle" fontSize={11} fill={NOW} fontWeight={700}>
                  {money(b.value)}
                </text>
              )}
            </g>
          )
        })}
        <path fill="none" stroke={QUIET} strokeWidth={2} strokeDasharray="5 4" opacity={0.85}
              d={bars.reduce((d, b, i) => b.avg === null ? d
                : d + (d ? ' L' : 'M') + (xa + i * span + span / 2) + ' ' + y(b.avg), '')} />
      </svg>
    </Frame>
  )
}

/* ---------- this financial year against last, cumulative ---------- */
export function FyProgressChart({ now, prev, avg, nowLabel, prevLabel, metric }: {
  now: (number | null)[]; prev: (number | null)[]; avg: (number | null)[]
  nowLabel: string; prevLabel: string; metric: 'lodged' | 'settled'
}) {
  const { on, node } = useTip()
  const MONTHS = ['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun']
  const cume = (a: (number | null)[]) => { let t = 0; return a.map(v => v === null ? null : (t += v)) }
  const cNow = cume(now), cPrev = cume(prev), cAvg = cume(avg)
  const W = 700, base = 186, top = 16, xa = 52
  const max = niceMax(Math.max(...[...cNow, ...cPrev, ...cAvg].map(v => v || 0)))
  const span = (W - xa - 46) / 11
  const y = (v: number) => base - (v / max) * (base - top)
  const noun = metric === 'settled' ? 'settled' : 'lodged'

  const lines = [
    { name: prevLabel, data: cPrev, color: PREV, dash: undefined },
    { name: '3-year average', data: cAvg, color: QUIET, dash: '5 4' },
    { name: nowLabel, data: cNow, color: NOW, dash: undefined },
  ]

  return (
    <Frame
      title={`Cumulative ${noun} volume through the financial year`}
      sub={`${nowLabel} to date against ${prevLabel} and the three-year average`}
      legend={<>
        <Key color={NOW} label={nowLabel} />
        <Key color={PREV} label={prevLabel} />
        <Key dashed label="3-year average" />
      </>}
      table={
        <table className="w-full text-[12px] mt-2">
          <tbody>
            <tr className="text-[10px] uppercase tracking-wider text-[#A29889]">
              <th className="text-left font-semibold py-1">Month</th>
              <th className="text-right font-semibold py-1">{nowLabel}</th>
              <th className="text-right font-semibold py-1">{prevLabel}</th>
            </tr>
            {MONTHS.map((m, i) => (
              <tr key={m} className="border-t border-[#F2EDE4]">
                <td className="py-1 text-[#6E665C]">{m}</td>
                <td className="py-1 text-right">{cNow[i] === null ? '' : money(cNow[i] as number)}</td>
                <td className="py-1 text-right text-[#A29889]">{cPrev[i] === null ? '' : money(cPrev[i] as number)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }>
      {node}
      <svg viewBox={`0 0 ${W} 216`} className="w-full h-auto" role="img"
           aria-label={`Cumulative ${noun} volume, ${nowLabel} against ${prevLabel}`}>
        {[0, 1, 2, 3, 4].map(i => {
          const v = max / 4 * i
          return (
            <g key={i}>
              <line x1={xa - 6} y1={y(v)} x2={W - 20} y2={y(v)} stroke={GRID} strokeWidth={1} />
              <text x={xa - 12} y={y(v) + 3.5} textAnchor="end" fontSize={9.5} fill={INK3}>{money(v)}</text>
            </g>
          )
        })}
        {MONTHS.map((m, i) => (
          <text key={m} x={xa + i * span} y={base + 16} textAnchor="middle" fontSize={9.5} fill={INK3}>{m}</text>
        ))}
        {lines.map(s => {
          const pts = s.data.map((v, i) => v === null ? null : { x: xa + i * span, y: y(v), v, i }).filter(Boolean) as any[]
          if (pts.length === 0) return null
          const last = pts[pts.length - 1]
          return (
            <g key={s.name}>
              <path fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                    strokeDasharray={s.dash} d={pts.reduce((d, p, i) => d + (i ? ' L' : 'M') + p.x + ' ' + p.y, '')} />
              {pts.map(p => (
                <g key={p.i}>
                  <circle cx={p.x} cy={p.y} r={5} fill="#fff" stroke={s.color} strokeWidth={2} />
                  <circle cx={p.x} cy={p.y} r={11} fill="transparent" className="cursor-pointer"
                          {...on(`${s.name} \u2014 ${MONTHS[p.i]} \u2014 ${money(p.v)} cumulative`)} />
                </g>
              ))}
              <text x={last.x + 9} y={last.y + 4} fontSize={10.5} fill={s.color} fontWeight={650}>{s.name}</text>
            </g>
          )
        })}
      </svg>
    </Frame>
  )
}
