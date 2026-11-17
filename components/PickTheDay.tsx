'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { LINE, moveInOrder, splitAtLine, noteFor } from '@/lib/the-days-plan'
import { brokerLabel } from '@/lib/broker-key'
import { reworkChip } from '@/lib/send-it-back'
import { askChip } from '@/lib/a-slot-each'
import { OFFICE } from '@/lib/same-date-everywhere'
import { saveWords, NOT_SENT } from '@/lib/a-day-can-change'
import { pickedWords } from '@/lib/the-credit-order'
import { type DayDeal } from '@/components/MyDay'

// SHE TICKS, AND THE DAY BUILDS ABOVE HER.
//
// 16 Nov 2026. The day was one list with a line through it: above the line was
// today, below it the queue, and you dragged things across. Fabio, watching it
// as a credit assessor would: "it's going to confuse my staff... as the credit
// assessor is selecting the ones that they're doing today, that generates the
// actual box that becomes, this is my day."
//
// So it is two boxes, and they are the same list seen twice:
//
//   TOP    THIS IS MY DAY - the ones she ticked, numbered, in the order she
//          will work in, hers to drag. It never scrolls and it is never
//          below the fold, because it is the thing she is building.
//   UNDER  EVERYTHING WITH YOU - every file sitting with her, grouped by
//          stage, each with a tick box, plus a search for one that is not on
//          her list. The list never reorders itself under her.
//
// 17 Nov 2026 moved the day above the list and took the ticks out. Fabio, on
// the version that opened with ten ticked and the day in a short right-hand
// column: "I can only see 5 and I can't roll it"; and "all boxes next to it a
// unticked so when we tick starts arranging in order THEN we confirm this is
// my day". The portal suggests the ORDER. She decides the day.
//
// NOTHING NEW IS STORED. Ticked means "above the line" in exactly the order
// the old screen used, so a day saved yesterday reads the same today and the
// run-through, the morning three and the email all carry on unchanged.
//
// NOTHING IS EVER DELETED HERE. Unticking puts a deal back on the list; it is
// there again tomorrow. A screen that loses a deal when somebody taps the
// wrong thing is a screen nobody trusts with their morning.

const SOFT = 'text-[12px] text-muted'
const WHY_P = 'text-[10.5px] text-chase bg-chase-bg border border-chase-edge rounded-full px-2 py-[1px] whitespace-nowrap font-bold'
const WHY_R = 'text-[10.5px] text-chase bg-chase-bg border border-chase-edge rounded-full px-2 py-[1px] whitespace-nowrap font-bold uppercase tracking-[.03em]'
const BRK = 'text-[10.5px] text-info bg-info-bg border border-info-edge rounded-full px-2 py-[1px] whitespace-nowrap font-bold'
// THE WEEK'S CHIP. Black, because every other colour on this screen already
// means something - see the note beside WEEK_ON in components/TodayPlan.tsx.
const WEEK_C = 'text-[9.5px] font-extrabold uppercase tracking-[0.05em] rounded-full px-2 py-[2px] whitespace-nowrap border border-ink bg-ink text-page'
const WAIT_P = 'text-[10.5px] text-waiting bg-waiting-bg border border-waiting-edge rounded-full px-2 py-[1px] whitespace-nowrap font-bold'
const CAP = 'text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted'

/** Which band a deal sits under on the list. The two instructions, then stages. */
function bandOf(d: DayDeal): string {
  if (d.rework) return 'Sent back'
  if (d.priority) return 'A broker asked'
  return String(d.stage || 'Everything else')
}

const BAND_NOTE: Record<string, string> = {
  'Sent back': 'a broker returned it',
  'A broker asked': "today's ask",
  Compliance: 'closest to lodging',
  // 19 Nov 2026. Not work she can finish, which is why it says so.
  'With the client': 'chase or wait',
}

/** The one band she cannot action. It draws quieter and it sorts last. */
const WITH_CLIENT = 'With the client'

/** Typing two letters is enough to start looking. One letter matches the book. */
const ENOUGH = 2

// WHAT THE BOX ACTUALLY LOOKS AT. The deal's name and the client's.
//
// 19 Nov 2026. It said "type a client name" and read deal_name only, so a deal
// named for anything else could not be found by the person on it.
const hit = (d: DayDeal, needle: string) =>
  `${d.name || ''} ${d.client || ''}`.toLowerCase().includes(needle)

export default function PickTheDay({
  deals, others = [], order, setOrder, notes, setNote, onItNow, setOnItNow,
  saved, busy, onConfirm, changed = false, canEdit = true, heading = 'Everything with you',
}: {
  deals: DayDeal[]
  /** Live files that are NOT hers, reachable by search only. */
  others?: DayDeal[]
  order: string[]
  setOrder: (next: string[]) => void
  notes: Record<string, string>
  setNote: (dealId: string, text: string) => void
  onItNow: string | null
  setOnItNow: (dealId: string | null) => void
  saved: string | null
  busy: boolean
  onConfirm: () => void
  /** The day has moved since she last told them - see lib/a-day-can-change.ts. */
  changed?: boolean
  canEdit?: boolean
  heading?: string
}) {
  const [drag, setDrag] = useState<string | null>(null)
  const [writing, setWriting] = useState<string | null>(null)
  const [find, setFind] = useState('')

  // A DEAL SHE TICKED OFF SOMEBODY ELSE'S BOOK STILL HAS TO DRAW. Both lists
  // answer "what is this deal called", so both go in the map.
  const byId = useMemo(
    () => new Map([...deals, ...others].map(d => [d.id, d])), [deals, others])
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

  // ---- THE LIST: everything with her, grouped, never reordered -------------
  const needle = find.trim().toLowerCase()
  const looking = needle.length >= ENOUGH
  const shown = looking ? deals.filter(d => hit(d, needle)) : deals

  const bands: Array<{ name: string; deals: DayDeal[] }> = []
  for (const d of shown) {
    const name = bandOf(d)
    const last = bands[bands.length - 1]
    if (last && last.name === name) last.deals.push(d)
    else bands.push({ name, deals: [d] })
  }

  // NOT ON HER LIST, AND SHE CAN STILL PICK IT UP. 17 Nov 2026: "we can still
  // search a deal not there". Only ever reached by typing - it is nobody's
  // suggestion, it is her going to find something.
  const mineIds = new Set(deals.map(d => d.id))
  const found = looking
    ? others.filter(d => !mineIds.has(d.id) && hit(d, needle)).slice(0, 6)
    : []

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
          className={`truncate text-[13.5px] hover:underline ${
            on ? 'font-semibold' : d.stage === WITH_CLIENT ? 'text-muted' : 'text-body'}`}>
          {d.name}
        </Link>
        <span className="flex-1" />
        {/* THE WEEK, THEN THE CLIENT, THEN THE BROKER - the order the mock
            draws them in. docs/approved-looks/today-priority-for-the-week.html */}
        {d.thisWeek && <span className={WEEK_C}>This week</span>}
        {/* WHAT THE CLIENT IS SITTING ON - documents, signing, to respond. The
            word comes from whoHasIt(), the one place that answers it. */}
        {d.stage === WITH_CLIENT && d.why && <span className={WAIT_P}>{d.why}</span>}
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

  // ---- THE DAY she is building --------------------------------------------
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
          {/* IT FOLLOWS THE DEAL INTO HER DAY. A chip that disappears the
              moment she ticks it is a chip she stops trusting. */}
          {d.thisWeek && <span className={WEEK_C}>This week</span>}
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
    <div className="mb-3 flex flex-col gap-3">

      {/* ================= THIS IS MY DAY ================= */}
      {/* IT SITS ABOVE THE LIST AND IT NEVER SCROLLS. 17 Nov 2026, Fabio, on
          it being a short column beside the list: "I can only see 5 and I
          can't roll it. So you missed that when you did the coding." Four or
          five rows is a day, and a day is never taller than the screen. */}
      <div className={`rounded-xl bg-card px-5 py-4 ${
        saved ? 'border border-card-line' : 'border-2 border-ink'}`}>
        <div className="mb-1 flex items-center gap-2">
          <span className={`${CAP} text-ink`}>2 &mdash; This is my day</span>
          <span className="flex-1" />
          {canEdit && today.length > 1 && (
            <span className="text-[10.5px] text-faint">drag to reorder</span>
          )}
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
            Nothing ticked yet.<br />Tick what you are doing today, below, and it builds here.
          </div>
        ) : (
          <div onDragOver={e => e.preventDefault()}
               onDrop={e => { e.preventDefault(); dropOn(null) }}>
            {today.map((id, i) => dayRow(id, i))}
          </div>
        )}

        <div className="mt-4">
          {/* THE CHIP STAYS AND THE BUTTON COMES BACK. See MyDay for the
              morning this was found, and lib/a-day-can-change.ts for the rule.
              Mellissa ticked three files at ten past nine and had nowhere to
              put them, because telling them once took the button away. */}
          {saved && (
            <span className={`inline-block rounded-[10px] border px-4 py-2.5 text-[13.5px] font-semibold ${changed
              ? 'border-info-edge bg-info-bg text-brand-ink'
              : 'border-done-edge bg-done-bg text-done'}`}>
              &#10003; Told the brokers &mdash; {new Date(saved).toLocaleTimeString('en-AU', { timeZone: OFFICE, hour: 'numeric', minute: '2-digit' })}
              {changed && <span className="font-normal"> &middot; {NOT_SENT}</span>}
            </span>
          )}
          {(!saved || changed) && (
            <button onClick={onConfirm} disabled={busy || !canEdit || today.length === 0}
              className={`w-full rounded-[10px] bg-ink px-5 py-2.5 text-[14px] font-semibold text-page disabled:opacity-40 ${saved ? 'mt-2' : ''}`}>
              {saveWords(busy, changed)}
            </button>
          )}
        </div>
      </div>

      {/* ================= EVERYTHING WITH YOU ================= */}
      <div className="min-w-0 rounded-xl border border-card-line bg-card px-5 py-4">
        <div className="mb-1 flex items-center gap-2">
          <span className={CAP}>{heading}</span>
          <span className="flex-1" />
          <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-faint">
            {deals.length} files &middot; {today.length} ticked
          </span>
        </div>

        {deals.length === 0 && others.length === 0 ? (
          <div className={`${SOFT} py-3`}>Nothing is sitting with you. Enjoy it.</div>
        ) : (
          <>
            <p className="mb-2 text-[11.5px] leading-relaxed text-faint">
              Nothing is ticked for you. The order is the suggestion &mdash; compliance
              first, then lending options, then borrowing capacity. Tick what you are
              doing today and it goes up into your day in that order.
            </p>

            {/* LOOKING FOR ONE THAT IS NOT HERE. 17 Nov 2026: "we can still
                search a deal not there". It searches her own list first, and
                then the rest of the book. */}
            <input value={find} onChange={e => setFind(e.target.value)}
              placeholder="Find a deal — type a client name"
              className="mb-2 w-full rounded-[10px] border border-field-line bg-page px-3.5 py-2.5 text-[13.5px]" />

            {found.length > 0 && (
              <div className="mb-2 rounded-[10px] border border-info-edge bg-info-bg px-3 py-1">
                <div className="py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-info">
                  Found &mdash; not on your list
                </div>
                {found.map(pickRow)}
              </div>
            )}

            {looking && bands.length === 0 && found.length === 0 && (
              <div className={`${SOFT} py-3`}>Nothing matches &ldquo;{find.trim()}&rdquo;.</div>
            )}

            {/* IT STOPS GROWING, IT DOES NOT GET CUT SHORT. Everything is here
                and in order; past about a dozen rows the list scrolls instead
                of running down the page. The DAY above never does. */}
            <div className="max-h-[560px] overflow-y-auto pr-1">
              {bands.map(b => (
                <div key={b.name}>
                  <div className="mb-[2px] mt-3 flex items-center gap-2.5 first:mt-1">
                    <span className={`whitespace-nowrap text-[10px] font-extrabold uppercase tracking-[0.08em] ${
                      b.name === WITH_CLIENT ? 'text-waiting' : 'text-brand-ink'}`}>
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
    </div>
  )
}
