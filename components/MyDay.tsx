'use client'
import { useState } from 'react'
import Link from 'next/link'
import { LINE, moveInOrder, splitAtLine, noteFor, type PlanDeal } from '@/lib/the-days-plan'
import { brokerLabel } from '@/lib/broker-key'
import { reworkChip } from '@/lib/send-it-back'
import { askChip } from '@/lib/a-slot-each'

// A DAY THAT IS A DAY.
//
// 26 Oct 2026. Fabio, after a week of using the first version: "the today page
// needs a lot of work still we need to be able to really understand the order
// and flow, we should be able to add notes we should be able to remove from
// list as everything that is allocated is being allocated to be done in one
// day so lets keep diggin deeper".
//
// Three things wrong with the first version, and they are one thing:
//
//   - It listed everything sitting with you. On his own book that is
//     fifty-eight deals. A list of fifty-eight is not a plan.
//   - Nothing said why a deal was third rather than tenth.
//   - Nothing could be written down against a deal for today only.
//
// THE LINE IS THE ANSWER TO ALL THREE. Above it is today, below it is the rest
// of the queue, and you drag it to where your day ends. The order above it is
// the order you will work in, and it is yours to change. A note sits under a
// deal for the day and is gone tomorrow.
//
// NOTHING IS EVER DELETED HERE. The cross sends a deal back under the line and
// it is on the list again tomorrow. A screen that loses a deal when somebody
// taps the wrong thing is a screen nobody trusts with their morning.

const SOFT = 'text-[12px] text-muted'
const WHY = 'text-[10.5px] text-faint border border-card-line rounded-full px-2 py-[1px] whitespace-nowrap'
const WHY_P = 'text-[10.5px] text-chase bg-chase-bg border border-chase-edge rounded-full px-2 py-[1px] whitespace-nowrap font-bold'
const WHY_R = 'text-[10.5px] text-chase bg-chase-bg border border-chase-edge rounded-full px-2 py-[1px] whitespace-nowrap font-bold uppercase tracking-[.03em]'
const BRK = 'text-[10.5px] text-info bg-info-bg border border-info-edge rounded-full px-2 py-[1px] whitespace-nowrap font-bold'

export type DayDeal = PlanDeal & {
  /** How long it has been waiting, for the tag on the right. */
  days?: number | null
}

export default function MyDay({
  deals, order, setOrder, notes, setNote, onItNow, setOnItNow, saved, busy, onConfirm, canEdit = true,
}: {
  /** Everything sitting with this person, drafted. Keyed by id below. */
  deals: DayDeal[]
  /** The order, with LINE somewhere in it. */
  order: string[]
  setOrder: (next: string[]) => void
  notes: Record<string, string>
  setNote: (dealId: string, text: string) => void
  onItNow: string | null
  setOnItNow: (dealId: string | null) => void
  saved: string | null
  busy: boolean
  onConfirm: () => void
  canEdit?: boolean
}) {
  const [drag, setDrag] = useState<string | null>(null)
  const [writing, setWriting] = useState<string | null>(null)
  const byId = new Map(deals.map(d => [d.id, d]))
  const { today, queue } = splitAtLine(order)

  // A deal that arrived since the order was worked out goes on the end of the
  // queue rather than being dropped off the screen.
  const unknown = deals.map(d => d.id).filter(id => !order.includes(id))
  const items = unknown.length ? [...order, ...unknown] : order

  function dropOn(before: string | null) {
    if (!drag || !canEdit) return
    setOrder(moveInOrder(items, drag, before))
    setDrag(null)
  }

  const row = (id: string, i: number) => {
    const d = byId.get(id)
    if (!d) return null
    const isToday = today.includes(id)
    const note = noteFor(notes, id)
    const now = onItNow === id
    return (
      <div key={id}
        draggable={canEdit}
        onDragStart={() => setDrag(id)}
        onDragOver={e => { e.preventDefault() }}
        onDrop={e => { e.preventDefault(); dropOn(id) }}
        className={`border-b border-line-soft last:border-b-0 ${drag === id ? 'opacity-40' : ''}`}>
        <div className="flex items-center gap-2.5 py-2 text-[13.5px]">
          {canEdit && <span className="text-faint text-[13px] cursor-grab select-none tracking-[-2px]">&#10495;</span>}
          {isToday ? (
            <button onClick={() => setOnItNow(now ? null : id)} disabled={!canEdit}
              title={now ? 'Not on it any more' : 'This is the one I am on now'}
              className={`w-5 h-5 rounded-md text-[11px] font-bold flex items-center justify-center flex-none ${
                now ? 'bg-info text-page ring-[3px] ring-info-bg'
                : d.rework ? 'bg-chase text-page' : 'bg-ink text-page'}`}>
              {i + 1}
            </button>
          ) : (
            <span className="w-5 flex-none" />
          )}
          <Link href={`/deals/${d.id}`}
            className={`hover:underline truncate ${isToday ? 'font-semibold' : 'text-body'}`}>{d.name}</Link>
          {now && (
            <span className="text-[10.5px] font-bold rounded-full px-2 py-[1px] bg-info-bg text-info border border-info-edge whitespace-nowrap">
              On it now
            </span>
          )}
          <span className="flex-1" />
          {/* WHY IT IS WHERE IT IS. The draft's reason, not yours - drag it
              anywhere and this still says what put it there. */}
          {/* A REWORK SAYS SO BEFORE IT SAYS ANYTHING ELSE. A deal that was
              finished and came back must not look like a deal that arrived. */}
          {d.rework && <span className={WHY_R}>{reworkChip(d.rework as any)}</span>}
          {/* WHOSE FILE IT IS. 27 Oct 2026, Catherine, item 2 of nine: "The
              deal lists the credit managers send don't show which broker each
              deal belongs to." It costs one chip and it was never there. */}
          {d.broker && <span className={BRK}>{brokerLabel(d.broker).toUpperCase()}</span>}
          {!d.rework && d.priority && (
            <span className={WHY_P}>{askChip(d.priority, brokerLabel(d.priority.by))}</span>
          )}
          <span className={WHY}>
            {d.rework ? `${d.rework.label} · ` : !d.priority ? 'oldest · ' : ''}
            {d.stage}{d.days !== null && d.days !== undefined ? ` · ${d.days} days` : ''}
          </span>
          {canEdit && (isToday ? (
            <button onClick={() => setOrder(moveInOrder(items, id, null))}
              title="Send it back to the queue" className="text-faint text-[12px] hover:text-chase">&#10005;</button>
          ) : (
            <button onClick={() => setOrder(moveInOrder(items, id, LINE))}
              className="text-[11.5px] text-brand-ink font-semibold border border-card-line rounded-lg px-2.5 py-[2px] hover:bg-page">
              + Add to today
            </button>
          ))}
        </div>

        {/* WHAT THE BROKER SAID, which is not a note and is not yours to
            change. It comes off the deal, so it is the same words on the day
            list, on the deal page and in the email. */}
        {/* WHY THEY ASKED. Required when they ask, and it is the only thing
            that lets a credit assessor choose between two of them. */}
        {!d.rework && d.priority?.why && (
          <div className="ml-[30px] mb-2 text-[11.5px] text-body bg-page border border-line-soft rounded-md px-2.5 py-1 leading-relaxed">
            &ldquo;{d.priority.why}&rdquo;
          </div>
        )}

        {d.rework?.note && (
          <div className="ml-[30px] mb-2 text-[11.5px] text-body bg-chase-bg border border-chase-edge rounded-md px-2.5 py-1 leading-relaxed">
            &ldquo;{d.rework.note}&rdquo;
          </div>
        )}

        {/* THE NOTE, FOR TODAY ONLY. */}
        {isToday && (writing === id ? (
          <input autoFocus defaultValue={note}
            placeholder="Waiting on the valuation — chase CBA at 11"
            onBlur={e => { setNote(id, e.target.value); setWriting(null) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { setNote(id, (e.target as HTMLInputElement).value); setWriting(null) }
              if (e.key === 'Escape') setWriting(null)
            }}
            className="ml-[30px] mb-2 text-[11.5px] bg-page border border-line-soft rounded-md px-2.5 py-1 w-[min(420px,90%)]" />
        ) : note ? (
          <button onClick={() => canEdit && setWriting(id)}
            className="ml-[30px] mb-2 text-[11.5px] text-body bg-page border border-line-soft rounded-md px-2.5 py-1 text-left">
            {note}
          </button>
        ) : canEdit ? (
          <button onClick={() => setWriting(id)} className="ml-[30px] mb-2 text-[11.5px] text-faint hover:text-brand-ink">
            + note
          </button>
        ) : null)}
      </div>
    )
  }

  return (
    <div className={`bg-card rounded-xl px-5 py-4 mb-3 ${saved ? 'border border-card-line' : 'border-2 border-ink'}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted">Today, in this order</span>
        <span className="flex-1" />
        <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-faint">
          {today.length} on today &middot; {queue.length} in the queue
        </span>
      </div>

      {deals.length === 0 ? (
        <div className={SOFT}>Nothing is sitting with you. Enjoy it.</div>
      ) : (
        <>
          {today.map((id, i) => row(id, i))}

          {/* THE LINE. Drag it to where the day ends. */}
          <div
            draggable={canEdit}
            onDragStart={() => setDrag(LINE)}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); dropOn(LINE) }}
            className={`flex items-center gap-2.5 my-2 ${canEdit ? 'cursor-grab' : ''} ${drag === LINE ? 'opacity-40' : ''}`}>
            <span className="text-[10.5px] font-bold tracking-[0.07em] uppercase text-faint whitespace-nowrap">
              {canEdit && <span className="mr-1.5 tracking-[-2px]">&#10495;</span>}
              The queue &mdash; not today
            </span>
            <span className="flex-1 border-t border-dashed border-field-line" />
            <span className="text-[10.5px] font-bold text-faint">{queue.length}</span>
          </div>

          {queue.map(id => row(id, -1))}
        </>
      )}

      <div className="flex gap-2.5 items-center mt-4 flex-wrap">
        {saved ? (
          <span className="text-[13.5px] font-semibold text-done bg-done-bg border border-done-edge rounded-[10px] px-4 py-2.5">
            &#10003; Told the brokers &mdash; {new Date(saved).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
          </span>
        ) : (
          <button onClick={onConfirm} disabled={busy || !canEdit}
            className="text-[14px] rounded-[10px] px-5 py-2.5 font-semibold bg-ink text-page disabled:opacity-40">
            {busy ? 'Telling them...' : 'Yes — this is my day'}
          </button>
        )}
        {canEdit && (
          <span className="text-[12px] text-faint">
            drag to reorder &middot; drag the line to where your day ends &middot; &#10005; sends it back to the queue
          </span>
        )}
      </div>
    </div>
  )
}
