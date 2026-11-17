'use client'
import { useEffect, useRef, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import {
  offered, chooseSplitPatch, splitOn, sharedWithLine,
  splitShortName, termsHaveMoved, type Split,
} from '@/lib/who-shares-this-deal'
import { splitGroups, kindTail } from '@/lib/splits-groups'
import { OFFICE } from '@/lib/same-date-everywhere'

// IS THIS DEAL SHARED WITH ANYBODY?
//
// 27 Oct 2026. Fabio: "broker can seelect in Fact Find Stage what commission
// split to select so it carries accross to handover notes".
//
// WHY IT LIVES ON THE FACT FIND and not on compliance, which is where the gap
// was noticed. It is a fact about the deal, it is true from the first phone
// call, and the broker is the only person who knows it. Compliance reads it.
// Credit reads it. Neither of them can answer it.
//
// THREE ANSWERS, NOT TWO. A named arrangement, "nobody - this one is all
// ours", or nothing yet. The third is not a kind of "no": a deal nobody has
// checked and a deal somebody confirmed is ours look identical in a blank
// column, and compliance has to tell them apart. See lib/who-shares-this-deal.ts.
//
// IT DOES NOT BLOCK. Unanswered goes red here and on compliance, the same way
// the three goals boxes do. A locked screen gets worked around by lunchtime;
// something visible gets fixed.

// EVERY CLASS BELOW IS COPIED OUT OF THE APPROVED MOCK.
//
// docs/approved-looks/commission-splits.html, which was rendered with the
// stylesheet the build produced, photographed, and agreed before a line of
// this was written. lib/the-mock-and-the-screen.test.ts reads that file off
// the disk and fails the ship if the two drift apart.
const SHUT      = 'w-full flex items-center gap-2 rounded-lg border border-gray-200 bg-card px-3 py-2 text-left text-sm text-ink'
const SHUT_OPEN = 'w-full flex items-center gap-2 rounded-lg border border-ink bg-card px-3 py-2 text-left text-sm text-ink'
const SHUT_RED  = 'w-full flex items-center gap-2 rounded-lg border border-chase-edge bg-chase-bg px-3 py-2 text-left text-sm text-muted'
const PANEL     = 'mt-1 rounded-lg border border-card-line bg-card overflow-hidden'
const SCROLL    = 'max-h-[320px] overflow-y-auto'
// THE OFF-WHITE BAND BETWEEN THE GROUPS. Fabio: "you do the little off-white
// between they refer, they wrote, partner firms. Keep that off-white look and
// feel." It is the page colour, which is the portal's own off-white.
const HEAD      = 'flex items-baseline gap-1.5 bg-page px-3 py-1.5 border-b border-line-soft'
const HEAD_B    = 'text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink'
const HEAD_N    = 'text-[10.5px] text-faint'
const ITEM      = 'w-full block px-3 py-2 text-left text-[13.5px] text-ink hover:bg-page border-b border-line-soft'
const ITEM_ON   = 'w-full flex items-center gap-2 px-3 py-2 text-left text-[13.5px] bg-info-bg text-info font-semibold border-b border-line-soft'
const SUB       = 'block text-[11px] text-faint tabular-nums mt-[1px]'

export const NOBODY = '__nobody__'

// THE NAME, AND TWO NUMBERS.
//
// It used to read "Aspire Partners - Aspire Partners 20% upfront, 20% trail":
// the name twice, then two words everybody in this business already knows.
// Upfront then trail, and nothing else on the line.
// 17 Nov 2026: THE NUMBERS CAME OFF THE LIST.
//
// Fabio: "I don't really need the splits showing, it's very busy... those
// splits are important to go on the handover notes that goes to my processing
// team, but it's pretty irrelevant to my team to see it."
//
// He is right. Fifteen rows each carrying three or four percentages, and the
// person choosing can act on none of them. So the list is the NAME, grouped
// by whether they referred it or wrote it, and the split for the one that is
// actually chosen is spelled out underneath in words - see sharedWithLine.
// The handover is untouched and still carries every line.
export default function WhoSharesThisDeal({ deal, byName, onChanged }: {
  deal: any
  /** Whoever is signed in. Recorded against the answer. */
  byName: string
  onChanged?: () => void
}) {
  const supabase = createSupabaseBrowser()
  const [rows, setRows] = useState<any[]>([])
  const [chosen, setChosen] = useState<Split | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [missing, setMissing] = useState(false)
  const [live, setLive] = useState<any>(deal)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  // A CLICK ANYWHERE ELSE SHUTS IT.
  //
  // The browser's own dropdown did this for free. Drawing our own means doing
  // it ourselves, and a panel left open over the rest of the fact find is
  // worse than the box it replaced.
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  // IT ASKS THE DATABASE WHAT THIS DEAL SAYS, RATHER THAN TRUSTING A COPY.
  //
  // 28 Oct 2026. Fabio: "when we select and we change tabs, it doesn't save.
  // It just disappears."
  //
  // IT WAS SAVING. Every answer reached the database and none was ever lost.
  // What vanished was the SCREEN. `live` started from the deal object the page
  // handed over when it first loaded, and that copy was taken before anybody
  // answered. Picking an arrangement wrote to the database and updated this
  // component's own copy, so it looked right - until the tab changed, this box
  // came off screen and was rebuilt, and started again from that same stale
  // copy, which still said nobody had answered.
  //
  // So it goes and reads the eight columns itself. A component that shows a
  // fact is the component that should fetch it; a prop taken at page load is a
  // photograph, and this one was being read as a mirror.
  useEffect(() => {
    if (!deal?.id) return
    let alive = true
    supabase.from('deals').select(
      'commission_split_id, commission_split_name, commission_split_kind,'
      + ' commission_split_upfront, commission_split_trail, commission_split_lines,'
      + ' commission_split_none, commission_split_at, commission_split_by')
      .eq('id', deal.id).maybeSingle()
      .then(({ data }: any) => { if (alive && data) setLive((d: any) => ({ ...d, ...data })) })
    return () => { alive = false }
  }, [deal?.id])

  useEffect(() => {
    supabase.from('commission_splits').select('*').then(({ data, error }: any) => {
      if (error) {
        // A missing table is a setup step, not a fault in the deal. Said
        // plainly rather than as a database error nobody can action.
        setMissing(/relation .* does not exist/i.test(error.message || ''))
        return
      }
      setRows(data || [])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // THE ONES THEY USE, IN THE ORDER THEY REACH FOR THEM. See lib/split-order.ts.
  const list = offered(rows)
  const groups = splitGroups(list)
  const on = splitOn(live)
  const value = on ? (on.none ? NOBODY : (on.id || '')) : ''
  const moved = termsHaveMoved(live, rows)

  async function pick(v: string) {
    if (!v) return
    const split = v === NOBODY ? null : list.find(s => s.id === v) || null
    if (v !== NOBODY && !split) return
    setBusy(true); setErr('')
    const patch = chooseSplitPatch(split, byName)
    // RLS refuses a write by returning no rows and no error.
    const { data, error } = await supabase.from('deals').update(patch).eq('id', deal.id).select('id')
    if (error || !data?.length) {
      setErr(error?.message || 'That was not saved — nothing reached the database.')
    } else {
      setChosen(split)
      setLive((d: any) => ({ ...d, ...patch }))
      onChanged?.()
    }
    setBusy(false)
  }

  if (missing) {
    return (
      <div>
        <label className="text-xs text-gray-500 block mb-1">Is this deal shared with anybody?</label>
        <p className="text-[11.5px] text-chase m-0">
          The commission splits list is not set up yet. Run docs/who-shares-this-deal.sql in Supabase.
        </p>
      </div>
    )
  }

  const unanswered = !on

  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">
        Commission splits
        {unanswered && <span className="text-red-600 font-semibold ml-1">● Required</span>}
      </label>
      {/* THE BOX YOU PRESS.
          19 Nov 2026. This was the browser's own select box and the mock beside
          it was a drawn list. Fabio, with the two side by side: "the mock and
          reality are COMPLETELY DIFFERENT." They were, and they could not have
          been otherwise - the operating system draws that box, and it cannot
          carry a styled heading, a tick, or a second line under a name. The
          mock was never buildable with it. So the list is ours now.

          THE TAIL AFTER THE NAME tells the two Justins apart without opening
          anything. Fabio: "just say he is the referrer." See kindTail. */}
      <div ref={box} className="relative">
        <button type="button" disabled={busy}
          onClick={() => setOpen(v => !v)}
          aria-haspopup="listbox" aria-expanded={open}
          aria-label="Commission splits"
          className={unanswered ? SHUT_RED : open ? SHUT_OPEN : SHUT}>
          {on ? (on.none ? 'Simplify only' : splitShortName(on.name)) : 'Select'}
          {on && !on.none && kindTail(on.kind) && (
            <span className="text-[11px] text-muted">&middot; {kindTail(on.kind)}</span>
          )}
          <span className="flex-1" />
          <span className="text-[10px] text-faint">{open ? '\u25B2' : '\u25BC'}</span>
        </button>

        {open && (
          <div className={PANEL} role="listbox">
            <div className={SCROLL}>
              {/* NOT SHARING WITH ANYBODY IS AN ANSWER, and it is the commonest
                  one, so it is first and it is said in Fabio's own words. */}
              <button type="button" role="option" aria-selected={value === NOBODY}
                onClick={() => { setOpen(false); void pick(NOBODY) }}
                className={value === NOBODY ? ITEM_ON : ITEM}>
                {value === NOBODY && <span className="text-[11px]">&#10003;</span>}
                Simplify only
              </button>

              {/* FOUR GROUPS, IN THE ORDER HE ASKED FOR THEM. The kinds come
                  off the table - see lib/splits-groups.ts for why all fourteen
                  were reading as referrers until 19 Nov. */}
              {groups.map(g => (
                <div key={g.kind}>
                  <div className={HEAD}>
                    <span className={HEAD_B}>{g.head}</span>
                    {g.note && <span className={HEAD_N}>{g.note}</span>}
                  </div>
                  {g.rows.map(r => (
                    <button key={r.split.id} type="button" role="option"
                      aria-selected={value === r.split.id}
                      onClick={() => { setOpen(false); void pick(r.split.id) }}
                      className={value === r.split.id ? ITEM_ON : ITEM}>
                      {value === r.split.id && <span className="text-[11px]">&#10003;</span>}
                      {r.label}
                      {/* ONLY WHERE TWO ROWS WOULD OTHERWISE READ THE SAME. */}
                      {r.terms && <span className={SUB}>{r.terms}</span>}
                    </button>
                  ))}
                </div>
              ))}

              {/* AN ARRANGEMENT TAKEN OFF THE LIST STILL SHOWS ON A DEAL THAT
                  USED IT. Otherwise the box reads as something else. */}
              {on?.id && !list.some(sp => sp.id === on.id) && (
                <div className={`${ITEM} text-muted`}>
                  {splitShortName(on.name)} &mdash; no longer in use
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {unanswered ? (
        <p className="text-[11px] text-red-600 mt-1">
          Compliance cannot say who shares this deal without it
        </p>
      ) : (
        <p className="text-[11.5px] text-info mt-1 mb-0">
          {sharedWithLine(live)}. This goes to credit and onto compliance.
        </p>
      )}

      {moved && <p className="text-[11.5px] text-muted mt-1 mb-0 leading-relaxed">{moved}</p>}
      {err && <p className="text-[11.5px] text-chase mt-1 mb-0">{err}</p>}
      {chosen === null && value === NOBODY && (
        <span className="sr-only">Recorded as not shared</span>
      )}
    </div>
  )
}

// THE SAME FACT, READ ONLY, FOR COMPLIANCE AND ANYWHERE ELSE THAT SHOWS IT.
//
// Catherine, Operations Manager, 27 Oct 2026: "there is nowhere in compliance
// that we can select commissions for that deal". It is shown there, not
// chosen there - one answer, one place it is given, every other screen reads
// it. A second place to set it is a second answer waiting to disagree.
export function SharedWithBox({ deal, quiet = false }: { deal: any; quiet?: boolean }) {
  const on = splitOn(deal)
  const unanswered = !on
  const chosen = on && !on.none
    ? `${on.by || 'somebody'}${on.at ? `, ${new Date(on.at).toLocaleDateString('en-AU', { timeZone: OFFICE, day: 'numeric', month: 'short', year: 'numeric' })}` : ''}`
    : ''

  // ONE ANSWER IS ONE LINE.
  //
  // 17 Nov 2026, Fabio, on the deal card: "finding the deal cards too busy".
  // This was a full blue block, two inches tall, under another full blue
  // block, to say a thing that is almost always "nobody". On the deal it is
  // now a sentence.
  //
  // IT IS NEVER QUIET WHEN NOBODY HAS ANSWERED. The red state is the whole
  // point of the box and it only ever shows on the two screens where somebody
  // can do something about it - the fact find and compliance - so quiet is
  // refused outright rather than passed through.
  if (quiet && !unanswered) {
    return (
      <p className="m-0 text-[12.5px] leading-relaxed text-muted">
        <b className="text-ink">Shared with</b> {sharedWithLine(deal)}
        {chosen ? ` · chosen by ${chosen}` : ''}
        {' · '}Change it on the fact find.
      </p>
    )
  }

  return (
    <div className={`rounded-xl px-4 py-3 text-[12.5px] leading-relaxed border ${
      unanswered ? 'bg-chase-bg border-chase-edge text-chase' : 'bg-info-bg border-info-edge text-body'}`}>
      <b className="text-ink">Shared with</b> &nbsp; {sharedWithLine(deal)}
      {chosen && (
        <>
          <br /><b className="text-ink">Chosen by</b> &nbsp; {chosen}
        </>
      )}
      <br />
      <span className={unanswered ? 'text-chase' : 'text-muted'}>
        {unanswered
          ? 'Answer it on the fact find, under Purpose and goals.'
          : 'Change it on the fact find. It is one answer and it lives in one place.'}
      </span>
    </div>
  )
}
