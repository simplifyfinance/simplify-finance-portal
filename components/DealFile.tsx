'use client'
import { useEffect, useState } from 'react'
import { Bubble, Act, Pill } from '@/components/TheBubble'
import { useGrow } from './useGrow'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import {
  newestFirst, byUrgency, toneOf, chipLabel, whenLabel, dueLabel,
  type Note, type Alert,
} from '@/lib/deal-notes'

// The live file: what is on fire, and what has happened.
//
// Every component here is declared at module level on purpose. One declared
// inside another is a new component type on every render, so React unmounts and
// remounts it - and the box you were typing in loses focus after one character.

const supabase = createSupabaseBrowser()

function SentWording({ id, text }: { id: string; text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(o => !o)}
        aria-expanded={open} aria-controls={`sent-${id}`}
        className="text-[10.5px] font-[650] text-info underline mt-[3px]">
        {open ? 'Hide' : 'Show what was sent'}
      </button>
      {open && (
        <pre id={`sent-${id}`}
          className="mt-1.5 mb-0 max-h-[320px] overflow-auto bg-page border border-line-soft rounded-lg
                     px-3 py-2.5 text-[10.5px] leading-[1.6] text-body whitespace-pre-wrap font-mono">
          {text}
        </pre>
      )}
    </>
  )
}

const PANEL = 'border border-[#E5DED2] rounded-xl bg-card overflow-hidden mb-3'
// THE TITLE MOVED INTO THE BOX HEAD - see components/TheBubble.tsx. What is
// left of this strip is the count and whatever the box lets you do, so it is
// no longer a bar across the top of a panel.
const HEAD = 'text-[9.5px] font-bold tracking-[.08em] uppercase text-muted flex items-center gap-2 mb-2'
const BODY = ''
const INPUT = 'w-full border border-line rounded-lg px-2.5 py-1.5 text-[12.5px] focus:outline-none focus:border-brand'

// ---------------------------------------------------------------- chips ----
// The whole argument for an alert: somebody who was not going to open the deal
// sees it anyway. If you have to open the deal to find it, a plain note would
// have done the same job.
export function AlertChips({ alerts, max = 3 }: { alerts: Alert[]; max?: number }) {
  const open = byUrgency(alerts || [])
  if (open.length === 0) return null
  const shown = open.slice(0, max)
  const rest = open.length - shown.length
  return (
    <>
      {shown.map(a => (
        <span key={a.id} title={a.title}
          className={`max-w-full truncate text-[9.5px] font-bold tracking-[.04em] uppercase rounded-[5px] px-1.5 py-[2px] border ${
            toneOf(a) === 'red'
              ? 'text-chase bg-[#FBECEC] border-chase-edge'
              : 'text-waiting bg-waiting-bg border-waiting-edge'}`}>
          ⚠ {chipLabel(a)}
        </span>
      ))}
      {rest > 0 && (
        <span className="max-w-full truncate text-[9.5px] font-bold tracking-[.04em] uppercase rounded-[5px] px-1.5 py-[2px] border text-muted bg-[#FCFAF6] border-line">
          +{rest}
        </span>
      )}
    </>
  )
}

// --------------------------------------------------------------- alerts ----
export function DealAlerts({ dealId, me, alerts, onChanged }: {
  dealId: string
  me: { id: string | null; name: string }
  alerts: Alert[]
  onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState('')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const grow = useGrow(`one.needs.h.${dealId}`, 230, 520)

  const open = byUrgency(alerts || [])

  async function add() {
    if (!title.trim()) return
    setBusy(true); setMsg('')
    const { data, error } = await supabase.from('deal_alerts').insert({
      deal_id: dealId, title: title.trim(), owner_name: owner.trim() || me.name || null,
      due_on: due || null, author_id: me.id, author_name: me.name || null,
    }).select('id')
    setBusy(false)
    if (error || !data?.length) { setMsg('NOT SAVED - ' + (error?.message || 'the database refused it.')); return }
    setTitle(''); setOwner(''); setDue(''); setAdding(false)
    onChanged()
  }

  async function resolve(a: Alert) {
    const problem = await checkedWrite(
      supabase.from('deal_alerts')
        .update({ resolved_at: new Date().toISOString(), resolved_by: me.name || null })
        .eq('id', a.id),
      'That alert')
    if (problem) { setMsg(problem); return }
    onChanged()
  }

  // THE COUNT AND THE BUTTON LIVE IN THE HEAD - deal-page-stages.html.
  // The count was a word at the top of the body and the button was at the
  // very bottom, under the list, so on a long box you had to scroll to
  // add a thing. And THE WORD "TALLER" IS GONE: Fabio, pointing at the
  // cluster of "5 / Taller / +" that used to be here, "I said taller, the
  // word taller next to the button on the notes section. I don't like
  // that." The box still grows - you drag the handle on its bottom edge,
  // which is what everything else on a screen does.
  return (
    <Bubble tone="urgent" title="Needs action"
      icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></svg>}
      actions={<>
        <Pill hot={open.length > 0}>{open.length}</Pill>
        {!adding && (
          <Act tone="urgent" small main onClick={() => setAdding(true)}
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                       strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" /></svg>}>Add</Act>
        )}
      </>}>
      <div className={BODY}>
        {/* WHO READS IT. Not a note - a thing somebody has to do, and it shows
            on the pipeline list without the deal being opened. 22 Oct 2026:
            renamed from "Important notes", which collided with "Important
            things to note" on the BC and the LO, and both of those go to the
            CLIENT. Same words, opposite audience. */}
        <p className="text-[10.5px] text-faint leading-[1.5] m-0 mb-2">
          Shows as a red chip on the pipeline, so somebody who never opens this deal still sees it.
          Tick it off when it is done.
        </p>
        {open.length === 0 && !adding && (
          <p className="text-[12px] text-faint m-0 mb-2">Nothing needs action.</p>
        )}

        <div ref={grow.wrap} className="overflow-y-auto" style={{ maxHeight: grow.h }}>
        {open.map(a => {
          const red = toneOf(a) === 'red'
          return (
            <div key={a.id}
              className={`flex gap-2 items-start rounded-lg px-2.5 py-2 mb-1.5 border ${
                red ? 'border-chase-edge bg-chase-bg' : 'border-waiting-edge bg-waiting-bg'}`}>
              <span className={`w-[6px] h-[6px] rounded-full shrink-0 mt-[6px] ${red ? 'bg-chase' : 'bg-waiting'}`} />
              <div className="min-w-0">
                <p className="text-[12.5px] text-ink font-[600] m-0">{a.title}</p>
                <p className="text-[10.5px] text-muted m-0 mt-[2px]">
                  {a.owner_name || 'nobody yet'}{a.due_on ? ` · ${dueLabel(a.due_on)}` : ''}
                </p>
              </div>
              <button onClick={() => resolve(a)}
                className="ml-auto shrink-0 text-[10.5px] font-semibold text-[#0E8FCB] border border-[#BFE2F5] bg-card rounded-md px-2 py-[2px] hover:bg-info-bg">
                Resolve
              </button>
            </div>
          )
        })}
        </div>

        {/* Drag the bottom edge, same as the other two. */}
        <div onPointerDown={grow.onGrab} title="Drag to make this taller"
          className="mt-2 mb-1 h-3.5 flex items-center justify-center cursor-ns-resize border-t border-line-soft">
          <span className="w-[26px] h-[3px] rounded-sm bg-line block" />
        </div>

        {adding ? (
          <div className="border border-line rounded-lg p-2.5 mt-1">
            <input className={INPUT + ' mb-1.5'} value={title} autoFocus
              onChange={e => setTitle(e.target.value)} placeholder="What does everyone need to know?" />
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <input className={INPUT} value={owner} onChange={e => setOwner(e.target.value)} placeholder="Who owns it" />
              <input className={INPUT} type="date" value={due} onChange={e => setDue(e.target.value)} />
            </div>
            <div className="flex gap-1.5 items-center">
              <button onClick={add} disabled={busy || !title.trim()}
                className="text-[11.5px] font-semibold bg-ink text-page rounded-lg px-3 py-1.5 disabled:opacity-40">
                {busy ? 'Saving…' : 'Add'}
              </button>
              <button onClick={() => { setAdding(false); setMsg('') }} className="text-[11.5px] text-faint">Cancel</button>
              <span className="text-[11px] text-faint">No date is fine &mdash; it stays amber rather than counting down.</span>
            </div>
          </div>
        ) : null}
        {msg && <p className="text-[11.5px] text-chase m-0 mt-2">{msg}</p>}
      </div>
    </Bubble>
  )
}

// ------------------------------------------------------------ file notes ----
export function FileNotes({ dealId, me, notes, onChanged }: {
  dealId: string
  me: { id: string | null; name: string }
  notes: Note[]
  onChanged: () => void
}) {
  const [body, setBody] = useState('')
  // Shut until somebody presses Add note in the head.
  const [writing, setWriting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const list = newestFirst(notes || [])
  const grow = useGrow(`one.fileupdate.h.${dealId}`, 280, 620)

  async function add() {
    if (!body.trim()) return
    setBusy(true); setMsg('')
    const { data, error } = await supabase.from('deal_notes').insert({
      deal_id: dealId, body: body.trim(), kind: 'note',
      author_id: me.id, author_name: me.name || null,
    }).select('id')
    setBusy(false)
    if (error || !data?.length) { setMsg('NOT SAVED - ' + (error?.message || 'the database refused it.')); return }
    setBody('')
    setWriting(false)
    onChanged()
  }

  return (
    <Bubble tone="plain" title="File update"
      icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>}
      actions={<>
        <Pill>{list.length}</Pill>
        <Act tone="plain" small main onClick={() => setWriting(true)}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" /></svg>}>Add note</Act>
      </>}>
      <div className={BODY}>
        {/* WHO READS IT, and the one thing that makes this box different from
            the other two: nothing here can be typed over. */}
        <p className="text-[10.5px] text-faint leading-[1.5] m-0 mb-2">
          The log. Nothing here can be typed over, and the portal writes to it as well.
        </p>
        {list.length === 0 && <p className="text-[12px] text-faint m-0 mb-2">Nothing recorded yet.</p>}

        {list.length > 0 && (
          <div ref={grow.wrap} className="border-l-2 border-line pl-3 ml-[2px] overflow-y-auto"
               style={{ maxHeight: grow.h }}>
            {list.map(n => (
              <div key={n.id} className="relative mb-2.5 last:mb-0">
                <span className="absolute -left-[17px] top-[5px] w-[6px] h-[6px] rounded-full bg-card border-2 border-[#E5DED2]" />
                <p className="text-[10px] text-faint m-0">
                  {whenLabel(n.created_at)}
                  {' · '}
                  {n.kind === 'system' ? 'recorded automatically' : (n.author_name || 'unknown')}
                </p>
                <p className={`text-[12px] m-0 leading-[1.45] ${n.kind === 'system' ? 'text-muted italic' : 'text-[#575046]'}`}>
                  {n.body}
                </p>
                {/* WHAT WAS ACTUALLY SENT, FOLDED AWAY.
                    A log you have to scroll past to find today's call is a log
                    nobody reads, so an email is one sentence here and the
                    wording is one press away. */}
                {n.detail && <SentWording id={n.id} text={n.detail} />}
              </div>
            ))}
          </div>
        )}

        {list.length > 0 && (
          <div onPointerDown={grow.onGrab} title="Drag to make this taller"
            className="mt-2 mb-1 h-3.5 flex items-center justify-center cursor-ns-resize border-t border-line-soft">
            <span className="w-[26px] h-[3px] rounded-sm bg-line block" />
          </div>
        )}

        {/* data-compose: this box is typed into and then ADDED with the button
            below. It holds nothing until you press it, and it is empty again
            afterwards - so the tests that check a field survives a reload skip
            it. See tests/browser/typing-survives.spec.ts. */}
        {/* SHUT UNTIL YOU WANT IT - deal-page-stages.html draws a dashed
            "Add a note…" line, not a three-line box sitting open on every
            deal. One press and it is the same box it always was, with the
            same data-compose and the same Add note. */}
        {writing ? (
          <>
            <textarea data-compose="1" value={body} onChange={e => setBody(e.target.value)} rows={3}
              autoFocus className={INPUT + ' mt-2.5 resize-y'} placeholder="Add a note…" />
            <div className="flex gap-2 items-center mt-1.5">
              <button onClick={add} disabled={busy || !body.trim()}
                className="text-[11.5px] font-semibold bg-ink text-page rounded-lg px-3 py-1.5 disabled:opacity-40">
                {busy ? 'Saving…' : 'Add note'}
              </button>
              <button onClick={() => { setWriting(false); setBody(''); setMsg('') }}
                className="text-[11.5px] text-faint hover:text-ink">Cancel</button>
              <span className={`text-[11px] ${msg ? 'text-chase' : 'text-faint'}`}>
                {msg || 'Nothing here is ever overwritten.'}
              </span>
            </div>
          </>
        ) : (
          <button onClick={() => setWriting(true)}
            className="w-full text-left mt-2.5 border border-dashed border-card-line rounded-[10px]
              px-3 py-2.5 text-[11.5px] text-faint hover:bg-page transition">
            Add a note&hellip;
          </button>
        )}
      </div>
    </Bubble>
  )
}

// --------------------------------------------------------------- loader ----
// One place that knows how to fetch both, so every screen showing them cannot
// drift from every other.
export function useDealFile(dealId: string) {
  const [notes, setNotes] = useState<Note[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])

  async function reload() {
    const [n, a] = await Promise.all([
      supabase.from('deal_notes').select('*').eq('deal_id', dealId).order('created_at', { ascending: false }).limit(200),
      supabase.from('deal_alerts').select('*').eq('deal_id', dealId).order('created_at', { ascending: false }).limit(100),
    ])
    setNotes((n.data as any) || [])
    setAlerts((a.data as any) || [])
  }

  useEffect(() => { if (dealId) reload() }, [dealId])

  return { notes, alerts, reload }
}

// Written by the portal rather than a person - a lodgement, an unlock, an email
// going to the client. Kept here so the shape of a system note is decided in
// one place.
//
// `detail` is the wording of the email, where there is one. The rail shows
// `body`; detail is what "Show what was sent" opens. Never HTML - see
// lib/email-as-text.ts for why, and for what it looks like.
export async function addSystemNote(
  dealId: string, body: string, me: { id: string | null; name: string }, detail?: string,
) {
  return await supabase.from('deal_notes').insert({
    deal_id: dealId, body, kind: 'system', author_id: me.id, author_name: me.name || null,
    ...(String(detail || '').trim() ? { detail } : {}),
  }).select('id')
}
