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

export default function MilestoneFromTemplates({ templateId, onClose }: {
  templateId: TemplateId
  onClose: () => void
}) {
  const [deals, setDeals] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [term, setTerm] = useState('')
  const [picked, setPicked] = useState<Row | null>(null)
  const name = TEMPLATES.find(t => t.id === templateId)?.name || 'Email'

  useEffect(() => {
    let alive = true
    createSupabaseBrowser()
      .from('deals').select('*, clients(first_name, last_name, email)')
      .order('updated_at', { ascending: false }).limit(300)
      .then(({ data }: any) => {
        if (!alive) return
        // A test deal is not the business - lib/test-deal.ts.
        setDeals(realDealsOnly(data as any[]) as Row[])
        setLoading(false)
      })
    return () => { alive = false }
  }, [])

  if (picked) {
    return (
      <SendScreen deal={picked} templateId={templateId}
        onClose={() => setPicked(null)}
        onSent={() => { setPicked(null); onClose() }} />
    )
  }

  const t = term.trim().toLowerCase()
  const rows = deals
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
      <div className="bg-white rounded-xl border border-[#E3E6E8] shadow-lg w-full max-w-[560px] mt-10"
           onClick={e => e.stopPropagation()}>
        <div className="border-b border-[#EEF0F2] bg-[#FAFAF8] px-4 py-3 rounded-t-xl flex items-baseline gap-2">
          <b className="text-[13.5px]">{name}</b>
          <span className="text-[12px] text-[#A29889]">Which deal is this for?</span>
          <button onClick={onClose} className="ml-auto text-[#C3BDB2] hover:text-[#575046] text-[16px] leading-none">&times;</button>
        </div>

        <div className="p-4">
          <input value={term} onChange={e => setTerm(e.target.value)} autoFocus
            placeholder="Search by client or deal name…"
            className="w-full border border-[#E5DED2] rounded-lg px-3 py-2 text-[12.5px]" />

          {loading && <p className="mt-3 text-[12.5px] text-[#A29889]">Loading deals…</p>}

          {!loading && rows.length === 0 && (
            <p className="mt-3 text-[12.5px] text-[#A29889]">No deal matches that.</p>
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
                      canOpen ? 'hover:bg-[#FAF8F4]' : 'bg-[#FCFCFB] cursor-default'}`}>
                    <span className={`font-semibold truncate ${canOpen ? 'text-[#221F1B]' : 'text-[#A29889]'}`}>
                      {d.deal_name || 'Untitled deal'}
                    </span>
                    <span className="text-[11.5px] text-[#A29889] truncate">{d.lender || ''}</span>
                    <span className={`ml-auto shrink-0 text-[11px] font-semibold ${
                      ready ? 'text-[#0F7B4F]' : canOpen ? 'text-[#8A6218]' : 'text-[#C3BDB2]'}`}>
                      {item?.note || ''}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t border-[#EEF0F2] bg-[#FAFAF8] px-4 py-2.5 rounded-b-xl text-[11.5px] text-[#A29889]">
          Ready first, then what has gone, then what cannot yet — the same order as on the deal.
        </div>
      </div>
    </div>
  )
}
