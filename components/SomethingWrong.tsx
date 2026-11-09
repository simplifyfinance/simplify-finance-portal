'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { addSystemNote } from '@/components/DealFile'
import {
  WHERE_OPTIONS, SCOPE_LABEL, openOn, cardLine, forgotten, noteWhenRaised,
  type Flag, type Scope,
} from '@/lib/something-is-wrong'

// "SOMETHING'S WRONG HERE", IN THE RAIL.
//
// 17 Aug 2026, Alan's item 5, and Fabio's two corrections to my first draft.
//
// ONE BUTTON ON THE DEAL, NOT ONE ON EVERY FIGURE. Fabio: "are we gonna have
// buttons everywhere something is wrong here??" Fifty of them would be fifty
// things nobody sees. It sits last in the rail - Needs action and the
// documents are today's work, this is there when you want it.
//
// NOT RED. Fabio: "can we make less colour red is negative". Red in this
// portal means something has gone wrong and somebody must act today. A button
// inviting you to report something is not that; it only becomes a problem once
// somebody presses it. An open flag is blue, because work in hand is not a
// fault. The one exception is a fortnight untouched - see forgotten().
//
// AND IT NAMES NOBODY. "Tell management", not a person - Fabio: "in case she
// moves on". Who is actually emailed is a setting. The last time names went
// into the code it was ten lenders' approval terms and correcting one meant a
// ship.

const INP = 'w-full border border-field-line rounded-lg px-2.5 py-2 text-[12.5px] ' +
            'bg-card text-ink outline-none focus:border-brand'

export default function SomethingWrong({ deal, me, whereNow }: {
  deal: any
  me?: { id?: string | null; name?: string }
  /** The tab they were on, so the box fills Where in for them. */
  whereNow?: string
}) {
  const supabase = createSupabaseBrowser()
  const [open, setOpen] = useState(false)
  const [flags, setFlags] = useState<Flag[]>([])
  const [where, setWhere] = useState(whereNow || WHERE_OPTIONS[0])
  const [what, setWhat] = useState('')
  const [scope, setScope] = useState<Scope>('library')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => { if (whereNow) setWhere(whereNow) }, [whereNow])

  async function load() {
    const { data } = await supabase.from('deal_flags').select('*')
      .eq('deal_id', deal.id).is('checked_at', null).order('raised_at')
    setFlags((data || []) as Flag[])
  }
  useEffect(() => { void load() }, [deal?.id])

  const mine = openOn(flags, String(deal?.id || ''))

  async function raise() {
    if (!what.trim()) { setMsg('Say what is wrong first.'); return }
    setBusy(true); setMsg('')
    const row = {
      deal_id: deal.id,
      where_at: where,
      scope,
      description: what.trim(),
      raised_by: me?.id || null,
      raised_by_name: me?.name || null,
    }
    const { data, error } = await supabase.from('deal_flags').insert(row).select('*').single()
    if (error || !data) {
      setBusy(false)
      setMsg('That was not saved — ' + (error?.message || 'the database refused it.'))
      return
    }

    // TOLD, AND WRITTEN DOWN. The email is the point of the whole thing, so a
    // failure is said out loud rather than swallowed - but the flag is already
    // saved and it is on the list either way.
    let emailed = true
    try {
      const res = await fetch('/api/flag-raised', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagId: (data as any).id }),
      })
      emailed = res.ok
    } catch { emailed = false }

    try {
      await addSystemNote(deal.id, noteWhenRaised(data as Flag),
        { id: me?.id || null, name: me?.name || '' })
    } catch { /* a missing line is smaller than a lost flag */ }

    setBusy(false)
    setSent(true)
    setWhat('')
    void load()
    if (!emailed) {
      setMsg('It is on the list, but the email to management did not go. Tell somebody.')
    }
  }

  return (
    <div className="bg-card border border-card-line rounded-xl px-3.5 py-3">
      <p className="text-[9.5px] font-bold tracking-[.09em] uppercase text-faint m-0 mb-2">
        Something wrong?
      </p>

      {mine.length > 0 && !open && (
        <>
          {mine.map(f => (
            <p key={f.id}
              className={`text-[11.5px] rounded-lg px-2.5 py-2 mb-2 leading-[1.45] border ${
                forgotten(f)
                  ? 'text-chase bg-chase-bg border-chase-edge'
                  : 'text-brand-ink bg-info-bg border-info-edge'}`}>
              <b className="text-ink">{f.where_at}</b> — {cardLine(f)}
              {forgotten(f) && <span className="block mt-1">Nobody has touched this in a fortnight.</span>}
            </p>
          ))}
        </>
      )}

      {sent && !open && (
        <p className="text-[11.5px] text-done bg-done-bg border border-done-edge rounded-lg
          px-2.5 py-2 mb-2 leading-[1.45]">
          Sent. You will hear back when it has been fixed and checked.
        </p>
      )}

      {!open ? (
        <>
          <p className="text-[12px] text-muted leading-[1.5] m-0 mb-2">
            A fee, a rate, a calculation, a name. Goes to management, who check the fix is
            actually in.
          </p>
          {/* A LINE, NOT A BUTTON. The rail already uses this shape for Resolve
            * and Put it back, and it reads as an option rather than an alarm. */}
          <button onClick={() => { setOpen(true); setMsg(''); setSent(false) }}
            className="block text-[11.5px] font-semibold text-brand-ink">
            {mine.length > 0 ? 'Tell management about something else →' : 'Tell management →'}
          </button>
        </>
      ) : (
        <div>
          <p className="text-[10px] font-bold tracking-[.08em] uppercase text-muted m-0 mb-1.5">Where</p>
          <select value={where} onChange={e => setWhere(e.target.value)} className={INP + ' mb-1'}>
            {WHERE_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
          {whereNow && where === whereNow && (
            <p className="text-[11px] text-faint m-0 mb-2">Where you were. Change it if it is not.</p>
          )}

          <p className="text-[10px] font-bold tracking-[.08em] uppercase text-muted m-0 mt-2 mb-1.5">
            What is wrong
          </p>
          <textarea value={what} onChange={e => setWhat(e.target.value)} autoFocus rows={3}
            placeholder="ANZ Simplicity Plus settlement fee is showing $350. The loan docs say $395."
            className={INP + ' resize-none placeholder:text-faint'} />

          <p className="text-[10px] font-bold tracking-[.08em] uppercase text-muted m-0 mt-3 mb-1.5">
            Is this the library, or just this deal?
          </p>
          <div className="flex flex-col gap-1.5">
            {(['library', 'deal'] as Scope[]).map(s => (
              <button key={s} onClick={() => setScope(s)}
                className={`text-[12px] text-left rounded-lg px-2.5 py-1.5 border transition ${
                  scope === s ? 'bg-ink border-ink text-page font-semibold'
                              : 'bg-card border-line text-muted hover:bg-page'}`}>
                {SCOPE_LABEL[s]}
              </button>
            ))}
          </div>

          {msg && <p className="text-[11.5px] text-chase m-0 mt-2.5 leading-[1.5]">{msg}</p>}

          <div className="flex items-center gap-2 mt-3">
            <button onClick={() => { setOpen(false); setMsg('') }} disabled={busy}
              className="text-[12px] text-muted">Cancel</button>
            <button onClick={raise} disabled={busy || !what.trim()}
              className="ml-auto text-[12px] font-semibold bg-ink text-page rounded-lg px-3 py-1.5
                disabled:opacity-50">
              {busy ? 'Sending…' : 'Send it'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
