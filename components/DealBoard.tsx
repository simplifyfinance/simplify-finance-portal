'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { phaseOf, phaseSince, amountOf, PHASE_LABEL, PHASE_ORDER, moveBack, PHASE_UNDO_LABEL, PHASE_UNDO_WARNING, type Phase } from '@/lib/deal-phase'
import { stageAge, ageGroupOf } from '@/lib/deal-age'
import { chipsFor, brokerColour, chipStyle, dealTitle } from '@/lib/deal-labels'
import { CREDIT_GREY, type ThresholdMap } from '@/lib/board-settings'
import { useColumnFolds } from '@/lib/use-column-folds'
import { isUrgentNow, urgentChipLabel } from '@/lib/push-answers'
import { AlertChips } from '@/components/DealFile'
import type { Alert } from '@/lib/deal-notes'
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

// Twelve. Offer accepted, Contracts returned and Settlement booked were added on
// 2 Sep 2026 - the first was a whole process inside Preapproved that the board
// could not see, and the other two were an enum buried in the Settlement panel.
//
// Twelve columns do not fit on a laptop and are not meant to: the board scrolls,
// every column keeps its full width, and each person folds away the ones they do
// not use. Fabio, 2 Sep 2026: "12 no issues same sixe just make sure we cna go
// back and forwards oin the screen".
const COLUMNS: Phase[] = [
  'fact_find', 'bc', 'lo', 'compliance', 'compliance_sent',
  'lodged', 'preapproved', 'offer_accepted', 'formal',
  'contracts_returned', 'settlement_booked', 'settled',
]

const OPEN_W = 248        // an open column, wide enough for a card
const SHUT_W = 38         // a folded one: the count, the name, and nothing else
const GAP = 10            // gap-2.5

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

export default function DealBoard({ deals, nameFor, colours, thresholds, alerts, onDelete, onMoveBack }: {
  deals: any[]
  nameFor: (k: string) => string
  colours?: { type?: any; use?: any; broker?: Record<string, string> }
  // Set in Settings -> Deal board. Undefined falls through to the defaults in
  // lib/deal-age.ts, which is what the board used before there was a screen for
  // it - so an unmigrated portal looks exactly the same.
  thresholds?: ThresholdMap
  // Open alerts keyed by deal id. A card with one shows it; a card without is
  // unchanged.
  alerts?: Record<string, Alert[]>
  // Deleting was only ever possible from the list, and the board is what
  // everyone actually works on. Fabio, 2 Sep 2026: "we cant delete deals on
  // board view only grud". Hidden until the card is hovered, because a card on
  // the board is dragged and clicked all day and a delete under the cursor is a
  // delete waiting to happen. The confirmation lives in the handler.
  onDelete?: (e: React.MouseEvent, deal: any) => void
  // Clears the timestamps that put a deal where it is, so it lands in an earlier
  // column. The board asks first; the page does the writing.
  onMoveBack?: (deal: any, target: Phase, fields: string[]) => Promise<string | null>
}) {
  const router = useRouter()
  // Folded columns, this person's own, remembered across logins.
  const { folds, toggle } = useColumnFolds()
  const [dragging, setDragging] = useState<string>('')
  const [over, setOver] = useState<Phase | ''>('')
  const [msg, setMsg] = useState('')
  // Which card is being looked at, and which column it sits in — so the arrow
  // keys can walk along that column without closing.
  const [peeking, setPeeking] = useState<{ id: string; phase: Phase } | null>(null)
  // A backwards drop, waiting to be confirmed.
  const [undoing, setUndoing] = useState<{ deal: any; target: Phase; clearing: Phase[]; fields: string[] } | null>(null)
  const [undoBusy, setUndoBusy] = useState(false)

  const byColumn = useMemo(() => {
    const m: Record<string, any[]> = {}
    for (const p of COLUMNS) m[p] = []
    for (const d of deals) {
      const p = phaseOf(d)
      if (p === 'lost') continue          // dead deals are not on the board
      if (m[p]) m[p].push(d)
    }
    // Urgent first, then oldest - the top of a column is the thing to do first,
    // and somebody asking for a deal by Friday outranks a deal that has simply
    // been sitting. The flag ends at lodgement, so this settles itself.
    for (const p of COLUMNS) {
      m[p].sort((a, b) => {
        const ua = isUrgentNow(a) ? 0 : 1, ub = isUrgentNow(b) ? 0 : 1
        if (ua !== ub) return ua - ub
        return String(phaseSince(a) || '').localeCompare(String(phaseSince(b) || ''))
      })
    }
    return m
  }, [deals])

  // FACT FIND TAKES NO DROPS.
  //
  // Which column a deal sits in is derived from what has been done to it, and
  // "at Fact Find" means the fact find has nothing typed in it yet. There is no
  // date to clear that would send a deal back there - only the client's own
  // answers, and a dropped card must never delete those.
  //
  // It used to accept the drop and then explain itself in a banner, which is a
  // dead end dressed up as help. Fabio, 3 Sep 2026, asked for the column simply
  // not to take the card: it dims while you drag and the cursor says no.
  const acceptsDrops = (p: Phase) => p !== 'fact_find'

  function onDrop(target: Phase) {
    setOver('')
    const deal = deals.find(d => d.id === dragging)
    setDragging('')
    if (!deal) return
    const from = phaseOf(deal)
    if (from === target) return

    const fi = COLUMNS.indexOf(from), ti = COLUMNS.indexOf(target)

    // BACKWARDS.
    //
    // This used to be refused flat. But a phase is derived from timestamps, and
    // timestamps get recorded wrongly - so the only way out was to go hunting
    // for the panel that set the date. Now it asks, names what it is about to
    // clear, and only then clears it. Fabio, 2 Sep 2026: "on board view we cant
    // move the deal backwards we should be able to".
    if (ti < fi) {
      const back = moveBack(from, target)
      if (!back.ok) { setMsg(back.because); return }
      if (!onMoveBack) { setMsg('Moving a deal backwards is not available here.'); return }
      setMsg('')
      setUndoing({ deal, target, clearing: back.clearing, fields: back.fields })
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

  const shutCount = COLUMNS.filter(p => folds.includes(p)).length
  const openCount = COLUMNS.length - shutCount

  return (
    <div>
      {/* Confirming a backwards move. It names the dates it is about to clear,
          because that is what "moving backwards" actually is. */}
      {undoing && (
        <div className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 p-6 overflow-y-auto"
             onClick={e => { if (e.target === e.currentTarget && !undoBusy) setUndoing(null) }}>
          <div className="bg-white rounded-2xl w-[560px] max-w-full shadow-2xl mt-16 overflow-hidden">
            <div className="px-6 pt-5">
              <h2 className="text-[17px] font-bold text-[#141C24] m-0 mb-1.5">
                Move this deal back to {PHASE_LABEL[undoing.target]}?
              </h2>
              <p className="text-[13px] text-[#7C8894] m-0">{undoing.deal.deal_name}</p>
            </div>
            <div className="px-6 pt-4">
              <div className="border border-[#EBD9BE] bg-[#FDF6E7] rounded-[10px] px-4 py-3.5 text-[13px] text-[#8A6218]">
                <b className="text-[#141C24]">The deal will stop saying:</b>
                <ul className="m-0 mt-2 pl-4">
                  {undoing.clearing.map(p2 => (
                    <li key={p2} className="mb-0.5">{PHASE_UNDO_LABEL[p2] || PHASE_LABEL[p2]}</li>
                  ))}
                </ul>
                <p className="m-0 mt-2.5">
                  Do this only if {undoing.clearing.length === 1 ? 'it was' : 'they were'} recorded by
                  mistake, or {undoing.clearing.length === 1 ? 'it' : 'they'} did not really happen.
                </p>
              </div>

              {undoing.clearing.some(p2 => PHASE_UNDO_WARNING[p2]) && (
                <div className="mt-2.5 border border-[#E9D2CF] bg-[#FDF3F2] rounded-[10px] px-4 py-3.5 text-[13px] text-[#8E3A34]">
                  <b className="text-[#141C24]">Watch out:</b>
                  <ul className="m-0 mt-1.5 pl-4">
                    {undoing.clearing.filter(p2 => PHASE_UNDO_WARNING[p2]).map(p2 => (
                      <li key={p2} className="mb-0.5">{PHASE_UNDO_WARNING[p2]}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-2.5 mb-0 text-[12.5px] text-[#7C8894]">
                Everything else stays: the fact find, the write-up, the documents and the notes are
                untouched. You can record {undoing.clearing.length === 1 ? 'it' : 'them'} again whenever
                you like.
              </p>
            </div>
            <div className="px-6 py-4 mt-2 flex items-center gap-2.5 flex-wrap">
              <button disabled={undoBusy}
                onClick={async () => {
                  if (!onMoveBack) return
                  setUndoBusy(true)
                  const problem = await onMoveBack(undoing.deal, undoing.target, undoing.fields)
                  setUndoBusy(false)
                  if (problem) { setMsg(problem); setUndoing(null); return }
                  setUndoing(null)
                }}
                className="rounded-lg px-4 py-2 text-[13px] font-semibold border bg-[#141C24] border-[#141C24] text-white disabled:opacity-40">
                {undoBusy ? 'Moving…' : `Move it back to ${PHASE_LABEL[undoing.target]}`}
              </button>
              <button disabled={undoBusy} onClick={() => setUndoing(null)}
                className="rounded-lg px-4 py-2 text-[13px] border bg-white border-[#D7DCE1] text-[#3E4C59]">
                Leave it where it is
              </button>
            </div>
          </div>
        </div>
      )}
      {msg && (
        <div className="mb-3 text-[12.5px] rounded-lg border border-[#EBD9BE] bg-[#FDF6EC] text-[#575046] px-3 py-2">
          {msg} <button onClick={() => setMsg('')} className="underline text-[#946017] ml-1">Dismiss</button>
        </div>
      )}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-2.5" style={{ minWidth: openCount * OPEN_W + shutCount * SHUT_W + (COLUMNS.length - 1) * GAP }}>
          {COLUMNS.map(p => {
            const cards = byColumn[p] || []
            const total = cards.reduce((t, d) => t + (amountOf(d) || 0), 0)
            const hot = cards.filter(d => ageGroupOf(d, thresholds) === 'nudge').length
            const shut = folds.includes(p)

            // A folded column still counts.
            //
            // The number stays on the strip on purpose. A fold that hides its
            // count is a way to lose deals, and this board exists because nine
            // of them were hidden once already - sitting in a state the portal
            // called finished and refused to show. Folding is "I am not working
            // on this today", never "this does not exist".
            if (shut) {
              return (
                <div key={p} title={`${PHASE_LABEL[p]} - ${cards.length} deal${cards.length === 1 ? '' : 's'}${total > 0 ? ' \u00b7 ' + money(total) : ''}. Click to open.`}
                  onDragOver={e => { if (!acceptsDrops(p)) return; e.preventDefault(); setOver(p) }}
                  onDragLeave={() => setOver(o => o === p ? '' : o)}
                  onDrop={() => { if (acceptsDrops(p)) onDrop(p) }}
                  onClick={() => toggle(p)}
                  style={{ width: SHUT_W }}
                  className={`flex-none rounded-xl border border-dashed flex flex-col items-center gap-2 py-2.5 cursor-pointer transition ${
                    dragging && !acceptsDrops(p) ? 'border-[#E5DED2] bg-[#FCFAF6] opacity-40'
                    : over === p ? 'border-[#0E8FCB] bg-[#EAF6FD]'
                    : hot > 0 ? 'border-[#EFD3CB] bg-[#FBEDE9]'
                    : 'border-[#E5DED2] bg-[#FCFAF6] hover:border-[#D6CCBC]'}`}>
                  <span className={`text-[11px] font-bold tabular-nums ${hot > 0 ? 'text-[#AD4227]' : 'text-[#575046]'}`}>
                    {cards.length}
                  </span>
                  <span className="text-[9.5px] font-bold tracking-[.06em] uppercase text-[#A29889] whitespace-nowrap"
                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                    {PHASE_LABEL[p]}
                  </span>
                  <svg className="mt-auto text-[#C3BDB2]" width="11" height="11" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </div>
              )
            }

            return (
              <div key={p}
                onDragOver={e => { if (!acceptsDrops(p)) return; e.preventDefault(); setOver(p) }}
                onDragLeave={() => setOver(o => o === p ? '' : o)}
                onDrop={() => { if (acceptsDrops(p)) onDrop(p) }}
                className={`flex-1 min-w-[248px] rounded-xl border p-2.5 transition ${
                  // Dimmed while a card is in the air, so it is visibly not a
                  // target rather than silently ignoring the drop.
                  dragging && !acceptsDrops(p) ? 'border-[#EFEAE0] bg-[#FCFAF6] opacity-40'
                  : over === p ? 'border-[#0E8FCB] bg-[#EAF6FD]'
                  : hot > 0 ? 'border-[#EFD3CB] bg-[#FBEDE9]'
                  : 'border-[#EFEAE0] bg-[#FCFAF6]'}`}>
                <div className="flex items-baseline gap-1.5 mb-2 px-0.5">
                  <span className={`text-[10.5px] font-bold tracking-[.06em] uppercase ${hot > 0 ? 'text-[#AD4227]' : 'text-[#7A7266]'}`}>
                    {PHASE_LABEL[p]}
                  </span>
                  <span className="ml-auto text-[11px] font-bold text-[#575046] bg-white border border-[#E5DED2] rounded-full px-1.5">
                    {cards.length}
                  </span>
                  <button type="button" title={`Fold ${PHASE_LABEL[p]} away`}
                    onClick={e => { e.stopPropagation(); toggle(p) }}
                    className="text-[#C3BDB2] hover:text-[#575046] leading-none -mb-[1px]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 6l-6 6 6 6" />
                    </svg>
                  </button>
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
                  const urgent = isUrgentNow(d)
                  const people = [
                    { name: brokerNameOf(d, nameFor), colour: brokerColour(bKey, colours?.broker) },
                    ...(d.credit_officers?.name ? [{ name: d.credit_officers.name, colour: CREDIT_GREY }] : []),
                  ].filter(x => x.name)
                  return (
                    <div key={d.id} draggable
                      onDragStart={() => setDragging(d.id)}
                      onDragEnd={() => { setDragging(''); setOver('') }}
                      onClick={() => router.push(`/deals/${d.id}`)}
                      className={`group relative bg-white border rounded-[10px] px-2.5 pt-2.5 pb-2.5 mb-2 cursor-pointer transition hover:border-[#D6CCBC] ${
                        dragging === d.id ? 'opacity-40 border-[#0E8FCB]'
                        : urgent ? 'border-[#E9C9BE] ring-2 ring-[#FBEDE9]' : 'border-[#E5DED2]'}`}>

                      {urgent && (
                        <div className="mb-1.5 mr-[50px]">
                          <span className="text-[9px] font-bold tracking-[.04em] uppercase rounded px-1.5 py-[2px] border whitespace-nowrap text-[#AD4227] bg-[#FBEDE9] border-[#EFD3CB]">
                            {urgentChipLabel(d)}
                          </span>
                        </div>
                      )}

                      {onDelete && (
                        <button title="Delete this deal"
                          onClick={e => onDelete(e, d)}
                          className="absolute top-[7px] right-[30px] w-[22px] h-[22px] rounded-md border border-[#E5DED2] bg-white text-[#B0A79B] flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:border-[#D9534F] hover:text-[#D9534F] hover:bg-[#FDF0EF]">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                          </svg>
                        </button>
                      )}

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
                      <p className="text-[12.5px] font-[640] text-[#221F1B] m-0 mr-[50px] truncate" title={d.deal_name}>
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

                      {/* Loudest thing on the card, above the labels - somebody
                          scanning the board is looking for what is wrong. */}
                      {(alerts?.[d.id]?.length || 0) > 0 && (
                        <div className="flex gap-1 flex-wrap items-center mb-1.5">
                          <AlertChips alerts={alerts![d.id]} max={2} />
                        </div>
                      )}

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
