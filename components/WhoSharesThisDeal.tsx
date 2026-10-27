'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import {
  offered, splitInWords, chooseSplitPatch, splitOn, sharedWithLine,
  termsHaveMoved, type Split,
} from '@/lib/who-shares-this-deal'

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

const INP = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand bg-card'
const RED = 'w-full border border-red-500 bg-red-50/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 ring-2 ring-red-500/10'

export const NOBODY = '__nobody__'

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

  const list = offered(rows)
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
        Is this deal shared with anybody?
        {unanswered && <span className="text-red-600 font-semibold ml-1">● Required</span>}
      </label>
      <select className={unanswered ? RED : INP} value={value} disabled={busy}
        aria-label="Is this deal shared with anybody?"
        onChange={e => pick(e.target.value)}>
        {unanswered && <option value="">Select</option>}
        <option value={NOBODY}>Nobody — this one is all ours</option>
        {list.map(s => (
          <option key={s.id} value={s.id}>{splitInWords(s)}</option>
        ))}
        {/* AN ARRANGEMENT TAKEN OFF THE LIST STILL SHOWS ON A DEAL THAT USED
            IT. Otherwise the dropdown would silently read as something else. */}
        {on?.id && !list.some(s => s.id === on.id) && (
          <option value={on.id}>{on.name} — no longer in use</option>
        )}
      </select>

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
export function SharedWithBox({ deal }: { deal: any }) {
  const on = splitOn(deal)
  const unanswered = !on
  return (
    <div className={`rounded-xl px-4 py-3 text-[12.5px] leading-relaxed border ${
      unanswered ? 'bg-chase-bg border-chase-edge text-chase' : 'bg-info-bg border-info-edge text-body'}`}>
      <b className="text-ink">Shared with</b> &nbsp; {sharedWithLine(deal)}
      {on && !on.none && (
        <>
          <br /><b className="text-ink">Chosen by</b> &nbsp; {on.by || 'somebody'}
          {on.at ? `, ${new Date(on.at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
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
