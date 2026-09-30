'use client'
import { useEffect, useRef, useState } from 'react'
import {
  FILTER_KEYS, FILTER_LABEL, countFilters, optionsFor, nudgeCount, filterChips,
  showingLine, anyFilter, applyFilters, type BoardFilters as Filters, type FilterKey,
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

  const on = countFilters(filters)
  // THE SAME FUNCTION THE BOARD FILTERS WITH. Counted here rather than counted
  // again, so the number in the panel can never disagree with the cards.
  const shown = applyFilters(deals, filters, thresholds)

  return (
    <>
      <div className="relative" ref={box}>
        <button type="button" onClick={() => setOpen(o => !o)}
          className={`px-3 py-2 text-sm rounded-lg border transition inline-flex items-center gap-1.5 ${
            on ? 'border-[#2DBEFF] text-[#0A5E88] bg-[#2DBEFF]/10 font-semibold'
               : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5h18M6 12h12M10 19h4" />
          </svg>
          Filters
          {on > 0 && (
            <span className="bg-[#0E8FCB] text-white rounded-full text-[10px] font-bold px-1.5 leading-[16px]">
              {on}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute top-[calc(100%+6px)] left-0 z-30 w-[280px] bg-white border border-[#E5DED2] rounded-xl shadow-[0_10px_30px_rgba(20,25,30,.16)] overflow-hidden">
            <div className="max-h-[370px] overflow-y-auto p-1.5">

              {/* NEEDS ATTENTION IS A YES OR NO, not a list, so it does not get a
                  folding section. It rides at the top because it is the one that
                  turns the board into a worklist. */}
              <button type="button" onClick={onToggleNudge}
                className={`w-full flex items-center gap-2 px-2.5 py-2.5 rounded-lg border text-[12.5px] transition ${
                  filters.nudge ? 'border-[#EFD3CB] bg-[#FBEDE9] text-[#AD4227] font-semibold'
                                : 'border-[#E5DED2] text-[#575046] hover:border-[#D6CCBC]'}`}>
                <span className={`w-[15px] h-[15px] rounded border-[1.5px] flex items-center justify-center text-[9px] font-bold ${
                  filters.nudge ? 'bg-[#AD4227] border-[#AD4227] text-white' : 'border-[#CBD2D8] text-transparent'}`}>
                  &#10003;
                </span>
                <span>Needs attention</span>
                <span className="ml-auto text-[10.5px] tabular-nums text-[#C3BDB2]">
                  {nudgeCount(deals, filters, thresholds)}
                </span>
              </button>

              {FILTER_KEYS.map(which => {
                const opts = optionsFor(deals, which, filters, thresholds,
                  which === 'broker' ? (v) => nameFor(v) || v : undefined)
                const picked = filters[which].length
                return (
                  <div key={which} className="border-t border-[#F4F1EB] first:border-t-0 mt-1 pt-0.5">
                    <button type="button" onClick={() => setShut(s => ({ ...s, [which]: !s[which] }))}
                      className="w-full flex items-center gap-1.5 px-2 pt-2 pb-1.5">
                      <span className="text-[9.5px] font-bold tracking-[.07em] uppercase text-[#A29889]">
                        {FILTER_LABEL[which]}
                      </span>
                      {picked > 0 && (
                        <span className="text-[10.5px] text-[#0E8FCB] font-semibold">{picked}</span>
                      )}
                      <span className={`ml-auto text-[#C3BDB2] text-[9px] transition-transform ${
                        shut[which] ? '-rotate-90' : ''}`}>&#9662;</span>
                    </button>

                    {!shut[which] && (
                      <div className="pb-1.5 px-0.5">
                        {opts.length === 0 && (
                          <p className="text-[11.5px] text-[#C3BDB2] px-2 py-1.5 m-0">
                            Nothing recorded on any deal
                          </p>
                        )}
                        {opts.map(o => (
                          <button type="button" key={o.value} onClick={() => onToggle(which, o.value)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12.5px] text-left text-[#575046] hover:bg-[#FAF8F4] ${
                              // AN OPTION THAT WOULD EMPTY THE BOARD IS GREYED,
                              // NOT HIDDEN. Missing from the list reads as "no
                              // deals anywhere"; a zero reads as "not with what
                              // you have already picked", which is the truth.
                              o.count === 0 && !o.picked ? 'opacity-40' : ''}`}>
                            <span className={`w-[15px] h-[15px] rounded border-[1.5px] flex items-center justify-center text-[9px] font-bold shrink-0 ${
                              o.picked ? 'bg-[#0E8FCB] border-[#0E8FCB] text-white' : 'border-[#CBD2D8] text-transparent'}`}>
                              &#10003;
                            </span>
                            {which === 'broker' && (
                              <span className="w-[9px] h-[9px] rounded-full shrink-0"
                                style={{ background: brokerColour(o.value, colours?.broker) }} />
                            )}
                            <span className="truncate">{o.label}</span>
                            <span className="ml-auto text-[10.5px] tabular-nums text-[#C3BDB2]">{o.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="border-t border-[#F4F1EB] bg-[#FCFAF6] px-2.5 py-2 flex items-center gap-2">
              <span className="text-[11.5px] text-[#A29889]">
                {shown.length} of {deals.length} deals
              </span>
              <button type="button" onClick={onClear} disabled={!on}
                className="ml-auto text-[12px] font-semibold text-[#0E8FCB] disabled:text-[#C3BDB2] px-1">
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
}: {
  filters: Filters
  shown: number
  total: number
  nameFor: (key: string) => string
  onToggle: (which: FilterKey, value: string) => void
  onToggleNudge: () => void
  onClear: () => void
}) {
  if (!anyFilter(filters)) return null
  const chips = filterChips(filters, (which, value) =>
    which === 'broker' ? (nameFor(value) || value) : value)

  return (
    <div className="mb-3 flex items-center gap-2 flex-wrap rounded-lg border border-[#BEDFF3] bg-[#EAF6FD] px-3 py-2">
      {/* ALWAYS BOTH NUMBERS. "Showing 14" on its own is how a filtered board
          gets mistaken for the whole book - which is the failure this board was
          built to end. See lib/board-filters.ts. */}
      <b className="text-[12.5px] text-[#084B6E]">{showingLine(shown, total)}</b>
      {chips.map(c => (
        <span key={`${c.which}:${c.value}`}
          className="inline-flex items-center gap-1.5 bg-white border border-[#BEDFF3] rounded-full pl-2.5 pr-1.5 py-[1px] text-[11.5px] text-[#0A5E88]">
          {c.label}
          <button type="button" aria-label={`Stop filtering by ${c.label}`}
            onClick={() => c.which === 'nudge' ? onToggleNudge() : onToggle(c.which, c.value)}
            className="text-[#7FAFC9] hover:text-[#084B6E] text-[13px] leading-none">&times;</button>
        </span>
      ))}
      <button type="button" onClick={onClear}
        className="ml-auto border border-[#BEDFF3] bg-white rounded-lg px-2.5 py-1 text-[12px] font-semibold text-[#0A5E88] hover:bg-[#F4FBFF]">
        Clear all
      </button>
    </div>
  )
}
