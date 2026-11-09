'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { addSystemNote } from '@/components/DealFile'
import {
  SCOPE_COST, STATUS_LABEL, inWorkOrder, waitingOnAFix, readyToCheck,
  forgotten, raisedLine, whereToFixIt, noteWhenChecked, noteWhenSentBack,
  sentBackLine, type Flag,
} from '@/lib/something-is-wrong'

// THE LIST MANAGEMENT WORKS FROM.
//
// 17 Aug 2026. Alan's item 5, the half that makes the other half mean
// something: "she checks that the fix has actually been applied so the same
// error doesn't come back. Close the loop, don't repeat the mistake."
//
// TWO PILES, AND IT IS MEANT TO BE EMPTY. Waiting on a fix, and Ready to
// check. There is no chart, no total for the month, and nobody's name against
// a mistake - Fabio: "I don't see the point of counting errors." The number on
// a tab is how much work is in front of you, which is a different thing from a
// score.
//
// FIXED IS NOT FINISHED. Somebody saying they fixed it moves it to the second
// pile, not off the list. Until a second person has looked, it is not done -
// that gap is the entire ask, and "Not fixed yet" is what makes it real.
//
// RED MEANS FORGOTTEN, NOT WRONG. A fortnight with nobody touching it. Up to
// then it reads as work in hand, because that is what it is.

type Pile = 'waiting_on_a_fix' | 'ready_to_check' | 'closed'

const BTN = 'text-[12px] font-semibold rounded-lg px-3 py-1.5'
const GHOST = BTN + ' border border-line bg-card text-muted hover:bg-page'
const SOLID = BTN + ' bg-ink text-page disabled:opacity-50'

export default function SomethingWrongList() {
  const supabase = createSupabaseBrowser()
  const [me, setMe] = useState<{ id: string | null; name: string }>({ id: null, name: '' })
  const [flags, setFlags] = useState<Flag[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [pile, setPile] = useState<Pile>('waiting_on_a_fix')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [sendingBack, setSendingBack] = useState('')
  const [why, setWhy] = useState('')
  const [to, setTo] = useState('')
  const [toSaved, setToSaved] = useState('')

  async function load() {
    const { data: u } = await supabase.auth.getUser()
    if (u?.user) {
      setMe({ id: u.user.id, name: u.user.email || '' })
      const { data: p } = await supabase.from('user_profiles')
        .select('full_name').eq('id', u.user.id).maybeSingle()
      setMe({ id: u.user.id, name: (p as any)?.full_name || u.user.email || '' })
    }

    const { data } = await supabase.from('deal_flags').select('*').order('raised_at')
    const list = (data || []) as Flag[]
    setFlags(list)

    // The deal's name, so a card says which file it was seen on rather than a
    // row of identifiers.
    const ids = [...new Set(list.map(f => String(f.deal_id || '')).filter(Boolean))]
    if (ids.length) {
      const { data: deals } = await supabase.from('deals').select('id, deal_name').in('id', ids)
      const map: Record<string, string> = {}
      for (const d of (deals || []) as any[]) map[String(d.id)] = String(d.deal_name || '')
      setNames(map)
    }

    const { data: s } = await supabase.from('settings')
      .select('flag_recipients').eq('id', 'singleton').maybeSingle()
    const addr = String((s as any)?.flag_recipients || '')
    setTo(addr); setToSaved(addr)
  }
  useEffect(() => { void load() }, [])

  const waiting = inWorkOrder(waitingOnAFix(flags))
  const ready = inWorkOrder(readyToCheck(flags))
  const closed = (flags || []).filter(f => String(f.checked_at || '').trim())
    .slice().sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at))).slice(0, 20)

  const showing = pile === 'waiting_on_a_fix' ? waiting : pile === 'ready_to_check' ? ready : closed

  async function markFixed(f: Flag) {
    setBusy(f.id); setMsg('')
    const problem = await checkedWrite(
      supabase.from('deal_flags')
        .update({ fixed_at: new Date().toISOString(), fixed_by_name: me.name || null })
        .eq('id', f.id),
      'The fix')
    setBusy('')
    if (problem) { setMsg(problem); return }
    await load()
    setPile('ready_to_check')
  }

  async function sendBack(f: Flag) {
    if (!why.trim()) { setMsg('Say what is still wrong.'); return }
    setBusy(f.id); setMsg('')
    const patch = {
      fixed_at: null, fixed_by_name: null,
      sent_back_at: new Date().toISOString(), sent_back_why: why.trim(),
    }
    const problem = await checkedWrite(
      supabase.from('deal_flags').update(patch).eq('id', f.id), 'Sending it back')
    setBusy('')
    if (problem) { setMsg(problem); return }

    if (f.deal_id) {
      try {
        await addSystemNote(String(f.deal_id), noteWhenSentBack({ ...f, ...patch } as Flag), me)
      } catch { /* a missing line is smaller than a lost flag */ }
    }
    setSendingBack(''); setWhy('')
    await load()
    setPile('waiting_on_a_fix')
  }

  async function close(f: Flag) {
    setBusy(f.id); setMsg('')
    const patch = { checked_at: new Date().toISOString(), checked_by_name: me.name || null }
    const problem = await checkedWrite(
      supabase.from('deal_flags').update(patch).eq('id', f.id), 'Closing it')
    if (problem) { setBusy(''); setMsg(problem); return }

    // THE LOOP CLOSES. The person who spotted it hears back - the bit that
    // does not happen today, and the reason the same thing gets flagged twice.
    // A failed email is said out loud; the flag is closed either way.
    let told = true
    try {
      const res = await fetch('/api/flag-closed', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagId: f.id }),
      })
      told = res.ok
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setMsg((d as any)?.error || 'It is closed, but the email back did not go.')
      }
    } catch { told = false }
    if (!told && !msg) setMsg('It is closed, but the email back did not go. Tell them yourself.')

    if (f.deal_id) {
      try {
        await addSystemNote(String(f.deal_id), noteWhenChecked({ ...f, ...patch } as Flag), me)
      } catch { /* the deal's line is smaller than the closing */ }
    }
    setBusy('')
    await load()
  }

  async function saveTo() {
    setMsg('')
    const problem = await checkedWrite(
      supabase.from('settings').update({ flag_recipients: to.trim() || null }).eq('id', 'singleton'),
      'Who is told')
    if (problem) { setMsg(problem); return }
    setToSaved(to.trim())
  }

  return (
    <section className="mb-10">
      <h2 className="text-[10px] font-semibold text-faint uppercase tracking-[0.09em] mb-4
        flex items-center gap-2">
        <span className="w-[5px] h-[5px] rounded-full bg-info inline-block shrink-0" />
        Something wrong
      </h2>

      <span className="inline-flex gap-0.5 bg-line-soft rounded-[9px] p-[3px] mb-3.5">
        {(['waiting_on_a_fix', 'ready_to_check', 'closed'] as Pile[]).map(p => {
          const n = p === 'waiting_on_a_fix' ? waiting.length : p === 'ready_to_check' ? ready.length : 0
          return (
            <button key={p} onClick={() => { setPile(p); setMsg(''); setSendingBack('') }}
              className={`text-[12px] font-semibold px-3.5 py-[5px] rounded-md transition ${
                pile === p ? 'bg-card text-brand-ink shadow-sm' : 'text-muted'}`}>
              {STATUS_LABEL[p]}{n > 0 ? ' ' + n : ''}
            </button>
          )
        })}
      </span>

      {msg && <p className="text-[12px] text-chase m-0 mb-2.5 leading-[1.5]">{msg}</p>}

      {showing.length === 0 ? (
        <div className="bg-card border border-dashed border-card-line rounded-xl py-7 text-center
          text-[13.5px] text-faint">
          {pile === 'waiting_on_a_fix' ? 'Nothing is waiting on a fix.'
            : pile === 'ready_to_check' ? 'Nothing is waiting to be checked.'
            : 'Nothing has been closed yet.'}
        </div>
      ) : showing.map(f => {
        const late = forgotten(f)
        const go = whereToFixIt(f)
        const dealName = names[String(f.deal_id || '')] || ''
        return (
          <div key={f.id}
            className={`bg-card border rounded-xl px-[15px] py-[13px] mb-2.5 ${
              late ? 'border-chase-edge' : 'border-card-line'}`}>
            <div className="flex items-baseline gap-2.5 mb-1.5 flex-wrap">
              <span className="text-[13.5px] font-bold text-ink">{f.where_at}</span>
              <span className={`text-[10.5px] font-bold rounded-md px-2 py-0.5 border ${
                f.scope === 'library'
                  ? 'bg-info-bg text-brand-ink border-info-edge'
                  : 'bg-line-soft text-muted border-line'}`}>
                {f.scope === 'library' ? 'Library' : 'Deal'}
              </span>
              <span className="text-[11.5px] text-faint ml-auto">
                {raisedLine(f)}{dealName ? ' · ' + dealName : ''}
              </span>
            </div>

            <p className="text-[13px] text-body leading-[1.55] m-0 mb-2.5">{f.description}</p>

            {sentBackLine(f) && (
              <p className="text-[11.5px] text-muted leading-[1.5] m-0 mb-2.5">{sentBackLine(f)}</p>
            )}

            {sendingBack === f.id ? (
              <div className="border-t border-line-soft pt-2.5">
                <p className="text-[11.5px] text-muted m-0 mb-1.5">
                  What is still wrong? It goes back to the first pile and the clock starts again.
                </p>
                <input value={why} onChange={e => setWhy(e.target.value)} autoFocus
                  placeholder="Still showing $350 on a new quote."
                  className="w-full border border-field-line rounded-lg px-2.5 py-2 text-[12.5px]
                    bg-card text-ink outline-none focus:border-brand placeholder:text-faint" />
                <div className="flex items-center gap-2 mt-2.5">
                  <button onClick={() => { setSendingBack(''); setWhy('') }}
                    className="text-[12px] text-muted">Cancel</button>
                  <button onClick={() => void sendBack(f)} disabled={busy === f.id || !why.trim()}
                    className={SOLID + ' ml-auto'}>Send it back</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 border-t border-line-soft pt-2.5 flex-wrap">
                <span className="text-[11.5px] text-muted leading-[1.5]">
                  {pile === 'ready_to_check'
                    ? <>Marked fixed by <b className="text-ink">{f.fixed_by_name || 'somebody'}</b>
                        . Is it actually there?</>
                    : pile === 'closed'
                      ? <>Fixed and checked by <b className="text-ink">{f.checked_by_name || 'somebody'}</b>.</>
                      : <>{SCOPE_COST[f.scope]}{late && ' Nobody has touched this in a fortnight.'}</>}
                </span>

                {pile !== 'closed' && (
                  <>
                    {pile === 'ready_to_check' && (
                      <button onClick={() => { setSendingBack(f.id); setWhy(''); setMsg('') }}
                        className={GHOST}>Not fixed yet</button>
                    )}
                    <a href={go.href} className={GHOST + ' ml-auto no-underline'}>{go.label}</a>
                    <button
                      onClick={() => void (pile === 'ready_to_check' ? close(f) : markFixed(f))}
                      disabled={busy === f.id} className={SOLID}>
                      {busy === f.id ? 'Saving…'
                        : pile === 'ready_to_check' ? 'Checked — close it' : 'Mark fixed'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* WHO IS TOLD. A setting, not a name in the code - Fabio: "in case she
        * moves on". Empty means nobody is emailed and the flag still lands on
        * this list, which is the honest behaviour rather than a silent drop. */}
      <div className="border border-line-soft rounded-xl p-4 bg-page mt-6">
        <label className="text-[11px] font-semibold text-faint block mb-1">
          Who is emailed when somebody flags something
        </label>
        <p className="text-[11px] text-faint mb-2.5">
          Separate several with a comma. Leave it empty and nothing is emailed — the flag still
          appears here, and the person who raised it is told so.
        </p>
        <div className="flex items-center gap-2">
          <input value={to} onChange={e => setTo(e.target.value)}
            placeholder="info@simplifyfinance.com.au"
            className="flex-1 border border-field-line rounded-lg px-2.5 py-2 text-[12.5px]
              bg-card text-ink outline-none focus:border-brand placeholder:text-faint" />
          <button onClick={() => void saveTo()} disabled={to.trim() === toSaved.trim()}
            className={SOLID}>Save</button>
        </div>
      </div>

      <p className="text-[11.5px] text-faint leading-[1.55] mt-4 max-w-[720px]">
        Library problems come first, then the oldest, because a library problem is wrong on every
        quote until it is fixed and a deal problem is wrong on one file. Nothing here is counted or
        scored — the list exists to be emptied.
      </p>
    </section>
  )
}
