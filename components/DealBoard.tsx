'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { phaseOf, phaseSince, amountOf, PHASE_LABEL, PHASE_ORDER, type Phase } from '@/lib/deal-phase'
import { stageAge, ageGroupOf } from '@/lib/deal-age'
import { chipsFor, brokerColour, chipStyle, dealTitle } from '@/lib/deal-labels'
import { CREDIT_GREY, type ThresholdMap } from '@/lib/board-settings'
import DealPeek from '@/components/DealPeek'
import { brokerKey as keyOf } from '@/lib/broker-key'

// The whole book, in columns.
//
// The board is a VIEW of the truth, never a second way of writing it. Every card
// sits in the column lib/deal-phase.ts puts it in, so the board and the list can
// never tell different stories. Dragging a card does exactly what the button on
// the deal does — where a step needs data (a lodgement needs its lender and
// splits, or the commission history is destroyed) the drag opens that panel
// rather than writing a half-record.

const COLUMNS: Phase[] = ['fact_find', 'bc', 'lo', 'compliance', 'compliance_sent', 'lodged', 'preapproved', 'formal', 'settled']

const money = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'm'
  if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'k'
  return '$' + Math.round(n)
}

const initials = (n: string) => String(n || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
const brokerNameOf = (d: any, nameFor: (k: string) => string) => {
  const k = keyOf(d.assigned_broker) || ''
  return k ? (nameFor(k) || k) : ''
}

const AGE_STYLE: Record<string, string> = {
  nudge: 'text-[#AD4227] bg-[#FBEDE9] border-[#EFD3CB]',
  long:  'text-[#946017] bg-[#FDF6EC] border-[#EBD9BE]',
}

export default function DealBoard({ deals, nameFor, colours, thresholds }: {
  deals: any[]
  nameFor: (k: string) => string
  colours?: { type?: any; use?: any; broker?: Record<string, string> }
  // Set in Settings -> Deal board. Undefined falls through to the defaults in
  // lib/deal-age.ts, which is what the board used before there was a screen for
  // it - so an unmigrated portal looks exactly the same.
  thresholds?: ThresholdMap
}) {
  const router = useRouter()
  const [dragging, setDragging] = useState<string>('')
  const [over, setOver] = useState<Phase | ''>('')
  const [msg, setMsg] = useState('')
  // Which card is being looked at, and which column it sits in — so the arrow
  // keys can walk along that column without closing.
  const [peeking, setPeeking] = useState<{ id: string; phase: Phase } | null>(null)

  const byColumn = useMemo(() => {
    const m: Record<string, any[]> = {}
    for (const p of COLUMNS) m[p] = []
    for (const d of deals) {
      const p = phaseOf(d)
      if (p === 'lost') continue          // dead deals are not on the board
      if (m[p]) m[p].push(d)
    }
    // Oldest first inside a column: the top of a column is the thing to do first.
    for (const p of COLUMNS) {
      m[p].sort((a, b) => String(phaseSince(a) || '').localeCompare(String(phaseSince(b) || '')))
    }
    return m
  }, [deals])

  function onDrop(target: Phase) {
    setOver('')
    const deal = deals.find(d => d.id === dragging)
    setDragging('')
    if (!deal) return
    const from = phaseOf(deal)
    if (from === target) return

    const fi = COLUMNS.indexOf(from), ti = COLUMNS.indexOf(target)
    if (ti < fi) {
      setMsg(`A deal does not go backwards on the board. ${PHASE_LABEL[target]} already happened on ${deal.deal_name} — undo it on the deal itself if it was recorded wrongly.`)
      return
    }
    if (target === 'compliance_sent') {
      setMsg('Compliance sent is set by sending the compliance pack, not by dragging. Open the deal and push to SalesTrekker.')
      return
    }
    // Every remaining step writes a snapshot of the loan as it stood - lender,
    // total, and every split. Dragging cannot invent those, so it opens the panel
    // that asks for them. This is the button, reached a different way.
    setMsg('')
    router.push(`/deals/${deal.id}?stage=Compliance#settlement`)
  }

  return (
    <div>
      {msg && (
        <div className="mb-3 text-[12.5px] rounded-lg border border-[#EBD9BE] bg-[#FDF6EC] text-[#575046] px-3 py-2">
          {msg} <button onClick={() => setMsg('')} className="underline text-[#946017] ml-1">Dismiss</button>
        </div>
      )}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-2.5" style={{ minWidth: 2280 }}>
          {COLUMNS.map(p => {
            const cards = byColumn[p] || []
            const total = cards.reduce((t, d) => t + (amountOf(d) || 0), 0)
            const hot = cards.filter(d => ageGroupOf(d, thresholds) === 'nudge').length
            return (
              <div key={p}
                onDragOver={e => { e.preventDefault(); setOver(p) }}
                onDragLeave={() => setOver(o => o === p ? '' : o)}
                onDrop={() => onDrop(p)}
                className={`flex-1 min-w-[248px] rounded-xl border p-2.5 transition ${
                  over === p ? 'border-[#0E8FCB] bg-[#EAF6FD]'
                  : hot > 0 ? 'border-[#EFD3CB] bg-[#FBEDE9]'
                  : 'border-[#EFEAE0] bg-[#FCFAF6]'}`}>
                <div className="flex items-baseline gap-1.5 mb-2 px-0.5">
                  <span className={`text-[10.5px] font-bold tracking-[.06em] uppercase ${hot > 0 ? 'text-[#AD4227]' : 'text-[#7A7266]'}`}>
                    {PHASE_LABEL[p]}
                  </span>
                  <span className="ml-auto text-[11px] font-bold text-[#575046] bg-white border border-[#E5DED2] rounded-full px-1.5">
                    {cards.length}
                  </span>
                </div>
                {/* The column's own money. "How much is sitting here" is the
                    question a board is asked from across the room. */}
                <div className="text-[11px] text-[#7A7266] mb-2 px-0.5 tabular-nums">
                  {total > 0 ? money(total) : '—'}
                </div>

                {cards.map(d => {
                  const age = stageAge(d, thresholds)
                  const grp = ageGroupOf(d, thresholds)
                  const bKey = keyOf(d.assigned_broker) || ''
                  const amt = amountOf(d)
                  const lender = d.lenders?.name || ''
                  // Whichever date matters at this stage: when it is due to settle
                  // once that is known, otherwise how long it has sat here.
                  const settleOn = d.settled_at || d.confirmed_settlement_date || d.expected_settlement_date
                  const when = settleOn
                    ? new Date(settleOn).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
                    : age.label
                  const people = [
                    { name: brokerNameOf(d, nameFor), colour: brokerColour(bKey, colours?.broker) },
                    ...(d.credit_officers?.name ? [{ name: d.credit_officers.name, colour: CREDIT_GREY }] : []),
                  ].filter(x => x.name)
                  return (
                    <div key={d.id} draggable
                      onDragStart={() => setDragging(d.id)}
                      onDragEnd={() => { setDragging(''); setOver('') }}
                      onClick={() => router.push(`/deals/${d.id}`)}
                      className={`relative bg-white border rounded-[10px] px-2.5 pt-2.5 pb-2.5 mb-2 cursor-pointer transition hover:border-[#D6CCBC] ${
                        dragging === d.id ? 'opacity-40 border-[#0E8FCB]' : 'border-[#E5DED2]'}`}>

                      {/* A look before committing to opening it. */}
                      <button title="Quick look"
                        onClick={e => { e.stopPropagation(); setPeeking({ id: d.id, phase: p }) }}
                        className="absolute top-[7px] right-2 w-[22px] h-[22px] rounded-md border border-[#E5DED2] bg-white text-[#7A7266] flex items-center justify-center hover:border-[#0E8FCB] hover:text-[#0E8FCB] hover:bg-[#EAF6FD]">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="7" cy="15" r="4" /><circle cx="17" cy="15" r="4" />
                          <path d="M11 15h2M6 11V5h3v6M15 11V5h3v6" />
                        </svg>
                      </button>

                      {/* One line, ellipsis, full name on hover — the same shape a
                          long client name gets anywhere else. */}
                      <p className="text-[12.5px] font-[640] text-[#221F1B] m-0 mr-[22px] truncate" title={d.deal_name}>
                        {dealTitle(d.deal_name)}
                      </p>
                      <p className="text-[9.5px] font-bold tracking-[.07em] uppercase text-[#A29889] m-0 mb-[7px]">
                        Home loan{lender ? ` · ${lender}` : ''}
                      </p>

                      {/* The money is the biggest thing on a card about a loan book. */}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {amt !== null
                          ? <span className="text-[14px] font-[680] text-[#221F1B] tabular-nums tracking-[-.01em]">{money(amt)}</span>
                          : <span className="text-[11.5px] text-[#C3BDB2]">No amount recorded</span>}
                        <span className="ml-auto text-[11px] text-[#7A7266] tabular-nums">{when}</span>
                      </div>

                      <div className="flex gap-1 flex-wrap items-center">
                        {chipsFor(d, colours).map(c => (
                          <span key={c.id} className="text-[9px] font-bold tracking-[.04em] uppercase rounded px-1.5 py-[2px] border whitespace-nowrap"
                                style={chipStyle(c.colour)}>{c.label}</span>
                        ))}
                        {age.days !== null && (
                          <span className={`text-[9px] font-bold tracking-[.04em] uppercase rounded px-1.5 py-[2px] border whitespace-nowrap ${
                            AGE_STYLE[grp] || 'text-[#A29889] bg-[#FCFAF6] border-[#EFEAE0]'}`}>
                            {age.label}
                          </span>
                        )}
                        <span className="ml-auto flex">
                          {people.map((x, i) => (
                            <span key={x.name + i} title={x.name}
                              className="w-[19px] h-[19px] rounded-full text-[8.5px] font-bold text-white flex items-center justify-center border-[1.5px] border-white -ml-[5px] first:ml-0"
                              style={{ background: x.colour }}>
                              {initials(x.name)}
                            </span>
                          ))}
                        </span>
                      </div>
                    </div>
                  )
                })}

                {cards.length === 0 && (
                  <p className="text-[11px] text-[#C3BDB2] text-center py-4 m-0">—</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {peeking && (() => {
        const list = byColumn[peeking.phase] || []
        const i = list.findIndex(x => x.id === peeking.id)
        const d = list[i]
        if (!d) return null
        return (
          <DealPeek deal={d}
            lenderName={d.lenders?.name || ''}
            brokerName={brokerNameOf(d, nameFor)}
            creditName={d.credit_officers?.name || ''}
            colours={colours}
            onClose={() => setPeeking(null)}
            onStep={dir => {
              // Wraps, so the end of a column is not a dead end.
              const next = list[(i + dir + list.length) % list.length]
              if (next) setPeeking({ id: next.id, phase: peeking.phase })
            }} />
        )
      })()}
    </div>
  )
}
