'use client'
import { useState } from 'react'
import SettlementTrail from '@/components/SettlementTrail'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'

// WHAT HAPPENED ON THIS DEAL, ON EVERY DEAL, AT EVERY STAGE.
//
// 26 Nov 2026. Belle, on Thomas and Sally Isherwood: "loan docs have just been
// issued im gonna put a comment in the latest update but I couldnt find that
// section in that particular deal - why this section is missing from particular
// deal".
//
// THE HISTORY, BECAUSE IT EXPLAINS THE SHAPE OF THIS FILE.
//
// 24 Aug 2026: the settlement panel was built for the settlements team, and
// "Latest update" was one line inside it - the placeholder text was "settling
// 3pm". A settlement field. The panel hid itself before lodgement, which was
// right: there is no settlement to update before a deal reaches the bank.
//
// 15 Nov 2026, Fabio: "Latest update - a trail, not a box. Every entry dated
// and named, nothing typed over." And at that moment it stopped being a
// settlement field. It became the place anybody writes down what happened -
// calls, emails, chasing - which happens from the first phone call onwards.
//
// It stayed inside the August box and inherited the August rule. Nobody moved
// it out, including me, and I built the trail. It took three weeks and Belle.
//
// Fabio, 26 Nov: "Whatever goes in and out. Like, you should always be
// available at all times. It can't be tied to a lodgement date."
//
// SO THESE TWO LIVE OUT HERE NOW, with no gate of any kind. The seven steps,
// the contracts and the discharge stay inside the settlement panel, because
// those are jobs that cannot start before a deal is lodged and on a new lead
// they are a row of empty boxes for work nobody has begun.
//
// IT WRITES ONE COLUMN AT A TIME. The settlement panel saves a whole draft of
// fifteen fields at once; this saves only the trail it was handed. Two writers
// on one row is how the settlement note used to lose entries.
export default function TheDealTrail({ deal, me, onUpdated }: {
  deal: any
  me?: { id?: string | null; name?: string | null }
  onUpdated?: (patch: any) => void
}) {
  const supabase = createSupabaseBrowser()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save(patch: Record<string, any>) {
    setBusy(true); setErr('')
    // RLS REFUSES A WRITE BY RETURNING NO ROWS AND NO ERROR, so the row coming
    // back is the only proof. A note that looks saved and is not is worse than
    // no note at all - it is the one somebody relies on next week.
    const problem = await checkedWrite(
      supabase.from('deals').update(patch).eq('id', deal.id), 'That note')
    setBusy(false)
    if (problem) { setErr(problem); return }
    onUpdated?.(patch)
  }

  return (
    <div className="px-4 pb-3">
      {/* ATTN SETTLEMENTS - THE FIELD THAT CROSSES THE HANDOVER.
          The broker and the credit manager write into it long before the file
          lands with settlements. That was the whole point of it, and until
          today it could not be written until after lodgement. */}
      <div className="rounded-xl border border-info-edge border-l-[4px] border-l-info bg-info-bg px-4 py-3 mb-3">
        <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-[.08em] text-info">
          ATTN Settlements
        </div>
        <SettlementTrail deal={deal} column="attn_settlements" me={me?.name || ''} busy={busy} tone="info"
          placeholder="Anything settlements need to know about this file"
          onWrite={save} />
      </div>

      <div className="rounded-xl border border-card-line bg-card px-4 py-3">
        <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-[.08em] text-muted">
          Latest update
        </div>
        <SettlementTrail deal={deal} me={me?.name || ''} busy={busy} onWrite={save} />
      </div>

      {err && <p className="m-0 mt-2 text-[12px] text-chase">{err}</p>}
    </div>
  )
}
