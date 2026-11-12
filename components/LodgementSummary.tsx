'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { money } from '@/lib/money'
import { todayYmd } from '@/lib/periods'
import {
  NOT_SAID, acrossAll, businessesOf, type Business,
} from '@/lib/which-business'
import {
  busiestCell, gridFor, monthsOfFY, shadeOf, totalRow,
} from '@/lib/the-year-so-far'
import {
  dayWords, lenderOf, referralInside, referralName, UNANSWERED, type Line2,
} from '@/lib/who-brought-us-this'
import type { Brand } from '@/lib/the-brand-follows-the-broker'

// LODGED, A LINE, THEN SETTLED.
//
// Fabio, 12 Nov 2026, on the first version: "on exp 1 you mixed lodged and
// settlement, don't like that." He was right - one table carried both with a
// column saying which, so a settled deal sat inside a broker's lodged figures
// and the word "Settled" had to be printed on every row to undo it.
//
// Two sections now. Lodged on top because it is the week being run; settled
// underneath because it is the week already banked. Each totals itself: 24
// lodged is not 7 settled plus anything, they are different events, and a
// single strip across both blurred them.
//
// AND THE "WHAT" COLUMN IS GONE with the mixing. The heading says it.
//
// ONE LIST THAT OPENS, NOT TWO LISTS. The summary used to name every broker
// and then the tables below named every broker again with the same count and
// the same dollars. Closed, this is the short report; open, it is the detailed
// one. The broker is named once.
//
// NO TILES. They were a summary of a list three rows long - with one business
// the strip, the heading and the tiles printed the same four facts three
// times. Fabio: "this is ugly, change my mind." I could not.

type Kind = 'week' | 'month' | 'fy'
type Half = 'lodged' | 'settled'

const CARD = 'bg-card border border-card-line rounded-xl overflow-hidden mb-2'
const TH = 'text-[9px] font-bold tracking-[.08em] uppercase text-faint text-left px-4 py-1.5 ' +
           'border-b border-line-soft'
const TD = 'text-[12px] text-body px-4 py-1.5 border-b border-line-soft'

export default function LodgementSummary({
  lines, brokerRows, brands, kind, label, now,
}: {
  lines: Line2[]
  brokerRows?: any[]
  brands?: Brand[]
  kind: Kind
  label: string
  now?: string
}) {
  const businesses = useMemo(
    () => businessesOf(lines, brokerRows || [], brands || []),
    [lines, brokerRows, brands])
  const all = useMemo(() => acrossAll(businesses), [businesses])

  // WHICH BROKER IS OPEN, PER SECTION. Keyed so the same person can be open
  // under Lodged and shut under Settled - they are different questions.
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const toggle = (k: string) => setOpen(o => ({ ...o, [k]: !o[k] }))

  if (!businesses.length) return null

  return (
    <>
      <Half half="lodged" businesses={businesses} all={all}
        label={label} open={open} toggle={toggle} />

      <div className="h-px bg-line my-5" />

      <Half half="settled" businesses={businesses} all={all}
        label={label} open={open} toggle={toggle} />

      {kind === 'fy' && <Year lines={lines} now={now} />}
    </>
  )
}

/* ------------------------------------------------------- one of the two halves */

function Half({ half, businesses, all, label, open, toggle }: {
  half: Half
  businesses: Business[]
  all: ReturnType<typeof acrossAll>
  label: string
  open: Record<string, boolean>
  toggle: (k: string) => void
}) {
  const word = half === 'lodged' ? 'lodged' : 'settled'
  const count = half === 'lodged' ? all.lodged : all.settled
  const amount = half === 'lodged' ? all.lodgedAmount : all.settledAmount

  // A business with nothing in THIS half is not drawn in it. It is still drawn
  // in the other one, which is the whole point of splitting them.
  const shown = businesses.filter(b => (half === 'lodged' ? b.lodged : b.settled) > 0)

  return (
    <section>
      <div className="flex items-baseline gap-2.5 mb-2 ml-0.5">
        <h2 className="text-[14px] font-bold text-ink m-0 tracking-[-.1px]">
          {half === 'lodged' ? 'Lodged' : 'Settled'}
        </h2>
        <span className="text-[11.5px] text-faint">{label}</span>
      </div>

      {shown.length === 0 ? (
        <p className="text-[12.5px] text-faint m-0 mb-1 ml-0.5">
          Nothing {word} in {label.toLowerCase()}.
        </p>
      ) : shown.map(b => (
        <Group key={half + b.id} half={half} b={b} open={open} toggle={toggle} />
      ))}

      {/* THE TOTAL, AND THE ONLY PLACE THE GRAND TOTAL APPEARS.
        *
        * 12 Nov 2026. "6 deals - $3,184,000" was printed three times on one
        * screen: the section heading, the brand heading, and this bar. Fabio:
        * "so you just remove the fucking top. Why are we making this so hard?"
        *
        * He is right and the levels are his: a BRAND adds up its brokers, and
        * this bar adds up the brands. The section heading was a third copy of
        * whichever of those happened to be the whole book, so it is gone.
        *
        * Near-black bar, light blue figures, and it is the SAME in
        * light and dark - Fabio, 12 Nov 2026, having looked at nine versions.
        * It used to wear the ink token, which flips to near-white in dark mode
        * and put a glaring white bar across a charcoal page. Fixed hex on
        * purpose: a total that changes colour with the theme is a total
        * somebody has to check twice. */}
      {shown.length > 0 && (
        <div className="flex items-baseline gap-2.5 px-4 py-2.5 rounded-xl bg-[#17140F]">
          <span className="text-[17px] font-bold tabular-nums text-[#6FD3FF]">{count}</span>
          <span className="text-[12.5px] text-[#A09A91] flex-1">{word}, all brands</span>
          <span className="text-[12.5px] font-semibold tabular-nums text-[#6FD3FF]">
            {money(amount) || '$0'}
          </span>
        </div>
      )}
    </section>
  )
}

/* -------------------------------------------------------- one business, open */

function Group({ half, b, open, toggle }: {
  half: Half; b: Business; open: Record<string, boolean>; toggle: (k: string) => void
}) {
  const count = half === 'lodged' ? b.lodged : b.settled
  const amount = half === 'lodged' ? b.lodgedAmount : b.settledAmount

  // Biggest first in THIS half. businessesOf sorts on lodged, which is the
  // wrong order for the settled section.
  const brokers = [...b.brokers].sort((x, y) =>
    (half === 'lodged' ? y.lodged.length - x.lodged.length : y.settled.length - x.settled.length)
    || x.name.localeCompare(y.name))

  return (
    <div className={CARD}>
      <div className="flex items-baseline gap-2.5 px-4 py-2.5 bg-[#FCFBF9] dark:bg-panel
        border-b border-line-soft">
        <span className={`text-[13px] font-bold ${b.id === NOT_SAID ? 'text-muted' : 'text-ink'}`}>
          {b.name}
        </span>
        <span className="text-[11px] text-faint">
          {b.brokers.length} {b.brokers.length === 1 ? 'broker' : 'brokers'}
        </span>
        <span className="ml-auto text-[12.5px] font-bold text-ink tabular-nums">
          {count} <span className="font-semibold text-muted text-[11px]">
            {half === 'lodged' ? 'lodged' : 'settled'}</span> · {money(amount) || '$0'}
        </span>
      </div>

      {brokers.map(x => {
        const deals = half === 'lodged' ? x.lodged : x.settled
        const sum = half === 'lodged' ? x.lodgedAmount : x.settledAmount
        const key = `${half}:${b.id}:${x.key}`
        const isOpen = !!open[key] && deals.length > 0
        const quiet = deals.length === 0
        return (
          <div key={key}>
            {/* A BROKER WITH NOTHING KEEPS A ROW AT NOUGHT. Dropping them makes
              * a quiet month look like a busy one with fewer people in it. */}
            <button onClick={() => !quiet && toggle(key)} disabled={quiet}
              className={`w-full flex items-center gap-2.5 px-4 py-2 border-b border-line-soft
                text-left ${isOpen ? 'bg-[#FCFBF9] dark:bg-panel' : ''}
                ${quiet ? 'cursor-default' : 'hover:bg-page'}`}>
              <span className="w-[11px] text-[10px] text-faint shrink-0">
                {quiet ? '' : isOpen ? '▾' : '▸'}
              </span>
              <span className={`text-[16px] font-bold tabular-nums w-[28px] text-right
                ${quiet ? 'text-faint' : 'text-ink'}`}>{deals.length}</span>
              <span className={`text-[11.5px] w-[52px] ${quiet ? 'text-faint' : 'text-faint'}`}>
                {half === 'lodged' ? 'lodged' : 'settled'}
              </span>
              <span className={`text-[12.5px] flex-1 ${quiet ? 'text-faint' : 'text-body'}`}>
                {x.name}
              </span>
              <span className={`text-[12.5px] tabular-nums w-[98px] text-right
                ${quiet ? 'text-faint' : 'text-muted'}`}>
                {quiet ? '—' : money(sum) || '—'}
              </span>
            </button>

            {isOpen && <Clients half={half} deals={deals} />}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------- the clients under a broker */

function Clients({ half, deals }: { half: Half; deals: any[] }) {
  // Only THIS half's deals feed the split summary, or the line underneath
  // would count the other section's work.
  const splits = referralInside(
    half === 'lodged' ? { lodged: deals, settled: [] } : { lodged: [], settled: deals })

  return (
    <div className="bg-page border-b border-line-soft">
      <table className="w-full border-collapse">
        <thead><tr>
          <th className={TH}>Client</th>
          <th className={TH}>Lender</th>
          <th className={TH}>{half === 'lodged' ? 'Day' : 'Settled'}</th>
          <th className={TH}>Referral</th>
          <th className={TH + ' text-right'}>Amount</th>
        </tr></thead>
        <tbody>
          {deals.map((d, i) => (
            <tr key={d.id + i}>
              <td className={TD}>
                <Link href={`/deals/${d.id}`}
                  className="font-semibold text-ink hover:text-brand-ink">
                  {d.deal_name || 'Untitled deal'}
                </Link>
              </td>
              <td className={TD}>{lenderOf(d) || '—'}</td>
              <td className={TD + ' text-faint'}>{dayWords(d, half)}</td>
              {/* THE NAME, NOT THE TERMS. Fabio, 12 Nov 2026: "no need for the
                * splits, just add the name of that split." The percentages on
                * a deal are a copy taken when somebody chose it, so a column
                * of them goes stale the day an arrangement is renegotiated and
                * then argues with Settings. The name does not. */}
              <td className={TD + ' text-muted'}>{referralName(d)}</td>
              <td className={TD + ' text-right font-semibold text-ink tabular-nums'}>
                {money((d.settled_total ?? d.lodged_total ?? d.loan_amount) || 0) || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex gap-3.5 flex-wrap px-4 py-2 bg-[#FCFBF9] dark:bg-panel
        border-t border-line-soft text-[11px] text-muted">
        <span className="text-[9px] font-bold tracking-[.08em] uppercase text-faint self-center">
          Referral split
        </span>
        {splits.map(r => (
          <span key={r.key} className={r.key === UNANSWERED ? 'text-faint' : ''}>
            <b className={r.key === UNANSWERED ? '' : 'text-ink'}>{r.name}</b>{' '}
            {r.lodged.length + r.settled.length} ·{' '}
            {money(r.lodgedAmount + r.settledAmount) || '—'}
          </span>
        ))}
      </div>
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

  const H = 'text-[9px] font-bold tracking-[.08em] uppercase text-faint text-right px-2.5 py-2 ' +
            'border-b border-line-soft'
  const C = 'text-[12.5px] text-body px-2.5 py-2 border-b border-line-soft text-right tabular-nums'

  return (
    <div className="bg-card border border-card-line rounded-xl mt-5 overflow-x-auto">
      <p className="text-[9.5px] font-bold tracking-[.09em] uppercase text-faint px-3 pt-3 m-0">
        Lodged, month by month
      </p>
      <table className="w-full border-collapse mt-1">
        <thead>
          <tr>
            <th className={H + ' text-left'}>Broker</th>
            {months.map(m => <th key={m.key} className={H}>{m.label}</th>)}
            <th className={H}>FY total</th>
            <th className={H}>$ lodged</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key}>
              <td className={C + ' text-left font-semibold text-ink'}>{r.name}</td>
              {r.cells.map((c, i) => (
                <td key={months[i].key} className={C}><Cell n={c} busiest={busiest} /></td>
              ))}
              <td className={C + ' font-semibold text-ink'}>{r.total}</td>
              <td className={C}>{money(r.amount) || '—'}</td>
            </tr>
          ))}
          <tr>
            <td className={C + ' text-left font-bold text-ink border-b-0 border-t border-line'}>
              {all.name}
            </td>
            {all.cells.map((c, i) => (
              <td key={months[i].key}
                className={C + ' font-bold text-ink border-b-0 border-t border-line'}>
                {c === null ? <span className="text-faint">—</span> : c}
              </td>
            ))}
            <td className={C + ' font-bold text-ink border-b-0 border-t border-line'}>
              {all.total}
            </td>
            <td className={C + ' font-bold text-ink border-b-0 border-t border-line'}>
              {money(all.amount) || '—'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ONE COLOUR, GETTING DARKER. Not a rainbow and not red to green - a quiet
// month is not a failure and should not be coloured like one.
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
