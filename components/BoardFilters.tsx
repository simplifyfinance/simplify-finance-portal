'use client'
import { useEffect, useRef, useState } from 'react'
import {
  FILTER_KEYS, FILTER_LABEL, VIEW_KEYS, VIEW_LABEL, NO_VIEW, countOn, countView, optionsFor,
  nudgeCount, filterChips, viewChips, showingLine, anyFilter, anyView, applyFilters,
  type BoardFilters as Filters, type FilterKey, type BoardView, type ViewKey,
} from '@/lib/board-filters'
import { brokerColour } from '@/lib/deal-labels'
import type { ThresholdMap } from '@/lib/board-settings'

// ONE BUTTON, AND EVERYTHING BEHIND IT.
//
// The first version put four controls in the row. Fabio, 30 Sep 2026: "dont
// want all filters sitting open can we do drop drown selection?" - so the row is
// what it always was plus one button, and the four live in a panel that folds.
//
// WHAT IS ON COMES BACK OUT AS CHIPS. A filter you have to go looking for to
// turn off is a filter that stays on by accident, and this board exists because
// nine deals once sat hidden. So the bar says both numbers, names what is on,
// and drops any of it in one click without opening anything.

export default function BoardFilters({
  deals, filters, thresholds, nameFor, colours, onToggle, onToggleNudge, onClear,
  view = NO_VIEW, onToggleView, testCount = 0, scope = 'board',
}: {
  // EVERY deal the board would show with nothing filtered. The counts beside
  // each option are worked out from this, which is why it is the whole book
  // rather than what is currently on screen.
  deals: any[]
  filters: Filters
  thresholds?: ThresholdMap
  nameFor: (key: string) => string
  colours?: { broker?: Record<string, string> }
  onToggle: (which: FilterKey, value: string) => void
  onToggleNudge: () => void
  onClear: () => void
  // SETTLED, LOST AND TEST DEALS, WHICH USED TO BE THREE BUTTONS IN THE ROW.
  // Fabio approved the tidier toolbar on 2 Oct 2026. They are counted on the
  // button and named on the bar exactly like a filter, because a control that
  // has moved out of sight is a control that gets left on by accident.
  view?: BoardView
  onToggleView?: (which: ViewKey) => void
  // Test deals only exist on some books. No tests, no row - an option that can
  // never do anything is worse than no option.
  testCount?: number
  // THE LIST NEEDS THE TOP HALF OF THIS PANEL AND NONE OF THE REST.
  //
  // Settled, lost and test deals apply to both views; broker, credit officer and
  // lender are the board's, because the list already has its own columns and
  // sorting. Without this the list would have lost its only way to show a
  // settled deal the moment those three buttons left the toolbar.
  scope?: 'board' | 'list'
}) {
  const [open, setOpen] = useState(false)
  // Opens on Broker and leaves the rest folded. Fabio's own words on which
  // matters: "thinking broekers definetly one".
  const [shut, setShut] = useState<Record<FilterKey, boolean>>({
    broker: false, officer: true, lender: true,
  })
  const box = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  // EVERYTHING THAT IS ON, counted as one number. The filters and the three
  // that moved in beside them, because the button is now the only place the
  // toolbar can say that something is changing what is on screen.
  const board = scope === 'board'
  const on = board ? countOn(filters, view) : countView(view)
  const showing = VIEW_KEYS.filter(k => k !== 'tests' || testCount > 0)
  // THE SAME FUNCTION THE BOARD FILTERS WITH. Counted here rather than counted
  // again, so the number in the panel can never disagree with the cards.
  const shown = applyFilters(deals, filters, thresholds)

  return (
    <>
      <div className="relative" ref={box}>
        <button type="button" onClick={() => setOpen(o => !o)}
          className={`px-3 py-2 text-sm rounded-lg border transition inline-flex items-center gap-1.5 ${
            on ? 'border-brand text-brand-ink bg-brand/10 font-semibold'
               : 'border-line text-muted hover:bg-gray-50'}`}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5h18M6 12h12M10 19h4" />
          </svg>
          {board ? 'Filters' : 'Showing'}
          {on > 0 && (
            <span className="bg-brand text-on-brand rounded-full text-[10px] font-bold px-1.5 leading-[16px]">
              {on}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute top-[calc(100%+6px)] left-0 z-30 w-[280px] bg-card border border-line rounded-xl shadow-[0_10px_30px_rgba(20,25,30,.16)] overflow-hidden">
            <div className="max-h-[370px] overflow-y-auto p-1.5">

              {/* WHAT IS ON THE BOARD AT ALL, before any question of whose it is.
                  These three were buttons in the toolbar until 2 Oct 2026. Two of
                  them SHOW MORE than the board otherwise would and the third shows
                  only test deals, so they sit above the filters rather than among
                  them - they answer a different question. */}
              {onToggleView && (
                <div className="pb-1 mb-1 border-b border-line-soft">
                  <div className="px-2 pt-1 pb-1.5 text-[9.5px] font-bold tracking-[.07em] uppercase text-faint">
                    Showing
                  </div>
                  {showing.map(k => (
                    <button type="button" key={k} onClick={() => onToggleView(k)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12.5px] text-left hover:bg-gray-50 ${
                        view[k] ? 'text-brand-ink font-semibold' : 'text-body'}`}>
                      <span className={`w-[15px] h-[15px] rounded border-[1.5px] flex items-center justify-center text-[9px] font-bold shrink-0 ${
                        view[k] ? 'bg-brand border-brand text-on-brand' : 'border-gray-300 text-transparent'}`}>
                        &#10003;
                      </span>
                      <span className="truncate">
                        {k === 'settled' ? 'Settled deals' : k === 'lost' ? 'Lost deals' : 'Test deals only'}
                      </span>
                      {k === 'tests' && (
                        <span className="ml-auto text-[10.5px] tabular-nums text-faint">{testCount}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* NEEDS ATTENTION IS A YES OR NO, not a list, so it does not get a
                  folding section. It rides at the top because it is the one that
                  turns the board into a worklist. */}
              {board && (<>
              <button type="button" onClick={onToggleNudge}
                className={`w-full flex items-center gap-2 px-2.5 py-2.5 rounded-lg border text-[12.5px] transition ${
                  filters.nudge ? 'border-chase-edge bg-chase-bg text-chase font-semibold'
                                : 'border-line text-body hover:border-gray-300'}`}>
                <span className={`w-[15px] h-[15px] rounded border-[1.5px] flex items-center justify-center text-[9px] font-bold ${
                  filters.nudge ? 'bg-chase border-chase text-white' : 'border-gray-300 text-transparent'}`}>
                  &#10003;
                </span>
                <span>Needs attention</span>
                <span className="ml-auto text-[10.5px] tabular-nums text-faint">
                  {nudgeCount(deals, filters, thresholds)}
                </span>
              </button>

              {FILTER_KEYS.map(which => {
                const opts = optionsFor(deals, which, filters, thresholds,
                  which === 'broker' ? (v) => nameFor(v) || v : undefined)
                const picked = filters[which].length
                return (
                  <div key={which} className="border-t border-line-soft first:border-t-0 mt-1 pt-0.5">
                    <button type="button" onClick={() => setShut(s => ({ ...s, [which]: !s[which] }))}
                      className="w-full flex items-center gap-1.5 px-2 pt-2 pb-1.5">
                      <span className="text-[9.5px] font-bold tracking-[.07em] uppercase text-faint">
                        {FILTER_LABEL[which]}
                      </span>
                      {picked > 0 && (
                        <span className="text-[10.5px] text-brand-ink font-semibold">{picked}</span>
                      )}
                      <span className={`ml-auto text-faint text-[9px] transition-transform ${
                        shut[which] ? '-rotate-90' : ''}`}>&#9662;</span>
                    </button>

                    {!shut[which] && (
                      <div className="pb-1.5 px-0.5">
                        {opts.length === 0 && (
                          <p className="text-[11.5px] text-faint px-2 py-1.5 m-0">
                            Nothing recorded on any deal
                          </p>
                        )}
                        {opts.map(o => (
                          <button type="button" key={o.value} onClick={() => onToggle(which, o.value)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12.5px] text-left text-body hover:bg-gray-50 ${
                              // AN OPTION THAT WOULD EMPTY THE BOARD IS GREYED,
                              // NOT HIDDEN. Missing from the list reads as "no
                              // deals anywhere"; a zero reads as "not with what
                              // you have already picked", which is the truth.
                              o.count === 0 && !o.picked ? 'opacity-40' : ''}`}>
                            <span className={`w-[15px] h-[15px] rounded border-[1.5px] flex items-center justify-center text-[9px] font-bold shrink-0 ${
                              o.picked ? 'bg-brand-ink border-brand-ink text-on-brand' : 'border-gray-300 text-transparent'}`}>
                              &#10003;
                            </span>
                            {which === 'broker' && (
                              <span className="w-[9px] h-[9px] rounded-full shrink-0"
                                style={{ background: brokerColour(o.value, colours?.broker) }} />
                            )}
                            <span className="truncate">{o.label}</span>
                            <span className="ml-auto text-[10.5px] tabular-nums text-faint">{o.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              </>)}
            </div>

            <div className="border-t border-line-soft bg-gray-50 px-2.5 py-2 flex items-center gap-2">
              <span className="text-[11.5px] text-faint">
                {board ? `${shown.length} of ${deals.length} deals` : `${deals.length} deals`}
              </span>
              <button type="button" onClick={onClear} disabled={!on}
                className="ml-auto text-[12px] font-semibold text-brand-ink disabled:text-faint px-1">
                Clear all
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// THE BAR. Separate, because it does not belong beside the button - it belongs
// across the top of the board, where it cannot be missed.
//
// Only drawn when something is actually on, so it never becomes furniture
// somebody learns to look past.
export function BoardFilterBar({
  filters, shown, total, nameFor, onToggle, onToggleNudge, onClear,
  view = NO_VIEW, onToggleView,
}: {
  filters: Filters
  shown: number
  total: number
  nameFor: (key: string) => string
  onToggle: (which: FilterKey, value: string) => void
  onToggleNudge: () => void
  onClear: () => void
  view?: BoardView
  onToggleView?: (which: ViewKey) => void
}) {
  // The three that moved into the panel are said here too. A control nobody can
  // see from the board is a control that stays on by accident, and this bar is
  // the one place the board promises never to be quiet.
  if (!anyFilter(filters) && !anyView(view)) return null
  const chips = filterChips(filters, (which, value) =>
    which === 'broker' ? (nameFor(value) || value) : value)
  const vchips = viewChips(view)

  return (
    <div className="mb-3 flex items-center gap-2 flex-wrap rounded-lg border border-info-edge bg-info-bg px-3 py-2">
      {/* ALWAYS BOTH NUMBERS. "Showing 14" on its own is how a filtered board
          gets mistaken for the whole book - which is the failure this board was
          built to end. See lib/board-filters.ts. */}
      <b className="text-[12.5px] text-brand-ink">{showingLine(shown, total)}</b>
      {vchips.map(c => (
        <span key={`view:${c.which}`}
          className="inline-flex items-center gap-1.5 bg-card border border-info-edge rounded-full pl-2.5 pr-1.5 py-[1px] text-[11.5px] text-brand-ink">
          {c.label}
          {onToggleView && (
            <button type="button" aria-label={`Stop ${c.label.toLowerCase()}`}
              onClick={() => onToggleView(c.which)}
              className="text-faint hover:text-brand-ink text-[13px] leading-none">&times;</button>
          )}
        </span>
      ))}
      {chips.map(c => (
        <span key={`${c.which}:${c.value}`}
          className="inline-flex items-center gap-1.5 bg-card border border-info-edge rounded-full pl-2.5 pr-1.5 py-[1px] text-[11.5px] text-brand-ink">
          {c.label}
          <button type="button" aria-label={`Stop filtering by ${c.label}`}
            onClick={() => c.which === 'nudge' ? onToggleNudge() : onToggle(c.which, c.value)}
            className="text-faint hover:text-brand-ink text-[13px] leading-none">&times;</button>
        </span>
      ))}
      <button type="button" onClick={onClear}
        className="ml-auto border border-info-edge bg-card rounded-lg px-2.5 py-1 text-[12px] font-semibold text-brand-ink hover:bg-info-bg">
        Clear all
      </button>
    </div>
  )
}
