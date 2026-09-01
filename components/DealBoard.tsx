'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { phaseOf, phaseSince, amountOf, PHASE_LABEL, PHASE_ORDER, type Phase } from '@/lib/deal-phase'
import { stageAge, ageGroupOf, DEFAULT_THRESHOLDS } from '@/lib/deal-age'
import { chipsFor, brokerColour, chipStyle } from '@/lib/deal-labels'
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

const AGE_STYLE: Record<string, string> = {
  nudge: 'text-[#AD4227] bg-[#FBEDE9] border-[#EFD3CB]',
  long:  'text-[#946017] bg-[#FDF6EC] border-[#EBD9BE]',
}

export default function DealBoard({ deals, nameFor, colours }: {
  deals: any[]
  nameFor: (k: string) => string
  colours?: { type?: any; use?: any; broker?: Record<string, string> }
}) {
  const router = useRouter()
  const [dragging, setDragging] = useState<string>('')
  const [over, setOver] = useState<Phase | ''>('')
  const [msg, setMsg] = useState('')

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
        <div className="flex gap-2.5" style={{ minWidth: 1500 }}>
          {COLUMNS.map(p => {
            const cards = byColumn[p] || []
            const total = cards.reduce((t, d) => t + (amountOf(d) || 0), 0)
            const hot = cards.filter(d => ageGroupOf(d) === 'nudge').length
            return (
              <div key={p}
                onDragOver={e => { e.preventDefault(); setOver(p) }}
                onDragLeave={() => setOver(o => o === p ? '' : o)}
                onDrop={() => onDrop(p)}
                className={`flex-1 min-w-[168px] rounded-xl border p-2.5 transition ${
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
                  const age = stageAge(d)
                  const grp = ageGroupOf(d)
                  const bKey = keyOf(d.assigned_broker) || ''
                  const bCol = brokerColour(bKey, colours?.broker)
                  const amt = amountOf(d)
                  return (
                    <Link key={d.id} href={`/deals/${d.id}`} draggable
                      onDragStart={() => setDragging(d.id)}
                      onDragEnd={() => { setDragging(''); setOver('') }}
                      className={`block bg-white border rounded-lg px-2.5 py-2 mb-1.5 hover:border-[#D6CCBC] transition ${
                        dragging === d.id ? 'opacity-40 border-[#0E8FCB]' : 'border-[#E5DED2]'}`}>
                      {/* Deal names are underscored and long — Sasa_Kalajdzic_Tori_Headington_Refinance_2026
                          has no spaces to break on, so without this it runs straight out of the card. */}
                      <p className="text-[11.5px] font-semibold text-[#221F1B] leading-[1.35] m-0 break-all"
                         title={d.deal_name}>
                        {d.deal_name}
                      </p>
                      <div className="flex gap-1 flex-wrap mt-1.5">
                        {chipsFor(d, colours).map(c => (
                          <span key={c.id} className="text-[9px] font-bold tracking-[.04em] uppercase rounded px-1.5 py-[1.5px] border"
                                style={chipStyle(c.colour)}>{c.label}</span>
                        ))}
                        {bKey && (
                          <span className="text-[9px] font-bold tracking-[.04em] uppercase rounded px-1.5 py-[1.5px] border"
                                style={chipStyle(bCol)}>{nameFor(bKey).split(' ')[0] || bKey}</span>
                        )}
                        {age.days !== null && (
                          <span className={`text-[9px] font-bold tracking-[.04em] uppercase rounded px-1.5 py-[1.5px] border ${
                            AGE_STYLE[grp] || 'text-[#A29889] bg-[#FCFAF6] border-[#EFEAE0]'}`}>
                            {age.label}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#A29889] m-0 mt-1.5 tabular-nums">
                        {amt ? money(amt) : 'no amount yet'}
                        {d.credit_officers?.name ? ` · ${String(d.credit_officers.name).split(' ')[0]}` : ''}
                      </p>
                    </Link>
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
    </div>
  )
}
