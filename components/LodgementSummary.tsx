'use client'
import { useMemo, useState } from 'react'
import { compactMoney } from '@/lib/money'
import { todayYmd } from '@/lib/periods'
import {
  NOT_SAID, acrossAll, businessesOf, oneBusinessOnly, type Business,
} from '@/lib/which-business'
import {
  busiestCell, gridFor, monthsOfFY, shadeOf, totalRow,
} from '@/lib/the-year-so-far'
import type { Brand } from '@/lib/the-brand-follows-the-broker'
import type { Line2 } from '@/lib/who-brought-us-this'

// THE THREE VIEWS ABOVE THE TABLES.
//
// Fabio, 17 Nov 2026, having looked at five options: the tiles and the year
// grid as drawn, and the LIST instead of the bars. "Five brokers is not a
// dataset."
//
// WHY NOT BARS. A bar at four deals is a stub that means nothing, and a bar
// puts a person and "the business" on one scale, which was never a fair
// comparison. The number reads first here, sorted biggest down, so the order
// IS the ranking and nothing has to be drawn to say so. It also survives
// growth - at twenty brokers a list is still a list, where twenty bars is a
// wall.
//
// A BROKER WITH NOTHING STILL GETS A TILE. Zero is the number you need to
// see. Dropping the empty rows makes a quiet week look like a busy one with
// fewer people in it.
//
// AND IT IS SPLIT BY BUSINESS. Simplify Finance and Simplify Finance Brokers,
// read off the brand ticks in Settings -> Broker profiles. Nothing new is
// stored for it and nothing is guessed - see lib/which-business.ts. Until a
// second brand is set up everybody sits under one heading, which is the right
// answer rather than a broken screen.

type Kind = 'week' | 'month' | 'fy'

const CARD = 'bg-card border border-card-line rounded-xl'
const TAG = 'text-[9.5px] font-bold tracking-[.08em] uppercase text-faint'

export default function LodgementSummary({
  lines, brokerRows, brands, kind, label, now,
}: {
  /** byBroker() for the span on screen. */
  lines: Line2[]
  /** public.brokers, carrying brand_ids. */
  brokerRows?: any[]
  /** settings.brands. */
  brands?: Brand[]
  kind: Kind
  label: string
  now?: string
}) {
  const [open, setOpen] = useState(true)

  const businesses = useMemo(
    () => businessesOf(lines, brokerRows || [], brands || []),
    [lines, brokerRows, brands])
  const all = useMemo(() => acrossAll(businesses), [businesses])
  const alone = oneBusinessOnly(businesses)

  if (!businesses.length) return null

  return (
    <div className="bg-page border border-card-line rounded-2xl px-4 py-3.5 mb-4">
      <div className="flex items-baseline gap-2 mb-2.5">
        <p className={TAG + ' m-0'}>{label}</p>
        <button onClick={() => setOpen(o => !o)}
          className="ml-auto text-[11.5px] font-semibold text-muted hover:text-brand-ink">
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (
        <>
          <Tiles businesses={businesses} all={all} alone={alone} />
          <List businesses={businesses} all={all} alone={alone} />
          {kind === 'fy' && <Year lines={lines} now={now} />}
        </>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- A: tiles */

function Tiles({ businesses, all, alone }: {
  businesses: Business[]; all: ReturnType<typeof acrossAll>; alone: boolean
}) {
  return (
    <>
      <div className="flex gap-2 flex-wrap items-stretch mb-1">
        <Tile dark n={all.lodged} words={alone ? 'lodged' : 'lodged, both businesses'}
          sub={compactMoney(all.lodgedAmount)} />
        <Tile dark soft n={all.settled} words="settled"
          sub={all.settled ? compactMoney(all.settledAmount) : '—'} />
      </div>

      {businesses.map(b => (
        <div key={b.id}>
          {!alone && (
            <p className={TAG + ' mt-3.5 mb-1.5 ml-0.5'}>
              {b.name}
              <span className="ml-2 font-semibold tracking-normal normal-case text-[11px]">
                {b.lodged} · {compactMoney(b.lodgedAmount)}
              </span>
            </p>
          )}
          <div className={`flex gap-2 flex-wrap ${alone ? 'mt-2' : ''}`}>
            {b.brokers.map(x => (
              <Tile key={b.id + x.key} n={x.lodged.length} words={x.name}
                sub={x.lodged.length ? compactMoney(x.lodgedAmount) : '—'} />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function Tile({ n, words, sub, dark, soft }: {
  n: number; words: string; sub: string; dark?: boolean; soft?: boolean
}) {
  const shell = dark
    ? `${soft ? 'bg-[#3B3833] border-[#3B3833]' : 'bg-ink border-ink'} border`
    : CARD
  return (
    <div className={`${shell} rounded-xl px-3.5 py-2.5 min-w-[126px]`}>
      <div className={`text-[24px] font-bold leading-none tabular-nums
        ${dark ? 'text-page' : 'text-ink'}`}>{n}</div>
      <div className={`text-[11.5px] mt-1 ${dark ? 'text-[#B9B4AC]' : 'text-muted'}`}>{words}</div>
      <div className={`text-[11.5px] mt-0.5 tabular-nums
        ${dark ? 'text-[#8E8A83]' : 'text-faint'}`}>{sub}</div>
    </div>
  )
}

/* ----------------------------------------------------------------- B1: list */

function List({ businesses, all, alone }: {
  businesses: Business[]; all: ReturnType<typeof acrossAll>; alone: boolean
}) {
  return (
    <div className="mt-3">
      {businesses.map(b => (
        <div key={b.id} className={CARD + ' mb-2 overflow-hidden'}>
          <div className="flex items-baseline gap-2.5 px-3.5 py-2.5 border-b border-line-soft">
            <span className={`text-[13.5px] font-bold
              ${b.id === NOT_SAID ? 'text-muted' : 'text-ink'}`}>{b.name}</span>
            <span className="text-[11.5px] text-faint">
              {b.brokers.length} {b.brokers.length === 1 ? 'broker' : 'brokers'}
            </span>
            <span className="ml-auto text-[13px] font-bold text-ink tabular-nums">
              {b.lodged} <span className="font-semibold text-muted text-[11.5px]">deals</span>
              {' · '}{compactMoney(b.lodgedAmount)}
            </span>
          </div>
          {b.brokers.map(x => (
            <div key={b.id + x.key}
              className="flex items-baseline gap-2.5 px-3.5 py-2 border-b border-line-soft
                last:border-b-0">
              <span className={`text-[16px] font-bold tabular-nums w-[34px] text-right
                ${x.lodged.length ? 'text-ink' : 'text-faint'}`}>{x.lodged.length}</span>
              <span className="text-[11.5px] text-faint w-[62px]">
                {x.lodged.length === 1 ? 'deal' : 'deals'}
              </span>
              <span className={`text-[12.5px] flex-1
                ${x.lodged.length ? 'text-body' : 'text-faint'}`}>{x.name}</span>
              <span className="text-[12.5px] text-muted tabular-nums w-[78px] text-right">
                {x.lodged.length ? compactMoney(x.lodgedAmount) : '—'}
              </span>
            </div>
          ))}
        </div>
      ))}

      {/* THE TWO ADDED TOGETHER, on its own strip so it never looks like it is
        * competing with a person. */}
      <div className="flex items-baseline gap-2.5 px-3.5 py-2.5 mt-2 bg-ink rounded-xl text-page">
        <span className="text-[17px] font-bold tabular-nums">{all.lodged}</span>
        <span className="text-[12.5px] text-[#B9B4AC] flex-1">
          lodged{alone ? '' : ' across both businesses'}
          {all.settled ? ` · ${all.settled} settled` : ''}
        </span>
        <span className="text-[12.5px] text-[#B9B4AC] tabular-nums">
          {compactMoney(all.lodgedAmount)}
        </span>
      </div>

      {alone && (
        <p className="text-[11px] text-faint m-0 mt-2 leading-[1.5]">
          One business, because one brand is set up. Tick a broker onto a second brand in
          Settings → Broker profiles and a second heading appears here on its own.
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ C: the year */

function Year({ lines, now }: { lines: Line2[]; now?: string }) {
  const months = useMemo(() => monthsOfFY(now || todayYmd()), [now])
  const rows = useMemo(() => gridFor(lines, months), [lines, months])
  const all = useMemo(() => totalRow(rows, months), [rows, months])
  const busiest = useMemo(() => busiestCell(rows), [rows])

  if (!rows.length) return null

  const TH = 'text-[9.5px] font-bold tracking-[.08em] uppercase text-faint text-right px-2.5 py-2 ' +
             'border-b border-line-soft'
  const TD = 'text-[12.5px] text-body px-2.5 py-2 border-b border-line-soft text-right tabular-nums'

  return (
    <div className={CARD + ' mt-3 overflow-x-auto'}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={TH + ' text-left'}>Broker</th>
            {months.map(m => <th key={m.key} className={TH}>{m.label}</th>)}
            <th className={TH}>FY total</th>
            <th className={TH}>$ lodged</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key}>
              <td className={TD + ' text-left font-semibold text-ink'}>{r.name}</td>
              {r.cells.map((c, i) => (
                <td key={months[i].key} className={TD}><Cell n={c} busiest={busiest} /></td>
              ))}
              <td className={TD + ' font-semibold text-ink'}>{r.total}</td>
              <td className={TD}>{compactMoney(r.amount)}</td>
            </tr>
          ))}
          <tr>
            <td className={TD + ' text-left font-bold text-ink border-b-0 border-t border-line'}>
              {all.name}
            </td>
            {all.cells.map((c, i) => (
              <td key={months[i].key}
                className={TD + ' font-bold text-ink border-b-0 border-t border-line'}>
                {c === null ? <span className="text-faint">—</span> : c}
              </td>
            ))}
            <td className={TD + ' font-bold text-ink border-b-0 border-t border-line'}>
              {all.total}
            </td>
            <td className={TD + ' font-bold text-ink border-b-0 border-t border-line'}>
              {compactMoney(all.amount)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ONE COLOUR, GETTING DARKER. Not a rainbow and not red to green - a quiet
// month is not a failure and should not be coloured like one. A month that has
// not happened is a dash, because December is not zero deals, it is December.
const SHADE = [
  'text-faint',
  'bg-info-bg text-brand-ink',
  'bg-[#CFEBFA] text-[#0B5F80]',
  'bg-[#A9DCF4] text-[#07485F]',
]

function Cell({ n, busiest }: { n: number | null; busiest: number }) {
  if (n === null) return <span className="text-faint">—</span>
  return (
    <span className={`inline-block min-w-[26px] px-1.5 py-0.5 rounded-[5px] ${
      SHADE[shadeOf(n, busiest)]}`}>
      {n || '—'}
    </span>
  )
}
