'use client'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import {
  openQuestions, closedQuestions, closedLine, askedLine, askedByHand,
  newHandQuestion, closeByHandPatch, reopenPatch,
  type Question,
} from '@/lib/what-we-still-need'

// THE QUESTIONS, AS THE BROKER SEES THEM BEFORE THEY GO.
//
// 27 Oct 2026. It sits between the Form/Email strip and the email preview on
// both the BC tab and the lending options tab, so the broker is already looking
// at it when they press Send.
//
// WHAT IS ON SCREEN IS WHAT GOES OUT. Unticking a line here takes it out of the
// preview underneath straight away, because the preview is rebuilt from the
// same list. There is never a question about what the client will actually
// receive.
//
// UNTICKING IS NOT ANSWERING. It drops the question from ONE email. It does not
// say the answer is known, and if it were known it would be on the fact find
// and the question would have gone on its own. So a dropped one comes back on
// the next email, which is exactly where it should be asked again.
//
// EVERYTHING IS TICKED TO START WITH. A broker in a hurry sends the lot, which
// is the right default: asking one question too many costs a sentence, and
// asking none costs two weeks.

const PILL = 'text-[10px] font-bold rounded-full px-2 py-[2px] whitespace-nowrap border ml-2 align-middle'
const INP = 'w-full text-[13px] border border-field-line rounded-lg px-3 py-2 text-ink bg-card focus:outline-none focus:border-brand'

export default function WhatWeStillNeed({ deal, me, dropped, onDropped, onChanged }: {
  deal: any
  me?: { id?: string | null; name?: string | null }
  /** Keys the broker has unticked for THIS email. Held by the form, not here. */
  dropped: string[]
  onDropped: (keys: string[]) => void
  /** The preview is rebuilt when a question is added or ticked off. */
  onChanged?: () => void
}) {
  const supabase = createSupabaseBrowser()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [adding, setAdding] = useState(false)
  const [ask, setAsk] = useState('')
  const [help, setHelp] = useState('')

  const open = openQuestions(deal)
  const closed = closedQuestions(deal)
  const off = new Set(dropped)
  const going = open.filter(q => !off.has(q.key))

  // NO BLOCK WHERE THERE IS NOTHING TO ASK, and no "nothing outstanding"
  // either - except the one line that lets somebody add a question anyway.
  const nothingAtAll = !open.length && !closed.length

  function toggle(key: string) {
    onDropped(off.has(key) ? dropped.filter(k => k !== key) : [...dropped, key])
  }

  async function write(patch: Record<string, any>) {
    setBusy(true); setErr('')
    // RLS refuses a write by returning no rows and no error, so the row is the
    // proof that anything happened.
    const { data, error } = await supabase.from('deals').update(patch).eq('id', deal.id).select('id')
    setBusy(false)
    if (error || !data?.length) {
      setErr(error?.message || 'That was not saved — nothing reached the database.')
      return false
    }
    onChanged?.()
    return true
  }

  async function addOne() {
    const words = ask.trim()
    if (!words) return
    const q = newHandQuestion(words, help, me?.name || '')
    const ok = await write({ questions_added: [...askedByHandRaw(deal), q] })
    if (ok) { setAsk(''); setHelp(''); setAdding(false) }
  }

  async function removeOne(key: string) {
    await write({ questions_added: askedByHandRaw(deal).filter((q: any) => String(q?.key) !== key) })
  }

  async function tickOff(key: string) {
    await write(closeByHandPatch(deal, key, me?.name || ''))
  }

  async function putBack(key: string) {
    await write(reopenPatch(deal, key))
  }

  if (nothingAtAll) {
    return (
      <div className="flex items-center gap-3 flex-wrap mb-3 px-1">
        <span className="text-[12px] text-faint">
          Nothing outstanding — the fact find has everything a lender needs.
        </span>
        <AddButton onClick={() => setAdding(true)} />
        {adding && (
          <AddBox ask={ask} setAsk={setAsk} help={help} setHelp={setHelp}
            busy={busy} onAdd={addOne} onCancel={() => setAdding(false)} />
        )}
        {err && <p className="text-[12px] text-chase m-0 w-full">{err}</p>}
      </div>
    )
  }

  return (
    <div className="border border-waiting-edge bg-waiting-bg rounded-xl px-4 py-3.5 mb-3">
      <div className="flex items-baseline gap-2.5 flex-wrap mb-1">
        <b className="text-[13.5px] text-waiting">
          {going.length
            ? `Questions going out with this email`
            : 'No questions are going out with this email'}
        </b>
        <span className="text-[11.5px] text-waiting/80">
          {going.length ? `${going.length} of ${open.length} · untick anything you already know` : ''}
          {closed.length ? `${going.length ? ' · ' : ''}${closed.length} already answered` : ''}
        </span>
      </div>
      <p className="text-[11.5px] text-muted mt-0 mb-2.5 leading-relaxed max-w-[720px]">
        Every one of these is here because the fact find has a gap. Fill the gap and it disappears.
        Unticking takes it off this email only — it will come back on the next one.
      </p>

      <div className="flex flex-col gap-1.5">
        {open.map(q => (
          <Row key={q.key} q={q} deal={deal} on={!off.has(q.key)}
            onToggle={() => toggle(q.key)} busy={busy}
            onTickOff={q.closesItself ? undefined : () => tickOff(q.key)}
            onRemove={q.closesItself ? undefined : () => removeOne(q.key)} />
        ))}

        {/* A CLOSED QUESTION IS NEVER HIDDEN. It is the only way anybody will
            trust the list - the broker can see the last email did its job. */}
        {closed.map(c => (
          <div key={c.key}
            className="border border-done-edge bg-done-bg rounded-[10px] px-3.5 py-2.5 flex gap-3 items-start">
            <span className="text-[13px] text-done leading-none mt-[3px]">&#10003;</span>
            <span className="flex-1 min-w-0">
              <b className="block text-[13px] text-done">{c.ask}</b>
              <span className="text-[11.5px] text-muted">{closedLine(c)}</span>
            </span>
            {askedByHandRaw(deal).some((q: any) => String(q?.key) === c.key) && (
              <button onClick={() => putBack(c.key)} disabled={busy}
                className="text-[11.5px] text-muted underline whitespace-nowrap">Not answered</button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex items-start gap-2 flex-wrap">
        <AddButton onClick={() => setAdding(true)} />
        {adding && (
          <AddBox ask={ask} setAsk={setAsk} help={help} setHelp={setHelp}
            busy={busy} onAdd={addOne} onCancel={() => setAdding(false)} />
        )}
      </div>

      {err && <p className="text-[12px] text-chase mt-2 mb-0">{err}</p>}
    </div>
  )
}

function Row({ q, deal, on, onToggle, onTickOff, onRemove, busy }: {
  q: Question; deal: any; on: boolean; onToggle: () => void
  onTickOff?: () => void; onRemove?: () => void; busy: boolean
}) {
  const asked = askedLine(deal, q.key)
  return (
    <div className={`rounded-[10px] px-3.5 py-2.5 flex gap-3 items-start border ${
      on ? 'bg-card border-waiting-edge' : 'bg-page border-field-line'}`}>
      <input type="checkbox" checked={on} onChange={onToggle}
        aria-label={on ? `Do not ask: ${q.ask}` : `Ask: ${q.ask}`}
        className="mt-[3px] w-[15px] h-[15px] accent-[#5B3A9E] shrink-0" />
      <span className="flex-1 min-w-0">
        <b className={`block text-[13px] ${on ? 'text-ink' : 'text-faint'}`}>
          {q.ask}
          <span className={`${PILL} ${q.closesItself
            ? 'bg-card text-waiting border-waiting-edge'
            : 'bg-card text-info border-info-edge'}`}>
            {q.closesItself ? 'Found by the portal' : `Added by ${q.addedBy || 'somebody'}`}
          </span>
        </b>
        <span className="text-[11.5px] text-muted">
          {on ? q.why : 'Unticked — it will come back on the next email if the gap is still there.'}
        </span>
      </span>
      <span className="flex gap-2.5 items-center whitespace-nowrap">
        {asked && <span className="text-[11.5px] text-waiting font-semibold">{asked}</span>}
        {onTickOff && (
          <button onClick={onTickOff} disabled={busy}
            title="Somebody has answered this"
            className="text-[11.5px] text-muted underline">Answered</button>
        )}
        {onRemove && (
          <button onClick={onRemove} disabled={busy}
            title="Take this question off the deal"
            className="text-[11.5px] text-muted underline">Remove</button>
        )}
      </span>
    </div>
  )
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="text-[11.5px] font-semibold text-[#0E8FCB] bg-card border border-dashed border-[#BFE6F9] rounded-[9px] px-3 py-1.5">
      + Ask something else
    </button>
  )
}

// ON THE DEAL, NOT IN A LIST IN SETTINGS.
//
// Fabio, asked whether credit should be able to add their own: "yes I want them
// to ask questions as well". "Is the Brunswick place still tenanted" is about
// one file, and a question bank nobody prunes is noise on every deal inside a
// month. If the same one keeps being typed, THAT is the signal it belongs in
// the fact find as a real field - a better reason to add one than guessing.
function AddBox({ ask, setAsk, help, setHelp, busy, onAdd, onCancel }: {
  ask: string; setAsk: (v: string) => void
  help: string; setHelp: (v: string) => void
  busy: boolean; onAdd: () => void; onCancel: () => void
}) {
  return (
    <div className="flex-1 min-w-[320px] bg-card border border-card-line rounded-[10px] p-3">
      <input className={INP} value={ask} onChange={e => setAsk(e.target.value)} autoFocus
        placeholder="What you want to ask, in the client's words" />
      <input className={`${INP} mt-2`} value={help} onChange={e => setHelp(e.target.value)}
        placeholder="One line of help underneath, if it needs it (optional)" />
      <p className="text-[11px] text-faint mt-2 mb-2 leading-relaxed">
        It goes in the next email in the same block. The portal cannot tell when this one is
        answered, so somebody has to tick it off.
      </p>
      <div className="flex gap-2">
        <button onClick={onAdd} disabled={busy || !ask.trim()}
          className="text-[12px] font-semibold text-[#0E8FCB] bg-card border border-[#BFE6F9] rounded-lg px-4 py-1.5 disabled:opacity-40">
          Add it
        </button>
        <button onClick={onCancel}
          className="text-[12px] border border-card-line bg-card rounded-lg px-3 py-1.5 text-body">
          Cancel
        </button>
      </div>
    </div>
  )
}

/** The raw rows, so adding one never drops a field this screen does not know about. */
function askedByHandRaw(deal: any): any[] {
  return Array.isArray(deal?.questions_added) ? deal.questions_added : []
}

export { askedByHand }
