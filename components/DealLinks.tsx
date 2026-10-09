"use client"
import Link from 'next/link'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'

// SALESTREKKER & LINKS, IN THE RAIL.
//
// one-inside-the-deal-v4.html puts the ways OUT of the portal together, as a
// rail box with Open on the right of each. They were a joined pill in the
// header and a second pill beside it, so the header carried five controls and
// the rail carried none of them.
//
// 9 Oct 2026: AND THE BOXES THAT SET THEM, because the move left them behind.
//
// This drew a row only where the link already had a value. A deal with neither
// showed one line - Summary page - and looked like a feature somebody had
// removed. The inputs were still at the bottom of the Fact Find tab, which is
// the one place a person looking at the rail will not go.
//
// Fabio: "after the restyle the BCC OneDrive and another box is missing ... add
// the 3 fields back".
//
// THE BCC IS THE ONE THAT COSTS SOMETHING. app/(app)/deals/[id]/BCForm.tsx and
// LOForm.tsx both read deal.salestrekker_bcc into the bcc of the client email.
// Empty, and every client email on this deal goes out without copying
// SalesTrekker - silently. So an empty one is red and says what it means,
// rather than being a row that is simply not drawn.
//
// NOT A SECOND COPY. These write the same four columns on the deals row that
// the Fact Find boxes write. Both doors, one record.

type Row = { key: string; label: string; value: string; kind: 'url' | 'bcc' | 'fixed'; placeholder: string }

export default function DealLinks({ deal, onUpdated }: {
  deal: any
  onUpdated?: (patch: any) => void
}) {
  const supabase = createSupabaseBrowser()
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [problem, setProblem] = useState('')

  const txt = (v: any) => String(v ?? '').trim()

  const rows: Row[] = [
    // THE LABELS AND THE PLACEHOLDERS ARE THE OLD ONES, WORD FOR WORD.
    //
    // lib/nothing-is-lost.test.ts holds every readable string on the forms
    // against a locked list and fails a ship that drops one. These seven moved
    // here out of the Fact Find rather than going away, so they are carried
    // across exactly - see the note at the top of this file.
    { key: 'onedrive_link', label: 'OneDrive folder', value: txt(deal?.onedrive_link),
      kind: 'url', placeholder: 'Paste OneDrive folder URL...' },
    { key: 'salestrekker_link', label: 'SalesTrekker card', value: txt(deal?.salestrekker_link),
      kind: 'url', placeholder: 'Paste SalesTrekker deal URL...' },
    { key: '', label: 'Summary page', value: `/deals/${deal?.id}/summary`,
      kind: 'fixed', placeholder: '' },
    { key: 'salestrekker_bcc', label: 'SalesTrekker BCC code', value: txt(deal?.salestrekker_bcc),
      kind: 'bcc', placeholder: 'e.g. deal-12345@salestrekker.com' },
  ]

  // ONE COLUMN AT A TIME, AND THE SCREEN IS TOLD WHETHER IT LANDED.
  //
  // checkedWrite rather than a bare update: a write that is refused by the
  // database must not leave the screen saying it worked. See lib/checked-write.ts.
  async function save(key: string, value: string) {
    setEditing(null)
    if (!key) return
    const clean = value.trim()
    if (clean === txt(deal?.[key])) return
    const bad = await checkedWrite(
      supabase.from('deals').update({ [key]: clean }).eq('id', deal.id), 'That link')
    if (bad) { setProblem(bad); return }
    setProblem('')
    onUpdated?.({ [key]: clean })
  }

  const open = "ml-auto text-[11.5px] font-[650] text-info hover:underline"
  const box = "w-full mt-1 text-[11.5px] border border-gray-200 rounded-lg px-2 py-1 bg-field focus:outline-none focus:border-brand"

  return (
    <div className="bg-card border border-card-line rounded-xl mb-3 px-3.5 py-3">
      <div className="flex items-center gap-2 mb-2.5">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="text-faint">
          <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" />
        </svg>
        <span className="text-[9.5px] font-bold tracking-[.09em] uppercase text-faint">SalesTrekker &amp; links</span>
      </div>

      <div>
        {rows.map(r => {
          const missing = !r.value
          const isBcc = r.kind === 'bcc'
          return (
            <div key={r.label} className={isBcc ? 'mt-1.5 pt-1.5 border-t border-line-soft' : ''}>
              <div className="flex items-baseline gap-2 py-[3px]">
                <span className={`text-[12.5px] ${missing ? (isBcc ? 'text-chase' : 'text-faint') : 'text-body'}`}>
                  {r.label}
                </span>

                {r.kind === 'fixed' ? (
                  <Link href={r.value} target="_blank" aria-label={`Open ${r.label}`} className={open}>Open</Link>
                ) : isBcc && r.value ? (
                  <span className="ml-auto text-[11.5px] text-faint truncate max-w-[55%]" title={r.value}>{r.value}</span>
                ) : r.value ? (
                  <a href={r.value} target="_blank" rel="noopener noreferrer"
                     aria-label={`Open ${r.label}`} className={open}>Open</a>
                ) : null}

                {r.kind !== 'fixed' && editing !== r.key && (
                  <button onClick={() => { setEditing(r.key); setDraft(r.value) }}
                          className={(r.value ? 'ml-2' : 'ml-auto') + ' text-[11.5px] font-[650] text-info hover:underline'}>
                    {r.value ? 'Edit' : 'Add'}
                  </button>
                )}
              </div>

              {editing === r.key && (
                <input autoFocus className={box} value={draft} placeholder={r.placeholder}
                       aria-label={r.label}
                       onChange={e => setDraft(e.target.value)}
                       onBlur={() => save(r.key, draft)}
                       onKeyDown={e => {
                         if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                         if (e.key === 'Escape') setEditing(null)
                       }} />
              )}
            </div>
          )
        })}

        {/* WHAT AN EMPTY BCC ACTUALLY COSTS. Not a blank row - a sentence. */}
        {!txt(deal?.salestrekker_bcc) && (
          <p className="text-[11px] text-chase leading-snug mt-1">
            Client emails on this deal are not copying SalesTrekker.
          </p>
        )}

        {problem && (
          <p className="text-[11px] text-chase leading-snug mt-1.5">{problem}</p>
        )}
      </div>
    </div>
  )
}
