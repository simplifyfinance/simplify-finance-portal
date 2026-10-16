'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { SendScreen } from '@/components/MilestoneEmails'
import { TEMPLATES, menuFor, type TemplateId } from '@/lib/milestone-emails'
import { realDealsOnly } from '@/lib/test-deal'

// THE MILESTONE EMAILS, REACHED FROM THE TEMPLATES PAGE.
//
// They live on the deal because they are built from one - the figures, the
// lender, the clients. But somebody who has decided to send a formal approval
// does not always want to go and find the deal first, so this is the other door:
// pick the email, then pick the deal.
//
// IT OPENS THE SAME SCREEN. See the note on SendScreen in MilestoneEmails.tsx -
// a second copy of it would drift from the one on the deal, and the one on the
// deal would be the one that got fixed.
//
// WHAT CANNOT SEND YET IS LISTED, NOT HIDDEN. A deal missing from the list is a
// question somebody has to ask; a greyed one that says "not formally approved
// yet" is an answer. Same rule as the strip on the deal itself.

type Row = { id: string; deal_name: string; [k: string]: any }

// The search result first, then anything already loaded that it did not
// return. One row per deal - a deal in both lists must not appear twice.
function mergeById(first: Row[], rest: Row[]): Row[] {
  const seen = new Set(first.map(r => String(r.id)))
  return [...first, ...rest.filter(r => !seen.has(String(r.id)))]
}

export default function MilestoneFromTemplates({ templateId, onClose }: {
  templateId: TemplateId
  onClose: () => void
}) {
  const [deals, setDeals] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [term, setTerm] = useState('')
  const [picked, setPicked] = useState<Row | null>(null)
  // WHAT THE DATABASE SAID WHEN SOMEBODY TYPED. Separate from `deals`, which is
  // the browse list, so clearing the box goes straight back to it.
  const [found, setFound] = useState<Row[] | null>(null)
  const [searching, setSearching] = useState(false)
  const name = TEMPLATES.find(t => t.id === templateId)?.name || 'Email'

  useEffect(() => {
    let alive = true
    createSupabaseBrowser()
      .from('deals').select('*, clients(first_name, last_name, email)')
      // created_at, not updated_at. Deals have no updated_at column, so the
      // first version of this returned an error and no rows - and because the
      // error was thrown away, every search said "No deal matches that" as if
      // the typing were at fault. Every other deals query in the portal orders
      // by created_at; this one is no different.
      .order('created_at', { ascending: false }).limit(300)
      .then(({ data, error }: any) => {
        if (!alive) return
        // A FAILED LOAD AND AN EMPTY SEARCH MUST NEVER LOOK THE SAME. One is a
        // broken screen, the other is a word that matches nothing, and the only
        // thing that tells them apart is the error - so it is kept and shown.
        if (error) setLoadError(error.message || 'the deals could not be loaded')
        // A test deal is not the business - lib/test-deal.ts.
        setDeals(realDealsOnly(data as any[]) as Row[])
        setLoading(false)
      })
    return () => { alive = false }
  }, [])

  // TYPING ASKS THE DATABASE. IT DOES NOT SIFT WHAT IS ALREADY HERE.
  //
  // 16 Oct 2026. Fabio: "template box is not searching - Richard Lake is marked
  // formal and not showing." The search was working perfectly. It had nothing
  // to find.
  //
  // The load above takes the 300 most recent deals and the browser filters
  // those. On his book that is 300 rows of which 39 survive realDealsOnly -
  // the rest are test deals and copies - and the Lake deal, opened on 11 Sep,
  // is older than the cut. So it was never in the list, the filter correctly
  // matched nothing, and the screen said "No deal matches that", which reads as
  // "you typed it wrong".
  //
  // THE FILE'S OWN RULE, BROKEN BY ITS OWN QUERY. The note at the top says a
  // deal missing from the list is a question somebody has to ask, and that is
  // why nothing here is hidden for not being ready. A silent limit of 300 is
  // the same fault arriving through the back door.
  //
  // So a term goes to the database. The browse list stays as it was - a search
  // box that only works when you have typed enough is worse than one that
  // always works - and the result replaces it only while there is a term.
  useEffect(() => {
    const t = term.trim()
    if (!t) { setFound(null); setSearching(false); return }
    let alive = true
    setSearching(true)
    // Debounced, because this runs on every keystroke and each one is a query.
    const id = setTimeout(() => {
      createSupabaseBrowser()
        .from('deals').select('*, clients(first_name, last_name, email)')
        // The deal name carries the clients' names on every deal this portal
        // has made - "Richard Lake & Letitia Lake 2026" - so one ilike covers
        // both of the things somebody types. The client columns are searched
        // too, for the deals named something else entirely.
        .or(`deal_name.ilike.%${t.replace(/[%,()]/g, '')}%`)
        .order('created_at', { ascending: false }).limit(40)
        .then(({ data, error }: any) => {
          if (!alive) return
          if (error) setLoadError(error.message || 'the search could not run')
          else setLoadError('')
          setFound(realDealsOnly(data as any[]) as Row[])
          setSearching(false)
        })
    }, 250)
    return () => { alive = false; clearTimeout(id) }
  }, [term])

  if (picked) {
    return (
      <SendScreen deal={picked} templateId={templateId}
        onClose={() => setPicked(null)}
        onSent={() => { setPicked(null); onClose() }} />
    )
  }

  const t = term.trim().toLowerCase()
  // WHAT THE DATABASE FOUND, WHERE SOMEBODY HAS TYPED. The local filter stays
  // on top of it: it catches a client name the deal is not named after, and it
  // keeps the list responsive between keystrokes while the query is in flight.
  const source = t ? mergeById(found || [], deals) : deals
  const rows = source
    .map(d => ({ d, item: menuFor(d).find(m => m.id === templateId) }))
    .filter(({ d }) => !t
      || String(d.deal_name || '').toLowerCase().includes(t)
      || `${d.clients?.first_name || ''} ${d.clients?.last_name || ''}`.toLowerCase().includes(t))
    // READY FIRST, then what has gone, then what cannot yet - the same order the
    // strip on the deal uses, so the two never read differently.
    .sort((a, b) => {
      const rank = (s?: string) => s === 'ready' ? 0 : s === 'sent' ? 1 : 2
      const r = rank(a.item?.state) - rank(b.item?.state)
      return r !== 0 ? r : String(a.d.deal_name || '').localeCompare(String(b.d.deal_name || ''))
    })
    .slice(0, 60)

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center p-4 overflow-auto"
         onClick={onClose}>
      <div className="bg-card rounded-xl border border-[#E3E6E8] shadow-lg w-full max-w-[560px] mt-10"
           onClick={e => e.stopPropagation()}>
        <div className="border-b border-[#EEF0F2] bg-[#FAFAF8] px-4 py-3 rounded-t-xl flex items-baseline gap-2">
          <b className="text-[13.5px]">{name}</b>
          <span className="text-[12px] text-faint">Which deal is this for?</span>
          <button onClick={onClose} className="ml-auto text-faint hover:text-[#575046] text-[16px] leading-none">&times;</button>
        </div>

        <div className="p-4">
          <input value={term} onChange={e => setTerm(e.target.value)} autoFocus
            placeholder="Search by client or deal name…"
            className="w-full border border-[#E5DED2] rounded-lg px-3 py-2 text-[12.5px]" />

          {loading && <p className="mt-3 text-[12.5px] text-faint">Loading deals…</p>}

          {!loading && loadError && (
            <p className="mt-3 text-[12.5px] text-chase bg-chase-bg border border-chase-edge rounded-lg px-3 py-2.5 leading-[1.5]">
              The deals could not be loaded — {loadError}. Nothing is wrong with what you typed.
            </p>
          )}

          {!loading && !loadError && rows.length === 0 && (
            <p className="mt-3 text-[12.5px] text-faint">
              {searching ? 'Searching every deal\u2026' : 'No deal matches that \u2014 every deal was searched, not just the ones listed.'}
            </p>
          )}

          {/* WHAT YOU ARE LOOKING AT, SAID OUT LOUD. The browse list is the
              recent deals; the box reaches the rest. Before this, a deal older
              than the list was simply not there and nothing said so. */}
          {!loading && !loadError && !t && rows.length > 0 && (
            <p className="mt-2 mb-0 text-[11.5px] text-faint">
              The {rows.length} most recent. Type a name to search every deal.
            </p>
          )}

          {!loading && rows.length > 0 && (
            <div className="mt-3 border border-[#F0EFEC] rounded-lg overflow-hidden max-h-[340px] overflow-y-auto">
              {rows.map(({ d, item }) => {
                const ready = item?.state === 'ready'
                const canOpen = item?.state !== 'not_yet'
                return (
                  <button key={d.id} type="button" disabled={!canOpen}
                    onClick={() => setPicked(d)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 border-b border-[#F7F6F4] last:border-b-0 text-[12.5px] ${
                      canOpen ? 'hover:bg-[#FAF8F4]' : 'bg-panel cursor-default'}`}>
                    <span className={`font-semibold truncate ${canOpen ? 'text-ink' : 'text-faint'}`}>
                      {d.deal_name || 'Untitled deal'}
                    </span>
                    <span className="text-[11.5px] text-faint truncate">{d.lender || ''}</span>
                    <span className={`ml-auto shrink-0 text-[11px] font-semibold ${
                      ready ? 'text-done' : canOpen ? 'text-info' : 'text-faint'}`}>
                      {item?.note || ''}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t border-[#EEF0F2] bg-[#FAFAF8] px-4 py-2.5 rounded-b-xl text-[11.5px] text-faint">
          Ready first, then what has gone, then what cannot yet — the same order as on the deal.
        </div>
      </div>
    </div>
  )
}
