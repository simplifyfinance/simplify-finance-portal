'use client'
import { useEffect, useState } from 'react'
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

const PANEL = 'border border-[#E5DED2] rounded-xl bg-white overflow-hidden mb-3'
const HEAD = 'px-3 py-2 bg-[#FCFAF6] border-b border-[#EFEAE0] text-[9.5px] font-bold tracking-[.08em] uppercase text-[#7A7266] flex items-center gap-2'
const BODY = 'px-3 py-3'
const INPUT = 'w-full border border-[#E8E1D6] rounded-lg px-2.5 py-1.5 text-[12.5px] focus:outline-none focus:border-[#2DBEFF]'

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
          className={`text-[9.5px] font-bold tracking-[.04em] uppercase rounded-[5px] px-1.5 py-[2px] border whitespace-nowrap ${
            toneOf(a) === 'red'
              ? 'text-[#AD4227] bg-[#FBECEC] border-[#EFD3CB]'
              : 'text-[#946017] bg-[#FDF6EC] border-[#EBD9BE]'}`}>
          ⚠ {chipLabel(a)}
        </span>
      ))}
      {rest > 0 && (
        <span className="text-[9.5px] font-bold tracking-[.04em] uppercase rounded-[5px] px-1.5 py-[2px] border whitespace-nowrap text-[#7A7266] bg-[#FCFAF6] border-[#EFEAE0]">
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

  return (
    <div className={PANEL}>
      <div className={HEAD}>
        <span>⚠ Important notes</span>
        {open.length > 0 && <span className="ml-auto text-[#946017] font-bold">{open.length}</span>}
      </div>
      <div className={BODY}>
        {open.length === 0 && !adding && (
          <p className="text-[12px] text-[#A29889] m-0 mb-2">Nothing flagged.</p>
        )}

        {open.map(a => {
          const red = toneOf(a) === 'red'
          return (
            <div key={a.id}
              className={`flex gap-2 items-start rounded-lg px-2.5 py-2 mb-1.5 border ${
                red ? 'border-[#EFD3CB] bg-[#FBECEC]' : 'border-[#EBD9BE] bg-[#FDF6EC]'}`}>
              <span className={`w-[6px] h-[6px] rounded-full shrink-0 mt-[6px] ${red ? 'bg-[#AD4227]' : 'bg-[#946017]'}`} />
              <div className="min-w-0">
                <p className="text-[12.5px] text-[#221F1B] font-[600] m-0">{a.title}</p>
                <p className="text-[10.5px] text-[#7A7266] m-0 mt-[2px]">
                  {a.owner_name || 'nobody yet'}{a.due_on ? ` · ${dueLabel(a.due_on)}` : ''}
                </p>
              </div>
              <button onClick={() => resolve(a)}
                className="ml-auto shrink-0 text-[10.5px] font-semibold text-[#0E8FCB] border border-[#BFE2F5] bg-white rounded-md px-2 py-[2px] hover:bg-[#EAF6FD]">
                Resolve
              </button>
            </div>
          )
        })}

        {adding ? (
          <div className="border border-[#E8E1D6] rounded-lg p-2.5 mt-1">
            <input className={INPUT + ' mb-1.5'} value={title} autoFocus
              onChange={e => setTitle(e.target.value)} placeholder="What does everyone need to know?" />
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <input className={INPUT} value={owner} onChange={e => setOwner(e.target.value)} placeholder="Who owns it" />
              <input className={INPUT} type="date" value={due} onChange={e => setDue(e.target.value)} />
            </div>
            <div className="flex gap-1.5 items-center">
              <button onClick={add} disabled={busy || !title.trim()}
                className="text-[11.5px] font-semibold bg-[#343333] text-white rounded-lg px-3 py-1.5 disabled:opacity-40">
                {busy ? 'Saving…' : 'Add'}
              </button>
              <button onClick={() => { setAdding(false); setMsg('') }} className="text-[11.5px] text-[#A29889]">Cancel</button>
              <span className="text-[11px] text-[#A29889]">No date is fine &mdash; it stays amber rather than counting down.</span>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="text-[11.5px] text-[#6E665C] border border-[#E8E1D6] rounded-lg px-2.5 py-1 hover:bg-[#FAF7F2]">
            + Add
          </button>
        )}
        {msg && <p className="text-[11.5px] text-[#C4553B] m-0 mt-2">{msg}</p>}
      </div>
    </div>
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
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const list = newestFirst(notes || [])

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
    onChanged()
  }

  return (
    <div className={PANEL}>
      <div className={HEAD}><span>🕐 File notes</span></div>
      <div className={BODY}>
        {list.length === 0 && <p className="text-[12px] text-[#A29889] m-0 mb-2">Nothing recorded yet.</p>}

        {list.length > 0 && (
          <div className="border-l-2 border-[#EFEAE0] pl-3 ml-[2px]">
            {list.map(n => (
              <div key={n.id} className="relative mb-2.5 last:mb-0">
                <span className="absolute -left-[17px] top-[5px] w-[6px] h-[6px] rounded-full bg-white border-2 border-[#E5DED2]" />
                <p className="text-[10px] text-[#A29889] m-0">
                  {whenLabel(n.created_at)}
                  {' · '}
                  {n.kind === 'system' ? 'recorded automatically' : (n.author_name || 'unknown')}
                </p>
                <p className={`text-[12px] m-0 leading-[1.45] ${n.kind === 'system' ? 'text-[#7A7266] italic' : 'text-[#575046]'}`}>
                  {n.body}
                </p>
              </div>
            ))}
          </div>
        )}

        <textarea value={body} onChange={e => setBody(e.target.value)} rows={2}
          className={INPUT + ' mt-2.5 resize-y'} placeholder="Add a note…" />
        <div className="flex gap-2 items-center mt-1.5">
          <button onClick={add} disabled={busy || !body.trim()}
            className="text-[11.5px] font-semibold bg-[#343333] text-white rounded-lg px-3 py-1.5 disabled:opacity-40">
            {busy ? 'Saving…' : 'Add note'}
          </button>
          <span className={`text-[11px] ${msg ? 'text-[#C4553B]' : 'text-[#A29889]'}`}>
            {msg || 'Nothing here is ever overwritten.'}
          </span>
        </div>
      </div>
    </div>
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

// Written by the portal rather than a person - a lodgement, an unlock. Kept
// here so the shape of a system note is decided in one place.
export async function addSystemNote(dealId: string, body: string, me: { id: string | null; name: string }) {
  return await supabase.from('deal_notes').insert({
    deal_id: dealId, body, kind: 'system', author_id: me.id, author_name: me.name || null,
  }).select('id')
}
