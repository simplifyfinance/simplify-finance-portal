'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { phaseOf, amountOf, PHASE_LABEL, PHASE_ORDER, moveBack, PHASE_UNDO_LABEL, PHASE_UNDO_WARNING, type Phase } from '@/lib/deal-phase'
import { stageAge, ageGroupOf } from '@/lib/deal-age'
import { chipsFor, brokerColour, chipStyle, dealTitle } from '@/lib/deal-labels'
import { CREDIT_GREY, type ThresholdMap } from '@/lib/board-settings'
import { useColumnFolds } from '@/lib/use-column-folds'
import { isUrgentNow, urgentChipLabel } from '@/lib/push-answers'
import type { Alert } from '@/lib/deal-notes'
import DealPeek from '@/components/DealPeek'
import { brokerKey as keyOf } from '@/lib/broker-key'
import { sentOn } from '@/lib/bc-lanes'
// THE BOARD IS A VIEW, NOT A PLACE A DEAL IS KEPT. A column is the stage
// plus who we are waiting on, and both of those already exist.
import { GROUPS, TONE_INK, groupFoldKey, laneOf, newestFirst, readyToPush, type Group } from '@/lib/the-board-columns'
import { creditColour, cardSkin, AGREED } from '@/lib/who-in-credit-owns-it'
import { paneHeight, dragScrollBy } from '@/lib/board-pane'
import { columnCountLabel } from '@/lib/board-filters'
import {
  ALL, hasSubTabs, subTabsFor, countsFor, cardsOn, showingWords, subTabOf, type SplitColumn,
} from '@/lib/board-subtabs'
import { isOverdue } from '@/lib/the-seven-steps'
import { useSettlementSettings } from '@/lib/use-settlement-settings'
import { OFFICE } from '@/lib/same-date-everywhere'

// The whole book, in columns.
//
// The board is a VIEW of the truth, never a second way of writing it. Every card
// sits in the column lib/deal-phase.ts puts it in, so the board and the list can
// never tell different stories. Dragging a card does exactly what the button on
// the deal does — where a step needs data (a lodgement needs its lender and
// splits, or the commission history is destroyed) the drag opens that panel
// rather than writing a half-record.

// FOURTEEN COLUMNS, IN SIX GROUPS, AND NOT ONE OF TODAY'S IS GONE.
//
// 18 Nov 2026. Everything up to lodgement splits by who we are waiting on -
// Fabio: "there will be a BC with credit, which is where we're actioning. And
// then next to it... BC with client, where the client is deciding." Compliance
// sent stops being a column of its own and becomes the client half of
// Compliance, which is what it always was.
//
// NOTHING PAST LODGEMENT CHANGES. Fabio, when an early mock collapsed it:
// "you dont collapse anything after lodged remeber we just built a whole
// settlment process". Those six columns are exactly as they were, sub-tabs and
// all. What is new above them is the black bar, which groups them into the
// three things they are: a bank deciding, a team working to a date, and done.
//
// The list and the order live in lib/the-board-columns.ts, which is pure and
// tested. This file only draws it.
const LANES = GROUPS.flatMap(g => g.lanes)

// WHAT A DROP ON A COLUMN MEANS. A lane is a stage plus a holder, and only the
// stage is ever written - which is why dropping a card on "with client" and on
// "with credit" mean the same thing, and why a card cannot be dragged sideways
// between them. Who is holding a deal up is worked out, never set by hand.
const LANE_PHASE: Record<string, Phase> = {
  lead: 'fact_find',
  bc_us: 'bc', bc_client: 'bc',
  // All three Lending options columns write the same stage. Which of them a
  // deal sits in is worked out, never set - see laneOf().
  lo_docs: 'lo', lo_us: 'lo', lo_client: 'lo',
  comp_us: 'compliance', comp_client: 'compliance_sent',
  lodged: 'lodged', preapproved: 'preapproved', offer_accepted: 'offer_accepted',
  formal: 'formal', contracts_returned: 'contracts_returned',
  settlement_booked: 'settlement_booked', settled: 'settled',
}

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

// THE AGE CHIP HAS TWO STATES NOW, NOT THREE. Past the chase time it is red;
// before that it is the quiet count of days. The middle state - purple, for a
// deal that had been sitting a while but was not late yet - went with the rest
// of the colour on the card. Fabio, 18 Nov 2026: "Everything else is blank."

export default function DealBoard({ deals: dealsIn, allDeals, nameFor, colours, thresholds, alerts, onDelete, onMoveBack, showLost }: {
  deals: any[]
  // EVERY DEAL THIS BOARD WOULD SHOW WITH NOTHING FILTERED.
  //
  // A column says "3" when nothing is filtered and "3/6" when something is, so
  // a filtered count is never mistaken for the whole truth. That needs both
  // numbers, and only the page knows the second one. Absent means nothing is
  // filtered, which is what every other caller of this board means.
  allDeals?: any[]
  // A LOST COLUMN, ONLY WHEN ASKED FOR.
  //
  // There was no Lost column and the "Show lost" button sat above a board that
  // filtered lost deals out before ever reading it - so the button lit up and
  // nothing happened. Ellie, 9 Sep 2026: "once we close a deal, it doesn't
  // appear at all, even when we click Show Lost."
  //
  // The original reasoning still holds - a dead deal is not work, and a Lost
  // column on every screen every morning is clutter - so the column appears
  // only while the button is on, and nothing can be dragged into or out of it.
  showLost?: boolean
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
  onMoveBack?: (deal: any, target: Phase, fields: string[], place?: boolean) => Promise<string | null>
}) {
  const router = useRouter()
  // Folded columns, this person's own, remembered across logins.
  const { folds, toggle, refused: foldsRefused } = useColumnFolds()

  // WHICH SUB-TAB EACH COLUMN IS ON. Deliberately not remembered: the board
  // opens on All every morning. A remembered filter saves two clicks a day and
  // costs the one morning somebody opens the board, sees four cards and thinks
  // the book has emptied. Julian Kok and Belle both asked for this.
  const [subTab, setSubTab] = useState<Record<string, string>>({})

  // WHAT WAS TICKED FROM THE QUICK LOOK, until the page reloads.
  //
  // The board is handed its deals by the page and has no way to ask for them
  // again. A tick made in the quick look is already saved; this is only so the
  // card behind it agrees with the panel in front of it. A screen that
  // disagrees with itself is worse than one that made you open the deal.
  const [patched, setPatched] = useState<Record<string, any>>({})
  const deals = useMemo(
    () => Object.keys(patched).length === 0
      ? dealsIn
      : dealsIn.map(d => patched[d.id] ? { ...d, ...patched[d.id] } : d),
    [dealsIn, patched])
  // The settlement chase times, for the dot on a sub-tab.
  const settlementChase = useSettlementSettings()
  const [dragging, setDragging] = useState<string>('')
  // Which column the card is over. A lane key, not a stage - two columns can
  // share a stage and they must light up one at a time.
  const [over, setOver] = useState<string>('')

  // HOW TALL THE BOARD IS, MEASURED RATHER THAN GUESSED.
  //
  // What sits above the board changes - the filter row wraps on a narrower
  // window, a message appears - so a hardcoded offset would be wrong the moment
  // anything moved. This reads where the board actually starts and gives it the
  // rest of the screen. Null on a narrow window, which puts every part of this
  // back to what the board has always done. See lib/board-pane.ts.
  const railRef = useRef<HTMLDivElement | null>(null)
  const [paneH, setPaneH] = useState<number | null>(null)

  useEffect(() => {
    const measure = () => {
      const el = railRef.current
      if (!el) return
      setPaneH(paneHeight({
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        boardTop: el.getBoundingClientRect().top + window.scrollY,
      }))
    }
    measure()
    window.addEventListener('resize', measure)
    // The filter row wrapping, or a message appearing, moves the board down.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (ro && railRef.current?.parentElement) ro.observe(railRef.current.parentElement)
    return () => { window.removeEventListener('resize', measure); ro?.disconnect() }
  }, [])
  const [msg, setMsg] = useState('')
  // Which card is being looked at, and which column it sits in — so the arrow
  // keys can walk along that column without closing.
  const [peeking, setPeeking] = useState<{ id: string; phase: string } | null>(null)
  // A backwards drop, waiting to be confirmed.
  const [undoing, setUndoing] = useState<{ deal: any; target: Phase; clearing: Phase[]; fields: string[] } | null>(null)
  const [undoBusy, setUndoBusy] = useState(false)

  const byColumn = useMemo(() => {
    const m: Record<string, any[]> = {}
    for (const l of LANES) m[l.key] = []
    if (showLost) m['lost'] = []
    for (const d of deals) {
      // Dead deals are off the board unless somebody has asked to see them.
      if (phaseOf(d) === 'lost') { if (showLost) m['lost'].push(d); continue }
      const k = laneOf(d)
      if (k && m[k]) m[k].push(d)
    }
    // NEWEST ON TOP, EVERY COLUMN, ALWAYS.
    //
    // 18 Nov 2026, Fabio: "deal cards are always saved in chronological order".
    // Asked directly whether an urgent deal should still jump the queue he
    // chose one rule with no exceptions. An urgent deal still wears its chip;
    // it just does not move. A card whose position nobody can explain is a
    // board whose order nobody trusts.
    for (const p of Object.keys(m)) m[p] = newestFirst(m[p])
    return m
  }, [deals, showLost])

  // HOW MANY THIS COLUMN WOULD HOLD WITH NOTHING FILTERED.
  //
  // Null when nothing is filtered, which is how the header knows to print one
  // number rather than two. A folded column's count reads off the same answer,
  // because a fold that hides a count is how deals get lost and that was the
  // whole reason this board was built.
  const totalByColumn = useMemo(() => {
    if (!allDeals || allDeals.length === deals.length) return null
    const m: Record<string, number> = {}
    for (const d of allDeals) {
      if (phaseOf(d) === 'lost') { if (showLost) m['lost'] = (m['lost'] || 0) + 1; continue }
      const k = laneOf(d)
      if (k) m[k] = (m[k] || 0) + 1
    }
    return m
  }, [allDeals, deals, showLost])

  // "3/6" while a filter is on, "3" when nothing is. The wording itself lives
  // in lib/board-filters.ts, so the column, the folded strip and the bar cannot
  // disagree about how a filtered count reads.
  const countLabel = (p: string, n: number) =>
    columnCountLabel(n, totalByColumn ? (totalByColumn[p] || 0) : null)

  function onDrop(target: Phase) {
    setOver('')
    const deal = deals.find(d => d.id === dragging)
    setDragging('')
    if (!deal) return
    const from = phaseOf(deal)
    if (from === target) return

    // Closing and reopening a deal is done on the deal itself, with a reason
    // and a note. Dragging a card sideways into Lost would kill it with
    // neither, and dragging one out would silently reopen it - so the column
    // shows, and does nothing else.
    if (target === 'lost' || from === 'lost') {
      setMsg('Closing or reopening a deal is done inside the deal, so the reason is recorded.')
      return
    }

    const fi = PHASE_ORDER.indexOf(from), ti = PHASE_ORDER.indexOf(target)

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
      // A placement clears nothing and deletes nothing - the card simply sits in
      // an earlier column until the deal moves on. There is nothing to warn
      // about, so it just happens. Fabio, 3 Sep 2026: "with moving card back to
      // fact find can you stop the message as it feels unecessary". The move
      // still writes a line in the deal's file notes and emails the allocated
      // assessor, so the record is the same either way.
      if (back.place) {
        void (async () => {
          const problem = await onMoveBack(deal, target, back.fields, true)
          if (problem) setMsg(problem)
        })()
        return
      }
      // Everything else really does undo something - it clears the dates that
      // put the deal where it is. That still asks first.
      setUndoing({ deal, target, clearing: back.clearing, fields: back.fields })
      return
    }
    if (target === 'compliance_sent') {
      setMsg('Compliance sent is set by sending the compliance pack, not by dragging. Open the deal and push to SalesTrekker.')
      return
    }
    // DRAGGING FORWARD HAS NEVER MOVED A DEAL, AND NOW IT SAYS SO.
    //
    // Every step forward writes a snapshot of the loan as it stood - lender,
    // total, every split - and a drag has none of that to save. So this used
    // to carry you off to the settlement panel instead. Two things were wrong
    // with that. It went to the SAME panel wherever the card was dropped, so
    // dragging a new lead into BC opened a lodgement form. And it moved you
    // off the board with no warning, onto a deal page - which is how a fault
    // on another screen came to look like dragging had broken something.
    //
    // Fabio, 18 Nov 2026, with a screenshot of a tab that would not draw:
    // "can we ensure it just doest move and no errors?"
    //
    // So it does nothing at all now. The card stays where it is and the board
    // says in words what actually moves a deal forward.
    setMsg(`${PHASE_LABEL[target]} is recorded on the deal itself, not by dragging. `
      + 'A step forward saves the lender, the total and every split as they stood, '
      + 'and a drag has none of that to save. Open the deal and use the button.')
  }

  // THE BARS, AND THE COLUMNS UNDER EACH ONE. Lost is its own group when
  // somebody has asked to see it, and nothing can be dragged into or out of it.
  const bars: Group[] = showLost
    ? [...GROUPS, { key: 'lost', title: 'Lost', tone: 'settled', lanes: [{ key: 'lost', label: 'Lost' }] }]
    : GROUPS
  const columns: string[] = bars.flatMap(g => g.lanes.map(l => l.key))
  const shutCount = columns.filter(p => folds.includes(p)).length
  const openCount = columns.length - shutCount
  /** The stage a drop on this column means. */
  const phaseFor = (key: string): Phase => LANE_PHASE[key] || (key as Phase)
  /** Which bar this column sits under, for the square on its head. */
  const toneOf = (key: string): Group['tone'] =>
    bars.find(g => g.lanes.some(l => l.key === key))?.tone || 'settled'
  /** What this column is called. The lane knows; 'lost' is not a lane. */
  const nameOf = (key: string): string =>
    LANES.find(l => l.key === key)?.label || PHASE_LABEL[key as Phase] || key

  return (
    <div>
      {/* Confirming a backwards move that really undoes something. It names the
          dates it is about to clear, because that is what "moving backwards"
          actually is. A move back to Fact Find clears nothing, so it never gets
          here - it just happens. */}
      {undoing && (
        <div className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 p-6 overflow-y-auto"
             onClick={e => { if (e.target === e.currentTarget && !undoBusy) setUndoing(null) }}>
          <div className="bg-card rounded-2xl w-[560px] max-w-full shadow-2xl mt-16 overflow-hidden">
            <div className="px-6 pt-5">
              <h2 className="text-[17px] font-bold text-ink m-0 mb-1.5">
                Move this deal back to {PHASE_LABEL[undoing.target]}?
              </h2>
              <p className="text-[13px] text-muted m-0">{undoing.deal.deal_name}</p>
            </div>
            <div className="px-6 pt-4">
              <div className="border border-waiting-edge bg-waiting-bg rounded-[10px] px-4 py-3.5 text-[13px] text-waiting">
                <b className="text-ink">The deal will stop saying:</b>
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
                <div className="mt-2.5 border border-chase-edge bg-chase-bg rounded-[10px] px-4 py-3.5 text-[13px] text-chase">
                  <b className="text-ink">Watch out:</b>
                  <ul className="m-0 mt-1.5 pl-4">
                    {undoing.clearing.filter(p2 => PHASE_UNDO_WARNING[p2]).map(p2 => (
                      <li key={p2} className="mb-0.5">{PHASE_UNDO_WARNING[p2]}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-2.5 mb-0 text-[12.5px] text-muted">
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
                className="rounded-lg px-4 py-2 text-[13px] font-semibold border bg-ink border-ink text-page disabled:opacity-40">
                {undoBusy ? 'Moving…' : `Move it back to ${PHASE_LABEL[undoing.target]}`}
              </button>
              <button disabled={undoBusy} onClick={() => setUndoing(null)}
                className="rounded-lg px-4 py-2 text-[13px] border bg-card border-line text-body">
                Leave it where it is
              </button>
            </div>
          </div>
        </div>
      )}
      {msg && (
        <div className="mb-3 text-[12.5px] rounded-lg border border-waiting-edge bg-waiting-bg text-body px-3 py-2">
          {msg} <button onClick={() => setMsg('')} className="underline text-waiting ml-1">Dismiss</button>
        </div>
      )}
      {/* A FOLD THAT DID NOT SAVE SAYS SO - 22 Nov 2026.
          Belle and Ellesse folded columns for a week and found them open again
          every time. The write was refused the whole time and nothing on the
          board mentioned it. It is said once, here, in the words of what
          actually happened - not "an error occurred". */}
      {foldsRefused && (
        <div className="mb-3 text-[12.5px] rounded-lg border border-waiting-edge bg-waiting-bg text-body px-3 py-2">
          The columns you folded are folded for now, but the database refused to
          remember them, so they will be open again next time. Tell Fabio.
        </div>
      )}
      {/* THE PANE. See lib/board-pane.ts. On a laptop the board is exactly as
          tall as what is left of the screen, each column scrolls its own cards,
          and the sideways bar is always at the foot of it. On a narrow screen
          paneH is null and every one of these falls back to what the board has
          always done. */}
      <div ref={railRef}
        onWheel={e => {
          // A trackpad has always been able to swipe sideways. A mouse never
          // could, and most of the office uses a mouse.
          if (!e.shiftKey || !railRef.current) return
          e.preventDefault()
          railRef.current.scrollLeft += e.deltaY || e.deltaX
        }}
        onDragOver={e => {
          // You cannot drop a card into a column you cannot see. Dragging near
          // either end brings the next one along.
          if (!railRef.current || paneH === null) return
          const r = railRef.current.getBoundingClientRect()
          const by = dragScrollBy({ pointerX: e.clientX, paneLeft: r.left, paneRight: r.right })
          if (by) railRef.current.scrollLeft += by
        }}
        style={paneH === null ? undefined : { height: paneH }}
        className={`overflow-x-auto pb-2 ${paneH === null ? '' : 'overflow-y-hidden'}`}>
        <div className={`flex gap-[18px] ${paneH === null ? 'items-start' : 'items-stretch h-full'}`}
          style={{ minWidth: openCount * OPEN_W + shutCount * SHUT_W + (columns.length - 1) * GAP + bars.length * 8 }}>
          {bars.map(g => {
          // THE DARK BAR. Fabio chose it over a coloured tab and a spine:
          // "Number one, dark bar." It is the same black band the Today page
          // wears, so the two screens read as one portal.
          //
          // It carries the stage's own colour as a square and nothing else
          // coloured - a bar in the stage's colour would have put six strong
          // colours across the top of the board and left the cards with
          // nothing to say with.
          const mine = g.lanes.flatMap(l => byColumn[l.key] || [])
          const worth = mine.reduce((t, d) => t + (amountOf(d) || 0), 0)
          // FOLD THE WHOLE STAGE, BY PRESSING ITS BAR.
          //
          // 17 Nov 2026. Fabio: "when settlements is looking at one, they
          // don't care about new inquiries, BC, LO, they don't care about
          // that. They just focus on settlements. And credit don't care about
          // settlements. I want to be able to press a button on the black bar
          // and that black bar will fold."
          //
          // A folded stage keeps its bar and loses its columns: 44px instead
          // of eight hundred. The name turns on its side so it stays readable,
          // and it KEEPS ITS COUNT AND ITS TOTAL - "22 · $15.6m" is still
          // there without unfolding anything, which is the whole reason you
          // can afford to fold it.
          //
          // Per person, per browser, any combination - see
          // lib/use-column-folds.ts. Fabio, asked whether Credit and
          // Settlements should be named views: "I don't want any rules."
          const foldKey = groupFoldKey(g)
          const shut = folds.includes(foldKey)
          const count = `${mine.length}${worth > 0 ? ` \u00b7 ${money(worth)}` : ''}`
          return (
            <div key={g.title}
                 className={`flex-none flex flex-col ${shut ? 'w-[44px]' : ''} ${
                   paneH === null ? '' : 'h-full min-h-0'}`}>
              <button type="button" onClick={() => toggle(foldKey)}
                aria-expanded={!shut}
                title={shut ? `Open ${g.title}` : `Fold ${g.title} away`}
                className={`mb-2.5 rounded-[11px] bg-ink hover:bg-ink/90 transition ${
                  shut
                    ? 'flex-1 min-h-[260px] flex flex-col items-center justify-center gap-3 px-1.5 py-3.5'
                    : 'flex items-center gap-2.5 px-3.5 py-2.5'}`}>
                <span className="h-2 w-2 rounded-[2px] flex-none"
                      style={{ background: TONE_INK[g.tone] }} />
                <span className={`text-[10.5px] font-extrabold tracking-[.13em] uppercase text-page whitespace-nowrap ${
                  shut ? '[writing-mode:vertical-rl] rotate-180' : ''}`}>
                  {g.title}
                </span>
                <span className={`text-[11px] font-bold text-faint whitespace-nowrap tabular-nums ${
                  shut ? '[writing-mode:vertical-rl] rotate-180' : 'ml-auto'}`}>
                  {count}
                </span>
                <svg className={`text-faint flex-none ${shut ? 'rotate-180' : ''}`}
                     width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
              {shut ? null : (<>
              <div className={`flex gap-2.5 ${paneH === null ? 'items-start' : 'items-stretch flex-1 min-h-0'}`}>
          {g.lanes.map(l => l.key).map(p => {
            // THE COLUMN, AND THEN WHAT THE SUB-TAB IS SHOWING OF IT.
            //
            // 17 Nov 2026. Three columns gained sub-tabs because the seven
            // settlement steps are finer than the board's four columns. The
            // headline count, the money and the chase count stay the WHOLE
            // column - a filter must never make the board look emptier than
            // the book is. See lib/board-subtabs.ts.
            const colCards = byColumn[p] || []
            const split = hasSubTabs(p)
            const tab = split ? (subTab[p] || ALL) : ALL
            const cards = split ? cardsOn(colCards, p as SplitColumn, tab) : colCards
            const total = colCards.reduce((t, d) => t + (amountOf(d) || 0), 0)
            const hot = colCards.filter(d => ageGroupOf(d, thresholds) === 'nudge').length
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
                <div key={p} title={`${nameOf(p)} - ${cards.length} deal${cards.length === 1 ? '' : 's'}${total > 0 ? ' \u00b7 ' + money(total) : ''}. Click to open.`}
                  onDragOver={e => { e.preventDefault(); setOver(p) }}
                  onDragLeave={() => setOver(o => o === p ? '' : o)}
                  onDrop={() => onDrop(phaseFor(p))}
                  onClick={() => toggle(p)}
                  style={{ width: SHUT_W }}
                  className={`flex-none rounded-xl border border-dashed flex flex-col items-center gap-2 py-2.5 cursor-pointer transition ${
                    over === p ? 'border-brand-ink bg-info-bg'
                    : hot > 0 ? 'border-chase-edge bg-chase-bg'
                    : 'border-card-line bg-gray-50 hover:border-gray-300'}`}>
                  <span className={`text-[11px] font-bold tabular-nums ${hot > 0 ? 'text-chase' : 'text-body'}`}>
                    {countLabel(p, colCards.length)}
                  </span>
                  <span className="text-[9.5px] font-bold tracking-[.06em] uppercase text-faint whitespace-nowrap"
                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                    {nameOf(p)}
                  </span>
                  <svg className="mt-auto text-faint" width="11" height="11" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </div>
              )
            }

            return (
              <div key={p}
                onDragOver={e => { e.preventDefault(); setOver(p) }}
                onDragLeave={() => setOver(o => o === p ? '' : o)}
                onDrop={() => onDrop(phaseFor(p))}
                style={{ width: OPEN_W }}
                className={`flex-none rounded-xl border p-2.5 transition ${
                  paneH === null ? '' : 'flex flex-col min-h-0'} ${
                  over === p ? 'border-brand-ink bg-info-bg'
                  : 'border-line-soft bg-gray-50'}`}>
                <div className="flex items-baseline gap-1.5 mb-2 px-0.5">
                  <span className="h-[7px] w-[7px] rounded-[2px] flex-none self-center"
                        style={{ background: TONE_INK[toneOf(p)] }} />
                  <span className="text-[10.5px] font-bold tracking-[.06em] uppercase text-muted">
                    {nameOf(p)}
                  </span>
                  {/* HOW MANY, NOT THE WHOLE COLUMN.
                      One overdue deal used to turn this entire column red -
                      including every healthy deal in it - which said a column
                      had a problem without saying which card, and stopped
                      meaning anything the moment three columns were red at
                      once. The count goes here; the colour stays on the cards
                      that actually need chasing. Fabio, 7 Sep 2026.
                      Nothing about WHICH deals are overdue changes - same
                      thresholds, same settings. */}
                  {hot > 0 && (
                    <span title={`${hot} deal${hot === 1 ? '' : 's'} in ${nameOf(p)} past your chase setting`}
                      className="text-[9.5px] font-bold tracking-[.04em] uppercase rounded-full px-[7px] py-[1px] text-chase bg-chase-bg border border-chase-edge whitespace-nowrap">
                      {hot} to chase
                    </span>
                  )}
                  {/* BOTH NUMBERS WHILE A FILTER IS ON, and dimmed with it - a
                      column reading 3 must never be mistaken for the whole
                      truth. See lib/board-filters.ts. */}
                  <span title={totalByColumn ? `${cards.length} of ${totalByColumn[p] || 0} while a filter is on` : ''}
                    className={`ml-auto text-[11px] font-bold bg-card border border-card-line rounded-full px-1.5 ${
                      totalByColumn ? 'text-faint' : 'text-body'}`}>
                    {countLabel(p, colCards.length)}
                  </span>
                  <button type="button" title={`Fold ${nameOf(p)} away`}
                    onClick={e => { e.stopPropagation(); toggle(p) }}
                    className="text-faint hover:text-body leading-none -mb-[1px]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 6l-6 6 6 6" />
                    </svg>
                  </button>
                </div>
                {/* The column's own money. "How much is sitting here" is the
                    question a board is asked from across the room. */}
                <div className="text-[11px] text-muted mb-2 px-0.5 tabular-nums">
                  {total > 0 ? money(total) : '—'}
                </div>

                {/* SUB-TABS, ON THREE COLUMNS ONLY.
                  *
                  * Full words, wrapping onto a second row where they have to.
                  * The board is scanned rather than read, and a word somebody
                  * has to translate is a word they will misread on the morning
                  * it matters.
                  *
                  * IT OPENS ON ALL EVERY MORNING, which is why nothing here is
                  * remembered. Julian Kok and Belle asked for that separately:
                  * "please reset each morning so that it shows all deal cards
                  * in each sub tab. We will manually filter by outstanding if
                  * required." */}
                {split && (() => {
                  const counts = countsFor(colCards, p as SplitColumn)
                  // THE DOT IS THE STEP'S OWN CLOCK, not the column's. A deal
                  // three days into Contracts issued is late by its step and
                  // nowhere near late by the column, and the sub-tab is about
                  // the step. The column's own "to chase" chip above is
                  // unchanged and still answers the other question.
                  const lateOn = (key: string) => colCards.some(d =>
                    (key === ALL || subTabOf(d, p as SplitColumn) === key)
                    && isOverdue(d, settlementChase.chase))
                  return (
                    <>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {subTabsFor(p as SplitColumn).map(t => {
                          const on = tab === t.key
                          return (
                            <button key={t.key} type="button"
                              onClick={e => { e.stopPropagation()
                                setSubTab(prev => ({ ...prev, [p]: on ? ALL : t.key })) }}
                              className={`rounded-[7px] border px-[7px] py-[2px] text-[10.5px] font-semibold leading-[1.5] whitespace-nowrap ${
                                on ? 'border-ink bg-ink text-page' : 'border-field-line bg-card text-body hover:bg-page'}`}>
                              {t.key !== ALL && lateOn(t.key) && (
                                <span className="mr-1 inline-block h-[6px] w-[6px] rounded-full bg-brand-ink align-[1px]" />
                              )}
                              {t.label}
                              <span className={`ml-[3px] font-bold ${on ? 'opacity-75' : 'opacity-55'}`}>
                                {counts[t.key] ?? 0}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      {showingWords(cards.length, colCards.length, tab) && (
                        <div className="mb-1.5 px-0.5 text-[10.5px] text-faint">
                          {showingWords(cards.length, colCards.length, tab)}
                        </div>
                      )}
                    </>
                  )
                })()}

                {/* EVERYTHING ABOVE THIS LINE STAYS PUT while the cards scroll
                    under it. "How many and how much" is the question a board is
                    asked from across the room, and an answer that scrolls away
                    is no answer. */}
                <div className={paneH === null ? '' : 'flex-1 min-h-0 overflow-y-auto pr-0.5 -mr-0.5'}>

                {/* THE BC COLUMN USED TO BE TWO LANES INSIDE ONE COLUMN -
                    what was still being written above, what had gone out to
                    the client in a blue box below. It is two columns now,
                    which is what those lanes were always describing, so the
                    box inside the column has gone with them.

                    The reasoning has not gone anywhere. Fabio, 15 Sep 2026:
                    "dont want the deal colour to chnage as this will be
                    usefull later I want the surroounding to change". The
                    surrounding is the column. */}
                {(() => {
                  const renderCard = (d: any) => {
                  const sentLabel = p === 'bc' ? sentOn(d) : ''
                  const age = stageAge(d, thresholds)
                  const grp = ageGroupOf(d, thresholds)
                  // Now that the column stays calm, the card is the thing that
                  // has to catch the eye.
                  const needsNudge = grp === 'nudge'
                  const bKey = keyOf(d.assigned_broker) || ''
                  const amt = amountOf(d)
                  const lender = d.lenders?.name || ''
                  // Whichever date matters at this stage: when it is due to settle
                  // once that is known, otherwise how long it has sat here.
                  const settleOn = d.settled_at || d.confirmed_settlement_date || d.expected_settlement_date
                  const when = settleOn
                    ? new Date(settleOn).toLocaleDateString('en-AU', { timeZone: OFFICE, day: 'numeric', month: 'short' })
                    : age.label
                  const urgent = isUrgentNow(d)
                  // THE CARD WEARS WHOEVER IN CREDIT OWNS IT.
                  //
                  // See lib/who-in-credit-owns-it.ts. Until today this was
                  // painted by the deal's STATE - red past its chase time,
                  // purple while it waited on somebody - and both are gone.
                  // A colour answers one question, and the question is now
                  // whose desk this is on. Chasing is the chip at the bottom.
                  //
                  // GREEN TAKES OVER. Fabio, 18 Nov 2026: "So the green will
                  // take over whichever color it is." A client who has agreed
                  // to proceed is the one thing more urgent than who owns it,
                  // and the face still says who in credit has it.
                  const agreed = readyToPush(d)
                  const mine = creditColour(d.credit_officers?.name)
                  const skin = cardSkin(agreed ? AGREED : mine)
                  const people = [
                    { name: brokerNameOf(d, nameFor), colour: brokerColour(bKey, colours?.broker) },
                    ...(d.credit_officers?.name ? [{ name: d.credit_officers.name, colour: CREDIT_GREY }] : []),
                  ].filter(x => x.name)
                  return (
                    <div key={d.id} draggable
                      onDragStart={() => setDragging(d.id)}
                      onDragEnd={() => { setDragging(''); setOver('') }}
                      onClick={() => router.push(`/deals/${d.id}`)}
                      style={skin as React.CSSProperties}
                      className={`group relative overflow-hidden border rounded-[10px] px-2.5 pt-2 pb-2 mb-2 last:mb-0 cursor-pointer
                        flex flex-col h-[118px]
                        shadow-[var(--sh)] hover:shadow-[var(--shh)]
                        transition-[translate,box-shadow] duration-150 hover:-translate-y-[2px] ${
                        dragging === d.id ? 'opacity-40 border-brand-ink'
                        : urgent ? 'ring-2 ring-chase-bg' : ''}`}>

                      {/* NO "PLACED BY HAND" TAG. 18 Nov 2026, Fabio: "We do
                          not want that little tab anymore that says placed by
                          hand" - it was on the card for every reader to carry
                          and it only ever mattered to the person who moved it.
                          The placement itself is untouched: the card still
                          sits where somebody put it and still returns to where
                          the deal actually is the moment it moves on. */}
                      {onDelete && (
                        <button title="Delete this deal"
                          onClick={e => onDelete(e, d)}
                          className="absolute top-[7px] right-[30px] w-[22px] h-[22px] rounded-md border border-card-line bg-card text-faint flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:border-chase hover:text-chase hover:bg-chase-bg">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                          </svg>
                        </button>
                      )}

                      {/* A look before committing to opening it. */}
                      <button title="Quick look"
                        onClick={e => { e.stopPropagation(); setPeeking({ id: d.id, phase: p }) }}
                        className="absolute top-[7px] right-2 w-[22px] h-[22px] rounded-md border border-card-line bg-card text-muted flex items-center justify-center hover:border-brand-ink hover:text-brand-ink hover:bg-info-bg">
                        {/* ONE MAGNIFYING GLASS, the one on the approved board.
                            Fabio, 18 Nov 2026: "I don't like the little two
                            binoculars. I like the one that you mocked for me,
                            which was one single magnifying glass." */}
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
                        </svg>
                      </button>

                      {/* One line, ellipsis, full name on hover — the same shape a
                          long client name gets anywhere else. */}
                      <p className="text-[12.5px] font-[640] text-ink m-0 mr-[50px] truncate" title={d.deal_name}>
                        {dealTitle(d.deal_name)}
                      </p>
                      <p className="text-[9.5px] font-bold tracking-[.07em] uppercase text-faint m-0 mb-[5px] truncate"
                         title={`Home loan${lender ? ` · ${lender}` : ''}${sentLabel ? ` · ${sentLabel}` : ''}`}>
                        Home loan{lender ? ` · ${lender}` : ''}{sentLabel ? ` · ${sentLabel}` : ''}
                      </p>

                      {/* The money is the biggest thing on a card about a loan book. */}
                      <div className="flex items-center gap-1.5 mb-1">
                        {amt !== null
                          ? <span className="text-[14px] font-[680] text-ink tabular-nums tracking-[-.01em]">{money(amt)}</span>
                          : <span className="text-[11.5px] text-faint">No amount recorded</span>}
                        {/* A DATE, OR NOTHING. The plain day count was printed
                            here AND in the chip at the foot of the card, so
                            every card said "3 days" twice. A settlement in the
                            diary is a different fact and still shows. */}
                        {settleOn && (
                          <span className="ml-auto text-[11px] text-muted tabular-nums">{when}</span>
                        )}
                      </div>

                      {/* NOT ON THE CARD ANY MORE. 22 Oct 2026, Fabio: "deal
                          cards are gettign too bsy", and of what needs
                          chasing, "these needs chasign are just documents
                          missing etc so havign them in the deal card in red
                          and binoculars is enough".
                          //
                          He is right, and the reason is the content. These are
                          a missing payslip and an unanswered email, not a deal
                          on fire - and printed as a full sentence, two of them
                          turned a column into a wall of red before anybody had
                          read a deal name.
                          //
                          THEY ARE NOT HIDDEN. The binoculars open on any card
                          and lead with them, and they are in red at the top of
                          the deal itself. What has gone is the sentence on the
                          face of the card. */}

                      {/* WHAT THE DEAL IS, AND NOTHING ABOUT WHO IS HOLDING IT.
                          18 Nov 2026. Fabio, once the columns said it: "With us
                          and with the client, doesn't that defeat the purpose
                          now that we have the breakdown of all the portal
                          between us and them? Like, it doesn't make sense." It
                          does not. The column is the holder; the card says what
                          the deal IS, which no column can.

                          "Documents" went with it, and for a worse reason. It
                          was never tracked, only inferred - documents asked for
                          and a button never pressed - and on the day we counted,
                          only 17 of 56 deals had ever had that button pressed.
                          A label that says more about a button than a deal does
                          not belong on a card.

                          TWO LABELS TODAY, MORE LATER. Fabio: "eventually I want
                          to add the referral partners, the loan splits... I want
                          that to be a label so it's easier for us to put it onto
                          a filter". They join chipsFor() in lib/deal-labels.ts,
                          which is the one place a label is decided, so a new one
                          appears on the card and in the filter together. */}
                      <div className="flex gap-1 items-center min-w-0 min-h-[19px] overflow-hidden">
                        {/* THE CHIP KEEPS ITS OWN COLOUR, ALWAYS.
                            18 Nov 2026. When the card started wearing a credit
                            officer's colour, every card became a "washed" card
                            - and a washed card used to turn its chips white so
                            they would not muddy into the tint behind them. The
                            result was a board where Purchase, Refinance and
                            Owner occupied were all the same white chip.
                            Fabio: "the owner occupied has a color, it's purple.
                            Purchase, it's blue. Why did you change everything
                            on the live version?"
                            The card tint and the chip tint are different hues
                            and read fine over each other, which the approved
                            mock shows on every card. So the chip wears its own
                            colour and the wash argument is not used here. */}
                        {chipsFor(d, colours).map(c => (
                          <span key={c.id} title={c.label}
                                className="max-w-full truncate text-[9px] font-bold tracking-[.04em] uppercase rounded px-1.5 py-[2px] border"
                                style={chipStyle(c.colour)}>{c.label}</span>
                        ))}
                      </div>

                      {/* THE DAY COUNT, ON ITS OWN LINE, AT THE FOOT OF THE CARD.
                          Red only once it is past the chase time you set for
                          that column - Fabio, 18 Nov: "the little tab that says
                          45 days to chase that is red. Everything else is blank".
                          Nothing else on this card ever goes red. */}
                      {/* A ROW SHORTER THAN THE CHIP IN IT SHAVES THE CHIP.
                          18 Nov 2026, Fabio on the mock: "see the little 21-day
                          chase. Why is that messed up? ... All the warning ones
                          are not centered and properly done inside the label."
                          The row was 19px and the chip wants 19 of its own, so
                          with the card clipping its overflow the bottom border
                          was cut off every one. min-height, never height. */}
                      <div className="mt-auto pt-1.5 flex gap-1 items-center min-w-0 min-h-[19px]">
                        {/* The urgent chip sits in this row now, beside the day
                            count, instead of above the deal name - where it used
                            to push every other card out of shape. */}
                        {urgent && (
                          <span title={urgentChipLabel(d)}
                            className="max-w-full truncate text-[9px] font-bold tracking-[.04em] uppercase rounded px-1.5 py-[2px] border text-chase bg-chase-bg border-chase-edge">
                            {urgentChipLabel(d)}
                          </span>
                        )}
                        {age.days !== null && (
                          <span className={`max-w-full truncate text-[9px] font-bold tracking-[.04em] uppercase rounded px-1.5 py-[2px] border ${
                            needsNudge ? 'text-chase bg-chase-bg border-chase-edge' : 'text-faint bg-card border-card-line'}`}>
                            {needsNudge ? `${age.label} \u00b7 chase` : age.label}
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
                  }

                  return cards.map(renderCard)
                })()}

                {cards.length === 0 && (
                  <p className="text-[11px] text-faint text-center py-4 m-0">—</p>
                )}
                </div>
              </div>
            )
          })}
              </div>
              </>)}
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
            onSaved={patch => setPatched(prev => ({ ...prev, [d.id]: { ...(prev[d.id] || {}), ...patch } }))}
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
