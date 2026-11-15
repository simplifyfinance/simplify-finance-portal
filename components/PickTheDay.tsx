'use client'
import { useState } from 'react'
import Link from 'next/link'
import { LINE, moveInOrder, splitAtLine, noteFor } from '@/lib/the-days-plan'
import { brokerLabel } from '@/lib/broker-key'
import { reworkChip } from '@/lib/send-it-back'
import { askChip } from '@/lib/a-slot-each'
import { OFFICE } from '@/lib/same-date-everywhere'
import { pickedWords } from '@/lib/the-credit-order'
import { type DayDeal } from '@/components/MyDay'

// SHE TICKS, AND THE DAY BUILDS BESIDE HER.
//
// 16 Nov 2026. The day was one list with a line through it: above the line was
// today, below it was the queue, and you dragged things across. Fabio, on
// watching it as a credit assessor would: "it's going to confuse my staff...
// as the credit assessor is selecting the ones that they're doing today, that
// generates the actual box that becomes, this is my day."
//
// So it is two boxes, and they are the same list seen twice:
//
//   LEFT   everything sitting with her, grouped by stage, with a tick box.
//          Ten are ticked when she arrives - see lib/the-credit-order.ts,
//          compliance first because that is a deal this week. The list never
//          moves, so she can always find a file.
//   RIGHT  the ones she ticked, numbered, in the order she will work in, and
//          hers to drag. The box that becomes her day.
//
// NOTHING NEW IS STORED. Ticked means "above the line" in exactly the order
// the old screen used, so a day saved yesterday reads the same today and the
// run-through, the morning three and the email all carry on unchanged.
//
// NOTHING IS EVER DELETED HERE. Unticking puts a deal back on the list; it is
// there again tomorrow. A screen that loses a deal when somebody taps the
// wrong thing is a screen nobody trusts with their morning.

const SOFT = 'text-[12px] text-muted'
const WHY = 'text-[10.5px] text-faint border border-card-line rounded-full px-2 py-[1px] whitespace-nowrap'
const WHY_P = 'text-[10.5px] text-chase bg-chase-bg border border-chase-edge rounded-full px-2 py-[1px] whitespace-nowrap font-bold'
const WHY_R = 'text-[10.5px] text-chase bg-chase-bg border border-chase-edge rounded-full px-2 py-[1px] whitespace-nowrap font-bold uppercase tracking-[.03em]'
const BRK = 'text-[10.5px] text-info bg-info-bg border border-info-edge rounded-full px-2 py-[1px] whitespace-nowrap font-bold'
const CAP = 'text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted'

/** Which band a deal sits under on the left. The two instructions, then stages. */
function bandOf(d: DayDeal): string {
  if (d.rework) return 'Sent back'
  if (d.priority) return 'A broker asked'
  return String(d.stage || 'Everything else')
}

const BAND_NOTE: Record<string, string> = {
  'Sent back': 'a broker returned it',
  'A broker asked': "today's ask",
  Compliance: 'closest to lodging',
}

export default function PickTheDay({
  deals, order, setOrder, notes, setNote, onItNow, setOnItNow, saved, busy, onConfirm,
  canEdit = true, heading = '2 — Everything with you',
}: {
  deals: DayDeal[]
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
  heading?: string
}) {
  const [drag, setDrag] = useState<string | null>(null)
  const [writing, setWriting] = useState<string | null>(null)
  const byId = new Map(deals.map(d => [d.id, d]))
  const { today } = splitAtLine(order)

  // A deal that arrived since the order was worked out goes on the end rather
  // than falling off the screen.
  const unknown = deals.map(d => d.id).filter(id => !order.includes(id))
  const items = unknown.length ? [...order, ...unknown] : order

  const ticked = (id: string) => today.includes(id)

  function toggle(id: string) {
    if (!canEdit) return
    // Ticking drops it at the bottom of the day; unticking sends it back to
    // the list. Both are the one move the old screen used.
    setOrder(moveInOrder(items, id, ticked(id) ? null : LINE))
  }

  function dropOn(before: string | null) {
    if (!drag || !canEdit) return
    setOrder(moveInOrder(items, drag, before))
    setDrag(null)
  }

  // ---- LEFT: everything with her, grouped, never reordered -----------------
  const bands: Array<{ name: string; deals: DayDeal[] }> = []
  for (const d of deals) {
    const name = bandOf(d)
    const last = bands[bands.length - 1]
    if (last && last.name === name) last.deals.push(d)
    else bands.push({ name, deals: [d] })
  }

  const pickRow = (d: DayDeal) => {
    const on = ticked(d.id)
    return (
      <div key={d.id} className="flex items-center gap-2.5 border-b border-line-soft py-2 last:border-b-0">
        <button type="button" onClick={() => toggle(d.id)} disabled={!canEdit}
          aria-pressed={on} title={on ? 'Not today' : 'Do this today'}
          className={`h-[19px] w-[19px] flex-none rounded-md border text-[11px] font-extrabold leading-[17px] ${
            on ? 'border-ink bg-ink text-page' : 'border-field-line bg-card text-transparent'}`}>
          &#10003;
        </button>
        <Link href={`/deals/${d.id}`}
          className={`truncate text-[13.5px] hover:underline ${on ? 'font-semibold' : 'text-body'}`}>
          {d.name}
        </Link>
        <span className="flex-1" />
        {d.rework && <span className={WHY_R}>{reworkChip(d.rework as any)}</span>}
        {d.broker && <span className={BRK}>{brokerLabel(d.broker).toUpperCase()}</span>}
        {!d.rework && d.priority && (
          <span className={WHY_P}>{askChip(d.priority, brokerLabel(d.priority.by))}</span>
        )}
        {d.days !== null && d.days !== undefined && (
          <span className="whitespace-nowrap text-[11.5px] tabular-nums text-faint">{d.days} days</span>
        )}
      </div>
    )
  }

  // ---- RIGHT: the day she is building --------------------------------------
  const dayRow = (id: string, i: number) => {
    const d = byId.get(id)
    if (!d) return null
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
          {canEdit && <span className="cursor-grab select-none text-[13px] tracking-[-2px] text-faint">&#10495;</span>}
          <button onClick={() => setOnItNow(now ? null : id)} disabled={!canEdit}
            title={now ? 'Not on it any more' : 'This is the one I am on now'}
            className={`flex h-5 w-5 flex-none items-center justify-center rounded-md text-[11px] font-bold ${
              now ? 'bg-info text-page ring-[3px] ring-info-bg'
              : d.rework ? 'bg-chase text-page' : 'bg-ink text-page'}`}>
            {i + 1}
          </button>
          <Link href={`/deals/${d.id}`} className="truncate font-semibold hover:underline">{d.name}</Link>
          {now && (
            <span className="whitespace-nowrap rounded-full border border-info-edge bg-info-bg px-2 py-[1px] text-[10.5px] font-bold text-info">
              On it now
            </span>
          )}
          <span className="flex-1" />
          <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[.04em] text-faint">
            {d.rework ? 'Back' : d.priority ? 'Asked' : d.stage}
          </span>
          {canEdit && (
            <button onClick={() => toggle(id)} title="Not today"
              className="text-[12px] text-faint hover:text-chase">&#10005;</button>
          )}
        </div>

        {!d.rework && d.priority?.why && (
          <div className="mb-2 ml-[30px] rounded-md border border-line-soft bg-page px-2.5 py-1 text-[11.5px] leading-relaxed text-body">
            &ldquo;{d.priority.why}&rdquo;
          </div>
        )}
        {d.rework?.note && (
          <div className="mb-2 ml-[30px] rounded-md border border-chase-edge bg-chase-bg px-2.5 py-1 text-[11.5px] leading-relaxed text-body">
            &ldquo;{d.rework.note}&rdquo;
          </div>
        )}

        {/* THE NOTE, FOR TODAY ONLY. Gone tomorrow - anything that matters
            longer belongs in the deal's own notes. */}
        {writing === id ? (
          <input autoFocus defaultValue={note}
            placeholder="Waiting on the valuation — chase CBA at 11"
            onBlur={e => { setNote(id, e.target.value); setWriting(null) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { setNote(id, (e.target as HTMLInputElement).value); setWriting(null) }
              if (e.key === 'Escape') setWriting(null)
            }}
            className="mb-2 ml-[30px] w-[min(380px,88%)] rounded-md border border-line-soft bg-page px-2.5 py-1 text-[11.5px]" />
        ) : note ? (
          <button onClick={() => canEdit && setWriting(id)}
            className="mb-2 ml-[30px] rounded-md border border-line-soft bg-page px-2.5 py-1 text-left text-[11.5px] text-body">
            {note}
          </button>
        ) : canEdit ? (
          <button onClick={() => setWriting(id)} className="mb-2 ml-[30px] text-[11.5px] text-faint hover:text-brand-ink">
            + note
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start">
      {/* ================= LEFT ================= */}
      <div className="min-w-0 flex-1 rounded-xl border border-card-line bg-card px-5 py-4">
        <div className="mb-1 flex items-center gap-2">
          <span className={CAP}>{heading}</span>
          <span className="flex-1" />
          <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-faint">
            {deals.length} files &middot; {today.length} ticked
          </span>
        </div>

        {deals.length === 0 ? (
          <div className={`${SOFT} py-3`}>Nothing is sitting with you. Enjoy it.</div>
        ) : (
          <>
            <p className="mb-1 text-[11.5px] leading-relaxed text-faint">
              The first {Math.min(10, deals.length)} are ticked for you &mdash; compliance first,
              then lending options, then borrowing capacity. Untick anything you are not doing today.
            </p>
            {/* IT STOPS GROWING, IT DOES NOT GET CUT SHORT. Everything is here
                and in order; past about seven rows the box scrolls instead of
                running down the page. 12 Nov 2026, Fabio: "7 is the maximum I
                want to show because I want it to be able to scroll, because
                otherwise this box looks ridiculous." */}
            <div className="max-h-[360px] overflow-y-auto pr-1">
              {bands.map(b => (
                <div key={b.name}>
                  <div className="mb-[2px] mt-3 flex items-center gap-2.5 first:mt-1">
                    <span className="whitespace-nowrap text-[10px] font-extrabold uppercase tracking-[0.08em] text-brand-ink">
                      {b.name}
                    </span>
                    <span className="flex-1 border-t border-line-soft" />
                    <span className="whitespace-nowrap text-[10.5px] text-faint">
                      {b.deals.length}{BAND_NOTE[b.name] ? ` · ${BAND_NOTE[b.name]}` : ''}
                    </span>
                  </div>
                  {b.deals.map(pickRow)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ================= RIGHT ================= */}
      <div className={`w-full lg:w-[400px] lg:flex-none rounded-xl bg-card px-5 py-4 ${
        saved ? 'border border-card-line' : 'border-2 border-ink'}`}>
        <div className="mb-1 flex items-center gap-2">
          <span className={`${CAP} text-ink`}>This is my day</span>
          <span className="flex-1" />
          {canEdit && <span className="text-[10.5px] text-faint">drag to reorder</span>}
        </div>

        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[26px] font-extrabold leading-none tracking-[-.02em]">{today.length}</span>
          <span className="text-[12px] text-muted">{pickedWords(today.length, deals.length)}</span>
        </div>

        {/* THE BOX IS ALWAYS HERE, EMPTY OR NOT. 15 Nov 2026, Fabio: "if it's
            blank, it's blank, but the boxes are there. The screen is never
            blank." */}
        {today.length === 0 ? (
          <div className={`${SOFT} rounded-lg border border-dashed border-field-line px-3 py-6 text-center leading-relaxed`}>
            Nothing ticked yet.<br />Tick what you are doing today and it appears here.
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto pr-1"
               onDragOver={e => e.preventDefault()}
               onDrop={e => { e.preventDefault(); dropOn(null) }}>
            {today.map((id, i) => dayRow(id, i))}
          </div>
        )}

        <div className="mt-4">
          {saved ? (
            <span className="inline-block rounded-[10px] border border-done-edge bg-done-bg px-4 py-2.5 text-[13.5px] font-semibold text-done">
              &#10003; Told the brokers &mdash; {new Date(saved).toLocaleTimeString('en-AU', { timeZone: OFFICE, hour: 'numeric', minute: '2-digit' })}
            </span>
          ) : (
            <button onClick={onConfirm} disabled={busy || !canEdit || today.length === 0}
              className="w-full rounded-[10px] bg-ink px-5 py-2.5 text-[14px] font-semibold text-page disabled:opacity-40">
              {busy ? 'Telling them...' : 'Yes — this is my day'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
