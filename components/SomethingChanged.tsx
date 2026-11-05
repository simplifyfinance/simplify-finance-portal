'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { checkedWrite } from '@/lib/checked-write'
import { addSystemNote } from '@/components/DealFile'
import { dealRow } from '@/lib/deal-structure'
import {
  CHANGEABLE, lodgedAnswer, nameOf, buildChange, withChange, marked,
  liveChanges, noteFor, alertFor, recordedBy, type Change,
} from '@/lib/changed-since-lodgement'

// THE CLIENT MOVED HOUSE WHILE THE DEAL WAS WITH THE BANK.
//
// 17 Aug 2026, Ellie. The fact find is read only past lodgement, so the new
// address had nowhere to go and the only button on the screen was Unlock the
// deal - which means typing over the record of what was submitted. Fabio: "I
// don't want it to be a mess of people unlocking things and changing names and
// numbers and addresses."
//
// WHY IT SITS OUT HERE RATHER THAN ON THE FIELD ITSELF.
//
// The lock is one <fieldset disabled> wrapped around the whole tab - see
// TabLock. The browser disables every control inside it, which is exactly why
// that lock has never leaked. A live button in there would need an exception,
// and an exception to "everything inside this is dead" is the kind of thing
// that quietly stops being true. So the change is recorded from the bar, and
// what has been recorded is listed underneath it, on the same tab.
//
// The lodged fact find above is untouched and stays untouched. Nothing here
// writes to fact_find_data.

const INP = 'w-full border border-field-line rounded-lg px-2.5 py-2 text-[12.5px] ' +
            'bg-card text-ink outline-none focus:border-brand'

export default function SomethingChanged({ deal, me, onDealPatched }: {
  deal: any
  me: { id: string | null; name: string }
  onDealPatched: (patch: any) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const applicants: any[] = (deal?.fact_find_data?.applicants || []).filter((a: any) => a?.id)
  const [who, setWho] = useState(applicants[0]?.id || '')
  const [field, setField] = useState(CHANGEABLE[0].key)
  const [now, setNow] = useState('')
  const [note, setNote] = useState('')

  const applicant = applicants.find(a => a.id === who) || applicants[0]
  const was = lodgedAnswer(applicant, field)
  const list = liveChanges(deal)
  const chosen = CHANGEABLE.find(f => f.key === field)

  function reset() {
    setOpen(false); setNow(''); setNote(''); setMsg('')
    setField(CHANGEABLE[0].key)
  }

  async function record() {
    const entry = buildChange(
      { field, applicantId: who, applicantName: nameOf(applicant), was, now, note },
      me)
    if (!entry) {
      setMsg(now.trim() === was.trim()
        ? 'That is what the fact find already says, so there is nothing to record.'
        : 'Type the new answer first.')
      return
    }
    setBusy(true); setMsg('')

    const next = withChange(deal, entry)
    const problem = await checkedWrite(
      supabase.from('deals').update({ changes_since_lodgement: next }).eq('id', deal.id),
      'That change')
    if (problem) { setBusy(false); setMsg(problem); return }

    // THE FILE NOTE IS THE POINT, so it is not best-effort. If it cannot be
    // written the change is still saved - it is already on the deal and losing
    // it would be worse - but nobody is told it is all fine.
    const { error: noteErr } = await addSystemNote(deal.id, noteFor(entry), me)

    // AND THE CHASE IS AN ALERT, because Needs action already exists, already
    // shows as a red chip on the pipeline without the deal being opened, and
    // already records who resolved it and when. A second list beside it would
    // be the same thing twice. See components/DealFile.tsx.
    const { error: alertErr } = await supabase.from('deal_alerts').insert({
      deal_id: deal.id,
      // The lender the deal is actually with, which is the client's
      // decision where one was given. dealRow answers that in one place.
      title: alertFor(entry, dealRow(deal).lender),
      owner_name: deal?.assigned_broker || null,
      author_name: me.name || null,
    })

    setBusy(false)
    onDealPatched({ changes_since_lodgement: next })
    if (noteErr || alertErr) {
      setMsg('Recorded on the deal. ' +
        (noteErr ? 'The file note did not save. ' : '') +
        (alertErr ? 'Needs action did not get its line. ' : '') +
        'Tell somebody rather than pressing it again.')
      return
    }
    reset()
  }

  async function undo(c: Change) {
    setBusy(true); setMsg('')
    const next = marked(deal, c.id,
      { undoneAt: new Date().toISOString(), undoneBy: me.name || null })
    const problem = await checkedWrite(
      supabase.from('deals').update({ changes_since_lodgement: next }).eq('id', deal.id),
      'That change')
    setBusy(false)
    if (problem) { setMsg(problem); return }
    // Marked, never deleted. A row that vanishes is one nobody can ask about.
    await addSystemNote(deal.id,
      `${c.label} change withdrawn. It said: ${c.now}.`, me)
    onDealPatched({ changes_since_lodgement: next })
  }

  return (
    <div className="mt-3">
      {list.length > 0 && (
        <div className="border border-info-edge bg-info-bg rounded-xl px-3 py-2.5 mb-2">
          <p className="text-[10px] font-bold tracking-[.07em] uppercase text-brand-ink m-0 mb-2">
            Changed since lodgement
          </p>
          {list.map(c => (
            <div key={c.id} className="flex items-start gap-3 py-1.5 border-t border-info-edge first:border-t-0">
              <div className="min-w-0">
                <p className="text-[11px] text-muted m-0">
                  {c.applicantName ? c.applicantName + ' · ' : ''}{c.label}
                </p>
                {c.was && (
                  <p className="text-[12px] text-muted line-through m-0 mt-[2px]">{c.was}</p>
                )}
                <p className="text-[13px] text-ink font-[600] m-0 mt-[2px]">{c.now}</p>
                <p className="text-[11px] text-faint m-0 mt-[3px]">
                  {recordedBy(c)}{c.note ? ' · ' + c.note : ''}
                </p>
              </div>
              <button onClick={() => undo(c)} disabled={busy}
                className="ml-auto shrink-0 text-[11.5px] text-brand-ink hover:underline disabled:opacity-50">
                Undo
              </button>
            </div>
          ))}
          <p className="text-[11px] text-muted m-0 mt-2 leading-[1.5]">
            The lodged fact find above is unchanged. These are carried onto the client&rsquo;s
            record when the deal settles.
          </p>
        </div>
      )}

      {!open ? (
        <button onClick={() => { setOpen(true); setMsg('') }}
          className="text-[11.5px] font-[600] text-brand-ink border border-info-edge bg-card
                     rounded-lg px-2.5 py-1 hover:bg-info-bg">
          Something changed
        </button>
      ) : (
        <div className="border border-line rounded-xl p-3 bg-card">
          <p className="text-[13px] font-[640] text-ink m-0 mb-1">Record a change</p>
          <p className="text-[11.5px] text-muted m-0 mb-3 leading-[1.5]">
            For something that changed after the deal was lodged. The fact find stays
            exactly as it was submitted.
          </p>

          <div className="grid grid-cols-2 gap-2 mb-2">
            {applicants.length > 1 && (
              <select className={INP} value={who} onChange={e => { setWho(e.target.value); setNow('') }}>
                {applicants.map(a => (
                  <option key={a.id} value={a.id}>{nameOf(a) || 'Applicant'}</option>
                ))}
              </select>
            )}
            <select className={INP} value={field}
              onChange={e => { setField(e.target.value); setNow('') }}>
              {CHANGEABLE.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>

          <p className="text-[10px] font-bold tracking-[.08em] uppercase text-muted m-0 mb-1.5">
            On the lodged fact find
          </p>
          <div className="border border-field-line rounded-lg px-2.5 py-2 text-[12.5px] bg-page
                          text-muted line-through mb-3 min-h-[17px]">
            {was || <span className="not-italic no-underline text-faint">Nothing recorded</span>}
          </div>

          <p className="text-[10px] font-bold tracking-[.08em] uppercase text-muted m-0 mb-1.5">
            What it is now
          </p>
          <input className={INP + ' mb-1'} value={now} autoFocus
            onChange={e => setNow(e.target.value)} />
          {chosen?.hint && (
            <p className="text-[11px] text-faint m-0 mb-3 leading-[1.5]">{chosen.hint}</p>
          )}

          <p className="text-[10px] font-bold tracking-[.08em] uppercase text-muted m-0 mt-3 mb-1.5">
            Anything worth saying <span className="font-[600] tracking-normal normal-case text-faint">— optional</span>
          </p>
          <input className={INP} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Moved 2 Aug, still renting, same suburb." />

          {msg && <p className="text-[11.5px] text-chase m-0 mt-2.5 leading-[1.5]">{msg}</p>}

          <div className="flex items-center gap-2 mt-3">
            <span className="text-[11px] text-faint leading-[1.5]">
              Goes on the file notes as <b className="text-body">{me.name}</b>, and into Needs
              action so the lender gets told.
            </span>
            <button onClick={reset} disabled={busy}
              className="ml-auto text-[12.5px] border border-line bg-card text-muted rounded-lg px-3 py-1.5">
              Cancel
            </button>
            <button onClick={record} disabled={busy || !now.trim()}
              className="text-[12.5px] font-[600] bg-ink text-page rounded-lg px-3 py-1.5 disabled:opacity-50">
              {busy ? 'Recording...' : 'Record it'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
